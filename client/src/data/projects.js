import { getMemberSummaries, DEAL1_MEMBER_IDS, DEAL2_MEMBER_IDS, DEAL3_MEMBER_IDS } from './members.js';

function buildProject(id, name, location, priceRange, monthlyCost, stage, memberIds, extras = {}) {
  return {
    _id: id,
    name,
    location,
    priceRange,
    estimatedMonthlyCost: monthlyCost,
    stage,
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
        createdAt: '2025-12-15T09:00:00Z',
        lastActivity: '2026-01-28T14:30:00Z',
        groupAssessment: {
          overview: 'The Schrute Farms group of 4 presents a mixed but workable profile. Three members (Michael, Pam, Jim) demonstrate solid financial capacity with credit scores above 680 and stable employment. Kevin\'s 618 score and gig income introduce risk that the group\'s combined strength can absorb. Combined monthly income of $23,600 against $4,200 housing cost gives the group a comfortable 35.0% DTI. Jim\'s salaried position and Michael\'s management income anchor the base, while Pam\'s freelance design income adds diversity. Recommend proceeding with conditional approval for Kevin pending income verification.',
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
        createdAt: '2026-01-05T10:00:00Z',
        lastActivity: '2026-02-10T09:15:00Z',
        groupAssessment: {
          overview: 'The Lackawanna Lofts Collective of 5 is a strong group with one significant outlier. Dwight, Angela, Phyllis, and Oscar form a solid core with combined income of $31,500/mo and scores ranging 695-758. Ryan\'s inclusion is the critical decision: his 601 score, eviction history, and 46% personal DTI represent genuine risk. Without Ryan, the group DTI drops to a healthy 30.2% with $24,060 combined breathing room. With Ryan, it rises to 33.8% but remains within acceptable parameters. The group should discuss whether Ryan\'s inclusion aligns with their risk tolerance.',
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
          overview: 'One member (Ryan H.) has background records requiring review. Ryan has 1 eviction judgment ($4,800, Lackawanna County, 2 years ago) and 1 dismissed misdemeanor (disorderly conduct, Lackawanna County, 3 years ago). The dismissed criminal charge poses no ongoing risk. The eviction judgment combined with current declining payment trends and 46% DTI is the primary concern. All other members have clean backgrounds with verified identities. Under fair housing guidelines, the eviction alone cannot be grounds for blanket denial — the group should evaluate Ryan\'s current financial trajectory and documented income improvement before making a final determination.',
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
        createdAt: '2026-01-20T11:00:00Z',
        lastActivity: '2026-02-14T16:45:00Z',
        groupAssessment: {
          overview: 'The Dunder Mifflin Commons group of 3 is the strongest across all active deals. Combined monthly income of $19,900 against $3,600 housing cost yields an excellent 30.9% group DTI well within healthy parameters. Stanley\'s 780 score and $8,500/mo salaried income provides an exceptional anchor. Darryl\'s government employment and Creed\'s pension income create a nearly recession-proof income mix — government wages and pension payments are the two most stable income sources available. Income diversity score of 1.0 (perfect) reflects three distinct employment types with zero correlation risk. This group is ready for final approval.',
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
