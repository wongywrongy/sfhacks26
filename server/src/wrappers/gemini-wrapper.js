const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGemini(prompt, maxTokens = 1024) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  return text.trim();
}

// --- 1. Individual Member Assessment ---

async function assessMember(memberSummary) {
  try {
    const prompt = `You are a financial analyst advising a nonprofit housing organization that helps groups form housing cooperatives. Write a candid 2-3 paragraph assessment of this prospective co-op member's financial profile.

Member profile:
- First name: ${memberSummary.firstName}
- Monthly income: $${memberSummary.monthlyIncome.toLocaleString()}
- Employment type: ${memberSummary.employmentType}
- Credit score: ${memberSummary.creditScore ?? 'unavailable'}
- Total outstanding debt: $${(memberSummary.totalDebt ?? 0).toLocaleString()}
- Monthly debt obligations: $${(memberSummary.monthlyObligations ?? 0).toLocaleString()}
- Personal debt-to-income ratio: ${memberSummary.personalDTI !== null ? (memberSummary.personalDTI * 100).toFixed(1) + '%' : 'unavailable'}
- On-time payment history: ${memberSummary.paymentHistoryPercentage !== null ? memberSummary.paymentHistoryPercentage + '%' : 'unavailable'}
- Delinquencies: ${memberSummary.delinquencyCount ?? 0}
- Public records (bankruptcies, liens): ${memberSummary.publicRecordsCount ?? 0}
- Open tradelines: ${memberSummary.openTradelinesCount ?? 0}
- Preferred unit size: ${memberSummary.unitSize}

Instructions:
- Identify specific strengths and risk factors using the actual numbers above.
- Explain how this member would affect a cooperative group's collective financial position.
- Be direct and specific. Do not give generic financial advice. Reference the data.
- Write in plain text with no markdown formatting, no bullet points, no headers.
- Tone: professional, candid, written for an organizational audience, not for the member.`;

    const text = await callGemini(prompt, 800);
    return {
      success: true,
      data: { text, generatedAt: new Date(), context: 'individual' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- 2. Group Viability Assessment ---

async function assessGroup(groupProfile) {
  try {
    const memberLines = groupProfile.members.map((m, i) =>
      `  ${m.firstName}: income $${m.monthlyIncome.toLocaleString()}, employment: ${m.employmentType}, credit score: ${m.creditScore ?? 'N/A'}, monthly obligations: $${(m.monthlyObligations ?? 0).toLocaleString()}, personal DTI: ${m.personalDTI !== null ? (m.personalDTI * 100).toFixed(1) + '%' : 'N/A'}`
    ).join('\n');

    const resilienceLines = groupProfile.resilienceMatrix.map((r) =>
      `  ${r.displayName}: group DTI without them = ${(r.dtiWithout * 100).toFixed(1)}%${r.isCriticalDependency ? ' [CRITICAL DEPENDENCY]' : ''}`
    ).join('\n');

    const prompt = `You are a financial analyst advising a nonprofit housing organization evaluating whether a group of prospective residents can collectively qualify for a housing cooperative mortgage. Write a thorough narrative analysis of this group's viability.

Group overview:
- Number of members: ${groupProfile.memberCount}
- Combined monthly income: $${groupProfile.combinedIncome.toLocaleString()}
- Combined monthly debt obligations: $${groupProfile.combinedObligations.toLocaleString()}
- Combined outstanding debt: $${groupProfile.combinedDebt.toLocaleString()}
- Group debt-to-income ratio: ${(groupProfile.groupDTI * 100).toFixed(1)}% (${groupProfile.dtiClassification})
- Estimated max monthly housing payment: $${groupProfile.maxMonthlyPayment.toLocaleString()}
- Estimated borrowing power: $${groupProfile.estimatedLoanAmount.toLocaleString()}
- Income diversity score: ${groupProfile.incomeDiversityScore} (1.0 = all different employment types)

Individual member profiles:
${memberLines}

Resilience analysis (what happens if each member leaves):
${resilienceLines}

Instructions:
- Analyze the group's collective strengths and weaknesses using the specific numbers.
- Identify critical dependencies where losing one member threatens the group's viability.
- Assess correlated income risks if multiple members share the same employment type.
- Note if the group DTI is healthy, borderline, or risky for lending purposes.
- Write in plain text with no markdown formatting, no bullet points, no headers.
- Tone: professional, analytical, written for an organization making investment decisions about this group.`;

    const text = await callGemini(prompt, 1200);
    return {
      success: true,
      data: { text, generatedAt: new Date(), context: 'group' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- 3. Contribution Model Analysis ---

async function analyzeModels(modelOutputs, groupProfile) {
  try {
    function formatModel(model) {
      return model.members.map((m) =>
        `    ${m.displayName}: $${m.paymentAmount.toLocaleString()} (${m.percentageOfIncome !== null ? (m.percentageOfIncome * 100).toFixed(1) + '% of income' : 'N/A'}), breathing room: $${m.breathingRoom.toLocaleString()}${m.exceedsAffordability ? ' [EXCEEDS 30% AFFORDABILITY THRESHOLD]' : ''}`
      ).join('\n');
    }

    let modelsText = '';
    if (modelOutputs.equal) {
      modelsText += `Equal split model:\n${formatModel(modelOutputs.equal)}\n\n`;
    }
    if (modelOutputs.proportional) {
      modelsText += `Income-proportional model:\n${formatModel(modelOutputs.proportional)}\n\n`;
    }
    if (modelOutputs.unitBased) {
      modelsText += `Unit-based model:\n${formatModel(modelOutputs.unitBased)}\n\n`;
    }
    if (modelOutputs.hybrid) {
      modelsText += `Hybrid model (50% equal, 50% income-proportional):\n${formatModel(modelOutputs.hybrid)}\n\n`;
    }
    if (modelOutputs.custom) {
      const bal = modelOutputs.custom.balanceStatus;
      const balNote = bal?.balanced ? 'balanced' : bal?.shortfall ? `shortfall of $${bal.shortfall}` : `overage of $${bal.overage}`;
      modelsText += `Custom model (${balNote}):\n${formatModel(modelOutputs.custom)}\n\n`;
    }

    const prompt = `You are a financial advisor helping a nonprofit housing organization choose a fair way to split $${groupProfile.estimatedMonthlyCost?.toLocaleString() || 'N/A'} in monthly housing costs among ${groupProfile.memberCount} cooperative members. Analyze and compare the following contribution models.

Group context:
- Combined monthly income: $${groupProfile.combinedIncome.toLocaleString()}
- Group DTI: ${(groupProfile.groupDTI * 100).toFixed(1)}%

${modelsText}

Instructions:
- Compare the models by explaining the tradeoffs for this specific group, referencing individual members by name.
- Note which members are helped or hurt by each model and why.
- Highlight any affordability concerns where a member's payment exceeds 30% of their income.
- If a custom model exists, compare it against the formula-driven models and note how the manual adjustments change the fairness picture.
- Do not recommend a single model. Present the tradeoffs so the organization and group can decide together.
- Write in plain text with no markdown formatting, no bullet points, no headers.
- Tone: advisory, balanced, non-prescriptive.`;

    const text = await callGemini(prompt, 1200);
    return {
      success: true,
      data: { text, generatedAt: new Date(), context: 'models' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- 4. Readiness Report — compiles existing insights, does NOT generate new analysis ---

async function compileReport(existingInsights, projectData) {
  try {
    let insightsBlock = '';

    if (existingInsights.memberAssessments?.length) {
      insightsBlock += 'Individual member assessments (already reviewed and validated):\n\n';
      for (const ma of existingInsights.memberAssessments) {
        insightsBlock += `${ma.firstName}:\n${ma.text}\n\n`;
      }
    }

    if (existingInsights.groupAssessment) {
      insightsBlock += `Group viability assessment (already reviewed and validated):\n${existingInsights.groupAssessment}\n\n`;
    }

    if (existingInsights.modelAnalysis) {
      insightsBlock += `Contribution model analysis (already reviewed and validated):\n${existingInsights.modelAnalysis}\n\n`;
    }

    const selectedModel = projectData.selectedModel;
    let modelText = '';
    if (selectedModel) {
      modelText = `Selected contribution model: ${selectedModel.type}\n` +
        selectedModel.members.map((m) =>
          `  ${m.displayName}: $${m.paymentAmount.toLocaleString()}/month (${m.percentageOfIncome !== null ? (m.percentageOfIncome * 100).toFixed(1) + '% of income' : 'N/A'})`
        ).join('\n');
    }

    const prompt = `You are a financial analyst compiling a professional readiness document for a housing cooperative group preparing to approach lenders.

The following insights have already been reviewed and validated by the sponsoring organization. Your job is to compile them into a cohesive document with a brief professional introduction and smooth transitions between sections. Do not add new analysis or contradict the existing insights.

Project: ${projectData.projectName}
Location: ${projectData.location || 'N/A'}
Target property price range: $${(projectData.priceLow || 0).toLocaleString()} - $${(projectData.priceHigh || 0).toLocaleString()}
Estimated monthly housing cost: $${projectData.estimatedMonthlyCost.toLocaleString()}

Group financial summary:
- Members: ${projectData.memberCount}
- Combined monthly income: $${projectData.combinedIncome.toLocaleString()}
- Combined monthly debt obligations: $${projectData.combinedObligations.toLocaleString()}
- Group debt-to-income ratio: ${(projectData.groupDTI * 100).toFixed(1)}%
- Estimated borrowing power: $${projectData.estimatedLoanAmount.toLocaleString()}
- Income diversity score: ${projectData.incomeDiversityScore}

${modelText}

--- EXISTING VALIDATED INSIGHTS ---

${insightsBlock}
--- END OF INSIGHTS ---

Instructions:
- Write a brief professional introduction that frames the group and the cooperative structure.
- Incorporate each of the existing insights above with smooth transitions between them.
- You may lightly rephrase for flow but do not change the substance or add new financial analysis.
- Reference specific financial metrics from the group summary to support the narrative.
- This should read like a polished document prepared by a financial professional for a lending conversation.
- Write in plain text with no markdown formatting, no bullet points, no headers.
- Tone: formal, factual, confidence-building.`;

    const text = await callGemini(prompt, 2000);
    return {
      success: true,
      data: { text, generatedAt: new Date(), context: 'report' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { assessMember, assessGroup, analyzeModels, compileReport };
