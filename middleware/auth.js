'use strict';

/**
 * requireAuth — ensure user is logged in.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

/**
 * requireRole — ensure the user has at least one of the specified roles.
 * @param {...string} roles
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.status(403).render('errors/403', { user: req.session.user });
    }
    next();
  };
}

/**
 * Attach user to res.locals for EJS templates.
 */
function attachUser(req, res, next) {
  res.locals.user        = req.session?.user || null;
  res.locals.flashError  = req.flash ? req.flash('error')   : [];
  res.locals.flashSuccess= req.flash ? req.flash('success') : [];
  next();
}

module.exports = { requireAuth, requireRole, attachUser };
