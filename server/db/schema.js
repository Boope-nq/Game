/**
 * db.js — Database thuần JavaScript dùng JSON file
 * Không cần compile, chạy trên mọi máy có Node.js
 *
 * Cấu trúc: mỗi "bảng" là một mảng trong JSON file
 * Auto-increment ID, query đơn giản
 */

const fs   = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

// ─── Schema mặc định ─────────────────────────────────────────────────────────
const DEFAULT_DB = {
  users:        [],  // { id, username, email, password, avatar, elo, wins, games, online, created_at, last_seen }
  friendships:  [],  // { id, from_user, to_user, status, created_at }
  rooms:        [],  // { id, code, name, host_id, status, max_players, is_private, password, scenario, win_vp, created_at }
  room_players: [],  // { room_id, user_id, seat, color, ready }
  game_history: [],  // { id, room_id, winner_id, duration, vp_reached, played_at }
  messages:     [],  // { id, room_id, user_id, text, sent_at }
  room_invites: [],  // { id, room_id, from_user, to_user, status, created_at }
  _counters:    { users: 0, friendships: 0, rooms: 0, game_history: 0, messages: 0, room_invites: 0 },
};

// ─── Load / Save ─────────────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  try {
    const loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!loaded.room_invites) loaded.room_invites = [];
    if (!loaded._counters) loaded._counters = { ...DEFAULT_DB._counters };
    if (loaded._counters.room_invites === undefined) loaded._counters.room_invites = 0;
    return loaded;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

let _data = loadDB();
if (!_data.room_invites) _data.room_invites = [];

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(_data, null, 2));
}

// ─── Auto-save mỗi 5 giây (batch) ────────────────────────────────────────────
let _dirty = false;
setInterval(() => { if (_dirty) { save(); _dirty = false; } }, 5000);
process.on('exit', () => { if (_dirty) save(); });
process.on('SIGINT', () => { save(); process.exit(); });

// ─── Helper: next ID ──────────────────────────────────────────────────────────
function nextId(table) {
  _data._counters[table] = (_data._counters[table] || 0) + 1;
  return _data._counters[table];
}

function now() { return new Date().toISOString(); }

// ─── DB API (sync, giống better-sqlite3 interface) ───────────────────────────
const db = {

  // ── USERS ──────────────────────────────────────────────────────────────────

  users: {
    insert(user) {
      // Check unique
      if (_data.users.find(u => u.username === user.username))
        throw new Error('Username already exists');
      if (_data.users.find(u => u.email === user.email))
        throw new Error('Email already exists');
      const rec = {
        id:         nextId('users'),
        username:   user.username,
        email:      user.email,
        password:   user.password,
        avatar:     user.avatar || '⚓',
        elo:        1000,
        wins:       0,
        games:      0,
        online:     0,
        created_at: now(),
        last_seen:  now(),
      };
      _data.users.push(rec);
      _dirty = true;
      return rec;
    },
    findById(id) {
      return _data.users.find(u => u.id === id) || null;
    },
    findByUsernameOrEmail(val) {
      return _data.users.find(u => u.username === val || u.email === val) || null;
    },
    findByUsername(username) {
      return _data.users.find(u => u.username === username) || null;
    },
    search(q, excludeId) {
      return _data.users
        .filter(u => u.id !== excludeId && u.username.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 20)
        .map(u => ({ id: u.id, username: u.username, avatar: u.avatar, online: u.online, elo: u.elo }));
    },
    update(id, fields) {
      const idx = _data.users.findIndex(u => u.id === id);
      if (idx === -1) return false;
      Object.assign(_data.users[idx], fields);
      _dirty = true;
      return true;
    },
    setOnline(id, online) {
      const u = _data.users.find(u => u.id === id);
      if (u) { u.online = online ? 1 : 0; u.last_seen = now(); _dirty = true; }
    },
    publicProfile(id) {
      const u = _data.users.find(u => u.id === id);
      if (!u) return null;
      return { id: u.id, username: u.username, email: u.email, avatar: u.avatar, elo: u.elo, wins: u.wins, games: u.games, online: u.online, created_at: u.created_at };
    },
  },

  // ── FRIENDSHIPS ─────────────────────────────────────────────────────────────

  friendships: {
    insert(fromUser, toUser) {
      const exists = _data.friendships.find(f =>
        (f.from_user === fromUser && f.to_user === toUser) ||
        (f.from_user === toUser   && f.to_user === fromUser)
      );
      if (exists) throw new Error('Friendship already exists');
      const rec = { id: nextId('friendships'), from_user: fromUser, to_user: toUser, status: 'pending', created_at: now() };
      _data.friendships.push(rec);
      _dirty = true;
      return rec;
    },
    find(fromUser, toUser) {
      return _data.friendships.find(f =>
        (f.from_user === fromUser && f.to_user === toUser) ||
        (f.from_user === toUser   && f.to_user === fromUser)
      ) || null;
    },
    updateStatus(fromUser, toUser, status) {
      const f = _data.friendships.find(f => f.from_user === fromUser && f.to_user === toUser);
      if (!f) return false;
      f.status = status;
      _dirty = true;
      return true;
    },
    remove(userId1, userId2) {
      const before = _data.friendships.length;
      _data.friendships = _data.friendships.filter(f =>
        !((f.from_user === userId1 && f.to_user === userId2) ||
          (f.from_user === userId2 && f.to_user === userId1))
      );
      _dirty = true;
      return _data.friendships.length < before;
    },
    getFriends(userId) {
      return _data.friendships
        .filter(f => (f.from_user === userId || f.to_user === userId) && f.status === 'accepted')
        .map(f => {
          const friendId = f.from_user === userId ? f.to_user : f.from_user;
          const u = _data.users.find(u => u.id === friendId);
          return u ? { id: u.id, username: u.username, avatar: u.avatar, online: u.online, elo: u.elo } : null;
        })
        .filter(Boolean);
    },
    getPendingRequests(toUser) {
      return _data.friendships
        .filter(f => f.to_user === toUser && f.status === 'pending')
        .map(f => {
          const u = _data.users.find(u => u.id === f.from_user);
          return u ? { id: u.id, username: u.username, avatar: u.avatar, created_at: f.created_at } : null;
        })
        .filter(Boolean);
    },
    getFriendIds(userId) {
      return _data.friendships
        .filter(f => (f.from_user === userId || f.to_user === userId) && f.status === 'accepted')
        .map(f => f.from_user === userId ? f.to_user : f.from_user);
    },
  },

  // ── ROOMS ───────────────────────────────────────────────────────────────────

  rooms: {
    insert(room) {
      const rec = {
        id:         nextId('rooms'),
        code:       room.code,
        name:       room.name,
        host_id:    room.host_id,
        status:     'waiting',
        max_players: room.max_players || 3,
        is_private:  room.is_private ? 1 : 0,
        password:    room.password || null,
        scenario:    room.scenario || 'voyages',
        win_vp:      room.win_vp || 13,
        created_at:  now(),
      };
      _data.rooms.push(rec);
      _dirty = true;
      return rec;
    },
    findById(id) { 
      if (id === undefined || id === null) return null;
      if (typeof id === 'string' && !/^\d+$/.test(id.trim())) return null;
      const parsed = parseInt(id, 10);
      return _data.rooms.find(r => r.id === parsed) || null; 
    },
    findByCode(code) { 
      if (!code) return null;
      const cleanCode = code.toString().trim().toUpperCase();
      return _data.rooms.find(r => r.code && r.code.toUpperCase() === cleanCode) || null; 
    },
    update(id, fields) {
      const idx = _data.rooms.findIndex(r => r.id === id);
      if (idx === -1) return false;
      Object.assign(_data.rooms[idx], fields);
      _dirty = true;
      return true;
    },
    delete(id) {
      _data.rooms = _data.rooms.filter(r => r.id !== id);
      _data.room_players = _data.room_players.filter(rp => rp.room_id !== id);
      if (_data.room_invites) {
        _data.room_invites = _data.room_invites.filter(i => i.room_id !== id);
      }
      _dirty = true;
    },
    getOpenRooms(userId = null) {
      if (userId) {
        return this.getOpenRoomsForUser(userId);
      }
      return _data.rooms
        .filter(r => r.status === 'waiting' && !r.is_private)
        .slice()
        .reverse()
        .map(r => {
          const players = _data.room_players.filter(rp => rp.room_id === r.id);
          const host = _data.users.find(u => u.id === r.host_id);
          return { ...r, player_count: players.length, host_name: host?.username || '?' };
        })
        .filter(r => r.player_count < r.max_players);
    },
    getOpenRoomsForUser(userId) {
      if (!userId) return [];
      const invites = _data.room_invites || [];
      const invitedRoomIds = new Set(
        invites
          .filter(i => i.to_user === userId && i.status === 'pending')
          .map(i => i.room_id)
      );
      const joinedRoomIds = new Set(
        _data.room_players
          .filter(rp => rp.user_id === userId)
          .map(rp => rp.room_id)
      );

      return _data.rooms
        .filter(r => r.status === 'waiting' || (r.status === 'playing' && (r.host_id === userId || joinedRoomIds.has(r.id))))
        .filter(r => {
          const isHost = (r.host_id === userId);
          const isJoined = joinedRoomIds.has(r.id);
          const isInvited = invitedRoomIds.has(r.id);
          return isHost || isJoined || isInvited;
        })
        .slice()
        .reverse()
        .map(r => {
          const players = _data.room_players.filter(rp => rp.room_id === r.id);
          const host = _data.users.find(u => u.id === r.host_id);
          const isHost = (r.host_id === userId);
          const isInvited = invitedRoomIds.has(r.id);
          return {
            ...r,
            player_count: players.length,
            host_name: host?.username || '?',
            is_host: isHost,
            is_invited: isInvited
          };
        })
        .filter(r => r.status === 'playing' || r.player_count < r.max_players || joinedRoomIds.has(r.id) || r.host_id === userId);
    },
    getRoomWithPlayers(id) {
      const room = _data.rooms.find(r => r.id === id);
      if (!room) return null;
      const players = _data.room_players
        .filter(rp => rp.room_id === id)
        .map(rp => {
          const u = _data.users.find(u => u.id === rp.user_id);
          return { ...rp, id: rp.user_id, user_id: rp.user_id, username: u?.username, avatar: u?.avatar, elo: u?.elo };
        });
      const host = _data.users.find(u => u.id === room.host_id);
      return { ...room, players, host_name: host?.username };
    },
  },

  // ── ROOM INVITES ────────────────────────────────────────────────────────────

  room_invites: {
    insert(roomId, fromUser, toUser) {
      if (!_data.room_invites) _data.room_invites = [];
      const exists = _data.room_invites.find(i => i.room_id === roomId && i.to_user === toUser && i.status === 'pending');
      if (exists) return exists;
      const rec = {
        id: nextId('room_invites'),
        room_id: roomId,
        from_user: fromUser,
        to_user: toUser,
        status: 'pending',
        created_at: now(),
      };
      _data.room_invites.push(rec);
      _dirty = true;
      return rec;
    },
    getByUser(userId) {
      if (!_data.room_invites) return [];
      return _data.room_invites.filter(i => i.to_user === userId && i.status === 'pending');
    },
    getByRoom(roomId) {
      if (!_data.room_invites) return [];
      return _data.room_invites.filter(i => i.room_id === roomId);
    },
    removeForRoom(roomId) {
      if (!_data.room_invites) return;
      _data.room_invites = _data.room_invites.filter(i => i.room_id !== roomId);
      _dirty = true;
    },
    remove(roomId, toUser) {
      if (!_data.room_invites) return;
      _data.room_invites = _data.room_invites.filter(i => !(i.room_id === roomId && i.to_user === toUser));
      _dirty = true;
    }
  },

  // ── ROOM PLAYERS ────────────────────────────────────────────────────────────

  room_players: {
    add(roomId, userId, seat, color) {
      const rId = parseInt(roomId, 10);
      const uId = parseInt(userId, 10);
      const exists = _data.room_players.find(rp => 
        (rp.room_id === rId || rp.room_id == roomId || String(rp.room_id) === String(roomId)) && 
        (rp.user_id === uId || rp.user_id == userId || String(rp.user_id) === String(userId))
      );
      if (exists) return exists;
      const rec = { room_id: rId, user_id: uId, seat, color, ready: 0 };
      _data.room_players.push(rec);
      _dirty = true;
      save();
      return rec;
    },
    remove(roomId, userId) {
      const rId = parseInt(roomId, 10);
      const uId = parseInt(userId, 10);
      _data.room_players = _data.room_players.filter(rp =>
        !((rp.room_id === rId || rp.room_id == roomId || String(rp.room_id) === String(roomId)) &&
          (rp.user_id === uId || rp.user_id == userId || String(rp.user_id) === String(userId)))
      );
      _dirty = true;
      save();
    },
    removeUserFromWaitingRooms(userId) {
      const uId = parseInt(userId, 10);
      const waitingRooms = _data.rooms.filter(r => r.status === 'waiting');
      const waitingRoomIds = new Set(waitingRooms.map(r => r.id));

      const affectedRoomIds = [];
      _data.room_players = _data.room_players.filter(rp => {
        const matchesUser = (rp.user_id === uId || rp.user_id == userId || String(rp.user_id) === String(userId));
        if (matchesUser && waitingRoomIds.has(rp.room_id)) {
          // If the user is the host of this room, we should not blindly remove them if they created it,
          // unless they actually left or closed the room
          const roomObj = _data.rooms.find(r => r.id === rp.room_id);
          const isHost = roomObj && (roomObj.host_id === uId || roomObj.host_id == userId || String(roomObj.host_id) === String(userId));
          if (!isHost) {
            affectedRoomIds.push(rp.room_id);
            return false;
          }
        }
        return true;
      });
      if (affectedRoomIds.length > 0) {
        _dirty = true;
        save();
      }
      return affectedRoomIds;
    },
    setReady(roomId, userId, ready) {
      const rId = parseInt(roomId, 10);
      const uId = parseInt(userId, 10);
      const rp = _data.room_players.find(rp => 
        (rp.room_id === rId || rp.room_id == roomId || String(rp.room_id) === String(roomId)) &&
        (rp.user_id === uId || rp.user_id == userId || String(rp.user_id) === String(userId))
      );
      if (rp) { rp.ready = ready ? 1 : 0; _dirty = true; save(); }
    },
    getByRoom(roomId) {
      const rId = parseInt(roomId, 10);
      return _data.room_players.filter(rp => rp.room_id === rId || rp.room_id == roomId || String(rp.room_id) === String(roomId));
    },
    getByUser(userId) {
      const uId = parseInt(userId, 10);
      return _data.room_players.filter(rp => rp.user_id === uId || rp.user_id == userId || String(rp.user_id) === String(userId));
    },
    isInRoom(roomId, userId) {
      const rId = parseInt(roomId, 10);
      const uId = parseInt(userId, 10);
      return !!_data.room_players.find(rp =>
        (rp.room_id === rId || rp.room_id == roomId || String(rp.room_id) === String(roomId)) &&
        (rp.user_id === uId || rp.user_id == userId || String(rp.user_id) === String(userId))
      );
    },
    count(roomId) {
      const rId = parseInt(roomId, 10);
      return _data.room_players.filter(rp => rp.room_id === rId || rp.room_id == roomId || String(rp.room_id) === String(roomId)).length;
    },
  },

  // ── GAME HISTORY ────────────────────────────────────────────────────────────

  game_history: {
    insert(record) {
      const rec = { id: nextId('game_history'), ...record, played_at: now() };
      _data.game_history.push(rec);
      _dirty = true;
      return rec;
    },
  },

  // ── MESSAGES ────────────────────────────────────────────────────────────────

  messages: {
    insert(roomId, userId, text) {
      const rec = { id: nextId('messages'), room_id: roomId, user_id: userId, text, sent_at: now() };
      _data.messages.push(rec);
      _dirty = true;
      return rec;
    },
    getByRoom(roomId, limit = 50) {
      return _data.messages
        .filter(m => m.room_id === roomId)
        .slice(-limit)
        .map(m => {
          const u = _data.users.find(u => u.id === m.user_id);
          return { ...m, username: u?.username, avatar: u?.avatar };
        });
    },
  },
};

module.exports = db;
