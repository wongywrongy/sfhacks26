const crypto = require('crypto');
const repo = require('../repositories/project-repository');

async function createProject(orgId, data) {
  const intakeLinkToken = crypto.randomBytes(16).toString('hex');

  return repo.createProject({
    orgId,
    name: data.name,
    priceLow: data.priceLow,
    priceHigh: data.priceHigh,
    estimatedMonthlyCost: data.estimatedMonthlyCost,
    city: data.city,
    state: data.state,
    expectedMemberCount: data.expectedMemberCount,
    intakeLinkToken,
  });
}

async function getProjectDetail(projectId, orgId) {
  const project = await repo.getProjectById(projectId);
  if (!project) return null;
  if (project.orgId !== orgId) return null;
  return project;
}

async function getProjectsForOrg(orgId) {
  return repo.getProjectsByOrgId(orgId);
}

module.exports = { createProject, getProjectDetail, getProjectsForOrg };
