const { Pool } = require('pg');
require('dotenv').config();

const VALID_ROLES = ['student', 'teacher', 'admin'];

class DatabaseStore {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
  }

  async init() {
    try {
      // Create users table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create courses table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS courses (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          teacher_id INTEGER REFERENCES users(id),
          student_limit INTEGER NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create course_enrollments table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS course_enrollments (
          id SERIAL PRIMARY KEY,
          course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
          student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(course_id, student_id)
        )
      `);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  async createUser(username, email, passwordHash, role) {
    if (!VALID_ROLES.includes(role.trim())) {
      throw new Error('Invalid role');
    }

    try {
      const result = await this.pool.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
        [username.trim(), email.trim(), passwordHash, role.trim()]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('User already exists');
      }
      throw error;
    }
  }

  async findUserByUsername(username) {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username.trim()]
    );
    return result.rows[0];
  }

  async findUserByEmail(email) {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.trim()]
    );
    return result.rows[0];
  }

  async findUserById(id) {
    const result = await this.pool.query(
      'SELECT id, username, email, role FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async getAllUsers() {
    const result = await this.pool.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async createCourse(title, description, teacherId, studentLimit, startDate, endDate) {
    const result = await this.pool.query(
      'INSERT INTO courses (title, description, teacher_id, student_limit, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title.trim(), description.trim(), teacherId, studentLimit, startDate, endDate]
    );
    return result.rows[0];
  }

  async getCourses() {
    const result = await this.pool.query(`
      SELECT c.*, u.username as teacher_name, 
             COUNT(ce.student_id) as enrolled_students
      FROM courses c
      LEFT JOIN users u ON c.teacher_id = u.id
      LEFT JOIN course_enrollments ce ON c.id = ce.course_id
      WHERE c.start_date > CURRENT_DATE
      GROUP BY c.id, u.username
      ORDER BY c.start_date ASC
    `);
    return result.rows;
  }

  async getAvailableCourses() {
    const result = await this.pool.query(`
      SELECT c.*, u.username as teacher_name, 
             COUNT(ce.student_id) as enrolled_students
      FROM courses c
      LEFT JOIN users u ON c.teacher_id = u.id
      LEFT JOIN course_enrollments ce ON c.id = ce.course_id
      WHERE c.start_date > CURRENT_DATE
      GROUP BY c.id, u.username
      HAVING COUNT(ce.student_id) < c.student_limit
      ORDER BY c.start_date ASC
    `);
    return result.rows;
  }

  async getCourseById(courseId) {
    const result = await this.pool.query(`
      SELECT c.*, u.username as teacher_name,
             COUNT(ce.student_id) as enrolled_students
      FROM courses c
      LEFT JOIN users u ON c.teacher_id = u.id
      LEFT JOIN course_enrollments ce ON c.id = ce.course_id
      WHERE c.id = $1
      GROUP BY c.id, u.username
    `, [courseId]);
    return result.rows[0];
  }

  async enrollInCourse(courseId, studentId) {
    try {
      const result = await this.pool.query(
        'INSERT INTO course_enrollments (course_id, student_id) VALUES ($1, $2) RETURNING *',
        [courseId, studentId]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Already enrolled in this course');
      }
      throw error;
    }
  }

  async cancelEnrollment(courseId, studentId) {
    const result = await this.pool.query(
      'DELETE FROM course_enrollments WHERE course_id = $1 AND student_id = $2 RETURNING *',
      [courseId, studentId]
    );
    return result.rows[0];
  }

  async getUserEnrollments(userId) {
    const result = await this.pool.query(`
      SELECT c.*, u.username as teacher_name, ce.enrolled_at
      FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      JOIN users u ON c.teacher_id = u.id
      WHERE ce.student_id = $1
      ORDER BY c.start_date ASC
    `, [userId]);
    return result.rows;
  }

  async updateUserRole(userId, newRole) {
    const result = await this.pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
      [newRole.trim(), userId]
    );
    return result.rows[0];
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = DatabaseStore;
