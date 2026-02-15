const { ObjectId } = require('mongodb');
const buildingRepo = require('../repositories/building-repository');
const projectRepo = require('../repositories/project-repository');
const { BuildingType, CrsCheckStatus } = require('../../../shared/enums');
const gemini = require('../wrappers/gemini-wrapper');
const { getDb } = require('../db');

// In-memory cache for homepage insights (5-minute TTL)
const insightsCache = { data: null, timestamp: 0, generating: false };
const INSIGHTS_TTL_MS = 5 * 60 * 1000;

async function createBuilding(req, res) {
  const { address, city, state, type, units } = req.body;

  if (!address?.trim()) {
    return res.status(400).json({ error: true, message: 'Address is required' });
  }
  if (!city?.trim()) {
    return res.status(400).json({ error: true, message: 'City is required' });
  }
  if (!state?.trim()) {
    return res.status(400).json({ error: true, message: 'State is required' });
  }
  if (!Object.values(BuildingType).includes(type)) {
    return res.status(400).json({ error: true, message: 'Invalid building type' });
  }

  let buildingUnits;
  if (type === BuildingType.HOUSE) {
    // Houses auto-create 1 unit with null name
    const u = units?.[0] || {};
    buildingUnits = [{
      _id: new ObjectId(),
      name: null,
      bedrooms: u.bedrooms || 0,
      monthlyCost: u.monthlyCost || 0,
    }];
  } else {
    // Apartment/condo accept units[] from body
    buildingUnits = (units || []).map((u) => ({
      _id: new ObjectId(),
      name: u.name || null,
      bedrooms: u.bedrooms || 0,
      monthlyCost: u.monthlyCost || 0,
    }));
  }

  const building = await buildingRepo.createBuilding({
    orgId: req.orgId,
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    type,
    units: buildingUnits,
  });

  res.status(201).json(building);
}

async function getBuildings(req, res) {
  const buildings = await buildingRepo.getBuildingsByOrgId(req.orgId);
  res.json(buildings);
}

async function getBuildingsOverview(req, res) {
  const buildings = await buildingRepo.getBuildingsByOrgId(req.orgId);
  const projects = await projectRepo.getProjectsByOrgId(req.orgId);

  // Build map: "buildingId:unitId" → project
  const dealMap = new Map();
  const unlinkedDeals = [];

  for (const p of projects) {
    if (p.buildingId && p.unitId) {
      dealMap.set(`${p.buildingId}:${p.unitId}`, p);
    } else {
      unlinkedDeals.push(summarizeProject(p));
    }
  }

  const buildingsWithDeals = buildings.map((b) => {
    const units = (b.units || []).map((u) => {
      const project = dealMap.get(`${b._id}:${u._id}`);
      return {
        ...u,
        deal: project ? summarizeDeal(project) : null,
      };
    });

    return {
      _id: b._id,
      name: b.name || null,
      address: b.address,
      city: b.city,
      state: b.state,
      zip: b.zip || null,
      type: b.type,
      units,
      dateCreated: b.dateCreated,
    };
  });

  // Build portfolio summary for Gemini insights
  const portfolioSummary = [];
  for (const b of buildingsWithDeals) {
    for (const u of b.units) {
      if (!u.deal) continue;
      const bLabel = b.name || b.address;
      const unitLabel = u.name ? `${bLabel} Unit ${u.name}` : bLabel;
      portfolioSummary.push({
        propertyName: bLabel,
        unitName: u.name || 'main',
        stage: u.deal.stage,
        totalMembers: u.deal.totalMembers,
        screeningDone: u.deal.screeningDone,
        failedChecks: u.deal.failedChecks,
        riskFlags: u.deal.riskFlags,
        lastActivity: u.deal.lastActivity,
        approved: u.deal.approved,
        flagged: u.deal.flagged,
      });
    }
  }

  // Serve cached insights, regenerate in background if stale
  // On first load, try to hydrate from seeded collection
  if (!insightsCache.data) {
    try {
      const seeded = await getDb().collection('homepage_insights').findOne({ orgId: req.orgId });
      if (seeded) {
        insightsCache.data = { whatsNew: seeded.whatsNew, whatsNeeded: seeded.whatsNeeded };
        insightsCache.timestamp = new Date(seeded.generatedAt).getTime();
      }
    } catch (_) { /* ignore */ }
  }

  let insights = insightsCache.data;
  const now = Date.now();
  if (portfolioSummary.length > 0 && (now - insightsCache.timestamp > INSIGHTS_TTL_MS) && !insightsCache.generating) {
    insightsCache.generating = true;
    // Fire-and-forget: regenerate in background, never block response
    gemini.generateHomepageInsights(portfolioSummary)
      .then((result) => {
        if (result.success) {
          insightsCache.data = result.data;
          insightsCache.timestamp = Date.now();
        }
      })
      .catch(() => {})
      .finally(() => { insightsCache.generating = false; });
  }

  res.json({ buildings: buildingsWithDeals, unlinkedDeals, insights: insights || null });
}

function summarizeDeal(project) {
  const members = project.members || [];

  const allChecksComplete = (m) =>
    m.credit?.status === CrsCheckStatus.COMPLETE &&
    m.criminal?.status === CrsCheckStatus.COMPLETE &&
    m.eviction?.status === CrsCheckStatus.COMPLETE &&
    m.identity?.status === CrsCheckStatus.COMPLETE;

  const hasFailedCheck = (m) =>
    m.credit?.status === CrsCheckStatus.FAILED ||
    m.criminal?.status === CrsCheckStatus.FAILED ||
    m.eviction?.status === CrsCheckStatus.FAILED ||
    m.identity?.status === CrsCheckStatus.FAILED;

  const screeningDone = members.filter(allChecksComplete).length;
  const failedChecks = members.filter(hasFailedCheck).length;

  // Average credit score for members with credit complete
  const creditMembers = members.filter((m) => m.credit?.status === CrsCheckStatus.COMPLETE && m.credit?.score);
  const avgCredit = creditMembers.length > 0
    ? Math.round(creditMembers.reduce((s, m) => s + m.credit.score, 0) / creditMembers.length)
    : null;

  // Risk flags
  const riskFlags = [];
  const subSixSeventy = creditMembers.filter((m) => m.credit.score < 670).length;
  if (subSixSeventy > 0) riskFlags.push(`${subSixSeventy} sub-670 credit`);
  const evictionRecords = members.filter((m) => (m.eviction?.records || []).length > 0).length;
  if (evictionRecords > 0) riskFlags.push('eviction record');
  if (failedChecks > 0) riskFlags.push(`${failedChecks} failed checks`);

  // Last activity
  const dates = members.map((m) => new Date(m.dateSubmitted)).concat([new Date(project.dateUpdated)]);
  const lastActivity = new Date(Math.max(...dates));

  return {
    projectId: project._id,
    stage: project.stage || 'empty',
    totalMembers: members.length,
    screeningDone,
    expectedMemberCount: project.expectedMemberCount,
    approved: members.filter((m) => m.orgStatus === 'approved').length,
    flagged: members.filter((m) => m.orgStatus === 'flagged').length,
    avgCredit,
    groupDTI: project.groupMetrics?.groupDTI || null,
    failedChecks,
    riskFlags,
    lastActivity,
  };
}

function summarizeProject(project) {
  return {
    _id: project._id,
    name: project.name,
    ...summarizeDeal(project),
  };
}

async function deleteBuilding(req, res) {
  const { buildingId } = req.params;

  // Check no projects reference this building
  const projects = await projectRepo.getProjectsByOrgId(req.orgId);
  const linked = projects.filter((p) => String(p.buildingId) === buildingId);
  if (linked.length > 0) {
    return res.status(400).json({
      error: true,
      message: `Cannot delete: ${linked.length} deal(s) are linked to this building`,
    });
  }

  await buildingRepo.deleteBuilding(buildingId);
  res.json({ success: true });
}

module.exports = { createBuilding, getBuildings, getBuildingsOverview, deleteBuilding };
