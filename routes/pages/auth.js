'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const { query } = require('../../config/db');

// GET /login
router.get('/login', (req, res) => {
  if (req.session?.user) {
    return res.redirect(`/${req.session.user.role}/dashboard`);
  }
  res.render('auth/login', { title: 'Sign In — AttendUyo', error: null });
});

// POST /login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Sign In — AttendUyo',
        error: 'Please enter your email and password.',
      });
    }

    const [users] = await query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email.trim().toLowerCase()]
    );

    if (!users.length) {
      return res.render('auth/login', {
        title: 'Sign In — AttendUyo',
        error: 'Invalid email or password.',
      });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render('auth/login', {
        title: 'Sign In — AttendUyo',
        error: 'Invalid email or password.',
      });
    }

    // Regenerate session to prevent fixation
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id:               user.id,
        name:             user.name,
        email:            user.email,
        role:             user.role,
        matric_or_staff_id: user.matric_or_staff_id,
        department:       user.department,
        phone:            user.phone || null,
        avatar_url:       user.avatar_url || null,
      };
      const dest = req.session.returnTo || `/${user.role}/dashboard`;
      delete req.session.returnTo;
      req.session.save(() => res.redirect(dest));
    });
  } catch (err) {
    next(err);
  }
});

// GET /logout
router.get('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

module.exports = router;
