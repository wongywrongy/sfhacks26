/**
 * Seed script for CommonGround hackathon demo.
 * Creates 3 buildings with 4 deals and 8 applicants using real CRS sandbox data.
 *
 * Layout:
 *   House 1  — 2 good applicants (approved)
 *   House 2  — 2 bad applicants with records (negotiating)
 *   Apartment — 3 units: 2 occupied with good people (mixed income), 1 vacant
 *
 * ALL screening data comes from live CRS sandbox API calls.
 * Only self-reported data (income, employment, notes) is demo data.
 *
 * Run:  node src/seed.js
 * Env:  MONGODB_URI, CRS_USERNAME, CRS_PASSWORD (required), GEMINI_API_KEY (optional)
 */
require('dotenv').config();
const crypto = require('crypto');
const { connect, getDb, close } = require('./db');
const { ObjectId } = require('mongodb');
const crs = require('./wrappers/crs-wrapper');
const { computeGroupAnalytics } = require('./services/analytics-service');
const { computeContributions } = require('./services/contribution-service');
const { computePaymentTrajectory, computeTradelineComposition } = require('./services/credit-analysis-service');
const { structureCriminalRecords, structureEvictionRecords, structureIdentity } = require('./services/safety-service');
const gemini = require('./wrappers/gemini-wrapper');

const DAY = 86400000;
const GEMINI_DELAY_MS = 6000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_RETRIES = 4;
const CRS_DELAY_MS = 500;

const DEMO_TOKENS = ['demo-halpert', 'demo-schrute', 'demo-dunder-1a', 'demo-dunder-1b'];
const LEGACY_TOKENS = ['demo-noriega', 'demo-divisadero', 'demo-irving-1a', 'demo-irving-1b', 'demo-irving-st', 'demo-fruitvale', 'demo-clement-st', 'demo-student-coop', 'demo-oakland-hills', 'demo-eastbay-family', 'demo-sunset-ridge'];

// ═══════════════════════════════════════════════════════════════════════════════
// CRS Test Persona Reference
// ═══════════════════════════════════════════════════════════════════════════════
// Credit (5):  BROSE BAMBIKO (831), NATALIE BLACK (797), DIANE BARABAS (709),
//              EILEEN BRADY (578), EUGENE BEAUPRE (N/A)
// Criminal:    Ruth Brandis (clean), Harold Chuang (clean), Erron Consumer (clean),
//              Jennifer Ray (felony), William Bornstein (driving offenses)
// Eviction:    Jennifer Ray (clean), Kris/Indiana/Harold/William (all have records)
// FlexID:      MIRANDA JJUNIPER, PEGGY GRAVES, CRYSTAL GOODLEY, HASAN GIDI, JOHN COPE
//
// Personas are reused across members since we only have 5 per product.
// Each API call is a real live call to the CRS sandbox.

// ─── Reusable persona definitions ──────────────────────────────────────────
const CREDIT = {
  BAMBIKO:  { firstName: 'BROSE',   lastName: 'BAMBIKO',  ssn: '666328649', dateOfBirth: '',           street: '4711 247TH STREET CT E', city: 'GRAHAM',       state: 'WA', zip: '983388337' },
  BLACK:    { firstName: 'NATALIE', lastName: 'BLACK',    ssn: '666207378', dateOfBirth: '',           street: '46 E 41ST ST',           city: 'COVINGTON',    state: 'KY', zip: '410151711' },
  BARABAS:  { firstName: 'DIANE',   lastName: 'BARABAS',  ssn: '666283370', dateOfBirth: '',           street: '19955 N MADERA AVE',     city: 'KERMAN',       state: 'CA', zip: '93630' },
  BRADY:    { firstName: 'EILEEN',  lastName: 'BRADY',    ssn: '666883007', dateOfBirth: '1972-11-22', street: '31 LONDON CT',           city: 'PLEASANTVILLE',state: 'NJ', zip: '082344434' },
  BEAUPRE:  { firstName: 'EUGENE',  lastName: 'BEAUPRE',  ssn: '666582109', dateOfBirth: '1955-06-23', street: '5151 N CEDAR AVE',       city: 'FRESNO',       state: 'CA', zip: '937107453' },
};

const CRIMINAL = {
  BRANDIS:   { firstName: 'Ruth',    lastName: 'Brandis',   ssn: '123456789', dateOfBirth: '1985-04-01', street: '277 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32957' },
  CHUANG:    { firstName: 'Harold',  lastName: 'Chuang',    ssn: '123456789', dateOfBirth: '1965-02-28', street: '272 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32952' },
  CONSUMER:  { firstName: 'Erron',   lastName: 'Consumer',  ssn: '123456789', dateOfBirth: '1980-01-01', street: '279 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32959' },
  RAY:       { firstName: 'Jennifer',lastName: 'Ray',       ssn: '123456789', dateOfBirth: '1972-09-03', street: '275 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32955' },
  BORNSTEIN: { firstName: 'William', lastName: 'Bornstein', ssn: '123456789', dateOfBirth: '1990-06-20', street: '278 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32958' },
};

const EVICTION = {
  RAY_CLEAN:  { firstName: 'Jennifer',lastName: 'Ray',       ssn: '123456789', dateOfBirth: '1972-09-03', street: '275 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32955' },
  BORNSTEIN:  { firstName: 'William', lastName: 'Bornstein', ssn: '666443334', dateOfBirth: '1982-01-14', street: '272 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32952' },
  INDIANA:    { firstName: 'Indiana', lastName: 'Consumer',  ssn: '666443323', dateOfBirth: '1982-01-03', street: '272 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32952' },
  KRIS:       { firstName: 'Kris',    lastName: 'Consumer',  ssn: '666443322', dateOfBirth: '1982-01-02', street: '272 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32952' },
  CHUANG:     { firstName: 'Harold',  lastName: 'Chuang',    ssn: '666443331', dateOfBirth: '1982-01-11', street: '272 LANDINGS', city: 'MERRITT ISLAND', state: 'FL', zip: '32952' },
};

const FLEXID = {
  JJUNIPER: { firstName: 'MIRANDA', lastName: 'JJUNIPER', ssn: '540325127',  dateOfBirth: '1955-11-13', street: '1678 NE 41ST',              city: 'ATLANTA',  state: 'GA', zip: '30302' },
  GRAVES:   { firstName: 'PEGGY',   lastName: 'GRAVES',   ssn: '',            dateOfBirth: '1958-09-09', street: '248 HOOD RD',               city: 'CHESNEE',  state: 'SC', zip: '29323' },
  GOODLEY:  { firstName: 'CRYSTAL', lastName: 'GOODLEY',  ssn: '',            dateOfBirth: '1949-03-23', street: '338 POND RD #716',          city: 'WANCHESE', state: 'NC', zip: '27981' },
  GIDI:     { firstName: 'HASAN',   lastName: 'GIDI',     ssn: '',            dateOfBirth: '1963-10-02', street: '4357A MARTINS CREEK BELVIDER', city: 'BANGOR', state: 'PA', zip: '18013' },
  COPE:     { firstName: 'JOHN',    lastName: 'COPE',     ssn: '574709961',   dateOfBirth: '1973-08-01', street: '511 SYCAMORE AVE',          city: 'HAYWARD',  state: 'CA', zip: '94544' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Buildings
// ═══════════════════════════════════════════════════════════════════════════════

const BUILDINGS = [
  {
    name: 'The Halpert House', address: '1725 Linden St', city: 'Scranton', state: 'PA', zip: '18503', type: 'house',
    units: [{ name: null, bedrooms: 3, monthlyCost: 3400 }],
  },
  {
    name: 'Schrute Farms', address: '1 Schrute Rd', city: 'Honesdale', state: 'PA', zip: '18431', type: 'house',
    units: [{ name: null, bedrooms: 2, monthlyCost: 3200 }],
  },
  {
    name: 'Dunder Mifflin Plaza', address: '1725 Slough Ave', city: 'Scranton', state: 'PA', zip: '18503', type: 'apartment',
    units: [
      { name: '1A', bedrooms: 2, monthlyCost: 2400 },
      { name: '1B', bedrooms: 2, monthlyCost: 2400 },
      { name: '2A', bedrooms: 1, monthlyCost: 1800 },  // vacant
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Deals — each linked to a building + unit
// ═══════════════════════════════════════════════════════════════════════════════

const DEALS = [
  // ─── House 1: Good people ─────────────────────────────────
  {
    name: 'The Halpert House — 3BR',
    buildingIdx: 0, unitIdx: 0,
    estimatedMonthlyCost: 3400,
    location: { city: 'Scranton', state: 'PA' },
    expectedMemberCount: 2,
    intakeLinkToken: 'demo-halpert',
    stage: 'approved',
    members: [
      {
        firstName: 'Sam', lastName: 'Okafor', email: 'sam.okafor@demo.commonground.co',
        monthlyIncome: 6800, employmentType: 'salaried',
        orgStatus: 'approved',
        orgNotes: 'Software engineer. Strong income and excellent credit history.',
        dateSubmitted: new Date(Date.now() - 9 * DAY),
        creditPersona: CREDIT.BAMBIKO, criminalPersona: CRIMINAL.BRANDIS,
        evictionPersona: EVICTION.RAY_CLEAN, flexidPersona: FLEXID.JJUNIPER, demoCviScore: 42,
      },
      {
        firstName: 'Mei', lastName: 'Chen', email: 'mei.chen@demo.commonground.co',
        monthlyIncome: 4500, employmentType: 'salaried',
        orgStatus: 'approved',
        orgNotes: 'Marketing coordinator. Stable salary and solid credit.',
        dateSubmitted: new Date(Date.now() - 8 * DAY),
        creditPersona: CREDIT.BLACK, criminalPersona: CRIMINAL.CONSUMER,
        evictionPersona: EVICTION.RAY_CLEAN, flexidPersona: FLEXID.COPE, demoCviScore: 38,
      },
    ],
  },

  // ─── House 2: Bad people (negotiating) ────────────────────
  {
    name: 'Schrute Farms — 2BR',
    buildingIdx: 1, unitIdx: 0,
    estimatedMonthlyCost: 3200,
    location: { city: 'Honesdale', state: 'PA' },
    expectedMemberCount: 2,
    intakeLinkToken: 'demo-schrute',
    stage: 'negotiating',
    members: [
      {
        firstName: 'Alex', lastName: 'Torres', email: 'alex.torres@demo.commonground.co',
        monthlyIncome: 3600, employmentType: 'freelance',
        orgStatus: 'approved',
        orgNotes: 'Freelance photographer. Inconsistent income, background items flagged.',
        dateSubmitted: new Date(Date.now() - 6 * DAY),
        creditPersona: CREDIT.BRADY, criminalPersona: CRIMINAL.RAY,
        evictionPersona: EVICTION.INDIANA, flexidPersona: FLEXID.GRAVES, demoCviScore: 22,
      },
      {
        firstName: 'Gloria', lastName: 'Reyes', email: 'gloria.reyes@demo.commonground.co',
        monthlyIncome: 3400, employmentType: 'gig',
        orgStatus: 'approved',
        orgNotes: 'Rideshare driver. Variable gig income, background concerns noted.',
        dateSubmitted: new Date(Date.now() - 5 * DAY),
        creditPersona: CREDIT.BEAUPRE, criminalPersona: CRIMINAL.BORNSTEIN,
        evictionPersona: EVICTION.BORNSTEIN, flexidPersona: FLEXID.GIDI, demoCviScore: 12,
      },
    ],
  },

  // ─── Apartment Unit 1A: Good, moderate-high income ────────
  {
    name: 'Dunder Mifflin Plaza — Unit 1A',
    buildingIdx: 2, unitIdx: 0,
    estimatedMonthlyCost: 2400,
    location: { city: 'Scranton', state: 'PA' },
    expectedMemberCount: 2,
    intakeLinkToken: 'demo-dunder-1a',
    stage: 'review',
    members: [
      {
        firstName: 'David', lastName: 'Park', email: 'david.park@demo.commonground.co',
        monthlyIncome: 7200, employmentType: 'salaried',
        orgStatus: 'approved',
        orgNotes: 'Product manager at a tech company. Strong earner.',
        dateSubmitted: new Date(Date.now() - 7 * DAY),
        creditPersona: CREDIT.BAMBIKO, criminalPersona: CRIMINAL.CHUANG,
        evictionPersona: EVICTION.RAY_CLEAN, flexidPersona: FLEXID.GOODLEY, demoCviScore: 45,
      },
      {
        firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@demo.commonground.co',
        monthlyIncome: 5100, employmentType: 'government',
        orgStatus: 'approved',
        orgNotes: 'City planning department. Stable government income.',
        dateSubmitted: new Date(Date.now() - 6 * DAY),
        creditPersona: CREDIT.BARABAS, criminalPersona: CRIMINAL.BRANDIS,
        evictionPersona: EVICTION.RAY_CLEAN, flexidPersona: FLEXID.JJUNIPER, demoCviScore: 40,
      },
    ],
  },

  // ─── Apartment Unit 1B: Good, mixed with lower income ─────
  {
    name: 'Dunder Mifflin Plaza — Unit 1B',
    buildingIdx: 2, unitIdx: 1,
    estimatedMonthlyCost: 2400,
    location: { city: 'Scranton', state: 'PA' },
    expectedMemberCount: 2,
    intakeLinkToken: 'demo-dunder-1b',
    stage: 'screening',
    members: [
      {
        firstName: 'Keisha', lastName: 'Williams', email: 'keisha.williams@demo.commonground.co',
        monthlyIncome: 4200, employmentType: 'salaried',
        orgStatus: 'approved',
        orgNotes: 'Office administrator. Steady salaried income.',
        dateSubmitted: new Date(Date.now() - 4 * DAY),
        creditPersona: CREDIT.BLACK, criminalPersona: CRIMINAL.CONSUMER,
        evictionPersona: EVICTION.RAY_CLEAN, flexidPersona: FLEXID.COPE, demoCviScore: 36,
      },
      {
        firstName: 'Andre', lastName: 'Johnson', email: 'andre.johnson@demo.commonground.co',
        monthlyIncome: 2800, employmentType: 'gig',
        orgStatus: 'approved',
        orgNotes: 'Part-time barista + DoorDash. Lower income but low debt.',
        dateSubmitted: new Date(Date.now() - 3 * DAY),
        creditPersona: CREDIT.BARABAS, criminalPersona: CRIMINAL.CHUANG,
        evictionPersona: EVICTION.RAY_CLEAN, flexidPersona: FLEXID.GIDI, demoCviScore: 34,
      },
    ],
  },

  // Unit 2A is intentionally left vacant — no deal created
];

// ═══════════════════════════════════════════════════════════════════════════════
// Pull real CRS data for a member
// ═══════════════════════════════════════════════════════════════════════════════

async function pullMemberCrsData(memberDef) {
  const { firstName } = memberDef;
  process.stdout.write(`    ${firstName}: Calling CRS APIs...\n`);

  const [creditResult, criminalResult, evictionResult, identityResult] =
    await Promise.all([
      crs.pullCredit(memberDef.creditPersona),
      crs.checkCriminal(memberDef.criminalPersona),
      crs.checkEviction(memberDef.evictionPersona),
      crs.verifyIdentity(memberDef.flexidPersona),
    ]);

  const member = {
    _id: new ObjectId(),
    firstName: memberDef.firstName,
    lastName: memberDef.lastName,
    email: memberDef.email || null,
    dateOfBirth: memberDef.creditPersona.dateOfBirth || '1990-01-01',
    ssn: memberDef.creditPersona.ssn,
    street: memberDef.creditPersona.street,
    city: memberDef.creditPersona.city,
    state: memberDef.creditPersona.state,
    zip: memberDef.creditPersona.zip,
    monthlyIncome: memberDef.monthlyIncome,
    employmentType: memberDef.employmentType,
    orgStatus: memberDef.orgStatus,
    orgNotes: memberDef.orgNotes,
    dateSubmitted: memberDef.dateSubmitted,
    aiAssessment: null,
  };

  // --- Credit ---
  if (creditResult.success) {
    member.credit = creditResult.data;
    const obligations = creditResult.data.monthlyObligations || 0;
    member.personalDTI = memberDef.monthlyIncome > 0
      ? Math.round((obligations / memberDef.monthlyIncome) * 10000) / 10000
      : null;
    member.disposableIncome = memberDef.monthlyIncome - obligations;
    member.paymentTrajectory = computePaymentTrajectory(
      creditResult.data.tradelines, creditResult.data.delinquencyCount
    );
    member.tradelineComposition = computeTradelineComposition(creditResult.data.tradelines);
    process.stdout.write(`      Credit: score ${creditResult.data.score ?? 'N/A'}, ${(creditResult.data.tradelines || []).length} tradelines, DTI ${((member.personalDTI || 0) * 100).toFixed(1)}%\n`);
  } else {
    member.credit = { status: 'failed', error: creditResult.error };
    member.personalDTI = null;
    member.disposableIncome = memberDef.monthlyIncome;
    process.stdout.write(`      Credit: FAILED - ${creditResult.error}\n`);
  }

  // --- Criminal ---
  if (criminalResult.success) {
    member.criminal = criminalResult.data;
    member.criminalStructured = structureCriminalRecords(criminalResult.data.records || []);
    const count = (criminalResult.data.records || []).length;
    process.stdout.write(`      Criminal: ${count} record(s)${count > 0 ? ' !' : ''}\n`);
  } else {
    member.criminal = { status: 'failed', error: criminalResult.error };
    member.criminalStructured = structureCriminalRecords([]);
    process.stdout.write(`      Criminal: FAILED - ${criminalResult.error}\n`);
  }

  // --- Eviction ---
  if (evictionResult.success) {
    member.eviction = evictionResult.data;
    member.evictionStructured = structureEvictionRecords(evictionResult.data.records || []);
    const count = (evictionResult.data.records || []).length;
    process.stdout.write(`      Eviction: ${count} record(s)${count > 0 ? ' !' : ''}\n`);
  } else {
    member.eviction = { status: 'failed', error: evictionResult.error };
    member.evictionStructured = structureEvictionRecords([]);
    process.stdout.write(`      Eviction: FAILED - ${evictionResult.error}\n`);
  }

  // --- Identity ---
  // Sandbox FlexID personas always return low CVI scores (0-10) because they're
  // fictional people LexisNexis can't verify. Override with realistic demo values.
  if (identityResult.success) {
    const sandboxCvi = identityResult.data.cviScore;
    const demoCvi = memberDef.demoCviScore ?? (sandboxCvi != null ? 40 : null);
    const overridden = { ...identityResult.data, cviScore: demoCvi };
    if (demoCvi === null) overridden.verificationStatus = 'failed';
    else if (demoCvi > 30) overridden.verificationStatus = 'verified';
    else if (demoCvi >= 15) overridden.verificationStatus = 'uncertain';
    else overridden.verificationStatus = 'failed';
    member.identity = overridden;
    member.identityStructured = structureIdentity(overridden);
    process.stdout.write(`      Identity: CVI ${demoCvi} (${overridden.verificationStatus}) [sandbox raw: ${sandboxCvi}]\n`);
  } else {
    member.identity = { status: 'failed', error: identityResult.error };
    member.identityStructured = structureIdentity(null);
    process.stdout.write(`      Identity: FAILED - ${identityResult.error}\n`);
  }

  return member;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Gemini AI insight generation
// ═══════════════════════════════════════════════════════════════════════════════

async function callWithRetry(fn, label) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await fn();
    if (result.success) return result;

    const match429 = result.error?.match(/429/);
    const retryMatch = result.error?.match(/retry in (\d+(?:\.\d+)?)s/i);
    if (match429 && attempt < MAX_RETRIES) {
      const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 30 * (attempt + 1);
      process.stdout.write(`    ${label} rate-limited, waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})...\n`);
      await sleep(waitSec * 1000);
      continue;
    }
    return result;
  }
}

async function generateInsights(db, projectId, project) {
  if (!process.env.GEMINI_API_KEY) {
    console.log('  GEMINI_API_KEY not set - skipping AI insights');
    return;
  }

  const members = project.members;

  // 1. Individual financial assessments
  console.log(`  Generating ${members.length} applicant assessments...`);
  let memberOk = 0;
  for (const m of members) {
    if (!m.credit || m.credit.status === 'failed') {
      process.stdout.write(`    ${m.firstName} - skipped (no credit data)\n`);
      continue;
    }
    const result = await callWithRetry(() => gemini.assessMember({
      firstName: m.firstName,
      monthlyIncome: m.monthlyIncome,
      employmentType: m.employmentType,
      creditScore: m.credit.score,
      totalDebt: m.credit.totalDebt,
      monthlyObligations: m.credit.monthlyObligations,
      personalDTI: m.personalDTI,
      paymentHistoryPercentage: m.credit.paymentHistoryPercentage,
      delinquencyCount: m.credit.delinquencyCount,
      publicRecordsCount: m.credit.publicRecordsCount,
      openTradelinesCount: m.credit.openTradelinesCount,
    }), m.firstName);
    if (result.success) {
      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId), 'members._id': m._id },
        { $set: { 'members.$.aiAssessment': result.data } }
      );
      memberOk++;
      process.stdout.write(`    ${m.firstName} done\n`);
    } else {
      process.stdout.write(`    ${m.firstName} failed: ${result.error}\n`);
    }
    await sleep(GEMINI_DELAY_MS);
  }
  console.log(`  ${memberOk}/${members.length} assessments stored`);

  // 1b. Individual safety assessments for members with records
  const membersWithRecords = members.filter((m) =>
    (m.criminalStructured?.summary?.totalRecords > 0) || (m.evictionStructured?.summary?.totalFilings > 0)
  );
  if (membersWithRecords.length > 0) {
    console.log(`  Generating ${membersWithRecords.length} safety assessment(s)...`);
    for (const m of membersWithRecords) {
      const safetyResult = await callWithRetry(() => gemini.assessSafety({
        firstName: m.firstName,
        criminalSummary: m.criminalStructured?.summary || null,
        evictionSummary: m.evictionStructured?.summary || null,
        identityStatus: m.identityStructured?.verificationStatus || null,
      }), `${m.firstName} safety`);
      if (safetyResult.success) {
        await db.collection('projects').updateOne(
          { _id: new ObjectId(projectId), 'members._id': m._id },
          { $set: { 'members.$.aiSafetySummary': safetyResult.data } }
        );
        process.stdout.write(`    ${m.firstName} safety done\n`);
      } else {
        process.stdout.write(`    ${m.firstName} safety failed: ${safetyResult.error}\n`);
      }
      await sleep(GEMINI_DELAY_MS);
    }
  }

  // 2. Group assessment
  const updatedProject = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  const metrics = updatedProject.groupMetrics;
  if (!metrics) {
    console.log('  No group metrics - skipping group and model insights');
    return;
  }

  console.log('  Generating group assessment...');
  const groupProfile = {
    ...metrics,
    estimatedMonthlyCost: project.estimatedMonthlyCost,
    members: members.map((m) => ({
      firstName: m.firstName,
      monthlyIncome: m.monthlyIncome,
      employmentType: m.employmentType,
      creditScore: m.credit?.score ?? null,
      monthlyObligations: m.credit?.monthlyObligations ?? 0,
      personalDTI: m.personalDTI,
    })),
  };
  const groupResult = await callWithRetry(() => gemini.assessGroup(groupProfile), 'Group assessment');
  if (groupResult.success) {
    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: { groupAssessment: groupResult.data } }
    );
    console.log('  Group assessment stored');
  } else {
    console.log(`  Group assessment failed: ${groupResult.error}`);
  }
  await sleep(GEMINI_DELAY_MS);

  // 2b. Group safety overview
  if (membersWithRecords.length > 0) {
    console.log('  Generating group safety overview...');
    const memberSafetySummaries = membersWithRecords.map((m) => ({
      firstName: m.firstName,
      criminalSummary: m.criminalStructured?.summary || null,
      evictionSummary: m.evictionStructured?.summary || null,
      identityStatus: m.identityStructured?.verificationStatus || null,
    }));
    const safetyOverviewResult = await callWithRetry(
      () => gemini.assessGroupSafety(memberSafetySummaries),
      'Group safety overview'
    );
    if (safetyOverviewResult.success) {
      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        { $set: { aiSafetyOverview: safetyOverviewResult.data } }
      );
      console.log('  Group safety overview stored');
    } else {
      console.log(`  Group safety overview failed: ${safetyOverviewResult.error}`);
    }
    await sleep(GEMINI_DELAY_MS);
  }

  // 3. Split model analysis
  console.log('  Generating split analysis...');
  const contributions = await computeContributions(projectId);
  if (!contributions.error) {
    const modelProfile = {
      estimatedMonthlyCost: project.estimatedMonthlyCost,
      memberCount: members.length,
      combinedIncome: metrics.combinedIncome,
      groupDTI: metrics.groupDTI,
    };
    const modelResult = await callWithRetry(() => gemini.analyzeModels(contributions, modelProfile), 'Split analysis');
    if (modelResult.success) {
      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        { $set: { modelAnalysis: modelResult.data } }
      );
      console.log('  Split analysis stored');
    } else {
      console.log(`  Split analysis failed: ${modelResult.error}`);
    }
  }
  await sleep(GEMINI_DELAY_MS);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Applicant Financial Literacy Reports
// ═══════════════════════════════════════════════════════════════════════════════

// Status by deal: Halpert = released, Schrute = generated, Dunder = released
const REPORT_STATUS_BY_TOKEN = {
  'demo-halpert': 'released',
  'demo-schrute': 'generated',
  'demo-dunder-1a': 'released',
  'demo-dunder-1b': 'released',
};

async function generateApplicantReports(db, projectId, project, contributions, intakeToken) {
  if (!process.env.GEMINI_API_KEY) {
    console.log('  GEMINI_API_KEY not set - skipping applicant reports');
    return;
  }

  const members = project.members.filter((m) => m.credit && m.credit.status !== 'failed');
  if (members.length === 0) {
    console.log('  No eligible members for applicant reports');
    return;
  }

  const model = contributions?.proportional || null;
  const targetStatus = REPORT_STATUS_BY_TOKEN[intakeToken] || 'generated';

  console.log(`  Generating ${members.length} applicant financial reports (status: ${targetStatus})...`);

  const applicantReports = [];

  for (const m of members) {
    const splitMember = model?.members?.find((sm) => sm.memberId === m._id.toString());
    const paymentAmount = splitMember?.paymentAmount || 0;
    const breathingRoom = splitMember?.breathingRoom || 0;
    const obligations = m.credit?.monthlyObligations || 0;
    const income = m.monthlyIncome || 0;
    const projectedDTI = income > 0
      ? Math.round(((obligations + paymentAmount) / income) * 10000) / 10000
      : null;

    const result = await callWithRetry(() => gemini.generateApplicantReport({
      firstName: m.firstName,
      creditScore: m.credit?.score ?? null,
      monthlyIncome: m.monthlyIncome,
      employmentType: m.employmentType,
      monthlyObligations: obligations,
      personalDTI: m.personalDTI,
      paymentTrajectory: m.paymentTrajectory || null,
      tradelineComposition: m.tradelineComposition || null,
      paymentAmount,
      projectedDTI,
      breathingRoom,
      criminalRecordCount: m.criminalStructured?.summary?.totalRecords ?? (m.criminal?.records?.length ?? 0),
      evictionRecordCount: m.evictionStructured?.summary?.totalFilings ?? (m.eviction?.records?.length ?? 0),
      identityVerified: m.identity?.verificationStatus === 'verified' || m.identityStructured?.verificationStatus === 'verified',
    }), `${m.firstName} applicant report`);

    const now = new Date();
    applicantReports.push({
      memberId: m._id.toString(),
      memberName: m.firstName,
      employmentType: m.employmentType,
      status: result.success ? targetStatus : 'failed',
      reportData: result.success ? result.data : null,
      reportToken: crypto.randomUUID(),
      paymentAmount,
      projectedDTI,
      breathingRoom,
      creditScore: m.credit?.score ?? null,
      monthlyIncome: m.monthlyIncome,
      monthlyObligations: obligations,
      personalDTI: m.personalDTI,
      paymentTrajectory: m.paymentTrajectory || null,
      tradelineComposition: m.tradelineComposition || null,
      criminalRecordCount: m.criminalStructured?.summary?.totalRecords ?? (m.criminal?.records?.length ?? 0),
      evictionRecordCount: m.evictionStructured?.summary?.totalFilings ?? (m.eviction?.records?.length ?? 0),
      identityVerified: m.identity?.verificationStatus === 'verified' || m.identityStructured?.verificationStatus === 'verified',
      generatedAt: now,
      releasedAt: targetStatus === 'released' ? now : null,
      viewedAt: null,
    });

    if (result.success) {
      process.stdout.write(`    ${m.firstName} applicant report done\n`);
    } else {
      process.stdout.write(`    ${m.firstName} applicant report failed: ${result.error}\n`);
    }
    await sleep(GEMINI_DELAY_MS);
  }

  await db.collection('projects').updateOne(
    { _id: new ObjectId(projectId) },
    { $set: { applicantReports } }
  );
  console.log(`  ${applicantReports.filter((r) => r.status !== 'failed').length}/${members.length} applicant reports stored`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main seed function
// ═══════════════════════════════════════════════════════════════════════════════

async function seed() {
  if (!process.env.CRS_USERNAME || !process.env.CRS_PASSWORD) {
    console.error('ERROR: CRS_USERNAME and CRS_PASSWORD environment variables are required.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await connect();
  const db = getDb();

  // Clean up
  const deleted = await db.collection('projects').deleteMany({
    intakeLinkToken: { $in: [...DEMO_TOKENS, ...LEGACY_TOKENS] },
  });
  if (deleted.deletedCount > 0) console.log(`Removed ${deleted.deletedCount} existing demo group(s).`);

  const deletedBuildings = await db.collection('buildings').deleteMany({ orgId: 'org-001' });
  if (deletedBuildings.deletedCount > 0) console.log(`Removed ${deletedBuildings.deletedCount} existing demo building(s).`);

  // Authenticate CRS
  console.log('\nAuthenticating with CRS sandbox...');
  try {
    await crs.authenticate();
    console.log('  CRS authentication successful');
  } catch (err) {
    console.error(`  CRS authentication failed: ${err.message}`);
    await close();
    process.exit(1);
  }

  // ── Create all buildings ─────────────────────────────────────
  console.log('\n--- Creating buildings ---');
  const buildingIds = [];
  const unitIdsByBuilding = [];

  for (const bDef of BUILDINGS) {
    const unitIds = bDef.units.map(() => new ObjectId());
    const result = await db.collection('buildings').insertOne({
      orgId: 'org-001',
      name: bDef.name || null,
      address: bDef.address,
      city: bDef.city,
      state: bDef.state,
      zip: bDef.zip || null,
      type: bDef.type,
      units: bDef.units.map((u, i) => ({
        _id: unitIds[i],
        name: u.name,
        bedrooms: u.bedrooms,
        monthlyCost: u.monthlyCost,
      })),
      dateCreated: new Date(Date.now() - 14 * DAY),
      dateUpdated: new Date(),
    });
    buildingIds.push(result.insertedId);
    unitIdsByBuilding.push(unitIds);
    const unitSummary = bDef.units.map((u) => u.name || 'main').join(', ');
    const label = bDef.name ? `${bDef.name} (${bDef.address})` : bDef.address;
    console.log(`  ${label} (${bDef.type}) — units: ${unitSummary}`);
  }

  // ── Create deals ─────────────────────────────────────────────
  for (const dealDef of DEALS) {
    const buildingId = buildingIds[dealDef.buildingIdx];
    const unitId = unitIdsByBuilding[dealDef.buildingIdx][dealDef.unitIdx];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`${dealDef.name} [${dealDef.stage}]`);
    console.log(`${'='.repeat(60)}`);

    // Pull CRS data for each member
    console.log(`  Pulling CRS data for ${dealDef.members.length} members...`);
    const members = [];
    for (const memberDef of dealDef.members) {
      const member = await pullMemberCrsData(memberDef);
      members.push(member);
      await sleep(CRS_DELAY_MS);
    }

    // Insert project
    const project = {
      orgId: 'org-001',
      name: dealDef.name,
      priceRange: null,
      estimatedMonthlyCost: dealDef.estimatedMonthlyCost,
      location: dealDef.location,
      expectedMemberCount: dealDef.expectedMemberCount,
      intakeLinkToken: dealDef.intakeLinkToken,
      status: 'assessment',
      stage: dealDef.stage,
      buildingId: buildingId.toString(),
      unitId: unitId.toString(),
      members,
      groupMetrics: null,
      customContributionModel: null,
      readinessReport: null,
      groupAssessment: null,
      modelAnalysis: null,
      dateCreated: new Date(Date.now() - 10 * DAY),
      dateUpdated: new Date(),
    };

    const result = await db.collection('projects').insertOne(project);
    const projectId = result.insertedId.toString();
    console.log(`  Inserted (ID: ${projectId})`);

    // Group financials
    console.log('  Computing group financials...');
    const analytics = await computeGroupAnalytics(projectId);
    if (analytics.error) {
      console.log(`  Financials: ${analytics.message}`);
    } else {
      const dtiPct = (analytics.groupDTI * 100).toFixed(1);
      const critical = analytics.resilienceMatrix.filter((r) => r.isCriticalDependency).length;
      console.log(`  Group DTI: ${dtiPct}% (${analytics.dtiClassification}), ${critical} critical dependencies`);
    }

    // Split models
    console.log('  Computing split models...');
    const contributions = await computeContributions(projectId);
    if (contributions.error) {
      console.log(`  Split error: ${contributions.message}`);
    } else {
      const flags = Object.values(contributions).reduce((c, model) => {
        if (!model?.members) return c;
        return c + model.members.filter((m) => m.exceedsAffordability).length;
      }, 0);
      console.log(`  3 models computed, ${flags} affordability flags`);
    }

    // AI insights
    await generateInsights(db, projectId, project);

    // Applicant financial literacy reports
    await generateApplicantReports(db, projectId, project, contributions, dealDef.intakeLinkToken);

    // Summary
    console.log('  Members:');
    for (const m of members) {
      const score = m.credit?.score ?? 'N/A';
      const dti = m.personalDTI ? `${(m.personalDTI * 100).toFixed(1)}%` : 'N/A';
      const crim = (m.criminal?.records || []).length;
      const evic = (m.eviction?.records || []).length;
      const trend = m.paymentTrajectory?.trend || '-';
      const flags = (crim > 0 || evic > 0) ? ` | crim:${crim} evic:${evic}` : '';
      console.log(
        `    ${m.firstName.padEnd(8)} | ${m.employmentType.padEnd(10)} | score ${String(score).padStart(3)} | $${m.monthlyIncome.toLocaleString().padStart(6)} | DTI ${dti.padStart(6)} | ${trend}${flags}`
      );
    }
  }

  console.log(`\n--- Apartment Unit 2A left vacant (no deal) ---`);

  await close();
  console.log('\nSeed complete.');
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await close();
  process.exit(1);
});
