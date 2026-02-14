const { ObjectId } = require('mongodb');
const { getDb } = require('../db');

const COLLECTION = 'buildings';

function col() {
  return getDb().collection(COLLECTION);
}

async function createBuilding(data) {
  const doc = {
    orgId: data.orgId,
    address: data.address,
    city: data.city,
    state: data.state,
    type: data.type,
    units: (data.units || []).map((u) => ({
      _id: u._id || new ObjectId(),
      name: u.name || null,
      bedrooms: u.bedrooms || 0,
      monthlyCost: u.monthlyCost || 0,
    })),
    dateCreated: new Date(),
    dateUpdated: new Date(),
  };

  const result = await col().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function getBuildingsByOrgId(orgId) {
  return col().find({ orgId }).sort({ dateCreated: -1 }).toArray();
}

async function getBuildingById(buildingId) {
  return col().findOne({ _id: new ObjectId(buildingId) });
}

async function updateBuilding(buildingId, updates) {
  const result = await col().findOneAndUpdate(
    { _id: new ObjectId(buildingId) },
    { $set: { ...updates, dateUpdated: new Date() } },
    { returnDocument: 'after' }
  );
  return result;
}

async function deleteBuilding(buildingId) {
  return col().deleteOne({ _id: new ObjectId(buildingId) });
}

module.exports = {
  createBuilding,
  getBuildingsByOrgId,
  getBuildingById,
  updateBuilding,
  deleteBuilding,
};
