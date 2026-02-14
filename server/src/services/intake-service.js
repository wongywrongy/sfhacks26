const repo = require('../repositories/project-repository');
const crs = require('../wrappers/crs-wrapper');
const gemini = require('../wrappers/gemini-wrapper');
const { CrsCheckStatus } = require('../../../shared/enums');

async function processIntake(intakeToken, memberData) {
  const { getDb } = require('../db');
  const project = await getDb().collection('projects').findOne({ intakeLinkToken: intakeToken });
  if (!project) {
    return { error: true, message: 'Invalid intake link' };
  }

  const projectId = project._id.toString();

  const member = await repo.createMember(projectId, memberData);
  const memberId = member._id.toString();

  // Fire CRS calls asynchronously — don't block the HTTP response
  processCrsCalls(projectId, memberId, memberData).catch((err) => {
    console.error(`CRS processing error for member ${memberId}:`, err.message);
  });

  return { success: true, memberId };
}

async function processCrsCalls(projectId, memberId, memberData) {
  const [creditResult, criminalResult, evictionResult, identityResult] =
    await Promise.all([
      crs.pullCredit(memberData),
      crs.checkCriminal(memberData),
      crs.checkEviction(memberData),
      crs.verifyIdentity(memberData),
    ]);

  let creditData = null;

  if (creditResult.success) {
    await repo.updateMemberCrsResults(projectId, memberId, 'credit', creditResult.data);
    creditData = creditResult.data;

    const monthlyObligations = creditData.monthlyObligations || 0;
    const monthlyIncome = memberData.monthlyIncome;
    const personalDTI = monthlyIncome > 0
      ? Math.round((monthlyObligations / monthlyIncome) * 10000) / 10000
      : null;
    const disposableIncome = monthlyIncome - monthlyObligations;

    const { getDb } = require('../db');
    const { ObjectId } = require('mongodb');
    await getDb().collection('projects').updateOne(
      { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
      {
        $set: {
          'members.$.personalDTI': personalDTI,
          'members.$.disposableIncome': disposableIncome,
        },
      }
    );
  } else {
    await repo.updateMemberCrsResults(projectId, memberId, 'credit', {
      status: CrsCheckStatus.FAILED,
      error: creditResult.error,
    });
  }

  if (criminalResult.success) {
    await repo.updateMemberCrsResults(projectId, memberId, 'criminal', criminalResult.data);
  } else {
    await repo.updateMemberCrsResults(projectId, memberId, 'criminal', {
      status: CrsCheckStatus.FAILED,
      error: criminalResult.error,
    });
  }

  if (evictionResult.success) {
    await repo.updateMemberCrsResults(projectId, memberId, 'eviction', evictionResult.data);
  } else {
    await repo.updateMemberCrsResults(projectId, memberId, 'eviction', {
      status: CrsCheckStatus.FAILED,
      error: evictionResult.error,
    });
  }

  if (identityResult.success) {
    await repo.updateMemberCrsResults(projectId, memberId, 'identity', identityResult.data);
  } else {
    await repo.updateMemberCrsResults(projectId, memberId, 'identity', {
      status: CrsCheckStatus.FAILED,
      error: identityResult.error,
    });
  }

  // After all CRS checks, trigger Gemini assessment if credit data is available
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
      unitSize: memberData.unitSize,
    });

    if (assessmentResult.success) {
      const { getDb } = require('../db');
      const { ObjectId } = require('mongodb');
      await getDb().collection('projects').updateOne(
        { _id: new ObjectId(projectId), 'members._id': new ObjectId(memberId) },
        { $set: { 'members.$.aiAssessment': assessmentResult.data } }
      );
    }
  }
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
  for (const { type, result } of results) {
    if (result.success) {
      await repo.updateMemberCrsResults(projectId, memberId, type, result.data);
    } else {
      await repo.updateMemberCrsResults(projectId, memberId, type, {
        status: CrsCheckStatus.FAILED,
        error: result.error,
      });
    }
  }

  return { retried: results.map((r) => r.type) };
}

module.exports = { processIntake, retryCrsChecks };
