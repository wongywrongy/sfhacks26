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

function parseJsonResponse(text) {
  // Try to extract JSON from ```json ... ``` blocks first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- System instruction shared across all prompts ---

const SYSTEM_INSTRUCTION = `You are a senior housing financial analyst. Write exactly 2-3 sentences of flowing prose per field.

ABSOLUTE RULES:
1. NEVER use dashes, bullet points, numbered lists, or line breaks. One continuous paragraph of 2-3 sentences only.
2. NEVER use these words: suggest, imply, indicate, likely, probably, may, might, could, potentially, appears to, seems to. State facts and consequences directly.
3. ONLY reference data points provided in the prompt. Never infer employment stability, spending habits, lifestyle, or financial behavior beyond what the numbers show. If a data point is not given, do not mention it.
4. NEVER restate numbers visible in the dashboard. The manager already sees every stat. Instead, connect numbers to industry thresholds: 30% HUD affordability, 36% DTI caution, 43% lending wall, 670/740 credit tiers.
5. Every sentence must contain one of: a specific industry benchmark comparison, a concrete lease term or action, or a calculated ratio not shown in the dashboard (like total obligation ratio = housing + debt / income).
6. Tone: direct, authoritative, factual. No hedging, no speculation, no friendly language.`;

// --- 1. Individual Applicant Assessment ---

async function assessMember(memberSummary) {
  try {
    const prompt = `${SYSTEM_INSTRUCTION}

Assess ${memberSummary.firstName} for a group rental application. Do NOT restate any numbers. Only reference data points given below. Do NOT infer spending habits, lifestyle, or behavior.

Data: income $${memberSummary.monthlyIncome.toLocaleString()}, employment ${memberSummary.employmentType}, credit ${memberSummary.creditScore ?? 'unavailable'}, total debt $${(memberSummary.totalDebt ?? 0).toLocaleString()}, monthly obligations $${(memberSummary.monthlyObligations ?? 0).toLocaleString()}, DTI ${memberSummary.personalDTI !== null ? (memberSummary.personalDTI * 100).toFixed(1) + '%' : 'unavailable'}, payment history ${memberSummary.paymentHistoryPercentage !== null ? memberSummary.paymentHistoryPercentage + '%' : 'unavailable'}, delinquencies ${memberSummary.delinquencyCount ?? 0}, public records ${memberSummary.publicRecordsCount ?? 0}, open tradelines ${memberSummary.openTradelinesCount ?? 0}.

Respond with a JSON object in this exact format:
{
  "summary": "One factual sentence connecting this person's data to an industry threshold or group impact. No speculation.",
  "full": "Exactly 2-3 sentences. Calculate total obligation ratio (obligations/income) and compare to 36% caution and 43% lending thresholds. Identify which credit tier (sub-670, 670-740, 740+) affects group weighted average. Recommend a specific lease term or deposit structure based on the data. No dashes, no lists, no banned words."
}

Return ONLY the JSON object, no other text.`;

    const text = await callGemini(prompt, 800);
    const parsed = parseJsonResponse(text);

    let result;
    if (parsed && parsed.summary && parsed.full) {
      result = { summary: parsed.summary, full: parsed.full };
    } else {
      // Fallback: first sentence → summary, full text → full
      const firstSentence = text.match(/^[^.!?]*[.!?]/)?.[0] || text.slice(0, 120);
      result = { summary: firstSentence.trim(), full: text };
    }

    return {
      success: true,
      data: { ...result, generatedAt: new Date(), context: 'individual' },
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

    const prompt = `${SYSTEM_INSTRUCTION}

Analyze this group tenancy application. Do NOT restate any numbers. Only reference data points given below. Do NOT infer behavior, stability, or habits.

Data: ${groupProfile.memberCount} people, combined income $${groupProfile.combinedIncome.toLocaleString()}, combined obligations $${groupProfile.combinedObligations.toLocaleString()}, combined debt $${groupProfile.combinedDebt.toLocaleString()}, group DTI ${(groupProfile.groupDTI * 100).toFixed(1)}% (${groupProfile.dtiClassification}), max payment $${groupProfile.maxMonthlyPayment.toLocaleString()}, buying power $${groupProfile.estimatedLoanAmount.toLocaleString()}, income diversity ${groupProfile.incomeDiversityScore}.

Members: ${memberLines}

Dependency analysis: ${resilienceLines}

Respond with a JSON object. Each field must be exactly 2-3 sentences of flowing prose. No dashes, no lists, no banned words (suggest, imply, indicate, likely, probably, may, might, could, potentially, appears to, seems to).
{
  "overview": "Calculate the group's total obligation ratio with housing and compare to the 43% lending wall. Identify which member's departure causes the largest DTI swing using the dependency data. Recommend a specific lease structure.",
  "affordability": "Compare the gap between max payment and actual housing cost to industry reserve standards (3-6 months). State whether the operational margin covers a 5-10% cost increase using exact dollar math. Recommend a deposit or reserve requirement.",
  "incomeDiversity": "Count how many members share the same employment type from the data provided. State whether the diversity score is above or below the 0.6 threshold where correlated job loss becomes a lease risk. Recommend a lease term based on concentration.",
  "dependencies": "Compare the DTI-without figures from the dependency data to identify asymmetric risk. State which departures keep DTI below 43% and which breach it. Recommend naming the critical member as primary tenant with specific exit notice terms."
}

Return ONLY the JSON object, no other text.`;

    const text = await callGemini(prompt, 1200);
    const parsed = parseJsonResponse(text);

    let result;
    if (parsed && parsed.overview) {
      result = {
        overview: parsed.overview,
        affordability: parsed.affordability || '',
        incomeDiversity: parsed.incomeDiversity || '',
        dependencies: parsed.dependencies || '',
      };
    } else {
      // Fallback: entire text → overview, rest empty
      result = { overview: text, affordability: '', incomeDiversity: '', dependencies: '' };
    }

    return {
      success: true,
      data: { ...result, generatedAt: new Date(), context: 'group' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- 3. Split Model Analysis ---

async function analyzeModels(modelOutputs, groupProfile) {
  try {
    function formatModel(model) {
      return model.members.map((m) =>
        `    ${m.displayName}: $${m.paymentAmount.toLocaleString()} (${m.percentageOfIncome !== null ? (m.percentageOfIncome * 100).toFixed(1) + '% of income' : 'N/A'}), breathing room: $${m.breathingRoom.toLocaleString()}${m.exceedsAffordability ? ' [EXCEEDS 30% AFFORDABILITY THRESHOLD]' : ''}`
      ).join('\n');
    }

    let modelsText = '';
    if (modelOutputs.equal) {
      modelsText += `Even split:\n${formatModel(modelOutputs.equal)}\n\n`;
    }
    if (modelOutputs.proportional) {
      modelsText += `Income-based split:\n${formatModel(modelOutputs.proportional)}\n\n`;
    }
    if (modelOutputs.hybrid) {
      modelsText += `Balanced split (50% equal, 50% income-based):\n${formatModel(modelOutputs.hybrid)}\n\n`;
    }
    if (modelOutputs.custom) {
      const bal = modelOutputs.custom.balanceStatus;
      const balNote = bal?.balanced ? 'balanced' : bal?.shortfall ? `shortfall of $${bal.shortfall}` : `overage of $${bal.overage}`;
      modelsText += `Custom split (${balNote}):\n${formatModel(modelOutputs.custom)}\n\n`;
    }

    const prompt = `${SYSTEM_INSTRUCTION}

Compare cost-split models for $${groupProfile.estimatedMonthlyCost?.toLocaleString() || 'N/A'}/month among ${groupProfile.memberCount} applicants. Do NOT restate payment amounts or percentages. Only reference data points given below.

Data: combined income $${groupProfile.combinedIncome.toLocaleString()}, group DTI ${(groupProfile.groupDTI * 100).toFixed(1)}%.

${modelsText}

Respond with a JSON object. Each field must be exactly 2-3 sentences of flowing prose. No dashes, no lists, no banned words (suggest, imply, indicate, likely, probably, may, might, could, potentially, appears to, seems to).
{
  "distribution": "Calculate each person's total obligation ratio (housing + existing obligations / income) under the active model and identify who crosses the 36% caution or 43% lending threshold. State the dollar difference between the highest and lowest obligation ratios across models. Recommend which model minimizes threshold breaches.",
  "affordability": "Compare each person's breathing room to the industry standard of 2 months' housing cost as emergency reserve. State the total group breathing room and whether it covers one missed payment from any member. Recommend a specific shared reserve amount based on the weakest position.",
  "recommendation": "Name the recommended model and state the specific financial reason (fewest threshold breaches, best total obligation distribution, or highest minimum breathing room). State which member benefits most from this model versus even split in exact dollar terms. Provide one concrete negotiation point the manager can use."
}

Return ONLY the JSON object, no other text.`;

    const text = await callGemini(prompt, 1200);
    const parsed = parseJsonResponse(text);

    let result;
    if (parsed && (parsed.distribution || parsed.comparison)) {
      result = {
        distribution: parsed.distribution || parsed.comparison || '',
        affordability: parsed.affordability || '',
        recommendation: parsed.recommendation || '',
      };
    } else {
      // Fallback: entire text → distribution
      result = { distribution: text, affordability: '', recommendation: '' };
    }

    return {
      success: true,
      data: { ...result, generatedAt: new Date(), context: 'models' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- 4. Financial Summary — compiles existing insights, does NOT generate new analysis ---

async function compileReport(existingInsights, projectData) {
  try {
    let insightsBlock = '';

    if (existingInsights.memberAssessments?.length) {
      insightsBlock += 'Individual applicant assessments (already reviewed and validated):\n\n';
      for (const ma of existingInsights.memberAssessments) {
        insightsBlock += `${ma.firstName}:\n${ma.text}\n\n`;
      }
    }

    if (existingInsights.groupAssessment) {
      insightsBlock += `Group viability assessment (already reviewed and validated):\n${existingInsights.groupAssessment}\n\n`;
    }

    if (existingInsights.modelAnalysis) {
      insightsBlock += `Split model analysis (already reviewed and validated):\n${existingInsights.modelAnalysis}\n\n`;
    }

    const selectedModel = projectData.selectedModel;
    let modelText = '';
    if (selectedModel) {
      modelText = `Selected split model: ${selectedModel.type}\n` +
        selectedModel.members.map((m) =>
          `  ${m.displayName}: $${m.paymentAmount.toLocaleString()}/month (${m.percentageOfIncome !== null ? (m.percentageOfIncome * 100).toFixed(1) + '% of income' : 'N/A'})`
        ).join('\n');
    }

    const prompt = `${SYSTEM_INSTRUCTION}

Compile this financial assessment into a professional summary a property manager can use to evaluate this group of applicants for a rental property. This is a decision document — it should help the manager decide whether to approve, what terms to set, and what to watch for.

The insights below have already been reviewed and validated. Your job is to compile them into one cohesive document with smooth transitions. Preserve the analytical substance of each insight — do not water down risks or recommendations into generic positive language. If an insight identifies a specific risk or recommends a specific action, keep it in the report.

Group: ${projectData.projectName}
Location: ${projectData.location || 'N/A'}
Property price range: $${(projectData.priceLow || 0).toLocaleString()} - $${(projectData.priceHigh || 0).toLocaleString()}
Monthly housing cost: $${projectData.estimatedMonthlyCost.toLocaleString()}

Group financial picture:
- ${projectData.memberCount} applicants
- Combined monthly income: $${projectData.combinedIncome.toLocaleString()}
- Combined monthly debt obligations: $${projectData.combinedObligations.toLocaleString()}
- Group DTI: ${(projectData.groupDTI * 100).toFixed(1)}%
- Buying power: $${projectData.estimatedLoanAmount.toLocaleString()}
- Income diversity: ${projectData.incomeDiversityScore}

${modelText}

--- EXISTING VALIDATED INSIGHTS ---

${insightsBlock}--- END OF INSIGHTS ---

Instructions:
- Open with a brief framing paragraph, then organize by risk areas and recommendations.
- Do NOT restate numbers visible in the dashboard. Only use numbers to support analytical points against industry thresholds.
- Preserve all specific risks, actions, and recommendations from the existing insights.
- End with a clear "bottom line" with specific approval conditions.
- Plain text only. No markdown, no bullet points, no dashes, no headers, no numbered lists.
- Each paragraph is exactly 2-3 sentences. Flowing prose only.
- NEVER use: suggest, imply, indicate, likely, probably, may, might, could, potentially, appears to, seems to. State facts and consequences directly.
- Only reference data points that exist in the provided insights. Do not infer behavior, stability, or habits.
- Tone: direct, authoritative, factual.`;

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
