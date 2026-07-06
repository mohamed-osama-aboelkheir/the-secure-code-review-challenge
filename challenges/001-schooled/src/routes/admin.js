const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const DatabaseStore = require('../store/database');

const router = express.Router();
const db = new DatabaseStore();

// Apply authentication and admin role requirement to all admin routes
router.use(authenticateToken, requireRole('admin'));

// Get all users (admin only)
router.get('/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific user details (admin only)
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db.findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Promote user to admin
router.post('/users/:id/promote', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db.findUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'User is already an admin' });
    }

    await db.updateUserRole(userId, 'admin');
    res.json({ message: 'User promoted to admin successfully' });
  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
