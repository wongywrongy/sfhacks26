const repo = require('../repositories/project-repository');
const { computeGroupAnalytics, getEligibleMembers } = require('../services/analytics-service');
const { computeContributions, saveCustomModel } = require('../services/contribution-service');
const gemini = require('../wrappers/gemini-wrapper');

async function getAnalytics(req, res) {
  try {
    const projectId = req.params.projectId;
    const result = await computeGroupAnalytics(
      projectId,
      req.query.interestRate ? parseFloat(req.query.interestRate) : undefined
    );
    if (result.error) {
      return res.status(400).json(result);
    }

    const project = await repo.getProjectById(projectId);
    const refreshAi = req.query.refreshAi === 'true';

    // Use stored insight if available, only call Gemini on first run or explicit refresh
    if (!refreshAi && project.groupAssessment) {
      result.aiAssessment = project.groupAssessment;
    } else {
      const members = getEligibleMembers(project);
      const groupProfile = {
        ...result,
        estimatedMonthlyCost: project.estimatedMonthlyCost,
        members: members.map((m) => ({
          firstName: m.firstName,
          monthlyIncome: m.monthlyIncome,
          employmentType: m.employmentType,
          creditScore: m.credit?.score ?? null,
          monthlyObligations: m.credit?.monthlyObligations ?? 0,
          personalDTI: m.personalDTI,
        })),
      };

      const aiResult = await gemini.assessGroup(groupProfile);
      if (aiResult.success) {
        await repo.updateProject(projectId, { groupAssessment: aiResult.data });
        result.aiAssessment = aiResult.data;
      } else {
        result.aiAssessment = null;
      }
    }

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
      const refreshAi = req.query.refreshAi === 'true';
      const project = await repo.getProjectById(projectId);

      if (!refreshAi && project.modelAnalysis) {
        result.aiAnalysis = project.modelAnalysis;
      } else {
        const groupProfile = {
          estimatedMonthlyCost: project.estimatedMonthlyCost,
          memberCount: project.groupMetrics?.memberCount ?? 0,
          combinedIncome: project.groupMetrics?.combinedIncome ?? 0,
          groupDTI: project.groupMetrics?.groupDTI ?? 0,
        };

        const aiResult = await gemini.analyzeModels(result, groupProfile);
        if (aiResult.success) {
          await repo.updateProject(projectId, { modelAnalysis: aiResult.data });
          result.aiAnalysis = aiResult.data;
        } else {
          result.aiAnalysis = null;
        }
      }
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

    // Gather existing AI insights from the project and member records
    const existingInsights = {
      memberAssessments: [],
      groupAssessment: project.groupAssessment?.text || null,
      modelAnalysis: project.modelAnalysis?.text || null,
    };

    // Collect member assessments (no PII)
    const eligibleMembers = (project.members || []).filter(
      (m) => m.credit?.status === 'complete'
    );
    for (const m of eligibleMembers) {
      if (m.aiAssessment?.text) {
        existingInsights.memberAssessments.push({
          firstName: m.firstName,
          text: m.aiAssessment.text,
        });
      }
    }

    // Get the selected contribution model if specified
    let selectedModel = null;
    if (selectedModelName) {
      const contributions = await computeContributions(projectId);
      if (!contributions.error) {
        selectedModel = contributions[selectedModelName] || null;
        if (selectedModel) {
          selectedModel = { type: selectedModelName, ...selectedModel };
        }
      }
    }

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
      const report = {
        status: 'failed',
        error: reportResult.error,
        generatedAt: new Date(),
        selectedModelName: selectedModelName || null,
      };
      await repo.updateProject(projectId, { readinessReport: report });
      return res.status(502).json({ error: true, message: 'Failed to generate report: ' + reportResult.error });
    }

    const report = {
      status: 'complete',
      narrative: reportResult.data.text,
      generatedAt: reportResult.data.generatedAt,
      selectedModelName: selectedModelName || null,
    };

    await repo.updateProject(projectId, { readinessReport: report });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
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

async function assessMember(req, res) {
  try {
    const { projectId, memberId } = req.params;
    const member = await repo.getMemberById(projectId, memberId);
    if (!member) {
      return res.status(404).json({ error: true, message: 'Member not found' });
    }
    if (member.credit?.status !== 'complete') {
      return res.status(400).json({ error: true, message: 'Credit data must be complete before assessment' });
    }

    const memberSummary = {
      firstName: member.firstName,
      monthlyIncome: member.monthlyIncome,
      employmentType: member.employmentType,
      creditScore: member.credit?.score ?? null,
      totalDebt: member.credit?.totalDebt ?? 0,
      monthlyObligations: member.credit?.monthlyObligations ?? 0,
      paymentHistoryPercentage: member.credit?.paymentHistoryPercentage ?? null,
      delinquencyCount: member.credit?.delinquencyCount ?? 0,
      personalDTI: member.personalDTI,
      disposableIncome: member.disposableIncome,
    };

    const aiResult = await gemini.assessMember(memberSummary);
    if (!aiResult.success) {
      return res.status(502).json({ error: true, message: 'AI assessment failed: ' + aiResult.error });
    }

    await repo.updateMemberField(projectId, memberId, 'aiAssessment', aiResult.data);
    res.json({ success: true, aiAssessment: aiResult.data });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
}

module.exports = { getAnalytics, getContributions, updateCustomModel, assessMember, createReport, getReport };
