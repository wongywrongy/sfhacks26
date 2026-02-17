// Static demo mock API — zero backend, zero API calls
// Mirrors exact same exported interface as the real api.js

import { getInitialProjects } from './data/projects.js';
import { getInitialBuildings } from './data/buildings.js';
import { getMemberDetail, getMemberSafetyData } from './data/members.js';
import { PORTFOLIO_INSIGHTS, ANALYTICS_INSIGHTS, CONTRIBUTION_INSIGHTS, SAFETY_DISCLAIMER } from './data/insights.js';
import { computeGroupAnalytics, computeContributions, getEligibleMembers, buildCustomModel } from './services/calculations.js';

// ── In-memory state ──

let _projects = getInitialProjects();
let _buildings = getInitialBuildings();
let _reports = {}; // projectId → { status, narrative, generatedAt, selectedModelName }
let _applicantReports = {}; // projectId → [ { memberId, memberName, ... } ]

function delay(ms = 80) {
  return new Promise((r) => setTimeout(r, ms));
}

function findProject(id) {
  return _projects.find((p) => p._id === id) || null;
}

function makeDealSummary(project) {
  const members = project.members || [];
  const approved = members.filter((m) => m.orgStatus === 'approved' && m.creditStatus === 'complete');
  const avgCredit = approved.length > 0
    ? Math.round(approved.reduce((s, m) => s + (m.creditScore || 0), 0) / approved.length)
    : null;
  const totalIncome = approved.reduce((s, m) => s + (m.monthlyIncome || 0), 0);
  const totalObligations = approved.reduce((s, m) => s + (m.monthlyObligations || 0), 0);
  const groupDTI = totalIncome > 0
    ? Math.round(((totalObligations + project.estimatedMonthlyCost) / totalIncome) * 10000) / 10000
    : null;
  const failedChecks = members.filter((m) =>
    m.creditStatus === 'failed' || m.criminalStatus === 'failed' || m.evictionStatus === 'failed' || m.identityStatus === 'failed'
  ).length;
  const flagged = members.filter((m) => m.orgStatus === 'flagged').length;
  const screeningDone = members.filter((m) =>
    m.creditStatus === 'complete' && m.criminalStatus === 'complete' && m.evictionStatus === 'complete' && m.identityStatus === 'complete'
  ).length;
  const riskFlags = [];
  if (flagged > 0) riskFlags.push(`${flagged} flagged`);
  if (failedChecks > 0) riskFlags.push(`${failedChecks} failed checks`);

  return {
    projectId: project._id,
    name: project.name,
    totalMembers: members.length,
    expectedMemberCount: members.length,
    screeningDone,
    stage: project.stage || 'empty',
    groupDTI,
    avgCredit,
    riskFlags,
    lastActivity: project.lastActivity,
    failedChecks,
    flagged,
  };
}

// ── API Implementation ──

export const api = {
  // Projects
  getProjects: async () => {
    await delay();
    return _projects.map((p) => ({
      _id: p._id,
      name: p.name,
      location: p.location,
      stage: p.stage,
      estimatedMonthlyCost: p.estimatedMonthlyCost,
      memberCount: (p.members || []).length,
    }));
  },

  createProject: async (data) => {
    await delay(200);
    const id = 'p' + (_projects.length + 1);
    const newProject = {
      _id: id,
      name: data.name || 'New Deal',
      location: { city: data.city || '', state: data.state || '' },
      priceRange: { low: data.priceLow || 0, high: data.priceHigh || 0 },
      estimatedMonthlyCost: data.estimatedMonthlyCost || 0,
      stage: 'empty',
      intakeLinkToken: `demo-intake-${id}`,
      members: [],
      groupAssessment: null,
      groupMetrics: null,
      groupTradelineComposition: null,
      aiSafetyOverview: null,
      modelAnalysis: null,
      customContributionModel: null,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    _projects.push(newProject);

    // If linked to a building unit, update that
    if (data.buildingId && data.unitId) {
      for (const b of _buildings) {
        if (b._id === data.buildingId) {
          for (const u of b.units) {
            if (u._id === data.unitId) {
              u.linkedProjectId = id;
              if (data.estimatedMonthlyCost) u.monthlyCost = data.estimatedMonthlyCost;
            }
          }
        }
      }
    }

    return newProject;
  },

  getProject: async (id) => {
    await delay();
    const p = findProject(id);
    if (!p) {
      const err = new Error('Project not found');
      err.status = 404;
      err.data = {};
      throw err;
    }
    return JSON.parse(JSON.stringify(p));
  },

  // Members
  getMember: async (projectId, memberId) => {
    await delay();
    const detail = getMemberDetail(memberId);
    if (!detail) {
      const err = new Error('Member not found');
      err.status = 404;
      err.data = {};
      throw err;
    }
    // Apply any in-memory status changes
    const project = findProject(projectId);
    if (project) {
      const summary = project.members.find((m) => m._id === memberId);
      if (summary) {
        detail.orgStatus = summary.orgStatus;
        detail.orgNotes = summary.orgNotes || '';
      }
    }
    return detail;
  },

  updateMemberStatus: async (projectId, memberId, orgStatus, orgNotes) => {
    await delay(150);
    const project = findProject(projectId);
    if (project) {
      const member = project.members.find((m) => m._id === memberId);
      if (member) {
        member.orgStatus = orgStatus;
        member.orgNotes = orgNotes || '';
      }
    }
    return { success: true };
  },

  retryChecks: async () => {
    await delay(300);
    return { success: true, message: 'Checks are already complete in demo mode' };
  },

  // Buildings
  getBuildingsOverview: async () => {
    await delay();
    const buildings = _buildings.map((b) => ({
      ...b,
      units: b.units.map((u) => {
        const linkedProject = u.linkedProjectId ? findProject(u.linkedProjectId) : null;
        return {
          _id: u._id,
          name: u.name,
          bedrooms: u.bedrooms,
          monthlyCost: u.monthlyCost,
          deal: linkedProject ? makeDealSummary(linkedProject) : null,
        };
      }),
    }));

    // Find projects not linked to any building unit
    const linkedProjectIds = new Set();
    for (const b of _buildings) {
      for (const u of b.units) {
        if (u.linkedProjectId) linkedProjectIds.add(u.linkedProjectId);
      }
    }
    const unlinkedDeals = _projects
      .filter((p) => !linkedProjectIds.has(p._id))
      .map((p) => ({
        _id: p._id,
        projectId: p._id,
        name: p.name,
        ...makeDealSummary(p),
      }));

    return {
      buildings,
      unlinkedDeals,
      insights: PORTFOLIO_INSIGHTS,
    };
  },

  createBuilding: async (data) => {
    await delay(200);
    const id = 'b' + (_buildings.length + 1);
    const newBuilding = {
      _id: id,
      name: data.name || '',
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      type: data.type || 'apartment',
      units: (data.units || []).map((u, i) => ({
        _id: `${id}_u${i + 1}`,
        name: u.name || String(i + 1),
        bedrooms: u.bedrooms || '1br',
        monthlyCost: u.monthlyCost || 0,
        linkedProjectId: null,
      })),
    };
    _buildings.push(newBuilding);
    return newBuilding;
  },

  // Stage
  updateStage: async (projectId, stage) => {
    await delay(100);
    const project = findProject(projectId);
    if (project) {
      project.stage = stage;
      project.lastActivity = new Date().toISOString();
    }
    return { success: true };
  },

  // Safety
  getSafety: async (projectId) => {
    await delay();
    const project = findProject(projectId);
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      err.data = {};
      throw err;
    }
    const memberIds = project.members.map((m) => m._id);
    const members = getMemberSafetyData(memberIds);
    return {
      disclaimer: SAFETY_DISCLAIMER,
      members,
      aiSafetyOverview: project.aiSafetyOverview || null,
    };
  },

  // Analytics
  getAnalytics: async (projectId) => {
    await delay();
    const project = findProject(projectId);
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      err.data = { message: 'Project not found' };
      throw err;
    }
    const analytics = computeGroupAnalytics(project);
    if (analytics.error) {
      const err = new Error(analytics.message);
      err.status = 400;
      err.data = { message: analytics.message };
      throw err;
    }

    // Attach AI insights and group composition from stored data
    const insights = ANALYTICS_INSIGHTS[projectId];
    analytics.aiAssessment = insights || null;
    analytics.groupTradelineComposition = project.groupTradelineComposition || null;

    return analytics;
  },

  // Contributions
  getContributions: async (projectId, exclude = []) => {
    await delay();
    const project = findProject(projectId);
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      err.data = { message: 'Project not found' };
      throw err;
    }
    const models = computeContributions(project, exclude);
    if (models.error) {
      const err = new Error(models.message);
      err.status = 400;
      err.data = { message: models.message };
      throw err;
    }

    // Attach AI analysis
    const insights = CONTRIBUTION_INSIGHTS[projectId];
    if (insights && exclude.length === 0) {
      models.aiAnalysis = insights;
    }

    return models;
  },

  updateCustomModel: async (projectId, assignments) => {
    await delay(150);
    const project = findProject(projectId);
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      err.data = {};
      throw err;
    }
    const members = getEligibleMembers(project);
    const model = buildCustomModel(members, assignments, project.estimatedMonthlyCost);
    project.customContributionModel = { assignments, ...model, updatedAt: new Date().toISOString() };
    return model;
  },

  // Report
  createReport: async (projectId, selectedModelName) => {
    await delay(300);
    const project = findProject(projectId);
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      err.data = {};
      throw err;
    }

    const report = {
      status: 'complete',
      narrative: `Group financial summary for ${project.name}. Combined monthly income: $${project.members.reduce((s, m) => s + m.monthlyIncome, 0).toLocaleString()}. Housing cost: $${project.estimatedMonthlyCost.toLocaleString()}/mo.${selectedModelName ? ` Recommended split model: ${selectedModelName}.` : ''}`,
      generatedAt: new Date().toISOString(),
      selectedModelName: selectedModelName || null,
    };
    _reports[projectId] = report;

    // Generate applicant reports
    const appReports = project.members.map((m) => ({
      memberId: m._id,
      memberName: `${m.firstName} ${m.lastInitial}.`,
      jobTitle: m.jobTitle,
      employmentType: m.employmentType,
      status: 'generated',
      reportToken: `demo-report-${projectId}-${m._id}`,
    }));
    _applicantReports[projectId] = appReports;

    return { ...report, applicantReports: appReports };
  },

  getReport: async (projectId) => {
    await delay();
    const report = _reports[projectId];
    if (!report) return null;
    return { ...report };
  },

  // Applicant Reports
  getApplicantReports: async (projectId) => {
    await delay();
    return { applicantReports: _applicantReports[projectId] || [] };
  },

  previewReport: async (projectId, memberId) => {
    await delay();
    const project = findProject(projectId);
    const detail = getMemberDetail(memberId);
    if (!project || !detail) {
      const err = new Error('Not found');
      err.status = 404;
      err.data = {};
      throw err;
    }
    return {
      memberName: `${detail.firstName} ${detail.lastInitial}.`,
      creditScore: detail.credit.score,
      monthlyIncome: detail.monthlyIncome,
      employmentType: detail.employmentType,
      personalDTI: detail.personalDTI,
      aiSummary: detail.aiAssessment?.full || 'Assessment not available.',
    };
  },

  releaseReports: async (projectId, memberIds) => {
    await delay(200);
    const reports = _applicantReports[projectId] || [];
    const idSet = new Set(memberIds);
    for (const r of reports) {
      if (idSet.has(r.memberId)) {
        r.status = 'released';
      }
    }
    return { applicantReports: [...reports] };
  },

  releaseAllReports: async (projectId) => {
    await delay(200);
    const reports = _applicantReports[projectId] || [];
    for (const r of reports) {
      r.status = 'released';
    }
    return { applicantReports: [...reports] };
  },

  getPublicReport: async (reportToken) => {
    await delay();
    // Parse token to find member
    const parts = reportToken.split('-');
    const memberId = parts[parts.length - 1];
    const detail = getMemberDetail(memberId);
    if (!detail) throw new Error('Not found');
    return {
      memberName: `${detail.firstName} ${detail.lastInitial}.`,
      creditScore: detail.credit.score,
      monthlyIncome: detail.monthlyIncome,
      employmentType: detail.employmentType,
      personalDTI: detail.personalDTI,
      aiSummary: detail.aiAssessment?.full || 'Assessment not available.',
      generatedAt: new Date().toISOString(),
    };
  },
};
