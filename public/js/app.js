/**
 * app.js — Shared utilities for AttendUyo
 */

// ── Mobile sidebar toggle ────────────────────────────────────
(function() {
  const sidebar    = document.querySelector('.uuas-sidebar');
  const toggleBtn  = document.getElementById('uuas-sidebar-toggle');
  const overlay    = document.getElementById('uuas-sidebar-overlay');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      const open = sidebar.classList.toggle('uuas-open');
      if (overlay) {
        overlay.classList.toggle('uuas-open', open);
        overlay.style.display = open ? 'block' : 'none';
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      if (sidebar) sidebar.classList.remove('uuas-open');
      overlay.classList.remove('uuas-open');
      overlay.style.display = 'none';
    });
  }
})();

// ── Flash auto-dismiss ────────────────────────────────────────
(function() {
  const alerts = document.querySelectorAll('.uuas-alert[data-autodismiss]');
  alerts.forEach(el => {
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.4s';
      setTimeout(() => el.remove(), 400);
    }, 4000);
  });
})();

// ── Confirm dialogs on data-confirm buttons ───────────────────
(function() {
  document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!confirm(el.dataset.confirm)) e.preventDefault();
    });
  });
})();

// ── Active nav detection ──────────────────────────────────────
(function() {
  const path  = window.location.pathname;
  document.querySelectorAll('.uuas-nav-item').forEach(a => {
    if (a.getAttribute('href') && path.startsWith(a.getAttribute('href'))) {
      a.classList.add('uuas-active');
    }
  });
})();
