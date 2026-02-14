import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Topbar from '../components/Topbar';
import CreateProjectModal from '../components/CreateProjectModal';
import CreateBuildingModal from '../components/CreateBuildingModal';
import '../styles/dashboard.css';

// ── Helpers ──────────────────────────────────────────────────

function formatRelativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

const STAGE_CONFIG = {
  screening: { label: 'Screening', color: '#94a3b8' },
  review:    { label: 'Review',    color: '#ca8a04' },
  negotiating: { label: 'Negotiating', color: '#2563eb' },
  approved:  { label: 'Approved',  color: '#16a34a' },
};

// ── Sub-components ───────────────────────────────────────────

function StagePill({ stage }) {
  if (!stage) {
    return (
      <span className="stage-pill" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)' }}>
        <span className="stage-pill-dot" style={{ background: '#d4d4d8' }} />
        Vacant
      </span>
    );
  }
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.screening;
  return (
    <span className="stage-pill" style={{ background: `${cfg.color}18`, color: cfg.color }}>
      <span className="stage-pill-dot" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function DTIMiniBar({ dti }) {
  if (dti == null) return <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>--</span>;
  const pct = Math.min(dti * 100, 60);
  const color = dti <= 0.36 ? 'var(--success)' : dti <= 0.43 ? 'var(--warning)' : 'var(--error)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.06)', display: 'inline-block', position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(pct / 60) * 100}%`, borderRadius: 2, background: color }} />
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{(dti * 100).toFixed(1)}%</span>
    </span>
  );
}

function needsAttention(deal) {
  if (!deal) return false;
  if (deal.riskFlags?.length > 0) return true;
  if (deal.groupDTI != null && deal.groupDTI > 0.43) return true;
  if (deal.avgCredit != null && deal.avgCredit < 670) return true;
  return false;
}

function PortfolioStats({ buildings, unlinkedDeals }) {
  const stats = useMemo(() => {
    let revenue = 0, applicants = 0, dtiSum = 0, dtiCount = 0, vacant = 0, attention = 0;
    for (const b of buildings) {
      for (const u of b.units) {
        if (u.deal) {
          revenue += u.monthlyCost || 0;
          applicants += u.deal.totalMembers || 0;
          if (u.deal.groupDTI != null) { dtiSum += u.deal.groupDTI; dtiCount++; }
          if (needsAttention(u.deal)) attention++;
        } else {
          vacant++;
        }
      }
    }
    // Include unlinked deals in aggregation
    for (const d of unlinkedDeals) {
      applicants += d.totalMembers || 0;
      if (d.groupDTI != null) { dtiSum += d.groupDTI; dtiCount++; }
      if (needsAttention(d)) attention++;
    }
    const avgDTI = dtiCount > 0 ? dtiSum / dtiCount : null;
    return { revenue, applicants, avgDTI, vacant, attention };
  }, [buildings, unlinkedDeals]);

  const dtiColor = stats.avgDTI == null ? 'var(--text-primary)'
    : stats.avgDTI <= 0.36 ? 'var(--success)' : stats.avgDTI <= 0.43 ? 'var(--warning)' : 'var(--error)';

  return (
    <div className="portfolio-stats">
      <div className="portfolio-stat">
        <span className="portfolio-stat-value">${stats.revenue.toLocaleString()}</span>
        <span className="portfolio-stat-label">Revenue</span>
      </div>
      <div className="portfolio-stat">
        <span className="portfolio-stat-value">{stats.applicants}</span>
        <span className="portfolio-stat-label">Applicants</span>
      </div>
      <div className="portfolio-stat">
        <span className="portfolio-stat-value" style={{ color: dtiColor }}>
          {stats.avgDTI != null ? `${(stats.avgDTI * 100).toFixed(1)}%` : '--'}
        </span>
        <span className="portfolio-stat-label">Avg DTI</span>
      </div>
      <div className="portfolio-stat">
        <span className="portfolio-stat-value" style={{ color: stats.vacant > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
          {stats.vacant}
        </span>
        <span className="portfolio-stat-label">Vacant</span>
      </div>
      <div className="portfolio-stat">
        <span className="portfolio-stat-value" style={{ color: stats.attention > 0 ? 'var(--error)' : 'var(--text-primary)' }}>
          {stats.attention}
        </span>
        <span className="portfolio-stat-label">Needs Attention</span>
      </div>
    </div>
  );
}

function ActivityCallout({ buildings }) {
  const text = useMemo(() => {
    if (!buildings || buildings.length === 0) return null;

    // Collect all events from deals
    const events = [];
    for (const b of buildings) {
      for (const u of b.units) {
        if (!u.deal) continue;
        const unitLabel = u.name ? `${b.address} Unit ${u.name}` : b.address;
        events.push({
          unitLabel,
          deal: u.deal,
          lastActivity: new Date(u.deal.lastActivity),
          stage: u.deal.stage,
          riskFlags: u.deal.riskFlags || [],
          totalMembers: u.deal.totalMembers,
          screeningDone: u.deal.screeningDone,
        });
      }
    }

    if (events.length === 0) return null;
    events.sort((a, b) => b.lastActivity - a.lastActivity);

    const sentences = [];

    // Sentence 1: what happened recently
    const latest = events[0];
    const timeStr = formatRelativeTime(latest.lastActivity);
    sentences.push(
      `${latest.unitLabel} was last active ${timeStr} with ${latest.totalMembers} applicant${latest.totalMembers !== 1 ? 's' : ''} and ${latest.screeningDone} fully screened.`
    );

    // Sentence 2: what needs attention
    const flagged = events.filter((e) => e.riskFlags.length > 0);
    if (flagged.length > 0) {
      const labels = flagged.slice(0, 2).map((e) => e.unitLabel).join(' and ');
      sentences.push(`${labels} need${flagged.length === 1 ? 's' : ''} attention: ${flagged[0].riskFlags.join(', ')}.`);
    }

    // Sentence 3: what's progressing
    const progressing = events.filter((e) => e.stage === 'approved' || e.stage === 'negotiating');
    if (progressing.length > 0 && sentences.length < 3) {
      const labels = progressing.slice(0, 2).map((e) => e.unitLabel).join(' and ');
      sentences.push(`${labels} ${progressing.length === 1 ? 'is' : 'are'} in ${progressing[0].stage} stage.`);
    }

    return sentences.slice(0, 3).join(' ') || null;
  }, [buildings]);

  if (!text) return null;
  return (
    <div className="breakdown-ai-callout" style={{ marginBottom: 4 }}>
      <div className="breakdown-ai-header">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span className="breakdown-ai-label">Activity</span>
      </div>
      <div className="breakdown-ai-text">{text}</div>
    </div>
  );
}

const STAGE_ORDER = ['screening', 'review', 'negotiating', 'approved'];

function buildingSummaryStage(units) {
  const stages = units.filter((u) => u.deal).map((u) => u.deal.stage || 'screening');
  if (stages.length === 0) return null;
  // Return the earliest (least progressed) stage
  for (const s of STAGE_ORDER) {
    if (stages.includes(s)) return s;
  }
  return stages[0];
}

function UnitRow({ unit, building, onNavigate, onCreateDeal, isLast }) {
  const vacant = !unit.deal;
  const unitSub = unit.bedrooms ? `${unit.bedrooms}BR · $${(unit.monthlyCost || 0).toLocaleString()}/mo` : `$${(unit.monthlyCost || 0).toLocaleString()}/mo`;

  return (
    <div
      className={`unit-row ${vacant ? 'unit-row-vacant' : ''}`}
      onClick={!vacant ? () => onNavigate(unit.deal.projectId) : undefined}
      style={{ cursor: vacant ? 'default' : 'pointer' }}
    >
      <div className="unit-row-tree">
        <span className={`tree-line ${isLast ? 'tree-line-last' : ''}`} />
      </div>
      <div className="unit-row-name">
        <span style={{ fontWeight: 600, fontSize: 13 }}>{unit.name || 'Unit'}</span>
        <span className="building-row-sub">{unitSub}</span>
      </div>
      <div className="unit-row-cell">
        {vacant ? '--' : <span>{unit.deal.totalMembers}/{unit.deal.expectedMemberCount}</span>}
      </div>
      <div className="unit-row-cell">
        {vacant ? '--' : <DTIMiniBar dti={unit.deal.groupDTI} />}
      </div>
      <div className="unit-row-cell">
        {vacant ? '--' : (
          <span style={{ fontWeight: 700, fontSize: 13, color: unit.deal.avgCredit >= 670 ? 'var(--text-primary)' : 'var(--warning)' }}>
            {unit.deal.avgCredit || '--'}
          </span>
        )}
      </div>
      <div className="unit-row-cell">
        {vacant ? <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Vacant</span> : <StagePill stage={unit.deal.stage} />}
      </div>
      <div className="unit-row-cell" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
        {!vacant && unit.deal.riskFlags?.length > 0 ? (
          <span style={{ color: 'var(--error)', fontSize: 10 }}>{unit.deal.riskFlags[0]}</span>
        ) : !vacant ? formatRelativeTime(unit.deal.lastActivity) : null}
      </div>
      <div className="unit-row-cell" style={{ textAlign: 'right' }}>
        {vacant ? (
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onCreateDeal(building, unit); }} style={{ fontSize: 10, padding: '2px 8px' }}>
            + Create Deal
          </button>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        )}
      </div>
    </div>
  );
}

function BuildingCard({ building, expanded, onToggle, onNavigate, onCreateDeal }) {
  const isSingle = building.units.length === 1;
  const unit = isSingle ? building.units[0] : null;
  const vacant = isSingle && !unit.deal;

  const locationSub = `${building.city}, ${building.state}`;

  // Single-unit row — same compact layout as multi-unit header
  if (isSingle) {
    const active = unit.deal ? 1 : 0;
    const vacantCount = unit.deal ? 0 : 1;
    const rev = unit.deal ? (unit.monthlyCost || 0) : 0;

    return (
      <div
        className="building-row"
        onClick={!vacant && unit.deal ? () => onNavigate(unit.deal.projectId) : undefined}
        style={{ cursor: vacant ? 'default' : 'pointer', animationDelay: '0ms' }}
      >
        <span className="building-type-badge">{building.type}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span className="building-row-address">{building.address}</span>
          <span className="building-row-sub">{locationSub} · {unit.bedrooms || 0}BR · ${(unit.monthlyCost || 0).toLocaleString()}/mo</span>
        </div>
        <div style={{ flex: 1 }} />
        <div className="building-header-stats">
          <div><span className="bh-stat-value">1</span><span className="bh-stat-label">Units</span></div>
          <div><span className="bh-stat-value">{active}</span><span className="bh-stat-label">Active</span></div>
          <div><span className="bh-stat-value" style={{ color: vacantCount > 0 ? 'var(--warning)' : 'inherit' }}>{vacantCount}</span><span className="bh-stat-label">Vacant</span></div>
          <div><span className="bh-stat-value">${rev.toLocaleString()}</span><span className="bh-stat-label">Revenue</span></div>
        </div>
        {unit.deal ? <StagePill stage={unit.deal.stage} /> : <StagePill stage={null} />}
      </div>
    );
  }

  // Multi-unit card
  const activeUnits = building.units.filter((u) => u.deal).length;
  const vacantUnits = building.units.length - activeUnits;
  const totalRevenue = building.units.reduce((s, u) => s + (u.deal ? (u.monthlyCost || 0) : 0), 0);

  return (
    <div className="building-card-multi">
      <div className="building-header" onClick={onToggle}>
        <span className="building-type-badge">{building.type}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span className="building-row-address">{building.address}</span>
          <span className="building-row-sub">{locationSub}</span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <div style={{ flex: 1 }} />
        <div className="building-header-stats">
          <div><span className="bh-stat-value">{building.units.length}</span><span className="bh-stat-label">Units</span></div>
          <div><span className="bh-stat-value">{activeUnits}</span><span className="bh-stat-label">Active</span></div>
          <div><span className="bh-stat-value" style={{ color: vacantUnits > 0 ? 'var(--warning)' : 'inherit' }}>{vacantUnits}</span><span className="bh-stat-label">Vacant</span></div>
          <div><span className="bh-stat-value">${totalRevenue.toLocaleString()}</span><span className="bh-stat-label">Revenue</span></div>
        </div>
        <StagePill stage={buildingSummaryStage(building.units)} />
      </div>

      {expanded && (
        <div className="building-units">
          {building.units.map((u, i) => (
            <UnitRow
              key={String(u._id)}
              unit={u}
              building={building}
              onNavigate={onNavigate}
              onCreateDeal={onCreateDeal}
              isLast={i === building.units.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [showCreateBuilding, setShowCreateBuilding] = useState(false);
  const [dealContext, setDealContext] = useState(null);
  const navigate = useNavigate();

  function loadOverview() {
    setLoading(true);
    setFetchError('');
    api.getBuildingsOverview()
      .then((data) => {
        setOverview(data);
        // Default: expand buildings with <5 units
        const exp = {};
        for (const b of data.buildings) {
          if (b.units.length > 1 && b.units.length < 5) exp[b._id] = true;
        }
        setExpanded(exp);
      })
      .catch((err) => setFetchError(err.message || 'Failed to load properties'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadOverview(); }, []);

  function handleNavigate(projectId) {
    navigate(`/dashboard/project/${projectId}`);
  }

  function handleCreateDeal(building, unit) {
    setDealContext({ building, unit });
  }

  function handleDealCreated() {
    setDealContext(null);
    loadOverview();
  }

  function handleBuildingCreated() {
    setShowCreateBuilding(false);
    loadOverview();
  }

  const buildings = overview?.buildings || [];
  const unlinkedDeals = overview?.unlinkedDeals || [];
  const linkedDeals = buildings.reduce((s, b) => s + b.units.filter((u) => u.deal).length, 0);
  const totalDeals = linkedDeals + unlinkedDeals.length;
  const totalVacant = buildings.reduce((s, b) => s + b.units.filter((u) => !u.deal).length, 0);

  return (
    <div className="app-layout">
      <Topbar />

      <main className="app-main">
        <div className="main-content">
          <div className="page-header">
            <div>
              <h2 className="page-title">Properties</h2>
              <p className="page-subtitle">
                {buildings.length} building{buildings.length !== 1 ? 's' : ''} &middot; {totalDeals} active deal{totalDeals !== 1 ? 's' : ''} &middot; {totalVacant} vacant
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreateBuilding(true)}>
              + Add Property
            </button>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner" />
              <p>Loading properties...</p>
            </div>
          ) : fetchError ? (
            <div className="tab-error-container">
              <div className="tab-error"><p>{fetchError}</p></div>
              <button className="btn btn-secondary btn-sm" onClick={loadOverview} style={{ marginTop: 12 }}>Retry</button>
            </div>
          ) : buildings.length === 0 && unlinkedDeals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">&#127968;</div>
              <h3>No properties yet</h3>
              <p>Add your first property to get started.</p>
              <button className="btn btn-primary" onClick={() => setShowCreateBuilding(true)}>
                Add Property
              </button>
            </div>
          ) : (
            <>
              <PortfolioStats buildings={buildings} unlinkedDeals={unlinkedDeals} />
              <ActivityCallout buildings={buildings} />

              <div className="building-list">
                {buildings.map((b) => (
                  <BuildingCard
                    key={String(b._id)}
                    building={b}
                    expanded={!!expanded[b._id]}
                    onToggle={() => setExpanded((prev) => ({ ...prev, [b._id]: !prev[b._id] }))}
                    onNavigate={handleNavigate}
                    onCreateDeal={handleCreateDeal}
                  />
                ))}
              </div>

              {unlinkedDeals.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Unlinked Deals
                  </h3>
                  <div className="building-list">
                    {unlinkedDeals.map((d) => (
                      <div
                        key={String(d._id)}
                        className="building-row"
                        onClick={() => handleNavigate(d.projectId || d._id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                          <span className="building-row-address">{d.name}</span>
                          <span className="building-row-sub">Not linked to a property</span>
                        </div>
                        <div style={{ flex: 1 }} />
                        <div className="building-header-stats">
                          <div><span className="bh-stat-value">1</span><span className="bh-stat-label">Units</span></div>
                          <div><span className="bh-stat-value">1</span><span className="bh-stat-label">Active</span></div>
                          <div><span className="bh-stat-value">0</span><span className="bh-stat-label">Vacant</span></div>
                        </div>
                        <StagePill stage={d.stage} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showCreateBuilding && (
        <CreateBuildingModal
          onClose={() => setShowCreateBuilding(false)}
          onCreated={handleBuildingCreated}
        />
      )}

      {dealContext && (
        <CreateProjectModal
          onClose={() => setDealContext(null)}
          onCreated={handleDealCreated}
          buildingId={String(dealContext.building._id)}
          unitId={String(dealContext.unit._id)}
          prefillCity={dealContext.building.city}
          prefillState={dealContext.building.state}
          prefillMonthlyCost={dealContext.unit.monthlyCost}
        />
      )}
    </div>
  );
}
