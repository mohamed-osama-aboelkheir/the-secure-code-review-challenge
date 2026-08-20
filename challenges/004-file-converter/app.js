const express = require('express');
const session = require('express-session');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
require('dotenv').config();

const DatabaseStore = require('./src/store/database');
const authRoutes = require('./src/routes/auth');
const convertRoutes = require('./src/routes/convert');
const { setDatabase: setAuthDatabase } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new DatabaseStore();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

// Session configuration
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret === 'change-me-in-production-make-it-long-and-random') {
  console.warn('WARNING: Using default session secret. Change SESSION_SECRET in production!');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Set database for routes and middleware
setAuthDatabase(db);
authRoutes.setDatabase(db);
convertRoutes.setDatabase(db);

// Routes
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

// Root endpoint
app.get('/', (req, res) => {
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

// Initialize database and start server
async function startServer() {
  try {
    await db.connect();
    console.log('Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API root: http://localhost:${PORT}/`);
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
