const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db/schema');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'catan-secret-2024';

// ─── Auth Middleware (export để route khác dùng) ───────────────────────────
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Chưa đăng nhập' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
};

// ─── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Tên đăng nhập phải 3-20 ký tự, chỉ dùng chữ/số/_' });
  if (!email || !email.includes('@'))
    return res.status(400).json({ error: 'Email không hợp lệ' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Mật khẩu ít nhất 6 ký tự' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const user = db.users.insert({ username, email, password: hash });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: db.users.publicProfile(user.id) });
  } catch (err) {
    res.status(400).json({ error: 'Tên đăng nhập hoặc email đã tồn tại' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password)
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });

  const user = db.users.findByUsernameOrEmail(usernameOrEmail);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: db.users.publicProfile(user.id) });
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  const user = db.users.publicProfile(req.userId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
  res.json(user);
});

// ─── PUT /api/auth/me ──────────────────────────────────────────────────────
router.put('/me', authMiddleware, (req, res) => {
  const { avatar, password, username, currentPassword } = req.body;
  const user = db.users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  const updates = {};
  if (avatar) updates.avatar = avatar;

  if (username && username !== user.username) {
    const trimmedName = username.trim();
    if (trimmedName.length < 3 || trimmedName.length > 20 || !/^[a-zA-Z0-9_]+$/.test(trimmedName)) {
      return res.status(400).json({ error: 'Tên người dùng phải từ 3-20 ký tự, chỉ gồm chữ, số hoặc dấu gạch dưới (_)' });
    }
    const existing = db.users.findByUsername(trimmedName);
    if (existing && existing.id !== req.userId) {
      return res.status(400).json({ error: 'Tên người dùng này đã có người sử dụng' });
    }
    updates.username = trimmedName;
  }

  if (password) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }
    updates.password = bcrypt.hashSync(password, 10);
  }

  db.users.update(req.userId, updates);
  const updatedUser = db.users.publicProfile(req.userId);
  res.json({ success: true, user: updatedUser });
});

module.exports = { router, authMiddleware };
