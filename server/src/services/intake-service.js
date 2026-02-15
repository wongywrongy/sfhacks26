const repo = require('../repositories/project-repository');
const crs = require('../wrappers/crs-wrapper');
const gemini = require('../wrappers/gemini-wrapper');
const { CrsCheckStatus, DealStage } = require('../../../shared/enums');
const { computePaymentTrajectory, computeTradelineComposition } = require('./credit-analysis-service');
const { structureCriminalRecords, structureEvictionRecords, structureIdentity } = require('./safety-service');

async function processIntake(intakeToken, memberData) {
  const { getDb } = require('../db');
  const project = await getDb().collection('projects').findOne({ intakeLinkToken: intakeToken });
  if (!project) {
    return { error: true, message: 'Invalid intake link' };
  }

  const projectId = project._id.toString();

  const member = await repo.createMember(projectId, memberData);
  const memberId = member._id.toString();

  // Auto-advance: Empty → In Progress on first applicant
  if (!project.stage || project.stage === DealStage.EMPTY) {
    repo.updateProject(projectId, { stage: DealStage.IN_PROGRESS }).catch(() => {});
  }

  // Fire CRS calls asynchronously — don't block the HTTP response
  processCrsCalls(projectId, memberId, memberData).catch((err) => {
    console.error(`CRS processing error for member ${memberId}:`, err.message);
  });

  return { success: true, memberId };
}

async function processCrsCalls(projectId, memberId, memberData) {
  const { getDb } = require('../db');
  const { ObjectId } = require('mongodb');
  const col = () => getDb().collection('projects');
  const match = { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) };

  const [creditResult, criminalResult, evictionResult, identityResult] =
    await Promise.all([
      crs.pullCredit(memberData),
      crs.checkCriminal(memberData),
      crs.checkEviction(memberData),
      crs.verifyIdentity(memberData),
    ]);

  // Batch 1: Store all CRS results + derived fields + structured data in one write
  const setFields = { dateUpdated: new Date() };
  let creditData = null;

  if (creditResult.success) {
    creditData = creditResult.data;
    setFields['members.$.credit.status'] = CrsCheckStatus.COMPLETE;
    for (const [k, v] of Object.entries(creditData)) {
      setFields[`members.$.credit.${k}`] = v;
    }
    const monthlyObligations = creditData.monthlyObligations || 0;
    const monthlyIncome = memberData.monthlyIncome;
    setFields['members.$.personalDTI'] = monthlyIncome > 0
      ? Math.round((monthlyObligations / monthlyIncome) * 10000) / 10000
      : null;
    setFields['members.$.disposableIncome'] = monthlyIncome - monthlyObligations;
    setFields['members.$.paymentTrajectory'] = computePaymentTrajectory(creditData.tradelines, creditData.delinquencyCount);
    setFields['members.$.tradelineComposition'] = computeTradelineComposition(creditData.tradelines);
  } else {
    setFields['members.$.credit.status'] = CrsCheckStatus.FAILED;
    setFields['members.$.credit.error'] = creditResult.error;
  }

  let structuredCriminal = null;
  if (criminalResult.success) {
    setFields['members.$.criminal.status'] = CrsCheckStatus.COMPLETE;
    for (const [k, v] of Object.entries(criminalResult.data)) {
      setFields[`members.$.criminal.${k}`] = v;
    }
    structuredCriminal = structureCriminalRecords(criminalResult.data?.records || []);
    setFields['members.$.criminalStructured'] = structuredCriminal;
  } else {
    setFields['members.$.criminal.status'] = CrsCheckStatus.FAILED;
    setFields['members.$.criminal.error'] = criminalResult.error;
  }

  let structuredEviction = null;
  if (evictionResult.success) {
    setFields['members.$.eviction.status'] = CrsCheckStatus.COMPLETE;
    for (const [k, v] of Object.entries(evictionResult.data)) {
      setFields[`members.$.eviction.${k}`] = v;
    }
    structuredEviction = structureEvictionRecords(evictionResult.data?.records || []);
    setFields['members.$.evictionStructured'] = structuredEviction;
  } else {
    setFields['members.$.eviction.status'] = CrsCheckStatus.FAILED;
    setFields['members.$.eviction.error'] = evictionResult.error;
  }

  let structuredIdentityData = null;
  if (identityResult.success) {
    setFields['members.$.identity.status'] = CrsCheckStatus.COMPLETE;
    for (const [k, v] of Object.entries(identityResult.data)) {
      setFields[`members.$.identity.${k}`] = v;
    }
    structuredIdentityData = structureIdentity(identityResult.data);
    setFields['members.$.identityStructured'] = structuredIdentityData;
  } else {
    setFields['members.$.identity.status'] = CrsCheckStatus.FAILED;
    setFields['members.$.identity.error'] = identityResult.error;
  }

  await col().updateOne(match, { $set: setFields });

  // Batch 2: AI assessments (only if credit data available)
  if (creditData) {
    const monthlyObligations = creditData.monthlyObligations || 0;
    const personalDTI = memberData.monthlyIncome > 0
      ? monthlyObligations / memberData.monthlyIncome
      : null;

    const assessmentResult = await gemini.assessMember({
      firstName: memberData.firstName,
      monthlyIncome: memberData.monthlyIncome,
      employmentType: memberData.employmentType,
      creditScore: creditData.score,
      totalDebt: creditData.totalDebt,
      monthlyObligations: creditData.monthlyObligations,
      personalDTI,
      paymentHistoryPercentage: creditData.paymentHistoryPercentage,
      delinquencyCount: creditData.delinquencyCount,
      publicRecordsCount: creditData.publicRecordsCount,
      openTradelinesCount: creditData.openTradelinesCount,
    });

    const hasSafetyRecords = (structuredCriminal?.summary?.totalRecords > 0) || (structuredEviction?.summary?.totalFilings > 0);
    const safetyResult = hasSafetyRecords
      ? await gemini.assessSafety({
          firstName: memberData.firstName,
          criminalSummary: structuredCriminal?.summary || null,
          evictionSummary: structuredEviction?.summary || null,
          identityStatus: structuredIdentityData?.verificationStatus || null,
        })
      : null;

    const aiFields = { dateUpdated: new Date() };
    if (assessmentResult.success) {
      aiFields['members.$.aiAssessment'] = assessmentResult.data;
    }
    if (safetyResult?.success) {
      aiFields['members.$.aiSafetySummary'] = safetyResult.data;
    }
    if (Object.keys(aiFields).length > 1) {
      await col().updateOne(match, { $set: aiFields });
    }
  }

  // Auto-advance: In Progress → Review when all members submitted + all checks complete
  try {
    const freshProject = await repo.getProjectById(projectId);
    if (freshProject && freshProject.stage === DealStage.IN_PROGRESS) {
      const members = freshProject.members || [];
      const expected = freshProject.expectedMemberCount || 0;
      const allSubmitted = members.length >= expected;
      const allChecksComplete = members.every((m) =>
        m.credit?.status === CrsCheckStatus.COMPLETE &&
        m.criminal?.status === CrsCheckStatus.COMPLETE &&
        m.eviction?.status === CrsCheckStatus.COMPLETE &&
        m.identity?.status === CrsCheckStatus.COMPLETE
      );
      if (allSubmitted && allChecksComplete) {
        await repo.updateProject(projectId, { stage: DealStage.REVIEW });
      }
    }
  } catch (_) { /* don't block on auto-advance failure */ }

  // Fire-and-forget: reassess group after individual CRS + AI completes
  const { reassessGroup } = require('./analytics-service');
  reassessGroup(projectId).catch((err) =>
    console.error(`reassessGroup after CRS failed for ${projectId}:`, err.message)
  );
}

async function retryCrsChecks(projectId, memberId) {
  const member = await repo.getMemberById(projectId, memberId);
  if (!member) throw new Error('Member not found');

  const tasks = [];
  if (member.credit?.status === CrsCheckStatus.FAILED) {
    tasks.push(crs.pullCredit(member).then((r) => ({ type: 'credit', result: r })));
  }
  if (member.criminal?.status === CrsCheckStatus.FAILED) {
    tasks.push(crs.checkCriminal(member).then((r) => ({ type: 'criminal', result: r })));
  }
  if (member.eviction?.status === CrsCheckStatus.FAILED) {
    tasks.push(crs.checkEviction(member).then((r) => ({ type: 'eviction', result: r })));
  }
  if (member.identity?.status === CrsCheckStatus.FAILED) {
    tasks.push(crs.verifyIdentity(member).then((r) => ({ type: 'identity', result: r })));
  }

  if (tasks.length === 0) return { retried: [] };

  const results = await Promise.all(tasks);
  const { getDb } = require('../db');
  const { ObjectId } = require('mongodb');

  let creditData = null;
  let structuredCriminal = null;
  let structuredEviction = null;
  let structuredIdentityData = null;

  for (const { type, result } of results) {
    if (result.success) {
      await repo.updateMemberCrsResults(projectId, memberId, type, { status: CrsCheckStatus.COMPLETE, ...result.data });
    } else {
      await repo.updateMemberCrsResults(projectId, memberId, type, {
        status: CrsCheckStatus.FAILED,
        error: result.error,
      });
    }
  }

  // Recompute derived fields for successful retries (mirrors processCrsCalls)
  const creditRetry = results.find((r) => r.type === 'credit');
  if (creditRetry?.result.success) {
    creditData = creditRetry.result.data;
    const monthlyObligations = creditData.monthlyObligations || 0;
    const monthlyIncome = member.monthlyIncome;
    const personalDTI = monthlyIncome > 0
      ? Math.round((monthlyObligations / monthlyIncome) * 10000) / 10000
      : null;
    const disposableIncome = monthlyIncome - monthlyObligations;
    const paymentTrajectory = computePaymentTrajectory(creditData.tradelines, creditData.delinquencyCount);
    const tradelineComposition = computeTradelineComposition(creditData.tradelines);

    await getDb().collection('projects').updateOne(
      { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
      {
        $set: {
          'members.$.personalDTI': personalDTI,
          'members.$.disposableIncome': disposableIncome,
          'members.$.paymentTrajectory': paymentTrajectory,
          'members.$.tradelineComposition': tradelineComposition,
        },
      }
    );
  }

  const crimRetry = results.find((r) => r.type === 'criminal');
  if (crimRetry?.result.success) {
    structuredCriminal = structureCriminalRecords(crimRetry.result.data?.records || []);
    await getDb().collection('projects').updateOne(
      { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
      { $set: { 'members.$.criminalStructured': structuredCriminal } }
    );
  }

  const evicRetry = results.find((r) => r.type === 'eviction');
  if (evicRetry?.result.success) {
    structuredEviction = structureEvictionRecords(evicRetry.result.data?.records || []);
    await getDb().collection('projects').updateOne(
      { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
      { $set: { 'members.$.evictionStructured': structuredEviction } }
    );
  }

  const idRetry = results.find((r) => r.type === 'identity');
  if (idRetry?.result.success) {
    structuredIdentityData = structureIdentity(idRetry.result.data);
    await getDb().collection('projects').updateOne(
      { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
      { $set: { 'members.$.identityStructured': structuredIdentityData } }
    );
  }

  // Re-run AI assessment if credit data now available
  if (creditData) {
    const monthlyObligations = creditData.monthlyObligations || 0;
    const personalDTI = member.monthlyIncome > 0
      ? monthlyObligations / member.monthlyIncome
      : null;

    const assessmentResult = await gemini.assessMember({
      firstName: member.firstName,
      monthlyIncome: member.monthlyIncome,
      employmentType: member.employmentType,
      creditScore: creditData.score,
      totalDebt: creditData.totalDebt,
      monthlyObligations: creditData.monthlyObligations,
      personalDTI,
      paymentHistoryPercentage: creditData.paymentHistoryPercentage,
      delinquencyCount: creditData.delinquencyCount,
      publicRecordsCount: creditData.publicRecordsCount,
      openTradelinesCount: creditData.openTradelinesCount,
    });

    // Use existing structured data if not retried
    const crimStruct = structuredCriminal || member.criminalStructured;
    const evicStruct = structuredEviction || member.evictionStructured;
    const idStruct = structuredIdentityData || member.identityStructured;

    const hasSafetyRecords = (crimStruct?.summary?.totalRecords > 0) || (evicStruct?.summary?.totalFilings > 0);
    const safetyPromise = hasSafetyRecords
      ? gemini.assessSafety({
          firstName: member.firstName,
          criminalSummary: crimStruct?.summary || null,
          evictionSummary: evicStruct?.summary || null,
          identityStatus: idStruct?.verificationStatus || null,
        })
      : Promise.resolve(null);

    const [, safetyResult] = await Promise.all([
      (async () => {
        if (assessmentResult.success) {
          await getDb().collection('projects').updateOne(
            { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
            { $set: { 'members.$.aiAssessment': assessmentResult.data } }
          );
        }
      })(),
      safetyPromise,
    ]);

    if (safetyResult?.success) {
      await getDb().collection('projects').updateOne(
        { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
        { $set: { 'members.$.aiSafetySummary': safetyResult.data } }
      );
    }
  }

  // Auto-advance: In Progress → Review after successful retries
  try {
    const freshProject = await repo.getProjectById(projectId);
    if (freshProject && freshProject.stage === DealStage.IN_PROGRESS) {
      const members = freshProject.members || [];
      const expected = freshProject.expectedMemberCount || 0;
      const allSubmitted = members.length >= expected;
      const allChecksComplete = members.every((m) =>
        m.credit?.status === CrsCheckStatus.COMPLETE &&
        m.criminal?.status === CrsCheckStatus.COMPLETE &&
        m.eviction?.status === CrsCheckStatus.COMPLETE &&
        m.identity?.status === CrsCheckStatus.COMPLETE
      );
      if (allSubmitted && allChecksComplete) {
        await repo.updateProject(projectId, { stage: DealStage.REVIEW });
      }
    }
  } catch (_) { /* don't block on auto-advance failure */ }

  // Fire-and-forget: reassess group after retry completes
  const { reassessGroup } = require('./analytics-service');
  reassessGroup(projectId).catch((err) =>
    console.error(`reassessGroup after retry failed for ${projectId}:`, err.message)
  );

  return { retried: results.map((r) => r.type) };
}

module.exports = { processIntake, retryCrsChecks };
