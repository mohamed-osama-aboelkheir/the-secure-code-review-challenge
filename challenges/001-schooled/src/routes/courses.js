const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const DatabaseStore = require('../store/database');

const router = express.Router();
const db = new DatabaseStore();


// Apply authentication to all routes below this point
router.use(authenticateToken);

// Get all available courses (authenticated users only)
router.get('/', async (req, res) => {
  try {
    const courses = await db.getAvailableCourses();
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific course details
router.get('/:id', async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const course = await db.getCourseById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    res.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's enrollments (authenticated users)
router.get('/user/enrollments', async (req, res) => {
  try {
    const enrollments = await db.getUserEnrollments(req.user.id);
    res.json(enrollments);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new course (teachers and admins only)
router.post('/', requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { title, description, studentLimit, startDate, endDate } = req.body;

    if (!title || !description || !studentLimit || !startDate || !endDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start <= now) {
      return res.status(400).json({ error: 'Start date must be in the future' });
    }

    if (end <= start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    if (studentLimit <= 0) {
      return res.status(400).json({ error: 'Student limit must be positive' });
    }

    const course = await db.createCourse(
      title,
      description,
      req.user.id,
      studentLimit,
      startDate,
      endDate
    );

    res.status(201).json({
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Enroll in a course (students only)
router.post('/:id/enroll', requireRole(['student', 'admin']), async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const course = await db.getCourseById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if course is full
    if (course.enrolled_students >= course.student_limit) {
      return res.status(400).json({ error: 'Course is full' });
    }

    // Check if course hasn't started yet
    const startDate = new Date(course.start_date);
    const now = new Date();
    if (startDate <= now) {
      return res.status(400).json({ error: 'Cannot enroll in a course that has already started' });
    }

    const enrollment = await db.enrollInCourse(courseId, req.user.id);
    
    res.status(201).json({
      message: 'Successfully enrolled in course',
      enrollment
    });
  } catch (error) {
    if (error.message === 'Already enrolled in this course') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel enrollment (students only)
router.delete('/:id/enroll', requireRole(['student', 'admin']), async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const course = await db.getCourseById(courseId);
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const enrollment = await db.cancelEnrollment(courseId, req.user.id);
    
    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    
    res.json({
      message: 'Successfully cancelled enrollment',
      enrollment
    });
  } catch (error) {
    console.error('Error cancelling enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
