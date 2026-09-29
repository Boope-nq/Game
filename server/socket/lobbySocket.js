const jwt = require('jsonwebtoken');
const db = require('../db/schema');

const JWT_SECRET = process.env.JWT_SECRET || 'catan-secret-2024';

const broadcastRoomList = (io) => {
    if (!io) return;
    for (const [_, s] of io.sockets.sockets) {
        if (s.userId) {
            s.emit('room:list', db.rooms.getOpenRoomsForUser(s.userId));
        }
    }
};

module.exports = (io) => {
    io.on('connection', (socket) => {
        const token = socket.handshake.auth?.token;
        if (!token) return socket.disconnect(true);

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.id;
        } catch (err) {
            return socket.disconnect(true);
        }

        // Đánh dấu online
        db.users.setOnline(socket.userId, 1);

        // Báo cho bạn bè biết online
        const friendIds = db.friendships.getFriendIds(socket.userId);
        friendIds.forEach(fid => {
            io.to(`user_${fid}`).emit('friend:online', { id: socket.userId, online: 1 });
        });

        socket.join(`user_${socket.userId}`);
        socket.join('room_0'); // Global lobby chat

        // CHỈ dọn dẹp các phòng chờ khi client kết nối THỰC SỰ là từ sảnh chờ (lobby.html)
        // Tuyệt đối KHÔNG dọn dẹp khi kết nối đến từ bàn chơi game (game.html / clientType === 'game')
        const clientType = socket.handshake.auth?.clientType;
        if (clientType === 'lobby') {
            const cleanedRoomIds = db.room_players.removeUserFromWaitingRooms(socket.userId);
            if (cleanedRoomIds && cleanedRoomIds.length > 0) {
                const user = db.users.findById(socket.userId);
                const username = user?.username || 'Khách';
                cleanedRoomIds.forEach(rId => {
                    const updatedRoom = db.rooms.getRoomWithPlayers(rId);
                    const roomCode = updatedRoom?.code;
                    const payload = { userId: socket.userId, username };
                    io.to(`room_${rId}`).emit('room:player_left', payload);
                    io.to(`room_${rId}`).emit('game:player_disconnected', payload);
                    if (roomCode) {
                        io.to(`room_${roomCode}`).emit('room:player_left', payload);
                        io.to(`room_${roomCode}`).emit('game:player_disconnected', payload);
                    }
                    if (updatedRoom) {
                        io.to(`room_${rId}`).emit('room:update', updatedRoom);
                        if (roomCode) io.to(`room_${roomCode}`).emit('room:update', updatedRoom);
                    }
                });
                broadcastRoomList(io);
            }
        }

        // Gửi danh sách phòng mở riêng cho user này
        const sendRoomList = () => {
            const rooms = db.rooms.getOpenRoomsForUser(socket.userId);
            socket.emit('room:list', rooms);
        };
        sendRoomList();

        socket.on('room:list:get', () => {
            sendRoomList();
        });

        socket.on('room:create', (roomId) => {
            socket.join(`room_${roomId}`);
            broadcastRoomList(io);
        });

        socket.on('room:join', (roomId) => {
            socket.join(`room_${roomId}`);
            const roomData = db.rooms.getRoomWithPlayers(roomId);
            io.to(`room_${roomId}`).emit('room:update', roomData);
            broadcastRoomList(io);
        });

        socket.on('room:leave', (roomId) => {
            socket.leave(`room_${roomId}`);
            const str = roomId ? String(roomId).trim() : '';
            const room = db.rooms.findByCode(str.toUpperCase()) || (/^\d+$/.test(str) ? db.rooms.findById(parseInt(str, 10)) : null);
            if (room) {
                const isHost = (room.host_id === socket.userId || String(room.host_id) === String(socket.userId));
                if (room.status === 'waiting') {
                    if (!isHost) {
                        db.room_players.remove(room.id, socket.userId);
                    }
                    const updatedRoom = db.rooms.getRoomWithPlayers(room.id);
                    if (updatedRoom) {
                        io.to(`room_${room.id}`).emit('room:update', updatedRoom);
                        io.to(`room_${room.code}`).emit('room:update', updatedRoom);
                    }
                }
            }
            broadcastRoomList(io);
        });

        socket.on('room:ready', ({ roomId, ready }) => {
            db.room_players.setReady(roomId, socket.userId, ready);
            const updatedRoom = db.rooms.getRoomWithPlayers(roomId);
            io.to(`room_${roomId}`).emit('room:update', updatedRoom);
        });

        socket.on('room:kick', ({ roomId, targetUserId }) => {
            const room = db.rooms.findById(roomId);
            if (room && room.host_id === socket.userId) {
                db.room_players.remove(roomId, targetUserId);
                io.to(`room_${roomId}`).emit('room:kicked', { userId: targetUserId });
                const updatedRoom = db.rooms.getRoomWithPlayers(roomId);
                io.to(`room_${roomId}`).emit('room:update', updatedRoom);
                broadcastRoomList(io);
            }
        });

        socket.on('room:invite', ({ roomId, targetUserId }) => {
            const str = roomId ? String(roomId).trim() : '';
            const room = db.rooms.findByCode(str.toUpperCase()) || (/^\d+$/.test(str) ? db.rooms.findById(parseInt(str, 10)) : null);
            if (!room || !targetUserId) return;

            db.room_invites.insert(room.id, socket.userId, targetUserId);
            const fromUser = db.users.findById(socket.userId);
            const payload = {
                roomId: room.id,
                roomCode: room.code,
                roomName: room.name,
                fromUser: fromUser?.username || 'Bạn bè',
                fromAvatar: fromUser?.avatar || '🐰'
            };
            io.to(`user_${targetUserId}`).emit('room:invited', payload);
            const targetRooms = db.rooms.getOpenRoomsForUser(targetUserId);
            io.to(`user_${targetUserId}`).emit('room:list', targetRooms);
        });

        socket.on('room:delete', (roomId) => {
            const str = roomId ? String(roomId).trim() : '';
            const room = db.rooms.findByCode(str.toUpperCase()) || (/^\d+$/.test(str) ? db.rooms.findById(parseInt(str, 10)) : null);
            if (room && (room.host_id === socket.userId || !room.host_id || String(room.host_id) === String(socket.userId))) {
                const payload = {
                    roomId: room.id,
                    roomCode: room.code,
                    message: `Phòng chơi "${room.name}" (Mã: ${room.code}) đã được đóng bởi chủ phòng. Bạn đang được chuyển về sảnh chờ!`
                };
                io.to(`room_${room.id}`).emit('room:closed', payload);
                io.to(`room_${room.code}`).emit('room:closed', payload);
                io.to(`room_${room.id}`).emit('room_closed', payload);
                io.to(`room_${room.code}`).emit('room_closed', payload);

                db.rooms.delete(room.id);
                broadcastRoomList(io);
            }
        });

        socket.on('chat:room', ({ roomId, text }) => {
            if (!text || !text.trim()) return;
            const user = db.users.findById(socket.userId);
            const msg = db.messages.insert(roomId, socket.userId, text.trim());
            io.to(`room_${roomId}`).emit('chat:message', {
                id: msg.id,
                userId: socket.userId,
                username: user?.username || '?',
                avatar: user?.avatar || '⚓',
                text: text.trim(),
                sent_at: msg.sent_at,
                roomId
            });
        });

        socket.on('user:avatar_change', ({ avatar }) => {
            if (!avatar) return;
            db.users.update(socket.userId, { avatar });
            io.emit('user:avatar_updated', { userId: socket.userId, avatar });
            broadcastRoomList(io);
        });

        socket.on('disconnect', () => {
            db.users.setOnline(socket.userId, 0);
            const friends = db.friendships.getFriendIds(socket.userId);
            friends.forEach(fid => {
                io.to(`user_${fid}`).emit('friend:online', { id: socket.userId, online: 0 });
            });
        });
    });
};
