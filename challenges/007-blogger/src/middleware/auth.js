const jwt = require('jsonwebtoken');

let db = null;

function setDatabase(database) {
  db = database;
}

const requireAuth = async (req, res, next) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    const user = await db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const optionalAuth = async (req, res, next) => {
  if (!db) return next();

  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) return next();

  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, secret);
    const user = await db.findUserById(decoded.userId);
    if (user) {
      req.user = { id: user.id, username: user.username, email: user.email };
    }
  } catch (_) {}
  next();
};

module.exports = {
  requireAuth,
  optionalAuth,
  setDatabase
};
