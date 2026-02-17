// Pre-written AI insights for various contexts

// Dashboard-level portfolio insights
export const PORTFOLIO_INSIGHTS = {
  whatsNew: 'Dunder Mifflin Commons moved to approved status with all 3 members cleared. Lackawanna Lofts Collective entered review with 5 applicants screened, 1 flagged for eviction history. Schrute Farms Group continues intake with 3 of 4 members approved.',
  whatsNeeded: 'Lackawanna Lofts Collective requires review decision on Ryan H.\'s eviction record and flagged status before group can advance. Schrute Farms needs income verification for Kevin M.\'s gig earnings.',
};

// Per-project analytics AI insights (keyed by project ID)
export const ANALYTICS_INSIGHTS = {
  p1: {
    overview: 'The group\'s combined $23,600/mo income supports a 35.0% DTI that sits just below the 36% healthy threshold — there\'s minimal margin before entering the caution zone. Kevin\'s $4,500/mo gig income accounts for 19% of group income but carries verification risk. Removing Kevin pushes DTI down to 31.2% and breathing room up by $2,700/mo, but reduces buying power by $67,000.',
    affordability: 'At $4,200/mo housing cost, the group allocates 17.8% of combined income to housing — well within the 30% HUD affordability guideline. However, Kevin individually would contribute 23.3% of his income under equal split, approaching his personal affordability limit given his 41% DTI.',
    incomeDiversity: 'Three employment types across four members (salaried, freelance, salaried, gig) yields a 0.75 diversity score. Jim\'s sales income is counter-cyclical to Michael\'s management salary, providing some resilience. Kevin\'s gig income is the most volatile component.',
    dependencies: 'Michael is the critical dependency — removing him pushes group DTI from 35.0% to 44.1%, breaching the 43% lending wall. Jim is the second dependency at 41.8% DTI without him. The group has no single-member resilience — losing any top earner triggers a DTI breach.',
  },
  p2: {
    overview: 'Combined income of $35,400/mo against $5,800/mo housing gives this 5-person group a comfortable 33.8% DTI. The group is the largest and highest-earning across all deals, with $29,320/mo in combined breathing room. Dwight\'s $9,200/mo anchors the income base at 26% of group total, but no single member exceeds 30% — indicating healthy income distribution.',
    affordability: 'The $5,800/mo housing cost represents 16.4% of combined income — the lowest housing ratio across all deals. All members stay below the 30% HUD threshold under proportional split. Under equal split, Ryan\'s personal allocation hits 29.7% of income, close to the line but still technically passing.',
    incomeDiversity: 'Four employment types across five members (salaried x2, freelance, government, gig) yields an 0.80 diversity score. The dual salaried incomes from different roles (management + accounting) diversify employer risk. Phyllis\'s government position as County Clerk is the stability anchor.',
    dependencies: 'Dwight is a critical dependency — removing him pushes DTI from 33.8% to 40.1%. Removing Ryan has the opposite effect: DTI improves to 30.2% without him, suggesting his inclusion is a net risk rather than a net benefit to group financials.',
  },
  p3: {
    overview: 'Combined income of $19,900/mo against $3,600/mo housing gives this compact 3-person group an excellent 30.9% group DTI — the healthiest ratio across all deals. The group\'s $16,020/mo combined breathing room provides a substantial buffer equal to 4.5x the monthly housing cost.',
    affordability: 'The $3,600/mo housing cost represents just 18.1% of combined income — exceptional by any standard. Under proportional allocation, Stanley pays $1,538 (18.1% of his income), Darryl pays $1,139 (18.1%), and Creed pays $923 (18.1%). All are comfortably below the 30% threshold with significant margin.',
    incomeDiversity: 'A perfect 1.0 diversity score with three distinct employment types: salaried (Stanley), government (Darryl), and retired/pension (Creed). This is the most recession-proof income mix possible — pension and government wages are nearly immune to economic downturns, while Stanley\'s salaried sales income has historically low cyclicality.',
    dependencies: 'Stanley is the most significant dependency — removing him pushes DTI from 30.9% to 38.3%, still within acceptable range. Removing Darryl or Creed individually keeps DTI below 36%. This group has genuine single-member resilience — it can absorb the loss of any one member and remain within lending parameters.',
  },
};

// Per-project contribution model AI analysis (keyed by project ID)
export const CONTRIBUTION_INSIGHTS = {
  p1: {
    distribution: null,
    affordability: null,
    recommendation: 'For the Schrute Farms group, the Balanced (hybrid) model is recommended. It acknowledges the income disparity between Jim ($6,100) and Kevin ($4,500) while maintaining shared responsibility. Under equal split, Kevin\'s total obligation ratio hits 64.1% — well past the 43% wall. The balanced model brings him to 55.8%, still high but 8.3 points lower. Michael and Jim can absorb the incremental cost with minimal impact to their 32% and 24% DTIs respectively.',
  },
  p2: {
    distribution: null,
    affordability: null,
    recommendation: 'For Lackawanna Lofts, the Income-Based (proportional) model is strongly recommended. The $5,300/mo income gap between Dwight ($9,200) and Ryan ($3,900) makes equal split fundamentally unfair — Ryan would pay 29.7% of income while Dwight pays only 12.6%. Proportional allocation keeps all total obligation ratios within 2 percentage points of each other. If Ryan is excluded, the remaining 4 members can comfortably switch to any model, as all have DTIs below 30%.',
  },
  p3: {
    distribution: null,
    affordability: null,
    recommendation: 'Any model works well for Dunder Mifflin Commons. The tight income range ($5,100 to $8,500) means the spread between equal and proportional is only $205/person/month. The balanced model is the default recommendation as it maintains fairness across the board. All members remain below 25% total obligation ratio under every model — a rare and healthy position.',
  },
};

// Safety disclaimer text
export const SAFETY_DISCLAIMER = 'Background screening data is provided for informational purposes and should be evaluated in compliance with all applicable fair housing laws, the Fair Credit Reporting Act (FCRA), and state/local regulations. Adverse action based solely on criminal history may violate HUD guidance. All records should be individually assessed for relevance, recency, and rehabilitation evidence.';
