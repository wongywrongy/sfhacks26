const projectService = require('../services/project-service');
const repo = require('../repositories/project-repository');
const { retryCrsChecks } = require('../services/intake-service');
const { CrsCheckStatus, DealStage } = require('../../../shared/enums');

async function createProject(req, res) {
  const { name, priceLow, priceHigh, estimatedMonthlyCost, city, state, expectedMemberCount, buildingId, unitId } = req.body;

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
    buildingId: buildingId || null,
    unitId: unitId || null,
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
  const totalIncome = (project.members || []).reduce((s, m) => s + (m.monthlyIncome || 0), 0);
  const members = (project.members || []).map((m) => ({
    _id: m._id,
    firstName: m.firstName,
    lastInitial: m.lastName ? m.lastName[0] : '',
    ssnLast4: m.ssn ? m.ssn.slice(-4) : '',
    monthlyIncome: m.monthlyIncome,
    employmentType: m.employmentType,
    incomeShare: totalIncome > 0 ? m.monthlyIncome / totalIncome : 0,
    creditStatus: m.credit?.status || CrsCheckStatus.PENDING,
    creditScore: m.credit?.score ?? null,
    paymentHistoryPct: m.credit?.paymentHistoryPercentage ?? null,
    delinquencyCount: m.credit?.delinquencyCount ?? 0,
    openTradelinesCount: m.credit?.openTradelinesCount ?? 0,
    monthlyObligations: m.credit?.monthlyObligations ?? 0,
    personalDTI: m.personalDTI,
    criminalStatus: m.criminal?.status || CrsCheckStatus.PENDING,
    criminalRecordCount: (m.criminal?.records || []).length,
    evictionStatus: m.eviction?.status || CrsCheckStatus.PENDING,
    evictionRecordCount: (m.eviction?.records || []).length,
    identityStatus: m.identity?.status || CrsCheckStatus.PENDING,
    cviScore: m.identity?.cviScore ?? null,
    orgStatus: m.orgStatus,
    paymentTrajectory: m.paymentTrajectory || null,
    tradelineComposition: m.tradelineComposition || null,
    aiSummary: m.aiAssessment?.summary || null,
    aiFull: m.aiAssessment?.full || m.aiAssessment?.text || null,
    dateSubmitted: m.dateSubmitted,
  }));

  res.json({
    _id: project._id,
    name: project.name,
    status: project.status,
    stage: project.stage || 'screening',
    priceRange: project.priceRange,
    estimatedMonthlyCost: project.estimatedMonthlyCost,
    location: project.location,
    expectedMemberCount: project.expectedMemberCount,
    intakeLinkToken: project.intakeLinkToken,
    members,
    groupMetrics: project.groupMetrics,
    groupAssessment: project.groupAssessment || null,
    contributionModels: project.contributionModels,
    dateCreated: project.dateCreated,
  });
}

async function getProjects(req, res) {
  const projects = await projectService.getProjectsForOrg(req.orgId);

  const summaries = projects.map((p) => {
    const members = p.members || [];
    const completedMembers = members.filter(
      (m) => m.credit?.status === CrsCheckStatus.COMPLETE
    ).length;

    const allChecksComplete = (m) =>
      m.credit?.status === CrsCheckStatus.COMPLETE &&
      m.criminal?.status === CrsCheckStatus.COMPLETE &&
      m.eviction?.status === CrsCheckStatus.COMPLETE &&
      m.identity?.status === CrsCheckStatus.COMPLETE;

    const hasFailedCheck = (m) =>
      m.credit?.status === CrsCheckStatus.FAILED ||
      m.criminal?.status === CrsCheckStatus.FAILED ||
      m.eviction?.status === CrsCheckStatus.FAILED ||
      m.identity?.status === CrsCheckStatus.FAILED;

    return {
      _id: p._id,
      name: p.name,
      status: p.status,
      membersCompleted: completedMembers,
      expectedMemberCount: p.expectedMemberCount,
      dateCreated: p.dateCreated,
      activity: {
        totalMembers: members.length,
        approved: members.filter((m) => m.orgStatus === 'approved').length,
        flagged: members.filter((m) => m.orgStatus === 'flagged').length,
        ineligible: members.filter((m) => m.orgStatus === 'ineligible').length,
        screeningDone: members.filter(allChecksComplete).length,
        failedChecks: members.filter(hasFailedCheck).length,
        recentMembers: [...members]
          .sort((a, b) => new Date(b.dateSubmitted) - new Date(a.dateSubmitted))
          .slice(0, 3)
          .map((m) => ({ name: m.firstName, date: m.dateSubmitted })),
      },
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
    paymentTrajectory: member.paymentTrajectory || null,
    tradelineComposition: member.tradelineComposition || null,
    criminalStructured: member.criminalStructured ? {
      records: (member.criminalStructured.records || []).map((r) => ({
        offense: r.offense,
        offenseType: r.offenseType,
        disposition: r.disposition,
        date: r.date,
        recencyCategory: r.recencyCategory,
        recencyLabel: r.recencyLabel,
        jurisdiction: r.jurisdiction ? (typeof r.jurisdiction === 'string' ? r.jurisdiction.split(',')[0] : r.jurisdiction) : null,
        severity: r.severity,
      })),
      summary: member.criminalStructured.summary,
    } : null,
    evictionStructured: member.evictionStructured ? {
      records: (member.evictionStructured.records || []).map((r) => ({
        filingDate: r.filingDate,
        recencyCategory: r.recencyCategory,
        recencyLabel: r.recencyLabel,
        jurisdiction: r.jurisdiction ? (typeof r.jurisdiction === 'string' ? r.jurisdiction.split(',')[0] : r.jurisdiction) : null,
        outcome: r.outcome,
        amount: r.amount,
        severity: r.severity,
      })),
      summary: member.evictionStructured.summary,
    } : null,
    identityStructured: member.identityStructured || null,
    aiSafetySummary: member.aiSafetySummary || null,
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

  // Fire-and-forget: reassess group when member status changes
  const { reassessGroup } = require('../services/analytics-service');
  reassessGroup(req.params.projectId).catch((err) =>
    console.error(`reassessGroup after status change failed:`, err.message)
  );
}

async function retryMemberChecks(req, res) {
  try {
    const result = await retryCrsChecks(req.params.projectId, req.params.memberId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

async function updateStage(req, res) {
  const { stage } = req.body;
  const validStages = Object.values(DealStage);
  if (!validStages.includes(stage)) {
    return res.status(400).json({ error: true, message: 'Invalid stage' });
  }

  await repo.updateProject(req.params.projectId, { stage });
  res.json({ success: true, stage });
}

async function getSafety(req, res) {
  const project = await projectService.getProjectDetail(req.params.projectId, req.orgId);
  if (!project) {
    return res.status(404).json({ error: true, message: 'Project not found' });
  }

  const members = (project.members || []).map((m) => ({
    _id: m._id,
    firstName: m.firstName,
    lastInitial: m.lastName ? m.lastName[0] : '',
    criminalStructured: m.criminalStructured ? {
      records: (m.criminalStructured.records || []).map((r) => ({
        offense: r.offense,
        offenseType: r.offenseType,
        disposition: r.disposition,
        date: r.date,
        recencyCategory: r.recencyCategory,
        recencyLabel: r.recencyLabel,
        jurisdiction: r.jurisdiction ? (typeof r.jurisdiction === 'string' ? r.jurisdiction.split(',')[0] : r.jurisdiction) : null,
        severity: r.severity,
      })),
      summary: m.criminalStructured.summary,
    } : null,
    evictionStructured: m.evictionStructured ? {
      records: (m.evictionStructured.records || []).map((r) => ({
        filingDate: r.filingDate,
        recencyCategory: r.recencyCategory,
        recencyLabel: r.recencyLabel,
        jurisdiction: r.jurisdiction ? (typeof r.jurisdiction === 'string' ? r.jurisdiction.split(',')[0] : r.jurisdiction) : null,
        outcome: r.outcome,
        amount: r.amount,
        severity: r.severity,
      })),
      summary: m.evictionStructured.summary,
    } : null,
    identityStructured: m.identityStructured || null,
    aiSafetySummary: m.aiSafetySummary || null,
  }));

  res.json({
    members,
    aiSafetyOverview: project.aiSafetyOverview || null,
    disclaimer: 'Background screening information is provided for informational purposes only. All housing decisions must comply with the Fair Housing Act and applicable state and local laws. Criminal history and eviction records alone cannot be the basis for denial. Each applicant must be evaluated individually based on a legitimate business necessity standard.',
  });
}

module.exports = { createProject, getProject, getProjects, getMember, updateMemberOrgStatus, retryMemberChecks, updateStage, getSafety };
