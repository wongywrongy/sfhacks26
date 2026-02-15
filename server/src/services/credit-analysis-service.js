/**
 * Pure computation functions for credit analysis.
 * Derives payment trajectory and tradeline composition from existing CRS data.
 * No new API calls — all data comes from Experian tradelines already pulled.
 */

/**
 * Compute payment trajectory (improving/stable/declining) from tradeline data.
 * Uses fallback logic since sandbox won't have month-by-month payment history.
 */
function computePaymentTrajectory(tradelines, delinquencyCount) {
  if (!Array.isArray(tradelines) || tradelines.length === 0) {
    return {
      trend: 'stable',
      confidence: 'low',
      recentLateCount: 0,
      olderLateCount: 0,
      trendScore: 0,
      windowMonths: 24,
      computedAt: new Date(),
    };
  }

  // Count tradelines with delinquent status as "recent" delinquencies
  const delinquentStatuses = ['collections', 'chargeoff', 'charge-off', 'delinquent', 'late', 'past due'];
  let recentLateCount = 0;
  for (const t of tradelines) {
    const status = (t.status || '').toLowerCase();
    if (delinquentStatuses.some((s) => status.includes(s))) {
      recentLateCount++;
    }
  }

  // Older late count from credit summary delinquencyCount
  const olderLateCount = Math.max(0, (delinquencyCount || 0) - recentLateCount);
  const totalLateCount = recentLateCount + olderLateCount;

  // Trend score: positive = improving (older > recent), negative = declining
  const trendScore = (totalLateCount > 0)
    ? ((olderLateCount - recentLateCount) / Math.max(totalLateCount, 1)) * 100
    : 0;

  // Classification
  let trend;
  if (trendScore > 25) {
    trend = 'improving';
  } else if (trendScore < -25) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  // Estimate window from tradeline dateOpened ages if available, else default 24
  let windowMonths = 24;
  const ages = tradelines
    .filter((t) => t.dateOpened)
    .map((t) => {
      const opened = new Date(t.dateOpened);
      const now = new Date();
      return Math.round((now - opened) / (30 * 24 * 60 * 60 * 1000));
    })
    .filter((a) => a > 0);
  if (ages.length > 0) {
    windowMonths = Math.max(6, Math.round(ages.reduce((s, a) => s + a, 0) / ages.length));
  }

  return {
    trend,
    confidence: 'low', // always low in fallback mode (no month-by-month data from sandbox)
    recentLateCount,
    olderLateCount,
    trendScore: Math.round(trendScore * 100) / 100,
    windowMonths,
    computedAt: new Date(),
  };
}

/**
 * Compute tradeline composition breakdown by category.
 */
function computeTradelineComposition(tradelines) {
  if (!Array.isArray(tradelines) || tradelines.length === 0) {
    return {
      categories: {
        revolving: { count: 0, totalBalance: 0, totalCreditLimit: 0, utilization: null, monthlyPayment: 0, onTimePercent: null, avgAge: null },
        installment: { count: 0, totalBalance: 0, totalCreditLimit: 0, utilization: null, monthlyPayment: 0, onTimePercent: null, avgAge: null },
        mortgage: { count: 0, totalBalance: 0, totalCreditLimit: 0, utilization: null, monthlyPayment: 0, onTimePercent: null, avgAge: null },
        other: { count: 0, totalBalance: 0, totalCreditLimit: 0, utilization: null, monthlyPayment: 0, onTimePercent: null, avgAge: null },
      },
      dominantType: null,
      revolvingUtilization: null,
      installmentToRevolvingRatio: null,
      computedAt: new Date(),
    };
  }

  // Account type mapping
  const revolvingTypes = ['credit card', 'retail card', 'line of credit', 'heloc'];
  const installmentTypes = ['auto loan', 'student loan', 'personal loan', 'installment loan'];
  const mortgageTypes = ['mortgage', 'home equity'];

  function classifyType(typeStr) {
    const t = (typeStr || '').toLowerCase();
    if (revolvingTypes.some((r) => t.includes(r))) return 'revolving';
    if (installmentTypes.some((r) => t.includes(r))) return 'installment';
    if (mortgageTypes.some((r) => t.includes(r))) return 'mortgage';
    return 'other';
  }

  const buckets = { revolving: [], installment: [], mortgage: [], other: [] };
  for (const t of tradelines) {
    const cat = classifyType(t.type);
    buckets[cat].push(t);
  }

  const categories = {};
  for (const [cat, items] of Object.entries(buckets)) {
    const count = items.length;
    const totalBalance = items.reduce((s, t) => s + (t.balance || 0), 0);
    const monthlyPayment = items.reduce((s, t) => s + (t.monthlyPayment || 0), 0);

    // Credit limit: use limit field if available, else estimate balance * 3 for revolving
    let totalCreditLimit = 0;
    if (cat === 'revolving') {
      totalCreditLimit = items.reduce((s, t) => s + (t.creditLimit || (t.balance || 0) * 3), 0);
    }

    // Utilization: revolving only
    let utilization = null;
    if (cat === 'revolving' && totalCreditLimit > 0) {
      utilization = Math.round((totalBalance / totalCreditLimit) * 10000) / 100;
    }

    // Average age from dateOpened
    let avgAge = null;
    const ages = items
      .filter((t) => t.dateOpened)
      .map((t) => {
        const opened = new Date(t.dateOpened);
        const now = new Date();
        return Math.round((now - opened) / (30 * 24 * 60 * 60 * 1000));
      })
      .filter((a) => a > 0);
    if (ages.length > 0) {
      avgAge = Math.round(ages.reduce((s, a) => s + a, 0) / ages.length);
    }

    // On-time percent (if tradeline-level data available)
    let onTimePercent = null;
    const onTimeData = items.filter((t) => t.paymentHistoryPercentage != null);
    if (onTimeData.length > 0) {
      onTimePercent = Math.round(onTimeData.reduce((s, t) => s + t.paymentHistoryPercentage, 0) / onTimeData.length);
    }

    categories[cat] = { count, totalBalance, totalCreditLimit, utilization, monthlyPayment, onTimePercent, avgAge };
  }

  // Top-level summaries
  const balances = Object.entries(categories).filter(([, v]) => v.totalBalance > 0);
  const dominantType = balances.length > 0
    ? balances.sort((a, b) => b[1].totalBalance - a[1].totalBalance)[0][0]
    : null;

  const revolvingUtilization = categories.revolving.utilization;

  const revBal = categories.revolving.totalBalance;
  const instBal = categories.installment.totalBalance;
  const installmentToRevolvingRatio = revBal > 0
    ? Math.round((instBal / revBal) * 100) / 100
    : instBal > 0 ? null : 0;

  return {
    categories,
    dominantType,
    revolvingUtilization,
    installmentToRevolvingRatio,
    computedAt: new Date(),
  };
}

module.exports = { computePaymentTrajectory, computeTradelineComposition };
