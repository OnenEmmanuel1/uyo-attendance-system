'use strict';
const router    = require('express').Router();
const bcrypt    = require('bcrypt');
const { query } = require('../../config/db');

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const { role } = req.query;
    let sql    = 'SELECT id, name, email, role, matric_or_staff_id, department, is_active, created_at FROM users';
    const prms = [];
    if (role) { sql += ' WHERE role = ?'; prms.push(role); }
    sql += ' ORDER BY role, name';
    const [users] = await query(sql, prms);
    res.json({ users });
  } catch (err) { next(err); }
});

// POST /api/users
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role, matric_or_staff_id, department, phone } = req.body;
    if (['student', 'lecturer'].includes(role)) {
      const [validDepartment] = await query(
        'SELECT id FROM departments WHERE name = ? AND is_active = 1', [department]
      );
      if (!validDepartment.length) return res.status(400).json({ error: 'Select a valid academic department' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [r] = await query(
      'INSERT INTO users (name, email, password_hash, role, matric_or_staff_id, department, phone) VALUES (?,?,?,?,?,?,?)',
      [name, email.toLowerCase(), hash, role, matric_or_staff_id, department, phone || null]
    );
    res.status(201).json({ success: true, userId: r.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email or ID already exists' });
    next(err);
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, department, phone, is_active } = req.body;
    if (department) {
      const [validDepartment] = await query(
        'SELECT id FROM departments WHERE name = ? AND is_active = 1', [department]
      );
      if (!validDepartment.length) return res.status(400).json({ error: 'Select a valid academic department' });
    }
    await query(
      'UPDATE users SET name=?, email=?, department=?, phone=?, is_active=? WHERE id=?',
      [name, email?.toLowerCase(), department, phone || null, is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/users/:id  — soft-delete (deactivate)
router.delete('/:id', async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.session.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    await query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
