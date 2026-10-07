'use strict';
const router = require('express').Router();
const path   = require('path');
const fs     = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { query } = require('../../config/db');

// ── Multer Configuration for Avatar Uploads ───────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.session.user.id}-${uniqueSuffix}${cleanExt}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const mimeMatch = allowed.test(file.mimetype);
  const extMatch  = allowed.test(path.extname(file.originalname).toLowerCase());
  if (mimeMatch && extMatch) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

// ── GET /profile ──────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await query(
      'SELECT id, name, email, role, matric_or_staff_id, department, phone, avatar_url, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    if (!rows.length) {
      req.flash('error', 'User account not found.');
      return res.redirect('/login');
    }

    const profileUser = rows[0];
    const [departments] = await query('SELECT name FROM departments WHERE is_active = 1 OR name = ? ORDER BY name', [profileUser.department || '']);

    // Check if user has registered WebAuthn credentials
    const [webauthnRows] = await query(
      'SELECT COUNT(*) AS count FROM webauthn_credentials WHERE user_id = ?',
      [userId]
    );
    const hasBiometrics = (webauthnRows[0]?.count || 0) > 0;

    res.render('profile/index', {
      title: 'My Profile — AttendUyo',
      profileUser,
      departments,
      hasBiometrics,
      activeNav: 'profile',
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /profile ─────────────────────────────────────────────
router.post('/', (req, res, next) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      req.flash('error', err.message || 'Error uploading profile picture.');
      return res.redirect('/profile');
    }

    try {
      const userId = req.session.user.id;
      const { name, phone, department, current_password, new_password, confirm_password, remove_avatar } = req.body;

      const [rows] = await query('SELECT * FROM users WHERE id = ?', [userId]);
      if (!rows.length) {
        req.flash('error', 'User account not found.');
        return res.redirect('/login');
      }
      const existingUser = rows[0];

      if (department && department.trim()) {
        const [validDepartment] = await query(
          'SELECT name FROM departments WHERE name = ? AND (is_active = 1 OR name = ?)',
          [department.trim(), existingUser.department || '']
        );
        if (!validDepartment.length) {
          req.flash('error', 'Select a valid academic department.');
          return res.redirect('/profile');
        }
      }

      // Build update fields
      const updates = [];
      const params  = [];

      // 1. Update Name
      if (name && name.trim()) {
        updates.push('name = ?');
        params.push(name.trim());
      }

      // 2. Update Phone
      if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone.trim() || null);
      }

      // 3. Update Department if allowed
      if (department && department.trim()) {
        updates.push('department = ?');
        params.push(department.trim());
      }

      // 4. Handle Avatar Picture
      let newAvatarUrl = existingUser.avatar_url;
      if (req.file) {
        newAvatarUrl = `/uploads/avatars/${req.file.filename}`;
        updates.push('avatar_url = ?');
        params.push(newAvatarUrl);

        // Clean up old avatar if exists and not default
        if (existingUser.avatar_url && existingUser.avatar_url.startsWith('/uploads/avatars/')) {
          const oldPath = path.join(__dirname, '../../public', existingUser.avatar_url);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (_) {}
          }
        }
      } else if (remove_avatar === '1') {
        newAvatarUrl = null;
        updates.push('avatar_url = ?');
        params.push(null);
        if (existingUser.avatar_url && existingUser.avatar_url.startsWith('/uploads/avatars/')) {
          const oldPath = path.join(__dirname, '../../public', existingUser.avatar_url);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (_) {}
          }
        }
      }

      // 5. Handle Password Change (Optional)
      if (new_password) {
        if (!current_password) {
          req.flash('error', 'Please enter your current password to set a new password.');
          return res.redirect('/profile');
        }
        if (new_password.length < 6) {
          req.flash('error', 'New password must be at least 6 characters long.');
          return res.redirect('/profile');
        }
        if (new_password !== confirm_password) {
          req.flash('error', 'New password and confirmation do not match.');
          return res.redirect('/profile');
        }

        const match = await bcrypt.compare(current_password, existingUser.password_hash);
        if (!match) {
          req.flash('error', 'Current password is incorrect.');
          return res.redirect('/profile');
        }

        const newHash = await bcrypt.hash(new_password, 10);
        updates.push('password_hash = ?');
        params.push(newHash);
      }

      if (updates.length > 0) {
        params.push(userId);
        await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      // Refresh session user data
      req.session.user.name       = (name && name.trim()) ? name.trim() : existingUser.name;
      req.session.user.phone      = (phone !== undefined) ? (phone.trim() || null) : existingUser.phone;
      req.session.user.department = (department && department.trim()) ? department.trim() : existingUser.department;
      req.session.user.avatar_url = newAvatarUrl;

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        req.flash('success', 'Profile updated successfully!');
        res.redirect('/profile');
      });
    } catch (err) {
      next(err);
    }
  });
});

module.exports = router;
