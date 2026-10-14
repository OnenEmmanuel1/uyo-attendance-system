-- Run once on databases created before admin session verification was added.
ALTER TABLE attendance_sessions
  ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT FALSE AFTER closed_at,
  ADD COLUMN approved_by INT UNSIGNED DEFAULT NULL AFTER is_approved,
  ADD COLUMN approved_at DATETIME DEFAULT NULL AFTER approved_by,
  ADD CONSTRAINT fk_session_approved_by FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Existing historical sessions are closed; preserve their historical approval state.
UPDATE attendance_sessions SET is_approved = TRUE WHERE closed_at IS NOT NULL;
