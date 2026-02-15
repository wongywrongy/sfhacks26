/**
 * Test script for MongoDB connection and project repository.
 * Run: node src/test-db.js
 * Requires MONGODB_URI in .env
 */
require('dotenv').config();
const { connect, close } = require('./db');
const repo = require('./repositories/project-repository');

async function run() {
  console.log('=== MongoDB Repository Tests ===\n');

  await connect();

  // 1. Create a project
  console.log('1. Creating test project...');
  const project = await repo.createProject({
    orgId: 'test-org-001',
    name: 'Elm Street Co-op',
    priceLow: 400000,
    priceHigh: 500000,
    estimatedMonthlyCost: 3200,
    city: 'San Francisco',
    state: 'CA',
    expectedMemberCount: 5,
    intakeLinkToken: 'test-token-' + Date.now(),
  });
  const projectId = project._id.toString();
  console.log(`   ✓ Created project: ${projectId}\n`);

  // 2. Fetch it back
  console.log('2. Fetching project by ID...');
  const fetched = await repo.getProjectById(projectId);
  console.log(`   ✓ Name: ${fetched.name}`);
  console.log(`   ✓ Status: ${fetched.status}`);
  console.log(`   ✓ Members: ${fetched.members.length}\n`);

  // 3. Fetch by org
  console.log('3. Fetching projects by org ID...');
  const orgProjects = await repo.getProjectsByOrgId('test-org-001');
  console.log(`   ✓ Found ${orgProjects.length} project(s) for test-org-001\n`);

  // 4. Add a member
  console.log('4. Adding a member...');
  const member = await repo.createMember(projectId, {
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
  });
  const memberId = member._id.toString();
  console.log(`   ✓ Added member: ${memberId}\n`);

  // 5. Fetch member
  console.log('5. Fetching member by ID...');
  const fetchedMember = await repo.getMemberById(projectId, memberId);
  console.log(`   ✓ Name: ${fetchedMember.firstName} ${fetchedMember.lastName}`);
  console.log(`   ✓ Credit status: ${fetchedMember.credit.status}\n`);

  // 6. Update CRS results
  console.log('6. Updating member credit results...');
  await repo.updateMemberCrsResults(projectId, memberId, 'credit', {
    score: 725,
    totalDebt: 15000,
    monthlyObligations: 450,
    openTradelinesCount: 5,
    status: 'complete',
  });
  const updated = await repo.getMemberById(projectId, memberId);
  console.log(`   ✓ Credit score: ${updated.credit.score}`);
  console.log(`   ✓ Credit status: ${updated.credit.status}\n`);

  // 7. Update member org status
  console.log('7. Updating member org status...');
  await repo.updateMemberStatus(projectId, memberId, 'approved', 'Looks good');
  const statusUpdated = await repo.getMemberById(projectId, memberId);
  console.log(`   ✓ Org status: ${statusUpdated.orgStatus}`);
  console.log(`   ✓ Org notes: ${statusUpdated.orgNotes}\n`);

  // 8. Update project
  console.log('8. Updating project status...');
  await repo.updateProject(projectId, { status: 'assessment' });
  const projUpdated = await repo.getProjectById(projectId);
  console.log(`   ✓ Status: ${projUpdated.status}\n`);

  // Cleanup: remove test project
  console.log('9. Cleaning up test data...');
  const { getDb } = require('./db');
  await getDb().collection('projects').deleteOne({ _id: project._id });
  console.log('   ✓ Test project deleted\n');

  await close();
  console.log('=== Done ===');
}

run().catch(async (err) => {
  console.error(err);
  await close();
  process.exit(1);
});
