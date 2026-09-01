-- ============================================================
-- AttendUyo Seed Data
-- Passwords (all): password123
-- bcrypt hash rounds=10 generated via: bcrypt.hashSync(pw,10)
-- ============================================================

-- Admin (password: password123)
INSERT INTO users (name, email, password_hash, role, matric_or_staff_id, department) VALUES
('Dr. Emmanuel Akpan', 'admin@uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'admin', 'ADM/001/2020', 'Registry');

-- Lecturers (password: password123)
INSERT INTO users (name, email, password_hash, role, matric_or_staff_id, department) VALUES
('Prof. Bassey Okon', 'b.okon@uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'lecturer', 'STAFF/CS/0042', 'Computer Science'),

('Dr. Uduak Essien', 'u.essien@uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'lecturer', 'STAFF/EE/0017', 'Electrical Engineering');

-- Students (password: password123)
INSERT INTO users (name, email, password_hash, role, matric_or_staff_id, department) VALUES
('Aniekan Umoh',     'a.umoh@students.uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'student', 'CSC/2021/001', 'Computer Science'),

('Blessing Etuk',    'b.etuk@students.uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'student', 'CSC/2021/002', 'Computer Science'),

('Chinyere Nwachukwu','c.nwachukwu@students.uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'student', 'CSC/2021/003', 'Computer Science'),

('David Ita',        'd.ita@students.uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'student', 'EEE/2021/001', 'Electrical Engineering'),

('Edidiong Effiong', 'e.effiong@students.uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'student', 'EEE/2021/002', 'Electrical Engineering'),

('Favour Obi',       'f.obi@students.uniuyo.edu.ng',
 '$2b$10$XcsvyBg/RhNB4fU6LwBJMu11QlAJKEn0iHNQeVUPgEJuVGr/MJpsy',
 'student', 'CSC/2021/004', 'Computer Science');

-- Courses (lecturer IDs: Prof Bassey=2, Dr Uduak=3)
INSERT INTO courses (code, title, lecturer_id, department, level, semester, credit_units, venue_name, venue_lat, venue_lng, gps_radius_meters) VALUES
('CSC301', 'Data Structures and Algorithms', 2, 'Computer Science', 300, 'first', 3,
 'CS Block — Lecture Hall A', 5.0543800, 7.9137300, 80),

('CSC305', 'Operating Systems', 2, 'Computer Science', 300, 'first', 3,
 'CS Block — Lab 2', 5.0545100, 7.9139800, 80),

('EEE301', 'Circuit Theory', 3, 'Electrical Engineering', 300, 'first', 3,
 'Engineering Block — Room 101', 5.0547200, 7.9141500, 100),

('CSC309', 'Software Engineering', 2, 'Computer Science', 300, 'second', 3,
 'CS Block — Lecture Hall B', 5.0544500, 7.9138200, 80);

-- Enrollments
-- CSC301: students 4,5,6,9 (Aniekan,Blessing,Chinyere,Favour)
INSERT INTO enrollments (course_id, student_id, enrolled_by) VALUES
(1, 4, 1),(1, 5, 1),(1, 6, 1),(1, 9, 1);

-- CSC305: students 4,5,9
INSERT INTO enrollments (course_id, student_id, enrolled_by) VALUES
(2, 4, 1),(2, 5, 1),(2, 9, 1);

-- EEE301: students 7,8
INSERT INTO enrollments (course_id, student_id, enrolled_by) VALUES
(3, 7, 1),(3, 8, 1);

-- CSC309: students 4,5,6,9
INSERT INTO enrollments (course_id, student_id, enrolled_by) VALUES
(4, 4, 1),(4, 5, 1),(4, 6, 1),(4, 9, 1);

-- ─── Attendance Sessions (closed, historical) ─────────────────
-- CSC301 - Session 1 (Week 1)
INSERT INTO attendance_sessions
  (course_id, session_token, title, requires_gps, requires_biometric, gps_radius_meters,
   opened_at, expires_at, closed_at, created_by)
VALUES
(1, 'tok-csc301-s1', 'Week 1 — Introduction', FALSE, FALSE, 80,
 '2024-09-02 08:00:00', '2024-09-02 10:00:00', '2024-09-02 09:45:00', 2),

(1, 'tok-csc301-s2', 'Week 2 — Arrays & Lists', TRUE, FALSE, 80,
 '2024-09-09 08:00:00', '2024-09-09 10:00:00', '2024-09-09 09:50:00', 2),

(1, 'tok-csc301-s3', 'Week 3 — Stacks & Queues', TRUE, FALSE, 80,
 '2024-09-16 08:00:00', '2024-09-16 10:00:00', '2024-09-16 09:55:00', 2),

(1, 'tok-csc301-s4', 'Week 4 — Trees', TRUE, FALSE, 80,
 '2024-09-23 08:00:00', '2024-09-23 10:00:00', '2024-09-23 09:45:00', 2),

-- CSC305 - 3 Sessions
(2, 'tok-csc305-s1', 'Week 1 — OS Overview', FALSE, FALSE, 80,
 '2024-09-03 10:00:00', '2024-09-03 12:00:00', '2024-09-03 11:50:00', 2),

(2, 'tok-csc305-s2', 'Week 2 — Processes', TRUE, FALSE, 80,
 '2024-09-10 10:00:00', '2024-09-10 12:00:00', '2024-09-10 11:45:00', 2),

(2, 'tok-csc305-s3', 'Week 3 — Scheduling', TRUE, FALSE, 80,
 '2024-09-17 10:00:00', '2024-09-17 12:00:00', '2024-09-17 11:55:00', 2),

-- EEE301 - 3 Sessions
(3, 'tok-eee301-s1', 'Week 1 — Fundamentals', FALSE, FALSE, 100,
 '2024-09-04 14:00:00', '2024-09-04 16:00:00', '2024-09-04 15:55:00', 3),

(3, 'tok-eee301-s2', 'Week 2 — KVL & KCL', TRUE, FALSE, 100,
 '2024-09-11 14:00:00', '2024-09-11 16:00:00', '2024-09-11 15:50:00', 3),

(3, 'tok-eee301-s3', 'Week 3 — AC Circuits', TRUE, FALSE, 100,
 '2024-09-18 14:00:00', '2024-09-18 16:00:00', '2024-09-18 15:45:00', 3);

-- ─── Attendance Records ───────────────────────────────────────
-- CSC301 S1 (tok-csc301-s1 = session_id 1): all 4 students present
INSERT INTO attendance_records (session_id, student_id, method, marked_at, is_present) VALUES
(1, 4, 'qr', '2024-09-02 08:10:00', TRUE),
(1, 5, 'qr', '2024-09-02 08:12:00', TRUE),
(1, 6, 'qr', '2024-09-02 08:14:00', TRUE),
(1, 9, 'qr', '2024-09-02 08:16:00', TRUE);

-- CSC301 S2 (id 2): 3/4 present (Chinyere absent)
INSERT INTO attendance_records (session_id, student_id, method, marked_at, gps_lat, gps_lng, gps_distance_meters, is_present) VALUES
(2, 4, 'gps', '2024-09-09 08:08:00', 5.0543800, 7.9137300, 2, TRUE),
(2, 5, 'gps', '2024-09-09 08:09:00', 5.0543900, 7.9137400, 4, TRUE),
(2, 9, 'gps', '2024-09-09 08:11:00', 5.0544000, 7.9137500, 6, TRUE);

-- CSC301 S3 (id 3): 2/4 present
INSERT INTO attendance_records (session_id, student_id, method, marked_at, gps_lat, gps_lng, gps_distance_meters, is_present) VALUES
(3, 4, 'gps', '2024-09-16 08:07:00', 5.0543800, 7.9137300, 2, TRUE),
(3, 5, 'gps', '2024-09-16 08:09:00', 5.0543900, 7.9137400, 4, TRUE);

-- CSC301 S4 (id 4): 4/4 present
INSERT INTO attendance_records (session_id, student_id, method, marked_at, gps_lat, gps_lng, gps_distance_meters, is_present) VALUES
(4, 4, 'gps', '2024-09-23 08:05:00', 5.0543800, 7.9137300, 2, TRUE),
(4, 5, 'gps', '2024-09-23 08:07:00', 5.0543900, 7.9137400, 4, TRUE),
(4, 6, 'gps', '2024-09-23 08:08:00', 5.0544100, 7.9137600, 8, TRUE),
(4, 9, 'gps', '2024-09-23 08:10:00', 5.0544200, 7.9137700, 10, TRUE);

-- CSC305 S1 (id 5): all 3 present
INSERT INTO attendance_records (session_id, student_id, method, marked_at, is_present) VALUES
(5, 4, 'qr', '2024-09-03 10:05:00', TRUE),
(5, 5, 'qr', '2024-09-03 10:06:00', TRUE),
(5, 9, 'qr', '2024-09-03 10:07:00', TRUE);

-- CSC305 S2 (id 6): 2/3 present (Favour absent)
INSERT INTO attendance_records (session_id, student_id, method, marked_at, gps_lat, gps_lng, gps_distance_meters, is_present) VALUES
(6, 4, 'gps', '2024-09-10 10:04:00', 5.0545100, 7.9139800, 3, TRUE),
(6, 5, 'gps', '2024-09-10 10:06:00', 5.0545200, 7.9139900, 5, TRUE);

-- CSC305 S3 (id 7): 1/3 present
INSERT INTO attendance_records (session_id, student_id, method, marked_at, gps_lat, gps_lng, gps_distance_meters, is_present) VALUES
(7, 4, 'gps', '2024-09-17 10:05:00', 5.0545100, 7.9139800, 3, TRUE);

-- EEE301 S1 (id 8): both present
INSERT INTO attendance_records (session_id, student_id, method, marked_at, is_present) VALUES
(8, 7, 'qr', '2024-09-04 14:05:00', TRUE),
(8, 8, 'qr', '2024-09-04 14:07:00', TRUE);

-- EEE301 S2 (id 9): both present
INSERT INTO attendance_records (session_id, student_id, method, marked_at, gps_lat, gps_lng, gps_distance_meters, is_present) VALUES
(9, 7, 'gps', '2024-09-11 14:04:00', 5.0547200, 7.9141500, 2, TRUE),
(9, 8, 'gps', '2024-09-11 14:06:00', 5.0547300, 7.9141600, 4, TRUE);

-- EEE301 S3 (id 10): David only (Edidiong absent)
INSERT INTO attendance_records (session_id, student_id, method, marked_at, gps_lat, gps_lng, gps_distance_meters, is_present) VALUES
(10, 7, 'gps', '2024-09-18 14:05:00', 5.0547200, 7.9141500, 2, TRUE);

-- Manual correction example: Admin manually added Chinyere to CSC301 S2
-- First insert a record for Chinyere in session 2 as manual
INSERT INTO attendance_records (session_id, student_id, method, marked_at, is_present) VALUES
(2, 6, 'manual', '2024-09-09 16:00:00', TRUE);

INSERT INTO manual_corrections (attendance_record_id, action, reason, corrected_by, corrected_at) VALUES
(LAST_INSERT_ID(), 'added', 'Student was present but phone died — verified via physical register', 1, '2024-09-09 16:05:00');
