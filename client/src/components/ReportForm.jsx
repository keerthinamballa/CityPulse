import React, { useState, useRef, useEffect } from 'react';
import { ISSUE_TYPES, createIssue, checkNearby, upvoteIssue } from '../utils/api';
import toast from 'react-hot-toast';

export default function ReportForm({ user, onClose, onSubmitted, mapClickLocation }) {
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [location, setLocation] = useState(mapClickLocation || null);
  const [locationError, setLocationError] = useState('');
  const [loading, setLoading] = useState(false);
  const [nearbyIssues, setNearbyIssues] = useState([]);
  const [gettingLocation, setGettingLocation] = useState(false);
  const fileRef = useRef(null);

  // Auto-detect location on mount if no map click location
  useEffect(() => {
    if (!mapClickLocation) {
      getLocation();
    }
  }, []);

  // Check for nearby duplicates when location and type are set
  useEffect(() => {
    if (location && issueType) {
      checkForDuplicates();
    }
  }, [location, issueType]);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGettingLocation(false);
      },
      (err) => {
        setGettingLocation(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError('Location access denied. Click on the map to set location.');
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationError('Location unavailable. Click on the map to set location.');
            break;
          case err.TIMEOUT:
            setLocationError('Location request timed out. Click on the map to set location.');
            break;
          default:
            setLocationError('Could not get location. Click on the map to set location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const checkForDuplicates = async () => {
    try {
      const nearby = await checkNearby(location.lat, location.lng, issueType);
      setNearbyIssues(nearby);
    } catch (err) {
      // Silent fail - dedup check is best-effort
      console.warn('Nearby check failed:', err);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUpvoteExisting = async (issueId) => {
    if (!user) {
      toast.error('Please log in to upvote');
      return;
    }
    try {
      await upvoteIssue(issueId, user.id);
      toast.success('Upvoted existing issue!');
      onClose();
    } catch (err) {
      toast.error('Failed to upvote');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!issueType) {
      toast.error('Please select an issue type');
      return;
    }
    if (!location) {
      toast.error('Location is required. Enable GPS or click on the map.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('type', issueType);
      formData.append('lat', location.lat.toString());
      formData.append('lng', location.lng.toString());
      formData.append('description', description);
      if (user) formData.append('reported_by', user.id);
      if (photo) formData.append('photo', photo);

      const result = await createIssue(formData);
      toast.success('Issue reported successfully! 📍', {
        icon: ISSUE_TYPES[issueType]?.icon || '✅',
        style: {
          background: '#1a1a3e',
          color: '#f0f0ff',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }
      });
      onSubmitted(result);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" id="report-modal">
        <div className="modal-header">
          <h2 className="modal-title">📍 Report an Issue</h2>
          <button className="modal-close" onClick={onClose} id="close-report-btn">✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {/* Issue Type */}
            <div className="form-group">
              <label className="form-label">What's the issue?</label>
              <div className="type-grid" id="issue-type-grid">
                {Object.entries(ISSUE_TYPES).map(([key, val]) => (
                  <button
                    type="button"
                    key={key}
                    className={`type-option ${issueType === key ? 'selected' : ''}`}
                    onClick={() => setIssueType(key)}
                    id={`type-option-${key}`}
                  >
                    <span className="type-icon">{val.icon}</span>
                    <span>{val.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Nearby duplicates warning */}
            {nearbyIssues.length > 0 && (
              <div className="duplicate-prompt" id="duplicate-prompt">
                <h4>⚠️ Similar issue nearby!</h4>
                <p>
                  There {nearbyIssues.length === 1 ? 'is' : 'are'} {nearbyIssues.length} similar{' '}
                  {nearbyIssues.length === 1 ? 'issue' : 'issues'} within 50m. Consider upvoting instead:
                </p>
                {nearbyIssues.map(ni => (
                  <div key={ni.id} className="duplicate-actions" style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleUpvoteExisting(ni.id)}
                    >
                      👍 Upvote "{ni.description?.slice(0, 30) || ISSUE_TYPES[ni.type]?.label}"
                      ({ni.upvotes} votes)
                    </button>
                  </div>
                ))}
                <p style={{ fontSize: 11, marginTop: 8, marginBottom: 0, opacity: 0.7 }}>
                  Or continue below to report as a new issue.
                </p>
              </div>
            )}

            {/* Location */}
            <div className="form-group">
              <label className="form-label">Location</label>
              {location ? (
                <div className="location-display success" id="location-display">
                  <span className="loc-icon">📍</span>
                  <span>
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={getLocation}
                    style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 11 }}
                  >
                    🔄 Refresh
                  </button>
                </div>
              ) : (
                <div className={`location-display ${locationError ? 'error' : ''}`} id="location-display">
                  <span className="loc-icon">{gettingLocation ? '⏳' : locationError ? '❌' : '📍'}</span>
                  <span>
                    {gettingLocation
                      ? 'Getting location...'
                      : locationError || 'Click on the map to set location'}
                  </span>
                  {!gettingLocation && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={getLocation}
                      style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 11 }}
                    >
                      📍 Detect
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Photo */}
            <div className="form-group">
              <label className="form-label">Photo (optional)</label>
              <div
                className={`photo-upload ${photoPreview ? 'has-photo' : ''}`}
                onClick={() => fileRef.current?.click()}
                id="photo-upload-area"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoChange}
                />
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="photo-preview" />
                ) : (
                  <>
                    <span className="upload-icon">📷</span>
                    <span className="upload-text">Click to add a photo</span>
                    <span className="upload-hint">JPEG, PNG, WebP • Max 10MB</span>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea
                className="form-textarea"
                placeholder="Describe the issue... e.g., Large pothole near the intersection, about 1 foot deep"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                id="issue-description"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading || !issueType || !location}
              id="submit-report-btn"
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  Submitting...
                </>
              ) : (
                <>📍 Submit Report</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
