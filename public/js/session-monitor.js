/**
 * session-monitor.js — Lecturer live attendance polling
 * Polls /api/sessions/:id/status every 5 seconds and updates the DOM.
 */

(function() {
  const sessionId    = window.UUAS_SESSION_ID;
  if (!sessionId) return;

  const listEl       = document.getElementById('uuas-live-list');
  const countEl      = document.getElementById('uuas-live-count');
  const timerEl      = document.getElementById('uuas-timer-value');
  let   expiresAt    = window.UUAS_EXPIRES_AT ? new Date(window.UUAS_EXPIRES_AT) : null;
  let   pollInterval = null;

  function methodBadge(method) {
    const icons = {
      qr: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>QR`,
      gps: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>GPS`,
      biometric: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Biometric`,
      manual: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Manual`
    };
    const cls = { qr: 'qr', gps: 'gps', biometric: 'biometric', manual: 'manual' };
    return `<span class="uuas-method-badge uuas-method-badge--${cls[method] || 'qr'}">${icons[method] || method}</span>`;
  }

  function renderList(attendance) {
    if (!listEl) return;
    if (!attendance.length) {
      listEl.innerHTML = '<tr><td colspan="5" class="uuas-empty" style="padding:2rem;text-align:center;color:var(--uuas-text-muted)">No students have marked attendance yet</td></tr>';
      return;
    }
    listEl.innerHTML = attendance.map((r, i) => `
      <tr>
        <td class="uuas-text-sm uuas-muted">${i + 1}</td>
        <td><span class="uuas-bold">${r.student_name}</span></td>
        <td class="uuas-text-sm uuas-muted">${r.matric}</td>
        <td>${methodBadge(r.method)}</td>
        <td class="uuas-text-sm uuas-muted">${r.marked_at ? new Date(r.marked_at).toLocaleTimeString() : '—'}</td>
      </tr>
    `).join('');

    if (countEl) {
      countEl.textContent = attendance.filter(r => r.is_present).length;
    }
  }

  function updateTimer() {
    if (!timerEl || !expiresAt) return;
    const remaining = Math.max(0, expiresAt - Date.now());
    const m = Math.floor(remaining / 60000).toString().padStart(2, '0');
    const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
    if (remaining === 0) {
      timerEl.closest('.uuas-timer')?.classList.add('uuas-timer--expired');
    }
  }

  async function poll() {
    try {
      const res  = await fetch(`/api/sessions/${sessionId}/status`);
      const data = await res.json();
      if (!res.ok) return;
      renderList(data.attendance || []);
      if (data.session?.expires_at) expiresAt = new Date(data.session.expires_at);
      if (data.session?.closed_at) {
        clearInterval(pollInterval);
        document.getElementById('uuas-session-closed-banner')?.classList.remove('uuas-hidden');
      }
    } catch {}
  }

  // Kick off
  poll();
  setInterval(updateTimer, 1000);
  pollInterval = setInterval(poll, 5000);
})();
