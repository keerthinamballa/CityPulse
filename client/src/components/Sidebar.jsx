import React, { useState, useMemo } from 'react';
import { ISSUE_TYPES, STATUS_LABELS, timeAgo, upvoteIssue, updateIssueStatus } from '../utils/api';
import toast from 'react-hot-toast';

export default function Sidebar({
  issues,
  user,
  userUpvotes,
  onIssueClick,
  onClose,
  isOpen,
  stats,
  onUpvote,
  onStatusChange,
  filter,
  onFilterChange
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredIssues = useMemo(() => {
    let filtered = [...issues];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(i => i.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(i => i.type === typeFilter);
    }

    return filtered;
  }, [issues, statusFilter, typeFilter]);

  const handleUpvote = async (e, issue) => {
    e.stopPropagation();
    if (!user) {
      toast.error('Please log in to upvote');
      return;
    }
    try {
      await onUpvote(issue.id);
    } catch (err) {
      toast.error('Failed to upvote');
    }
  };

  const handleStatusUpdate = async (e, issueId, status) => {
    e.stopPropagation();
    try {
      await onStatusChange(issueId, status);
      toast.success(`Status updated to ${STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? '' : 'collapsed'}`} id="issues-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Issues ({filteredIssues.length})</h2>
        <button className="sidebar-close" onClick={onClose} id="close-sidebar-btn">✕</button>
      </div>

      <div className="sidebar-content">
        {/* Stats */}
        {stats && (
          <div className="stats-bar" id="stats-bar">
            <div className="stat-chip">
              <span className="stat-value">{stats.open || 0}</span>
              <span className="stat-label">Open</span>
            </div>
            <div className="stat-chip">
              <span className="stat-value">{stats.inProgress || 0}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat-chip">
              <span className="stat-value">{stats.resolved || 0}</span>
              <span className="stat-label">Fixed</span>
            </div>
          </div>
        )}

        {/* Status Filter */}
        <div className="filter-tabs" id="status-filter">
          {['all', 'open', 'in_progress', 'resolved'].map(s => (
            <button
              key={s}
              className={`filter-tab ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : s === 'in_progress' ? 'Active' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="filter-tabs" id="type-filter" style={{ marginBottom: 16 }}>
          <button
            className={`filter-tab ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All Types
          </button>
          {Object.entries(ISSUE_TYPES).map(([key, val]) => (
            <button
              key={key}
              className={`filter-tab ${typeFilter === key ? 'active' : ''}`}
              onClick={() => setTypeFilter(key)}
            >
              {val.icon}
            </button>
          ))}
        </div>

        {/* Issue List */}
        <div className="issue-list" id="issue-list">
          {filteredIssues.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📍</div>
              <h3>No issues found</h3>
              <p>Try adjusting your filters or report a new issue</p>
            </div>
          ) : (
            filteredIssues.map(issue => {
              const config = ISSUE_TYPES[issue.type] || ISSUE_TYPES.other;
              const isUpvoted = userUpvotes.includes(issue.id);

              return (
                <div
                  key={issue.id}
                  className="issue-card"
                  onClick={() => onIssueClick(issue)}
                  id={`issue-card-${issue.id}`}
                >
                  <div className="issue-card-header">
                    <span className={`issue-type-badge ${issue.type}`}>
                      {config.icon} {config.label}
                    </span>
                    <span className={`issue-status-badge ${issue.status}`}>
                      {STATUS_LABELS[issue.status]}
                    </span>
                  </div>

                  {issue.photo_url && (
                    <img
                      src={issue.photo_url}
                      alt="Issue"
                      style={{
                        width: '100%',
                        height: 100,
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: 8
                      }}
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}

                  {issue.description && (
                    <p className="issue-card-description">{issue.description}</p>
                  )}

                  <div className="issue-card-footer">
                    <div className="issue-card-meta">
                      <span>👤 {issue.display_name || 'Anon'}</span>
                      <span>⏱ {timeAgo(issue.created_at)}</span>
                    </div>
                    <button
                      className={`upvote-btn ${isUpvoted ? 'active' : ''}`}
                      onClick={(e) => handleUpvote(e, issue)}
                      id={`upvote-btn-${issue.id}`}
                      title={isUpvoted ? 'Remove upvote' : 'Upvote this issue'}
                    >
                      👍 {issue.upvotes}
                    </button>
                  </div>

                  {/* Status controls - show for all users */}
                  {issue.status !== 'resolved' && (
                    <div className="status-selector">
                      {['open', 'in_progress', 'resolved'].map(s => (
                        <button
                          key={s}
                          className={`status-option ${issue.status === s ? `active-${s}` : ''}`}
                          onClick={(e) => handleStatusUpdate(e, issue.id, s)}
                          disabled={issue.status === s}
                        >
                          {s === 'in_progress' ? '🔧 Active' : s === 'resolved' ? '✅ Resolve' : '🔴 Open'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
