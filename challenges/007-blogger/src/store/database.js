const knex = require('../config/knex');

class DatabaseStore {
  async createUser(username, email, passwordHash) {
    const [user] = await knex('users')
      .insert({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning(['id', 'username', 'email', 'created_at']);
    return user ? { ...user, id: String(user.id) } : null;
  }

  async findUserByUsername(username) {
    const user = await knex('users').where('username', username.trim()).first();
    return user ? this._mapUser(user) : null;
  }

  async findUserByEmail(email) {
    const user = await knex('users').where('email', email.trim().toLowerCase()).first();
    return user ? this._mapUser(user) : null;
  }

  async findUserById(userId) {
    const user = await knex('users').where('id', userId).first();
    return user ? this._mapUser(user) : null;
  }

  _mapUser(row) {
    return {
      id: String(row.id),
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at
    };
  }

  async createPost(userId, title, body, isPrivate = false) {
    const [post] = await knex('posts')
      .insert({
        user_id: userId,
        title,
        body,
        is_private: !!isPrivate,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning('*');
    return post ? this._mapPost(post) : null;
  }

  async getPublicPosts(limit = 50) {
    const rows = await knex('posts as p')
      .join('users as u', 'p.user_id', 'u.id')
      .where('p.is_private', false)
      .orderBy('p.created_at', 'desc')
      .limit(limit)
      .select('p.*', 'u.username as author_username');
    return rows.map((r) => this._mapPostWithAuthor(r));
  }

  async getFeedPosts(userId, limit = 50) {
    const q = knex('posts as p')
      .join('users as u', 'p.user_id', 'u.id')
      .orderBy('p.created_at', 'desc')
      .limit(limit)
      .select('p.*', 'u.username as author_username');
    if (userId) {
      q.where((builder) => {
        builder.where('p.is_private', false).orWhere('p.user_id', userId);
      });
    } else {
      q.where('p.is_private', false);
    }
    const rows = await q;
    return rows.map((r) => this._mapPostWithAuthor(r));
  }

  async getPostsByUserId(userId) {
    const rows = await knex('posts as p')
      .join('users as u', 'p.user_id', 'u.id')
      .where('p.user_id', userId)
      .orderBy('p.created_at', 'desc')
      .select('p.*', 'u.username as author_username');
    return rows.map((r) => this._mapPostWithAuthor(r));
  }

  async getPostById(postId) {
    const row = await knex('posts as p')
      .join('users as u', 'p.user_id', 'u.id')
      .where('p.id', postId)
      .select('p.*', 'u.username as author_username')
      .first();
    return row ? this._mapPostWithAuthor(row) : null;
  }

  async updatePost(postId, userId, data) {
    const updated = await knex('posts')
      .where({ id: postId, user_id: userId })
      .update({
        ...data,
        updated_at: knex.fn.now()
      })
      .returning('*');
    return updated.length ? this._mapPost(updated[0]) : null;
  }

  async deletePost(postId, userId) {
    const deleted = await knex('posts').where({ id: postId, user_id: userId }).del();
    return deleted > 0;
  }

  async searchPosts(query, userId) {
    if (!query || typeof query !== 'string') {
      return this.getPublicPosts(20);
    }
    const uid = userId || null;
    const sql = `
      SELECT p.*, u.username AS author_username
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE (p.is_private = false OR p.user_id = ?)
        AND to_tsvector('english', p.title || ' ' || COALESCE(p.body, '')) @@ plainto_tsquery('english', '${query}')
      ORDER BY ts_rank(to_tsvector('english', p.title || ' ' || COALESCE(p.body, '')), plainto_tsquery('english', '${query}')) DESC
      LIMIT 50
    `;
    const result = await knex.raw(sql, [uid]);
    const rows = result.rows || result;
    return Array.isArray(rows) ? rows.map((r) => this._mapPostWithAuthor(r)) : [];
  }

  _mapPost(row) {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      title: row.title,
      body: row.body,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  _mapPostWithAuthor(row) {
    return {
      ...this._mapPost(row),
      authorUsername: row.author_username
    };
  }
}

module.exports = DatabaseStore;
