const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const DatabaseStore = require('./src/store/database');
const authRoutes = require('./src/routes/auth');
const courseRoutes = require('./src/routes/courses');
const adminRoutes = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new DatabaseStore();

// View engine for the browser UI
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static assets for the UI
app.use('/static', express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/admin', adminRoutes);

// Browser UI. This is the only non-API route; all data and actions go through
// the existing /api routes above. `?logout` reuses this same route to clear the
// session cookies rather than adding a dedicated logout endpoint.
app.get('/', (req, res) => {
  if (req.query.logout !== undefined) {
    res.clearCookie('token');
    return res.redirect('/');
  }

  let user = null;
  const token = req.cookies && req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = { username: decoded.username, role: decoded.role };
    } catch (err) {
      user = null; // expired/invalid cookie -> treat as logged out
    }
  }

  res.render('index', { user });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Schooled API is running' });
});

// Initialize database and start server
async function startServer() {
  try {
    await db.init();
    console.log('Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
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

// Only start (and connect to the DB) when run directly, e.g. `node server.js`.
if (require.main === module) {
  startServer();
}

module.exports = app;
