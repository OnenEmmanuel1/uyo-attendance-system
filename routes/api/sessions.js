'use strict';
const router  = require('express').Router();
const engine  = require('../../engine/uuasEngine');
const { query } = require('../../config/db');
const { requireRole } = require('../../middleware/auth');

// GET /api/sessions/token/:token — validate a token and return requirements
router.get('/token/:token', async (req, res, next) => {
  try {
    if (req.session.user.role !== 'student') return res.status(403).json({ error: 'Student access is required.' });
    const session = await engine.resolveSessionToken(req.params.token);
    const [enrolled] = await query(
      'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
      [session.course_id, req.session.user.id]
    );
    if (!enrolled.length) return res.status(403).json({ error: 'You are not enrolled in this course.' });
    if (session.closed_at || new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This attendance session is closed or expired.' });
    }
    res.json({ session: {
      course_code: session.course_code, course_title: session.course_title,
      title: session.title, expires_at: session.expires_at,
      requires_gps: !!session.requires_gps,
    }});
  } catch (err) { next(err); }
});

// POST /api/sessions/open
router.post('/open', async (req, res, next) => {
  try {
    const { course_id, title, requires_gps,
            gps_radius, duration_minutes } = req.body;

    const session = await engine.createAttendanceSession(
      parseInt(course_id),
      req.session.user.id,
      {
        title,
        requiresGps:       requires_gps === true || requires_gps === 'true',
        gpsRadius:         gps_radius    ? parseInt(gps_radius)        : undefined,
        durationMinutes:   duration_minutes ? parseInt(duration_minutes) : undefined,
      }
    );

    const { session_token, ...pendingSession } = session;
    res.json({ success: true, session: pendingSession, pendingApproval: true });
  } catch (err) { next(err); }
});

// POST /api/sessions/:id/close
router.post('/:id/close', async (req, res, next) => {
  try {
    const result = await engine.closeAttendanceSession(
      parseInt(req.params.id),
      req.session.user.id
    );
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/sessions/:id/status  (polling endpoint for live attendance)
router.get('/:id/status', async (req, res, next) => {
  try {
    const session    = await engine.getSessionDetails(parseInt(req.params.id));
    if (req.session.user.role !== 'admin' && session.created_by !== req.session.user.id) {
      return res.status(403).json({ error: 'Not authorised to view this session.' });
    }
    const attendance = await engine.getSessionAttendance(parseInt(req.params.id));
    const roster = await engine.getSessionRoster(parseInt(req.params.id));
    if (!session.is_approved) session.session_token = null;
    res.json({ session, attendance, roster });
  } catch (err) { next(err); }
});

// Admin can approve lecturer-created sessions before the short token is usable.
router.post('/:id/approve', requireRole('admin'), async (req, res, next) => {
  try {
    const [result] = await query(
      `UPDATE attendance_sessions
       SET is_approved = 1, approved_by = ?, approved_at = NOW(), opened_at = NOW(),
           expires_at = DATE_ADD(NOW(), INTERVAL duration_minutes MINUTE)
       WHERE id = ? AND is_approved = 0 AND closed_at IS NULL`,
      [req.session.user.id, parseInt(req.params.id)]
    );
    if (!result.affectedRows) return res.status(409).json({ error: 'Session is already approved or closed.' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/sessions/:id/qr
router.get('/:id/qr', async (req, res, next) => {
  try {
    const session = await engine.getSessionDetails(parseInt(req.params.id));
    if (req.session.user.role !== 'admin' && session.created_by !== req.session.user.id) {
      return res.status(403).json({ error: 'Not authorised to view this session.' });
    }
    if (!session.is_approved) return res.status(409).json({ error: 'This session is waiting for admin approval.' });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const { dataUrl, url } = await engine.generateSessionQR(session.session_token, baseUrl);
    res.json({ dataUrl, url, token: session.session_token });
  } catch (err) { next(err); }
});

module.exports = router;
