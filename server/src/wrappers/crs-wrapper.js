const { CrsCheckStatus } = require('../../../shared/enums');

const BASE_URL = 'https://api-sandbox.stitchcredit.com/api';

// Cached auth token and its expiry
let cachedToken = null;
let tokenExpiry = 0;

// --- Authentication ---

async function authenticate() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const res = await fetch(`${BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.CRS_USERNAME,
      password: process.env.CRS_PASSWORD,
    }),
  });

  if (!res.ok) {
    throw new Error(`CRS login failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  // Default to 1 hour if no expiry info provided
  tokenExpiry = Date.now() + 60 * 60 * 1000;
  return cachedToken;
}

async function crsRequest(endpoint, body) {
  const token = await authenticate();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CRS ${endpoint} returned ${res.status}: ${text}`);
  }

  return res.json();
}

// --- Format helpers ---
// CRS endpoints use inconsistent formats:
// - Credit & FlexID: dates as YYYY-MM-DD, SSN as 9 digits no dashes
// - Criminal & Eviction: dates as MM-dd-yyyy, SSN as XXX-XX-XXXX with dashes

function formatDateYMD(dob) {
  // Accepts YYYY-MM-DD (pass through) or other common formats
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
  const d = new Date(dob);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateMDY(dob) {
  const ymd = formatDateYMD(dob);
  const [yyyy, mm, dd] = ymd.split('-');
  return `${mm}-${dd}-${yyyy}`;
}

function stripDashes(ssn) {
  return ssn.replace(/-/g, '');
}

function addDashes(ssn) {
  const digits = stripDashes(ssn);
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function splitStreetAddress(street) {
  const trimmed = (street || '').trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { houseNumber: '', streetName: trimmed };
  return {
    houseNumber: trimmed.slice(0, spaceIdx),
    streetName: trimmed.slice(spaceIdx + 1),
  };
}

// --- 1. Credit Pull (Experian soft pull) ---

async function pullCredit(memberData) {
  try {
    const body = {
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      ssn: stripDashes(memberData.ssn),
      birthDate: memberData.dateOfBirth ? formatDateYMD(memberData.dateOfBirth) : undefined,
      addresses: [
        {
          borrowerResidencyType: 'Current',
          addressLine1: memberData.street,
          city: memberData.city,
          state: memberData.state,
          postalCode: memberData.zip,
        },
      ],
    };

    const raw = await crsRequest(
      '/experian/credit-profile/credit-report/standard/exp-prequal-vantage4',
      body
    );

    // Normalize the CRS Standard Format response
    const score = raw.scores?.[0]?.scoreValue
      ? Number(raw.scores[0].scoreValue)
      : null;

    const tradelines = (raw.tradelines || []).map((t) => ({
      creditorName: t.creditorName,
      accountType: t.accountType,
      balance: parseFloat(t.currentBalanceAmount || '0'),
      monthlyPayment: parseFloat(t.monthlyPaymentAmount || '0'),
      status: t.accountStatusType,
      dateOpened: t.dateOpened,
    }));

    const totalDebt = tradelines.reduce((sum, t) => sum + t.balance, 0);
    const monthlyObligations = tradelines.reduce((sum, t) => sum + t.monthlyPayment, 0);
    const openTradelines = tradelines.filter((t) =>
      t.status && t.status.toLowerCase() === 'open'
    );

    const delinquencyCount = raw.summaries?.derogatorySummary?.collectionsCount || 0;
    const publicRecordsCount = (raw.publicRecords || []).length;

    // Payment history: percentage of tradelines in good standing
    const totalTradelines = tradelines.length;
    const goodStanding = tradelines.filter(
      (t) => t.status && !['Collections', 'ChargeOff', 'Delinquent'].includes(t.status)
    ).length;
    const paymentHistoryPercentage = totalTradelines > 0
      ? Math.round((goodStanding / totalTradelines) * 100)
      : null;

    return {
      success: true,
      data: {
        score,
        totalDebt,
        monthlyObligations,
        openTradelinesCount: openTradelines.length,
        paymentHistoryPercentage,
        delinquencyCount,
        publicRecordsCount,
        tradelines,
        status: CrsCheckStatus.COMPLETE,
      },
    };
  } catch (err) {
    return { success: false, error: err.message, status: CrsCheckStatus.FAILED };
  }
}

// --- 2. Criminal Background Check ---

async function checkCriminal(memberData) {
  try {
    const { houseNumber, streetName } = splitStreetAddress(memberData.street);
    const body = {
      subjectInfo: {
        first: memberData.firstName,
        last: memberData.lastName,
        // CIC endpoints require MM-dd-yyyy dates and SSN with dashes
        dob: formatDateMDY(memberData.dateOfBirth),
        ssn: addDashes(memberData.ssn),
        houseNumber,
        streetName,
        city: memberData.city,
        state: memberData.state,
        zip: memberData.zip,
      },
    };

    const raw = await crsRequest('/criminal/new-request', body);

    return {
      success: true,
      data: {
        records: raw.candidates || [],
        status: CrsCheckStatus.COMPLETE,
      },
    };
  } catch (err) {
    return { success: false, error: err.message, status: CrsCheckStatus.FAILED };
  }
}

// --- 3. Eviction Check ---

async function checkEviction(memberData) {
  try {
    const { houseNumber, streetName } = splitStreetAddress(memberData.street);
    const body = {
      subjectInfo: {
        first: memberData.firstName,
        last: memberData.lastName,
        // Same CIC format as criminal: MM-dd-yyyy dates, SSN with dashes
        dob: formatDateMDY(memberData.dateOfBirth),
        ssn: addDashes(memberData.ssn),
        houseNumber,
        streetName,
        city: memberData.city,
        state: memberData.state,
        zip: memberData.zip,
      },
    };

    const raw = await crsRequest('/eviction/new-request', body);

    return {
      success: true,
      data: {
        records: raw.candidates || [],
        status: CrsCheckStatus.COMPLETE,
      },
    };
  } catch (err) {
    return { success: false, error: err.message, status: CrsCheckStatus.FAILED };
  }
}

// --- 4. Identity Verification (FlexID) ---

async function verifyIdentity(memberData) {
  try {
    const body = {
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      ssn: stripDashes(memberData.ssn),
      dateOfBirth: memberData.dateOfBirth ? formatDateYMD(memberData.dateOfBirth) : undefined,
      streetAddress1: memberData.street,
      city: memberData.city,
      state: memberData.state,
      zipCode: memberData.zip,
    };

    const raw = await crsRequest('/flex-id/flex-id', body);

    const cviScore = raw.comprehensiveVerificationIndex ?? raw.cviScore ?? null;

    let verificationStatus;
    if (cviScore === null) verificationStatus = 'failed';
    else if (cviScore > 30) verificationStatus = 'verified';
    else if (cviScore >= 15) verificationStatus = 'uncertain';
    else verificationStatus = 'failed';

    return {
      success: true,
      data: {
        cviScore,
        verificationStatus,
        status: CrsCheckStatus.COMPLETE,
      },
    };
  } catch (err) {
    return { success: false, error: err.message, status: CrsCheckStatus.FAILED };
  }
}

module.exports = {
  authenticate,
  pullCredit,
  checkCriminal,
  checkEviction,
  verifyIdentity,
};
