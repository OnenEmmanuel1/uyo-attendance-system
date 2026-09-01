'use strict';
/**
 * uuasEngine.js — AttendUyo Business Logic Engine
 * All attendance lifecycle operations live here.
 * Route handlers must NOT contain business logic — only call this engine.
 */

const { v4: uuidv4 }       = require('uuid');
const QRCode               = require('qrcode');
const { stringify }        = require('csv-stringify/sync');
const { query, withTransaction } = require('../config/db');

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Haversine formula — distance in meters between two GPS coordinates.
 */
function computeGpsDistance(lat1, lng1, lat2, lng2) {
  const R  = 6_371_000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a  = Math.sin(dLat / 2) ** 2 +
             Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
             Math.sin(dLng / 2) ** 2;
  const c  = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(deg) { return deg * (Math.PI / 180); }

// ─────────────────────────────────────────────────────────────
// SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Open a new attendance session for a course.
 * @param {number}  courseId
 * @param {number}  lecturerId
 * @param {object}  opts  { title, requiresGps, requiresBiometric, gpsRadius, durationMinutes }
 * @returns {object} session record
 */
async function createAttendanceSession(courseId, lecturerId, opts = {}) {
  const {
    title             = null,
    requiresGps       = false,
    requiresBiometric = false,
    gpsRadius         = parseInt(process.env.GPS_DEFAULT_RADIUS || '100'),
    durationMinutes   = parseInt(process.env.SESSION_EXPIRY_MINUTES || '60'),
  } = opts;

  // Verify lecturer owns the course
  const [courses] = await query(
    'SELECT id, gps_radius_meters FROM courses WHERE id = ? AND lecturer_id = ? AND is_active = 1',
    [courseId, lecturerId]
  );
  if (!courses.length) {
    throw Object.assign(new Error('Course not found or not authorised'), { status: 403 });
  }

  // Check no session is already open for this course
  const [open] = await query(
    `SELECT id FROM attendance_sessions
     WHERE course_id = ? AND closed_at IS NULL AND expires_at > NOW()`,
    [courseId]
  );
  if (open.length) {
    throw Object.assign(new Error('A session is already open for this course'), { status: 409 });
  }

  const token     = uuidv4().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + durationMinutes * 60_000);

  const [result] = await query(
    `INSERT INTO attendance_sessions
       (course_id, session_token, title, requires_gps, requires_biometric,
        gps_radius_meters, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [courseId, token, title, requiresGps ? 1 : 0, requiresBiometric ? 1 : 0,
     gpsRadius, expiresAt, lecturerId]
  );

  const [rows] = await query(
    'SELECT * FROM attendance_sessions WHERE id = ?',
    [result.insertId]
  );
  return rows[0];
}

/**
 * Close an attendance session (manual close by lecturer/admin).
 */
async function closeAttendanceSession(sessionId, userId) {
  // Verify ownership or admin
  const [sessions] = await query(
    `SELECT s.id, s.closed_at, c.lecturer_id
     FROM attendance_sessions s
     JOIN courses c ON c.id = s.course_id
     WHERE s.id = ?`,
    [sessionId]
  );
  if (!sessions.length) throw Object.assign(new Error('Session not found'), { status: 404 });

  const session = sessions[0];
  if (session.closed_at) throw Object.assign(new Error('Session already closed'), { status: 409 });

  const [users] = await query('SELECT role FROM users WHERE id = ?', [userId]);
  const isAdmin = users.length && users[0].role === 'admin';
  if (!isAdmin && session.lecturer_id !== userId) {
    throw Object.assign(new Error('Not authorised to close this session'), { status: 403 });
  }

  await query('UPDATE attendance_sessions SET closed_at = NOW() WHERE id = ?', [sessionId]);
  return { success: true, sessionId };
}

/**
 * Get session details with live attendance count.
 */
async function getSessionDetails(sessionId) {
  const [sessions] = await query(
    `SELECT s.*, c.code AS course_code, c.title AS course_title,
            c.venue_name, c.venue_lat, c.venue_lng,
            u.name AS lecturer_name,
            (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.is_present = 1) AS present_count,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = s.course_id) AS enrolled_count
     FROM attendance_sessions s
     JOIN courses c ON c.id = s.course_id
     JOIN users   u ON u.id = s.created_by
     WHERE s.id = ?`,
    [sessionId]
  );
  if (!sessions.length) throw Object.assign(new Error('Session not found'), { status: 404 });
  return sessions[0];
}

/**
 * Get the active (open) session for a course, or null.
 */
async function getOpenSession(courseId) {
  const [rows] = await query(
    `SELECT * FROM attendance_sessions
     WHERE course_id = ? AND closed_at IS NULL AND expires_at > NOW()
     ORDER BY opened_at DESC LIMIT 1`,
    [courseId]
  );
  return rows[0] || null;
}

/**
 * Resolve a session token → session object, or throw.
 */
async function resolveSessionToken(token) {
  const [rows] = await query(
    `SELECT s.*, c.code AS course_code, c.title AS course_title,
            c.venue_lat, c.venue_lng, c.venue_name
     FROM attendance_sessions s
     JOIN courses c ON c.id = s.course_id
     WHERE s.session_token = ?`,
    [token]
  );
  if (!rows.length) throw Object.assign(new Error('Invalid session token'), { status: 404 });
  return rows[0];
}

// ─────────────────────────────────────────────────────────────
// QR CODE
// ─────────────────────────────────────────────────────────────

/**
 * Generate a QR code data-URL for a session token.
 * The QR encodes a URL the student's device can scan and navigate to.
 */
async function generateSessionQR(sessionToken, baseUrl) {
  const url = `${baseUrl}/student/mark-attendance?token=${sessionToken}`;
  const dataUrl = await QRCode.toDataURL(url, {
    width:           400,
    margin:          2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  });
  return { dataUrl, url };
}

// ─────────────────────────────────────────────────────────────
// ATTENDANCE MARKING
// ─────────────────────────────────────────────────────────────

/**
 * Validate and record a student's attendance mark.
 *
 * @param {string}  token            Session token from QR / direct input
 * @param {number}  studentId
 * @param {object}  opts
 *   gpsCoords?        { lat, lng }
 *   biometricVerified boolean
 * @returns {object} attendance record
 */
async function validateAndMarkAttendance(token, studentId, opts = {}) {
  const { gpsCoords = null, biometricVerified = false } = opts;

  // 1. Resolve session
  const session = await resolveSessionToken(token);

  // 2. Session must be open
  if (session.closed_at) {
    throw Object.assign(new Error('This attendance session has been closed'), { status: 410 });
  }
  if (new Date(session.expires_at) < new Date()) {
    throw Object.assign(new Error('This attendance session has expired'), { status: 410 });
  }

  // 3. Student must be enrolled
  const [enrolled] = await query(
    'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
    [session.course_id, studentId]
  );
  if (!enrolled.length) {
    throw Object.assign(
      new Error('You are not enrolled in the course for this session'),
      { status: 403 }
    );
  }

  // 4. Duplicate check
  const [existing] = await query(
    'SELECT id FROM attendance_records WHERE session_id = ? AND student_id = ?',
    [session.id, studentId]
  );
  if (existing.length) {
    throw Object.assign(new Error('Attendance already marked for this session'), { status: 409 });
  }

  // 5. GPS validation (if required)
  let gpsLat = null, gpsLng = null, gpsDistanceMeters = null;
  if (session.requires_gps) {
    if (!gpsCoords || gpsCoords.lat == null || gpsCoords.lng == null) {
      throw Object.assign(
        new Error('GPS coordinates are required for this session'),
        { status: 422 }
      );
    }
    const dist = computeGpsDistance(
      parseFloat(gpsCoords.lat), parseFloat(gpsCoords.lng),
      parseFloat(session.venue_lat), parseFloat(session.venue_lng)
    );
    gpsLat           = parseFloat(gpsCoords.lat);
    gpsLng           = parseFloat(gpsCoords.lng);
    gpsDistanceMeters = dist;

    if (dist > session.gps_radius_meters) {
      throw Object.assign(
        new Error(
          `You appear to be ${dist}m from the venue (max ${session.gps_radius_meters}m allowed). ` +
          `Please ensure you are physically present in class.`
        ),
        { status: 422, gpsDistance: dist, gpsRadius: session.gps_radius_meters }
      );
    }
  } else if (gpsCoords && gpsCoords.lat != null) {
    // GPS provided but not required — record it anyway
    gpsLat  = parseFloat(gpsCoords.lat);
    gpsLng  = parseFloat(gpsCoords.lng);
    if (session.venue_lat && session.venue_lng) {
      gpsDistanceMeters = computeGpsDistance(gpsLat, gpsLng, parseFloat(session.venue_lat), parseFloat(session.venue_lng));
    }
  }

  // 6. Biometric validation (if required)
  if (session.requires_biometric && !biometricVerified) {
    throw Object.assign(
      new Error('Biometric verification is required for this session'),
      { status: 422 }
    );
  }

  // 7. Determine method
  let method = 'qr';
  if (gpsLat !== null && biometricVerified)  method = 'biometric';
  else if (gpsLat !== null)                  method = 'gps';

  // 8. Insert record
  const [result] = await query(
    `INSERT INTO attendance_records
       (session_id, student_id, method, gps_lat, gps_lng, gps_distance_meters, biometric_verified, is_present)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [session.id, studentId, method, gpsLat, gpsLng, gpsDistanceMeters, biometricVerified ? 1 : 0]
  );

  const [record] = await query(
    'SELECT * FROM attendance_records WHERE id = ?',
    [result.insertId]
  );
  return record[0];
}

// ─────────────────────────────────────────────────────────────
// LIVE SESSION ATTENDANCE LIST
// ─────────────────────────────────────────────────────────────

async function getSessionAttendance(sessionId) {
  const [rows] = await query(
    `SELECT ar.id, ar.student_id, ar.method, ar.marked_at,
            ar.gps_distance_meters, ar.biometric_verified, ar.is_present,
            u.name AS student_name, u.matric_or_staff_id AS matric
     FROM attendance_records ar
     JOIN users u ON u.id = ar.student_id
     WHERE ar.session_id = ?
     ORDER BY ar.marked_at ASC`,
    [sessionId]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────
// COURSE ATTENDANCE REPORT
// ─────────────────────────────────────────────────────────────

/**
 * Per-student attendance percentage for a course (across all closed sessions).
 */
async function getCourseAttendanceReport(courseId) {
  // Total closed sessions for the course
  const [sessionRows] = await query(
    `SELECT COUNT(*) AS total_sessions
     FROM attendance_sessions
     WHERE course_id = ? AND closed_at IS NOT NULL`,
    [courseId]
  );
  const totalSessions = sessionRows[0].total_sessions;

  // Per-student counts
  const [rows] = await query(
    `SELECT u.id AS student_id, u.name, u.email, u.phone, u.department, u.avatar_url, u.created_at,
            u.matric_or_staff_id AS matric,
            COUNT(ar.id) AS sessions_attended
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     LEFT JOIN attendance_sessions s ON s.course_id = e.course_id AND s.closed_at IS NOT NULL
     LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = e.student_id AND ar.is_present = 1
     WHERE e.course_id = ?
     GROUP BY u.id, u.name, u.email, u.phone, u.department, u.avatar_url, u.created_at, u.matric_or_staff_id
     ORDER BY u.name ASC`,
    [courseId]
  );

  const threshold = parseInt(process.env.AT_RISK_THRESHOLD || '75');
  return rows.map(r => {
    const pct = totalSessions > 0 ? Math.round((r.sessions_attended / totalSessions) * 100) : 0;
    return {
      ...r,
      total_sessions:    totalSessions,
      percentage:        pct,
      at_risk:           pct < threshold,
    };
  });
}

/**
 * System-wide at-risk students (below attendance threshold).
 */
async function getAtRiskStudents(threshold) {
  threshold = threshold || parseInt(process.env.AT_RISK_THRESHOLD || '75');

  const [rows] = await query(
    `SELECT u.id AS student_id, u.name, u.matric_or_staff_id AS matric, u.department,
            c.id AS course_id, c.code AS course_code, c.title AS course_title,
            (SELECT COUNT(*) FROM attendance_sessions s WHERE s.course_id = c.id AND s.closed_at IS NOT NULL) AS total_sessions,
            (SELECT COUNT(*) FROM attendance_records ar
             JOIN attendance_sessions s2 ON s2.id = ar.session_id
             WHERE s2.course_id = c.id AND ar.student_id = u.id AND ar.is_present = 1 AND s2.closed_at IS NOT NULL) AS sessions_attended
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     JOIN courses c ON c.id = e.course_id
     HAVING total_sessions > 0 AND (sessions_attended / total_sessions * 100) < ?
     ORDER BY u.name, c.code`,
    [threshold]
  );

  return rows.map(r => ({
    ...r,
    percentage: r.total_sessions > 0 ? Math.round((r.sessions_attended / r.total_sessions) * 100) : 0,
  }));
}

// ─────────────────────────────────────────────────────────────
// MANUAL CORRECTION (Audit Trail)
// ─────────────────────────────────────────────────────────────

/**
 * Manually add or correct an attendance record.
 * Always creates an audit trail entry.
 *
 * @param {object} opts { sessionId, studentId, action, reason, correctedBy, setPresent }
 */
async function manualCorrectAttendance(opts) {
  const { sessionId, studentId, action, reason, correctedBy, setPresent = true } = opts;

  if (!reason || !reason.trim()) {
    throw Object.assign(new Error('A reason must be provided for manual corrections'), { status: 422 });
  }

  return withTransaction(async (conn) => {
    // Check if record exists
    const [existing] = await conn.execute(
      'SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?',
      [sessionId, studentId]
    );

    let recordId;
    let previousMethod  = null;
    let previousPresent = null;

    if (existing.length) {
      const rec       = existing[0];
      previousMethod  = rec.method;
      previousPresent = rec.is_present;
      recordId        = rec.id;

      await conn.execute(
        'UPDATE attendance_records SET method = ?, is_present = ?, marked_at = NOW() WHERE id = ?',
        ['manual', setPresent ? 1 : 0, recordId]
      );
    } else {
      // Insert new record
      const [ins] = await conn.execute(
        `INSERT INTO attendance_records (session_id, student_id, method, is_present)
         VALUES (?, ?, 'manual', ?)`,
        [sessionId, studentId, setPresent ? 1 : 0]
      );
      recordId = ins.insertId;
    }

    await conn.execute(
      `INSERT INTO manual_corrections
         (attendance_record_id, action, reason, corrected_by, previous_method, previous_is_present)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [recordId, action, reason.trim(), correctedBy, previousMethod, previousPresent]
    );

    return { success: true, recordId };
  });
}

// ─────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────

async function exportSessionCSV(sessionId) {
  const [session] = await query(
    `SELECT s.title, c.code, c.title AS course_title
     FROM attendance_sessions s JOIN courses c ON c.id = s.course_id
     WHERE s.id = ?`,
    [sessionId]
  );
  if (!session.length) throw Object.assign(new Error('Session not found'), { status: 404 });

  const rows = await getSessionAttendance(sessionId);
  const data = rows.map(r => ({
    Matric:    r.matric,
    Name:      r.student_name,
    Present:   r.is_present ? 'Yes' : 'No',
    Method:    r.method,
    'Marked At': r.marked_at ? new Date(r.marked_at).toISOString() : '',
    'GPS (m)': r.gps_distance_meters ?? '',
    Biometric: r.biometric_verified ? 'Yes' : 'No',
  }));

  return stringify(data, { header: true });
}

async function exportCourseCSV(courseId) {
  const report = await getCourseAttendanceReport(courseId);
  const data   = report.map(r => ({
    Matric:              r.matric,
    Name:                r.name,
    'Sessions Attended': r.sessions_attended,
    'Total Sessions':    r.total_sessions,
    'Percentage (%)':    r.percentage,
    'At Risk':           r.at_risk ? 'Yes' : 'No',
  }));
  return stringify(data, { header: true });
}

// ─────────────────────────────────────────────────────────────
// STUDENT HISTORY
// ─────────────────────────────────────────────────────────────

async function getStudentAttendanceHistory(studentId) {
  const [rows] = await query(
    `SELECT c.code AS course_code, c.title AS course_title,
            s.title AS session_title, s.opened_at,
            ar.method, ar.marked_at, ar.is_present, ar.gps_distance_meters, ar.biometric_verified,
            (SELECT COUNT(*) FROM attendance_sessions s2
             WHERE s2.course_id = c.id AND s2.closed_at IS NOT NULL) AS total_sessions,
            (SELECT COUNT(*) FROM attendance_records ar2
             JOIN attendance_sessions s3 ON s3.id = ar2.session_id
             WHERE s3.course_id = c.id AND ar2.student_id = ? AND ar2.is_present = 1 AND s3.closed_at IS NOT NULL
            ) AS attended_sessions
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN attendance_sessions s ON s.course_id = e.course_id AND s.closed_at IS NOT NULL
     LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = e.student_id
     WHERE e.student_id = ?
     ORDER BY c.code, s.opened_at DESC`,
    [studentId, studentId]
  );
  return rows;
}

async function getStudentCourseSummary(studentId) {
  const [rows] = await query(
    `SELECT c.id AS course_id, c.code, c.title, u.name AS lecturer_name,
            (SELECT COUNT(*) FROM attendance_sessions s WHERE s.course_id = c.id AND s.closed_at IS NOT NULL) AS total_sessions,
            (SELECT COUNT(*) FROM attendance_records ar
             JOIN attendance_sessions s2 ON s2.id = ar.session_id
             WHERE s2.course_id = c.id AND ar.student_id = ? AND ar.is_present = 1 AND s2.closed_at IS NOT NULL
            ) AS attended
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN users u ON u.id = c.lecturer_id
     WHERE e.student_id = ?
     ORDER BY c.code`,
    [studentId, studentId]
  );
  const threshold = parseInt(process.env.AT_RISK_THRESHOLD || '75');
  return rows.map(r => ({
    ...r,
    percentage: r.total_sessions > 0 ? Math.round((r.attended / r.total_sessions) * 100) : null,
    at_risk:    r.total_sessions > 0 && Math.round((r.attended / r.total_sessions) * 100) < threshold,
  }));
}

// ─────────────────────────────────────────────────────────────
// SYSTEM CONFIG
// ─────────────────────────────────────────────────────────────

async function getSystemStats() {
  const [[students]]  = await query("SELECT COUNT(*) AS n FROM users WHERE role='student' AND is_active=1");
  const [[lecturers]] = await query("SELECT COUNT(*) AS n FROM users WHERE role='lecturer' AND is_active=1");
  const [[courses]]   = await query('SELECT COUNT(*) AS n FROM courses WHERE is_active=1');
  const [[sessions]]  = await query('SELECT COUNT(*) AS n FROM attendance_sessions WHERE closed_at IS NULL AND expires_at > NOW()');
  const [[records]]   = await query('SELECT COUNT(*) AS n FROM attendance_records WHERE is_present=1');
  return {
    totalStudents:   students.n,
    totalLecturers:  lecturers.n,
    totalCourses:    courses.n,
    activeSessions:  sessions.n,
    totalMarked:     records.n,
  };
}

module.exports = {
  // Session
  createAttendanceSession,
  closeAttendanceSession,
  getSessionDetails,
  getOpenSession,
  resolveSessionToken,
  generateSessionQR,
  // Marking
  validateAndMarkAttendance,
  computeGpsDistance,
  // Reporting
  getSessionAttendance,
  getCourseAttendanceReport,
  getAtRiskStudents,
  // Manual
  manualCorrectAttendance,
  // Export
  exportSessionCSV,
  exportCourseCSV,
  // Student
  getStudentAttendanceHistory,
  getStudentCourseSummary,
  // System
  getSystemStats,
};
