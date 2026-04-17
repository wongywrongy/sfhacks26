// Pre-written underwriter narratives.
// Voice: lead with the number, use lending-industry vocabulary
// (front-end ratio, residual, aggregate, concentration, trajectory),
// end with threshold tie-back or recommended action.

// ── Dashboard-level portfolio insights ──────────────────────────────

export const PORTFOLIO_INSIGHTS = {
  whatsNew:
    "Screening completed overnight for the Dunder Mifflin Commons household; aggregate DTI landed at 30.9%, within front-end guideline. The Lackawanna Lofts Collective advanced to Review yesterday with one applicant pending individualized-assessment decision. Schrute Farms Group continues intake at 3 of 4 co-applicants cleared; Kevin M.'s 1099 earnings remain pending verification.",

  whatsNeeded:
    "Lackawanna Lofts Collective: status decision required on Ryan H. (eviction judgment, 2 years recency). Held 2 days. · Schrute Farms Group: income verification pending for Kevin M.'s 1099 earnings; blocks advancement to Review. · Dunder Mifflin Commons: allocation addendum unsigned; tenants awaiting lease execution.",
};

// ── Per-project analytics AI insights ───────────────────────────────
// Keys: p1 Schrute Farms, p2 Lackawanna Lofts, p3 Dunder Mifflin Commons

export const ANALYTICS_INSIGHTS = {
  p1: {
    overview:
      "Aggregate gross monthly income of $23,600 against a $4,200 housing cost produces a 35.0% front-end ratio, 1.0 point inside the 36% GSE conforming threshold. Kevin M.'s $4,500/mo 1099 income contributes 19% of household revenue but remains unverified. Excluding Kevin brings front-end to 31.2%, comfortably conforming, but reduces supportable housing payment by approximately $67,000 of buying power.",
    affordability:
      "The $4,200/mo housing burden represents 17.8% of aggregate income, below the 30% HUD affordability benchmark. Under equal allocation, Kevin's personal share reaches 23.3% of his monthly income and pushes his individual obligation ratio to 41%, within the QM corridor but above his peers. Consider pro-rata allocation to distribute the burden proportionally.",
    incomeDiversity:
      "Four employment types across four co-applicants (salaried, freelance, salaried, gig) yields a 0.75 concentration score. Jim's commissioned sales earnings are counter-cyclical to Michael's management salary, providing partial recession resilience. Kevin's gig income is the most volatile component and represents the single point of stress under a downturn scenario.",
    dependencies:
      "Michael is the critical dependency. His departure lifts front-end ratio from 35.0% to 44.1%, breaching the 43% QM lending wall. Jim is the second dependency at 41.8% post-departure. The household has no single-member resilience: the loss of any top earner triggers a threshold breach. Recommend requiring a guarantor before lease execution or excluding Kevin to create margin.",
  },
  p2: {
    overview:
      "Aggregate gross monthly income of $35,400 against $5,800 housing cost produces a 33.8% front-end ratio, 2.2 points inside the 36% GSE conforming threshold. Residual income of $29,320/mo provides 5.1× housing coverage, the strongest coverage ratio across active deals. No single member contributes more than 26% of household income, indicating healthy income distribution. One applicant (Ryan H.) remains under individualized assessment.",
    affordability:
      "The $5,800/mo housing burden represents 16.4% of aggregate income, the lowest burden ratio across active deals. All applicants remain below the 30% HUD threshold under pro-rata allocation. Under equal allocation, Ryan's personal share reaches 29.7% of his monthly income, inside but close to the HUD line. Pro-rata is the recommended method for this household.",
    incomeDiversity:
      "Four employment sectors across five co-applicants (salaried ×2, freelance, government, 1099) yields a 0.80 concentration score. Dual salaried incomes from distinct employers (management, accounting) reduce employer-correlation risk. Phyllis's County Clerk position provides the household's stability anchor. Government wages are the least cyclical component available. Household remains above the 36% front-end conforming threshold under the loss of any one co-applicant.",
    dependencies:
      "Dwight is the primary dependency. His departure lifts front-end ratio from 33.8% to 40.1%, still inside the 43% QM wall but above the 36% conforming threshold. Excluding Ryan has the opposite effect: front-end improves to 30.2%, indicating Ryan's inclusion is net-risk-accretive to household qualification. Recommended action: obtain documented financial improvement trajectory for Ryan before lease execution, or approve the 4-member configuration on pro-rata allocation.",
  },
  p3: {
    overview:
      "Aggregate gross monthly income of $19,900 against $3,600 housing cost produces a 30.9% front-end ratio, the strongest qualification profile across active deals, with 5.1 points of margin to the 36% conforming threshold. Residual income of $16,020/mo provides 4.5× housing coverage. All three co-applicants pass individualized background and credit review.",
    affordability:
      "The $3,600/mo housing burden represents 18.1% of aggregate income, materially below the 30% HUD threshold. Under pro-rata allocation, each applicant contributes 18.1% of individual income (Stanley $1,538, Darryl $1,139, Creed $923), with meaningful residual capacity at every tier. VA minimum residual ($1,003 for a family of 4) is met under all three allocation models.",
    incomeDiversity:
      "Three distinct employment types across three co-applicants (salaried, government, pension) yield a 1.0 concentration score, the maximum diversification observable. Government wages and pension payments are the two lowest-cyclicality income sources available; Stanley's commissioned sales income has historically low sector cyclicality. Household remains above the 36% front-end conforming threshold under the loss of any one co-applicant.",
    dependencies:
      "Stanley is the primary dependency. His departure lifts front-end ratio from 30.9% to 38.3%, above the 36% conforming threshold but 4.7 points inside the 43% QM lending wall. Departures by Darryl or Creed individually keep front-end below 36%. This household has genuine single-member resilience and can absorb the loss of any one co-applicant while remaining inside lending parameters. Recommended: approve at standard lease terms.",
  },
};

// ── Per-project contribution-model recommendations ──────────────────

export const CONTRIBUTION_INSIGHTS = {
  p1: {
    distribution: null,
    affordability: null,
    recommendation:
      "Recommended: Hybrid (50/50 equal and pro-rata). The $1,600/mo income spread between Jim ($6,100) and Kevin ($4,500) makes equal allocation unfair: Kevin's total obligation ratio reaches 64.1% under equal, above the 43% QM wall. Hybrid brings him to 55.8%, still outside QM but 8.3 points lower. Michael and Jim absorb the incremental cost with front-ends of 32% and 24% respectively. A co-signer or reduced allocation for Kevin is advisable.",
  },
  p2: {
    distribution: null,
    affordability: null,
    recommendation:
      "Recommended: Pro-rata (income-weighted). The $5,300/mo income spread between Dwight ($9,200) and Ryan ($3,900) makes equal allocation structurally unfair: Ryan pays 29.7% of income under equal while Dwight pays 12.6%. Pro-rata keeps all total obligation ratios within 2 percentage points. If Ryan is excluded following individualized assessment, the remaining 4 applicants qualify under any model with all front-ends below 30%.",
  },
  p3: {
    distribution: null,
    affordability: null,
    recommendation:
      "Any allocation model qualifies the household. The tight $3,400 income spread ($5,100 to $8,500) produces a maximum $205/month per-person variance between equal and pro-rata. Hybrid is the operator-default because it minimizes maximum housing burden across applicants (highest burden: 20.8%, all residuals positive). All co-applicants remain below 25% total obligation ratio under every model, an uncommon and healthy position.",
  },
};

// ── Post-departure resilience recommendations ───────────────────────
// Returned by the Risk Analysis simulation when a member is unchecked.

export const RESILIENCE_RECOMMENDATIONS = {
  p1: {
    m1: "Remaining qualified income: $19,100/mo. Recommended action: require co-signer or replacement co-applicant. Front-end breaches 43% QM wall without Michael.",
    m2: "Remaining qualified income: $17,500/mo. Recommended action: require co-signer or replacement co-applicant. Front-end above 40% without Jim.",
    m3: "Remaining qualified income: $16,400/mo. Recommended action: acceptable with margin; no replacement required.",
    m4: "Remaining qualified income: $19,100/mo. Recommended action: acceptable with margin; no replacement required.",
  },
  p2: {
    m5: "Remaining qualified income: $26,200/mo. Recommended action: acceptable but outside conforming; consider renegotiation or additional deposit.",
    m6: "Remaining qualified income: $28,600/mo. Recommended action: acceptable with margin; no replacement required.",
    m7: "Remaining qualified income: $27,300/mo. Recommended action: acceptable with margin; no replacement required.",
    m8: "Remaining qualified income: $28,000/mo. Recommended action: acceptable with margin; no replacement required.",
    m9: "Remaining qualified income: $31,500/mo. Recommended action: acceptable with margin; household materially improves without Ryan.",
  },
  p3: {
    m10: "Remaining qualified income: $11,400/mo. Recommended action: acceptable inside QM; front-end above conforming but no replacement required.",
    m11: "Remaining qualified income: $13,600/mo. Recommended action: acceptable with margin; no replacement required.",
    m12: "Remaining qualified income: $14,800/mo. Recommended action: acceptable with margin; no replacement required.",
  },
};

// ── Allocation recommendations (appears in Breakdown tab "Recommended" row) ─

export const ALLOCATION_RECOMMENDATIONS = {
  p1: "Hybrid (50/50). Minimizes maximum obligation ratio across applicants while preserving contribution equity. Kevin's total obligation ratio remains elevated regardless; guarantor or reduced-allocation lease term advisable.",
  p2: "Pro-rata (income-weighted). Keeps all total obligation ratios within 2 percentage points of each other and avoids concentrating burden on the lowest-income co-applicant.",
  p3: "Hybrid (50/50). Minimizes maximum housing burden across applicants (highest burden: 20.8%). Any model qualifies; hybrid is the operator default for fairness.",
};

// ── Compliance disclaimer (Safety tab) ──────────────────────────────

export const SAFETY_DISCLAIMER =
  "Fair housing notice. Criminal and eviction records require individualized assessment per HUD 2016 guidance: consider nature, recency, severity, and rehabilitation evidence. Blanket rejections based on criminal history may constitute disparate-impact discrimination under the Fair Housing Act. All data here is informational and does not constitute a screening decision.";
