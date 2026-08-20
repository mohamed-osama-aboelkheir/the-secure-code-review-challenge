const express = require('express');
const session = require('express-session');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
require('dotenv').config();

const DatabaseStore = require('./src/store/database');
const authRoutes = require('./src/routes/auth');
const convertRoutes = require('./src/routes/convert');
const uiRoutes = require('./src/routes/ui');
const uploadService = require('./src/services/upload');
const { setDatabase: setAuthDatabase } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new DatabaseStore();

// View engine for the server-rendered UI
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(express.static(path.join(__dirname, 'public')));

// Response headers for the browser-facing pages
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Session configuration. The secret comes from the environment only: there is
// no in-code default to fall back to, so a missing value stops the server.
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error('SESSION_SECRET is not set. Refusing to start.');
  process.exit(1);
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    // Lax keeps the cookie off cross-site form posts, so a form on another
    // origin cannot drive the UI's state-changing routes as the signed-in user.
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Set database for routes and middleware
setAuthDatabase(db);
authRoutes.setDatabase(db);
convertRoutes.setDatabase(db);
uiRoutes.setDatabase(db);
uploadService.setDatabase(db);

// JSON API
app.use('/api/auth', authRoutes);
app.use('/api', convertRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'File Converter API is running',
    timestamp: new Date().toISOString()
  });
});

// API information endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'File Converter Service API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout'
      },
      convert: {
        submit: 'POST /api/convert',
        status: 'GET /api/convert/:jobId',
        download: 'GET /api/convert/:jobId/download'
      }
    }
  });
});

// Server-rendered UI (mounted last so the API keeps its own paths)
app.use('/', uiRoutes);

// Initialize database and start server
async function startServer() {
  try {
    await db.connect();
    console.log('Database connected successfully');
    
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
