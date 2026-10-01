const express = require('express');
const router = express.Router();
let db = null;

function setDatabase(database) {
  db = database;
}

router.get('/feed', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const userId = req.user ? req.user.id : null;
    const posts = await db.getFeedPosts(userId);
    res.json({ posts });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/mine', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const posts = await db.getPostsByUserId(req.user.id);
    res.json({ posts });
  } catch (err) {
    console.error('Mine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const q = req.query.q;
    const userId = req.user ? req.user.id : null;
    const posts = await db.searchPosts(q, userId);
    res.json({ posts });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const post = await db.getPostById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.isPrivate && (!req.user || req.user.id !== post.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ post });
  } catch (err) {
    console.error('Get post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const { title, body, is_private: isPrivate } = req.body;
    if (!title || body === undefined) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    const post = await db.createPost(req.user.id, title, body, isPrivate);
    if (!post) return res.status(500).json({ error: 'Failed to create post' });
    res.status(201).json({ post });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const existing = await db.getPostById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Post not found' });
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { title, body, is_private: isPrivate } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (body !== undefined) updates.body = body;
    if (isPrivate !== undefined) updates.is_private = isPrivate;
    const post = await db.updatePost(req.params.id, req.user.id, updates);
    if (!post) return res.status(500).json({ error: 'Update failed' });
    res.json({ post });
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!db) return res.status(500).json({ error: 'Database not initialized' });
    const existing = await db.getPostById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Post not found' });
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const ok = await db.deletePost(req.params.id, req.user.id);
    if (!ok) return res.status(500).json({ error: 'Delete failed' });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.setDatabase = setDatabase;
