const DatabaseStore = require('../store/database');

let db = null;

function setDatabase(database) {
  db = database;
}

const requireAuth = async (req, res, next) => {
  if (!db) {
    return res.status(500).json({ error: 'Database not initialized' });
  }

  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await db.findUserById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  requireAuth,
  setDatabase
};
