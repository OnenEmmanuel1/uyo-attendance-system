# AttendUyo — Student Attendance Management System
### University of Uyo

A production-ready full-stack web application for managing student attendance with **QR Code**, **GPS**, **WebAuthn Biometric**, and **Manual** verification methods.

---

## 🗂 Project Structure

```
uyo attendance/
├── app.js                    # Express app setup
├── server.js                 # HTTP server entry point
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
│
├── config/
│   └── db.js                 # MySQL connection pool
│
├── engine/
│   └── uuasEngine.js         # All business logic (NO business logic in routes)
│
├── middleware/
│   ├── auth.js               # requireAuth, requireRole, attachUser
│   └── errorHandler.js       # Global error handler
│
├── routes/
│   ├── pages/                # EJS page-rendering routes
│   │   ├── auth.js           # /login, /logout
│   │   ├── student.js        # /student/*
│   │   ├── lecturer.js       # /lecturer/*
│   │   └── admin.js          # /admin/*
│   └── api/                  # JSON API routes
│       ├── sessions.js       # /api/sessions/*
│       ├── attendance.js     # /api/attendance/*
│       ├── users.js          # /api/users/*
│       ├── courses.js        # /api/courses/*
│       └── webauthn.js       # /api/webauthn/*
│
├── views/
│   ├── partials/             # head, footer, navbar, sidebars, flash
│   ├── auth/login.ejs
│   ├── student/              # dashboard, courses, mark-attendance, history
│   ├── lecturer/             # dashboard, courses, session, reports, create-course
│   ├── admin/                # dashboard, users, courses, reports, config, enroll
│   └── errors/               # 403, 404, 500
│
├── public/
│   ├── css/uuas.css          # Full flat CSS design system (uuas-* prefix)
│   └── js/
│       ├── app.js            # Shared utilities
│       ├── qr-scanner.js     # html5-qrcode wrapper
│       ├── gps.js            # navigator.geolocation wrapper
│       ├── webauthn.js       # WebAuthn registration & authentication
│       └── session-monitor.js # Lecturer live session polling
│
├── db/
│   ├── schema.sql            # Normalized MySQL schema
│   └── seed.sql              # 1 admin, 2 lecturers, 6 students, 4 courses
│
└── scripts/
    └── initDb.js             # DB initialization helper
```

---

## 🚀 Setup — Local Development

### Prerequisites
- **Node.js** ≥ 18
- **MySQL 8** (local or Docker)

### 1. Clone & Install

```bash
cd "uyo attendance"
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your MySQL credentials
```

### 3. Initialize Database

```bash
# Option A: Using the init script
node scripts/initDb.js

# Option B: Manual import
mysql -u root -p < db/schema.sql
mysql -u root -p attenduyo_db < db/seed.sql
```

### 4. Run Development Server

```bash
npm run dev
# → http://localhost:3000
```

---

## 🐳 Docker Compose Setup

```bash
docker-compose up --build
# → http://localhost:3000
```

MySQL data is persisted in a Docker volume. Schema and seed are applied automatically via `/docker-entrypoint-initdb.d/`.

---

## 🔑 Test Credentials

| Role     | Email                                    | Password        |
|----------|------------------------------------------|-----------------|
| Admin    | `admin@uniuyo.edu.ng`                    | `Admin@1234`    |
| Lecturer | `b.okon@uniuyo.edu.ng`                   | `Lecturer@1234` |
| Lecturer | `u.essien@uniuyo.edu.ng`                 | `Lecturer@1234` |
| Student  | `a.umoh@students.uniuyo.edu.ng`          | `Student@1234`  |
| Student  | `b.etuk@students.uniuyo.edu.ng`          | `Student@1234`  |
| Student  | `c.nwachukwu@students.uniuyo.edu.ng`     | `Student@1234`  |
| Student  | `d.ita@students.uniuyo.edu.ng`           | `Student@1234`  |
| Student  | `e.effiong@students.uniuyo.edu.ng`       | `Student@1234`  |
| Student  | `f.obi@students.uniuyo.edu.ng`           | `Student@1234`  |

---

## 📡 Attendance Verification Methods

### 1. QR Code (Real Implementation)
- Lecturer opens a session → server generates a **UUID-based session token**
- Token is rendered as a **QR code data-URL** using the `qrcode` npm package
- Students scan with device camera via **`html5-qrcode`** (CDN) which decodes the token
- Decoded token is submitted to `POST /api/attendance/mark` for server-side validation

### 2. GPS Location (Real Implementation)
- Uses **`navigator.geolocation.getCurrentPosition`** to capture real device coordinates
- Server computes distance using the **Haversine formula** (great-circle distance)
- If student is outside the configured radius (default: 100m) → attendance **rejected with specific distance error**
- Venue coordinates are set per-course; lecturers can use "Use My Location" on course creation

### 3. Biometric / WebAuthn (Real Implementation)
- Uses **`navigator.credentials`** (Web Authentication API) with a **platform authenticator**
- Students first register their device: `POST /api/webauthn/register/begin` → `/finish`
- On marking: `POST /api/webauthn/authenticate/begin` → device prompts fingerprint/Face ID/PIN → `/finish`
- Server sets `session.biometricVerified = true` which is passed to the attendance marking endpoint
- **⚠️ Requires HTTPS or `localhost`** — browsers block `navigator.credentials` on plain HTTP

### 4. Manual Correction (Audit Trail)
- Lecturer or Admin can mark/unmark a student via the session live view
- Every correction writes a `manual_corrections` record with: who corrected, when, the reason, and the previous value
- Never silently overwrites — full audit trail preserved

---

## 🛡 Security Notes

- Passwords are hashed with **bcrypt (cost factor 10)**
- Sessions use **express-session** with HttpOnly cookies
- All database queries use **parameterized statements** (mysql2 `execute()`) — no string concatenation
- Role-based access enforced via `requireRole()` middleware on all protected routes
- Session is **regenerated** on login to prevent session fixation

---

## 📋 Validation Rules (Server-Side)

The `validateAndMarkAttendance()` function in `engine/uuasEngine.js` enforces:

1. **Valid token** — session must exist
2. **Open session** — `closed_at IS NULL` and `expires_at > NOW()`
3. **Enrollment check** — student must be enrolled in the course
4. **Duplicate prevention** — unique constraint + check before insert
5. **GPS radius** — if `requires_gps`, distance must be ≤ `gps_radius_meters`
6. **Biometric** — if `requires_biometric`, `biometric_verified` must be `true`

Any failed check returns a **specific, descriptive error message** — never a silent failure.

---

## 🗄 Database Schema Overview

| Table                 | Purpose                                        |
|-----------------------|------------------------------------------------|
| `users`               | All accounts (student/lecturer/admin)          |
| `webauthn_credentials`| Device credentials for biometric auth         |
| `courses`             | Courses with venue GPS coordinates             |
| `enrollments`         | Student-course enrollment records             |
| `attendance_sessions` | Timed sessions with token + config            |
| `attendance_records`  | Individual marks with method + GPS + biometric|
| `manual_corrections`  | Audit trail for manual changes                |

---

## ⚙️ Environment Variables

| Variable                | Default      | Description                          |
|-------------------------|--------------|--------------------------------------|
| `PORT`                  | `3000`       | HTTP server port                     |
| `DB_HOST`               | `localhost`  | MySQL host                           |
| `DB_PORT`               | `3306`       | MySQL port                           |
| `DB_USER`               | —            | MySQL username                       |
| `DB_PASSWORD`           | —            | MySQL password                       |
| `DB_NAME`               | —            | MySQL database name                  |
| `SESSION_SECRET`        | —            | Session signing secret (keep secret!)|
| `GPS_DEFAULT_RADIUS`    | `100`        | GPS radius in meters                 |
| `SESSION_EXPIRY_MINUTES`| `60`         | Default session duration             |
| `AT_RISK_THRESHOLD`     | `75`         | At-risk attendance % threshold       |
