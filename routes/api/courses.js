'use strict';
const router    = require('express').Router();
const { query } = require('../../config/db');

// GET /api/courses
router.get('/', async (req, res, next) => {
  try {
    const [courses] = await query(
      `SELECT c.*, u.name AS lecturer_name,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrolled_count
       FROM courses c JOIN users u ON u.id = c.lecturer_id
       WHERE c.is_active = 1 ORDER BY c.code`
    );
    res.json({ courses });
  } catch (err) { next(err); }
});

// POST /api/courses
router.post('/', async (req, res, next) => {
  try {
    const { code, title, lecturer_id, department, level, semester,
            credit_units, venue_name, venue_lat, venue_lng, gps_radius_meters } = req.body;
    const [r] = await query(
      `INSERT INTO courses (code, title, lecturer_id, department, level, semester,
         credit_units, venue_name, venue_lat, venue_lng, gps_radius_meters)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [code.toUpperCase(), title, lecturer_id, department, level||null,
       semester||'first', credit_units||3, venue_name, venue_lat||null, venue_lng||null, gps_radius_meters||100]
    );
    res.status(201).json({ success: true, courseId: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Course code already exists' });
    next(err);
  }
});

// PUT /api/courses/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { title, lecturer_id, department, venue_name, venue_lat, venue_lng, gps_radius_meters } = req.body;
    await query(
      'UPDATE courses SET title=?, lecturer_id=?, department=?, venue_name=?, venue_lat=?, venue_lng=?, gps_radius_meters=? WHERE id=?',
      [title, lecturer_id, department, venue_name, venue_lat||null, venue_lng||null, gps_radius_meters||100, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/courses/:id/enroll
router.post('/:id/enroll', async (req, res, next) => {
  try {
    const { student_id } = req.body;
    await query(
      'INSERT IGNORE INTO enrollments (course_id, student_id, enrolled_by) VALUES (?,?,?)',
      [req.params.id, student_id, req.session.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/courses/:id/enroll/:studentId
router.delete('/:id/enroll/:studentId', async (req, res, next) => {
  try {
    await query(
      'DELETE FROM enrollments WHERE course_id=? AND student_id=?',
      [req.params.id, req.params.studentId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
