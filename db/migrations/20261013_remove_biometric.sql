-- Run after 20261013_admin_session_approval.sql on existing databases.
-- Keep old attendance history, but normalize biometric marks to their QR/GPS source.
UPDATE attendance_records
SET method = CASE WHEN gps_lat IS NOT NULL THEN 'gps' ELSE 'qr' END
WHERE method = 'biometric';

UPDATE manual_corrections SET previous_method = 'qr' WHERE previous_method = 'biometric';

ALTER TABLE attendance_records
  MODIFY COLUMN method ENUM('qr','gps','manual') NOT NULL DEFAULT 'qr',
  DROP COLUMN biometric_verified;

ALTER TABLE manual_corrections
  MODIFY COLUMN previous_method ENUM('qr','gps','manual') DEFAULT NULL;

ALTER TABLE attendance_sessions DROP COLUMN requires_biometric;
DROP TABLE IF EXISTS webauthn_credentials;
