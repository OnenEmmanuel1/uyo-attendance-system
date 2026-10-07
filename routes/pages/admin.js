'use strict';
const router    = require('express').Router();
const bcrypt    = require('bcrypt');
const engine    = require('../../engine/uuasEngine');
const { query } = require('../../config/db');

// GET /admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await engine.getSystemStats();
    res.render('admin/dashboard', { title: 'Admin Dashboard — AttendUyo', stats });
  } catch (err) { next(err); }
});

// GET /admin/users
router.get('/users', async (req, res, next) => {
  try {
    const role  = req.query.role || '';
    let sql     = 'SELECT id, name, email, role, matric_or_staff_id, department, is_active, created_at FROM users';
    const params = [];
    if (role) { sql += ' WHERE role = ?'; params.push(role); }
    sql += ' ORDER BY role, name';
    const [users] = await query(sql, params);
    res.render('admin/users', { title: 'Manage Users — AttendUyo', users, filterRole: role });
  } catch (err) { next(err); }
});

// GET /admin/users/new
router.get('/users/new', async (req, res, next) => {
  try {
    const [departments] = await query('SELECT name FROM departments WHERE is_active = 1 ORDER BY name');
    res.render('admin/create-user', { title: 'Create User — AttendUyo', error: null, departments });
  } catch (err) { next(err); }
});

// POST /admin/users/new
router.post('/users/new', async (req, res, next) => {
  try {
    const { name, email, password, role, matric_or_staff_id, department, phone } = req.body;
    const [validDepartment] = department
      ? await query('SELECT name FROM departments WHERE name = ? AND is_active = 1', [department])
      : [[]];
    if (['student', 'lecturer'].includes(role) && !validDepartment.length) {
      const [departments] = await query('SELECT name FROM departments WHERE is_active = 1 ORDER BY name');
      return res.status(400).render('admin/create-user', {
        title: 'Create User — AttendUyo', error: 'Select a valid academic department.', departments,
      });
    }
    const hash = await bcrypt.hash(password, 10);
    await query(
      'INSERT INTO users (name, email, password_hash, role, matric_or_staff_id, department, phone) VALUES (?,?,?,?,?,?,?)',
      [name, email.toLowerCase(), hash, role, matric_or_staff_id, department, phone || null]
    );
    res.redirect('/admin/users');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [departments] = await query('SELECT name FROM departments WHERE is_active = 1 ORDER BY name');
      return res.render('admin/create-user', {
        title: 'Create User — AttendUyo',
        error: 'Email or Matric/Staff ID already exists.',
        departments,
      });
    }
    next(err);
  }
});

// POST /admin/users/:id/toggle
router.post('/users/:id/toggle', async (req, res, next) => {
  try {
    await query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    res.redirect('/admin/users');
  } catch (err) { next(err); }
});

// GET /admin/courses
router.get('/courses', async (req, res, next) => {
  try {
    const [courses] = await query(
      `SELECT c.*, u.name AS lecturer_name,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS enrolled_count
       FROM courses c JOIN users u ON u.id = c.lecturer_id
       ORDER BY c.code`
    );
    const [lecturers] = await query("SELECT id, name FROM users WHERE role='lecturer' AND is_active=1 ORDER BY name");
    const [departments] = await query('SELECT name FROM departments WHERE is_active = 1 ORDER BY name');
    res.render('admin/courses', { title: 'Manage Courses — AttendUyo', courses, lecturers, departments, error: null });
  } catch (err) { next(err); }
});

// Admin managed academic departments
router.get('/departments', async (req, res, next) => {
  try {
    const [departments] = await query('SELECT id, name, is_active FROM departments ORDER BY name');
    res.render('admin/departments', { title: 'Academic Departments — AttendUyo', departments, error: null });
  } catch (err) { next(err); }
});

router.post('/departments', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
    if (!name) {
      const [departments] = await query('SELECT id, name, is_active FROM departments ORDER BY name');
      return res.status(400).render('admin/departments', {
        title: 'Academic Departments — AttendUyo', departments, error: 'Enter a department name.',
      });
    }
    await query('INSERT INTO departments (name) VALUES (?)', [name]);
    res.redirect('/admin/departments');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [departments] = await query('SELECT id, name, is_active FROM departments ORDER BY name');
      return res.status(409).render('admin/departments', {
        title: 'Academic Departments — AttendUyo', departments, error: 'That department already exists.',
      });
    }
    next(err);
  }
});

router.post('/departments/:id/toggle', async (req, res, next) => {
  try {
    await query('UPDATE departments SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    res.redirect('/admin/departments');
  } catch (err) { next(err); }
});

router.post('/courses/new', async (req, res, next) => {
  try {
    const { code, title, lecturer_id, department, level, semester, credit_units } = req.body;
    const [validDepartment] = await query('SELECT name FROM departments WHERE name = ? AND is_active = 1', [department]);
    const [validLecturer] = await query(
      "SELECT id FROM users WHERE id = ? AND role = 'lecturer' AND is_active = 1", [lecturer_id]
    );
    if (!validDepartment.length || !validLecturer.length || !String(code || '').trim() || !String(title || '').trim()) {
      return res.redirect('/admin/courses');
    }
    await query(
      `INSERT INTO courses (code, title, lecturer_id, department, level, semester, credit_units)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [String(code || '').trim().toUpperCase(), String(title || '').trim(), lecturer_id,
       department, level || null, semester || 'first', credit_units || 3]
    );
    res.redirect('/admin/courses');
  } catch (err) { next(err); }
});

// GET /admin/courses/:id/enroll
router.get('/courses/:id/enroll', async (req, res, next) => {
  try {
    const courseId = parseInt(req.params.id);
    const [[course]] = await query('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) return next(Object.assign(new Error('Course not found'), { status: 404 }));

    const [enrolled] = await query(
      `SELECT u.id, u.name, u.matric_or_staff_id FROM enrollments e JOIN users u ON u.id = e.student_id WHERE e.course_id = ? ORDER BY u.name`,
      [courseId]
    );
    const [available] = await query(
      `SELECT u.id, u.name, u.matric_or_staff_id FROM users u
       WHERE u.role = 'student' AND u.is_active = 1
         AND u.id NOT IN (SELECT student_id FROM enrollments WHERE course_id = ?)
       ORDER BY u.name`,
      [courseId]
    );

    res.render('admin/enroll', {
      title:    `Enroll Students — ${course.code}`,
      course,
      enrolled,
      available,
    });
  } catch (err) { next(err); }
});

// POST /admin/courses/:id/enroll
router.post('/courses/:id/enroll', async (req, res, next) => {
  try {
    const courseId  = parseInt(req.params.id);
    const studentId = parseInt(req.body.student_id);
    await query(
      'INSERT IGNORE INTO enrollments (course_id, student_id, enrolled_by) VALUES (?,?,?)',
      [courseId, studentId, req.session.user.id]
    );
    res.redirect(`/admin/courses/${courseId}/enroll`);
  } catch (err) { next(err); }
});

// POST /admin/courses/:id/unenroll/:studentId
router.post('/courses/:id/unenroll/:studentId', async (req, res, next) => {
  try {
    await query(
      'DELETE FROM enrollments WHERE course_id = ? AND student_id = ?',
      [req.params.id, req.params.studentId]
    );
    res.redirect(`/admin/courses/${req.params.id}/enroll`);
  } catch (err) { next(err); }
});

// GET /admin/reports
router.get('/reports', async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold || process.env.AT_RISK_THRESHOLD || '75');
    const atRisk    = await engine.getAtRiskStudents(threshold);
    const [courses] = await query('SELECT id, code, title FROM courses WHERE is_active=1 ORDER BY code');
    res.render('admin/reports', {
      title:    'System Reports — AttendUyo',
      atRisk,
      threshold,
      courses,
    });
  } catch (err) { next(err); }
});

// GET /admin/config
router.get('/config', (req, res) => {
  res.render('admin/config', {
    title:     'System Configuration — AttendUyo',
    config: {
      gpsRadius:           parseInt(process.env.GPS_DEFAULT_RADIUS     || '100'),
      sessionExpiry:       parseInt(process.env.SESSION_EXPIRY_MINUTES || '60'),
      atRiskThreshold:     parseInt(process.env.AT_RISK_THRESHOLD      || '75'),
    },
  });
});

module.exports = router;
