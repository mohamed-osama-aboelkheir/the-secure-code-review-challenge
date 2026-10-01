const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
let db = null;

function setDatabase(database) {
  db = database;
}

function issueToken(user) {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  return jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    secret,
    { expiresIn: '7d' }
  );
}

const cookieOptions = {
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  sameSite: 'lax'
};

function isWebForm(req) {
  return req.body && req.body.web === '1';
}

router.post('/register', async (req, res) => {
  try {
    if (!db) {
      if (isWebForm(req)) return res.redirect('/register?error=' + encodeURIComponent('Server error'));
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      if (isWebForm(req)) return res.redirect('/register?error=' + encodeURIComponent('All fields are required'));
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingByUsername = await db.findUserByUsername(username);
    if (existingByUsername) {
      if (isWebForm(req)) return res.redirect('/register?error=' + encodeURIComponent('Username already exists'));
      return res.status(409).json({ error: 'Username already exists' });
    }

    const existingByEmail = await db.findUserByEmail(email);
    if (existingByEmail) {
      if (isWebForm(req)) return res.redirect('/register?error=' + encodeURIComponent('Email already exists'));
      return res.status(409).json({ error: 'Email already exists' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await db.createUser(username, email, passwordHash);
    if (!user) {
      if (isWebForm(req)) return res.redirect('/register?error=' + encodeURIComponent('Registration failed'));
      return res.status(500).json({ error: 'Registration failed' });
    }

    const token = issueToken(user);

    if (isWebForm(req)) {
      res.cookie('token', token, cookieOptions);
      return res.redirect('/my-posts');
    }

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (isWebForm(req)) return res.redirect('/register?error=' + encodeURIComponent('Registration failed'));
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    if (!db) {
      if (isWebForm(req)) return res.redirect('/login?error=' + encodeURIComponent('Server error'));
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      if (isWebForm(req)) return res.redirect('/login?error=' + encodeURIComponent('Username and password are required'));
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.findUserByUsername(username);
    if (!user) {
      if (isWebForm(req)) return res.redirect('/login?error=' + encodeURIComponent('Invalid credentials'));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      if (isWebForm(req)) return res.redirect('/login?error=' + encodeURIComponent('Invalid credentials'));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(user);

    if (isWebForm(req)) {
      res.cookie('token', token, cookieOptions);
      return res.redirect('/my-posts');
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    if (isWebForm(req)) return res.redirect('/login?error=' + encodeURIComponent('Login failed'));
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.setDatabase = setDatabase;
