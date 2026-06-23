import React from 'react';
import { useSocket } from '../context/SocketContext';

export default function Header({ user, onToggleSidebar, sidebarOpen }) {
  const { connected, onlineCount } = useSocket();

  return (
    <header className="header" id="app-header">
      <div className="header-brand">
        <div className="header-logo">CP</div>
        <span className="header-title">CityPulse</span>
        <span className="header-subtitle">Real-time City Issues</span>
      </div>

      <div className="header-actions">
        <div className="header-stat" id="connection-status">
          <span className="dot" style={{ 
            background: connected ? 'var(--success)' : 'var(--danger)',
            animation: connected ? 'pulse-dot 2s infinite' : 'none'
          }} />
          <span>{connected ? `${onlineCount} online` : 'Reconnecting...'}</span>
        </div>

        {user && (
          <div className="header-user-section">
            <div className="user-chip" id="user-chip" title={`Logged in as ${user.display_name}`}>
              <div className="user-avatar" style={{ backgroundColor: user.avatar_color }}>
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <span className="user-name">{user.display_name}</span>
            </div>
            <button 
              className="logout-btn" 
              onClick={() => {
                localStorage.removeItem('citypulse_user');
                window.location.reload();
              }}
              title="Logout"
            >
              Logout
            </button>
          </div>
        )}

        <button
          className="sidebar-close mobile-only"
          onClick={onToggleSidebar}
          id="toggle-sidebar-btn"
          title={sidebarOpen ? 'Close sidebar' : 'Open issue list'}
          style={{ background: sidebarOpen ? 'var(--accent-primary)' : 'var(--bg-glass-light)' }}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
      </div>
    </header>
  );
}
