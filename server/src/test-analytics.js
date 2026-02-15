/**
 * Test script for group analytics and contribution model calculations.
 * Uses synthetic member data — no CRS calls needed.
 *
 * Run: node src/test-analytics.js
 * Requires MONGODB_URI in .env
 */
require('dotenv').config();
const { connect, getDb, close } = require('./db');
const { ObjectId } = require('mongodb');
const repo = require('./repositories/project-repository');
const { computeGroupAnalytics } = require('./services/analytics-service');
const { computeContributions, saveCustomModel } = require('./services/contribution-service');

// Three synthetic members with known values for easy manual verification
// Monthly cost: $3,000
// Member A: income $6,000, obligations $500, studio
// Member B: income $4,000, obligations $300, 2br
// Member C: income $5,000, obligations $200, 1br
// Combined income: $15,000
// Combined obligations: $1,000
// Group DTI = (1000 + 3000) / 15000 = 0.2667 → healthy

const MONTHLY_COST = 3000;

async function seedTestData() {
  const memberA = {
    _id: new ObjectId(),
    firstName: 'Alice',
    lastName: 'Test',
    monthlyIncome: 6000,
    employmentType: 'salaried',
    unitSize: 'studio',
    credit: { status: 'complete', monthlyObligations: 500, totalDebt: 12000 },
    criminal: { status: 'complete', records: [] },
    eviction: { status: 'complete', records: [] },
    identity: { status: 'complete', cviScore: 40 },
    orgStatus: 'approved',
    personalDTI: 0.0833,
    dateSubmitted: new Date(),
  };

  const memberB = {
    _id: new ObjectId(),
    firstName: 'Bob',
    lastName: 'Test',
    monthlyIncome: 4000,
    employmentType: 'freelance',
    unitSize: '2br',
    credit: { status: 'complete', monthlyObligations: 300, totalDebt: 8000 },
    criminal: { status: 'complete', records: [] },
    eviction: { status: 'complete', records: [] },
    identity: { status: 'complete', cviScore: 35 },
    orgStatus: 'approved',
    personalDTI: 0.075,
    dateSubmitted: new Date(),
  };

  const memberC = {
    _id: new ObjectId(),
    firstName: 'Carol',
    lastName: 'Test',
    monthlyIncome: 5000,
    employmentType: 'government',
    unitSize: '1br',
    credit: { status: 'complete', monthlyObligations: 200, totalDebt: 5000 },
    criminal: { status: 'complete', records: [] },
    eviction: { status: 'complete', records: [] },
    identity: { status: 'complete', cviScore: 45 },
    orgStatus: 'approved',
    personalDTI: 0.04,
    dateSubmitted: new Date(),
  };

  const project = await repo.createProject({
    orgId: 'test-org-001',
    name: 'Analytics Test Co-op',
    priceLow: 400000,
    priceHigh: 500000,
    estimatedMonthlyCost: MONTHLY_COST,
    city: 'San Francisco',
    state: 'CA',
    expectedMemberCount: 3,
    intakeLinkToken: 'test-analytics-' + Date.now(),
  });

  const projectId = project._id.toString();

  // Insert members directly
  await getDb().collection('projects').updateOne(
    { _id: project._id },
    { $set: { members: [memberA, memberB, memberC] } }
  );

  return { projectId, memberA, memberB, memberC };
}

function assert(condition, label) {
  if (condition) {
    console.log(`   ✓ ${label}`);
  } else {
    console.log(`   ✗ ${label}`);
  }
}

function approxEqual(a, b, tolerance = 0.01) {
  return Math.abs(a - b) < tolerance;
}

async function run() {
  console.log('=== Analytics & Contribution Model Tests ===\n');
  await connect();

  const { projectId, memberA, memberB, memberC } = await seedTestData();
  console.log(`Test project: ${projectId}\n`);

  // --- Group Analytics ---
  console.log('1. Group Analytics');
  const analytics = await computeGroupAnalytics(projectId);

  assert(!analytics.error, 'No error');
  assert(analytics.combinedIncome === 15000, `Combined income: $${analytics.combinedIncome} (expected $15,000)`);
  assert(analytics.combinedObligations === 1000, `Combined obligations: $${analytics.combinedObligations} (expected $1,000)`);
  assert(analytics.combinedDebt === 25000, `Combined debt: $${analytics.combinedDebt} (expected $25,000)`);

  // DTI = (1000 + 3000) / 15000 = 0.2667
  assert(approxEqual(analytics.groupDTI, 0.2667), `Group DTI: ${analytics.groupDTI} (expected ~0.2667)`);
  assert(analytics.dtiClassification === 'healthy', `Classification: ${analytics.dtiClassification} (expected healthy)`);

  // Max monthly = 15000 * 0.43 - 1000 = 5450
  assert(approxEqual(analytics.maxMonthlyPayment, 5450), `Max monthly payment: $${analytics.maxMonthlyPayment} (expected $5,450)`);
  assert(analytics.estimatedLoanAmount > 0, `Estimated loan amount: $${analytics.estimatedLoanAmount.toLocaleString()}`);

  // 3 unique employment types / 3 members = 1.0
  assert(analytics.incomeDiversityScore === 1.0, `Income diversity: ${analytics.incomeDiversityScore} (expected 1.0)`);
  assert(analytics.memberCount === 3, `Member count: ${analytics.memberCount}`);

  // Resilience matrix
  console.log('\n   Resilience matrix:');
  for (const r of analytics.resilienceMatrix) {
    const critLabel = r.isCriticalDependency ? ' [CRITICAL]' : '';
    console.log(`   - ${r.displayName}: DTI without = ${r.dtiWithout}${critLabel}`);
  }

  // Alice removal: income 9000, obligations 500, DTI = (500+3000)/9000 = 0.3889
  const aliceRow = analytics.resilienceMatrix.find((r) => r.memberId === memberA._id.toString());
  assert(approxEqual(aliceRow.dtiWithout, 0.3889, 0.001), `Alice removal DTI: ${aliceRow.dtiWithout} (expected ~0.3889)`);

  console.log('');

  // --- Contribution Models ---
  console.log('2. Contribution Models');
  const models = await computeContributions(projectId);

  assert(!models.error, 'No error');

  // Equal: 3000 / 3 = $1000 each
  console.log('\n   Equal model:');
  for (const m of models.equal.members) {
    console.log(`   - ${m.displayName}: $${m.paymentAmount} (${(m.percentageOfIncome * 100).toFixed(1)}% of income, breathing room: $${m.breathingRoom})`);
  }
  assert(models.equal.members.every((m) => approxEqual(m.paymentAmount, 1000)), 'All members pay $1,000');

  // Proportional: Alice 6/15=40%, Bob 4/15=26.67%, Carol 5/15=33.33%
  console.log('\n   Proportional model:');
  for (const m of models.proportional.members) {
    console.log(`   - ${m.displayName}: $${m.paymentAmount} (${(m.percentageOfIncome * 100).toFixed(1)}% of income)`);
  }
  const aliceProp = models.proportional.members.find((m) => m.displayName === 'Alice');
  assert(approxEqual(aliceProp.paymentAmount, 1200), `Alice proportional: $${aliceProp.paymentAmount} (expected $1,200)`);

  // Unit-based: studio 0.7, 2br 1.3, 1br 1.0 → sum 3.0
  // Alice: 0.7/3.0 * 3000 = $700, Bob: 1.3/3.0 * 3000 = $1300, Carol: 1.0/3.0 * 3000 = $1000
  console.log('\n   Unit-based model:');
  for (const m of models.unitBased.members) {
    console.log(`   - ${m.displayName}: $${m.paymentAmount}`);
  }
  const aliceUnit = models.unitBased.members.find((m) => m.displayName === 'Alice');
  assert(approxEqual(aliceUnit.paymentAmount, 700), `Alice unit-based: $${aliceUnit.paymentAmount} (expected $700)`);
  const bobUnit = models.unitBased.members.find((m) => m.displayName === 'Bob');
  assert(approxEqual(bobUnit.paymentAmount, 1300), `Bob unit-based: $${bobUnit.paymentAmount} (expected $1,300)`);

  // Hybrid: 50% equal ($500 each) + 50% proportional (Alice 600, Bob 400, Carol 500)
  // Alice: 500+600=1100, Bob: 500+400=900, Carol: 500+500=1000
  console.log('\n   Hybrid model:');
  for (const m of models.hybrid.members) {
    console.log(`   - ${m.displayName}: $${m.paymentAmount}`);
  }
  const aliceHybrid = models.hybrid.members.find((m) => m.displayName === 'Alice');
  assert(approxEqual(aliceHybrid.paymentAmount, 1100), `Alice hybrid: $${aliceHybrid.paymentAmount} (expected $1,100)`);

  // --- Member Toggle (exclude Bob) ---
  console.log('\n3. Member Toggle (exclude Bob)');
  const toggled = await computeContributions(projectId, [memberB._id.toString()]);

  assert(toggled.equal.members.length === 2, `2 members remaining`);
  // Equal without Bob: 3000 / 2 = $1500
  assert(
    toggled.equal.members.every((m) => approxEqual(m.paymentAmount, 1500)),
    'Equal model: $1,500 each without Bob'
  );

  // --- Custom Model ---
  console.log('\n4. Custom Model');
  const customResult = await saveCustomModel(projectId, [
    { memberId: memberA._id.toString(), paymentAmount: 1200 },
    { memberId: memberB._id.toString(), paymentAmount: 900 },
    { memberId: memberC._id.toString(), paymentAmount: 900 },
  ]);
  assert(customResult.balanceStatus.balanced, `Balanced: ${JSON.stringify(customResult.balanceStatus)}`);

  // Test imbalanced custom
  const imbalanced = await saveCustomModel(projectId, [
    { memberId: memberA._id.toString(), paymentAmount: 1000 },
    { memberId: memberB._id.toString(), paymentAmount: 800 },
    { memberId: memberC._id.toString(), paymentAmount: 800 },
  ]);
  assert(!imbalanced.balanceStatus.balanced, `Imbalanced detected`);
  assert(approxEqual(imbalanced.balanceStatus.shortfall, 400), `Shortfall: $${imbalanced.balanceStatus.shortfall} (expected $400)`);

  // Test affordability flag
  const highPayment = await saveCustomModel(projectId, [
    { memberId: memberA._id.toString(), paymentAmount: 2000 },
    { memberId: memberB._id.toString(), paymentAmount: 500 },
    { memberId: memberC._id.toString(), paymentAmount: 500 },
  ]);
  const aliceCustom = highPayment.members.find((m) => m.displayName === 'Alice');
  // 2000 / 6000 = 0.3333 > 0.30
  assert(aliceCustom.exceedsAffordability, `Alice flagged for exceeding 30% affordability threshold (${(aliceCustom.percentageOfIncome * 100).toFixed(1)}%)`);

  // --- Cleanup ---
  console.log('\n5. Cleanup');
  await getDb().collection('projects').deleteOne({ _id: new ObjectId(projectId) });
  console.log('   ✓ Test project deleted');

  await close();
  console.log('\n=== Done ===');
}

run().catch(async (err) => {
  console.error(err);
  await close();
  process.exit(1);
});
