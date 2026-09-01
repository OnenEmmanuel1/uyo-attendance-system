'use strict';
const router  = require('express').Router();
const engine  = require('../../engine/uuasEngine');
const { query } = require('../../config/db');

// GET /student/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const student = req.session.user;
    const courses = await engine.getStudentCourseSummary(student.id);

    // Find any currently active sessions for enrolled courses
    const activeSessions = [];
    for (const c of courses) {
      const openSess = await engine.getOpenSession(c.course_id);
      if (openSess) activeSessions.push({ ...openSess, course_code: c.code, course_title: c.title });
    }

    res.render('student/dashboard', {
      title:    'Student Dashboard — AttendUyo',
      student,
      courses,
      activeSessions,
    });
  } catch (err) { next(err); }
});

// GET /student/courses
router.get('/courses', async (req, res, next) => {
  try {
    const courses = await engine.getStudentCourseSummary(req.session.user.id);
    res.render('student/courses', { title: 'My Courses — AttendUyo', courses });
  } catch (err) { next(err); }
});

// GET /student/mark-attendance  (loads the QR scanner / marking page)
router.get('/mark-attendance', async (req, res, next) => {
  try {
    const { token } = req.query;
    let session = null;
    let error   = null;

    if (token) {
      try {
        session = await engine.resolveSessionToken(token);
        // Check session is still open
        if (session.closed_at || new Date(session.expires_at) < new Date()) {
          error   = 'This attendance session is no longer active.';
          session = null;
        }
      } catch (e) {
        error = e.message;
      }
    }

    res.render('student/mark-attendance', {
      title:   'Mark Attendance — AttendUyo',
      session,
      token:   token || null,
      error,
    });
  } catch (err) { next(err); }
});

// GET /student/history
router.get('/history', async (req, res, next) => {
  try {
    const history = await engine.getStudentAttendanceHistory(req.session.user.id);
    const courses  = await engine.getStudentCourseSummary(req.session.user.id);
    res.render('student/history', {
      title:   'Attendance History — AttendUyo',
      history,
      courses,
    });
  } catch (err) { next(err); }
});

module.exports = router;
