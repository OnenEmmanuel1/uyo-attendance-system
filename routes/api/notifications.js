'use strict';
const router = require('express').Router();
const { query } = require('../../config/db');

// ── GET /api/notifications ────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const user = req.session.user;
    if (!user) return res.json({ unreadCount: 0, notifications: [] });

    const notifications = [];
    const readAfter = req.session.notificationsReadTime ? new Date(req.session.notificationsReadTime) : new Date(0);

    if (user.role === 'student') {
      // 1. Check for live open sessions in enrolled courses
      const [openSessions] = await query(
        `SELECT s.id, s.session_token, c.code, c.title, c.venue_name, s.opened_at, s.expires_at,
                (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.student_id = ?) AS has_marked
         FROM attendance_sessions s
         JOIN courses c ON s.course_id = c.id
         JOIN enrollments e ON e.course_id = c.id
         WHERE e.student_id = ? AND s.status = 'open' AND s.expires_at > NOW()
         ORDER BY s.opened_at DESC`,
        [user.id, user.id]
      );

      openSessions.forEach(s => {
        if (!s.has_marked) {
          notifications.push({
            id: `session-${s.id}`,
            type: 'session_active',
            title: `Live Session: ${s.code}`,
            message: `${s.title} attendance is currently open at ${s.venue_name || 'Classroom'}.`,
            link: `/student/mark-attendance?token=${encodeURIComponent(s.session_token)}`,
            createdAt: s.opened_at,
            isUnread: new Date(s.opened_at) > readAfter,
            icon: 'bell',
          });
        }
      });

      // 2. Recent attendance records
      const [recentMarks] = await query(
        `SELECT ar.id, ar.marked_at, ar.method, c.code, c.title
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         JOIN courses c ON s.course_id = c.id
         WHERE ar.student_id = ?
         ORDER BY ar.marked_at DESC
         LIMIT 3`,
        [user.id]
      );

      recentMarks.forEach(r => {
        notifications.push({
          id: `mark-${r.id}`,
          type: 'attendance_success',
          title: `Attendance Recorded: ${r.code}`,
          message: `Your attendance for ${r.title} was marked via ${r.method.toUpperCase()}.`,
          link: `/student/history`,
          createdAt: r.marked_at,
          isUnread: new Date(r.marked_at) > readAfter,
          icon: 'check',
        });
      });

    } else if (user.role === 'lecturer') {
      // 1. Active sessions opened by lecturer
      const [activeSessions] = await query(
        `SELECT s.id, s.session_token, c.code, c.title, s.opened_at, s.expires_at,
                (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id) AS attendee_count
         FROM attendance_sessions s
         JOIN courses c ON s.course_id = c.id
         WHERE s.lecturer_id = ? AND s.status = 'open' AND s.expires_at > NOW()
         ORDER BY s.opened_at DESC`,
        [user.id]
      );

      activeSessions.forEach(s => {
        notifications.push({
          id: `session-lec-${s.id}`,
          type: 'session_active',
          title: `Active Session: ${s.code}`,
          message: `${s.attendee_count} student(s) currently marked. Session expires at ${new Date(s.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          link: `/lecturer/session/${s.id}`,
          createdAt: s.opened_at,
          isUnread: new Date(s.opened_at) > readAfter,
          icon: 'radio',
        });
      });

      // 2. Recent courses or session summary
      const [recentCompleted] = await query(
        `SELECT s.id, c.code, c.title, s.closed_at,
                (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id) AS attendee_count
         FROM attendance_sessions s
         JOIN courses c ON s.course_id = c.id
         WHERE s.lecturer_id = ? AND s.status = 'closed'
         ORDER BY s.closed_at DESC
         LIMIT 2`,
        [user.id]
      );

      recentCompleted.forEach(s => {
        notifications.push({
          id: `session-closed-${s.id}`,
          type: 'session_closed',
          title: `Session Summary: ${s.code}`,
          message: `Closed session with ${s.attendee_count} total verified attendee(s).`,
          link: `/lecturer/reports`,
          createdAt: s.closed_at,
          isUnread: new Date(s.closed_at) > readAfter,
          icon: 'check',
        });
      });

    } else if (user.role === 'admin') {
      // Admin notifications
      const [stats] = await query(
        `SELECT
           (SELECT COUNT(*) FROM attendance_sessions WHERE status = 'open') AS open_sessions,
           (SELECT COUNT(*) FROM users WHERE is_active = 1) AS active_users,
           (SELECT COUNT(*) FROM attendance_records WHERE DATE(marked_at) = CURDATE()) AS marks_today`
      );

      const s = stats[0] || {};
      notifications.push({
        id: 'admin-live-summary',
        type: 'system_summary',
        title: 'AttendUyo System Status',
        message: `${s.open_sessions || 0} active live session(s), ${s.marks_today || 0} attendance marks recorded today.`,
        link: `/admin/dashboard`,
        createdAt: new Date(),
        isUnread: false,
        icon: 'activity',
      });

      // Recent users
      const [recentUsers] = await query(
        `SELECT id, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 2`
      );
      recentUsers.forEach(u => {
        notifications.push({
          id: `user-new-${u.id}`,
          type: 'new_user',
          title: `New User: ${u.name}`,
          message: `Registered as ${u.role} on ${new Date(u.created_at).toLocaleDateString()}.`,
          link: `/admin/users`,
          createdAt: u.created_at,
          isUnread: new Date(u.created_at) > readAfter,
          icon: 'user',
        });
      });
    }

    // Default welcome notification if list is empty
    if (notifications.length === 0) {
      notifications.push({
        id: 'welcome-notif',
        type: 'welcome',
        title: 'Welcome to AttendUyo',
        message: 'No new alerts. Your attendance records and session updates will appear here.',
        link: `/${user.role}/dashboard`,
        createdAt: new Date(),
        isUnread: false,
        icon: 'bell',
      });
    }

    const unreadCount = notifications.filter(n => n.isUnread).length;
    res.json({ unreadCount, notifications });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/notifications/mark-read ─────────────────────────
router.post('/mark-read', (req, res) => {
  req.session.notificationsReadTime = Date.now();
  req.session.save(() => {
    res.json({ success: true });
  });
});

module.exports = router;
