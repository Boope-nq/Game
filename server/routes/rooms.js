const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/schema');
const { authMiddleware } = require('./auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'catan-secret-2024';

const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
};

// Helper phát lại room:list theo từng user
const broadcastRoomList = (io) => {
    if (!io) return;
    for (const [_, s] of io.sockets.sockets) {
        if (s.userId) {
            s.emit('room:list', db.rooms.getOpenRoomsForUser(s.userId));
        }
    }
};

// GET /api/rooms - Danh sách phòng mở (chỉ hiện phòng mình tạo hoặc được mời/tham gia)
router.get('/', (req, res) => {
    try {
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
                userId = decoded.id;
            } catch (e) {}
        }
        if (!userId) {
            return res.json([]);
        }
        const rooms = db.rooms.getOpenRoomsForUser(userId);
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: 'Không thể lấy danh sách phòng' });
    }
});

// POST /api/rooms - Tạo phòng mới
router.post('/', authMiddleware, (req, res) => {
    const { name, max_players, is_private, password, scenario } = req.body;
    const maxP = Math.min(Math.max(parseInt(max_players, 10) || 3, 2), 4);
    let code = generateCode();
    while (db.rooms.findByCode(code)) {
        code = generateCode();
    }

    try {
        const room = db.rooms.insert({
            code,
            name: name ? name.trim() : `Phòng của người chơi ${req.userId}`,
            host_id: req.userId,
            max_players: maxP,
            is_private: !!is_private,
            password: password || null,
            scenario: scenario || 'voyages',
            win_vp: 13
        });

        // Add host as player
        db.room_players.add(room.id, req.userId, 0, 'red');
        db.room_players.setReady(room.id, req.userId, 1);

        const roomData = db.rooms.getRoomWithPlayers(room.id);
        broadcastRoomList(req.io);
        res.json(roomData);
    } catch (err) {
        res.status(500).json({ error: 'Không thể tạo phòng' });
    }
});

const findRoom = (param) => {
    if (!param) return null;
    const str = param.toString().trim();
    // 1. Luôn ưu tiên tìm theo mã phòng 6 ký tự
    const byCode = db.rooms.findByCode(str.toUpperCase());
    if (byCode) return byCode;
    // 2. Chỉ khi chuỗi hoàn toàn là chữ số (ví dụ: "2", "42") mới tìm theo ID số nguyên
    if (/^\d+$/.test(str)) {
        return db.rooms.findById(parseInt(str, 10));
    }
    return null;
};

// GET /api/rooms/:code - Chi tiết phòng theo mã code hoặc id
router.get('/:code', (req, res) => {
    const room = findRoom(req.params.code);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });

    const roomData = db.rooms.getRoomWithPlayers(room.id);
    if (req.io && roomData && room.status === 'playing') {
        const channels = [`room_${room.id}`, `room_${room.code}`];
        const connectedUsers = new Set();
        channels.forEach(ch => {
            const socketIds = req.io.sockets.adapter.rooms.get(ch);
            if (socketIds) {
                socketIds.forEach(sId => {
                    const s = req.io.sockets.sockets.get(sId);
                    if (s && s.userId && s.connected) connectedUsers.add(String(s.userId));
                });
            }
        });
        roomData.connected_user_ids = Array.from(connectedUsers);
    }
    res.json(roomData);
});

// POST /api/rooms/join - Tham gia phòng
router.post('/join', authMiddleware, (req, res) => {
    const { code, password } = req.body;
    if (!code) return res.status(400).json({ error: 'Vui lòng nhập mã phòng' });

    const room = findRoom(code);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status === 'finished' || room.status === 'closed') return res.status(400).json({ error: 'Phòng đã kết thúc hoặc đã đóng' });
    if (room.is_private && room.password && room.password !== password) {
        return res.status(401).json({ error: 'Sai mật khẩu phòng' });
    }

    const currentCount = db.room_players.count(room.id);
    const isHost = (room.host_id === req.userId || String(room.host_id) === String(req.userId));
    const alreadyIn = isHost || db.room_players.isInRoom(room.id, req.userId);

    if (!alreadyIn) {
        if (room.status === 'playing') {
            return res.status(400).json({ error: 'Trận đấu đang diễn ra, chỉ người chơi trong phòng mới có thể tiếp tục' });
        }
        if (currentCount >= room.max_players) {
            return res.status(400).json({ error: 'Phòng đã đủ người chơi' });
        }

        const colors = ['red', 'blue', 'green', 'orange'];
        const existingPlayers = db.room_players.getByRoom(room.id);
        const usedColors = existingPlayers.map(p => p.color);
        const availableColor = colors.find(c => !usedColors.includes(c)) || 'red';

        db.room_players.add(room.id, req.userId, currentCount, availableColor);
    } else if (isHost && !db.room_players.isInRoom(room.id, req.userId)) {
        db.room_players.add(room.id, req.userId, 0, 'red');
    }

    const updatedRoom = db.rooms.getRoomWithPlayers(room.id);
    if (req.io && updatedRoom) {
        req.io.to(`room_${room.id}`).emit('room:update', updatedRoom);
        req.io.to(`room_${room.code}`).emit('room:update', updatedRoom);
        const user = db.users.findById(req.userId);
        const payload = { userId: req.userId, username: user?.username || 'Người chơi' };
        req.io.to(`room_${room.id}`).emit('game:player_joined', payload);
        req.io.to(`room_${room.code}`).emit('game:player_joined', payload);
    }

    broadcastRoomList(req.io);
    res.json({ success: true, room_id: room.id, code: room.code });
});

// POST /api/rooms/:id/invite - Mời bạn bè vào phòng
router.post('/:id/invite', authMiddleware, (req, res) => {
    const room = findRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });

    const targetUserId = parseInt(req.body.target_user_id, 10);
    if (!targetUserId) return res.status(400).json({ error: 'Thiếu người dùng cần mời' });

    db.room_invites.insert(room.id, req.userId, targetUserId);

    if (req.io) {
        const fromUser = db.users.findById(req.userId);
        const payload = {
            roomId: room.id,
            roomCode: room.code,
            roomName: room.name,
            fromUser: fromUser?.username || 'Bạn bè',
            fromAvatar: fromUser?.avatar || '🐰'
        };
        req.io.to(`user_${targetUserId}`).emit('room:invited', payload);
        const targetRooms = db.rooms.getOpenRoomsForUser(targetUserId);
        req.io.to(`user_${targetUserId}`).emit('room:list', targetRooms);
    }

    res.json({ success: true, message: 'Đã gửi lời mời tham gia phòng!' });
});

// POST /api/rooms/:id/leave - Người chơi rời phòng
router.post('/:id/leave', (req, res) => {
    let token = req.headers.authorization?.split(' ')[1] || req.query.token;
    let userId = req.userId;
    if (!userId && token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = decoded.id;
        } catch (e) {}
    }
    if (!userId) return res.status(401).json({ error: 'Chưa đăng nhập' });

    const room = findRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });

    const user = db.users.findById(userId);
    const username = user?.username || 'Khách';
    const isHost = (room.host_id === userId || String(room.host_id) === String(userId));

    // TUYỆT ĐỐI KHÔNG XÓA PHÒNG KHI NGƯỜI CHƠI / CHỦ PHÒNG RỜI PHÒNG (OUT PHÒNG)!
    // Phòng chỉ mất khi:
    // 1) Chủ phòng chủ động xoá phòng (DELETE /api/rooms/:id)
    // 2) Chủ phòng đóng khi kết thúc game (btn-win-close-room / game:close_room)
    
    // Nếu phòng đang chờ: chỉ xoá khách để giải phóng slot; chủ phòng vẫn giữ phòng để quay lại
    if (room.status === 'waiting') {
        if (!isHost) {
            db.room_players.remove(room.id, userId);
        }
    }
    // Nếu phòng đang chơi: giữ nguyên danh sách người chơi để bảo toàn tiến trình ván đấu!

    if (req.io) {
        const payload = { userId, username };
        req.io.to(`room_${room.id}`).emit('room:player_left', payload);
        req.io.to(`room_${room.code}`).emit('room:player_left', payload);
        req.io.to(`room_${room.id}`).emit('game:player_disconnected', payload);
        req.io.to(`room_${room.code}`).emit('game:player_disconnected', payload);

        if (room.status === 'playing') {
            const channels = [`room_${room.id}`, `room_${room.code}`];
            const connectedUsers = new Set();
            channels.forEach(ch => {
                const socketIds = req.io.sockets.adapter.rooms.get(ch);
                if (socketIds) {
                    socketIds.forEach(sId => {
                        const s = req.io.sockets.sockets.get(sId);
                        if (s && s.userId && s.connected && String(s.userId) !== String(userId)) {
                            connectedUsers.add(String(s.userId));
                        }
                    });
                }
            });
            const roomPlayers = db.room_players.getByRoom(room.id);
            const humanPlayers = roomPlayers.map(rp => {
                const u = db.users.findById(rp.user_id);
                return { id: rp.user_id, username: u?.username || 'Người chơi' };
            });
            if (humanPlayers.length > 1) {
                const missingPlayers = humanPlayers.filter(p => p && !connectedUsers.has(String(p.id)));
                const presencePayload = {
                    roomId: room.id,
                    roomCode: room.code,
                    connectedUsers: Array.from(connectedUsers),
                    missingPlayers: missingPlayers.map(p => ({ id: p.id, username: p.username })),
                    isPaused: missingPlayers.length > 0
                };
                req.io.to(`room_${room.id}`).emit('game:room_presence', presencePayload);
                req.io.to(`room_${room.code}`).emit('game:room_presence', presencePayload);
            }
        }
        broadcastRoomList(req.io);
    }

    res.json({ success: true, message: 'Đã rời phòng thành công' });
});

// DELETE /api/rooms/:id - Đóng/Xoá phòng
router.delete('/:id', authMiddleware, (req, res) => {
    const room = findRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.host_id !== req.userId && String(room.host_id) !== String(req.userId)) {
        return res.status(403).json({ error: 'Chỉ chủ phòng mới có quyền đóng phòng' });
    }

    if (req.io) {
        const payload = {
            roomId: room.id,
            roomCode: room.code,
            message: `Phòng chơi "${room.name}" (Mã: ${room.code}) đã được đóng bởi chủ phòng. Bạn đang được chuyển về sảnh chờ!`
        };
        req.io.to(`room_${room.id}`).emit('room:closed', payload);
        req.io.to(`room_${room.code}`).emit('room:closed', payload);
        req.io.to(`room_${room.id}`).emit('room_closed', payload);
        req.io.to(`room_${room.code}`).emit('room_closed', payload);
    }

    db.rooms.delete(room.id);
    broadcastRoomList(req.io);

    res.json({ success: true, message: 'Đã đóng phòng thành công' });
});

module.exports = router;
