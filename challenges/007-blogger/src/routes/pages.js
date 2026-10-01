const express = require('express');
const router = express.Router();
let db = null;

function setDatabase(database) {
  db = database;
}

router.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

router.get('/', async (req, res) => {
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const userId = req.user ? req.user.id : null;
    const posts = await db.getFeedPosts(userId);
    res.render('feed.html', { posts });
  } catch (err) {
    console.error('Feed page error:', err);
    res.status(500).send('Internal server error');
  }
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/my-posts');
  res.render('login.html', { error: req.query.error || null });
});

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/my-posts');
  res.render('register.html', { error: req.query.error || null });
});

router.get('/my-posts', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const posts = await db.getPostsByUserId(req.user.id);
    res.render('my-posts.html', { posts });
  } catch (err) {
    console.error('My posts page error:', err);
    res.status(500).send('Internal server error');
  }
});

router.get('/search', async (req, res) => {
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const query = req.query.q || '';
    const userId = req.user ? req.user.id : null;
    const posts = query ? await db.searchPosts(query, userId) : [];
    res.render('search.html', { query, posts });
  } catch (err) {
    console.error('Search page error:', err);
    res.status(500).send('Internal server error');
  }
});

router.get('/posts/new', (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.render('post-form.html', { post: null, action: '/posts', error: null });
});

router.get('/posts/:id', async (req, res) => {
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const post = await db.getPostById(req.params.id);
    if (!post) return res.status(404).send('Post not found');
    if (post.isPrivate && (!req.user || req.user.id !== post.userId)) {
      return res.status(403).send('Access denied');
    }
    res.render('post.html', { post });
  } catch (err) {
    console.error('Post page error:', err);
    res.status(500).send('Internal server error');
  }
});

router.get('/posts/:id/edit', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const post = await db.getPostById(req.params.id);
    if (!post) return res.status(404).send('Post not found');
    if (post.userId !== req.user.id) return res.status(403).send('Access denied');
    res.render('post-form.html', { post, action: `/posts/${post.id}`, error: null });
  } catch (err) {
    console.error('Edit page error:', err);
    res.status(500).send('Internal server error');
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.redirect('/');
});

router.post('/posts', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const { title, body, is_private: isPrivate } = req.body;
    if (!title || body === undefined) {
      return res.render('post-form.html', {
        post: null,
        action: '/posts',
        error: 'Title and body are required'
      });
    }
    const post = await db.createPost(req.user.id, title, body, !!isPrivate);
    if (!post) {
      return res.render('post-form.html', {
        post: null,
        action: '/posts',
        error: 'Failed to create post'
      });
    }
    res.redirect(`/posts/${post.id}`);
  } catch (err) {
    console.error('Create post error:', err);
    res.render('post-form.html', { post: null, action: '/posts', error: 'Failed to create post' });
  }
});

router.post('/posts/:id', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const existing = await db.getPostById(req.params.id);
    if (!existing) return res.status(404).send('Post not found');
    if (existing.userId !== req.user.id) return res.status(403).send('Access denied');
    const { title, body, is_private: isPrivate } = req.body;
    await db.updatePost(req.params.id, req.user.id, {
      title,
      body,
      is_private: !!isPrivate
    });
    res.redirect(`/posts/${req.params.id}`);
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).send('Internal server error');
  }
});

router.get('/posts/:id/delete', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const post = await db.getPostById(req.params.id);
    if (!post) return res.status(404).send('Post not found');
    if (post.userId !== req.user.id) return res.status(403).send('Access denied');
    res.render('delete-confirm.html', { post });
  } catch (err) {
    console.error('Delete page error:', err);
    res.status(500).send('Internal server error');
  }
});

router.post('/posts/:id/delete', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  try {
    if (!db) return res.status(500).send('Database not initialized');
    const existing = await db.getPostById(req.params.id);
    if (!existing) return res.status(404).send('Post not found');
    if (existing.userId !== req.user.id) return res.status(403).send('Access denied');
    await db.deletePost(req.params.id, req.user.id);
    res.redirect('/my-posts');
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
module.exports.setDatabase = setDatabase;
