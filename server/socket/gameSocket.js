const jwt = require('jsonwebtoken');
const db = require('../db/schema');
const JWT_SECRET = process.env.JWT_SECRET || 'catan-secret-2024';

// In-memory game state store
const gameStates = new Map();
// Active room sessions store: keeps start parameters and actions history across reloads/reconnects
const activeRoomSessions = new Map();
// Store user IDs who clicked rematch and are waiting in the rematch lobby
const rematchReadyUsersByRoom = new Map();

// Helper tìm phòng an toàn: không bao giờ coi chuỗi ký tự (như '2RAJVK') là ID số nguyên 2
const resolveRoom = (roomId, roomCode) => {
    if (roomCode) {
        const byCode = db.rooms.findByCode(String(roomCode).trim().toUpperCase());
        if (byCode) return byCode;
    }
    if (roomId) {
        const str = String(roomId).trim();
        const byCode = db.rooms.findByCode(str.toUpperCase());
        if (byCode) return byCode;
        if (/^\d+$/.test(str)) {
            return db.rooms.findById(parseInt(str, 10));
        }
    }
    return null;
};

const broadcastRoomList = (io) => {
    if (!io) return;
    for (const [_, s] of io.sockets.sockets) {
        if (s.userId) {
            s.emit('room:list', db.rooms.getOpenRoomsForUser(s.userId));
        }
    }
};

const getConnectedUserIdsInRoom = (io, roomId, roomCode, excludeSocketId = null) => {
    const connectedUsers = new Set();
    const channels = [`room_${roomId}`, `room_${roomCode}`].filter(Boolean);
    channels.forEach(ch => {
        const socketIds = io.sockets.adapter.rooms.get(ch);
        if (socketIds) {
            socketIds.forEach(sId => {
                if (excludeSocketId && sId === excludeSocketId) return;
                const s = io.sockets.sockets.get(sId);
                if (s && s.userId && s.connected) {
                    connectedUsers.add(String(s.userId));
                }
            });
        }
    });
    return connectedUsers;
};

const broadcastRoomPresence = (io, room, session, excludeSocketId = null) => {
    if (!room || room.status !== 'playing') return;
    const connectedUsers = getConnectedUserIdsInRoom(io, room.id, room.code, excludeSocketId);

    // Lấy danh sách người chơi thực (human players)
    let humanPlayers = [];
    if (session && session.startPayload && Array.isArray(session.startPayload.players)) {
        humanPlayers = session.startPayload.players.filter(p => p && !p.isBot && !String(p.id || p.user_id).startsWith('bot_') && !String(p.username || '').includes('AI'));
    } else {
        const roomPlayers = db.room_players.getByRoom(room.id);
        humanPlayers = roomPlayers.map(rp => {
            const u = db.users.findById(rp.user_id);
            return { id: rp.user_id, user_id: rp.user_id, username: u?.username || 'Người chơi' };
        });
    }

    if (humanPlayers.length <= 1) return; // Solo game với Bot không cần tạm dừng

    const missingPlayers = humanPlayers.filter(p => {
        const uid = String(p.user_id || p.id || '');
        return uid && !connectedUsers.has(uid);
    });
    const payload = {
        roomId: room.id,
        roomCode: room.code,
        connectedUsers: Array.from(connectedUsers),
        missingPlayers: missingPlayers.map(p => ({ id: p.user_id || p.id, username: p.username })),
        isPaused: missingPlayers.length > 0
    };

    io.to(`room_${room.id}`).emit('game:room_presence', payload);
    io.to(`room_${room.code}`).emit('game:room_presence', payload);
};

module.exports = (io) => {
    io.on('connection', (socket) => {
        const token = socket.handshake.auth?.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                socket.userId = decoded.id;
            } catch (err) {
                console.warn('Invalid token in gameSocket:', err.message);
            }
        }
        if (!socket.userId) {
            socket.userId = 'guest_' + socket.id;
        } else {
            socket.join(`user_${socket.userId}`);
            db.users.setOnline(socket.userId, 1);
            const friendIds = db.friendships.getFriendIds(socket.userId);
            friendIds.forEach(fid => {
                io.to(`user_${fid}`).emit('friend:online', { id: socket.userId, online: 1 });
            });
        }

        socket.on('game:join_channel', (channelId) => {
            if (!channelId) return;
            const str = channelId.toString().trim();
            const room = resolveRoom(str, str);

            socket.join(`room_${str}`);
            if (room) {
                socket.join(`room_${room.id}`);
                socket.join(`room_${room.code}`);
            }
            if (!socket.joinedRooms) socket.joinedRooms = new Set();
            socket.joinedRooms.add(str);
            if (room) {
                socket.joinedRooms.add(room.id);
                socket.joinedRooms.add(room.code);
            }

            const user = db.users.findById(socket.userId);
            const username = user?.username || (typeof socket.userId === 'string' && socket.userId.startsWith('guest_') ? 'Khách' : 'Người chơi');

            const state = gameStates.get(str) || (room ? gameStates.get(room.id) : null);
            if (state) {
                socket.emit('game:state', state);
            }

            // Khôi phục tiến trình trận đấu (State Hydration & Action History) nếu ván đấu đang diễn ra
            const session = activeRoomSessions.get(str) || (room ? activeRoomSessions.get(String(room.id)) : null) || (room ? activeRoomSessions.get(String(room.code)) : null);
            if (session && session.startPayload) {
                socket.emit('game:room_restore', {
                    startPayload: session.startPayload,
                    actions: session.actions || []
                });
            }

            if (room) {
                // Đảm bảo user đã được ghi nhận trong room_players nếu phòng đang ở sảnh chờ
                if (room.status === 'waiting' && socket.userId && !socket.userId.toString().startsWith('guest_')) {
                    const alreadyIn = db.room_players.isInRoom(room.id, socket.userId);
                    if (!alreadyIn) {
                        const currentCount = db.room_players.count(room.id);
                        if (currentCount < room.max_players) {
                            const colors = ['red', 'blue', 'green', 'orange'];
                            const existingPlayers = db.room_players.getByRoom(room.id);
                            const usedColors = existingPlayers.map(p => p.color);
                            const availableColor = colors.find(c => !usedColors.includes(c)) || 'blue';
                            db.room_players.add(room.id, socket.userId, currentCount, availableColor);
                        }
                    }
                }

                const updatedRoom = db.rooms.getRoomWithPlayers(room.id);
                if (updatedRoom) {
                    io.to(`room_${room.id}`).emit('room:update', updatedRoom);
                    io.to(`room_${room.code}`).emit('room:update', updatedRoom);
                }
                const payload = { userId: socket.userId, username };
                socket.to(`room_${room.id}`).emit('game:player_joined', payload);
                socket.to(`room_${room.code}`).emit('game:player_joined', payload);
                socket.to(`room_${room.id}`).emit('game:player_reconnected', payload);
                socket.to(`room_${room.code}`).emit('game:player_reconnected', payload);
                broadcastRoomList(io);
                if (room.status === 'playing') {
                    broadcastRoomPresence(io, room, session);
                }
            } else {
                socket.to(`room_${str}`).emit('game:player_joined', { userId: socket.userId, username });
                socket.to(`room_${str}`).emit('game:player_reconnected', { userId: socket.userId, username });
            }
        });

        socket.on('game:action', ({ roomId, roomCode, action }) => {
            const strId = roomId ? String(roomId) : null;
            const strCode = roomCode ? String(roomCode).toUpperCase() : null;
            let session = (strId && activeRoomSessions.get(strId)) || (strCode && activeRoomSessions.get(strCode));
            if (session && action) {
                session.actions.push(action);
                session.updatedAt = Date.now();
            }

            const targets = new Set();
            if (roomId) targets.add(`room_${roomId}`);
            if (roomCode) targets.add(`room_${roomCode}`);

            targets.forEach(channel => {
                socket.to(channel).emit('game:action_broadcast', {
                    userId: socket.userId,
                    action
                });
            });
        });

        socket.on('game:request_restore', ({ roomId, roomCode }) => {
            const strId = roomId ? String(roomId) : null;
            const strCode = roomCode ? String(roomCode).toUpperCase() : null;
            const session = (strId && activeRoomSessions.get(strId)) || (strCode && activeRoomSessions.get(strCode));
            if (session && session.startPayload) {
                socket.emit('game:room_restore', {
                    startPayload: session.startPayload,
                    actions: session.actions || []
                });
            }
            const room = resolveRoom(roomId, roomCode);
            if (room && room.status === 'playing') {
                broadcastRoomPresence(io, room, session);
            }
        });

        socket.on('game:start', (roomId) => {
            const room = db.rooms.findById(roomId);
            if (!room || room.host_id !== socket.userId) return;

            const players = db.room_players.getByRoom(roomId);
            const allReady = players.every(p => p.ready || p.user_id === room.host_id);
            if (!allReady) return socket.emit('game:error', 'Chưa phải tất cả người chơi đều sẵn sàng');

            db.rooms.update(roomId, { status: 'playing' });

            // Initialize game state with players and board
            const gameState = {
                roomId,
                scenario: room.scenario,
                players: players.map((p, idx) => {
                    const u = db.users.findById(p.user_id);
                    return {
                        id: p.user_id,
                        username: u?.username || `P${idx + 1}`,
                        avatar: u?.avatar || '🐰',
                        color: p.color,
                        resources: { wood: 2, brick: 2, sheep: 2, wheat: 2, ore: 0 },
                        devCards: [],
                        vp: 0,
                        settlements: [],
                        cities: [],
                        roads: [],
                        ships: []
                    };
                }),
                turnIndex: 0,
                phase: 'ROLL',
                board: {},
                robber: null,
                pirate: null,
                lastRoll: null
            };

            gameStates.set(roomId, gameState);
            io.to(`room_${roomId}`).emit('game:start', gameState);
            io.to(`room_${roomId}`).emit('game:state', gameState);
        });

        socket.on('game:roll', ({ roomId }) => {
            const state = gameStates.get(roomId);
            if (!state || state.players[state.turnIndex].id !== socket.userId || state.phase !== 'ROLL') return;

            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const total = d1 + d2;

            state.lastRoll = { d1, d2, total };
            if (total === 7) {
                state.phase = 'ROBBER';
            } else {
                state.phase = 'MAIN';
            }

            io.to(`room_${roomId}`).emit('game:rolled', { d1, d2, total });
            io.to(`room_${roomId}`).emit('game:state', state);
        });

        socket.on('game:build', ({ roomId, type, position }) => {
            const state = gameStates.get(roomId);
            if (!state || state.players[state.turnIndex].id !== socket.userId || state.phase !== 'MAIN') return;

            const player = state.players[state.turnIndex];
            if (type === 'settlement') {
                player.settlements.push(position);
                player.vp += 1;
            } else if (type === 'city') {
                player.cities.push(position);
                player.vp += 2;
            } else if (type === 'road') {
                player.roads.push(position);
            } else if (type === 'ship') {
                player.ships.push(position);
            }

            io.to(`room_${roomId}`).emit('game:state', state);
        });

        socket.on('game:move_robber', ({ roomId, targetHex, type }) => {
            const state = gameStates.get(roomId);
            if (!state || state.players[state.turnIndex].id !== socket.userId || state.phase !== 'ROBBER') return;

            if (type === 'pirate') state.pirate = targetHex;
            else state.robber = targetHex;

            state.phase = 'MAIN';
            io.to(`room_${roomId}`).emit('game:state', state);
        });

        socket.on('game:end_turn', ({ roomId }) => {
            const state = gameStates.get(roomId);
            if (!state || state.players[state.turnIndex].id !== socket.userId || state.phase !== 'MAIN') return;

            state.turnIndex = (state.turnIndex + 1) % state.players.length;
            state.phase = 'ROLL';
            io.to(`room_${roomId}`).emit('game:state', state);
        });

        socket.on('game:over', ({ roomId, roomCode, winnerId, vpReached, duration }) => {
            const room = resolveRoom(roomId, roomCode);
            if (!room) return;
            if (room.host_id !== socket.userId) {
                const inRoom = db.room_players.getByRoom(room.id).some(rp => rp.user_id === socket.userId);
                if (!inRoom) return;
            }

            db.rooms.update(room.id, { status: 'finished' });
            if (winnerId) {
                db.game_history.insert({
                    room_id: room.id,
                    winner_id: winnerId,
                    duration: duration || 600,
                    vp_reached: vpReached || 13
                });

                // Update stats
                const winner = db.users.findById(winnerId);
                if (winner) {
                    db.users.update(winnerId, { wins: (winner.wins || 0) + 1, elo: (winner.elo || 1000) + 25 });
                }
            }

            const roomPlayers = db.room_players.getByRoom(room.id);
            roomPlayers.forEach(rp => {
                const u = db.users.findById(rp.user_id);
                if (u) {
                    db.users.update(rp.user_id, { games: (u.games || 0) + 1 });
                }
            });

            gameStates.delete(room.id);
            activeRoomSessions.delete(String(room.id));
            if (room.code) activeRoomSessions.delete(String(room.code));

            io.to(`room_${room.id}`).emit('game:ended', { winnerId });
            io.to(`room_${room.code}`).emit('game:ended', { winnerId });
            broadcastRoomList(io);
        });

        socket.on('game:rematch', ({ roomId, roomCode }) => {
            const room = resolveRoom(roomId, roomCode);
            if (!room) return;

            // Chuyển trạng thái phòng về waiting để chờ người chơi vào phòng chờ đấu lại
            db.rooms.update(room.id, { status: 'waiting' });
            gameStates.delete(room.id);
            activeRoomSessions.delete(String(room.id));
            activeRoomSessions.delete(String(room.code));
            if (roomId) {
                gameStates.delete(roomId);
                activeRoomSessions.delete(String(roomId));
            }
            if (roomCode) {
                activeRoomSessions.delete(String(roomCode).toUpperCase());
            }

            if (!rematchReadyUsersByRoom.has(room.id)) {
                rematchReadyUsersByRoom.set(room.id, new Set());
            }
            const readySet = rematchReadyUsersByRoom.get(room.id);
            if (socket.userId) {
                readySet.add(String(socket.userId));
            }

            const roomWithPlayers = db.rooms.getRoomWithPlayers(room.id);
            const allPlayers = roomWithPlayers?.players || [];
            let readyPlayers = allPlayers.filter(p => readySet.has(String(p.user_id || p.id)));

            // Bổ sung người chơi vừa bấm nếu chưa có trong danh sách
            if (!readyPlayers.some(p => String(p.id || p.user_id) === String(socket.userId))) {
                const u = db.users.findById(socket.userId);
                const isHost = (room.host_id == socket.userId || String(room.host_id) === String(socket.userId));
                readyPlayers.push({
                    id: socket.userId,
                    user_id: socket.userId,
                    username: u?.username || (isHost ? (roomWithPlayers?.host_name || 'Chủ phòng') : 'Người chơi'),
                    avatar: u?.avatar || 'bunny_pirate'
                });
            }

            // Sắp xếp sao cho Chủ phòng luôn đứng đầu nếu chủ phòng có trong danh sách
            readyPlayers.sort((a, b) => {
                const aIsHost = (a.id == room.host_id || a.user_id == room.host_id || String(a.id) === String(room.host_id));
                const bIsHost = (b.id == room.host_id || b.user_id == room.host_id || String(b.id) === String(room.host_id));
                if (aIsHost) return -1;
                if (bIsHost) return 1;
                return 0;
            });

            const payload = {
                roomId: room.id,
                roomCode: room.code,
                players: readyPlayers,
                maxPlayers: room.max_players || 3,
                hostId: room.host_id,
                hostName: roomWithPlayers?.host_name,
                userWhoClicked: socket.userId
            };

            const channels = new Set([`room_${room.id}`, `room_${room.code}`]);
            if (roomId) channels.add(`room_${roomId}`);
            if (roomCode) channels.add(`room_${roomCode}`);

            channels.forEach(ch => {
                io.to(ch).emit('game:rematch_waiting', payload);
            });
            socket.emit('game:rematch_waiting', payload);

            broadcastRoomList(io);
        });

        socket.on('game:close_room', ({ roomId, roomCode }) => {
            const room = resolveRoom(roomId, roomCode);
            if (room) {
                const isHost = (!room.host_id || room.host_id == socket.userId || String(room.host_id) === String(socket.userId));
                if (!isHost) {
                    return socket.emit('game:error', 'Chỉ chủ phòng mới có quyền đóng phòng này!');
                }
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
                gameStates.delete(room.id);
                activeRoomSessions.delete(String(room.id));
                activeRoomSessions.delete(String(room.code));
                broadcastRoomList(io);
            }
        });

        // Chủ phòng bắt đầu trận đấu
        socket.on('game:room_start', ({ roomId, roomCode, players, maxPlayers, useBots, seed }) => {
            const room = resolveRoom(roomId, roomCode);
            if (!room) return;

            // Kiểm tra quyền chủ phòng: chỉ host mới được phép bắt đầu
            const isHost = (!room.host_id || room.host_id == socket.userId || String(room.host_id) === String(socket.userId));
            if (!isHost) {
                return socket.emit('game:error', 'Chỉ chủ phòng mới có quyền bắt đầu trận đấu!');
            }

            db.rooms.update(room.id, { status: 'playing' });
            rematchReadyUsersByRoom.delete(room.id);
            if (room.code) rematchReadyUsersByRoom.delete(room.code);

            const payload = {
                roomId: room.id,
                roomCode: room.code,
                players: players || [],
                maxPlayers: maxPlayers || room.max_players || 3,
                useBots: !!useBots,
                seed: seed || room.code
            };

            const session = {
                roomId: room.id,
                roomCode: room.code,
                startPayload: payload,
                actions: [],
                updatedAt: Date.now()
            };
            activeRoomSessions.set(String(room.id), session);
            activeRoomSessions.set(String(room.code), session);

            const channels = new Set([`room_${room.id}`, `room_${room.code}`]);
            if (roomId) channels.add(`room_${roomId}`);
            if (roomCode) channels.add(`room_${roomCode}`);

            channels.forEach(ch => {
                io.to(ch).emit('game:room_started', payload);
            });
            socket.emit('game:room_started', payload);
            broadcastRoomList(io);
            broadcastRoomPresence(io, room, session);
        });

        // Người chơi chủ động rời phòng (out phòng) - KHÔNG XÓA PHÒNG!
        socket.on('game:player_leave', ({ roomId, roomCode }) => {
            const room = resolveRoom(roomId, roomCode);

            const user = db.users.findById(socket.userId);
            const username = user?.username || (typeof socket.userId === 'string' && socket.userId.startsWith('guest_') ? 'Khách' : 'Người chơi');
            const payload = { userId: socket.userId, username };

            if (room) {
                const isHost = (room.host_id === socket.userId || String(room.host_id) === String(socket.userId));
                // Nếu phòng còn ở sảnh chờ (chưa bắt đầu chơi):
                // CHỈ xoá khách khỏi room_players để giải phóng slot.
                // TUYỆT ĐỐI KHÔNG xoá phòng dù chủ phòng hay khách rời đi!
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

                socket.leave(`room_${room.id}`);
                socket.leave(`room_${room.code}`);
                io.to(`room_${room.id}`).emit('room:player_left', payload);
                io.to(`room_${room.code}`).emit('room:player_left', payload);
                io.to(`room_${room.id}`).emit('game:player_disconnected', payload);
                io.to(`room_${room.code}`).emit('game:player_disconnected', payload);

                if (room.status === 'playing') {
                    const session = activeRoomSessions.get(String(room.id)) || activeRoomSessions.get(String(room.code));
                    broadcastRoomPresence(io, room, session, socket.id);
                }
                broadcastRoomList(io);
            }
        });


        // Người chơi bị mất kết nối (disconnect)
        socket.on('disconnect', () => {
            if (socket.joinedRooms && socket.joinedRooms.size > 0) {
                const user = db.users.findById(socket.userId);
                const username = user?.username || (typeof socket.userId === 'string' && socket.userId.startsWith('guest_') ? 'Khách' : 'Người chơi');
                const payload = { userId: socket.userId, username };

                for (const rId of socket.joinedRooms) {
                    const room = resolveRoom(rId, rId);
                    
                    if (room && room.status === 'waiting') {
                        const isHost = (room.host_id === socket.userId || String(room.host_id) === String(socket.userId));
                        // Khi ngắt kết nối socket, CHỈ giải phóng slot của khách. TUYỆT ĐỐI KHÔNG xoá phòng hay gỡ chủ phòng khi họ reload trang hoặc mạng giật!
                        if (!isHost) {
                            db.room_players.remove(room.id, socket.userId);
                            const updatedRoom = db.rooms.getRoomWithPlayers(room.id);
                            if (updatedRoom) {
                                io.to(`room_${room.id}`).emit('room:update', updatedRoom);
                                io.to(`room_${room.code}`).emit('room:update', updatedRoom);
                            }
                        }
                    }

                    socket.to(`room_${rId}`).emit('room:player_left', payload);
                    socket.to(`room_${rId}`).emit('game:player_disconnected', payload);

                    if (room && room.status === 'playing') {
                        const session = activeRoomSessions.get(String(room.id)) || activeRoomSessions.get(String(room.code));
                        broadcastRoomPresence(io, room, session, socket.id);
                    }
                }
                broadcastRoomList(io);
            }
        });
    });
};
