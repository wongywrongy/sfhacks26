import { getMemberSummaries, DEAL1_MEMBER_IDS, DEAL2_MEMBER_IDS, DEAL3_MEMBER_IDS } from './members.js';

function buildProject(id, name, location, priceRange, monthlyCost, stage, memberIds, extras = {}) {
  return {
    _id: id,
    name,
    location,
    priceRange,
    estimatedMonthlyCost: monthlyCost,
    stage,
    referenceCode: extras.referenceCode || null,
    bedBath: extras.bedBath || null,
    stageHistory: extras.stageHistory || null,
    intakeLinkToken: `demo-intake-${id}`,
    members: getMemberSummaries(memberIds),
    groupAssessment: extras.groupAssessment || null,
    groupMetrics: extras.groupMetrics || null,
    groupTradelineComposition: extras.groupTradelineComposition || null,
    aiSafetyOverview: extras.aiSafetyOverview || null,
    modelAnalysis: extras.modelAnalysis || null,
    customContributionModel: extras.customContributionModel || null,
    createdAt: extras.createdAt || new Date().toISOString(),
    lastActivity: extras.lastActivity || new Date().toISOString(),
  };
}

export function getInitialProjects() {
  return [
    buildProject(
      'p1',
      'Schrute Farms Group',
      { city: 'Scranton', state: 'PA' },
      { low: 650000, high: 820000 },
      4200,
      'in_progress',
      DEAL1_MEMBER_IDS,
      {
        referenceCode: 'SPG-1725-A',
        bedBath: '3BR / 2BA',
        stageHistory: [
          { stage: 'empty', enteredAt: '2025-12-15' },
          { stage: 'in_progress', enteredAt: '2026-01-03' },
        ],
        createdAt: '2025-12-15T09:00:00Z',
        lastActivity: '2026-01-28T14:30:00Z',
        groupAssessment: {
          overview:
            "The Schrute Farms household of 4 presents a workable profile with one verification gap. Aggregate gross monthly income of $23,600 against $4,200 housing cost produces a 35.0% front-end ratio, 1.0 point inside the 36% GSE conforming threshold. Michael, Pam, and Jim demonstrate stable employment and credit scores above 680. Kevin's 618 score and 1099 gig earnings introduce verification and volatility risk the household's combined strength can partially absorb. Recommended action: proceed with conditional approval for Kevin pending 1099 income documentation, or obtain a guarantor to preserve QM compliance in departure scenarios.",
        },
        groupTradelineComposition: {
          aggregateByType: {
            revolving: { count: 11, totalBalance: 24500 },
            installment: { count: 9, totalBalance: 54500 },
            mortgage: { count: 0, totalBalance: 0 },
            other: { count: 0, totalBalance: 0 },
          },
          totalGroupBalance: 79000,
          dominantGroupDebtType: 'installment',
          dominantPct: 69,
          debtConcentrationRisk: 'moderate',
          revolvingHeavyCount: 2,
          memberCount: 4,
          computedAt: new Date().toISOString(),
        },
        aiSafetyOverview: null,
      },
    ),
    buildProject(
      'p2',
      'Lackawanna Lofts Collective',
      { city: 'Scranton', state: 'PA' },
      { low: 880000, high: 1100000 },
      5800,
      'review',
      DEAL2_MEMBER_IDS,
      {
        referenceCode: 'SPG-0300-A',
        bedBath: '4BR / 2BA · Loft',
        stageHistory: [
          { stage: 'empty', enteredAt: '2026-01-05' },
          { stage: 'in_progress', enteredAt: '2026-01-12' },
          { stage: 'review', enteredAt: '2026-02-08' },
        ],
        createdAt: '2026-01-05T10:00:00Z',
        lastActivity: '2026-02-10T09:15:00Z',
        groupAssessment: {
          overview:
            "The Lackawanna Lofts Collective of 5 presents a qualified core with one applicant pending individualized assessment. Aggregate gross monthly income of $35,400 against $5,800 housing cost produces a 33.8% front-end ratio, 2.2 points inside the 36% GSE conforming threshold and 9.2 points inside the 43% QM lending wall. Dwight, Angela, Phyllis, and Oscar combine for $31,500/mo and scores 695–758; Ryan's 601 score, eviction judgment (2 yr recency), and 46% personal DTI represent the decision item. Without Ryan the household front-end drops to 30.2% with $24,060/mo residual. Recommended action: HUD-aligned individualized assessment of Ryan's current financial trajectory and documented income improvement before lease execution.",
        },
        groupTradelineComposition: {
          aggregateByType: {
            revolving: { count: 15, totalBalance: 38200 },
            installment: { count: 14, totalBalance: 74000 },
            mortgage: { count: 0, totalBalance: 0 },
            other: { count: 0, totalBalance: 0 },
          },
          totalGroupBalance: 112200,
          dominantGroupDebtType: 'installment',
          dominantPct: 66,
          debtConcentrationRisk: 'moderate',
          revolvingHeavyCount: 2,
          memberCount: 5,
          computedAt: new Date().toISOString(),
        },
        aiSafetyOverview: {
          overview:
            "One co-applicant (Ryan H.) presents background records requiring individualized assessment under HUD 2016 guidance. Ryan has 1 eviction judgment ($4,800, Lackawanna County, 2 yr recency) and 1 dismissed misdemeanor (disorderly conduct, 3 yr recency). The dismissed charge poses no ongoing risk; the eviction judgment, combined with a declining payment-history trend and 46% personal DTI, is the primary concern. All other co-applicants show clean backgrounds with verified identities. The Fair Housing Act and Fair Credit Reporting Act require assessment of nature, recency, severity, and rehabilitation evidence before adverse action. Recommended action: obtain documented financial improvement trajectory for Ryan (most recent 6 months) before lease execution, or approve the 4-member configuration on pro-rata allocation.",
        },
      },
    ),
    buildProject(
      'p3',
      'Dunder Mifflin Commons',
      { city: 'Scranton', state: 'PA' },
      { low: 520000, high: 680000 },
      3600,
      'approved',
      DEAL3_MEMBER_IDS,
      {
        referenceCode: 'SPG-1725-04B',
        bedBath: '2BR / 1BA',
        stageHistory: [
          { stage: 'empty', enteredAt: '2026-01-20' },
          { stage: 'in_progress', enteredAt: '2026-01-22' },
          { stage: 'review', enteredAt: '2026-02-05' },
          { stage: 'approved', enteredAt: '2026-02-14' },
        ],
        createdAt: '2026-01-20T11:00:00Z',
        lastActivity: '2026-02-14T16:45:00Z',
        groupAssessment: {
          overview:
            "The Dunder Mifflin Commons household of 3 presents the strongest qualification profile across active deals. Aggregate gross monthly income of $19,900 against $3,600 housing cost produces a 30.9% front-end ratio, 5.1 points inside the 36% GSE conforming threshold. Residual income of $16,020/mo provides 4.5× housing coverage. Stanley's 780 score and $8,500/mo salaried income anchor the base; Darryl's government wages and Creed's pension provide the two lowest-cyclicality income sources available, yielding a 1.0 concentration score (maximum diversification). Recommended action: approve at standard lease terms on hybrid allocation; no guarantor required.",
        },
        groupTradelineComposition: {
          aggregateByType: {
            revolving: { count: 9, totalBalance: 15400 },
            installment: { count: 5, totalBalance: 27000 },
            mortgage: { count: 0, totalBalance: 0 },
            other: { count: 0, totalBalance: 0 },
          },
          totalGroupBalance: 42400,
          dominantGroupDebtType: 'installment',
          dominantPct: 64,
          debtConcentrationRisk: 'low',
          revolvingHeavyCount: 0,
          memberCount: 3,
          computedAt: new Date().toISOString(),
        },
        aiSafetyOverview: null,
      },
    ),
  ];
}

export const PROJECT_IDS = ['p1', 'p2', 'p3'];
