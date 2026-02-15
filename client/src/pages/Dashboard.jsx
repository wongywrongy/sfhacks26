import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  empty:       { label: 'Empty',       color: '#94a3b8' },
  in_progress: { label: 'In Progress', color: '#ca8a04' },
  review:      { label: 'Review',      color: '#2563eb' },
  approved:    { label: 'Approved',    color: '#16a34a' },
};

// ── Sub-components ───────────────────────────────────────────

function StagePill({ stage, count }) {
  if (!stage) {
    return (
      <span className="stage-pill" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)' }}>
        <span className="stage-pill-dot" style={{ background: '#d4d4d8' }} />
        Vacant
      </span>
    );
  }
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.empty;
  return (
    <span className="stage-pill" style={{ background: `${cfg.color}18`, color: cfg.color }}>
      <span className="stage-pill-dot" style={{ background: cfg.color }} />
      {cfg.label}{count ? ` ×${count}` : ''}
    </span>
  );
}

function DTIMiniBar({ dti }) {
  if (dti == null) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>--</span>;
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

// Count individual attention issues for a deal (each issue = 1 toward the stat total)
function countAttentionIssues(deal) {
  if (!deal) return { count: 0, reasons: [] };
  let count = 0;
  const reasons = [];
  if (deal.stage === 'review') {
    count += 1;
    reasons.push('in review');
  }
  if (deal.failedChecks > 0) {
    count += deal.failedChecks;
    reasons.push(`${deal.failedChecks} failed check${deal.failedChecks !== 1 ? 's' : ''}`);
  }
  if (deal.flagged > 0) {
    count += deal.flagged;
    reasons.push(`${deal.flagged} flagged applicant${deal.flagged !== 1 ? 's' : ''}`);
  }
  // Stalled: all expected members submitted but none fully screened
  if (deal.totalMembers > 0 && deal.totalMembers >= (deal.expectedMemberCount || deal.totalMembers) && deal.screeningDone === 0) {
    count += 1;
    reasons.push('awaiting screening');
  }
  return { count, reasons };
}

function StatWithDropdown({ children, label, rows, onNavigate, emptyText }) {
  const [show, setShow] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const closeTimer = useRef(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  const reposition = useCallback(() => {
    if (!triggerRef.current || !dropdownRef.current) return;
    const tr = triggerRef.current.getBoundingClientRect();
    const dr = dropdownRef.current.getBoundingClientRect();
    const pad = 8;

    let left = tr.left + tr.width / 2 - dr.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - dr.width - pad));

    let top = tr.bottom + 4;
    if (top + dr.height > window.innerHeight - pad) {
      top = tr.top - dr.height - 4;
    }
    top = Math.max(pad, top);

    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (show) reposition();
  }, [show, reposition]);

  useEffect(() => {
    if (!show) return;
    function handleDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setShow(false);
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('touchstart', handleDown);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('touchstart', handleDown);
    };
  }, [show]);

  // Delayed close: gives the mouse time to cross the gap between trigger and dropdown
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setShow(false), 120);
  }
  function cancelClose() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }

  const empty = !rows || rows.length === 0;

  const dropdown = show && createPortal(
    <div
      ref={dropdownRef}
      className="stat-dropdown"
      style={{ position: 'fixed', top: pos.top, left: pos.left }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      {empty ? (
        <div className="stat-dropdown-empty">{emptyText || `No ${label.toLowerCase()}`}</div>
      ) : rows.map((row, i) => (
        <div
          key={i}
          className={`stat-dropdown-row${row.projectId ? ' stat-dropdown-row-clickable' : ''}`}
          onClick={row.projectId ? (e) => { e.stopPropagation(); setShow(false); onNavigate(row.projectId); } : undefined}
        >
          <span className="stat-dropdown-name">{row.name}</span>
          <span className="stat-dropdown-detail" style={row.detailColor ? { color: row.detailColor } : undefined}>
            {row.detail}
          </span>
        </div>
      ))}
    </div>,
    document.body
  );

  return (
    <>
      <div
        className="portfolio-stat portfolio-stat-hoverable"
        ref={triggerRef}
        onMouseEnter={() => { cancelClose(); setShow(true); }}
        onMouseLeave={scheduleClose}
        onClick={(e) => { e.stopPropagation(); cancelClose(); setShow((v) => !v); }}
      >
        {children}
        <span className="portfolio-stat-label">{label}</span>
      </div>
      {dropdown}
    </>
  );
}

function PortfolioStats({ buildings, unlinkedDeals, onNavigate, insights }) {
  const stats = useMemo(() => {
    let revenue = 0, totalApplicants = 0, screenedApplicants = 0, activeApps = 0, vacant = 0, attention = 0;
    const screenedBreakdown = [];
    const activeAppsBreakdown = [];
    const vacantBreakdown = [];
    const attentionBreakdown = [];

    for (const b of buildings) {
      const bLabel = b.name || b.address;
      for (const u of b.units) {
        const unitLabel = u.name ? `${bLabel} Unit ${u.name}` : bLabel;
        if (u.deal) {
          revenue += u.monthlyCost || 0;
          totalApplicants += u.deal.totalMembers || 0;
          screenedApplicants += u.deal.screeningDone || 0;
          if (u.deal.stage !== 'approved' && u.deal.stage !== 'empty') {
            activeApps++;
            const stageCfg = STAGE_CONFIG[u.deal.stage] || STAGE_CONFIG.in_progress;
            activeAppsBreakdown.push({
              name: unitLabel,
              detail: stageCfg.label,
              detailColor: stageCfg.color,
              projectId: u.deal.projectId,
            });
          }
          const allDone = u.deal.screeningDone === u.deal.totalMembers;
          screenedBreakdown.push({
            name: unitLabel,
            detail: `${u.deal.screeningDone} of ${u.deal.totalMembers}`,
            detailColor: allDone ? 'var(--success)' : undefined,
            projectId: u.deal.projectId,
          });
          const issues = countAttentionIssues(u.deal);
          if (issues.count > 0) {
            attention += issues.count;
            attentionBreakdown.push({
              name: unitLabel,
              detail: issues.reasons.join(', '),
              detailColor: 'var(--error)',
              projectId: u.deal.projectId,
            });
          }
        } else {
          vacant++;
          vacantBreakdown.push({ name: unitLabel, detail: 'Vacant', detailColor: 'var(--warning)' });
        }
      }
    }
    for (const d of unlinkedDeals) {
      totalApplicants += d.totalMembers || 0;
      screenedApplicants += d.screeningDone || 0;
      if (d.stage !== 'approved' && d.stage !== 'empty') {
        activeApps++;
        const stageCfg = STAGE_CONFIG[d.stage] || STAGE_CONFIG.in_progress;
        activeAppsBreakdown.push({
          name: d.name,
          detail: stageCfg.label,
          detailColor: stageCfg.color,
          projectId: d.projectId || d._id,
        });
      }
      const dAllDone = d.screeningDone === d.totalMembers;
      screenedBreakdown.push({
        name: d.name,
        detail: `${d.screeningDone} of ${d.totalMembers}`,
        detailColor: dAllDone ? 'var(--success)' : undefined,
        projectId: d.projectId || d._id,
      });
      const dIssues = countAttentionIssues(d);
      if (dIssues.count > 0) {
        attention += dIssues.count;
        attentionBreakdown.push({
          name: d.name,
          detail: dIssues.reasons.join(', '),
          detailColor: 'var(--error)',
          projectId: d.projectId || d._id,
        });
      }
    }
    return { revenue, totalApplicants, screenedApplicants, activeApps, vacant, attention, screenedBreakdown, activeAppsBreakdown, vacantBreakdown, attentionBreakdown };
  }, [buildings, unlinkedDeals]);

  const allScreened = stats.totalApplicants > 0 && stats.screenedApplicants === stats.totalApplicants;

  const fallback = useMemo(() => computeFallbackActivity(buildings), [buildings]);
  const recentActivity = insights?.whatsNew || fallback.whatsNew;
  const actionRequired = insights?.whatsNeeded || fallback.whatsNeeded;
  const noActions = !actionRequired || actionRequired === 'No actions required.' || actionRequired === 'No actions required';
  const hasInsights = recentActivity || actionRequired;

  return (
    <div className="portfolio-stats-container">
      <div className="portfolio-stats-row">
        <div className="portfolio-stat">
          <span className="portfolio-stat-value">${stats.revenue.toLocaleString()}</span>
          <span className="portfolio-stat-label">Revenue</span>
        </div>
        <StatWithDropdown label="Screened" rows={stats.screenedBreakdown} onNavigate={onNavigate} emptyText="No applicants yet">
          <span className="portfolio-stat-value" style={{ color: allScreened ? 'var(--success)' : 'var(--text-primary)' }}>
            {stats.screenedApplicants} of {stats.totalApplicants}
          </span>
        </StatWithDropdown>
        <StatWithDropdown label="Active Apps" rows={stats.activeAppsBreakdown} onNavigate={onNavigate} emptyText="No active applications">
          <span className="portfolio-stat-value" style={{ color: stats.activeApps > 0 ? 'var(--primary)' : 'var(--text-primary)' }}>
            {stats.activeApps}
          </span>
        </StatWithDropdown>
        <StatWithDropdown label="Vacant" rows={stats.vacantBreakdown} onNavigate={onNavigate} emptyText="No vacant units">
          <span className="portfolio-stat-value" style={{ color: stats.vacant > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {stats.vacant}
          </span>
        </StatWithDropdown>
        <StatWithDropdown label="Needs Attention" rows={stats.attentionBreakdown} onNavigate={onNavigate} emptyText="No issues found">
          <span className="portfolio-stat-value" style={{ color: stats.attention > 0 ? 'var(--error)' : 'var(--text-primary)' }}>
            {stats.attention}
          </span>
        </StatWithDropdown>
      </div>
      {hasInsights && (
        <div className="portfolio-insights">
          {recentActivity && (
            <div className="portfolio-insight-item">
              <div className="portfolio-insight-header">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="portfolio-insight-label">Recent Activity</span>
              </div>
              <div className="portfolio-insight-text">{recentActivity}</div>
            </div>
          )}
          <div className={`portfolio-insight-item ${noActions ? 'portfolio-insight-clear' : 'portfolio-insight-needed'}`}>
            <div className="portfolio-insight-header">
              {noActions ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              <span className="portfolio-insight-label" style={{ color: noActions ? '#16a34a' : '#d97706' }}>Action Required</span>
            </div>
            <div className="portfolio-insight-text">{noActions ? 'No actions required.' : actionRequired}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function computeFallbackActivity(buildings) {
  if (!buildings || buildings.length === 0) return { whatsNew: null, whatsNeeded: null };

  const events = [];
  for (const b of buildings) {
    for (const u of b.units) {
      if (!u.deal) continue;
      const bLabel = b.name || b.address;
      const unitLabel = u.name ? `${bLabel} Unit ${u.name}` : bLabel;
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
  if (events.length === 0) return { whatsNew: null, whatsNeeded: null };
  events.sort((a, b) => b.lastActivity - a.lastActivity);

  // Fallback "Recent Activity" — 1 sentence
  const latest = events[0];
  const timeStr = formatRelativeTime(latest.lastActivity);
  const recentParts = [`${latest.unitLabel} last active ${timeStr} with ${latest.screeningDone} of ${latest.totalMembers} screened`];
  const progressing = events.filter((e) => e.stage === 'approved' || e.stage === 'review');
  if (progressing.length > 0) {
    recentParts.push(`${progressing.map((e) => e.unitLabel).slice(0, 2).join(' and ')} in ${progressing[0].stage}`);
  }
  const whatsNew = recentParts.join(', ') + '.';

  // Fallback "Action Required" — 1 sentence or null
  const flagged = events.filter((e) => e.riskFlags.length > 0);
  let whatsNeeded = null;
  if (flagged.length > 0) {
    const parts = flagged.slice(0, 3).map((e) => `${e.unitLabel}: ${e.riskFlags.join(', ')}`);
    whatsNeeded = parts.join('; ') + '.';
  }

  return { whatsNew, whatsNeeded };
}

const STAGE_ORDER = ['empty', 'in_progress', 'review', 'approved'];

function buildingSummaryStage(units) {
  const stages = units.filter((u) => u.deal).map((u) => u.deal.stage || 'empty');
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
      <div className="unit-row-cell" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {!vacant && unit.deal.riskFlags?.length > 0 ? (
          <span style={{ color: 'var(--error)', fontSize: 11 }}>{unit.deal.riskFlags[0]}</span>
        ) : !vacant ? formatRelativeTime(unit.deal.lastActivity) : null}
      </div>
      <div className="unit-row-cell" style={{ textAlign: 'right' }}>
        {vacant ? (
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onCreateDeal(building, unit); }} style={{ fontSize: 11, padding: '2px 8px' }}>
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
  const displayName = building.name || building.address;
  const locationSub = building.name
    ? `${building.address}, ${building.city}, ${building.state}`
    : `${building.city}, ${building.state}`;
  const activeUnits = building.units.filter((u) => u.deal).length;
  const vacantUnits = building.units.length - activeUnits;
  const totalRevenue = building.units.reduce((s, u) => s + (u.deal ? (u.monthlyCost || 0) : 0), 0);

  // Collect deal stages for pills — deduplicate and order by urgency
  const dealStages = building.units
    .filter((u) => u.deal)
    .map((u) => u.deal.stage || 'empty');
  const uniqueStages = STAGE_ORDER.filter((s) => dealStages.includes(s));

  return (
    <div className="building-card-multi">
      <div className="building-header" onClick={onToggle}>
        <span className="building-type-badge">{building.type}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, width: 200, flexShrink: 0 }}>
          <span className="building-row-address">{displayName}</span>
          <span className="building-row-sub">{locationSub}</span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        {!expanded && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 4 }}>
            {uniqueStages.map((s) => {
              const count = dealStages.filter((ds) => ds === s).length;
              return (
                <StagePill key={s} stage={s} count={count > 1 ? count : undefined} />
              );
            })}
            {activeUnits === 0 && <StagePill stage={null} />}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div className="building-header-stats">
          <div><span className="bh-stat-value">{building.units.length}</span><span className="bh-stat-label">Units</span></div>
          <div><span className="bh-stat-value">{activeUnits}</span><span className="bh-stat-label">Active</span></div>
          <div><span className="bh-stat-value" style={{ color: vacantUnits > 0 ? 'var(--warning)' : 'inherit' }}>{vacantUnits}</span><span className="bh-stat-label">Vacant</span></div>
          <div><span className="bh-stat-value">${totalRevenue.toLocaleString()}</span><span className="bh-stat-label">Revenue</span></div>
        </div>
      </div>

      {expanded && (
        <div className="building-units">
          <div className="unit-row-header">
            <div />
            <div>Unit</div>
            <div>Applicants</div>
            <div>DTI</div>
            <div>Credit</div>
            <div>Stage</div>
            <div>Activity</div>
            <div />
          </div>
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
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  function loadOverview() {
    setLoading(true);
    setFetchError('');
    api.getBuildingsOverview()
      .then((data) => {
        setOverview(data);
        setExpanded({});
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

  const q = searchQuery.toLowerCase().trim();
  const filteredBuildings = q
    ? buildings.filter((b) =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.address || '').toLowerCase().includes(q) ||
        (b.city || '').toLowerCase().includes(q)
      )
    : buildings;
  const filteredUnlinked = q
    ? unlinkedDeals.filter((d) => (d.name || '').toLowerCase().includes(q))
    : unlinkedDeals;
  const totalFiltered = filteredBuildings.length + filteredUnlinked.length;
  const totalAll = buildings.length + unlinkedDeals.length;

  return (
    <div className="app-layout">
      <Topbar />

      <main className="app-main">
        <div className="main-content">
          <div className="page-header">
            <div>
              <h2 className="page-title">Properties</h2>
              <p className="page-subtitle">
                {buildings.length} building{buildings.length !== 1 ? 's' : ''} &middot; {totalDeals} active app{totalDeals !== 1 ? 's' : ''} &middot; {totalVacant} vacant
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
              <PortfolioStats buildings={buildings} unlinkedDeals={unlinkedDeals} onNavigate={handleNavigate} insights={overview?.insights} />

              {totalAll > 1 && (
                <div className="search-bar" style={{ marginBottom: 10 }}>
                  <svg className="search-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input
                    type="text"
                    placeholder="Search properties by name, address, or city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {q && <span className="search-bar-count">{totalFiltered} of {totalAll}</span>}
                  {q && <button className="search-bar-clear" onClick={() => setSearchQuery('')}>&times;</button>}
                </div>
              )}

              {q && totalFiltered === 0 ? (
                <div className="search-empty-state">
                  <span>&#128269;</span>
                  <span>No results for &ldquo;{searchQuery}&rdquo;</span>
                </div>
              ) : (
              <>
              <div className="building-list">
                {filteredBuildings.map((b) => (
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

              {filteredUnlinked.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Unlinked Deals
                  </h3>
                  <div className="building-list">
                    {filteredUnlinked.map((d) => (
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
