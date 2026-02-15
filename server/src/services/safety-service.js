/**
 * Processes raw CRS criminal/eviction/identity responses into structured records
 * with severity computation. No new API calls — uses data already pulled.
 */

// --- Severity matrices ---

// Criminal: disposition x offenseType
const CRIMINAL_SEVERITY = {
  convicted: { felony: 'elevated', misdemeanor: 'moderate', infraction: 'low' },
  pending: { felony: 'elevated', misdemeanor: 'moderate', infraction: 'low' },
  dismissed: { felony: 'low', misdemeanor: 'low', infraction: 'low' },
  acquitted: { felony: 'low', misdemeanor: 'low', infraction: 'low' },
  expunged: { felony: 'low', misdemeanor: 'low', infraction: 'low' },
  deferred: { felony: 'low', misdemeanor: 'low', infraction: 'low' },
};

// Eviction severity by outcome
const EVICTION_SEVERITY = {
  'judgment for plaintiff': 'elevated',
  'judgment': 'elevated',
  'settled': 'moderate',
  'pending': 'moderate',
  'dismissed': 'low',
  'withdrawn': 'low',
};

const SEVERITY_ORDER = { none: 0, low: 1, moderate: 2, elevated: 3 };

function maxSeverity(a, b) {
  return (SEVERITY_ORDER[a] || 0) >= (SEVERITY_ORDER[b] || 0) ? a : b;
}

/**
 * Compute recency category from a date.
 */
function recencyCategory(dateStr) {
  if (!dateStr) return 'unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const years = (now - date) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 2) return 'recent';
  if (years <= 7) return 'moderate';
  return 'historical';
}

/**
 * Human-readable recency label.
 */
function recencyLabel(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const years = Math.floor((now - date) / (365.25 * 24 * 60 * 60 * 1000));
  if (years === 0) return 'less than 1 year ago';
  if (years === 1) return '1 year ago';
  return `${years} years ago`;
}

/**
 * Structure raw criminal records from CRS into normalized records with severity.
 */
function structureCriminalRecords(rawRecords) {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return {
      records: [],
      summary: {
        totalRecords: 0,
        convictionCount: 0,
        dismissedCount: 0,
        mostRecentDate: null,
        mostSeriousOffense: null,
        overallSeverity: 'none',
      },
    };
  }

  const records = rawRecords.map((raw) => {
    const offense = raw.offense || raw.offenseDescription || raw.description || 'Unknown offense';
    const offenseType = (raw.offenseType || raw.caseType || raw.type || raw.category || 'misdemeanor').toLowerCase();
    const disposition = (raw.disposition || raw.plea || 'unknown').toLowerCase();
    const date = raw.date || raw.offenseDate || raw.filingDate || null;
    const jurisdiction = raw.jurisdiction || raw.county || raw.state || null;

    const recency = recencyCategory(date);

    // Base severity from matrix — map "guilty" to "convicted"
    const dispositionNorm = disposition.includes('guilty') ? 'convicted' : disposition;
    const normDisposition = Object.keys(CRIMINAL_SEVERITY).find((k) => dispositionNorm.includes(k)) || 'pending';
    // Map CRS categories: "violation" and "criminal/traffic" → infraction, else check for felony/misdemeanor
    const isViolation = offenseType.includes('violation') || offenseType.includes('traffic');
    const normType = isViolation ? 'infraction'
      : (['felony', 'misdemeanor', 'infraction'].find((t) => offenseType.includes(t)) || 'misdemeanor');
    let severity = CRIMINAL_SEVERITY[normDisposition]?.[normType] || 'moderate';

    // Recency modifier: if historical, downgrade one level
    if (recency === 'historical') {
      if (severity === 'elevated') severity = 'moderate';
      else if (severity === 'moderate') severity = 'low';
    }

    return {
      offense,
      offenseType: normType,
      disposition: normDisposition,
      date,
      recencyCategory: recency,
      recencyLabel: recencyLabel(date),
      jurisdiction,
      severity,
    };
  });

  // Sort by date descending (most recent first)
  records.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  // Summary
  const convictionCount = records.filter((r) => r.disposition === 'convicted' || r.disposition === 'guilty').length;
  const dismissedCount = records.filter((r) => ['dismissed', 'acquitted', 'expunged'].includes(r.disposition)).length;
  const mostRecentDate = records[0]?.date || null;
  const mostSeriousOffense = records.reduce((worst, r) =>
    (SEVERITY_ORDER[r.severity] || 0) > (SEVERITY_ORDER[worst?.severity] || 0) ? r : worst
  , records[0]);
  const overallSeverity = records.reduce((sev, r) => maxSeverity(sev, r.severity), 'none');

  return {
    records,
    summary: {
      totalRecords: records.length,
      convictionCount,
      dismissedCount,
      mostRecentDate,
      mostSeriousOffense: mostSeriousOffense?.offense || null,
      overallSeverity,
    },
  };
}

/**
 * Structure raw eviction records from CRS into normalized records with severity.
 */
function structureEvictionRecords(rawRecords) {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return {
      records: [],
      summary: {
        totalFilings: 0,
        judgmentsAgainst: 0,
        dismissedCount: 0,
        mostRecentDate: null,
        overallSeverity: 'none',
      },
    };
  }

  const records = rawRecords.map((raw) => {
    const filingDate = raw.filingDate || raw.date || null;
    const jurisdiction = raw.jurisdiction || raw.county || raw.state || null;
    const plaintiff = raw.plaintiff || raw.plaintiffName || null;
    const outcome = (raw.outcome || raw.disposition || raw.status || 'unknown').toLowerCase();
    const amount = raw.amount || raw.judgmentAmount || null;

    const recency = recencyCategory(filingDate);

    // Severity from outcome
    const normOutcome = Object.keys(EVICTION_SEVERITY).find((k) => outcome.includes(k));
    let severity = normOutcome ? EVICTION_SEVERITY[normOutcome] : 'moderate';

    // Recency modifier
    if (recency === 'historical') {
      if (severity === 'elevated') severity = 'moderate';
      else if (severity === 'moderate') severity = 'low';
    }

    return {
      filingDate,
      recencyCategory: recency,
      recencyLabel: recencyLabel(filingDate),
      jurisdiction,
      plaintiff,
      outcome: normOutcome || outcome,
      amount,
      severity,
    };
  });

  // Sort by date descending
  records.sort((a, b) => {
    if (!a.filingDate && !b.filingDate) return 0;
    if (!a.filingDate) return 1;
    if (!b.filingDate) return -1;
    return new Date(b.filingDate) - new Date(a.filingDate);
  });

  const judgmentsAgainst = records.filter((r) =>
    r.outcome === 'judgment for plaintiff' || r.outcome === 'judgment'
  ).length;
  const dismissedCount = records.filter((r) =>
    r.outcome === 'dismissed' || r.outcome === 'withdrawn'
  ).length;
  const mostRecentDate = records[0]?.filingDate || null;
  const overallSeverity = records.reduce((sev, r) => maxSeverity(sev, r.severity), 'none');

  return {
    records,
    summary: {
      totalFilings: records.length,
      judgmentsAgainst,
      dismissedCount,
      mostRecentDate,
      overallSeverity,
    },
  };
}

/**
 * Structure identity verification data.
 */
function structureIdentity(identityData) {
  if (!identityData) {
    return { cviScore: null, verificationStatus: 'unknown', riskIndicators: [], verifiedElements: null };
  }

  const cviScore = identityData.cviScore ?? null;

  let verificationStatus = 'unknown';
  if (cviScore != null) {
    if (cviScore > 30) verificationStatus = 'verified';
    else if (cviScore >= 15) verificationStatus = 'uncertain';
    else verificationStatus = 'failed';
  }

  return {
    cviScore,
    verificationStatus,
    riskIndicators: identityData.riskIndicators || [],
    verifiedElements: identityData.verifiedElements || null,
  };
}

module.exports = { structureCriminalRecords, structureEvictionRecords, structureIdentity };
