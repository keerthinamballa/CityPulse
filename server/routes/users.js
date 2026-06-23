import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db.js';

const router = Router();

// GET /api/users - Get all users
router.get('/', (req, res) => {
  try {
    const users = queryAll('SELECT id, username, display_name, avatar_color, created_at FROM users');
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// POST /api/users - Create or get user (simple auth)
router.post('/', (req, res) => {
  try {
    const { username, display_name } = req.body;

    if (!username || !display_name) {
      return res.status(400).json({ success: false, error: 'username and display_name are required' });
    }

    // Check if user exists
    const existing = queryOne('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.json({ success: true, data: existing, existing: true });
    }

    // Create new user
    const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];
    const id = uuidv4();
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];

    execute(
      'INSERT INTO users (id, username, display_name, avatar_color) VALUES (?, ?, ?, ?)',
      [id, username, display_name, avatar_color]
    );

    const user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: user, existing: false });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ success: false, error: 'Username already taken' });
    }
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// GET /api/users/:id/upvotes - Get issues upvoted by user
router.get('/:id/upvotes', (req, res) => {
  try {
    const upvoted = queryAll('SELECT issue_id FROM upvotes WHERE user_id = ?', [req.params.id]);
    const upvotedIds = upvoted.map(r => r.issue_id);
    res.json({ success: true, data: upvotedIds });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch upvotes' });
  }
});

export default router;
