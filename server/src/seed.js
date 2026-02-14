/**
 * Seed script for CommonGround hackathon demo.
 * Creates 3 groups with 12 total applicants representing varied Bay Area rental scenarios.
 * Computes group analytics and split models, then generates Gemini AI insights.
 *
 * Run:  node src/seed.js
 * Env:  MONGODB_URI (required), GEMINI_API_KEY (optional — skips AI if missing)
 */
require('dotenv').config();
const { connect, getDb, close } = require('./db');
const { ObjectId } = require('mongodb');
const { computeGroupAnalytics } = require('./services/analytics-service');
const { computeContributions } = require('./services/contribution-service');
const gemini = require('./wrappers/gemini-wrapper');

const DAY = 86400000;
const GEMINI_DELAY_MS = 6000; // delay between Gemini calls to stay under free-tier rate limits
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_RETRIES = 4;
const DEMO_TOKENS = ['demo-irving-st', 'demo-fruitvale', 'demo-clement-st'];
const LEGACY_TOKENS = ['demo-student-coop', 'demo-oakland-hills', 'demo-eastbay-family', 'demo-sunset-ridge'];

// ═══════════════════════════════════════════════════════════════════════════════
// Group 1 — 412 Irving St — 4BR Apartment
// ═══════════════════════════════════════════════════════════════════════════════
// 4 friends applying to rent a 4BR in the Sunset District, SF.
// Monthly cost: $4,800.
//
// Key stories:
//   - Sam is the financial anchor — remove him and the group can't afford it.
//   - Mei has weakest profile but adds income diversity (gig).
//   - Even split ($1,200 each) is 37.5% of Mei's income but only 17.6% of Sam's.
//   - Income-based split is much fairer.
// ═══════════════════════════════════════════════════════════════════════════════

function buildIrvingStreet() {
  const members = [
    {
      _id: new ObjectId(),
      firstName: 'Mei',
      lastName: 'Chen',
      dateOfBirth: '2000-04-15',
      ssn: '666-28-3370',
      street: '1842 Irving St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94122',
      monthlyIncome: 3200,
      employmentType: 'gig',
      credit: {
        status: 'complete',
        score: 640,
        totalDebt: 4200,
        monthlyObligations: 280,
        paymentHistoryPercentage: 89,
        delinquencyCount: 1,
        publicRecordsCount: 0,
        openTradelinesCount: 3,
        tradelines: [
          { creditor: 'Discover', type: 'Credit Card', balance: 1800, monthlyPayment: 80 },
          { creditor: 'Affirm', type: 'Installment Loan', balance: 1200, monthlyPayment: 100 },
          { creditor: 'Apple Card', type: 'Credit Card', balance: 1200, monthlyPayment: 100 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 72, verificationStatus: 'verified' },
      personalDTI: 0.0875,
      disposableIncome: 2920,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'DoorDash + freelance design. Thin credit file but no red flags.',
      dateSubmitted: new Date(Date.now() - 8 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Alex',
      lastName: 'Torres',
      dateOfBirth: '1999-11-22',
      ssn: '666-35-4412',
      street: '520 Judah St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94122',
      monthlyIncome: 4100,
      employmentType: 'salaried',
      credit: {
        status: 'complete',
        score: 710,
        totalDebt: 8500,
        monthlyObligations: 450,
        paymentHistoryPercentage: 96,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        openTradelinesCount: 4,
        tradelines: [
          { creditor: 'Chase', type: 'Credit Card', balance: 2800, monthlyPayment: 120 },
          { creditor: 'SoFi', type: 'Student Loan', balance: 4200, monthlyPayment: 230 },
          { creditor: 'Capital One', type: 'Credit Card', balance: 1500, monthlyPayment: 100 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 85, verificationStatus: 'verified' },
      personalDTI: 0.1098,
      disposableIncome: 3650,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Junior analyst at a startup. Stable salaried income.',
      dateSubmitted: new Date(Date.now() - 7 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Sam',
      lastName: 'Okafor',
      dateOfBirth: '1997-06-10',
      ssn: '666-42-8891',
      street: '350 Noriega St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94122',
      monthlyIncome: 6800,
      employmentType: 'salaried',
      credit: {
        status: 'complete',
        score: 745,
        totalDebt: 14200,
        monthlyObligations: 620,
        paymentHistoryPercentage: 98,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        openTradelinesCount: 5,
        tradelines: [
          { creditor: 'Citi', type: 'Credit Card', balance: 3200, monthlyPayment: 140 },
          { creditor: 'Navient', type: 'Student Loan', balance: 8500, monthlyPayment: 320 },
          { creditor: 'Amex', type: 'Credit Card', balance: 2500, monthlyPayment: 160 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 91, verificationStatus: 'verified' },
      personalDTI: 0.0912,
      disposableIncome: 6180,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Software engineer. Strong anchor for the group.',
      dateSubmitted: new Date(Date.now() - 9 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Yuki',
      lastName: 'Tanaka',
      dateOfBirth: '2001-01-30',
      ssn: '666-19-7753',
      street: '2340 Taraval St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94116',
      monthlyIncome: 3400,
      employmentType: 'freelance',
      credit: {
        status: 'complete',
        score: 665,
        totalDebt: 2800,
        monthlyObligations: 180,
        paymentHistoryPercentage: 92,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        openTradelinesCount: 2,
        tradelines: [
          { creditor: 'Wells Fargo', type: 'Credit Card', balance: 1600, monthlyPayment: 80 },
          { creditor: 'PayPal Credit', type: 'Credit Card', balance: 1200, monthlyPayment: 100 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 68, verificationStatus: 'verified' },
      personalDTI: 0.0529,
      disposableIncome: 3220,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Freelance photographer. Variable income but low debt.',
      dateSubmitted: new Date(Date.now() - 6 * DAY),
    },
  ];

  return {
    orgId: 'org-001',
    name: '412 Irving St — 4BR Apartment',
    priceRange: null,
    estimatedMonthlyCost: 4800,
    location: { city: 'San Francisco', state: 'CA' },
    expectedMemberCount: 4,
    intakeLinkToken: 'demo-irving-st',
    status: 'assessment',
    members,
    groupMetrics: null,
    customContributionModel: null,
    readinessReport: null,
    groupAssessment: null,
    modelAnalysis: null,
    dateCreated: new Date(Date.now() - 10 * DAY),
    dateUpdated: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Group 2 — 1847 Fruitvale Ave — 3BR House
// ═══════════════════════════════════════════════════════════════════════════════
// A family where 3 adult earners contribute to rent a house in Oakland.
// Monthly cost: $3,600.
//
// Key stories:
//   - Marco has good income but high auto loan eats into breathing room.
//   - Sofia has low income and thin credit but almost no debt.
//   - Gloria is the most stable. Balanced split works well here.
// ═══════════════════════════════════════════════════════════════════════════════

function buildFruitvaleHouse() {
  const members = [
    {
      _id: new ObjectId(),
      firstName: 'Gloria',
      lastName: 'Reyes',
      dateOfBirth: '1978-03-14',
      ssn: '666-50-2241',
      street: '1200 Fruitvale Ave',
      city: 'Oakland',
      state: 'CA',
      zip: '94601',
      monthlyIncome: 3800,
      employmentType: 'government',
      credit: {
        status: 'complete',
        score: 720,
        totalDebt: 6800,
        monthlyObligations: 340,
        paymentHistoryPercentage: 97,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        openTradelinesCount: 4,
        tradelines: [
          { creditor: 'Bank of America', type: 'Credit Card', balance: 2200, monthlyPayment: 100 },
          { creditor: 'Toyota Financial', type: 'Auto Loan', balance: 4600, monthlyPayment: 240 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 88, verificationStatus: 'verified' },
      personalDTI: 0.0895,
      disposableIncome: 3460,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'City clerk. Very steady paycheck and long employment history.',
      dateSubmitted: new Date(Date.now() - 5 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Marco',
      lastName: 'Reyes',
      dateOfBirth: '1980-08-22',
      ssn: '666-50-3318',
      street: '1200 Fruitvale Ave',
      city: 'Oakland',
      state: 'CA',
      zip: '94601',
      monthlyIncome: 4200,
      employmentType: 'salaried',
      credit: {
        status: 'complete',
        score: 695,
        totalDebt: 18500,
        monthlyObligations: 780,
        paymentHistoryPercentage: 91,
        delinquencyCount: 1,
        publicRecordsCount: 0,
        openTradelinesCount: 5,
        tradelines: [
          { creditor: 'Ford Motor Credit', type: 'Auto Loan', balance: 12000, monthlyPayment: 480 },
          { creditor: 'Chase', type: 'Credit Card', balance: 3800, monthlyPayment: 150 },
          { creditor: 'Best Buy', type: 'Retail Card', balance: 2700, monthlyPayment: 150 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 82, verificationStatus: 'verified' },
      personalDTI: 0.1857,
      disposableIncome: 3420,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Warehouse manager. High auto loan but should be paid off in 2 years.',
      dateSubmitted: new Date(Date.now() - 5 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Sofia',
      lastName: 'Reyes',
      dateOfBirth: '2000-12-05',
      ssn: '666-50-4407',
      street: '430 E 14th St',
      city: 'Oakland',
      state: 'CA',
      zip: '94601',
      monthlyIncome: 2600,
      employmentType: 'freelance',
      credit: {
        status: 'complete',
        score: 610,
        totalDebt: 1800,
        monthlyObligations: 150,
        paymentHistoryPercentage: 85,
        delinquencyCount: 1,
        publicRecordsCount: 0,
        openTradelinesCount: 2,
        tradelines: [
          { creditor: 'Discover', type: 'Credit Card', balance: 800, monthlyPayment: 50 },
          { creditor: 'Klarna', type: 'Installment Loan', balance: 1000, monthlyPayment: 100 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 70, verificationStatus: 'verified' },
      personalDTI: 0.0577,
      disposableIncome: 2450,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Youngest sibling, just started freelance bookkeeping. Low debt is a plus.',
      dateSubmitted: new Date(Date.now() - 4 * DAY),
    },
  ];

  return {
    orgId: 'org-001',
    name: '1847 Fruitvale Ave — 3BR House',
    priceRange: null,
    estimatedMonthlyCost: 3600,
    location: { city: 'Oakland', state: 'CA' },
    expectedMemberCount: 3,
    intakeLinkToken: 'demo-fruitvale',
    status: 'assessment',
    members,
    groupMetrics: null,
    customContributionModel: null,
    readinessReport: null,
    groupAssessment: null,
    modelAnalysis: null,
    dateCreated: new Date(Date.now() - 7 * DAY),
    dateUpdated: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Group 3 — 2250 Clement St — 5BR Flat
// ═══════════════════════════════════════════════════════════════════════════════
// 5 working professionals who found each other through a housing group.
// Monthly cost: $6,500.
//
// Key stories:
//   - Wide income spread ($3,900 to $8,200). David & Priya carry the weight.
//   - Andre is weakest: highest DTI, lowest score, gig work.
//   - Group survives losing Andre but collapses if David leaves.
//   - Even split at $1,300 is 33% of Andre's income. Income-based is much fairer.
// ═══════════════════════════════════════════════════════════════════════════════

function buildClementFlat() {
  const members = [
    {
      _id: new ObjectId(),
      firstName: 'David',
      lastName: 'Park',
      dateOfBirth: '1992-05-18',
      ssn: '666-60-1123',
      street: '890 Geary Blvd',
      city: 'San Francisco',
      state: 'CA',
      zip: '94109',
      monthlyIncome: 8200,
      employmentType: 'salaried',
      credit: {
        status: 'complete',
        score: 760,
        totalDebt: 15000,
        monthlyObligations: 520,
        paymentHistoryPercentage: 99,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        openTradelinesCount: 6,
        tradelines: [
          { creditor: 'Chase', type: 'Credit Card', balance: 4000, monthlyPayment: 180 },
          { creditor: 'Navient', type: 'Student Loan', balance: 8000, monthlyPayment: 240 },
          { creditor: 'Amex', type: 'Credit Card', balance: 3000, monthlyPayment: 100 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 93, verificationStatus: 'verified' },
      personalDTI: 0.0634,
      disposableIncome: 7680,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Product manager at a tech company. Strong financial anchor.',
      dateSubmitted: new Date(Date.now() - 6 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Keisha',
      lastName: 'Williams',
      dateOfBirth: '1994-09-28',
      ssn: '666-60-2234',
      street: '1450 Fulton St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94117',
      monthlyIncome: 5100,
      employmentType: 'salaried',
      credit: {
        status: 'complete',
        score: 725,
        totalDebt: 7200,
        monthlyObligations: 380,
        paymentHistoryPercentage: 96,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        openTradelinesCount: 4,
        tradelines: [
          { creditor: 'Wells Fargo', type: 'Credit Card', balance: 2200, monthlyPayment: 100 },
          { creditor: 'Great Lakes', type: 'Student Loan', balance: 5000, monthlyPayment: 280 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 87, verificationStatus: 'verified' },
      personalDTI: 0.0745,
      disposableIncome: 4720,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Registered nurse. Stable income and good credit.',
      dateSubmitted: new Date(Date.now() - 5 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Tomás',
      lastName: 'Herrera',
      dateOfBirth: '1990-02-14',
      ssn: '666-60-3345',
      street: '3200 Balboa St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94121',
      monthlyIncome: 4500,
      employmentType: 'government',
      credit: {
        status: 'complete',
        score: 700,
        totalDebt: 5500,
        monthlyObligations: 290,
        paymentHistoryPercentage: 94,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        openTradelinesCount: 3,
        tradelines: [
          { creditor: 'Citi', type: 'Credit Card', balance: 1500, monthlyPayment: 70 },
          { creditor: 'FedLoan', type: 'Student Loan', balance: 4000, monthlyPayment: 220 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 80, verificationStatus: 'verified' },
      personalDTI: 0.0644,
      disposableIncome: 4210,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Public school teacher. On PSLF for student loans.',
      dateSubmitted: new Date(Date.now() - 4 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Priya',
      lastName: 'Sharma',
      dateOfBirth: '1993-07-03',
      ssn: '666-60-4456',
      street: '2100 California St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94115',
      monthlyIncome: 6300,
      employmentType: 'salaried',
      credit: {
        status: 'complete',
        score: 735,
        totalDebt: 9200,
        monthlyObligations: 410,
        paymentHistoryPercentage: 97,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        openTradelinesCount: 5,
        tradelines: [
          { creditor: 'Chase', type: 'Credit Card', balance: 3200, monthlyPayment: 140 },
          { creditor: 'Sallie Mae', type: 'Student Loan', balance: 6000, monthlyPayment: 270 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 89, verificationStatus: 'verified' },
      personalDTI: 0.0651,
      disposableIncome: 5890,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'UX designer. Solid financial profile.',
      dateSubmitted: new Date(Date.now() - 3 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Andre',
      lastName: 'Johnson',
      dateOfBirth: '1996-11-20',
      ssn: '666-60-5567',
      street: '780 Divisadero St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94117',
      monthlyIncome: 3900,
      employmentType: 'gig',
      credit: {
        status: 'complete',
        score: 650,
        totalDebt: 9800,
        monthlyObligations: 550,
        paymentHistoryPercentage: 86,
        delinquencyCount: 2,
        publicRecordsCount: 0,
        openTradelinesCount: 4,
        tradelines: [
          { creditor: 'Capital One', type: 'Credit Card', balance: 3800, monthlyPayment: 160 },
          { creditor: 'Upstart', type: 'Personal Loan', balance: 4000, monthlyPayment: 250 },
          { creditor: 'Afterpay', type: 'Installment Loan', balance: 2000, monthlyPayment: 140 },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 65, verificationStatus: 'verified' },
      personalDTI: 0.1410,
      disposableIncome: 3350,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Rideshare + part-time personal trainer. Weakest financial profile in the group.',
      dateSubmitted: new Date(Date.now() - 2 * DAY),
    },
  ];

  return {
    orgId: 'org-001',
    name: '2250 Clement St — 5BR Flat',
    priceRange: null,
    estimatedMonthlyCost: 6500,
    location: { city: 'San Francisco', state: 'CA' },
    expectedMemberCount: 5,
    intakeLinkToken: 'demo-clement-st',
    status: 'assessment',
    members,
    groupMetrics: null,
    customContributionModel: null,
    readinessReport: null,
    groupAssessment: null,
    modelAnalysis: null,
    dateCreated: new Date(Date.now() - 8 * DAY),
    dateUpdated: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Gemini AI insight generation
// ═══════════════════════════════════════════════════════════════════════════════

async function callWithRetry(fn, label) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await fn();
    if (result.success) return result;

    // Check for 429 rate limit and extract retry delay
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
    console.log('  GEMINI_API_KEY not set — skipping AI insights');
    return;
  }

  const members = project.members;

  // 1. Individual assessments (sequential with delay to respect rate limits)
  console.log(`  Generating ${members.length} applicant assessments...`);
  let memberOk = 0;
  for (const m of members) {
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
      process.stdout.write(`    ${m.firstName} ✓\n`);
    } else {
      process.stdout.write(`    ${m.firstName} ✗ ${result.error}\n`);
    }
    await sleep(GEMINI_DELAY_MS);
  }
  console.log(`  ${memberOk}/${members.length} assessments stored`);

  // 2. Group assessment
  const updatedProject = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
  const metrics = updatedProject.groupMetrics;
  if (!metrics) {
    console.log('  No group metrics — skipping group and model insights');
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
      creditScore: m.credit.score,
      monthlyObligations: m.credit.monthlyObligations,
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
// Main seed function
// ═══════════════════════════════════════════════════════════════════════════════

async function seed() {
  console.log('Connecting to MongoDB...');
  await connect();
  const db = getDb();

  // Clear existing demo groups (including legacy tokens from old seed data)
  const deleted = await db.collection('projects').deleteMany({
    intakeLinkToken: { $in: [...DEMO_TOKENS, ...LEGACY_TOKENS] },
  });
  if (deleted.deletedCount > 0) {
    console.log(`Removed ${deleted.deletedCount} existing demo group(s).`);
  }

  // Clear existing demo buildings
  const deletedBuildings = await db.collection('buildings').deleteMany({ orgId: 'org-001' });
  if (deletedBuildings.deletedCount > 0) {
    console.log(`Removed ${deletedBuildings.deletedCount} existing demo building(s).`);
  }

  // ── Create buildings ─────────────────────────────────────────
  console.log('\n--- Creating buildings ---');

  // Building 1: 412 Irving St — Apartment with 3 units
  const irvingUnit1A = new ObjectId();
  const irvingUnit1B = new ObjectId();
  const irvingUnit2A = new ObjectId();
  const irvingBuilding = await db.collection('buildings').insertOne({
    orgId: 'org-001',
    address: '412 Irving St',
    city: 'San Francisco',
    state: 'CA',
    type: 'apartment',
    units: [
      { _id: irvingUnit1A, name: '1A', bedrooms: 2, monthlyCost: 2400 },
      { _id: irvingUnit1B, name: '1B', bedrooms: 2, monthlyCost: 2400 },
      { _id: irvingUnit2A, name: '2A', bedrooms: 1, monthlyCost: 1800 },
    ],
    dateCreated: new Date(Date.now() - 14 * DAY),
    dateUpdated: new Date(),
  });
  console.log(`  412 Irving St (apartment, 3 units) — ID: ${irvingBuilding.insertedId}`);

  // Building 2: 1847 Fruitvale Ave — House with 1 unit
  const fruitvaleUnit = new ObjectId();
  const fruitvaleBuilding = await db.collection('buildings').insertOne({
    orgId: 'org-001',
    address: '1847 Fruitvale Ave',
    city: 'Oakland',
    state: 'CA',
    type: 'house',
    units: [
      { _id: fruitvaleUnit, name: null, bedrooms: 3, monthlyCost: 3600 },
    ],
    dateCreated: new Date(Date.now() - 12 * DAY),
    dateUpdated: new Date(),
  });
  console.log(`  1847 Fruitvale Ave (house, 1 unit) — ID: ${fruitvaleBuilding.insertedId}`);

  // Building 3: 2250 Clement St — Condo with 1 unit
  const clementUnit = new ObjectId();
  const clementBuilding = await db.collection('buildings').insertOne({
    orgId: 'org-001',
    address: '2250 Clement St',
    city: 'San Francisco',
    state: 'CA',
    type: 'condo',
    units: [
      { _id: clementUnit, name: null, bedrooms: 5, monthlyCost: 6500 },
    ],
    dateCreated: new Date(Date.now() - 10 * DAY),
    dateUpdated: new Date(),
  });
  console.log(`  2250 Clement St (condo, 1 unit) — ID: ${clementBuilding.insertedId}`);

  // ── Create projects linked to buildings ─────────────────────
  const buildingLinks = [
    {
      build: buildIrvingStreet,
      label: '412 Irving St — 4BR Apartment',
      buildingId: irvingBuilding.insertedId.toString(),
      unitId: irvingUnit1A.toString(),
      stage: 'review',
    },
    {
      build: buildFruitvaleHouse,
      label: '1847 Fruitvale Ave — 3BR House',
      buildingId: fruitvaleBuilding.insertedId.toString(),
      unitId: fruitvaleUnit.toString(),
      stage: 'approved',
    },
    {
      build: buildClementFlat,
      label: '2250 Clement St — 5BR Flat',
      buildingId: clementBuilding.insertedId.toString(),
      unitId: clementUnit.toString(),
      stage: 'negotiating',
    },
  ];

  for (const { build, label, buildingId, unitId, stage } of buildingLinks) {
    console.log(`\n--- ${label} ---`);
    const project = build();

    // Add building/unit/stage fields
    project.buildingId = buildingId;
    project.unitId = unitId;
    project.stage = stage;

    // Insert group
    const result = await db.collection('projects').insertOne(project);
    const projectId = result.insertedId.toString();
    console.log(`  Inserted (ID: ${projectId}) — stage: ${stage}, buildingId: ${buildingId}`);

    // Compute group financials
    console.log('  Computing group financials...');
    const analytics = await computeGroupAnalytics(projectId);
    if (analytics.error) {
      console.log(`  Financials error: ${analytics.message}`);
    } else {
      const dtiPct = (analytics.groupDTI * 100).toFixed(1);
      const critical = analytics.resilienceMatrix.filter((r) => r.isCriticalDependency).length;
      console.log(`  Group DTI: ${dtiPct}% (${analytics.dtiClassification}), ${critical} critical dependencies`);
    }

    // Compute split models
    console.log('  Computing split models...');
    const contributions = await computeContributions(projectId);
    if (contributions.error) {
      console.log(`  Split error: ${contributions.message}`);
    } else {
      const affordabilityFlags = Object.values(contributions).reduce((count, model) => {
        if (!model?.members) return count;
        return count + model.members.filter((m) => m.exceedsAffordability).length;
      }, 0);
      console.log(`  3 models computed, ${affordabilityFlags} affordability flags total`);
    }

    // Generate Gemini AI insights
    await generateInsights(db, projectId, project);

    // Print applicant summary
    console.log('  Applicants:');
    for (const m of project.members) {
      const dti = m.personalDTI ? `${(m.personalDTI * 100).toFixed(1)}%` : 'N/A';
      console.log(
        `    ${m.firstName.padEnd(8)} | ${m.employmentType.padEnd(10)} | score ${m.credit.score} | income $${m.monthlyIncome.toLocaleString().padStart(6)} | DTI ${dti}`
      );
    }

    console.log(`  Invite link: /intake/${project.intakeLinkToken}`);
    console.log(`  Dashboard:   /dashboard/project/${projectId}`);
  }

  await close();
  console.log('\nSeed complete.');
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await close();
  process.exit(1);
});
