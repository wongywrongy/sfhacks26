const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_RETRIES = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(prompt, maxTokens = 1024) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
      const errText = await res.text().catch(() => '');
      if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
        const retryMatch = errText.match(/retry in (\d+(?:\.\d+)?)s/i);
        const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 15 * (attempt + 1);
        console.warn(`Gemini ${res.status} rate-limited, waiting ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw new Error(`Gemini API returned ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    return text.trim();
  }
}

function parseJsonResponse(text) {
  // Try to extract JSON from ```json ... ``` blocks first
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Gemini JSON parse failed:', err.message, '— raw:', raw.slice(0, 200));
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

Data: income $${memberSummary.monthlyIncome.toLocaleString()}, employment ${memberSummary.employmentType}, credit ${memberSummary.creditScore ?? 'unavailable'}, total debt $${(memberSummary.totalDebt ?? 0).toLocaleString()}, monthly obligations $${(memberSummary.monthlyObligations ?? 0).toLocaleString()}, DTI ${memberSummary.personalDTI !== null ? (memberSummary.personalDTI * 100).toFixed(1) + '%' : 'unavailable'}, payment history ${memberSummary.paymentHistoryPercentage !== null ? memberSummary.paymentHistoryPercentage + '%' : 'unavailable'}, delinquencies ${memberSummary.delinquencyCount ?? 0}, public records ${memberSummary.publicRecordsCount ?? 0}, open tradelines ${memberSummary.openTradelinesCount ?? 0}.${memberSummary.paymentTrajectory ? `\nPayment trajectory: ${memberSummary.paymentTrajectory.trend} (${memberSummary.paymentTrajectory.confidence} confidence). ${memberSummary.paymentTrajectory.recentLateCount} late payments in recent ${Math.round((memberSummary.paymentTrajectory.windowMonths || 24) / 2)} months vs. ${memberSummary.paymentTrajectory.olderLateCount} in prior period.` : ''}${memberSummary.tradelineComposition ? `\nCredit composition: ${memberSummary.tradelineComposition.dominantType || 'mixed'} dominant. Revolving utilization at ${memberSummary.tradelineComposition.revolvingUtilization ?? 'N/A'}% across ${memberSummary.tradelineComposition.categories?.revolving?.count ?? 0} revolving accounts. Installment-to-revolving ratio: ${memberSummary.tradelineComposition.installmentToRevolvingRatio ?? 'N/A'}.` : ''}

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

Dependency analysis: ${resilienceLines}${groupProfile.groupTradelineComposition ? `

Group credit composition: ${groupProfile.groupTradelineComposition.dominantGroupDebtType} debt dominant at ${groupProfile.groupTradelineComposition.dominantPct}% of total group debt. ${groupProfile.groupTradelineComposition.revolvingHeavyCount} of ${groupProfile.groupTradelineComposition.memberCount} applicants have revolving utilization above 50%. Debt concentration risk: ${groupProfile.groupTradelineComposition.debtConcentrationRisk}.` : ''}

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

// --- 5. Applicant Financial Literacy Report ---

const APPLICANT_SYSTEM_INSTRUCTION = `You are a friendly financial educator helping a rental applicant understand their financial profile. Write warm, encouraging prose that empowers the reader to take action.

TONE RULES:
1. Write in second person ("you", "your"). Be warm, supportive, and educational.
2. NEVER use these words: concerning, alarming, problematic, risky, poor, bad, weak, insufficient. Instead use: worth monitoring, area for growth, room for improvement, opportunity to strengthen.
3. Every section is exactly 2-3 sentences of flowing prose. No dashes, bullets, or numbered lists.
4. Reference specific numbers from the data to make advice concrete and personal.
5. Compare to industry benchmarks (670/740 credit tiers, 30% housing affordability, 36% DTI caution, 43% lending wall) in a way that educates the reader.
6. End each section with something actionable or encouraging.`;

async function generateApplicantReport(memberData) {
  try {
    const prompt = `${APPLICANT_SYSTEM_INSTRUCTION}

Create a personalized financial literacy report for ${memberData.firstName}.

Data:
- Credit score: ${memberData.creditScore ?? 'unavailable'}
- Monthly income: $${(memberData.monthlyIncome || 0).toLocaleString()}
- Employment type: ${memberData.employmentType}
- Monthly debt obligations: $${(memberData.monthlyObligations || 0).toLocaleString()}
- Personal DTI (debt-to-income): ${memberData.personalDTI !== null ? (memberData.personalDTI * 100).toFixed(1) + '%' : 'unavailable'}
- Payment trajectory: ${memberData.paymentTrajectory?.trend || 'unavailable'} (recent late payments: ${memberData.paymentTrajectory?.recentLateCount ?? 'N/A'}, older late payments: ${memberData.paymentTrajectory?.olderLateCount ?? 'N/A'}, months analyzed: ${memberData.paymentTrajectory?.windowMonths ?? 'N/A'})
- Credit composition: ${memberData.tradelineComposition?.dominantType || 'mixed'} dominant, revolving utilization: ${memberData.tradelineComposition?.revolvingUtilization ?? 'N/A'}%
- Proposed housing payment: $${(memberData.paymentAmount || 0).toLocaleString()}
- Projected DTI with housing: ${memberData.projectedDTI !== null ? (memberData.projectedDTI * 100).toFixed(1) + '%' : 'unavailable'}
- Breathing room after housing + debt: $${(memberData.breathingRoom || 0).toLocaleString()}
- Criminal records: ${memberData.criminalRecordCount ?? 0}
- Eviction records: ${memberData.evictionRecordCount ?? 0}
- Identity verified: ${memberData.identityVerified ? 'yes' : 'no'}

Respond with a JSON object. Each field must be exactly 2-3 sentences of warm, educational prose referencing specific numbers from the data above.
{
  "snapshot": "A warm opening that frames their overall financial picture positively while being honest. Reference their income, credit score tier, and current DTI. End with encouragement.",
  "creditProfile": "Explain what their credit score means in context of the 670/740 tier system. Reference their revolving utilization compared to the 30% target. End with a specific tip for their situation.",
  "paymentHistory": "Describe their payment trajectory trend and what it means. Reference the specific late payment counts if any. Frame improvements positively and note areas for growth encouragingly.",
  "housingCost": "Explain their proposed payment relative to their income using the 30% affordability benchmark. Reference their projected DTI against the 36% caution and 43% lending thresholds. Mention their breathing room in concrete dollar terms.",
  "nextSteps": "Provide 2-3 specific, actionable financial steps personalized to their data. Reference concrete numbers. Be encouraging and forward-looking."
}

Return ONLY the JSON object, no other text.`;

    const text = await callGemini(prompt, 1200);
    const parsed = parseJsonResponse(text);

    let result;
    if (parsed && parsed.snapshot) {
      result = {
        snapshot: parsed.snapshot,
        creditProfile: parsed.creditProfile || '',
        paymentHistory: parsed.paymentHistory || '',
        housingCost: parsed.housingCost || '',
        nextSteps: parsed.nextSteps || '',
      };
    } else {
      result = { snapshot: text, creditProfile: '', paymentHistory: '', housingCost: '', nextSteps: '' };
    }

    return {
      success: true,
      data: { ...result, generatedAt: new Date(), context: 'applicant-report' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- 6. Individual Safety Assessment ---

async function assessSafety(memberSafety) {
  try {
    const crimText = memberSafety.criminalSummary?.totalRecords > 0
      ? `Criminal: ${memberSafety.criminalSummary.totalRecords} record(s), ${memberSafety.criminalSummary.convictionCount} conviction(s), ${memberSafety.criminalSummary.dismissedCount} dismissed. Most recent: ${memberSafety.criminalSummary.mostRecentDate || 'unknown date'}. Overall severity: ${memberSafety.criminalSummary.overallSeverity}.`
      : 'Criminal: No records found.';
    const evicText = memberSafety.evictionSummary?.totalFilings > 0
      ? `Eviction: ${memberSafety.evictionSummary.totalFilings} filing(s), ${memberSafety.evictionSummary.judgmentsAgainst} judgment(s) against, ${memberSafety.evictionSummary.dismissedCount} dismissed. Most recent: ${memberSafety.evictionSummary.mostRecentDate || 'unknown date'}. Overall severity: ${memberSafety.evictionSummary.overallSeverity}.`
      : 'Eviction: No filings found.';
    const idText = `Identity verification: ${memberSafety.identityStatus || 'unknown'}.`;

    const prompt = `${SYSTEM_INSTRUCTION}

ADDITIONAL RULES FOR BACKGROUND ASSESSMENT:
1. Never characterize a person based on their record. Only describe the factual record details and their relevance to tenancy risk.
2. Dismissed, acquitted, and expunged records carry no weight in tenancy decisions under fair housing law. State this explicitly.
3. Historical records (7+ years) have diminished relevance. Note the time elapsed factually.
4. Never recommend denial based solely on criminal or eviction history. Only describe the record and note any applicable fair housing considerations.
5. Focus on objective facts: dates, dispositions, and severity classifications. No moral judgments.

Summarize the background screening results for ${memberSafety.firstName} in a factual, neutral tone.

Data:
${crimText}
${evicText}
${idText}

Respond with exactly 2-3 sentences of flowing prose. No JSON, no dashes, no lists. Factual summary only — describe what the records show and note any fair housing considerations for the property manager. No banned words (suggest, imply, indicate, likely, probably, may, might, could, potentially, appears to, seems to).`;

    const text = await callGemini(prompt, 400);
    return {
      success: true,
      data: { summary: text.trim(), generatedAt: new Date(), context: 'safety' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- 6. Group Safety Overview ---

async function assessGroupSafety(memberSafetySummaries) {
  try {
    const memberLines = memberSafetySummaries.map((m) => {
      const parts = [`${m.firstName}:`];
      if (m.criminalSummary?.totalRecords > 0) {
        parts.push(`${m.criminalSummary.totalRecords} criminal record(s) (severity: ${m.criminalSummary.overallSeverity})`);
      }
      if (m.evictionSummary?.totalFilings > 0) {
        parts.push(`${m.evictionSummary.totalFilings} eviction filing(s) (severity: ${m.evictionSummary.overallSeverity})`);
      }
      parts.push(`identity: ${m.identityStatus || 'unknown'}`);
      return parts.join(' ');
    }).join('\n');

    const prompt = `${SYSTEM_INSTRUCTION}

ADDITIONAL RULES FOR BACKGROUND ASSESSMENT:
1. Never characterize a person based on their record. Only describe the factual record details and their relevance to tenancy risk.
2. Dismissed, acquitted, and expunged records carry no weight in tenancy decisions under fair housing law.
3. Historical records (7+ years) have diminished relevance.
4. Never recommend denial based solely on criminal or eviction history.
5. Focus on objective facts. No moral judgments.

Provide a group-level background screening overview for a property manager.

Members with records:
${memberLines}

Respond with exactly 2-3 sentences of flowing prose. No JSON, no dashes, no lists. Summarize the group's background screening picture factually. Note fair housing considerations. No banned words (suggest, imply, indicate, likely, probably, may, might, could, potentially, appears to, seems to).`;

    const text = await callGemini(prompt, 400);
    return {
      success: true,
      data: { overview: text.trim(), generatedAt: new Date(), context: 'group-safety' },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// --- 7. Homepage Portfolio Insights ---

async function generateHomepageInsights(portfolioData) {
  try {
    const dataBlock = JSON.stringify(portfolioData, null, 0);

    // Call 1: Recent Activity — exactly 1 sentence
    const recentPrompt = `You are a property management assistant. Given these properties and their recent activity, write exactly 1 sentence summarizing what changed recently. Reference specific property names, unit numbers, and timeframes. Focus on: new applicant submissions, completed checks, stage advances. Never mention financial data.

Example tone: "3 new applications submitted to Dunder Mifflin Plaza in the last 2 hours, Schrute Farms moved to review."

Portfolio data:
${dataBlock}

Write exactly 1 sentence. No dashes, no bullet points, no lists.`;

    const recentText = await callGemini(recentPrompt, 200);

    // Call 2: Action Required — exactly 1 sentence
    // Check if there are any actual issues
    const hasIssues = portfolioData.some((d) =>
      d.failedChecks > 0 || d.flagged > 0 ||
      (d.riskFlags && d.riskFlags.length > 0)
    );

    let actionText;
    if (!hasIssues) {
      actionText = 'No actions required.';
    } else {
      const actionPrompt = `You are a property management assistant. Given these properties and their issues, write exactly 1 sentence summarizing what requires the manager's intervention right now. Reference specific property names, unit numbers, and what action to take. Focus on: failed checks needing retry, flagged applicants, applications waiting too long. Never mention financial data.

Example tone: "2 failed identity checks at Dunder Mifflin Plaza Unit 1A need retry, 1 flagged applicant at The Beasley Cottage awaiting review."

Portfolio data:
${dataBlock}

Write exactly 1 sentence. No dashes, no bullet points, no lists. Be specific about properties, issues, and actions.`;

      actionText = await callGemini(actionPrompt, 200);
    }

    return {
      success: true,
      data: { whatsNew: recentText.trim(), whatsNeeded: actionText.trim() },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { assessMember, assessGroup, analyzeModels, compileReport, generateApplicantReport, assessSafety, assessGroupSafety, generateHomepageInsights };
