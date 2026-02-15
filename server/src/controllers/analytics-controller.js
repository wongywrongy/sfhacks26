const crypto = require('crypto');
const repo = require('../repositories/project-repository');
const { computeGroupAnalytics, getEligibleMembers } = require('../services/analytics-service');
const { computeContributions, saveCustomModel } = require('../services/contribution-service');
const gemini = require('../wrappers/gemini-wrapper');
const { sendReportEmail } = require('../services/email-service');

const GEMINI_BATCH_SIZE = 2;
const GEMINI_BATCH_DELAY_MS = 4000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAnalytics(req, res) {
  try {
    const projectId = req.params.projectId;
    const project = await repo.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: true, message: 'Project not found' });
    }

    // Serve stored metrics if available; only recompute if forced or missing
    let result;
    if (project.groupMetrics && !req.query.refresh) {
      result = project.groupMetrics;
    } else {
      result = await computeGroupAnalytics(
        projectId,
        req.query.interestRate ? parseFloat(req.query.interestRate) : undefined
      );
      if (result.error) {
        return res.status(400).json(result);
      }
    }

    result.aiAssessment = project.groupAssessment || null;
    result.groupTradelineComposition = project.groupTradelineComposition || null;

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

async function getContributions(req, res) {
  try {
    const projectId = req.params.projectId;
    const excludeIds = req.query.exclude ? req.query.exclude.split(',').filter(Boolean) : [];
    const result = await computeContributions(projectId, excludeIds);
    if (result.error) {
      return res.status(400).json(result);
    }

    // Only attach AI analysis for full calculations (no excludes)
    if (excludeIds.length === 0) {
      const project = await repo.getProjectById(projectId);
      result.aiAnalysis = project.modelAnalysis || null;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

async function updateCustomModel(req, res) {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: true, message: 'Assignments array is required', field: 'assignments' });
    }

    for (const a of assignments) {
      if (!a.memberId || typeof a.paymentAmount !== 'number' || a.paymentAmount < 0) {
        return res.status(400).json({
          error: true,
          message: 'Each assignment needs a memberId and a non-negative paymentAmount',
          field: 'assignments',
        });
      }
    }

    const result = await saveCustomModel(req.params.projectId, assignments);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

async function createReport(req, res) {
  try {
    const projectId = req.params.projectId;
    const { selectedModelName } = req.body;

    const project = await repo.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: true, message: 'Project not found' });
    }

    const metrics = project.groupMetrics;
    if (!metrics) {
      return res.status(400).json({ error: true, message: 'Run group analytics first before generating a report' });
    }

    // Set status to generating and return immediately
    const report = {
      status: 'generating',
      generatedAt: new Date(),
      selectedModelName: selectedModelName || null,
    };
    await repo.updateProject(projectId, { readinessReport: report });
    res.json(report);

    // Run the heavy generation work in the background
    _generateReportsBackground(projectId, project, metrics, selectedModelName).catch((err) => {
      console.error(`Background report generation failed for ${projectId}:`, err.message);
      repo.updateProject(projectId, {
        readinessReport: { status: 'failed', error: err.message, generatedAt: new Date(), selectedModelName: selectedModelName || null },
      }).catch(() => {});
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

async function _generateReportsBackground(projectId, project, metrics, selectedModelName) {
  // Gather existing AI insights
  const groupAss = project.groupAssessment;
  const groupText = groupAss?.overview
    ? [groupAss.overview, groupAss.affordability, groupAss.incomeDiversity, groupAss.dependencies].filter(Boolean).join(' ')
    : groupAss?.text || null;

  const modelAn = project.modelAnalysis;
  const modelText = (modelAn?.distribution || modelAn?.affordability || modelAn?.recommendation)
    ? [modelAn.distribution, modelAn.affordability, modelAn.recommendation].filter(Boolean).join(' ')
    : modelAn?.comparison || modelAn?.text || null;

  const existingInsights = {
    memberAssessments: [],
    groupAssessment: groupText,
    modelAnalysis: modelText,
  };

  const eligibleMembers = (project.members || []).filter(
    (m) => m.credit?.status === 'complete'
  );
  for (const m of eligibleMembers) {
    const mText = m.aiAssessment?.full || m.aiAssessment?.text;
    if (mText) {
      existingInsights.memberAssessments.push({ firstName: m.firstName, text: mText });
    }
  }

  // Get contributions for the selected model
  let selectedModel = null;
  let contributions = null;
  if (selectedModelName) {
    contributions = await computeContributions(projectId);
    if (!contributions.error) {
      selectedModel = contributions[selectedModelName] || null;
      if (selectedModel) {
        selectedModel = { type: selectedModelName, ...selectedModel };
      }
    }
  }

  // Generate manager narrative
  const reportResult = await gemini.compileReport(existingInsights, {
    projectName: project.name,
    location: project.location ? `${project.location.city}, ${project.location.state}` : null,
    priceLow: project.priceRange?.low,
    priceHigh: project.priceRange?.high,
    estimatedMonthlyCost: project.estimatedMonthlyCost,
    memberCount: metrics.memberCount,
    combinedIncome: metrics.combinedIncome,
    combinedObligations: metrics.combinedObligations,
    combinedDebt: metrics.combinedDebt,
    groupDTI: metrics.groupDTI,
    estimatedLoanAmount: metrics.estimatedLoanAmount,
    incomeDiversityScore: metrics.incomeDiversityScore,
    selectedModel,
  });

  if (!reportResult.success) {
    await repo.updateProject(projectId, {
      readinessReport: { status: 'failed', error: reportResult.error, generatedAt: new Date(), selectedModelName: selectedModelName || null },
    });
    return;
  }

  await repo.updateProject(projectId, {
    readinessReport: {
      status: 'complete',
      narrative: reportResult.data.text,
      generatedAt: reportResult.data.generatedAt,
      selectedModelName: selectedModelName || null,
    },
  });

  // --- Generate applicant reports ---
  if (!contributions || contributions.error) {
    contributions = await computeContributions(projectId);
  }

  const modelForSplit = selectedModelName && !contributions.error
    ? contributions[selectedModelName] || contributions.proportional
    : contributions.error ? null : contributions.proportional;

  // Preserve existing release/view state when regenerating
  const existingReports = project.applicantReports || [];
  const existingByMember = new Map(existingReports.map((r) => [r.memberId, r]));

  const applicantReports = [];
  const memberQueue = [];

  for (const m of eligibleMembers) {
    const splitMember = modelForSplit?.members?.find(
      (sm) => sm.memberId === m._id.toString()
    );
    const paymentAmount = splitMember?.paymentAmount || 0;
    const breathingRoom = splitMember?.breathingRoom || 0;
    const obligations = m.credit?.monthlyObligations || 0;
    const income = m.monthlyIncome || 0;
    const projectedDTI = income > 0
      ? Math.round(((obligations + paymentAmount) / income) * 10000) / 10000
      : null;

    memberQueue.push({ member: m, paymentAmount, breathingRoom, projectedDTI, obligations });
  }

  // Process in batches to respect Gemini rate limits
  for (let i = 0; i < memberQueue.length; i += GEMINI_BATCH_SIZE) {
    const batch = memberQueue.slice(i, i + GEMINI_BATCH_SIZE);
    const results = await Promise.all(batch.map(async ({ member, paymentAmount, breathingRoom, projectedDTI, obligations }) => {
      const aiResult = await gemini.generateApplicantReport({
        firstName: member.firstName,
        creditScore: member.credit?.score ?? null,
        monthlyIncome: member.monthlyIncome,
        employmentType: member.employmentType,
        monthlyObligations: obligations,
        personalDTI: member.personalDTI,
        paymentTrajectory: member.paymentTrajectory || null,
        tradelineComposition: member.tradelineComposition || null,
        paymentAmount,
        projectedDTI,
        breathingRoom,
        criminalRecordCount: member.criminalStructured?.summary?.totalRecords ?? (member.criminal?.records?.length ?? 0),
        evictionRecordCount: member.evictionStructured?.summary?.totalFilings ?? (member.eviction?.records?.length ?? 0),
        identityVerified: member.identity?.verificationStatus === 'verified' || member.identityStructured?.verificationStatus === 'verified',
      });

      // Reset status on regeneration — new content needs to be re-sent
      const prev = existingByMember.get(member._id.toString());

      return {
        memberId: member._id.toString(),
        memberName: member.firstName,
        employmentType: member.employmentType,
        status: aiResult.success ? 'generated' : 'failed',
        reportData: aiResult.success ? aiResult.data : null,
        reportToken: prev?.reportToken || crypto.randomUUID(),
        paymentAmount,
        projectedDTI,
        breathingRoom,
        creditScore: member.credit?.score ?? null,
        monthlyIncome: member.monthlyIncome,
        monthlyObligations: obligations,
        personalDTI: member.personalDTI,
        paymentTrajectory: member.paymentTrajectory || null,
        tradelineComposition: member.tradelineComposition || null,
        criminalRecordCount: member.criminalStructured?.summary?.totalRecords ?? (member.criminal?.records?.length ?? 0),
        evictionRecordCount: member.evictionStructured?.summary?.totalFilings ?? (member.eviction?.records?.length ?? 0),
        identityVerified: member.identity?.verificationStatus === 'verified' || member.identityStructured?.verificationStatus === 'verified',
        generatedAt: new Date(),
        releasedAt: null,
        viewedAt: null,
      };
    }));

    applicantReports.push(...results);
    if (i + GEMINI_BATCH_SIZE < memberQueue.length) {
      await sleep(GEMINI_BATCH_DELAY_MS);
    }
  }

  await repo.updateProject(projectId, { applicantReports });
}

async function getReport(req, res) {
  try {
    const project = await repo.getProjectById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: true, message: 'Project not found' });
    }
    if (!project.readinessReport) {
      return res.status(404).json({ error: true, message: 'No report has been generated yet' });
    }
    res.json(project.readinessReport);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

// --- Applicant Report Endpoints ---

async function getApplicantReports(req, res) {
  try {
    const project = await repo.getProjectById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: true, message: 'Project not found' });
    }
    const reports = (project.applicantReports || []).map((r) => ({
      memberId: r.memberId,
      memberName: r.memberName,
      employmentType: r.employmentType,
      status: r.status,
      reportToken: r.reportToken,
      generatedAt: r.generatedAt,
      releasedAt: r.releasedAt,
      viewedAt: r.viewedAt,
    }));
    res.json({ applicantReports: reports });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

async function previewApplicantReport(req, res) {
  try {
    const { projectId, memberId } = req.params;
    const project = await repo.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: true, message: 'Project not found' });
    }
    const report = (project.applicantReports || []).find(
      (r) => r.memberId === memberId
    );
    if (!report) {
      return res.status(404).json({ error: true, message: 'Report not found for this member' });
    }
    res.json({
      ...report,
      projectName: project.name,
      projectLocation: project.location ? `${project.location.city}, ${project.location.state}` : null,
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

async function releaseReports(req, res) {
  try {
    const projectId = req.params.projectId;
    const { memberIds, all } = req.body;

    const project = await repo.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: true, message: 'Project not found' });
    }

    const reports = project.applicantReports || [];
    const members = project.members || [];
    const now = new Date();
    let released = 0;
    const emailQueue = [];

    // Determine base URL for report links
    const origin = req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, '') || `${req.protocol}://${req.get('host')}`;
    const baseUrl = origin.replace(/\/api$/, '').replace(/\/$/, '');

    for (const report of reports) {
      if (report.status === 'failed') continue;
      if (all || (memberIds && memberIds.includes(report.memberId))) {
        if (report.status === 'generated') {
          await repo.updateApplicantReportStatus(projectId, report.reportToken, {
            status: 'released',
            releasedAt: now,
          });
          released++;

          // Find member email
          const member = members.find((m) => m._id.toString() === report.memberId);
          if (member?.email) {
            emailQueue.push({
              to: member.email,
              firstName: report.memberName,
              projectName: project.name,
              reportUrl: `${baseUrl}/report/${report.reportToken}`,
            });
          }
        }
      }
    }

    // Send emails asynchronously — don't block the response
    if (emailQueue.length > 0) {
      Promise.all(emailQueue.map((e) => sendReportEmail(e))).catch((err) => {
        console.error('Email batch error:', err.message);
      });
    }

    // Re-fetch updated project
    const updated = await repo.getProjectById(projectId);
    const summaries = (updated.applicantReports || []).map((r) => ({
      memberId: r.memberId,
      memberName: r.memberName,
      employmentType: r.employmentType,
      status: r.status,
      reportToken: r.reportToken,
      generatedAt: r.generatedAt,
      releasedAt: r.releasedAt,
      viewedAt: r.viewedAt,
    }));

    res.json({ released, emailsSent: emailQueue.length, applicantReports: summaries });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

async function getApplicantReportPublic(req, res) {
  try {
    const { reportToken } = req.params;
    const project = await repo.getProjectByReportToken(reportToken);
    if (!project) {
      return res.status(404).json({ error: true, message: 'Report not found' });
    }

    const report = (project.applicantReports || []).find(
      (r) => r.reportToken === reportToken
    );
    if (!report) {
      return res.status(404).json({ error: true, message: 'Report not found' });
    }

    if (report.status !== 'released' && report.status !== 'viewed') {
      return res.status(403).json({ error: true, message: 'This report has not been released yet' });
    }

    // Mark as viewed on first access
    if (report.status === 'released') {
      await repo.updateApplicantReportStatus(project._id.toString(), reportToken, {
        status: 'viewed',
        viewedAt: new Date(),
      });
    }

    res.json({
      memberName: report.memberName,
      employmentType: report.employmentType,
      reportData: report.reportData,
      paymentAmount: report.paymentAmount,
      projectedDTI: report.projectedDTI,
      breathingRoom: report.breathingRoom,
      creditScore: report.creditScore,
      monthlyIncome: report.monthlyIncome,
      monthlyObligations: report.monthlyObligations,
      personalDTI: report.personalDTI,
      paymentTrajectory: report.paymentTrajectory,
      tradelineComposition: report.tradelineComposition,
      criminalRecordCount: report.criminalRecordCount,
      evictionRecordCount: report.evictionRecordCount,
      identityVerified: report.identityVerified,
      projectName: project.name,
      projectLocation: project.location ? `${project.location.city}, ${project.location.state}` : null,
      generatedAt: report.generatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

module.exports = {
  getAnalytics,
  getContributions,
  updateCustomModel,
  createReport,
  getReport,
  getApplicantReports,
  previewApplicantReport,
  releaseReports,
  getApplicantReportPublic,
};
