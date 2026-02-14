const repo = require('../repositories/project-repository');
const { MemberOrgStatus, CrsCheckStatus, ContributionModelType } = require('../../../shared/enums');
const { UNIT_SIZE_WEIGHTS, HYBRID_SPLIT, AFFORDABILITY_THRESHOLD } = require('../../../shared/constants');

function getEligibleMembers(project, excludeIds = []) {
  const excludeSet = new Set(excludeIds.map((id) => id.toString()));
  return (project.members || []).filter(
    (m) =>
      m.orgStatus === MemberOrgStatus.APPROVED &&
      m.credit?.status === CrsCheckStatus.COMPLETE &&
      !excludeSet.has(m._id.toString())
  );
}

function memberBreakdown(member, paymentAmount) {
  const income = member.monthlyIncome || 0;
  const obligations = member.credit?.monthlyObligations || 0;
  const pct = income > 0 ? Math.round((paymentAmount / income) * 10000) / 10000 : null;
  const breathingRoom = income - obligations - paymentAmount;
  return {
    memberId: member._id.toString(),
    displayName: member.firstName,
    paymentAmount: Math.round(paymentAmount * 100) / 100,
    percentageOfIncome: pct,
    breathingRoom: Math.round(breathingRoom * 100) / 100,
    exceedsAffordability: pct !== null && pct > AFFORDABILITY_THRESHOLD,
  };
}

function computeEqual(members, totalCost) {
  const payment = totalCost / members.length;
  return {
    type: ContributionModelType.EQUAL,
    members: members.map((m) => memberBreakdown(m, payment)),
  };
}

function computeProportional(members, totalCost) {
  const combinedIncome = members.reduce((s, m) => s + (m.monthlyIncome || 0), 0);
  return {
    type: ContributionModelType.PROPORTIONAL,
    members: members.map((m) => {
      const share = combinedIncome > 0 ? (m.monthlyIncome || 0) / combinedIncome : 0;
      return memberBreakdown(m, share * totalCost);
    }),
  };
}

function computeUnitBased(members, totalCost) {
  const rawWeights = members.map((m) => UNIT_SIZE_WEIGHTS[m.unitSize] || 1.0);
  const weightSum = rawWeights.reduce((s, w) => s + w, 0);
  return {
    type: ContributionModelType.UNIT_BASED,
    members: members.map((m, i) => {
      const normalized = weightSum > 0 ? rawWeights[i] / weightSum : 0;
      return memberBreakdown(m, normalized * totalCost);
    }),
  };
}

function computeHybrid(members, totalCost) {
  const equalPortion = totalCost * HYBRID_SPLIT.EQUAL_PORTION;
  const propPortion = totalCost * HYBRID_SPLIT.PROPORTIONAL_PORTION;
  const equalPerMember = equalPortion / members.length;
  const combinedIncome = members.reduce((s, m) => s + (m.monthlyIncome || 0), 0);
  return {
    type: ContributionModelType.HYBRID,
    members: members.map((m) => {
      const propShare = combinedIncome > 0 ? (m.monthlyIncome || 0) / combinedIncome : 0;
      return memberBreakdown(m, equalPerMember + propShare * propPortion);
    }),
  };
}

function buildCustomModel(members, assignments, totalCost) {
  const assignmentMap = new Map();
  for (const a of assignments) {
    assignmentMap.set(a.memberId.toString(), a.paymentAmount);
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
    type: ContributionModelType.CUSTOM,
    members: members.map((m) => {
      const payment = assignmentMap.get(m._id.toString()) || 0;
      return memberBreakdown(m, payment);
    }),
    balanceStatus,
  };
}

async function computeContributions(projectId, excludeIds = []) {
  const project = await repo.getProjectById(projectId);
  if (!project) throw new Error('Project not found');

  const members = getEligibleMembers(project, excludeIds);
  if (members.length === 0) {
    return { error: true, message: 'No eligible members found' };
  }

  const totalCost = project.estimatedMonthlyCost;

  const models = {
    equal: computeEqual(members, totalCost),
    proportional: computeProportional(members, totalCost),
    unitBased: computeUnitBased(members, totalCost),
    hybrid: computeHybrid(members, totalCost),
  };

  // Custom model: return as-is on excludes (not recalculated), rebuild fresh otherwise
  if (project.customContributionModel) {
    if (excludeIds.length > 0) {
      models.custom = {
        ...project.customContributionModel,
        note: 'Custom model is not recalculated for member toggles. Excluded members\' amounts remain unassigned.',
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

async function saveCustomModel(projectId, assignments) {
  const project = await repo.getProjectById(projectId);
  if (!project) throw new Error('Project not found');

  const totalCost = project.estimatedMonthlyCost;
  const members = getEligibleMembers(project);

  const model = buildCustomModel(members, assignments, totalCost);

  await repo.updateProject(projectId, {
    customContributionModel: {
      assignments,
      ...model,
      updatedAt: new Date(),
    },
  });

  return model;
}

module.exports = { computeContributions, saveCustomModel };
