/**
 * session-monitor.js — Lecturer live attendance polling
 * Polls /api/sessions/:id/status every 5 seconds and updates the DOM.
 */

(function() {
  const sessionId    = window.UUAS_SESSION_ID;
  if (!sessionId) return;

  const listEl       = document.getElementById('uuas-live-list');
  const absentListEl = document.getElementById('uuas-absent-list');
  const absentCountEl = document.getElementById('uuas-absent-count');
  const countEl      = document.getElementById('uuas-live-count');
  const timerEl      = document.getElementById('uuas-timer-value');
  let   expiresAt    = window.UUAS_EXPIRES_AT ? new Date(window.UUAS_EXPIRES_AT) : null;
  let   pollInterval = null;
  let   latestRoster = [];

  function methodBadge(method) {
    const icons = {
      qr: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>QR`,
      gps: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>GPS`,
      manual: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:3px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Manual`
    };
    const cls = { qr: 'qr', gps: 'gps', manual: 'manual' };
    return `<span class="uuas-method-badge uuas-method-badge--${cls[method] || 'qr'}">${icons[method] || method}</span>`;
  }

  function renderList(attendance) {
    if (!listEl) return;
    const present = (attendance || []).filter(r => Number(r.is_present) === 1);
    if (!present.length) {
      listEl.innerHTML = '<tr><td colspan="5" class="uuas-empty" style="padding:2rem;text-align:center;color:var(--uuas-text-muted)">No students have marked attendance yet</td></tr>';
      return;
    }
    listEl.innerHTML = present.map((r, i) => `
      <tr>
        <td class="uuas-text-sm uuas-muted">${i + 1}</td>
        <td><span class="uuas-bold">${r.student_name}</span></td>
        <td class="uuas-text-sm uuas-muted">${r.matric}</td>
        <td>${methodBadge(r.method)}</td>
        <td class="uuas-text-sm uuas-muted">${r.marked_at ? new Date(r.marked_at).toLocaleTimeString() : '—'}</td>
      </tr>
    `).join('');

    if (countEl) {
      countEl.textContent = present.length;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function renderAbsent(roster, isFinished = false) {
    if (!absentListEl) return;
    const absent = (roster || []).filter(student => !student.is_present);
    const titleEl = document.getElementById('uuas-unmarked-title');
    const descriptionEl = document.getElementById('uuas-unmarked-description');
    if (titleEl) titleEl.textContent = isFinished ? 'Did Not Attend' : 'Not Yet Marked';
    if (descriptionEl) descriptionEl.textContent = isFinished
      ? 'Students without a present attendance record after this session ended.'
      : 'These students can still mark attendance while the session is open.';
    if (absentCountEl) absentCountEl.textContent = `${absent.length} student${absent.length === 1 ? '' : 's'}`;
    absentListEl.innerHTML = absent.length ? absent.map(student => `
      <tr><td><span class="uuas-bold">${escapeHtml(student.student_name)}</span></td>
      <td class="uuas-text-sm uuas-muted">${escapeHtml(student.matric || '—')}</td>
      <td><span class="uuas-pill ${isFinished ? 'uuas-pill--absent' : 'uuas-pill--late'}">${isFinished ? 'Absent' : 'Not yet marked'}</span></td></tr>
    `).join('') : '<tr><td colspan="3" style="padding:1.5rem;text-align:center;color:var(--uuas-text-muted)">All enrolled students are marked present.</td></tr>';
  }

  function showFinished(message) {
    const banner = document.getElementById('uuas-session-closed-banner');
    if (banner) banner.classList.remove('uuas-hidden');
    const messageEl = document.getElementById('uuas-session-finished-message');
    if (messageEl && message) messageEl.textContent = message;
    renderAbsent(latestRoster, true);
    clearInterval(pollInterval);
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
      if (data.session?.expires_at) expiresAt = new Date(data.session.expires_at);
      latestRoster = data.roster || [];
      renderList(data.attendance || []);
      const timeFinished = expiresAt && expiresAt <= new Date();
      renderAbsent(latestRoster, Boolean(data.session?.closed_at) || timeFinished);
      if (data.session?.closed_at) {
        const expiredAtEnd = expiresAt && new Date(data.session.closed_at) >= expiresAt;
        showFinished(expiredAtEnd ? 'Session time has finished. Students can no longer mark attendance.' : 'Session was closed. Students can no longer mark attendance.');
      } else if (timeFinished) {
        showFinished('Session time has finished. Students can no longer mark attendance.');
      }
    } catch {}
  }

  // Kick off
  poll();
  setInterval(updateTimer, 1000);
  pollInterval = setInterval(poll, 5000);
})();
