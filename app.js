'use strict';
require('dotenv').config();

const express       = require('express');
const session       = require('express-session');
const flash         = require('connect-flash');
const cookieParser  = require('cookie-parser');
const morgan        = require('morgan');
const methodOverride= require('method-override');
const path          = require('path');

const { attachUser }   = require('./middleware/auth');
const { requireAuth }  = require('./middleware/auth');
const { requireRole }  = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// ── Page Routes ────────────────────────────────────────────────
const authPages     = require('./routes/pages/auth');
const studentPages  = require('./routes/pages/student');
const lecturerPages = require('./routes/pages/lecturer');
const adminPages    = require('./routes/pages/admin');
const profilePages  = require('./routes/pages/profile');

// ── API Routes ─────────────────────────────────────────────────
const sessionsApi      = require('./routes/api/sessions');
const attendanceApi    = require('./routes/api/attendance');
const usersApi         = require('./routes/api/users');
const coursesApi       = require('./routes/api/courses');
const webauthnApi      = require('./routes/api/webauthn');
const notificationsApi = require('./routes/api/notifications');

const app = express();

// ── View Engine ────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static Assets ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Body Parsing ───────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride('_method'));

// ── Logging ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Session ────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'uuas-dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ── Flash Messages ─────────────────────────────────────────────
app.use(flash());

// ── Locals ─────────────────────────────────────────────────────
app.use(attachUser);
app.use((req, res, next) => {
  res.locals.appName = 'AttendUyo';
  res.locals.year    = new Date().getFullYear();
  next();
});

// ── Auth / Public Routes ────────────────────────────────────────
app.use('/', authPages);

// Root redirect
app.get('/', (req, res) => {
  if (req.session?.user) return res.redirect(`/${req.session.user.role}/dashboard`);
  res.redirect('/login');
});

// ── Protected Page Routes ──────────────────────────────────────
app.use('/student',  requireAuth, requireRole('student'),  studentPages);
app.use('/lecturer', requireAuth, requireRole('lecturer'), lecturerPages);
app.use('/admin',    requireAuth, requireRole('admin'),    adminPages);
app.use('/profile',  requireAuth, profilePages);

// Profile aliases for convenience
app.get(['/student/profile', '/lecturer/profile', '/admin/profile'], requireAuth, (req, res) => res.redirect('/profile'));

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/sessions',      requireAuth, sessionsApi);
app.use('/api/attendance',    requireAuth, attendanceApi);
app.use('/api/users',         requireAuth, requireRole('admin'), usersApi);
app.use('/api/courses',       requireAuth, coursesApi);
app.use('/api/webauthn',      requireAuth, webauthnApi);
app.use('/api/notifications', requireAuth, notificationsApi);

// ── 404 Handler ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('errors/404', { user: req.session?.user });
});

// ── Global Error Handler ───────────────────────────────────────
app.use(errorHandler);

module.exports = app;
