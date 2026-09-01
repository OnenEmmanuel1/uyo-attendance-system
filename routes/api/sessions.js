'use strict';
const router  = require('express').Router();
const engine  = require('../../engine/uuasEngine');

// POST /api/sessions/open
router.post('/open', async (req, res, next) => {
  try {
    const { course_id, title, requires_gps, requires_biometric,
            gps_radius, duration_minutes } = req.body;

    const session = await engine.createAttendanceSession(
      parseInt(course_id),
      req.session.user.id,
      {
        title,
        requiresGps:       requires_gps === true || requires_gps === 'true',
        requiresBiometric: requires_biometric === true || requires_biometric === 'true',
        gpsRadius:         gps_radius    ? parseInt(gps_radius)        : undefined,
        durationMinutes:   duration_minutes ? parseInt(duration_minutes) : undefined,
      }
    );

    const baseUrl    = `${req.protocol}://${req.get('host')}`;
    const { dataUrl, url } = await engine.generateSessionQR(session.session_token, baseUrl);

    res.json({ success: true, session, qrDataUrl: dataUrl, qrUrl: url });
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
    const attendance = await engine.getSessionAttendance(parseInt(req.params.id));
    res.json({ session, attendance });
  } catch (err) { next(err); }
});

// GET /api/sessions/:id/qr
router.get('/:id/qr', async (req, res, next) => {
  try {
    const session = await engine.getSessionDetails(parseInt(req.params.id));
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const { dataUrl, url } = await engine.generateSessionQR(session.session_token, baseUrl);
    res.json({ dataUrl, url, token: session.session_token });
  } catch (err) { next(err); }
});

module.exports = router;
