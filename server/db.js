import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'citypulse.db');

let db;

export async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('pothole', 'garbage', 'flood', 'streetlight', 'graffiti', 'other')),
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      photo_url TEXT,
      description TEXT,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved')),
      upvotes INTEGER DEFAULT 1,
      reported_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS upvotes (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(issue_id, user_id)
    )
  `);

  // Create indices (ignore errors if they already exist)
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_issues_lat_lng ON issues(lat, lng)`); } catch {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)`); } catch {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type)`); } catch {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_upvotes_issue ON upvotes(issue_id)`); } catch {}
  try { db.run(`CREATE INDEX IF NOT EXISTS idx_upvotes_user ON upvotes(user_id)`); } catch {}

  // Seed demo users if none exist
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  const count = result[0]?.values[0]?.[0] || 0;

  if (count === 0) {
    const demoUsers = [
      { id: uuidv4(), username: 'citizen_jane', display_name: 'Jane Cooper', avatar_color: '#8b5cf6' },
      { id: uuidv4(), username: 'city_official', display_name: 'City Official', avatar_color: '#059669' },
      { id: uuidv4(), username: 'concerned_pete', display_name: 'Pete Wilson', avatar_color: '#d97706' },
    ];
    const stmt = db.prepare('INSERT INTO users (id, username, display_name, avatar_color) VALUES (?, ?, ?, ?)');
    for (const u of demoUsers) {
      stmt.run([u.id, u.username, u.display_name, u.avatar_color]);
    }
    stmt.free();
    saveDB();
  }

  return db;
}

// Helper to save DB to disk
export function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Helper wrappers that match the better-sqlite3 API style
export function getDB() {
  return db;
}

// Run a query and return all results as array of objects
export function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('Query error:', sql, err.message);
    return [];
  }
}

// Run a query and return the first result as an object
export function queryOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch (err) {
    console.error('Query error:', sql, err.message);
    return null;
  }
}

// Execute a statement (INSERT, UPDATE, DELETE)
export function execute(sql, params = []) {
  try {
    db.run(sql, params);
    saveDB(); // Auto-save after writes
  } catch (err) {
    console.error('Execute error:', sql, err.message);
    throw err;
  }
}

export default { initDB, getDB, queryAll, queryOne, execute, saveDB };
