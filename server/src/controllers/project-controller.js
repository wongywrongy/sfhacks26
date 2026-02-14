const projectService = require('../services/project-service');
const repo = require('../repositories/project-repository');
const { retryCrsChecks } = require('../services/intake-service');
const { CrsCheckStatus } = require('../../../shared/enums');

async function createProject(req, res) {
  const { name, priceLow, priceHigh, estimatedMonthlyCost, city, state, expectedMemberCount } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: true, message: 'Project name is required', field: 'name' });
  }
  if (!estimatedMonthlyCost || estimatedMonthlyCost <= 0) {
    return res.status(400).json({ error: true, message: 'Estimated monthly cost is required', field: 'estimatedMonthlyCost' });
  }
  if (!expectedMemberCount || expectedMemberCount < 2 || expectedMemberCount > 10) {
    return res.status(400).json({ error: true, message: 'Expected members must be 2-10', field: 'expectedMemberCount' });
  }

  const project = await projectService.createProject(req.orgId, {
    name: name.trim(),
    priceLow: priceLow || 0,
    priceHigh: priceHigh || 0,
    estimatedMonthlyCost,
    city: city || '',
    state: state || '',
    expectedMemberCount,
  });

  res.status(201).json({
    _id: project._id,
    name: project.name,
    status: project.status,
    intakeLinkToken: project.intakeLinkToken,
    estimatedMonthlyCost: project.estimatedMonthlyCost,
    expectedMemberCount: project.expectedMemberCount,
    membersCompleted: 0,
    dateCreated: project.dateCreated,
  });
}

async function getProject(req, res) {
  const project = await projectService.getProjectDetail(req.params.projectId, req.orgId);
  if (!project) {
    return res.status(404).json({ error: true, message: 'Project not found' });
  }

  // Strip sensitive data from members before returning
  const members = (project.members || []).map((m) => ({
    _id: m._id,
    firstName: m.firstName,
    lastInitial: m.lastName ? m.lastName[0] : '',
    ssnLast4: m.ssn ? m.ssn.slice(-4) : '',
    monthlyIncome: m.monthlyIncome,
    employmentType: m.employmentType,
    unitSize: m.unitSize,
    creditStatus: m.credit?.status || CrsCheckStatus.PENDING,
    criminalStatus: m.criminal?.status || CrsCheckStatus.PENDING,
    evictionStatus: m.eviction?.status || CrsCheckStatus.PENDING,
    identityStatus: m.identity?.status || CrsCheckStatus.PENDING,
    orgStatus: m.orgStatus,
    dateSubmitted: m.dateSubmitted,
  }));

  res.json({
    _id: project._id,
    name: project.name,
    status: project.status,
    priceRange: project.priceRange,
    estimatedMonthlyCost: project.estimatedMonthlyCost,
    location: project.location,
    expectedMemberCount: project.expectedMemberCount,
    intakeLinkToken: project.intakeLinkToken,
    members,
    groupMetrics: project.groupMetrics,
    contributionModels: project.contributionModels,
    dateCreated: project.dateCreated,
  });
}

async function getProjects(req, res) {
  const projects = await projectService.getProjectsForOrg(req.orgId);

  const summaries = projects.map((p) => {
    const completedMembers = (p.members || []).filter(
      (m) => m.credit?.status === CrsCheckStatus.COMPLETE
    ).length;
    return {
      _id: p._id,
      name: p.name,
      status: p.status,
      membersCompleted: completedMembers,
      expectedMemberCount: p.expectedMemberCount,
      dateCreated: p.dateCreated,
    };
  });

  res.json(summaries);
}

async function getMember(req, res) {
  const member = await repo.getMemberById(req.params.projectId, req.params.memberId);
  if (!member) {
    return res.status(404).json({ error: true, message: 'Member not found' });
  }

  res.json({
    _id: member._id,
    firstName: member.firstName,
    lastInitial: member.lastName?.[0] || '',
    ssnLast4: member.ssn?.slice(-4) || '',
    monthlyIncome: member.monthlyIncome,
    employmentType: member.employmentType,
    unitSize: member.unitSize,
    credit: member.credit?.status === 'complete' ? {
      status: 'complete',
      score: member.credit.score,
      totalDebt: member.credit.totalDebt,
      monthlyObligations: member.credit.monthlyObligations,
      paymentHistoryPercentage: member.credit.paymentHistoryPercentage,
      delinquencyCount: member.credit.delinquencyCount,
      publicRecordsCount: member.credit.publicRecordsCount,
      openTradelinesCount: member.credit.openTradelinesCount,
      tradelines: member.credit.tradelines || [],
    } : {
      status: member.credit?.status || 'pending',
      ...(member.credit?.status === 'failed' && member.credit.error ? { error: member.credit.error } : {}),
    },
    criminal: member.criminal || { status: 'pending' },
    eviction: member.eviction || { status: 'pending' },
    identity: member.identity || { status: 'pending' },
    personalDTI: member.personalDTI,
    disposableIncome: member.disposableIncome,
    aiAssessment: member.aiAssessment,
    orgStatus: member.orgStatus,
    orgNotes: member.orgNotes || '',
    dateSubmitted: member.dateSubmitted,
  });
}

async function updateMemberOrgStatus(req, res) {
  const { orgStatus, orgNotes } = req.body;
  const valid = ['pending', 'approved', 'flagged', 'ineligible'];
  if (!valid.includes(orgStatus)) {
    return res.status(400).json({ error: true, message: 'Invalid org status' });
  }

  await repo.updateMemberStatus(req.params.projectId, req.params.memberId, orgStatus, orgNotes);
  res.json({ success: true });
}

async function retryMemberChecks(req, res) {
  try {
    const result = await retryCrsChecks(req.params.projectId, req.params.memberId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

module.exports = { createProject, getProject, getProjects, getMember, updateMemberOrgStatus, retryMemberChecks };
