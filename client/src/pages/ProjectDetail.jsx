import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Topbar from '../components/Topbar';
import MembersTab from '../components/MembersTab';
import MemberProfile from '../components/MemberProfile';
import AnalyticsTab from '../components/AnalyticsTab';
import ContributionsTab from '../components/ContributionsTab';
import ReportTab from '../components/ReportTab';
import SafetyTab from '../components/SafetyTab';
import '../styles/dashboard.css';

const TABS = ['People', 'Financials', 'Breakdown', 'Summary', 'Safety'];

const STAGE_OPTIONS = [
  { value: 'screening', label: 'Screening', color: '#94a3b8' },
  { value: 'review', label: 'Review', color: '#ca8a04' },
  { value: 'negotiating', label: 'Negotiating', color: '#2563eb' },
  { value: 'approved', label: 'Approved', color: '#16a34a' },
];

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeTab, setActiveTab] = useState('People');
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchProject = useCallback(() => {
    setLoading(true);
    setFetchError('');
    api.getProject(projectId)
      .then(setProject)
      .catch((err) => setFetchError(err.message || 'Failed to load group'))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  function copyIntakeLink() {
    if (!project?.intakeLinkToken) return;
    const url = `${window.location.origin}/intake/${project.intakeLinkToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const loc = project?.location;
  const locationStr = loc?.city && loc?.state ? `${loc.city}, ${loc.state}` : '';

  const memberIndex = project?.members
    ? project.members.findIndex((m) => m._id === selectedMemberId)
    : -1;

  const renderTopbar = () => (
    <Topbar
      backTo="/dashboard"
      backLabel="Properties"
      actions={
        project?.intakeLinkToken ? (
          <button
            className={`btn btn-sm ${copied ? 'btn-primary' : 'btn-secondary'}`}
            onClick={copyIntakeLink}
          >
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </button>
        ) : null
      }
    />
  );

  if (loading) {
    return (
      <div className="app-layout">
        <Topbar backTo="/dashboard" backLabel="Properties" />
        <main className="app-main">
          <div className="main-content">
            <div className="loading-container">
              <div className="spinner" />
              <p>Loading group...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="app-layout">
        <Topbar backTo="/dashboard" backLabel="Properties" />
        <main className="app-main">
          <div className="main-content">
            {fetchError ? (
              <div className="tab-error-container">
                <div className="tab-error">
                  <p>{fetchError}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={fetchProject}>
                    Retry
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard')}>
                    Back to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <h3>Group not found</h3>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {renderTopbar()}

      <main className="app-main">
        <div className="main-content">
          <div className="project-detail-header">
            <div className="project-detail-top">
              <div className="project-detail-info">
                <h2 className="page-title">{project.name}</h2>
                <div className="project-meta">
                  {locationStr && <span className="meta-item">{locationStr}</span>}
                  {project.priceRange && (
                    <span className="meta-item">
                      ${project.priceRange.low?.toLocaleString()} &ndash; ${project.priceRange.high?.toLocaleString()}
                    </span>
                  )}
                  <span className="meta-item">
                    ${project.estimatedMonthlyCost?.toLocaleString()}/mo
                  </span>
                  <select
                    className="stage-select"
                    value={project.stage || 'screening'}
                    style={{ color: STAGE_OPTIONS.find((s) => s.value === (project.stage || 'screening'))?.color }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      const newStage = e.target.value;
                      try {
                        await api.updateStage(projectId, newStage);
                        setProject((prev) => ({ ...prev, stage: newStage }));
                      } catch (err) {
                        console.error('Failed to update stage:', err);
                      }
                    }}
                  >
                    {STAGE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Glass Tab Pills */}
          <div className="tab-pills">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`tab-pill ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {tab === 'People' && project.members?.length > 0 && (
                  <span className="tab-pill-badge">{project.members.length}</span>
                )}
                {tab === 'Safety' && project.members?.some((m) =>
                  m.criminalRecordCount > 0 || m.evictionRecordCount > 0
                ) && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ca8a04', flexShrink: 0 }} />
                )}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {activeTab === 'People' && (
              <MembersTab
                members={project.members || []}
                groupAssessment={project.groupAssessment}
                onSelectMember={setSelectedMemberId}
              />
            )}
            {activeTab === 'Financials' && (
              <AnalyticsTab projectId={projectId} />
            )}
            {activeTab === 'Breakdown' && (
              <ContributionsTab
                projectId={projectId}
                members={project.members || []}
                estimatedMonthlyCost={project.estimatedMonthlyCost}
              />
            )}
            {activeTab === 'Summary' && (
              <ReportTab projectId={projectId} />
            )}
            {activeTab === 'Safety' && (
              <SafetyTab projectId={projectId} />
            )}
          </div>
        </div>
      </main>

      {selectedMemberId && (
        <MemberProfile
          projectId={projectId}
          memberId={selectedMemberId}
          memberIndex={memberIndex >= 0 ? memberIndex : 0}
          onClose={() => setSelectedMemberId(null)}
          onStatusUpdate={fetchProject}
        />
      )}
    </div>
  );
}
