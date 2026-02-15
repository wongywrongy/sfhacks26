const repo = require('../repositories/project-repository');
const { MemberOrgStatus, CrsCheckStatus } = require('../../../shared/enums');
const { DTI, RESILIENCE_THRESHOLD } = require('../../../shared/constants');

function getEligibleMembers(project) {
  return (project.members || []).filter(
    (m) => m.orgStatus === MemberOrgStatus.APPROVED && m.credit?.status === CrsCheckStatus.COMPLETE
  );
}

function classifyDTI(dti) {
  if (dti < DTI.HEALTHY_MAX) return 'healthy';
  if (dti <= DTI.ACCEPTABLE_MAX) return 'acceptable';
  return 'risky';
}

// Convert max monthly payment to approximate loan amount using 30-year fixed mortgage formula
function monthlyPaymentToLoanAmount(monthlyPayment, annualRate = 0.07) {
  const r = annualRate / 12;
  const n = 30 * 12;
  const factor = Math.pow(1 + r, n);
  return monthlyPayment * (factor - 1) / (r * factor);
}

async function computeGroupAnalytics(projectId, interestRate) {
  const project = await repo.getProjectById(projectId);
  if (!project) throw new Error('Project not found');

  const members = getEligibleMembers(project);
  if (members.length < 2) {
    return { error: true, message: 'At least 2 approved members with completed credit checks are required' };
  }

  const monthlyCost = project.estimatedMonthlyCost;

  const combinedIncome = members.reduce((sum, m) => sum + (m.monthlyIncome || 0), 0);
  const combinedObligations = members.reduce((sum, m) => sum + (m.credit?.monthlyObligations || 0), 0);
  const combinedDebt = members.reduce((sum, m) => sum + (m.credit?.totalDebt || 0), 0);

  // Group DTI = (existing obligations + proposed housing cost) / income
  const groupDTI = combinedIncome > 0
    ? (combinedObligations + monthlyCost) / combinedIncome
    : null;
  const dtiClassification = groupDTI !== null ? classifyDTI(groupDTI) : null;

  // Borrowing power: max monthly = (income × 0.43) - existing obligations
  const maxMonthlyPayment = Math.max(0, combinedIncome * DTI.ACCEPTABLE_MAX - combinedObligations);
  const rate = interestRate || 0.07;
  const estimatedLoanAmount = Math.round(monthlyPaymentToLoanAmount(maxMonthlyPayment, rate));

  // Income diversity: ratio of unique employment types to total members
  const uniqueTypes = new Set(members.map((m) => m.employmentType)).size;
  const incomeDiversityScore = Math.round((uniqueTypes / members.length) * 100) / 100;

  // Resilience matrix: for each member, what happens if they leave
  const resilienceMatrix = members.map((m) => {
    const incomeWithout = combinedIncome - (m.monthlyIncome || 0);
    const obligationsWithout = combinedObligations - (m.credit?.monthlyObligations || 0);
    const dtiWithout = incomeWithout > 0
      ? (obligationsWithout + monthlyCost) / incomeWithout
      : null;
    return {
      memberId: m._id.toString(),
      displayName: m.firstName,
      dtiWithout: dtiWithout !== null ? Math.round(dtiWithout * 10000) / 10000 : null,
      isCriticalDependency: dtiWithout !== null && dtiWithout > RESILIENCE_THRESHOLD,
    };
  });

  const memberBreakdown = members.map((m) => ({
    memberId: m._id.toString(),
    displayName: m.firstName,
    monthlyIncome: m.monthlyIncome || 0,
    monthlyObligations: m.credit?.monthlyObligations || 0,
  }));

  const analytics = {
    combinedIncome,
    combinedDebt,
    combinedObligations,
    groupDTI: groupDTI !== null ? Math.round(groupDTI * 10000) / 10000 : null,
    dtiClassification,
    maxMonthlyPayment: Math.round(maxMonthlyPayment * 100) / 100,
    estimatedLoanAmount,
    estimatedMonthlyCost: monthlyCost,
    incomeDiversityScore,
    memberCount: members.length,
    memberBreakdown,
    resilienceMatrix,
    computedAt: new Date(),
  };

  await repo.updateProject(projectId, { groupMetrics: analytics });

  return analytics;
}

// Debounce: one pending reassessment per project, no concurrent duplicates
const _reassessRunning = new Map(); // projectId → Promise
const _reassessQueued = new Set();  // projectIds waiting for another run

async function reassessGroup(projectId) {
  if (_reassessRunning.has(projectId)) {
    _reassessQueued.add(projectId);
    return;
  }

  const run = _reassessGroupInner(projectId).finally(() => {
    _reassessRunning.delete(projectId);
    if (_reassessQueued.has(projectId)) {
      _reassessQueued.delete(projectId);
      reassessGroup(projectId).catch(() => {});
    }
  });
  _reassessRunning.set(projectId, run);
  return run;
}

async function _reassessGroupInner(projectId) {
  try {
    const project = await repo.getProjectById(projectId);
    if (!project) return;

    const members = getEligibleMembers(project);
    if (members.length < 2) return;

    // Recompute group metrics
    const analytics = await computeGroupAnalytics(projectId);
    if (analytics.error) return;

    // Recompute contribution models
    const { computeContributions } = require('./contribution-service');
    const contributions = await computeContributions(projectId);

    // Group assessment via Gemini
    const gemini = require('../wrappers/gemini-wrapper');
    const groupProfile = {
      ...analytics,
      estimatedMonthlyCost: project.estimatedMonthlyCost,
      members: members.map((m) => ({
        firstName: m.firstName,
        monthlyIncome: m.monthlyIncome,
        employmentType: m.employmentType,
        creditScore: m.credit?.score ?? null,
        monthlyObligations: m.credit?.monthlyObligations ?? 0,
        personalDTI: m.personalDTI,
      })),
    };

    const groupResult = await gemini.assessGroup(groupProfile);
    if (groupResult.success) {
      await repo.updateProject(projectId, { groupAssessment: groupResult.data });
    }

    // Group tradeline composition — aggregate individual compositions from approved members
    const membersWithComposition = members.filter((m) => m.tradelineComposition);
    if (membersWithComposition.length > 0) {
      const aggregated = { revolving: { count: 0, totalBalance: 0 }, installment: { count: 0, totalBalance: 0 }, mortgage: { count: 0, totalBalance: 0 }, other: { count: 0, totalBalance: 0 } };
      let totalGroupBalance = 0;
      let revolvingHeavyCount = 0;

      for (const m of membersWithComposition) {
        const cats = m.tradelineComposition.categories || {};
        for (const [cat, data] of Object.entries(cats)) {
          if (aggregated[cat]) {
            aggregated[cat].count += data.count || 0;
            aggregated[cat].totalBalance += data.totalBalance || 0;
          }
          totalGroupBalance += data.totalBalance || 0;
        }
        // Count members with revolving utilization > 50%
        if (m.tradelineComposition.revolvingUtilization > 50) {
          revolvingHeavyCount++;
        }
      }

      // Determine dominant group debt type
      const sorted = Object.entries(aggregated).sort((a, b) => b[1].totalBalance - a[1].totalBalance);
      const dominantGroupDebtType = sorted[0]?.[0] || null;
      const dominantPct = totalGroupBalance > 0 ? Math.round((sorted[0]?.[1]?.totalBalance / totalGroupBalance) * 100) : 0;

      // Debt concentration risk
      let debtConcentrationRisk;
      const revHeavyPct = membersWithComposition.length > 0 ? (revolvingHeavyCount / membersWithComposition.length) * 100 : 0;
      if (dominantPct > 70 || revHeavyPct >= 75) {
        debtConcentrationRisk = 'high';
      } else if (dominantPct > 50 || revHeavyPct >= 50) {
        debtConcentrationRisk = 'moderate';
      } else {
        debtConcentrationRisk = 'low';
      }

      const groupTradelineComposition = {
        aggregateByType: aggregated,
        totalGroupBalance,
        dominantGroupDebtType,
        dominantPct,
        debtConcentrationRisk,
        revolvingHeavyCount,
        memberCount: membersWithComposition.length,
        computedAt: new Date(),
      };

      await repo.updateProject(projectId, { groupTradelineComposition });
    }

    // Group safety assessment — if any member has criminal/eviction records
    const membersWithRecords = members.filter((m) =>
      (m.criminalStructured?.summary?.totalRecords > 0) || (m.evictionStructured?.summary?.totalFilings > 0)
    );
    if (membersWithRecords.length > 0) {
      const memberSafetySummaries = membersWithRecords.map((m) => ({
        firstName: m.firstName,
        criminalSummary: m.criminalStructured?.summary || null,
        evictionSummary: m.evictionStructured?.summary || null,
        identityStatus: m.identityStructured?.verificationStatus || null,
      }));
      const safetyOverviewResult = await gemini.assessGroupSafety(memberSafetySummaries);
      if (safetyOverviewResult.success) {
        await repo.updateProject(projectId, { aiSafetyOverview: safetyOverviewResult.data });
      }
    }

    // Model analysis via Gemini
    if (!contributions.error) {
      const modelProfile = {
        estimatedMonthlyCost: project.estimatedMonthlyCost,
        memberCount: analytics.memberCount,
        combinedIncome: analytics.combinedIncome,
        groupDTI: analytics.groupDTI,
      };

      const modelResult = await gemini.analyzeModels(contributions, modelProfile);
      if (modelResult.success) {
        await repo.updateProject(projectId, { modelAnalysis: modelResult.data });
      }
    }
  } catch (err) {
    console.error(`reassessGroup(${projectId}) failed:`, err.message);
  }
}

module.exports = { computeGroupAnalytics, getEligibleMembers, reassessGroup };
