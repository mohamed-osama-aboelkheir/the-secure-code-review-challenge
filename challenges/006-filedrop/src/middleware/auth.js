const jwt = require('jsonwebtoken');

let db = null;

function setDatabase(database) {
  db = database;
}

// Bearer tokens only: the browser app keeps its token in memory / local storage
// and sends it on the Authorization header, so no ambient credential is
// attached to cross-site requests.
const requireAuth = async (req, res, next) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
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
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = {
  requireAuth,
  setDatabase
};
