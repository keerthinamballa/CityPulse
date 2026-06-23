const API_BASE = '/api';

export async function fetchIssues(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.type) params.set('type', filters.type);
  if (filters.bounds) params.set('bounds', filters.bounds);
  
  const res = await fetch(`${API_BASE}/issues?${params}`);
  if (!res.ok) throw new Error('Failed to fetch issues');
  const data = await res.json();
  return data.data;
}

export async function fetchIssue(id) {
  const res = await fetch(`${API_BASE}/issues/${id}`);
  if (!res.ok) throw new Error('Failed to fetch issue');
  const data = await res.json();
  return data.data;
}

export async function createIssue(formData) {
  const res = await fetch(`${API_BASE}/issues`, {
    method: 'POST',
    body: formData // FormData - don't set Content-Type, let browser handle it
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create issue');
  }
  const data = await res.json();
  return data.data;
}

export async function checkNearby(lat, lng, type) {
  const res = await fetch(`${API_BASE}/issues/check-nearby`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, type })
  });
  if (!res.ok) throw new Error('Failed to check nearby');
  const data = await res.json();
  return data.data;
}

export async function upvoteIssue(issueId, userId) {
  const res = await fetch(`${API_BASE}/issues/${issueId}/upvote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  if (!res.ok) throw new Error('Failed to upvote');
  const data = await res.json();
  return data;
}

export async function updateIssueStatus(issueId, status) {
  const res = await fetch(`${API_BASE}/issues/${issueId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Failed to update status');
  const data = await res.json();
  return data.data;
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/issues/stats/summary`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  const data = await res.json();
  return data.data;
}

export async function loginUser(username, displayName) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, display_name: displayName })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to login');
  }
  const data = await res.json();
  return data.data;
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  const data = await res.json();
  return data.data;
}

export async function fetchUserUpvotes(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/upvotes`);
  if (!res.ok) throw new Error('Failed to fetch upvotes');
  const data = await res.json();
  return data.data;
}

// Issue type configuration
export const ISSUE_TYPES = {
  pothole: { label: 'Pothole', icon: '🕳️', color: '#ef4444' },
  garbage: { label: 'Garbage', icon: '🗑️', color: '#f59e0b' },
  flood: { label: 'Flood', icon: '🌊', color: '#3b82f6' },
  streetlight: { label: 'Street Light', icon: '💡', color: '#a855f7' },
  graffiti: { label: 'Graffiti', icon: '🎨', color: '#ec4899' },
  other: { label: 'Other', icon: '⚠️', color: '#6b7280' }
};

export const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved'
};

export function timeAgo(dateStr) {
  if (!dateStr) return 'unknown';
  
  const now = new Date();
  // SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' which 
  // browsers often interpret as local time. We must ensure it's treated as UTC.
  let isoStr = dateStr;
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    isoStr = dateStr.replace(' ', 'T') + 'Z';
  }
  
  const date = new Date(isoStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
