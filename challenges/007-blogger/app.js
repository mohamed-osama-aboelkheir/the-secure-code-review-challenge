require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const nunjucks = require('nunjucks');

const DatabaseStore = require('./src/store/database');
const authRoutes = require('./src/routes/auth');
const postsRoutes = require('./src/routes/posts');
const pagesRoutes = require('./src/routes/pages');
const { optionalAuth, setDatabase } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new DatabaseStore();
setDatabase(db);
authRoutes.setDatabase(db);
postsRoutes.setDatabase(db);
pagesRoutes.setDatabase(db);

const viewsPath = path.join(__dirname, 'views');
const env = nunjucks.configure(viewsPath, {
  autoescape: true,
  express: app,
  noCache: process.env.NODE_ENV !== 'production'
});
env.addFilter('date', (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : ''));
app.set('view engine', 'html');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/', optionalAuth, pagesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/posts', optionalAuth, postsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Blogger is running', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    const knex = require('./src/config/knex');
    await knex.migrate.latest();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

function waitForDb() {
  return new Promise((resolve, reject) => {
    const knex = require('./src/config/knex');
    const attempt = () => {
      knex.raw('SELECT 1')
        .then(() => resolve())
        .catch((err) => {
          console.log('Waiting for database...');
          setTimeout(attempt, 2000);
        });
    };
    attempt();
  });
}

waitForDb()
  .then(() => startServer())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
