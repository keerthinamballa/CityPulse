import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { SocketProvider, useSocket } from './context/SocketContext';
import Header from './components/Header';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import ReportForm from './components/ReportForm';
import LoginScreen from './components/LoginScreen';
import {
  fetchIssues,
  fetchStats,
  fetchUserUpvotes,
  upvoteIssue,
  updateIssueStatus,
  ISSUE_TYPES
} from './utils/api';

function AppContent() {
  const [user, setUser] = useState(null);
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [userUpvotes, setUserUpvotes] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [mapClickLocation, setMapClickLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  const { socket } = useSocket();

  // Check for saved user session
  useEffect(() => {
    const saved = localStorage.getItem('citypulse_user');
    if (saved) {
      try {
        const parsedUser = JSON.parse(saved);
        setUser(parsedUser);
      } catch {
        localStorage.removeItem('citypulse_user');
      }
    }
  }, []);

  // Load issues and stats
  const loadData = useCallback(async () => {
    try {
      const [issuesData, statsData] = await Promise.all([
        fetchIssues(),
        fetchStats()
      ]);
      setIssues(issuesData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load data:', err);
      toast.error('Failed to load issues. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load user upvotes
  const loadUserUpvotes = useCallback(async () => {
    if (!user) return;
    try {
      const upvotes = await fetchUserUpvotes(user.id);
      setUserUpvotes(upvotes);
    } catch (err) {
      console.warn('Failed to load upvotes:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
      loadUserUpvotes();
    }
  }, [user, loadData, loadUserUpvotes]);

  // Socket.io real-time event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewIssue = (issue) => {
      setIssues(prev => {
        // Avoid duplicates
        if (prev.some(i => i.id === issue.id)) return prev;
        return [issue, ...prev];
      });

      // Update stats
      setStats(prev => prev ? {
        ...prev,
        total: (prev.total || 0) + 1,
        open: (prev.open || 0) + 1
      } : prev);

      // Show toast notification
      const config = ISSUE_TYPES[issue.type] || ISSUE_TYPES.other;
      toast(`New ${config.label} reported nearby!`, {
        icon: config.icon,
        style: {
          background: '#1a1a3e',
          color: '#f0f0ff',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        },
        duration: 4000
      });
    };

    const handleUpdatedIssue = (issue) => {
      setIssues(prev =>
        prev.map(i => i.id === issue.id ? issue : i)
      );
    };

    socket.on('issue:created', handleNewIssue);
    socket.on('issue:updated', handleUpdatedIssue);

    return () => {
      socket.off('issue:created', handleNewIssue);
      socket.off('issue:updated', handleUpdatedIssue);
    };
  }, [socket]);

  // Handle upvote
  const handleUpvote = async (issueId) => {
    if (!user) {
      toast.error('Please log in to upvote');
      return;
    }
    const result = await upvoteIssue(issueId, user.id);
    setUserUpvotes(prev =>
      result.action === 'added'
        ? [...prev, issueId]
        : prev.filter(id => id !== issueId)
    );
  };

  // Handle status change
  const handleStatusChange = async (issueId, status) => {
    await updateIssueStatus(issueId, status);
  };

  // Handle issue click from sidebar
  const handleIssueClick = (issue) => {
    setSelectedIssue(issue);
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  // Handle map click (for setting report location)
  const handleMapClick = (latlng) => {
    if (showReportForm) {
      setMapClickLocation({ lat: latlng.lat, lng: latlng.lng });
    }
  };

  // Handle report submission
  const handleReportSubmitted = (newIssue) => {
    setMapClickLocation(null);
    loadData(); // Refresh stats
    loadUserUpvotes();
  };

  // Login handler
  const handleLogin = (userData) => {
    setUser(userData);
  };

  // Show login screen if not authenticated
  if (!user) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <div className="app">
      <Header
        user={user}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      <div className="app-main">
        <MapView
          issues={issues}
          onIssueClick={handleIssueClick}
          onMapClick={handleMapClick}
          selectedIssue={selectedIssue}
        />

        <Sidebar
          issues={issues}
          user={user}
          userUpvotes={userUpvotes}
          onIssueClick={handleIssueClick}
          onClose={() => setSidebarOpen(false)}
          isOpen={sidebarOpen}
          stats={stats}
          onUpvote={handleUpvote}
          onStatusChange={handleStatusChange}
        />

        {/* FAB buttons */}
        <div className="fab-container">
          <button
            className="fab-btn secondary"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Toggle issue list"
            id="toggle-list-fab"
          >
            {sidebarOpen ? '📋' : '📋'}
          </button>
          <button
            className="fab-btn"
            onClick={() => setShowReportForm(true)}
            title="Report an issue"
            id="report-issue-fab"
          >
            ＋
          </button>
        </div>

        {/* Report Form Modal */}
        {showReportForm && (
          <ReportForm
            user={user}
            onClose={() => {
              setShowReportForm(false);
              setMapClickLocation(null);
            }}
            onSubmitted={handleReportSubmitted}
            mapClickLocation={mapClickLocation}
          />
        )}
      </div>

      {/* Loading overlay for initial load */}
      {loading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-overlay)',
          zIndex: 500
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading CityPulse...</div>
          </div>
        </div>
      )}

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
}
