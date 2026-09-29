const express = require('express');
const db = require('../db/schema');
const { authMiddleware } = require('./auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/friends - Danh sách bạn bè kèm trạng thái online
router.get('/', (req, res) => {
    try {
        const friends = db.friendships.getFriends(req.userId);
        res.json(friends);
    } catch (err) {
        res.status(500).json({ error: 'Không thể lấy danh sách bạn bè' });
    }
});

// GET /api/friends/requests - Danh sách lời mời kết bạn gửi đến tôi
router.get('/requests', (req, res) => {
    try {
        const requests = db.friendships.getPendingRequests(req.userId);
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: 'Không thể lấy danh sách lời mời' });
    }
});

// POST /api/friends/request/:username - Gửi lời mời kết bạn
router.post('/request/:username', (req, res) => {
    const target = db.users.findByUsername(req.params.username);
    if (!target) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    if (target.id === req.userId) return res.status(400).json({ error: 'Không thể kết bạn với chính mình' });

    try {
        db.friendships.insert(req.userId, target.id);
        if (req.io) {
            req.io.to(`user_${target.id}`).emit('friend:request');
        }
        res.json({ success: true, message: 'Đã gửi lời mời kết bạn' });
    } catch (err) {
        res.status(400).json({ error: 'Đã gửi lời mời hoặc đã là bạn bè' });
    }
});

// POST /api/friends/accept/:userId - Chấp nhận lời mời
router.post('/accept/:userId', (req, res) => {
    const fromUserId = parseInt(req.params.userId, 10);
    const ok = db.friendships.updateStatus(fromUserId, req.userId, 'accepted');
    if (ok) {
        if (req.io) {
            req.io.to(`user_${fromUserId}`).emit('friend:update');
            req.io.to(`user_${req.userId}`).emit('friend:update');
        }
        res.json({ success: true, message: 'Đã chấp nhận kết bạn' });
    } else {
        res.status(400).json({ error: 'Không tìm thấy lời mời kết bạn' });
    }
});

// POST /api/friends/reject/:userId - Từ chối lời mời
router.post('/reject/:userId', (req, res) => {
    const fromUserId = parseInt(req.params.userId, 10);
    const ok = db.friendships.remove(fromUserId, req.userId);
    if (ok) {
        if (req.io) {
            req.io.to(`user_${fromUserId}`).emit('friend:update');
            req.io.to(`user_${req.userId}`).emit('friend:update');
        }
        res.json({ success: true, message: 'Đã từ chối lời mời' });
    } else {
        res.status(400).json({ error: 'Không tìm thấy lời mời' });
    }
});

// DELETE /api/friends/:userId - Huỷ kết bạn
router.delete('/:userId', (req, res) => {
    const targetId = parseInt(req.params.userId, 10);
    const ok = db.friendships.remove(req.userId, targetId);
    if (ok) {
        res.json({ success: true, message: 'Đã xoá bạn' });
    } else {
        res.status(400).json({ error: 'Không tìm thấy quan hệ bạn bè' });
    }
});

// GET /api/friends/search?q= - Tìm kiếm người dùng
router.get('/search', (req, res) => {
    const q = req.query.q;
    if (!q || q.trim() === '') return res.json([]);
    const results = db.users.search(q.trim(), req.userId);
    res.json(results);
});

module.exports = router;
