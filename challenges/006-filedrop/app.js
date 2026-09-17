const express = require('express');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DatabaseStore = require('./src/store/database');
const seedDemoData = require('./src/store/seed');
const authRoutes = require('./src/routes/auth');
const filesRoutes = require('./src/routes/files');
const { requireAuth, setDatabase: setAuthDatabase } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(__dirname, 'data', 'files');

// Tokens are signed with a secret that comes from the environment only: there
// is no in-code default to fall back to, so a missing value stops the server.
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

// Initialize database
const db = new DatabaseStore();

// Each account gets its own area under the storage root; the root itself has to
// exist before the first upload lands.
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

// Response headers for the browser-facing app
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Set database for routes and middleware
setAuthDatabase(db);
authRoutes.setDatabase(db);

// JSON API
app.use('/api/auth', authRoutes);
app.use('/api/files', requireAuth, filesRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'FileDrop API is running',
    timestamp: new Date().toISOString()
  });
});

// API information endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'FileDrop Service API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me'
      },
      files: {
        list: 'GET /api/files',
        upload: 'POST /api/files',
        download: 'GET /api/files/:filename/download',
        remove: 'DELETE /api/files/:filename'
      }
    }
  });
});

// The React single-page app: static assets first, then the catch-all that hands
// every other path back to index.html so client-side routing works on reload.
const WEB_DIST = path.join(__dirname, 'web', 'dist');
app.use(express.static(WEB_DIST));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(WEB_DIST, 'index.html'), (err) => {
    if (err) {
      res.status(500).send('Web UI is not built. Run: npm run build:web');
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await db.connect();
    console.log('Database connected successfully');

    await seedDemoData(db, STORAGE_ROOT);

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Web UI:       http://localhost:${PORT}/`);
      console.log(`API root:     http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await db.close();
  process.exit(0);
});

startServer();
