// Full member detail objects — keyed by member ID
// Each contains both the summary fields (used in project.members)
// and the full detail fields (used in MemberProfile)

function makeSummary(m) {
  return {
    _id: m._id,
    firstName: m.firstName,
    lastInitial: m.lastInitial,
    monthlyIncome: m.monthlyIncome,
    employmentType: m.employmentType,
    jobTitle: m.jobTitle,
    orgStatus: m.orgStatus,
    orgNotes: m.orgNotes || '',
    creditStatus: m.credit.status,
    criminalStatus: m.criminal.status,
    evictionStatus: m.eviction.status,
    identityStatus: m.identity.status,
    creditScore: m.credit.score,
    monthlyObligations: m.credit.monthlyObligations,
    totalDebt: m.credit.totalDebt,
    personalDTI: m.personalDTI,
    delinquencyCount: m.credit.delinquencyCount,
    paymentHistoryPct: m.credit.paymentHistoryPercentage,
    cviScore: m.identity.cviScore,
    criminalRecordCount: (m.criminal.records || []).length,
    evictionRecordCount: (m.eviction.records || []).length,
    paymentTrajectory: m.paymentTrajectory,
    tradelineComposition: m.tradelineComposition,
  };
}

function makeSafety(m) {
  const crimRecords = m.criminal.records || [];
  const evicRecords = m.eviction.records || [];
  const crimSeverity = crimRecords.length === 0 ? 'none'
    : crimRecords.some(r => r.severity === 'elevated') ? 'elevated'
    : crimRecords.some(r => r.severity === 'moderate') ? 'moderate' : 'low';
  const evicSeverity = evicRecords.length === 0 ? 'none'
    : evicRecords.some(r => r.severity === 'elevated') ? 'elevated'
    : evicRecords.some(r => r.severity === 'moderate') ? 'moderate' : 'low';

  return {
    _id: m._id,
    firstName: m.firstName,
    lastInitial: m.lastInitial,
    criminalStructured: {
      summary: { totalRecords: crimRecords.length, overallSeverity: crimSeverity },
      records: crimRecords,
    },
    evictionStructured: {
      summary: { totalFilings: evicRecords.length, overallSeverity: evicSeverity },
      records: evicRecords,
    },
    identityStructured: {
      verificationStatus: m.identity.cviScore > 30 ? 'verified' : m.identity.cviScore >= 15 ? 'uncertain' : 'failed',
      cviScore: m.identity.cviScore,
      matchDetails: m.identity.matchDetails,
    },
    aiSafetySummary: m.aiSafetySummary || null,
  };
}

// ── Deal 1: Schrute Farms Group ($4,200/mo) ──

const michael = {
  _id: 'm1',
  firstName: 'Michael',
  lastInitial: 'S',
  monthlyIncome: 7800,
  employmentType: 'salaried',
  jobTitle: 'Regional Manager',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.32,
  disposableIncome: 4920,
  ssnLast4: '4821',
  dateSubmitted: '2025-12-15T09:30:00Z',
  paymentTrajectory: { trend: 'stable', recentLateCount: 0, olderLateCount: 1, windowMonths: 24, confidence: 'high' },
  credit: {
    status: 'complete',
    score: 722,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 1380,
    totalDebt: 28400,
    openTradelinesCount: 6,
    paymentHistoryPercentage: 96,
    delinquencyCount: 1,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Chase Visa', balance: 4200, monthlyPayment: 180, type: 'revolving', latePayments: { _30: 1, _60: 0, _90: 0 }, dateOpened: '2020-03-15' },
      { creditor: 'Toyota Financial', balance: 12800, monthlyPayment: 420, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2022-06-01' },
      { creditor: 'SoFi Student Loan', balance: 8200, monthlyPayment: 310, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2019-09-01' },
      { creditor: 'Discover Card', balance: 1800, monthlyPayment: 90, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2021-01-10' },
      { creditor: 'Apple Card', balance: 900, monthlyPayment: 45, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-04-20' },
      { creditor: 'Best Buy Financing', balance: 500, monthlyPayment: 335, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-08-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 6900 },
      installment: { count: 3, totalBalance: 21500 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 34,
    installmentToRevolvingRatio: 3.12,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 82,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Michael presents a stable financial profile with a 722 VantageScore and consistent salaried income of $7,800/mo as Regional Manager. His 32% personal DTI falls within acceptable lending parameters. One 30-day late payment on his Chase Visa from 2023 is an isolated incident with no pattern of delinquency. His installment-heavy debt mix with a 3.12 installment-to-revolving ratio is favorable. Recommend approval — he provides solid anchor income for the group.',
  },
  aiSafetySummary: null,
};

const pam = {
  _id: 'm2',
  firstName: 'Pam',
  lastInitial: 'B',
  monthlyIncome: 5200,
  employmentType: 'freelance',
  jobTitle: 'Graphic Designer',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.35,
  disposableIncome: 3020,
  ssnLast4: '7193',
  dateSubmitted: '2025-12-18T14:15:00Z',
  paymentTrajectory: { trend: 'improving', recentLateCount: 0, olderLateCount: 3, windowMonths: 24, confidence: 'medium' },
  credit: {
    status: 'complete',
    score: 685,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 980,
    totalDebt: 16200,
    openTradelinesCount: 4,
    paymentHistoryPercentage: 91,
    delinquencyCount: 3,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Capital One', balance: 5800, monthlyPayment: 290, type: 'revolving', latePayments: { _30: 2, _60: 1, _90: 0 }, dateOpened: '2019-07-22' },
      { creditor: 'Navient Student Loan', balance: 6400, monthlyPayment: 280, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2018-08-15' },
      { creditor: 'Amazon Store Card', balance: 2200, monthlyPayment: 110, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2021-11-01' },
      { creditor: 'Wells Fargo Personal', balance: 1800, monthlyPayment: 300, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-02-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 2, totalBalance: 8000 },
      installment: { count: 2, totalBalance: 8200 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 52,
    installmentToRevolvingRatio: 1.03,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 76,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Pam\'s freelance graphic design income of $5,200/mo introduces verification complexity typical of self-employed applicants. Her 685 score is below the 700 preferred threshold but shows an improving trajectory — 0 late payments in the recent 12 months versus 3 in the prior period. Revolving utilization at 52% is the primary score drag and a controllable factor. Her DTI of 35% is within acceptable range. Recommend approval with 12 months of income documentation to validate stated earnings.',
  },
  aiSafetySummary: null,
};

const jim = {
  _id: 'm3',
  firstName: 'Jim',
  lastInitial: 'H',
  monthlyIncome: 6100,
  employmentType: 'salaried',
  jobTitle: 'Sales Representative',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.24,
  disposableIncome: 4360,
  ssnLast4: '3356',
  dateSubmitted: '2025-12-20T11:45:00Z',
  paymentTrajectory: { trend: 'stable', recentLateCount: 0, olderLateCount: 0, windowMonths: 24, confidence: 'high' },
  credit: {
    status: 'complete',
    score: 751,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 740,
    totalDebt: 14600,
    openTradelinesCount: 5,
    paymentHistoryPercentage: 100,
    delinquencyCount: 0,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'USAA Visa', balance: 1200, monthlyPayment: 60, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2017-05-10' },
      { creditor: 'Fed Student Loan', balance: 9800, monthlyPayment: 340, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2016-09-01' },
      { creditor: 'Honda Financial', balance: 3200, monthlyPayment: 280, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-01-15' },
      { creditor: 'Target RedCard', balance: 400, monthlyPayment: 25, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2020-06-01' },
      { creditor: 'Costco Citi Card', balance: 0, monthlyPayment: 35, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2019-03-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 1600 },
      installment: { count: 2, totalBalance: 13000 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 12,
    installmentToRevolvingRatio: 8.13,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 91,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Jim is the strongest individual profile in the group. A 751 VantageScore with zero delinquencies and 100% payment history reflects excellent financial discipline. Salaried sales employment provides stable income with commission upside potential. At 24% DTI, Jim has significant capacity headroom. Recommend unconditional approval — Jim serves as the financial anchor for the Schrute Farms group.',
  },
  aiSafetySummary: null,
};

const kevin = {
  _id: 'm4',
  firstName: 'Kevin',
  lastInitial: 'M',
  monthlyIncome: 4500,
  employmentType: 'gig',
  jobTitle: 'Part-Time Musician',
  orgStatus: 'flagged',
  orgNotes: 'Low credit score, gig income needs documentation',
  personalDTI: 0.41,
  disposableIncome: 1850,
  ssnLast4: '8902',
  dateSubmitted: '2025-12-22T16:20:00Z',
  paymentTrajectory: { trend: 'declining', recentLateCount: 4, olderLateCount: 1, windowMonths: 24, confidence: 'medium' },
  credit: {
    status: 'complete',
    score: 618,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 1150,
    totalDebt: 19800,
    openTradelinesCount: 5,
    paymentHistoryPercentage: 82,
    delinquencyCount: 5,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Credit One Bank', balance: 3800, monthlyPayment: 190, type: 'revolving', latePayments: { _30: 2, _60: 1, _90: 0 }, dateOpened: '2021-04-15' },
      { creditor: 'OneMain Financial', balance: 7200, monthlyPayment: 380, type: 'installment', latePayments: { _30: 1, _60: 0, _90: 0 }, dateOpened: '2023-02-01' },
      { creditor: 'Synchrony/PayPal', balance: 2400, monthlyPayment: 120, type: 'revolving', latePayments: { _30: 1, _60: 0, _90: 0 }, dateOpened: '2022-08-10' },
      { creditor: 'Avant Personal', balance: 4600, monthlyPayment: 290, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-01-01' },
      { creditor: 'Fingerhut', balance: 1800, monthlyPayment: 170, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-09-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 8000 },
      installment: { count: 2, totalBalance: 11800 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 68,
    installmentToRevolvingRatio: 1.48,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 65,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: false, nameMatch: true },
  },
  aiAssessment: {
    full: 'Kevin presents the highest risk profile in the group. A 618 score with 5 delinquencies and declining payment trajectory raises significant concern. His 41% DTI approaches the 43% lending wall with minimal buffer. Gig income of $4,500/mo from part-time music work lacks W-2 verification, and the 68% revolving utilization indicates credit stress. Address mismatch on identity verification needs clarification. Recommend conditional approval pending 24 months of tax returns and bank statements to verify consistent income.',
  },
  aiSafetySummary: null,
};

// ── Deal 2: Lackawanna Lofts Collective ($5,800/mo) ──

const dwight = {
  _id: 'm5',
  firstName: 'Dwight',
  lastInitial: 'S',
  monthlyIncome: 9200,
  employmentType: 'salaried',
  jobTitle: 'Asst. Regional Manager',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.22,
  disposableIncome: 6680,
  ssnLast4: '5547',
  dateSubmitted: '2026-01-05T10:00:00Z',
  paymentTrajectory: { trend: 'stable', recentLateCount: 0, olderLateCount: 0, windowMonths: 24, confidence: 'high' },
  credit: {
    status: 'complete',
    score: 758,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 1220,
    totalDebt: 22100,
    openTradelinesCount: 7,
    paymentHistoryPercentage: 99,
    delinquencyCount: 0,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Amex Platinum', balance: 3200, monthlyPayment: 160, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2018-02-01' },
      { creditor: 'Ford Financial', balance: 14200, monthlyPayment: 580, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-07-01' },
      { creditor: 'Chase Sapphire', balance: 1800, monthlyPayment: 90, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2019-11-15' },
      { creditor: 'Citi Personal Loan', balance: 2200, monthlyPayment: 280, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-03-01' },
      { creditor: 'Apple Card', balance: 700, monthlyPayment: 35, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2022-01-10' },
      { creditor: 'Costco Visa', balance: 0, monthlyPayment: 50, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2020-05-01' },
      { creditor: 'Marcus by GS', balance: 0, monthlyPayment: 25, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2021-09-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 4, totalBalance: 5700 },
      installment: { count: 3, totalBalance: 16400 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 18,
    installmentToRevolvingRatio: 2.88,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 88,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Dwight is the highest earner and strongest credit profile in the Lackawanna Lofts group. A 758 score with zero delinquencies and 99% payment history demonstrates exceptional financial management. At 22% DTI, he has the most headroom of any applicant. His installment debt is primarily a Ford auto loan with predictable paydown. Recommend unconditional approval — Dwight provides significant financial stability to the group.',
  },
  aiSafetySummary: null,
};

const angela = {
  _id: 'm6',
  firstName: 'Angela',
  lastInitial: 'M',
  monthlyIncome: 6800,
  employmentType: 'salaried',
  jobTitle: 'Senior Accountant',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.29,
  disposableIncome: 4280,
  ssnLast4: '2918',
  dateSubmitted: '2026-01-07T13:30:00Z',
  paymentTrajectory: { trend: 'stable', recentLateCount: 0, olderLateCount: 0, windowMonths: 24, confidence: 'high' },
  credit: {
    status: 'complete',
    score: 710,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 1120,
    totalDebt: 18500,
    openTradelinesCount: 5,
    paymentHistoryPercentage: 97,
    delinquencyCount: 1,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Bank of America Visa', balance: 4200, monthlyPayment: 210, type: 'revolving', latePayments: { _30: 1, _60: 0, _90: 0 }, dateOpened: '2019-04-15' },
      { creditor: 'Lexus Financial', balance: 9800, monthlyPayment: 440, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-10-01' },
      { creditor: 'Nordstrom Card', balance: 1800, monthlyPayment: 90, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2020-12-01' },
      { creditor: 'LendingClub', balance: 2200, monthlyPayment: 340, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-06-01' },
      { creditor: 'Citi Double Cash', balance: 500, monthlyPayment: 40, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2021-08-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 6500 },
      installment: { count: 2, totalBalance: 12000 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 38,
    installmentToRevolvingRatio: 1.85,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 85,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Angela shows a solid financial profile with a 710 score and stable salaried income as Senior Accountant. One 30-day late on her BoA Visa is an isolated incident from 18 months ago with no repeat. Her 29% DTI is comfortably within healthy parameters. Revolving utilization at 38% is slightly above optimal but not concerning. She complements the group well as a second salaried income source with different employer risk exposure.',
  },
  aiSafetySummary: null,
};

const oscar = {
  _id: 'm7',
  firstName: 'Oscar',
  lastInitial: 'M',
  monthlyIncome: 8100,
  employmentType: 'freelance',
  jobTitle: 'Tax Consultant',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.28,
  disposableIncome: 5280,
  ssnLast4: '6634',
  dateSubmitted: '2026-01-08T09:45:00Z',
  paymentTrajectory: { trend: 'improving', recentLateCount: 0, olderLateCount: 2, windowMonths: 24, confidence: 'medium' },
  credit: {
    status: 'complete',
    score: 695,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 1420,
    totalDebt: 31200,
    openTradelinesCount: 6,
    paymentHistoryPercentage: 93,
    delinquencyCount: 2,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Chase Freedom', balance: 6800, monthlyPayment: 340, type: 'revolving', latePayments: { _30: 1, _60: 1, _90: 0 }, dateOpened: '2018-06-01' },
      { creditor: 'Mazda Financial', balance: 11200, monthlyPayment: 450, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-03-15' },
      { creditor: 'Upstart Personal', balance: 5800, monthlyPayment: 310, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-01-01' },
      { creditor: 'Capital One Savor', balance: 3200, monthlyPayment: 160, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2020-09-01' },
      { creditor: 'Amazon Visa', balance: 2400, monthlyPayment: 120, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2021-05-01' },
      { creditor: 'Prosper Loan', balance: 1800, monthlyPayment: 40, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2022-11-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 12400 },
      installment: { count: 3, totalBalance: 18800 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 47,
    installmentToRevolvingRatio: 1.52,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 79,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Oscar\'s $8,100/mo freelance tax consulting income is the second-highest in the group. His 695 score is below the 700 line but shows clear improvement — the two delinquencies on his Chase Freedom are from 18+ months ago with clean payment since. Revolving utilization at 47% is the primary score drag. His consulting income diversifies the group away from pure W-2 salary dependence. Recommend approval with recent 1099 documentation.',
  },
  aiSafetySummary: null,
};

const phyllis = {
  _id: 'm8',
  firstName: 'Phyllis',
  lastInitial: 'V',
  monthlyIncome: 7400,
  employmentType: 'government',
  jobTitle: 'County Clerk',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.26,
  disposableIncome: 5120,
  ssnLast4: '1287',
  dateSubmitted: '2026-01-10T15:00:00Z',
  paymentTrajectory: { trend: 'stable', recentLateCount: 0, olderLateCount: 0, windowMonths: 24, confidence: 'high' },
  credit: {
    status: 'complete',
    score: 732,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 980,
    totalDebt: 15800,
    openTradelinesCount: 4,
    paymentHistoryPercentage: 98,
    delinquencyCount: 0,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Navy Federal Visa', balance: 2800, monthlyPayment: 140, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2017-03-01' },
      { creditor: 'Subaru Motors Finance', balance: 8200, monthlyPayment: 380, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-05-01' },
      { creditor: 'Fed Student Loan', balance: 4200, monthlyPayment: 420, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2015-09-01' },
      { creditor: 'PenFed Card', balance: 600, monthlyPayment: 40, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2019-07-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 2, totalBalance: 3400 },
      installment: { count: 2, totalBalance: 12400 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 22,
    installmentToRevolvingRatio: 3.65,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 94,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Phyllis\'s government employment as County Clerk and 732 score make her one of the most stable profiles in the group. Zero delinquencies, 98% payment history, and a low 26% DTI demonstrate excellent financial management. Government employment provides the highest job security in the group. Her low revolving utilization at 22% shows disciplined credit usage. Recommend unconditional approval.',
  },
  aiSafetySummary: null,
};

const ryan = {
  _id: 'm9',
  firstName: 'Ryan',
  lastInitial: 'H',
  monthlyIncome: 3900,
  employmentType: 'gig',
  jobTitle: 'WUPHF.com Founder',
  orgStatus: 'flagged',
  orgNotes: 'Eviction record requires review. Low credit score.',
  personalDTI: 0.46,
  disposableIncome: 780,
  ssnLast4: '4401',
  dateSubmitted: '2026-01-12T08:30:00Z',
  paymentTrajectory: { trend: 'declining', recentLateCount: 5, olderLateCount: 2, windowMonths: 24, confidence: 'medium' },
  credit: {
    status: 'complete',
    score: 601,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 1320,
    totalDebt: 24600,
    openTradelinesCount: 6,
    paymentHistoryPercentage: 76,
    delinquencyCount: 7,
    publicRecordsCount: 1,
    tradelines: [
      { creditor: 'Merrick Bank', balance: 4800, monthlyPayment: 240, type: 'revolving', latePayments: { _30: 3, _60: 1, _90: 1 }, dateOpened: '2020-01-15' },
      { creditor: 'Exeter Finance', balance: 9200, monthlyPayment: 460, type: 'installment', latePayments: { _30: 1, _60: 0, _90: 0 }, dateOpened: '2023-08-01' },
      { creditor: 'Indigo Card', balance: 2200, monthlyPayment: 110, type: 'revolving', latePayments: { _30: 0, _60: 1, _90: 0 }, dateOpened: '2022-04-01' },
      { creditor: 'World Finance', balance: 3800, monthlyPayment: 250, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-05-01' },
      { creditor: 'Mission Lane', balance: 3200, monthlyPayment: 160, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-11-01' },
      { creditor: 'Progressive Finance', balance: 1400, monthlyPayment: 100, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-09-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 10200 },
      installment: { count: 3, totalBalance: 14400 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 78,
    installmentToRevolvingRatio: 1.41,
  },
  criminal: {
    status: 'complete',
    records: [
      {
        offense: 'Disorderly Conduct',
        offenseType: 'misdemeanor',
        disposition: 'dismissed',
        severity: 'low',
        jurisdiction: 'Lackawanna County, PA',
        recencyLabel: '3 years ago',
        recencyCategory: 'dated',
      },
    ],
  },
  eviction: {
    status: 'complete',
    records: [
      {
        outcome: 'judgment for plaintiff',
        amount: 4800,
        severity: 'moderate',
        jurisdiction: 'Lackawanna County, PA',
        recencyLabel: '2 years ago',
        recencyCategory: 'recent',
      },
    ],
  },
  identity: {
    status: 'complete',
    cviScore: 58,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: false, nameMatch: true },
  },
  aiAssessment: {
    full: 'Ryan presents the highest risk in the Lackawanna Lofts group. A 601 score with 7 delinquencies including a 90-day late and declining payment trend signals serious financial stress. The eviction judgment of $4,800 from 2 years ago combined with a dismissed disorderly conduct charge requires full group disclosure per fair housing guidelines. At 46% DTI, Ryan already exceeds the 43% lending wall. Gig income of $3,900/mo from his startup lacks verification. His inclusion pushes the group\'s risk profile significantly higher. Recommend conditional hold pending landlord reference and 24 months of bank statements.',
  },
  aiSafetySummary: {
    summary: 'Ryan has 1 eviction judgment ($4,800, 2 years ago) and 1 dismissed misdemeanor. The eviction is the primary concern — while the criminal charge was dismissed and poses no ongoing risk, the eviction judgment indicates prior housing payment failure. Combined with current declining payment trends, this requires documented evidence of financial improvement before approval.',
  },
};

// ── Deal 3: Dunder Mifflin Commons ($3,600/mo) ──

const stanley = {
  _id: 'm10',
  firstName: 'Stanley',
  lastInitial: 'H',
  monthlyIncome: 8500,
  employmentType: 'salaried',
  jobTitle: 'Senior Sales Rep',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.19,
  disposableIncome: 6560,
  ssnLast4: '7742',
  dateSubmitted: '2026-01-20T11:00:00Z',
  paymentTrajectory: { trend: 'stable', recentLateCount: 0, olderLateCount: 0, windowMonths: 24, confidence: 'high' },
  credit: {
    status: 'complete',
    score: 780,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 840,
    totalDebt: 12200,
    openTradelinesCount: 5,
    paymentHistoryPercentage: 100,
    delinquencyCount: 0,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Amex Gold', balance: 1600, monthlyPayment: 80, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2016-03-01' },
      { creditor: 'Cadillac Financial', balance: 8200, monthlyPayment: 420, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-01-01' },
      { creditor: 'Chase Sapphire Reserve', balance: 800, monthlyPayment: 40, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2018-08-01' },
      { creditor: 'Fidelity Visa', balance: 0, monthlyPayment: 0, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2017-01-01' },
      { creditor: 'SoFi Refinance', balance: 1600, monthlyPayment: 300, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2022-06-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 2400 },
      installment: { count: 2, totalBalance: 9800 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 8,
    installmentToRevolvingRatio: 4.08,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 95,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Stanley is the strongest applicant across all three deals. A 780 VantageScore with zero delinquencies and 100% payment history over 10+ years of credit history demonstrates exemplary financial discipline. At 19% DTI, he has the lowest debt burden of any applicant. His decades of sales experience signal consistent earning power. Recommend unconditional approval — he is the ideal financial anchor.',
  },
  aiSafetySummary: null,
};

const darryl = {
  _id: 'm11',
  firstName: 'Darryl',
  lastInitial: 'P',
  monthlyIncome: 6300,
  employmentType: 'government',
  jobTitle: 'Warehouse Supervisor',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.31,
  disposableIncome: 3780,
  ssnLast4: '3390',
  dateSubmitted: '2026-01-22T14:00:00Z',
  paymentTrajectory: { trend: 'stable', recentLateCount: 1, olderLateCount: 1, windowMonths: 24, confidence: 'high' },
  credit: {
    status: 'complete',
    score: 698,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 1120,
    totalDebt: 21800,
    openTradelinesCount: 5,
    paymentHistoryPercentage: 94,
    delinquencyCount: 2,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Wells Fargo Visa', balance: 5200, monthlyPayment: 260, type: 'revolving', latePayments: { _30: 1, _60: 0, _90: 0 }, dateOpened: '2019-02-01' },
      { creditor: 'Ford Credit', balance: 11200, monthlyPayment: 440, type: 'installment', latePayments: { _30: 1, _60: 0, _90: 0 }, dateOpened: '2022-11-01' },
      { creditor: 'Home Depot Card', balance: 2400, monthlyPayment: 120, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2020-04-01' },
      { creditor: 'Discover Card', balance: 1800, monthlyPayment: 90, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2021-08-01' },
      { creditor: 'USAA Personal Loan', balance: 1200, monthlyPayment: 210, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2024-04-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 9400 },
      installment: { count: 2, totalBalance: 12400 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 42,
    installmentToRevolvingRatio: 1.32,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 87,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Darryl shows a solid mid-range profile with a 698 score — 2 points below the 700 line. Two 30-day lates across different accounts are isolated rather than clustered, which is a positive signal. Government warehouse employment with $6,300/mo provides stable income with low layoff risk. His 31% DTI is within healthy parameters. Revolving utilization at 42% is the main score drag. Recommend approval — his government income diversity complements Stanley\'s salaried income well.',
  },
  aiSafetySummary: null,
};

const creed = {
  _id: 'm12',
  firstName: 'Creed',
  lastInitial: 'B',
  monthlyIncome: 5100,
  employmentType: 'retired',
  jobTitle: 'Retired QA Director',
  orgStatus: 'approved',
  orgNotes: '',
  personalDTI: 0.21,
  disposableIncome: 3680,
  ssnLast4: '8816',
  dateSubmitted: '2026-01-25T10:30:00Z',
  paymentTrajectory: { trend: 'stable', recentLateCount: 0, olderLateCount: 0, windowMonths: 24, confidence: 'high' },
  credit: {
    status: 'complete',
    score: 745,
    scoreModel: 'VantageScore4',
    scoreSource: 'Experian',
    monthlyObligations: 620,
    totalDebt: 8400,
    openTradelinesCount: 4,
    paymentHistoryPercentage: 99,
    delinquencyCount: 0,
    publicRecordsCount: 0,
    tradelines: [
      { creditor: 'Citi Rewards', balance: 1400, monthlyPayment: 70, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2010-06-01' },
      { creditor: 'Toyota Financial', balance: 4800, monthlyPayment: 320, type: 'installment', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2023-09-01' },
      { creditor: 'Bank of America Cash', balance: 800, monthlyPayment: 40, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2012-01-01' },
      { creditor: 'AARP Card', balance: 1400, monthlyPayment: 190, type: 'revolving', latePayments: { _30: 0, _60: 0, _90: 0 }, dateOpened: '2015-03-01' },
    ],
  },
  tradelineComposition: {
    categories: {
      revolving: { count: 3, totalBalance: 3600 },
      installment: { count: 1, totalBalance: 4800 },
      mortgage: { count: 0, totalBalance: 0 },
      other: { count: 0, totalBalance: 0 },
    },
    revolvingUtilization: 15,
    installmentToRevolvingRatio: 1.33,
  },
  criminal: { status: 'complete', records: [] },
  eviction: { status: 'complete', records: [] },
  identity: {
    status: 'complete',
    cviScore: 92,
    matchDetails: { ssnMatch: true, dobMatch: true, addressMatch: true, nameMatch: true },
  },
  aiAssessment: {
    full: 'Creed\'s retired QA Director income of $5,100/mo (pension + Social Security) is the most predictable income stream in any group — it\'s guaranteed regardless of economic conditions. A 745 score with zero delinquencies and 15+ years of credit history demonstrates decades of responsible financial management. At 21% DTI, he has excellent capacity. Recommend unconditional approval — his pension income provides a recession-proof floor for the group.',
  },
  aiSafetySummary: null,
};

// ── Exports ──

const ALL_MEMBERS = { m1: michael, m2: pam, m3: jim, m4: kevin, m5: dwight, m6: angela, m7: oscar, m8: phyllis, m9: ryan, m10: stanley, m11: darryl, m12: creed };

export const DEAL1_MEMBER_IDS = ['m1', 'm2', 'm3', 'm4'];
export const DEAL2_MEMBER_IDS = ['m5', 'm6', 'm7', 'm8', 'm9'];
export const DEAL3_MEMBER_IDS = ['m10', 'm11', 'm12'];

export function getMemberDetail(id) {
  const m = ALL_MEMBERS[id];
  if (!m) return null;
  return JSON.parse(JSON.stringify(m));
}

export function getMemberSummaries(ids) {
  return ids.map((id) => makeSummary(ALL_MEMBERS[id])).filter(Boolean);
}

export function getMemberSafetyData(ids) {
  return ids.map((id) => makeSafety(ALL_MEMBERS[id])).filter(Boolean);
}

export function getAllMembers() {
  return { ...ALL_MEMBERS };
}
