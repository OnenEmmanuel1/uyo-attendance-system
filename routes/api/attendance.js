'use strict';
const router  = require('express').Router();
const engine  = require('../../engine/uuasEngine');
const { requireRole } = require('../../middleware/auth');

// POST /api/attendance/mark
// Student marks their own attendance
router.post('/mark', async (req, res, next) => {
  try {
    const { token, gps_lat, gps_lng, biometric_verified } = req.body;

    if (!token) {
      return res.status(422).json({ error: 'Session token is required' });
    }

    const gpsCoords = (gps_lat != null && gps_lng != null)
      ? { lat: parseFloat(gps_lat), lng: parseFloat(gps_lng) }
      : null;

    const record = await engine.validateAndMarkAttendance(
      token,
      req.session.user.id,
      {
        gpsCoords,
        biometricVerified: biometric_verified === true || biometric_verified === 'true',
      }
    );

    res.json({ success: true, record });
  } catch (err) { next(err); }
});

// GET /api/attendance/session/:id  — session attendance list
router.get('/session/:id', async (req, res, next) => {
  try {
    const attendance = await engine.getSessionAttendance(parseInt(req.params.id));
    res.json({ attendance });
  } catch (err) { next(err); }
});

// GET /api/attendance/course/:id/report
router.get('/course/:id/report', async (req, res, next) => {
  try {
    const report = await engine.getCourseAttendanceReport(parseInt(req.params.id));
    res.json({ report });
  } catch (err) { next(err); }
});

// GET /api/attendance/course/:id/export  — CSV download
router.get('/course/:id/export', async (req, res, next) => {
  try {
    const csv = await engine.exportCourseCSV(parseInt(req.params.id));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="course-${req.params.id}-report.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/attendance/session/:id/export  — CSV download
router.get('/session/:id/export', async (req, res, next) => {
  try {
    const csv = await engine.exportSessionCSV(parseInt(req.params.id));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="session-${req.params.id}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// POST /api/attendance/manual  — manual correction (lecturer/admin only)
router.post('/manual', requireRole('lecturer', 'admin'), async (req, res, next) => {
  try {
    const { session_id, student_id, action, reason, set_present } = req.body;
    const result = await engine.manualCorrectAttendance({
      sessionId:   parseInt(session_id),
      studentId:   parseInt(student_id),
      action:      action || 'added',
      reason,
      correctedBy: req.session.user.id,
      setPresent:  set_present !== false && set_present !== 'false',
    });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
