const { MongoClient } = require('mongodb');

let client = null;
let db = null;

async function connect() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB');

  // Ensure indexes (idempotent — safe to call on every startup)
  const projects = db.collection('projects');
  await Promise.all([
    projects.createIndex({ orgId: 1 }),
    projects.createIndex({ intakeLinkToken: 1 }, { unique: true }),
    projects.createIndex({ 'applicantReports.reportToken': 1 }, { sparse: true }),
    projects.createIndex({ buildingId: 1 }, { sparse: true }),
  ]);

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected. Call connect() first.');
  return db;
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connect, getDb, close };
