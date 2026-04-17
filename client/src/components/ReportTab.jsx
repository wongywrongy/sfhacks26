import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { generateDealMemo } from '../services/dealMemoPdf';
import { ANALYTICS_INSIGHTS, CONTRIBUTION_INSIGHTS } from '../data/insights';
import PdfViewerModal from './PdfViewerModal';

const MODEL_OPTIONS = [
  { value: 'hybrid', label: 'Hybrid (50/50)' },
  { value: 'proportional', label: 'Pro-rata (income-weighted)' },
  { value: 'equal', label: 'Equal allocation' },
];

const MODEL_LABELS = {
  hybrid: 'Hybrid (50/50)',
  proportional: 'Pro-rata (income-weighted)',
  equal: 'Equal allocation',
};

const SECTION_OPTIONS = [
  { key: 'household', label: 'Household overview' },
  { key: 'underwriting', label: 'Underwriting' },
  { key: 'allocation', label: 'Allocation' },
  { key: 'safety', label: 'Safety review' },
  { key: 'recommendation', label: 'Recommendation' },
];

export default function ReportTab({ projectId, project }) {
  const [selectedModel, setSelectedModel] = useState('hybrid');
  const [excludedMemberIds, setExcludedMemberIds] = useState(() => new Set());
  const [sections, setSections] = useState(() =>
    SECTION_OPTIONS.reduce((acc, s) => { acc[s.key] = true; return acc; }, {})
  );
  const [generating, setGenerating] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null);
  const [flash, setFlash] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [contributions, setContributions] = useState(null);
  const [safety, setSafety] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getAnalytics(projectId).catch(() => null),
      api.getContributions(projectId).catch(() => null),
      api.getSafety(projectId).catch(() => null),
    ]).then(([a, c, s]) => {
      if (cancelled) return;
      setAnalytics(a);
      setContributions(c);
      setSafety(s);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  const members = project?.members || [];
  const includedMembers = useMemo(
    () => members.filter((m) => !excludedMemberIds.has(m._id)),
    [members, excludedMemberIds]
  );

  function toggleMember(id) {
    setExcludedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSection(key) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const computeAllocationRows = useCallback(() => {
    if (!contributions || !analytics) return [];
    const model = contributions[selectedModel];
    if (!model) return [];
    return model.members
      .filter((m) => !excludedMemberIds.has(m.memberId))
      .map((m) => ({
        name: m.displayName,
        income: m.monthlyIncome || 0,
        amount: m.paymentAmount || 0,
        pct: m.percentageOfIncome || 0,
        residual: m.breathingRoom || 0,
      }));
  }, [contributions, analytics, selectedModel, excludedMemberIds]);

  const computeSafetyFlags = useCallback(() => {
    if (!safety) return [];
    const flags = [];
    for (const m of (safety.members || [])) {
      if (excludedMemberIds.has(m._id)) continue;
      const crim = m.criminalStructured?.records || [];
      const evic = m.evictionStructured?.records || [];
      if (!crim.length && !evic.length && m.identityStructured?.verificationStatus !== 'failed') continue;
      const chips = [];
      const rec = [...crim, ...evic][0];
      if (rec?.nature) chips.push(`Nature: ${rec.nature}`);
      if (rec?.recency) chips.push(`Recency: ${rec.recency}`);
      if (rec?.severityLabel) chips.push(`Severity: ${rec.severityLabel}`);
      flags.push({
        applicant: `${m.firstName} ${m.lastInitial}.`,
        summary: m.aiSafetySummary?.summary || `Records pending individualized assessment under HUD 2016 guidance.`,
        chips,
      });
    }
    return flags;
  }, [safety, excludedMemberIds]);

  const recommendation = useMemo(() => {
    const stageMap = {
      approved: 'Approve at standard lease terms',
      review: 'Approve with conditions pending individualized assessment',
      in_progress: 'Hold pending completion of applicant intake',
      empty: 'Not yet scoped',
    };
    const stageStr = stageMap[project?.stage] || 'Hold';
    return `${stageStr} · ${MODEL_LABELS[selectedModel]}`;
  }, [project, selectedModel]);

  async function handleGenerate() {
    if (!includedMembers.length) {
      setFlash('Select at least one co-applicant.');
      setTimeout(() => setFlash(null), 2400);
      return;
    }
    setGenerating(true);
    try {
      const a = analytics;
      const narratives = {
        household: project?.groupAssessment?.overview || '',
        underwriting: ANALYTICS_INSIGHTS[projectId]?.overview || '',
        recommendation: CONTRIBUTION_INSIGHTS[projectId]?.recommendation || '',
      };
      const metrics = a
        ? {
            combinedIncome: a.combinedIncome,
            combinedObligations: a.combinedObligations,
            monthlyCost: a.estimatedMonthlyCost,
            groupDTI: a.groupDTI,
            residual: (a.combinedIncome || 0) - (a.combinedObligations || 0) - (a.estimatedMonthlyCost || 0),
            concentration: a.incomeDiversityScore,
          }
        : null;

      const pdf = generateDealMemo({
        project,
        members: includedMembers,
        narratives,
        metrics,
        allocationRows: computeAllocationRows(),
        allocationModelLabel: MODEL_LABELS[selectedModel],
        safetyFlags: computeSafetyFlags(),
        recommendation,
        sections,
        mode: 'memo',
      });
      setPdfPreview(pdf);
      setLastGeneratedAt(new Date());
    } catch (e) {
      console.error(e);
      setFlash('Generation failed');
      setTimeout(() => setFlash(null), 2400);
    } finally {
      setGenerating(false);
    }
  }

  if (!members.length) {
    return (
      <div className="ui-empty">
        <div className="ui-empty-title">No applicants yet</div>
        <div className="ui-empty-body">Once co-applicants complete intake, the deal memo will draw from their data to produce a lender-ready PDF.</div>
      </div>
    );
  }

  return (
    <div className="deal-memo">
      <div className="breakdown-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A1A1AA', marginBottom: 4 }}>Deal memo</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#18181b', letterSpacing: '-0.005em', fontWeight: 450, fontVariationSettings: '"opsz" 48, "SOFT" 30' }}>
              Generate a lender-ready memo for {project?.name}.
            </div>
          </div>
          <button
            className="ui-btn ui-btn--primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Generate deal memo'}
          </button>
        </div>

        {lastGeneratedAt && (
          <div style={{ fontSize: 11, color: '#71717A', marginTop: 8 }}>
            Last generated {lastGeneratedAt.toLocaleString()}
          </div>
        )}
        {flash && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#15803D' }}>{flash}</div>
        )}

        <hr className="ui-hairline" style={{ margin: '16px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A', marginBottom: 10 }}>
              Allocation model
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-button)', background: 'var(--surface-card)', fontFamily: 'var(--font-sans)',
              }}
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A', margin: '18px 0 10px' }}>
              Include co-applicants
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map((m) => {
                const on = !excludedMemberIds.has(m._id);
                return (
                  <label key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => toggleMember(m._id)} />
                    <span style={{ fontWeight: 600 }}>{m.firstName} {m.lastInitial}.</span>
                    <span style={{ color: '#71717A', fontSize: 12 }}>· {m.jobTitle || m.employmentType}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A', marginBottom: 10 }}>
              Sections to include
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SECTION_OPTIONS.map((s) => (
                <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!sections[s.key]} onChange={() => toggleSection(s.key)} />
                  <span style={{ fontWeight: 600 }}>{s.label}</span>
                </label>
              ))}
            </div>

            <div style={{ marginTop: 22, padding: 14, border: '1px solid var(--border-hairline-inset)', borderLeft: '2px solid var(--primary)', borderRadius: 8, background: 'var(--surface-sunken)', fontSize: 12, lineHeight: 1.55, color: '#3F3F46' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1D4ED8', marginBottom: 4 }}>
                Memo structure
              </div>
              Letterhead · Recommendation · Household overview · Underwriting · Allocation table · Safety review · Recommendation · Legal footer.
              Downloads as a multi-page PDF suitable for lender review, owner-of-record file, or compliance archive.
            </div>
          </div>
        </div>
      </div>
      {pdfPreview && (
        <PdfViewerModal
          url={pdfPreview.url}
          filename={pdfPreview.filename}
          title={`Deal memo · ${project?.name || ''}`}
          onClose={() => setPdfPreview(null)}
        />
      )}
    </div>
  );
}
