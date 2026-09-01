-- ============================================================
-- AttendUyo Database Schema
-- University of Uyo — Student Attendance Management System
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS manual_corrections;
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS attendance_sessions;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS webauthn_credentials;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120)  NOT NULL,
  email           VARCHAR(180)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  role            ENUM('student','lecturer','admin') NOT NULL DEFAULT 'student',
  matric_or_staff_id VARCHAR(30) NOT NULL UNIQUE,
  department      VARCHAR(100),
  phone           VARCHAR(20),
  avatar_url      VARCHAR(255) DEFAULT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── WebAuthn Credentials ────────────────────────────────────
CREATE TABLE webauthn_credentials (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  credential_id   TEXT NOT NULL,
  public_key      TEXT NOT NULL,
  counter         BIGINT UNSIGNED NOT NULL DEFAULT 0,
  aaguid          VARCHAR(64),
  transports      VARCHAR(255),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Courses ─────────────────────────────────────────────────
CREATE TABLE courses (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20)   NOT NULL UNIQUE,
  title           VARCHAR(200)  NOT NULL,
  lecturer_id     INT UNSIGNED  NOT NULL,
  department      VARCHAR(100),
  level           SMALLINT UNSIGNED,
  semester        ENUM('first','second') DEFAULT 'first',
  credit_units    TINYINT UNSIGNED DEFAULT 3,
  venue_name      VARCHAR(150),
  venue_lat       DECIMAL(10,7),
  venue_lng       DECIMAL(10,7),
  gps_radius_meters INT UNSIGNED DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_code (code),
  INDEX idx_lecturer (lecturer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Enrollments ─────────────────────────────────────────────
CREATE TABLE enrollments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id       INT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED NOT NULL,
  enrolled_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enrolled_by     INT UNSIGNED,
  UNIQUE KEY uq_enrollment (course_id, student_id),
  FOREIGN KEY (course_id)   REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)  REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (enrolled_by) REFERENCES users(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Attendance Sessions ─────────────────────────────────────
CREATE TABLE attendance_sessions (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id           INT UNSIGNED NOT NULL,
  session_token       VARCHAR(64)  NOT NULL UNIQUE,
  title               VARCHAR(200) DEFAULT NULL COMMENT 'e.g. Week 3 Lecture',
  requires_gps        BOOLEAN NOT NULL DEFAULT FALSE,
  requires_biometric  BOOLEAN NOT NULL DEFAULT FALSE,
  gps_radius_meters   INT UNSIGNED DEFAULT 100,
  opened_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at          DATETIME NOT NULL,
  closed_at           DATETIME DEFAULT NULL,
  created_by          INT UNSIGNED NOT NULL,
  FOREIGN KEY (course_id)   REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)  REFERENCES users(id)   ON DELETE RESTRICT,
  INDEX idx_token (session_token),
  INDEX idx_course_open (course_id, closed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Attendance Records ──────────────────────────────────────
CREATE TABLE attendance_records (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id          INT UNSIGNED NOT NULL,
  student_id          INT UNSIGNED NOT NULL,
  method              ENUM('qr','gps','biometric','manual') NOT NULL DEFAULT 'qr',
  marked_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  gps_lat             DECIMAL(10,7) DEFAULT NULL,
  gps_lng             DECIMAL(10,7) DEFAULT NULL,
  gps_distance_meters INT UNSIGNED DEFAULT NULL,
  biometric_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  is_present          BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_session_student (session_id, student_id),
  FOREIGN KEY (session_id)  REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)  REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_student_session (student_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Manual Corrections (Audit Trail) ───────────────────────
CREATE TABLE manual_corrections (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attendance_record_id  INT UNSIGNED NOT NULL,
  action                ENUM('added','removed','corrected') NOT NULL,
  reason                TEXT NOT NULL,
  corrected_by          INT UNSIGNED NOT NULL,
  corrected_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  previous_method       ENUM('qr','gps','biometric','manual') DEFAULT NULL,
  previous_is_present   BOOLEAN DEFAULT NULL,
  FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE,
  FOREIGN KEY (corrected_by)         REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
