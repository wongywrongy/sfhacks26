const ProjectStatus = Object.freeze({
  INTAKE: 'intake',
  ASSESSMENT: 'assessment',
  MODELING: 'modeling',
  READY: 'ready',
});

const MemberOrgStatus = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  FLAGGED: 'flagged',
  INELIGIBLE: 'ineligible',
});

const EmploymentType = Object.freeze({
  SALARIED: 'salaried',
  FREELANCE: 'freelance',
  GOVERNMENT: 'government',
  GIG: 'gig',
  RETIRED: 'retired',
  OTHER: 'other',
});

const UnitSize = Object.freeze({
  STUDIO: 'studio',
  ONE_BR: '1br',
  TWO_BR: '2br',
  THREE_BR: '3br',
});

const CrsCheckStatus = Object.freeze({
  PENDING: 'pending',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

const ContributionModelType = Object.freeze({
  EQUAL: 'equal',
  PROPORTIONAL: 'proportional',
  UNIT_BASED: 'unit-based',
  HYBRID: 'hybrid',
  CUSTOM: 'custom',
});

const DealStage = Object.freeze({
  EMPTY: 'empty',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  APPROVED: 'approved',
});

const BuildingType = Object.freeze({
  HOUSE: 'house',
  APARTMENT: 'apartment',
  CONDO: 'condo',
});

module.exports = {
  ProjectStatus,
  MemberOrgStatus,
  EmploymentType,
  UnitSize,
  CrsCheckStatus,
  ContributionModelType,
  DealStage,
  BuildingType,
};
