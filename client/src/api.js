const API_KEY = 'commonground-dev-key';

const defaultHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) {
      const err = new Error(`Request failed (${res.status})`);
      err.status = res.status;
      err.data = {};
      throw err;
    }
    return {};
  }
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // Projects
  getProjects: () => request('/projects'),
  createProject: (data) =>
    request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id) => request(`/projects/${id}`),

  // Members
  getMember: (projectId, memberId) =>
    request(`/projects/${projectId}/members/${memberId}`),
  updateMemberStatus: (projectId, memberId, orgStatus, orgNotes) =>
    request(`/projects/${projectId}/members/${memberId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ orgStatus, orgNotes }),
    }),

  retryChecks: (projectId, memberId) =>
    request(`/projects/${projectId}/members/${memberId}/retry`, { method: 'POST' }),

  // Buildings
  getBuildingsOverview: () => request('/buildings/overview'),
  createBuilding: (data) =>
    request('/buildings', { method: 'POST', body: JSON.stringify(data) }),

  // Stage
  updateStage: (projectId, stage) =>
    request(`/projects/${projectId}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) }),

  // Safety
  getSafety: (projectId) => request(`/projects/${projectId}/safety`),

  // Analytics
  getAnalytics: (projectId) => request(`/projects/${projectId}/analytics`),

  // Contributions
  getContributions: (projectId, exclude = []) => {
    const q = exclude.length ? `?exclude=${exclude.join(',')}` : '';
    return request(`/projects/${projectId}/contributions${q}`);
  },
  updateCustomModel: (projectId, assignments) =>
    request(`/projects/${projectId}/contributions/custom`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    }),

  // Report
  createReport: (projectId, selectedModelName) =>
    request(`/projects/${projectId}/report`, {
      method: 'POST',
      body: JSON.stringify({ selectedModelName }),
    }),
  getReport: (projectId) => request(`/projects/${projectId}/report`),

  // Applicant Reports
  getApplicantReports: (projectId) =>
    request(`/projects/${projectId}/reports/applicants`),
  previewReport: (projectId, memberId) =>
    request(`/projects/${projectId}/reports/applicants/${memberId}/preview`),
  releaseReports: (projectId, memberIds) =>
    request(`/projects/${projectId}/reports/release`, {
      method: 'POST',
      body: JSON.stringify({ memberIds }),
    }),
  releaseAllReports: (projectId) =>
    request(`/projects/${projectId}/reports/release`, {
      method: 'POST',
      body: JSON.stringify({ all: true }),
    }),
  getPublicReport: (reportToken) =>
    fetch(`/api/reports/${reportToken}`).then((r) => {
      if (!r.ok) throw new Error('Not found');
      return r.json();
    }),
};
