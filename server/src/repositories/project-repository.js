const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { ProjectStatus, MemberOrgStatus, CrsCheckStatus } = require('../../../shared/enums');

const COLLECTION = 'projects';

function col() {
  return getDb().collection(COLLECTION);
}

// --- Project operations ---

async function createProject(projectData) {
  const doc = {
    orgId: projectData.orgId,
    name: projectData.name,
    priceRange: { low: projectData.priceLow, high: projectData.priceHigh },
    estimatedMonthlyCost: projectData.estimatedMonthlyCost,
    location: { city: projectData.city, state: projectData.state },
    expectedMemberCount: projectData.expectedMemberCount,
    intakeLinkToken: projectData.intakeLinkToken,
    buildingId: projectData.buildingId || null,
    unitId: projectData.unitId || null,
    stage: projectData.stage || 'screening',
    status: ProjectStatus.INTAKE,
    members: [],
    groupMetrics: null,
    readinessReport: null,
    dateCreated: new Date(),
    dateUpdated: new Date(),
  };

  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function getProjectById(projectId) {
  return col().findOne({ _id: new ObjectId(projectId) });
}

async function getProjectsByOrgId(orgId) {
  return col().find({ orgId }).toArray();
}

async function updateProject(projectId, updates) {
  const result = await col().findOneAndUpdate(
    { _id: new ObjectId(projectId) },
    { $set: { ...updates, dateUpdated: new Date() } },
    { returnDocument: 'after' }
  );
  return result;
}

// --- Member operations (nested within project.members) ---

async function createMember(projectId, memberData) {
  const member = {
    _id: new ObjectId(),
    firstName: memberData.firstName,
    lastName: memberData.lastName,
    email: memberData.email || null,
    dateOfBirth: memberData.dateOfBirth,
    ssn: memberData.ssn,
    street: memberData.street,
    city: memberData.city,
    state: memberData.state,
    zip: memberData.zip,
    monthlyIncome: memberData.monthlyIncome,
    employmentType: memberData.employmentType,
    credit: { status: CrsCheckStatus.PENDING },
    criminal: { status: CrsCheckStatus.PENDING },
    eviction: { status: CrsCheckStatus.PENDING },
    identity: { status: CrsCheckStatus.PENDING },
    personalDTI: null,
    disposableIncome: null,
    aiAssessment: null,
    orgStatus: MemberOrgStatus.PENDING,
    orgNotes: '',
    dateSubmitted: new Date(),
  };

  await col().updateOne(
    { _id: new ObjectId(projectId) },
    { $push: { members: member }, $set: { dateUpdated: new Date() } }
  );

  return member;
}

async function getMemberById(projectId, memberId) {
  const project = await col().findOne(
    { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
    { projection: { 'members.$': 1 } }
  );
  return project?.members?.[0] || null;
}

async function updateMemberCrsResults(projectId, memberId, checkType, results) {
  const setFields = {};
  for (const [key, value] of Object.entries(results)) {
    setFields[`members.$.${checkType}.${key}`] = value;
  }
  setFields.dateUpdated = new Date();

  await col().updateOne(
    { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
    { $set: setFields }
  );
}

async function updateMemberStatus(projectId, memberId, orgStatus, orgNotes) {
  const setFields = {
    'members.$.orgStatus': orgStatus,
    dateUpdated: new Date(),
  };
  if (orgNotes !== undefined) {
    setFields['members.$.orgNotes'] = orgNotes;
  }

  await col().updateOne(
    { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
    { $set: setFields }
  );
}

async function updateMemberField(projectId, memberId, field, value) {
  await col().updateOne(
    { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
    { $set: { [`members.$.${field}`]: value, dateUpdated: new Date() } }
  );
}

async function getProjectByReportToken(token) {
  return col().findOne({ 'applicantReports.reportToken': token });
}

async function updateApplicantReportStatus(projectId, token, fields) {
  const setFields = {};
  for (const [key, value] of Object.entries(fields)) {
    setFields[`applicantReports.$.${key}`] = value;
  }
  setFields.dateUpdated = new Date();

  await col().updateOne(
    { _id: new ObjectId(projectId), 'applicantReports.reportToken': token },
    { $set: setFields }
  );
}

module.exports = {
  createProject,
  getProjectById,
  getProjectsByOrgId,
  updateProject,
  createMember,
  getMemberById,
  updateMemberCrsResults,
  updateMemberStatus,
  updateMemberField,
  getProjectByReportToken,
  updateApplicantReportStatus,
};
