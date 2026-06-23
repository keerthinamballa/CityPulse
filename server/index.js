import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import issuesRouter from './routes/issues.js';
import usersRouter from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Initialize DB then start server
initDB().then(() => {
  console.log('✅ SQLite Database initialized');
}).catch(err => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Attach io to request for broadcasting from routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/issues', issuesRouter);
app.use('/api/users', usersRouter);

// Serve frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Socket.io connection handling
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`🟢 Client connected (${connectedClients} total)`);

  // Broadcast active user count
  io.emit('users:count', connectedClients);

  socket.on('disconnect', () => {
    connectedClients--;
    console.log(`🔴 Client disconnected (${connectedClients} total)`);
    io.emit('users:count', connectedClients);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.message?.includes('Only image files')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🏙️  CityPulse API running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`📁 Uploads dir: ${path.join(__dirname, 'uploads')}\n`);
});
