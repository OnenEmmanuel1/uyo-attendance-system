'use strict';

function errorHandler(err, req, res, next) {
  const status  = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // API routes return JSON
  const isApi = req.path.startsWith('/api/');
  if (isApi) {
    return res.status(status).json({
      error:   message,
      ...(err.gpsDistance !== undefined ? { gpsDistance: err.gpsDistance, gpsRadius: err.gpsRadius } : {}),
    });
  }

  // Page routes render error view
  console.error(`[${new Date().toISOString()}] ${status} — ${message}`, err.stack || '');
  if (status === 403) return res.status(403).render('errors/403', { user: req.session?.user });
  if (status === 404) return res.status(404).render('errors/404', { user: req.session?.user });
  res.status(status).render('errors/500', { user: req.session?.user, message });
}

module.exports = { errorHandler };
