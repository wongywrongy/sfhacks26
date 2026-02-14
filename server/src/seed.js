/**
 * Seed script for CommonGround hackathon demo.
 * Creates 3 projects with 12 total members representing varied Bay Area co-op scenarios.
 * Computes group analytics and contribution models, then generates Gemini AI insights.
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
const DEMO_TOKENS = ['demo-student-coop', 'demo-oakland-hills', 'demo-eastbay-family', 'demo-sunset-ridge'];

// ═══════════════════════════════════════════════════════════════════════════════
// Project 1 — Sunset District Student Co-op
// ═══════════════════════════════════════════════════════════════════════════════
// 4 college students renting a 4BR apartment in SF's Sunset District.
// Monthly cost: $4,800.  Group DTI: 32.8% (healthy).
//
// Key demo stories:
//   - Sam is the sole critical dependency (51.3% DTI without him).
//   - Equal split pushes Mei (37.5%) and Yuki (35.3%) over the 30% threshold.
//   - Proportional keeps everyone at exactly 27.4% — under threshold.
//   - Income diversity: 3 types / 4 members = 0.75
// ═══════════════════════════════════════════════════════════════════════════════

function buildStudentProject() {
  const members = [
    {
      _id: new ObjectId(),
      firstName: 'Mei',
      lastName: 'Chen',
      dateOfBirth: '2002-04-15',
      ssn: '666-28-3370',
      street: '1842 Irving St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94122',
      monthlyIncome: 3200,
      employmentType: 'gig',
      unitSize: 'studio',
      credit: {
        status: 'complete',
        score: 635,
        totalDebt: 3200,
        monthlyObligations: 120,
        openTradelinesCount: 2,
        paymentHistoryPercentage: 88,
        delinquencyCount: 1,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Capital One', accountType: 'Credit Card', balance: 2100, monthlyPayment: 65, status: 'Open', dateOpened: '2023-01-20' },
          { creditorName: 'Afterpay', accountType: 'Installment Loan', balance: 1100, monthlyPayment: 55, status: 'Open', dateOpened: '2025-08-10' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 62, verificationStatus: 'verified' },
      personalDTI: 0.0375,
      disposableIncome: 3080,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Part-time barista near SFSU. Thin credit file but manageable debt.',
      dateSubmitted: new Date(Date.now() - 7 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Alex',
      lastName: 'Torres',
      dateOfBirth: '2000-11-08',
      ssn: '666-20-7378',
      street: '520 Judah St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94122',
      monthlyIncome: 4100,
      employmentType: 'salaried',
      unitSize: '1br',
      credit: {
        status: 'complete',
        score: 710,
        totalDebt: 22000,
        monthlyObligations: 380,
        openTradelinesCount: 3,
        paymentHistoryPercentage: 96,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Great Lakes', accountType: 'Student Loan', balance: 18500, monthlyPayment: 250, status: 'Open', dateOpened: '2019-08-15' },
          { creditorName: 'Chase', accountType: 'Credit Card', balance: 2200, monthlyPayment: 80, status: 'Open', dateOpened: '2021-03-10' },
          { creditorName: 'Citi', accountType: 'Credit Card', balance: 1300, monthlyPayment: 50, status: 'Open', dateOpened: '2022-06-01' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 85, verificationStatus: 'verified' },
      personalDTI: 0.0927,
      disposableIncome: 3720,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Graduate TA with research stipend. Student loans but solid payment history.',
      dateSubmitted: new Date(Date.now() - 6 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Sam',
      lastName: 'Okafor',
      dateOfBirth: '2001-06-22',
      ssn: '666-32-8649',
      street: '3150 Noriega St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94122',
      monthlyIncome: 6800,
      employmentType: 'salaried',
      unitSize: '1br',
      credit: {
        status: 'complete',
        score: 690,
        totalDebt: 8500,
        monthlyObligations: 250,
        openTradelinesCount: 2,
        paymentHistoryPercentage: 93,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Honda Financial', accountType: 'Auto Loan', balance: 6200, monthlyPayment: 185, status: 'Open', dateOpened: '2024-02-01' },
          { creditorName: 'Discover', accountType: 'Credit Card', balance: 2300, monthlyPayment: 65, status: 'Open', dateOpened: '2022-09-15' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 74, verificationStatus: 'verified' },
      personalDTI: 0.0368,
      disposableIncome: 6550,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Software intern at major tech company. Highest earner in group.',
      dateSubmitted: new Date(Date.now() - 6 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Yuki',
      lastName: 'Tanaka',
      dateOfBirth: '2003-02-14',
      ssn: '666-58-2109',
      street: '2280 Taraval St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94116',
      monthlyIncome: 3400,
      employmentType: 'freelance',
      unitSize: 'studio',
      credit: {
        status: 'complete',
        score: 658,
        totalDebt: 5800,
        monthlyObligations: 190,
        openTradelinesCount: 3,
        paymentHistoryPercentage: 85,
        delinquencyCount: 2,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Best Buy', accountType: 'Credit Card', balance: 1800, monthlyPayment: 60, status: 'Open', dateOpened: '2023-11-20' },
          { creditorName: 'PayPal Credit', accountType: 'Credit Card', balance: 2400, monthlyPayment: 80, status: 'Open', dateOpened: '2024-03-05' },
          { creditorName: 'Affirm', accountType: 'Installment Loan', balance: 1600, monthlyPayment: 50, status: 'Open', dateOpened: '2025-06-12' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 68, verificationStatus: 'verified' },
      personalDTI: 0.0559,
      disposableIncome: 3210,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Freelance graphic designer. Variable income but growing client base.',
      dateSubmitted: new Date(Date.now() - 5 * DAY),
    },
  ];

  return {
    orgId: 'org-001',
    name: 'Sunset District Student Co-op',
    priceRange: { low: 650000, high: 850000 },
    estimatedMonthlyCost: 4800,
    location: { city: 'San Francisco', state: 'CA' },
    expectedMemberCount: 4,
    intakeLinkToken: 'demo-student-coop',
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
// Project 2 — Oakland Hills Couple + Friends Co-op
// ═══════════════════════════════════════════════════════════════════════════════
// 3 households purchasing a multi-unit property in the Oakland Hills.
// Monthly cost: $8,500.  Group DTI: 34.3% (healthy).
//
// Key demo stories:
//   - Anderson is the anchor (59.5% DTI without them — massive critical dependency).
//   - Garcia removal is also critical (44.9%) — two of three critical.
//   - Park-Johnson can leave and group survives (41.8%).
//   - Unit-based model: 2 × 2br + 1 × 1br shows couples paying more for larger units.
//   - Highest combined income ($32K/mo) and borrowing power of all 3 projects.
// ═══════════════════════════════════════════════════════════════════════════════

function buildOaklandProject() {
  const members = [
    {
      _id: new ObjectId(),
      firstName: 'James',
      lastName: 'Anderson',
      dateOfBirth: '1985-09-03',
      ssn: '666-41-5520',
      street: '6820 Skyline Blvd',
      city: 'Oakland',
      state: 'CA',
      zip: '94611',
      monthlyIncome: 15000,
      employmentType: 'government',
      unitSize: '2br',
      credit: {
        status: 'complete',
        score: 762,
        totalDebt: 28000,
        monthlyObligations: 850,
        openTradelinesCount: 5,
        paymentHistoryPercentage: 99,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Toyota Financial', accountType: 'Auto Loan', balance: 14000, monthlyPayment: 420, status: 'Open', dateOpened: '2023-06-15' },
          { creditorName: 'Wells Fargo', accountType: 'Credit Card', balance: 3500, monthlyPayment: 120, status: 'Open', dateOpened: '2016-03-01' },
          { creditorName: 'Amex Blue', accountType: 'Credit Card', balance: 2800, monthlyPayment: 95, status: 'Open', dateOpened: '2018-09-20' },
          { creditorName: 'Costco Citi', accountType: 'Credit Card', balance: 1200, monthlyPayment: 40, status: 'Open', dateOpened: '2020-01-10' },
          { creditorName: 'SoFi', accountType: 'Personal Loan', balance: 6500, monthlyPayment: 175, status: 'Open', dateOpened: '2024-04-01' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 92, verificationStatus: 'verified' },
      personalDTI: 0.0567,
      disposableIncome: 14150,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Both partners are city employees. Very stable household income. Group anchor.',
      dateSubmitted: new Date(Date.now() - 12 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Sofia',
      lastName: 'Garcia',
      dateOfBirth: '1988-03-17',
      ssn: '666-73-8841',
      street: '4510 Montclair Ave',
      city: 'Oakland',
      state: 'CA',
      zip: '94611',
      monthlyIncome: 10000,
      employmentType: 'salaried',
      unitSize: '2br',
      credit: {
        status: 'complete',
        score: 725,
        totalDebt: 42000,
        monthlyObligations: 1100,
        openTradelinesCount: 5,
        paymentHistoryPercentage: 95,
        delinquencyCount: 1,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Navient', accountType: 'Student Loan', balance: 22000, monthlyPayment: 380, status: 'Open', dateOpened: '2010-08-01' },
          { creditorName: 'Ford Credit', accountType: 'Auto Loan', balance: 12500, monthlyPayment: 400, status: 'Open', dateOpened: '2024-01-15' },
          { creditorName: 'Chase Sapphire', accountType: 'Credit Card', balance: 4200, monthlyPayment: 170, status: 'Open', dateOpened: '2017-05-10' },
          { creditorName: 'Target RedCard', accountType: 'Credit Card', balance: 1800, monthlyPayment: 80, status: 'Open', dateOpened: '2021-11-20' },
          { creditorName: 'Apple Card', accountType: 'Credit Card', balance: 1500, monthlyPayment: 70, status: 'Open', dateOpened: '2022-07-01' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 88, verificationStatus: 'verified' },
      personalDTI: 0.1100,
      disposableIncome: 8900,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Both partners work in tech. High debt but strong combined income.',
      dateSubmitted: new Date(Date.now() - 11 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Daniel',
      lastName: 'Park-Johnson',
      dateOfBirth: '1990-12-05',
      ssn: '666-62-4437',
      street: '3880 Park Blvd',
      city: 'Oakland',
      state: 'CA',
      zip: '94602',
      monthlyIncome: 7000,
      employmentType: 'freelance',
      unitSize: '1br',
      credit: {
        status: 'complete',
        score: 648,
        totalDebt: 15000,
        monthlyObligations: 520,
        openTradelinesCount: 3,
        paymentHistoryPercentage: 87,
        delinquencyCount: 3,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'LendingClub', accountType: 'Personal Loan', balance: 8500, monthlyPayment: 280, status: 'Open', dateOpened: '2023-10-20' },
          { creditorName: 'Bank of America', accountType: 'Credit Card', balance: 3800, monthlyPayment: 130, status: 'Open', dateOpened: '2019-04-15' },
          { creditorName: 'Venmo Credit Card', accountType: 'Credit Card', balance: 2700, monthlyPayment: 110, status: 'Open', dateOpened: '2024-06-01' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 71, verificationStatus: 'verified' },
      personalDTI: 0.0743,
      disposableIncome: 6480,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Freelance couple. Income variable but trending up. Weakest credit in group.',
      dateSubmitted: new Date(Date.now() - 9 * DAY),
    },
  ];

  return {
    orgId: 'org-001',
    name: 'Oakland Hills Co-op',
    priceRange: { low: 1100000, high: 1300000 },
    estimatedMonthlyCost: 8500,
    location: { city: 'Oakland', state: 'CA' },
    expectedMemberCount: 3,
    intakeLinkToken: 'demo-oakland-hills',
    status: 'modeling',
    members,
    groupMetrics: null,
    customContributionModel: null,
    readinessReport: null,
    groupAssessment: null,
    modelAnalysis: null,
    dateCreated: new Date(Date.now() - 14 * DAY),
    dateUpdated: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Project 3 — East Bay Family Housing Co-op
// ═══════════════════════════════════════════════════════════════════════════════
// 5 low-to-moderate income families forming a limited equity co-op.
// Monthly cost: $6,000.  Group DTI: 37.5% (acceptable).
//
// Key demo stories:
//   - 3 of 5 members are critical dependencies (Rosa, Tran, Carmen) — fragile group.
//   - James and Andre are non-critical — group survives losing either.
//   - Rosa has the weakest credit (580) and a public record (collections).
//   - James has a criminal misdemeanor record (demo: tool doesn't auto-disqualify).
//   - Carmen has an old eviction (demo: facts for org interpretation).
//   - Hybrid model works best: balances affordability across varied incomes.
//   - Most compelling scenario for demo: complex group with real tensions.
// ═══════════════════════════════════════════════════════════════════════════════

function buildEastBayProject() {
  const members = [
    {
      _id: new ObjectId(),
      firstName: 'Rosa',
      lastName: 'Herrera',
      dateOfBirth: '1978-08-21',
      ssn: '666-35-9912',
      street: '1420 International Blvd',
      city: 'Oakland',
      state: 'CA',
      zip: '94601',
      monthlyIncome: 4500,
      employmentType: 'salaried',
      unitSize: '2br',
      credit: {
        status: 'complete',
        score: 580,
        totalDebt: 12000,
        monthlyObligations: 350,
        openTradelinesCount: 3,
        paymentHistoryPercentage: 82,
        delinquencyCount: 4,
        publicRecordsCount: 1,
        tradelines: [
          { creditorName: 'Progressive Finance', accountType: 'Personal Loan', balance: 5500, monthlyPayment: 175, status: 'Open', dateOpened: '2024-01-10' },
          { creditorName: 'Capital One Platinum', accountType: 'Credit Card', balance: 3800, monthlyPayment: 110, status: 'Open', dateOpened: '2020-06-15' },
          { creditorName: 'JCPenney', accountType: 'Credit Card', balance: 2700, monthlyPayment: 65, status: 'Open', dateOpened: '2022-03-01' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 58, verificationStatus: 'verified' },
      personalDTI: 0.0778,
      disposableIncome: 4150,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Home health aide. Lowest credit score but committed member. Collections item from 2019 medical bill.',
      dateSubmitted: new Date(Date.now() - 5 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Tran',
      lastName: 'Nguyen',
      dateOfBirth: '1985-01-30',
      ssn: '666-48-7721',
      street: '2855 Fruitvale Ave',
      city: 'Oakland',
      state: 'CA',
      zip: '94601',
      monthlyIncome: 5200,
      employmentType: 'salaried',
      unitSize: '2br',
      credit: {
        status: 'complete',
        score: 695,
        totalDebt: 18500,
        monthlyObligations: 480,
        openTradelinesCount: 3,
        paymentHistoryPercentage: 94,
        delinquencyCount: 1,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Wells Fargo', accountType: 'Personal Loan', balance: 9800, monthlyPayment: 260, status: 'Open', dateOpened: '2023-05-20' },
          { creditorName: 'Chase Freedom', accountType: 'Credit Card', balance: 3200, monthlyPayment: 110, status: 'Open', dateOpened: '2019-09-10' },
          { creditorName: 'Amex', accountType: 'Credit Card', balance: 5500, monthlyPayment: 110, status: 'Open', dateOpened: '2021-02-15' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 81, verificationStatus: 'verified' },
      personalDTI: 0.0923,
      disposableIncome: 4720,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Restaurant manager. Stable employment, moderate credit.',
      dateSubmitted: new Date(Date.now() - 5 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'James',
      lastName: 'Williams',
      dateOfBirth: '1972-04-09',
      ssn: '666-51-3306',
      street: '980 105th Ave',
      city: 'Oakland',
      state: 'CA',
      zip: '94603',
      monthlyIncome: 2800,
      employmentType: 'gig',
      unitSize: '1br',
      credit: {
        status: 'complete',
        score: 605,
        totalDebt: 6200,
        monthlyObligations: 180,
        openTradelinesCount: 2,
        paymentHistoryPercentage: 79,
        delinquencyCount: 5,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Affirm', accountType: 'Installment Loan', balance: 2800, monthlyPayment: 90, status: 'Open', dateOpened: '2025-02-01' },
          { creditorName: 'Credit One Bank', accountType: 'Credit Card', balance: 3400, monthlyPayment: 90, status: 'Open', dateOpened: '2023-07-15' },
        ],
      },
      criminal: {
        status: 'complete',
        records: [
          {
            offense: 'Misdemeanor — Trespassing',
            date: '2015-03-22',
            jurisdiction: 'Alameda County',
            disposition: 'Completed probation',
          },
        ],
      },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 45, verificationStatus: 'verified' },
      personalDTI: 0.0643,
      disposableIncome: 2620,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Part-time security guard. Old misdemeanor — org reviewed and approved. Lowest income in group.',
      dateSubmitted: new Date(Date.now() - 4 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Andre',
      lastName: 'Davis',
      dateOfBirth: '1982-07-16',
      ssn: '666-66-8854',
      street: '3300 Seminary Ave',
      city: 'Oakland',
      state: 'CA',
      zip: '94605',
      monthlyIncome: 3800,
      employmentType: 'government',
      unitSize: '2br',
      credit: {
        status: 'complete',
        score: 715,
        totalDebt: 24000,
        monthlyObligations: 550,
        openTradelinesCount: 4,
        paymentHistoryPercentage: 97,
        delinquencyCount: 0,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Nelnet', accountType: 'Student Loan', balance: 14500, monthlyPayment: 220, status: 'Open', dateOpened: '2004-08-15' },
          { creditorName: 'USAA', accountType: 'Auto Loan', balance: 6500, monthlyPayment: 210, status: 'Open', dateOpened: '2024-03-01' },
          { creditorName: 'Discover', accountType: 'Credit Card', balance: 2000, monthlyPayment: 75, status: 'Open', dateOpened: '2018-11-10' },
          { creditorName: 'Navy Federal', accountType: 'Credit Card', balance: 1000, monthlyPayment: 45, status: 'Open', dateOpened: '2020-06-20' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: { status: 'complete', records: [] },
      identity: { status: 'complete', cviScore: 89, verificationStatus: 'verified' },
      personalDTI: 0.1447,
      disposableIncome: 3250,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'City bus driver. Excellent payment history. Government stability is an asset.',
      dateSubmitted: new Date(Date.now() - 4 * DAY),
    },
    {
      _id: new ObjectId(),
      firstName: 'Carmen',
      lastName: 'Martinez',
      dateOfBirth: '1980-10-28',
      ssn: '666-79-4410',
      street: '1650 Seminary Ave',
      city: 'Oakland',
      state: 'CA',
      zip: '94621',
      monthlyIncome: 5800,
      employmentType: 'other',
      unitSize: '3br',
      credit: {
        status: 'complete',
        score: 660,
        totalDebt: 31000,
        monthlyObligations: 720,
        openTradelinesCount: 4,
        paymentHistoryPercentage: 90,
        delinquencyCount: 2,
        publicRecordsCount: 0,
        tradelines: [
          { creditorName: 'Bank of America', accountType: 'Business Loan', balance: 18000, monthlyPayment: 380, status: 'Open', dateOpened: '2022-04-10' },
          { creditorName: 'Toyota Financial', accountType: 'Auto Loan', balance: 8500, monthlyPayment: 240, status: 'Open', dateOpened: '2024-01-20' },
          { creditorName: 'Chase', accountType: 'Credit Card', balance: 3200, monthlyPayment: 65, status: 'Open', dateOpened: '2019-08-15' },
          { creditorName: 'Walmart', accountType: 'Credit Card', balance: 1300, monthlyPayment: 35, status: 'Open', dateOpened: '2023-12-01' },
        ],
      },
      criminal: { status: 'complete', records: [] },
      eviction: {
        status: 'complete',
        records: [
          {
            date: '2018-06-15',
            jurisdiction: 'Contra Costa County',
            type: 'Unlawful detainer',
            disposition: 'Settled — rent dispute, no fault finding',
          },
        ],
      },
      identity: { status: 'complete', cviScore: 73, verificationStatus: 'verified' },
      personalDTI: 0.1241,
      disposableIncome: 5080,
      aiAssessment: null,
      orgStatus: 'approved',
      orgNotes: 'Owns small daycare business. Old eviction was a rent dispute — settled. Highest earner after Tran.',
      dateSubmitted: new Date(Date.now() - 3 * DAY),
    },
  ];

  return {
    orgId: 'org-001',
    name: 'East Bay Family Housing Co-op',
    priceRange: { low: 850000, high: 1050000 },
    estimatedMonthlyCost: 6000,
    location: { city: 'Oakland', state: 'CA' },
    expectedMemberCount: 5,
    intakeLinkToken: 'demo-eastbay-family',
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
// Gemini AI insight generation
// ═══════════════════════════════════════════════════════════════════════════════

async function generateInsights(db, projectId, project) {
  if (!process.env.GEMINI_API_KEY) {
    console.log('  GEMINI_API_KEY not set — skipping AI insights');
    return;
  }

  const members = project.members;

  // 1. Member assessments (in parallel)
  console.log(`  Generating ${members.length} member assessments...`);
  const assessmentResults = await Promise.allSettled(
    members.map((m) =>
      gemini.assessMember({
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
        unitSize: m.unitSize,
      })
    )
  );

  let memberOk = 0;
  for (let i = 0; i < members.length; i++) {
    const r = assessmentResults[i];
    if (r.status === 'fulfilled' && r.value.success) {
      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId), 'members._id': members[i]._id },
        { $set: { 'members.$.aiAssessment': r.value.data } }
      );
      memberOk++;
    }
  }
  console.log(`  ${memberOk}/${members.length} member assessments stored`);

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
  const groupResult = await gemini.assessGroup(groupProfile);
  if (groupResult.success) {
    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: { groupAssessment: groupResult.data } }
    );
    console.log('  Group assessment stored');
  } else {
    console.log(`  Group assessment failed: ${groupResult.error}`);
  }

  // 3. Model analysis
  console.log('  Generating model analysis...');
  const contributions = await computeContributions(projectId);
  if (!contributions.error) {
    const modelProfile = {
      estimatedMonthlyCost: project.estimatedMonthlyCost,
      memberCount: members.length,
      combinedIncome: metrics.combinedIncome,
      groupDTI: metrics.groupDTI,
    };
    const modelResult = await gemini.analyzeModels(contributions, modelProfile);
    if (modelResult.success) {
      await db.collection('projects').updateOne(
        { _id: new ObjectId(projectId) },
        { $set: { modelAnalysis: modelResult.data } }
      );
      console.log('  Model analysis stored');
    } else {
      console.log(`  Model analysis failed: ${modelResult.error}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main seed function
// ═══════════════════════════════════════════════════════════════════════════════

async function seed() {
  console.log('Connecting to MongoDB...');
  await connect();
  const db = getDb();

  // Clear existing demo projects
  const deleted = await db.collection('projects').deleteMany({
    intakeLinkToken: { $in: DEMO_TOKENS },
  });
  if (deleted.deletedCount > 0) {
    console.log(`Removed ${deleted.deletedCount} existing demo project(s).`);
  }

  const projectBuilders = [
    { build: buildStudentProject, label: 'Sunset District Student Co-op' },
    { build: buildOaklandProject, label: 'Oakland Hills Co-op' },
    { build: buildEastBayProject, label: 'East Bay Family Housing Co-op' },
  ];

  for (const { build, label } of projectBuilders) {
    console.log(`\n--- ${label} ---`);
    const project = build();

    // Insert project
    const result = await db.collection('projects').insertOne(project);
    const projectId = result.insertedId.toString();
    console.log(`  Inserted (ID: ${projectId})`);

    // Compute group analytics (stores on project.groupMetrics)
    console.log('  Computing group analytics...');
    const analytics = await computeGroupAnalytics(projectId);
    if (analytics.error) {
      console.log(`  Analytics error: ${analytics.message}`);
    } else {
      const dtiPct = (analytics.groupDTI * 100).toFixed(1);
      const critical = analytics.resilienceMatrix.filter((r) => r.isCriticalDependency).length;
      console.log(`  Group DTI: ${dtiPct}% (${analytics.dtiClassification}), ${critical} critical dependencies`);
    }

    // Compute contributions (returned, not stored — they compute on the fly)
    console.log('  Computing contribution models...');
    const contributions = await computeContributions(projectId);
    if (contributions.error) {
      console.log(`  Contributions error: ${contributions.message}`);
    } else {
      const affordabilityFlags = Object.values(contributions).reduce((count, model) => {
        if (!model?.members) return count;
        return count + model.members.filter((m) => m.exceedsAffordability).length;
      }, 0);
      console.log(`  4 models computed, ${affordabilityFlags} affordability flags total`);
    }

    // Generate Gemini AI insights
    await generateInsights(db, projectId, project);

    // Print member summary
    console.log('  Members:');
    for (const m of project.members) {
      const dti = m.personalDTI ? `${(m.personalDTI * 100).toFixed(1)}%` : 'N/A';
      console.log(
        `    ${m.firstName.padEnd(8)} | ${m.employmentType.padEnd(10)} | score ${m.credit.score} | income $${m.monthlyIncome.toLocaleString().padStart(6)} | DTI ${dti}`
      );
    }

    console.log(`  Intake link: /intake/${project.intakeLinkToken}`);
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
