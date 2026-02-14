/**
 * Test script for the CRS wrapper.
 * Run: node src/test-crs.js
 * Requires CRS_USERNAME and CRS_PASSWORD in .env
 */
require('dotenv').config();
const crs = require('./wrappers/crs-wrapper');

// Sandbox test persona (Experian): EILEEN BRADY, NJ
const testMember = {
  firstName: 'EILEEN',
  lastName: 'BRADY',
  dateOfBirth: '1972-11-22',
  ssn: '666883007',
  street: '31 LONDON CT',
  city: 'PLEASANTVILLE',
  state: 'NJ',
  zip: '082344434',
  monthlyIncome: 5000,
  employmentType: 'salaried',
  unitSize: '2br',
};

// Criminal/eviction sandbox persona
const testCriminalMember = {
  firstName: 'Jennifer',
  lastName: 'Ray',
  dateOfBirth: '1972-09-03',
  ssn: '123-45-6789',
  street: '275 LANDINGS',
  city: 'MERRITT ISLAND',
  state: 'FL',
  zip: '32955',
};

// FlexID sandbox persona
const testFlexIdMember = {
  firstName: 'JOHN',
  lastName: 'COPE',
  dateOfBirth: '1973-08-01',
  ssn: '574709961',
  street: '511 SYCAMORE AVE',
  city: 'HAYWARD',
  state: 'CA',
  zip: '94544',
};

async function run() {
  console.log('=== CRS Wrapper Tests ===\n');

  // 1. Auth
  console.log('1. Testing authentication...');
  try {
    const token = await crs.authenticate();
    console.log(`   ✓ Got token: ${token.slice(0, 20)}...\n`);
  } catch (err) {
    console.error(`   ✗ Auth failed: ${err.message}\n`);
    process.exit(1);
  }

  // 2. Credit pull
  console.log('2. Testing pullCredit (EILEEN BRADY)...');
  const creditResult = await crs.pullCredit(testMember);
  if (creditResult.success) {
    const d = creditResult.data;
    console.log(`   ✓ Score: ${d.score}`);
    console.log(`   ✓ Total debt: $${d.totalDebt}`);
    console.log(`   ✓ Monthly obligations: $${d.monthlyObligations}`);
    console.log(`   ✓ Open tradelines: ${d.openTradelinesCount}`);
    console.log(`   ✓ Payment history: ${d.paymentHistoryPercentage}%`);
    console.log(`   ✓ Tradelines returned: ${d.tradelines.length}\n`);
  } else {
    console.error(`   ✗ Credit pull failed: ${creditResult.error}\n`);
  }

  // 3. Criminal check
  console.log('3. Testing checkCriminal (Jennifer Ray)...');
  const crimResult = await crs.checkCriminal(testCriminalMember);
  if (crimResult.success) {
    console.log(`   ✓ Records found: ${crimResult.data.records.length}\n`);
  } else {
    console.error(`   ✗ Criminal check failed: ${crimResult.error}\n`);
  }

  // 4. Eviction check
  console.log('4. Testing checkEviction (Jennifer Ray)...');
  const evictResult = await crs.checkEviction(testCriminalMember);
  if (evictResult.success) {
    console.log(`   ✓ Records found: ${evictResult.data.records.length}\n`);
  } else {
    console.error(`   ✗ Eviction check failed: ${evictResult.error}\n`);
  }

  // 5. Identity verification
  console.log('5. Testing verifyIdentity (JOHN COPE)...');
  const idResult = await crs.verifyIdentity(testFlexIdMember);
  if (idResult.success) {
    console.log(`   ✓ CVI Score: ${idResult.data.cviScore}`);
    console.log(`   ✓ Status: ${idResult.data.verificationStatus}\n`);
  } else {
    console.error(`   ✗ Identity check failed: ${idResult.error}\n`);
  }

  console.log('=== Done ===');
}

run().catch(console.error);
