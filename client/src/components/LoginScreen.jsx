import React, { useState } from 'react';
import { loginUser } from '../utils/api';
import toast from 'react-hot-toast';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim().toLowerCase().replace(/\s+/g, '_');
    const trimmedName = displayName.trim();

    if (!trimmedUsername || !trimmedName) {
      toast.error('Both fields are required');
      return;
    }

    if (trimmedUsername.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      const user = await loginUser(trimmedUsername, trimmedName);
      // Save to localStorage for persistence
      localStorage.setItem('citypulse_user', JSON.stringify(user));
      toast.success(`Welcome, ${user.display_name}! 🎉`, {
        style: {
          background: '#1a1a3e',
          color: '#f0f0ff',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }
      });
      onLogin(user);
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (preset) => {
    setLoading(true);
    try {
      const user = await loginUser(preset.username, preset.display_name);
      localStorage.setItem('citypulse_user', JSON.stringify(user));
      toast.success(`Welcome, ${user.display_name}! 🎉`, {
        style: {
          background: '#1a1a3e',
          color: '#f0f0ff',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }
      });
      onLogin(user);
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen" id="login-screen">
      <div className="login-card">
        <div className="login-logo">CP</div>
        <h1>CityPulse</h1>
        <p className="login-sub">
          Report city issues in real-time. See what's happening around you.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., john_doe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              id="login-username"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              id="login-display-name"
              autoComplete="name"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            id="login-btn"
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18 }} />
                Joining...
              </>
            ) : (
              '🚀 Join CityPulse'
            )}
          </button>
        </form>

        <div style={{ margin: '24px 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
          Or try a demo account:
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => handleQuickLogin({ username: 'citizen_jane', display_name: 'Jane Cooper' })}
            disabled={loading}
            id="demo-citizen-btn"
          >
            👤 Citizen Jane
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => handleQuickLogin({ username: 'city_official', display_name: 'City Official' })}
            disabled={loading}
            id="demo-official-btn"
          >
            🏛️ City Official
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => handleQuickLogin({ username: 'concerned_pete', display_name: 'Pete Wilson' })}
            disabled={loading}
            id="demo-pete-btn"
          >
            👷 Pete Wilson
          </button>
        </div>
      </div>
    </div>
  );
}
