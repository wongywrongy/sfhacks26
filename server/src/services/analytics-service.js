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

  const analytics = {
    combinedIncome,
    combinedDebt,
    combinedObligations,
    groupDTI: groupDTI !== null ? Math.round(groupDTI * 10000) / 10000 : null,
    dtiClassification,
    maxMonthlyPayment: Math.round(maxMonthlyPayment * 100) / 100,
    estimatedLoanAmount,
    incomeDiversityScore,
    memberCount: members.length,
    resilienceMatrix,
    computedAt: new Date(),
  };

  await repo.updateProject(projectId, { groupMetrics: analytics });

  return analytics;
}

module.exports = { computeGroupAnalytics, getEligibleMembers };
