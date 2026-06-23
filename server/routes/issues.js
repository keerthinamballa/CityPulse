import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'), false);
    }
  }
});

// Haversine formula for distance between two GPS coordinates (in meters)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/issues/stats/summary - Get issue statistics (must be before /:id)
router.get('/stats/summary', (req, res) => {
  try {
    const total = queryOne('SELECT COUNT(*) as count FROM issues')?.count || 0;
    const open = queryOne("SELECT COUNT(*) as count FROM issues WHERE status = 'open'")?.count || 0;
    const inProgress = queryOne("SELECT COUNT(*) as count FROM issues WHERE status = 'in_progress'")?.count || 0;
    const resolved = queryOne("SELECT COUNT(*) as count FROM issues WHERE status = 'resolved'")?.count || 0;

    const byType = queryAll('SELECT type, COUNT(*) as count FROM issues GROUP BY type ORDER BY count DESC');

    const recentlyResolved = queryOne(
      "SELECT COUNT(*) as count FROM issues WHERE status = 'resolved' AND resolved_at > datetime('now', '-7 days')"
    )?.count || 0;

    res.json({
      success: true,
      data: { total, open, inProgress, resolved, byType, recentlyResolved }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// GET /api/issues - Fetch all issues with optional filters
router.get('/', (req, res) => {
  try {
    const { status, type, bounds } = req.query;
    let query = `
      SELECT i.*, u.username, u.display_name, u.avatar_color
      FROM issues i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND i.status = ?`;
      params.push(status);
    }

    if (type && type !== 'all') {
      query += ` AND i.type = ?`;
      params.push(type);
    }

    if (bounds) {
      try {
        const [south, west, north, east] = bounds.split(',').map(Number);
        query += ` AND i.lat BETWEEN ? AND ? AND i.lng BETWEEN ? AND ?`;
        params.push(south, north, west, east);
      } catch (e) { /* skip */ }
    }

    query += ` ORDER BY i.created_at DESC`;

    const issues = queryAll(query, params);
    res.json({ success: true, data: issues });
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch issues' });
  }
});

// GET /api/issues/:id - Fetch single issue
router.get('/:id', (req, res) => {
  try {
    const issue = queryOne(`
      SELECT i.*, u.username, u.display_name, u.avatar_color
      FROM issues i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    const upvoters = queryAll(`
      SELECT u.display_name, u.avatar_color
      FROM upvotes up
      JOIN users u ON up.user_id = u.id
      WHERE up.issue_id = ?
    `, [req.params.id]);

    res.json({ success: true, data: { ...issue, upvoters } });
  } catch (error) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch issue' });
  }
});

// POST /api/issues/check-nearby - Check for nearby duplicate issues
router.post('/check-nearby', (req, res) => {
  try {
    const { lat, lng, type } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'lat and lng are required' });
    }

    const delta = 0.0005;
    let query = `
      SELECT i.*, u.display_name
      FROM issues i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.status != 'resolved'
        AND i.lat BETWEEN ? AND ?
        AND i.lng BETWEEN ? AND ?
    `;
    const params = [lat - delta, lat + delta, lng - delta, lng + delta];

    if (type) {
      query += ' AND i.type = ?';
      params.push(type);
    }

    const candidates = queryAll(query, params);
    const nearby = candidates.filter(issue =>
      haversineDistance(lat, lng, issue.lat, issue.lng) <= 50
    );

    res.json({ success: true, data: nearby });
  } catch (error) {
    console.error('Error checking nearby:', error);
    res.status(500).json({ success: false, error: 'Failed to check nearby issues' });
  }
});

// POST /api/issues - Create a new issue
router.post('/', upload.single('photo'), (req, res) => {
  try {
    const { type, lat, lng, description, reported_by } = req.body;

    if (!type || !lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'type, lat, and lng are required fields'
      });
    }

    const validTypes = ['pothole', 'garbage', 'flood', 'streetlight', 'graffiti', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({ success: false, error: 'Invalid coordinates' });
    }

    const id = uuidv4();
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    let userId = reported_by;
    if (userId) {
      const user = queryOne('SELECT id FROM users WHERE id = ?', [userId]);
      if (!user) userId = null;
    }

    execute(
      'INSERT INTO issues (id, type, lat, lng, photo_url, description, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, type, parsedLat, parsedLng, photo_url, description || null, userId || null]
    );

    if (userId) {
      try {
        execute('INSERT INTO upvotes (id, issue_id, user_id) VALUES (?, ?, ?)', [uuidv4(), id, userId]);
      } catch { /* ignore duplicate */ }
    }

    const issue = queryOne(`
      SELECT i.*, u.username, u.display_name, u.avatar_color
      FROM issues i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.id = ?
    `, [id]);

    if (req.io) {
      req.io.emit('issue:created', issue);
    }

    res.status(201).json({ success: true, data: issue });
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ success: false, error: 'Failed to create issue' });
  }
});

// POST /api/issues/:id/upvote - Upvote an issue
router.post('/:id/upvote', (req, res) => {
  try {
    const { user_id } = req.body;
    const issueId = req.params.id;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }

    const issue = queryOne('SELECT * FROM issues WHERE id = ?', [issueId]);
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    const existing = queryOne('SELECT id FROM upvotes WHERE issue_id = ? AND user_id = ?', [issueId, user_id]);
    
    if (existing) {
      execute('DELETE FROM upvotes WHERE issue_id = ? AND user_id = ?', [issueId, user_id]);
      execute('UPDATE issues SET upvotes = MAX(0, upvotes - 1) WHERE id = ?', [issueId]);
    } else {
      execute('INSERT INTO upvotes (id, issue_id, user_id) VALUES (?, ?, ?)', [uuidv4(), issueId, user_id]);
      execute('UPDATE issues SET upvotes = upvotes + 1 WHERE id = ?', [issueId]);
    }

    const updated = queryOne(`
      SELECT i.*, u.username, u.display_name, u.avatar_color
      FROM issues i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.id = ?
    `, [issueId]);

    if (req.io) {
      req.io.emit('issue:updated', updated);
    }

    res.json({ success: true, data: updated, action: existing ? 'removed' : 'added' });
  } catch (error) {
    console.error('Error upvoting:', error);
    res.status(500).json({ success: false, error: 'Failed to upvote' });
  }
});

// PATCH /api/issues/:id/status - Update issue status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const issue = queryOne('SELECT * FROM issues WHERE id = ?', [req.params.id]);
    if (!issue) {
      return res.status(404).json({ success: false, error: 'Issue not found' });
    }

    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
    execute('UPDATE issues SET status = ?, resolved_at = ? WHERE id = ?', [status, resolvedAt, req.params.id]);

    const updated = queryOne(`
      SELECT i.*, u.username, u.display_name, u.avatar_color
      FROM issues i
      LEFT JOIN users u ON i.reported_by = u.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (req.io) {
      req.io.emit('issue:updated', updated);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

export default router;
