// Ported from server/src/services/analytics-service.js and contribution-service.js
// Constants from shared/constants.js and shared/enums.js

// ── Constants ──

export const AFFORDABILITY_THRESHOLD = 0.3;

export const DTI = Object.freeze({
  HEALTHY_MAX: 0.36,
  ACCEPTABLE_MAX: 0.43,
});

export const RESILIENCE_THRESHOLD = 0.43;

export const HYBRID_SPLIT = Object.freeze({
  EQUAL_PORTION: 0.5,
  PROPORTIONAL_PORTION: 0.5,
});

// ── Analytics ──

function classifyDTI(dti) {
  if (dti < DTI.HEALTHY_MAX) return 'healthy';
  if (dti <= DTI.ACCEPTABLE_MAX) return 'acceptable';
  return 'risky';
}

function monthlyPaymentToLoanAmount(monthlyPayment, annualRate = 0.07) {
  const r = annualRate / 12;
  const n = 30 * 12;
  const factor = Math.pow(1 + r, n);
  return monthlyPayment * (factor - 1) / (r * factor);
}

export function getEligibleMembers(project, excludeIds = []) {
  const excludeSet = new Set(excludeIds.map(String));
  return (project.members || []).filter(
    (m) =>
      m.orgStatus === 'approved' &&
      m.creditStatus === 'complete' &&
      !excludeSet.has(String(m._id))
  );
}

export function computeGroupAnalytics(project, interestRate) {
  const members = getEligibleMembers(project);
  if (members.length < 2) {
    return { error: true, message: 'At least 2 approved members with completed credit checks are required' };
  }

  const monthlyCost = project.estimatedMonthlyCost;
  const combinedIncome = members.reduce((sum, m) => sum + (m.monthlyIncome || 0), 0);
  const combinedObligations = members.reduce((sum, m) => sum + (m.monthlyObligations || 0), 0);
  const combinedDebt = members.reduce((sum, m) => {
    // Use totalDebt from credit if available, otherwise estimate from obligations
    return sum + (m.totalDebt || m.monthlyObligations * 18 || 0);
  }, 0);

  const groupDTI = combinedIncome > 0
    ? (combinedObligations + monthlyCost) / combinedIncome
    : null;
  const dtiClassification = groupDTI !== null ? classifyDTI(groupDTI) : null;

  const maxMonthlyPayment = Math.max(0, combinedIncome * DTI.ACCEPTABLE_MAX - combinedObligations);
  const rate = interestRate || 0.07;
  const estimatedLoanAmount = Math.round(monthlyPaymentToLoanAmount(maxMonthlyPayment, rate));

  const uniqueTypes = new Set(members.map((m) => m.employmentType)).size;
  const incomeDiversityScore = Math.round((uniqueTypes / members.length) * 100) / 100;

  const resilienceMatrix = members.map((m) => {
    const incomeWithout = combinedIncome - (m.monthlyIncome || 0);
    const obligationsWithout = combinedObligations - (m.monthlyObligations || 0);
    const dtiWithout = incomeWithout > 0
      ? (obligationsWithout + monthlyCost) / incomeWithout
      : null;
    return {
      memberId: String(m._id),
      displayName: m.firstName,
      dtiWithout: dtiWithout !== null ? Math.round(dtiWithout * 10000) / 10000 : null,
      isCriticalDependency: dtiWithout !== null && dtiWithout > RESILIENCE_THRESHOLD,
    };
  });

  const memberBreakdown = members.map((m) => ({
    memberId: String(m._id),
    displayName: m.firstName,
    monthlyIncome: m.monthlyIncome || 0,
    monthlyObligations: m.monthlyObligations || 0,
  }));

  return {
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
    computedAt: new Date().toISOString(),
  };
}

// ── Contributions ──

function memberBreakdown(member, paymentAmount) {
  const income = member.monthlyIncome || 0;
  const obligations = member.monthlyObligations || 0;
  const pct = income > 0 ? Math.round((paymentAmount / income) * 10000) / 10000 : null;
  const breathingRoom = income - obligations - paymentAmount;
  return {
    memberId: String(member._id),
    displayName: member.firstName,
    paymentAmount: Math.round(paymentAmount * 100) / 100,
    percentageOfIncome: pct,
    breathingRoom: Math.round(breathingRoom * 100) / 100,
    exceedsAffordability: pct !== null && pct > AFFORDABILITY_THRESHOLD,
    monthlyIncome: income,
    monthlyObligations: obligations,
  };
}

function computeEqual(members, totalCost) {
  const payment = totalCost / members.length;
  return {
    type: 'equal',
    members: members.map((m) => memberBreakdown(m, payment)),
  };
}

function computeProportional(members, totalCost) {
  const combinedIncome = members.reduce((s, m) => s + (m.monthlyIncome || 0), 0);
  return {
    type: 'proportional',
    members: members.map((m) => {
      const share = combinedIncome > 0 ? (m.monthlyIncome || 0) / combinedIncome : 0;
      return memberBreakdown(m, share * totalCost);
    }),
  };
}

function computeHybrid(members, totalCost) {
  const equalPortion = totalCost * HYBRID_SPLIT.EQUAL_PORTION;
  const propPortion = totalCost * HYBRID_SPLIT.PROPORTIONAL_PORTION;
  const equalPerMember = equalPortion / members.length;
  const combinedIncome = members.reduce((s, m) => s + (m.monthlyIncome || 0), 0);
  return {
    type: 'hybrid',
    members: members.map((m) => {
      const propShare = combinedIncome > 0 ? (m.monthlyIncome || 0) / combinedIncome : 0;
      return memberBreakdown(m, equalPerMember + propShare * propPortion);
    }),
  };
}

export function buildCustomModel(members, assignments, totalCost) {
  const assignmentMap = new Map();
  for (const a of assignments) {
    assignmentMap.set(String(a.memberId), a.paymentAmount);
  }

  const totalAssigned = assignments.reduce((s, a) => s + a.paymentAmount, 0);
  const diff = Math.round((totalAssigned - totalCost) * 100) / 100;
  let balanceStatus;
  if (Math.abs(diff) < 0.01) {
    balanceStatus = { balanced: true };
  } else if (diff > 0) {
    balanceStatus = { balanced: false, overage: diff };
  } else {
    balanceStatus = { balanced: false, shortfall: Math.abs(diff) };
  }

  return {
    type: 'custom',
    members: members.map((m) => {
      const payment = assignmentMap.get(String(m._id)) || 0;
      return memberBreakdown(m, payment);
    }),
    balanceStatus,
  };
}

export function computeContributions(project, excludeIds = []) {
  const members = getEligibleMembers(project, excludeIds);
  if (members.length === 0) {
    return { error: true, message: 'No eligible members found' };
  }

  const totalCost = project.estimatedMonthlyCost;

  const models = {
    equal: computeEqual(members, totalCost),
    proportional: computeProportional(members, totalCost),
    hybrid: computeHybrid(members, totalCost),
  };

  if (project.customContributionModel) {
    if (excludeIds.length > 0) {
      models.custom = {
        ...project.customContributionModel,
        note: "Custom model is not recalculated for member toggles.",
      };
    } else {
      models.custom = buildCustomModel(
        members,
        project.customContributionModel.assignments,
        totalCost
      );
    }
  }

  return models;
}
