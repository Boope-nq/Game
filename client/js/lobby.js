import { io } from 'socket.io-client';
import { BGMManager } from './audio/bgmManager.js';
import { VictoryCelebration3D } from './game/VictoryCelebration3D.js';

export const AVATAR_OPTIONS = [
    {
        id: 'bunny_pirate',
        name: 'Thỏ Hải Tặc',
        icon: '',
        img: 'assets/images/avatars/avatar_bunny.png',
        model: 'assets/models/bunny_rigged.glb',
        defaultAnim: 'bunny_anim',
        desc: 'Mô hình 3D & Bắn Tim',
        badge: '3D Champion'
    },
    {
        id: 'fox_explorer',
        name: 'Cáo Hải Tặc',
        icon: '',
        img: 'assets/images/avatars/avatar_fox.png',
        model: 'assets/models/fox_pirate.glb',
        defaultAnim: 'fox_dance',
        desc: 'Mô hình 3D & Nhảy Múa',
        badge: '3D Champion'
    },
    {
        id: 'monkey_pirate',
        name: 'Khỉ Hải Tặc',
        icon: '',
        img: 'assets/images/avatars/avatar_monkey.png',
        model: 'assets/models/monkey_pirate.glb',
        defaultAnim: 'monkey_anim',
        desc: 'Mô hình 3D & Kungfu',
        badge: '3D Champion'
    },
    {
        id: 'otter_pirate',
        name: 'Rái Cá Hải Tặc',
        icon: '',
        img: 'assets/images/avatars/avatar_otter.png',
        model: 'assets/models/otter_pirate.glb',
        defaultAnim: 'otter_anim',
        desc: 'Mô hình 3D & Sôi Động',
        badge: '3D Champion'
    }
];

export const CELEBRATION_ANIMATIONS = [
    {
        id: 'bunny_anim',
        name: 'Bắn Tim Đáng Yêu',
        file: 'assets/models/bunny_anim.glb',
        desc: 'Heart Pose & Nháy Mắt (5.4s)'
    },
    {
        id: 'fox_dance',
        name: 'Vũ Điệu Ăn Mừng',
        file: 'assets/models/fox_dance.glb',
        desc: 'Celebration Dance (2.9s)'
    },
    {
        id: 'monkey_anim',
        name: 'Kungfu Đá Xoay',
        file: 'assets/models/monkey_anim.glb',
        desc: 'Front Kick Combo (1.4s)'
    },
    {
        id: 'otter_anim',
        name: 'Vũ Điệu Sôi Động',
        file: 'assets/models/otter_anim.glb',
        desc: 'Energetic Dance (12.8s)'
    }
];

const FALLBACK_MONO_AVATAR = `<svg class="mono-icon" viewBox="0 0 24 24" style="width:100%;height:100%;"><path fill="currentColor" d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>`;

export function getAvatarHtml(avatarIdOrIcon, size = 26) {
    const found = AVATAR_OPTIONS.find(a => a.id === avatarIdOrIcon || a.icon === avatarIdOrIcon);
    if (found && found.img) {
        return `<img src="${found.img}" alt="${found.name}" style="width:${size}px; height:${size}px; border-radius:50%; object-fit:cover; object-position:center 12%; display:inline-block; vertical-align:middle; border:1px solid #38bdf8;">`;
    }
    return `<span style="font-size:${Math.round(size * 0.75)}px; display:inline-flex; align-items:center; justify-content:center; width:${size}px; height:${size}px; vertical-align:middle; color:#0284c7;">${FALLBACK_MONO_AVATAR}</span>`;
}

export function renderAvatarToElement(el, avatarIdOrIcon) {
    if (!el) return;
    const found = AVATAR_OPTIONS.find(a => a.id === avatarIdOrIcon || a.icon === avatarIdOrIcon);
    if (found && found.img) {
        el.innerHTML = `<img src="${found.img}" alt="${found.name}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; object-position:center 12%; display:block;">`;
    } else {
        el.innerHTML = FALLBACK_MONO_AVATAR;
    }
}

const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'index.html';
}

let currentUser = null;
try {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) currentUser = JSON.parse(cachedUser);
} catch (e) {}

let socket = null;

// Helper fetch with auth
async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;
    if (options.body && typeof options.body === 'object') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        localStorage.clear();
        window.location.href = 'index.html';
        return null;
    }
    return res.json();
}

// Init User Profile
async function loadProfile() {
    const res = await authFetch('/api/auth/me');
    if (!res) return;
    currentUser = res.user || res;

    const savedAvatar = localStorage.getItem('userAvatar') || currentUser.avatar || 'bunny_pirate';
    document.getElementById('user-name').textContent = currentUser.username;
    renderAvatarToElement(document.getElementById('user-avatar'), savedAvatar);
    document.getElementById('user-elo').textContent = `ELO: ${currentUser.elo || 1000}`;
    const statsEl = document.getElementById('user-stats');
    if (statsEl) {
        statsEl.textContent = `Thắng: ${currentUser.wins || 0} / Game: ${currentUser.games || 0}`;
    }
}

// Init Socket.io
function initSocket() {
    socket = io({
        auth: { token, clientType: 'lobby' }
    });

    socket.on('connect', () => {
        console.log('Connected to lobby socket');
    });

    socket.on('room:list', (rooms) => {
        renderRooms(rooms);
    });

    socket.on('room:invited', (data) => {
        showRoomInviteNotification(data);
        loadRooms();
    });

    socket.on('room:closed', () => {
        loadRooms();
    });

    socket.on('room_closed', () => {
        loadRooms();
    });

    socket.on('room:update', () => {
        loadRooms();
    });

    socket.on('room:player_left', () => {
        loadRooms();
    });

    socket.on('friend:online', ({ id, online }) => {
        updateFriendOnlineStatus(id, online);
    });

    socket.on('user:avatar_updated', ({ userId, avatar }) => {
        const el = document.getElementById(`friend-avatar-${userId}`);
        if (el) renderAvatarToElement(el, avatar);
    });

    socket.on('friend:request', () => {
        loadRequests();
    });

    socket.on('friend:update', () => {
        loadFriends();
        loadRequests();
    });

    socket.on('chat:message', (msg) => {
        appendChatMessage(msg.username, msg.text, msg.userId === currentUser?.id);
    });
}

function showRoomInviteNotification(data) {
    const existing = document.getElementById(`invite-toast-${data.roomCode}`);
    if (existing) existing.remove();

    const inviteToast = document.createElement('div');
    inviteToast.id = `invite-toast-${data.roomCode}`;
    inviteToast.className = 'room-invite-toast';
    inviteToast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: linear-gradient(145deg, #133c66, #091c33);
        border: 2px solid var(--gold);
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(255,215,0,0.3);
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 360px;
        color: #fff;
    `;
    inviteToast.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <svg class="mono-icon" style="width:22px; height:22px; fill:var(--gold);" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            <div style="font-weight:bold; color:var(--gold); font-size:1rem;">Lời Mời Vào Phòng!</div>
            <button style="margin-left:auto; background:none; border:none; color:#88a8cc; cursor:pointer; font-size:1rem;" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
        <div style="font-size:0.88rem; color:#e0f4ff; line-height:1.4;">
            <strong>${escapeHtml(data.fromUser)}</strong> mời bạn tham gia phòng: <strong>${escapeHtml(data.roomName)}</strong> (Mã: <code style="color:var(--gold); font-weight:bold;">${data.roomCode}</code>)
        </div>
        <div style="display:flex; gap:8px; margin-top:4px;">
            <button class="btn btn-ghost btn-sm" onclick="this.parentElement.parentElement.remove()" style="flex:1; padding:6px; font-size:0.8rem;">Bỏ qua</button>
            <button class="btn btn-primary btn-sm" onclick="window.joinRoomByCode('${data.roomCode}'); this.parentElement.parentElement.remove();" style="flex:1; padding:6px; font-size:0.8rem; font-weight:bold;">Vào ngay</button>
        </div>
    `;
    document.body.appendChild(inviteToast);
    setTimeout(() => {
        if (inviteToast.parentElement) inviteToast.remove();
    }, 15000);
}

// ─── FRIENDS ───────────────────────────────────────────────────────────
async function loadFriends() {
    const friends = await authFetch('/api/friends');
    const container = document.getElementById('friends-list');
    if (!container) return;

    if (!friends || friends.length === 0) {
        container.innerHTML = '<div style="color:#2d587f; font-weight:600; font-size:0.85rem; padding:10px;">Chưa có bạn bè nào. Hãy tìm kiếm ở trên!</div>';
        return;
    }

    container.innerHTML = friends.map(f => `
        <div class="friend-item" data-id="${f.id}" style="display:flex; align-items:center; gap:8px;">
            <span class="dot ${f.online ? 'dot-online' : 'dot-offline'}" id="friend-dot-${f.id}"></span>
            <span class="friend-avatar" id="friend-avatar-${f.id}" style="margin-right:2px; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden;">${getAvatarHtml(f.avatar, 26)}</span>
            <div style="flex:1; min-width:0; overflow:hidden;">
                <div class="friend-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#0c3258; font-weight:700;">${escapeHtml(f.username)}</div>
                <div style="font-size:0.75rem; color:#0369a1; font-weight:600;">ELO ${f.elo || 1000}</div>
            </div>
            <button class="btn btn-sm btn-remove-friend" data-id="${f.id}" onclick="window.removeFriend(${f.id}, '${escapeHtml(f.username)}')" style="padding:2px 7px; font-size:0.72rem; background:#fee2e2; border:1px solid #fca5a5; color:#dc2626; font-weight:bold; border-radius:4px; cursor:pointer;" title="Xóa bạn">✕</button>
        </div>
    `).join('');
}

window.removeFriend = async (userId, username) => {
    if (!confirm(`Bạn có chắc muốn xóa bạn với ${username}?`)) return;
    await authFetch(`/api/friends/${userId}`, { method: 'DELETE' });
    loadFriends();
};

window.inviteFriendToRoom = async (friendId, friendName) => {
    try {
        const rooms = await authFetch('/api/rooms');
        const myRoom = rooms?.find(r => r.is_host || r.host_id === currentUser?.id);
        if (!myRoom) {
            alert('Bạn chưa có phòng nào đang mở! Hãy bấm nút "Tạo phòng mới" trước để mời bạn bè cùng chơi.');
            return;
        }

        const res = await authFetch(`/api/rooms/${myRoom.id}/invite`, {
            method: 'POST',
            body: { target_user_id: friendId }
        });
        if (res && res.error) {
            alert(res.error);
        } else {
            alert(`Đã gửi lời mời tham gia phòng "${myRoom.name}" (Mã: ${myRoom.code}) đến ${friendName}!`);
            if (socket) {
                socket.emit('room:invite', { roomId: myRoom.id, targetUserId: friendId });
            }
        }
    } catch (err) {
        alert('Lỗi gửi lời mời: ' + err.message);
    }
};

async function loadRequests() {
    const requests = await authFetch('/api/friends/requests');
    const container = document.getElementById('requests-list');
    if (!container) return;

    if (!requests || requests.length === 0) {
        container.innerHTML = '<div style="color:#475569; font-weight:600; font-size:0.85rem; padding:8px 0;">Không có lời mời nào.</div>';
        return;
    }

    container.innerHTML = requests.map(r => `
        <div class="friend-item" style="display:flex; align-items:center; gap:8px;">
            <span class="friend-name" style="flex:1; color:#0c3258; font-weight:700;">${escapeHtml(r.username)}</span>
            <button class="btn btn-primary btn-sm" onclick="window.acceptFriend(${r.id})" style="padding:4px 10px; font-size:0.75rem; font-weight:700; border-radius:4px; cursor:pointer;">Đồng ý</button>
            <button class="btn btn-sm" onclick="window.rejectFriend(${r.id})" style="padding:4px 10px; font-size:0.75rem; background:#fee2e2; border:1.5px solid #fca5a5; color:#dc2626; font-weight:700; border-radius:4px; cursor:pointer;">Từ chối</button>
        </div>
    `).join('');
}

window.acceptFriend = async (userId) => {
    await authFetch(`/api/friends/accept/${userId}`, { method: 'POST' });
    loadFriends();
    loadRequests();
};

window.rejectFriend = async (userId) => {
    await authFetch(`/api/friends/reject/${userId}`, { method: 'POST' });
    loadRequests();
};

function updateFriendOnlineStatus(userId, online) {
    const dot = document.getElementById(`friend-dot-${userId}`);
    if (dot) {
        dot.className = `dot ${online ? 'dot-online' : 'dot-offline'}`;
    }
}

async function handleSearchFriends() {
    const q = document.getElementById('search-input')?.value.trim();
    if (!q) return;

    const results = await authFetch(`/api/friends/search?q=${encodeURIComponent(q)}`);
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    resultsContainer.style.display = 'block';
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div style="padding:8px; font-size:0.85rem; color:#0369a1; font-weight:600; text-align:center;"><svg class="mono-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg> Không tìm thấy người dùng</div>';
        return;
    }

    resultsContainer.innerHTML = results.map(u => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 4px; border-bottom:1px solid #bae6fd; font-size:0.85rem; color:#0c3258;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span style="margin-right:2px; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; overflow:hidden;">${getAvatarHtml(u.avatar, 26)}</span>
                <div>
                    <span style="font-weight:700; color:#0c3258;">${escapeHtml(u.username)}</span>
                    <span style="font-size:0.75rem; color:#0284c7; font-weight:600; margin-left:4px;">(ELO ${u.elo || 1000})</span>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.sendFriendRequest('${escapeHtml(u.username)}')" style="padding:4px 10px; font-size:0.75rem; font-weight:700; border-radius:4px;">+ Kết bạn</button>
        </div>
    `).join('');
}

window.sendFriendRequest = async (username) => {
    const res = await authFetch(`/api/friends/request/${encodeURIComponent(username)}`, { method: 'POST' });
    if (res && res.error) {
        alert(res.error);
    } else {
        alert(`Đã gửi lời mời kết bạn đến ${username}`);
    }
};

// ─── ROOMS ─────────────────────────────────────────────────────────────
async function loadRooms() {
    const rooms = await authFetch('/api/rooms');
    renderRooms(rooms || []);
}
window.loadRooms = loadRooms;

const ICONS = {
    anchor: '<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a3 3 0 0 0-3 3c0 1.31.84 2.41 2 2.83V11H7a5 5 0 0 0-5 5v1h2v-1a3 3 0 0 1 3-3h4v6.17c-1.16.42-2 1.52-2 2.83a3 3 0 0 0 6 0c0-1.31-.84-2.41-2-2.83V13h4a3 3 0 0 1 3 3v1h2v-1a5 5 0 0 0-5-5h-4V7.83c1.16-.42 2-1.52 2-2.83a3 3 0 0 0-3-3zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>',
    users: '<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
    map: '<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/></svg>',
    crown: '<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z"/></svg>',
    shipEmpty: '<svg class="mono-icon" style="width:48px;height:48px;margin-bottom:8px;opacity:0.6;" viewBox="0 0 24 24"><path fill="currentColor" d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.33-.41-.6-.46L19 13.01V5.5c0-.83-.67-1.5-1.5-1.5H16V2h-2v2h-4V2H8v2H6.5C5.67 4 5 4.67 5 5.5v7.51l-2.28.07c-.27.05-.48.22-.6.46s-.14.52-.06.78L3.95 19z"/></svg>'
};

function renderRooms(rooms) {
    const container = document.getElementById('rooms-list');
    if (!container) return;

    if (!rooms || rooms.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-muted); grid-column: 1 / -1;">
                <div>${ICONS.shipEmpty}</div>
                <div style="font-size:1.05rem; font-weight:700; margin-bottom:6px; color:#e0f4ff;">Chưa có phòng nào đang mở</div>
                <div style="font-size:0.88rem; max-width:480px; margin:0 auto; line-height:1.5;">Chỉ hiển thị các phòng do chính bạn tạo hoặc các phòng bạn có mã mời / được bạn bè mời vào. Hãy tạo phòng mới hoặc bấm <strong>"Vào bằng mã"</strong> để tham gia!</div>
            </div>
        `;
        return;
    }

    container.innerHTML = rooms.map(r => {
        const isHost = (currentUser && (r.host_id === currentUser.id || r.host_name === currentUser.username || r.is_host));
        const isInvited = r.is_invited && !isHost;
        const isPlaying = (r.status === 'playing');
        return `
            <div class="room-card ${isHost ? 'room-card-own' : ''} ${isInvited ? 'room-card-invited' : ''}">
                ${isPlaying ? `
                    <div class="corner-ribbon-wrapper">
                        <div class="corner-ribbon" style="background:linear-gradient(135deg, #f59e0b, #d97706); font-size:0.65rem;">ĐANG TRẬN</div>
                    </div>
                ` : isHost ? `
                    <div class="corner-ribbon-wrapper">
                        <div class="corner-ribbon">CHỦ PHÒNG</div>
                    </div>
                ` : isInvited ? `
                    <div class="corner-ribbon-wrapper">
                        <div class="corner-ribbon" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; font-size:0.65rem;">ĐƯỢC MỜI</div>
                    </div>
                ` : `
                    <div class="corner-ribbon-wrapper">
                        <div class="corner-ribbon" style="background:linear-gradient(135deg, #3b82f6, #1d4ed8); color:#fff; font-size:0.65rem;">ĐÃ THAM GIA</div>
                    </div>
                `}
                <div class="room-card-header">
                    <div class="room-card-title-wrap">
                        <span class="room-name" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</span>
                    </div>
                    <div class="room-card-actions-wrap">
                        <span class="room-code-badge">MÃ: ${r.code}</span>
                        ${isHost ? `
                            <button class="btn-delete-room" onclick="window.deleteRoom(${r.id}, '${r.code}', event)" title="Xoá và đóng phòng này">
                                ✕
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="room-meta">
                    <div class="room-meta-row">
                        ${ICONS.users}
                        <span>Người chơi: <strong>${r.player_count}</strong> / ${r.max_players}</span>
                    </div>
                    <div class="room-meta-row">
                        ${ICONS.map}
                        <span>Bản đồ: ${escapeHtml(r.scenario === 'cities_knights' ? 'Thành phố & Hiệp sĩ (Cities & Knights)' : (r.scenario === 'voyages' ? 'Voyages of Discovery' : (r.scenario || 'Voyages of Discovery')))}</span>
                    </div>
                    <div class="room-meta-row">
                        ${ICONS.crown}
                        <span>Chủ phòng: <strong class="room-host-name">${escapeHtml(r.host_name || 'Khách')}</strong></span>
                    </div>
                </div>
                <button class="btn btn-primary room-join-btn" onclick="window.joinRoomByCode('${r.code}')" style="${isPlaying ? 'background:linear-gradient(135deg, #f59e0b, #d97706); border-color:#d97706;' : ''}">
                    ${isPlaying ? '▶ TIẾP TỤC TRẬN ĐẤU' : (isInvited ? 'CHẤP NHẬN & VÀO PHÒNG' : 'VÀO PHÒNG')}
                </button>
            </div>
        `;
    }).join('');
}

window.deleteRoom = async (roomId, roomCode, event) => {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const confirmed = confirm(`Bạn có chắc chắn muốn xoá phòng này (Mã: ${roomCode}) không?\n\nTất cả người chơi đang ở trong phòng sẽ nhận thông báo phòng đã đóng và tự động quay lại màn hình sảnh chờ.`);
    if (!confirmed) return;

    try {
        const res = await authFetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
        if (res && res.error) {
            alert(res.error);
        } else {
            if (socket) {
                socket.emit('room:delete', roomId);
                socket.emit('room:list:get');
            }
            await loadRooms();
        }
    } catch (err) {
        alert('Lỗi khi xoá phòng: ' + err.message);
    }
};

window.joinRoomByCode = async (code) => {
    if (!code) return;
    const cleanCode = code.trim().toUpperCase();
    const res = await authFetch('/api/rooms/join', {
        method: 'POST',
        body: { code: cleanCode }
    });

    if (res && res.error) {
        alert(res.error);
        return;
    }

    const finalCode = (res && res.code) ? res.code : cleanCode;
    window.location.href = `game.html?room=${finalCode}`;
};

// ─── CHAT ──────────────────────────────────────────────────────────────
function appendChatMessage(author, text, isSelf = false) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-msg ${isSelf ? 'self' : ''}`;
    div.innerHTML = `
        <div class="chat-author">${escapeHtml(author)}</div>
        ${escapeHtml(text)}
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function sendChat() {
    const input = document.getElementById('chat-input-field');
    const text = input?.value.trim();
    if (!text || !socket) return;

    socket.emit('chat:room', { roomId: 0, text });
    input.value = '';
}

// ─── MODAL EVENTS ──────────────────────────────────────────────────────
function setupEvents() {
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // Start Interactive Tutorial Match with AI
    async function startTutorialMatch() {
        try {
            const name = "Hướng Dẫn Tân Thủ (Vs AI)";
            const max_players = 2;
            const scenario = "voyages";

            const res = await authFetch('/api/rooms', {
                method: 'POST',
                body: { name, max_players, scenario }
            });

            if (res && res.error) {
                alert(res.error);
                return;
            }

            socket.emit('room:create', res.id);
            window.location.href = `game.html?room=${res.code}&tutorial=true`;
        } catch (err) {
            console.error('Lỗi tạo phòng hướng dẫn:', err);
            alert('Không thể bắt đầu phòng hướng dẫn. Vui lòng thử lại!');
        }
    }

    document.getElementById('start-tutorial-btn')?.addEventListener('click', startTutorialMatch);
    document.getElementById('top-tutorial-btn')?.addEventListener('click', startTutorialMatch);

    // Create Room Modal
    const createModal = document.getElementById('create-modal');
    document.getElementById('create-room-btn')?.addEventListener('click', () => {
        createModal.classList.remove('hidden');
    });

    document.getElementById('close-create-btn')?.addEventListener('click', () => {
        createModal.classList.add('hidden');
    });

    document.getElementById('create-room-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('room-name-input').value;
        const max_players = document.getElementById('room-max-players').value;
        const scenario = document.getElementById('room-scenario').value;

        const res = await authFetch('/api/rooms', {
            method: 'POST',
            body: { name, max_players, scenario }
        });

        if (res && res.error) {
            alert(res.error);
            return;
        }

        socket.emit('room:create', res.id);
        createModal.classList.add('hidden');
        window.location.href = `game.html?room=${res.code}`;
    });

    // Join by Code Modal
    const joinCodeModal = document.getElementById('join-code-modal');
    document.getElementById('join-code-btn')?.addEventListener('click', () => {
        joinCodeModal.classList.remove('hidden');
    });

    document.getElementById('close-join-code-btn')?.addEventListener('click', () => {
        joinCodeModal.classList.add('hidden');
    });

    document.getElementById('join-code-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = document.getElementById('join-code-input').value.trim().toUpperCase();
        if (code) {
            window.joinRoomByCode(code);
        }
    });

    // Search Friends
    document.getElementById('search-btn')?.addEventListener('click', handleSearchFriends);
    document.getElementById('search-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearchFriends();
    });

    // Rules / Guide Modal
    const rulesModal = document.getElementById('rules-modal');
    const rulesBtn = document.getElementById('rules-btn');
    const closeRulesBtn = document.getElementById('close-rules-btn');

    rulesBtn?.addEventListener('click', () => {
        rulesModal?.classList.remove('hidden');
    });

    closeRulesBtn?.addEventListener('click', () => {
        rulesModal?.classList.add('hidden');
    });

    rulesModal?.addEventListener('click', (e) => {
        if (e.target === rulesModal) {
            rulesModal.classList.add('hidden');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && rulesModal && !rulesModal.classList.contains('hidden')) {
            rulesModal.classList.add('hidden');
        }
    });

    // Rules category navigation
    const navBtns = document.querySelectorAll('.rules-nav-btn');
    const rulesBody = document.getElementById('rules-body');

    function scrollNavTabIntoView(btn) {
        if (!btn) return;
        const navBar = btn.closest('.rules-nav');
        if (!navBar) return;
        const btnLeft = btn.offsetLeft;
        const btnWidth = btn.offsetWidth;
        const navWidth = navBar.clientWidth;
        const targetLeft = btnLeft - (navWidth / 2) + (btnWidth / 2);
        navBar.scrollTo({
            left: Math.max(0, targetLeft),
            behavior: 'smooth'
        });
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl && rulesBody) {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                scrollNavTabIntoView(btn);

                if (targetId === 'sec-overview') {
                    rulesBody.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    const bodyRect = rulesBody.getBoundingClientRect();
                    const elRect = targetEl.getBoundingClientRect();
                    const targetScrollTop = rulesBody.scrollTop + (elRect.top - bodyRect.top) - 14;
                    rulesBody.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
                }
            }
        });
    });

    // Auto-update active tab on scroll
    rulesBody?.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('.rules-section');
        const bodyRect = rulesBody.getBoundingClientRect();

        sections.forEach(sec => {
            const secRect = sec.getBoundingClientRect();
            const relTop = secRect.top - bodyRect.top;
            const height = secRect.height;
            if (relTop <= 70 && relTop + height > 70) {
                const id = sec.id;
                navBtns.forEach(b => {
                    const isActive = b.getAttribute('data-target') === id;
                    if (isActive && !b.classList.contains('active')) {
                        b.classList.add('active');
                        scrollNavTabIntoView(b);
                    } else if (!isActive) {
                        b.classList.remove('active');
                    }
                });
            }
        });
    });

    // Chat (if present)
    document.getElementById('chat-send-btn')?.addEventListener('click', sendChat);
    document.getElementById('chat-input-field')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Bootstrap
window.addEventListener('DOMContentLoaded', async () => {
    // Start Lobby Background Music
    window.lobbyBGM = new BGMManager('assets/audio/lobby_bgm.mp3', 'lobby-music-btn', 0.35);

    await loadProfile();
    initAvatarSystem();
    initSocket();
    loadFriends();
    loadRequests();
    loadRooms();
    setupEvents();
    initMobileLobby();
});

// ─── MOBILE LOBBY ENHANCEMENTS ───────────────────────────────────────────
function initMobileLobby() {
    handleMobileResize();
    window.addEventListener('resize', handleMobileResize);

    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // Pad lobby container for bottom nav bar
    const lobbyContainer = document.querySelector('.lobby-container');
    if (lobbyContainer) {
        lobbyContainer.style.paddingBottom = '70px';
        lobbyContainer.style.overflowY = 'auto';
        lobbyContainer.style.maxHeight = 'calc(100dvh - 68px)';
    }

    // Make left panel collapsible
    const leftPanel = document.querySelector('.left-panel');
    const leftPanelHeader = leftPanel?.querySelector('.panel-header');
    if (leftPanelHeader) {
        leftPanelHeader.addEventListener('click', () => {
            leftPanel.classList.toggle('collapsed');
        });
        // Start collapsed on mobile
        leftPanel.classList.add('collapsed');
    }

    // Add touch feedback to room cards
    document.addEventListener('click', (e) => {
        const roomCard = e.target.closest('.room-card');
        if (roomCard) {
            roomCard.style.transform = 'scale(0.98)';
            setTimeout(() => { roomCard.style.transform = ''; }, 150);
        }
    });
}

function handleMobileResize() {
    const isMobile = window.innerWidth <= 768;
    const tabBar = document.getElementById('mobile-tab-bar');
    const leftPanel = document.querySelector('.left-panel');
    const centerPanel = document.querySelector('.center-panel');

    if (tabBar) {
        tabBar.style.setProperty('display', isMobile ? 'flex' : 'none', 'important');
    }

    if (!isMobile) {
        if (leftPanel) leftPanel.style.display = '';
        if (centerPanel) centerPanel.style.display = '';
    } else {
        const activeTab = document.querySelector('.mobile-tab-btn.active')?.id;
        if (activeTab === 'tab-friends') {
            if (leftPanel) {
                leftPanel.style.display = 'flex';
                leftPanel.classList.remove('collapsed');
            }
            if (centerPanel) centerPanel.style.display = 'none';
        } else {
            if (leftPanel) leftPanel.style.display = 'none';
            if (centerPanel) centerPanel.style.display = 'flex';
        }
    }
}

// Global mobile tab function (called from HTML)
window.mobileTab = function(tab) {
    const leftPanel = document.querySelector('.left-panel');
    const centerPanel = document.querySelector('.center-panel');
    const lobbyContainer = document.querySelector('.lobby-container');

    // Update tab button states
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`tab-${tab}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (window.innerWidth <= 768) {
        if (tab === 'friends') {
            if (leftPanel) {
                leftPanel.style.display = 'flex';
                leftPanel.classList.remove('collapsed');
            }
            if (centerPanel) {
                centerPanel.style.display = 'none';
            }
            if (lobbyContainer) lobbyContainer.scrollTop = 0;
        } else if (tab === 'rooms') {
            if (leftPanel) {
                leftPanel.style.display = 'none';
            }
            if (centerPanel) {
                centerPanel.style.display = 'flex';
            }
            if (lobbyContainer) lobbyContainer.scrollTop = 0;
        }
    }
};

// ─── AVATAR & 3D CELEBRATION SELECTION SYSTEM ──────────────────────────────────
let previewCelebration3D = null;
let selectedAvatarId = localStorage.getItem('userAvatar') || 'bunny_pirate';
let selectedAnimId = localStorage.getItem('userCelebrationAnim') || 'bunny_anim';

function initAvatarSystem() {
    const avatarEl = document.getElementById('user-avatar');
    const modalEl = document.getElementById('avatar-modal');
    const closeBtn = document.getElementById('btn-close-avatar-modal');
    const saveBtn = document.getElementById('btn-save-avatar');
    const listContainer = document.getElementById('avatar-list-container');
    const animContainer = document.getElementById('celebration-anim-list');
    const previewCharName = document.getElementById('preview-character-name');
    const previewAnimName = document.getElementById('preview-anim-name');

    if (!avatarEl || !modalEl) return;

    // Show current user avatar in top bar
    renderAvatarToElement(avatarEl, selectedAvatarId);

    function updatePreviewLabels() {
        const curChar = AVATAR_OPTIONS.find(a => a.id === selectedAvatarId) || AVATAR_OPTIONS[0];
        const curAnim = CELEBRATION_ANIMATIONS.find(a => a.id === selectedAnimId) || CELEBRATION_ANIMATIONS[0];
        if (previewCharName) previewCharName.textContent = curChar.name;
        if (previewAnimName) previewAnimName.textContent = curAnim.name;
    }

    function renderAvatarCards() {
        if (!listContainer) return;
        listContainer.innerHTML = AVATAR_OPTIONS.map(opt => {
            const isSelected = (opt.id === selectedAvatarId);
            return `
                <div class="avatar-card ${isSelected ? 'selected' : ''}" data-id="${opt.id}" style="
                    border: ${isSelected ? '2.5px solid #0284c7 !important' : '2px solid #cbd5e1 !important'};
                    background: ${isSelected ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%) !important' : '#ffffff !important'};
                    padding: 10px 8px; text-align: center; cursor: pointer; border-radius: 8px;
                    transition: all 0.2s ease; position: relative; box-shadow: ${isSelected ? '0 4px 14px rgba(2, 132, 199, 0.28) !important' : '0 1px 4px rgba(0,0,0,0.05) !important'};
                ">
                    <span class="avatar-card-badge" style="position:absolute; top:4px; right:4px; font-size:0.62rem; padding:2px 6px; background:${isSelected ? '#0284c7' : '#e2e8f0'}; color:${isSelected ? '#ffffff' : '#1e293b'}; border-radius:4px; font-weight:800; border:1px solid ${isSelected ? '#0284c7' : '#cbd5e1'};">
                        <span class="badge-short">3D</span><span class="badge-long"> Champion</span>
                    </span>
                    <img src="${opt.img}" alt="${opt.name}" class="avatar-round-portrait" style="${isSelected ? 'border: 2.5px solid #0284c7; transform: scale(1.04);' : 'border: 2px solid #cbd5e1;'}">
                    <div class="avatar-card-name" style="font-weight: 800; color: ${isSelected ? '#0369a1 !important' : '#0f172a !important'}; font-size: 0.95rem; margin-top:4px;">${opt.name}</div>
                    <div class="avatar-card-desc" style="font-size: 0.78rem; color: ${isSelected ? '#075985 !important' : '#334155 !important'}; font-weight: 600; margin-top: 2px;">${opt.desc}</div>
                </div>
            `;
        }).join('');

        listContainer.querySelectorAll('.avatar-card').forEach(card => {
            card.onclick = async () => {
                selectedAvatarId = card.getAttribute('data-id');
                renderAvatarCards();
                updatePreviewLabels();
                const curChar = AVATAR_OPTIONS.find(a => a.id === selectedAvatarId);
                const curAnim = CELEBRATION_ANIMATIONS.find(a => a.id === selectedAnimId);
                if (previewCelebration3D && curChar && curAnim) {
                    await previewCelebration3D.setModelAndAnimation(curChar.model, curAnim.file);
                }
            };
        });
    }

    function renderAnimOptions() {
        if (!animContainer) return;
        animContainer.innerHTML = CELEBRATION_ANIMATIONS.map(anim => {
            const isSelected = (anim.id === selectedAnimId);
            return `
                <button type="button" class="btn-anim-option ${isSelected ? 'selected' : ''}" data-anim-id="${anim.id}" style="
                    padding: 10px 12px;
                    background: ${isSelected ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%) !important' : '#ffffff !important'};
                    border: ${isSelected ? '2.5px solid #0284c7 !important' : '2px solid #cbd5e1 !important'};
                    box-shadow: ${isSelected ? '0 2px 10px rgba(2, 132, 199, 0.22) !important' : '0 1px 4px rgba(0,0,0,0.04) !important'};
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    min-height: 48px;
                    transition: all 0.18s;
                ">
                    <div style="flex: 1; min-width: 0;">
                        <div class="anim-opt-name" style="font-weight: 800; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${isSelected ? '#0369a1 !important' : '#0f172a !important'};">${anim.name}</div>
                        <div class="anim-opt-desc" style="font-size: 0.78rem; color: ${isSelected ? '#075985 !important' : '#334155 !important'}; font-weight: 600; margin-top: 2px;">${anim.desc}</div>
                    </div>
                </button>
            `;
        }).join('');

        animContainer.querySelectorAll('.btn-anim-option').forEach(btn => {
            btn.onclick = async () => {
                selectedAnimId = btn.getAttribute('data-anim-id');
                renderAnimOptions();
                updatePreviewLabels();
                const curChar = AVATAR_OPTIONS.find(a => a.id === selectedAvatarId);
                const curAnim = CELEBRATION_ANIMATIONS.find(a => a.id === selectedAnimId);
                if (previewCelebration3D && curChar && curAnim) {
                    await previewCelebration3D.setModelAndAnimation(curChar.model, curAnim.file);
                }
            };
        });
    }

    // Tab Switching Logic
    window.switchProfileTab = function(tabName) {
        const btnAvatar = document.getElementById('tab-btn-avatar');
        const btnAccount = document.getElementById('tab-btn-account');
        const paneAvatar = document.getElementById('pane-avatar');
        const paneAccount = document.getElementById('pane-account');

        if (tabName === 'avatar') {
            btnAvatar?.classList.add('active');
            btnAccount?.classList.remove('active');
            paneAvatar?.classList.add('active');
            paneAccount?.classList.remove('active');

            // Trigger 3D preview resize / re-render
            setTimeout(async () => {
                if (!previewCelebration3D) {
                    const stage = document.getElementById('avatar-preview-3d-stage');
                    if (!stage) return;
                    const curChar = AVATAR_OPTIONS.find(a => a.id === selectedAvatarId) || AVATAR_OPTIONS[0];
                    const curAnim = CELEBRATION_ANIMATIONS.find(a => a.id === selectedAnimId) || CELEBRATION_ANIMATIONS[0];
                    previewCelebration3D = new VictoryCelebration3D('avatar-preview-3d-stage', {
                        avatar: curChar.id,
                        anim: curAnim.id
                    });
                    await previewCelebration3D.init();
                }
            }, 50);
        } else {
            btnAccount?.classList.add('active');
            btnAvatar?.classList.remove('active');
            paneAccount?.classList.add('active');
            paneAvatar?.classList.remove('active');
            syncAccountFormFields();
        }
    };

    function syncAccountFormFields() {
        let u = null;
        try {
            const uStr = localStorage.getItem('user');
            if (uStr) u = JSON.parse(uStr);
        } catch {}

        const nameInput = document.getElementById('input-new-username');
        if (nameInput) {
            nameInput.value = u?.username || currentUser?.username || '';
        }

        const eloVal = u?.elo ?? currentUser?.elo ?? 1000;
        const winsVal = u?.wins ?? currentUser?.wins ?? 0;
        const gamesVal = u?.games ?? currentUser?.games ?? 0;
        const winrate = gamesVal > 0 ? Math.round((winsVal / gamesVal) * 100) : 0;

        const statElo = document.getElementById('profile-stat-elo');
        const statWins = document.getElementById('profile-stat-wins');
        const statGames = document.getElementById('profile-stat-games');
        const statWinrate = document.getElementById('profile-stat-winrate');

        if (statElo) statElo.textContent = eloVal;
        if (statWins) statWins.textContent = winsVal;
        if (statGames) statGames.textContent = gamesVal;
        if (statWinrate) statWinrate.textContent = `${winrate}%`;
    }

    // Submit Change Username
    window.submitChangeName = async function(e) {
        if (e) e.preventDefault();
        const input = document.getElementById('input-new-username');
        const msgEl = document.getElementById('msg-change-name');
        const btn = document.getElementById('btn-submit-change-name');
        if (!input || !msgEl) return;

        const newName = input.value.trim();
        if (newName.length < 3 || newName.length > 20) {
            msgEl.className = 'profile-msg-box error';
            msgEl.textContent = 'Tên người dùng phải từ 3 đến 20 ký tự!';
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Đang lưu...';
        }

        try {
            const res = await authFetch('/api/auth/me', {
                method: 'PUT',
                body: { username: newName }
            });

            if (res.user) {
                // Update local storage and DOM
                localStorage.setItem('user', JSON.stringify(res.user));
                currentUser = res.user;

                const nameHeader = document.getElementById('user-name');
                if (nameHeader) nameHeader.textContent = res.user.username;

                msgEl.className = 'profile-msg-box success';
                msgEl.textContent = `Cập nhật tên thành công: "${res.user.username}"!`;

                if (socket) {
                    socket.emit('user:profile_update', { username: res.user.username });
                }
            } else {
                msgEl.className = 'profile-msg-box error';
                msgEl.textContent = res.error || 'Không thể cập nhật tên người dùng!';
            }
        } catch (err) {
            msgEl.className = 'profile-msg-box error';
            msgEl.textContent = err.message || 'Lỗi kết nối máy chủ!';
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<svg class="mono-icon" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM5 5v14h14V8.5L15.5 5H5zm2 10h10v2H7v-2zm0-8h7v4H7V7z"/></svg> Cập Nhật Tên Mới';
            }
        }
    };

    // Submit Change Password
    window.submitChangePassword = async function(e) {
        if (e) e.preventDefault();
        const curPassInput = document.getElementById('input-current-password');
        const newPassInput = document.getElementById('input-new-password');
        const confirmPassInput = document.getElementById('input-confirm-password');
        const msgEl = document.getElementById('msg-change-password');
        const btn = document.getElementById('btn-submit-change-password');

        if (!curPassInput || !newPassInput || !confirmPassInput || !msgEl) return;

        const curPass = curPassInput.value;
        const newPass = newPassInput.value;
        const confirmPass = confirmPassInput.value;

        if (newPass.length < 6) {
            msgEl.className = 'profile-msg-box error';
            msgEl.textContent = 'Mật khẩu mới phải có tối thiểu 6 ký tự!';
            return;
        }

        if (newPass !== confirmPass) {
            msgEl.className = 'profile-msg-box error';
            msgEl.textContent = 'Xác nhận mật khẩu mới không khớp!';
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Đang đổi mật khẩu...';
        }

        try {
            const res = await authFetch('/api/auth/me', {
                method: 'PUT',
                body: { currentPassword: curPass, password: newPass }
            });

            if (res.success) {
                msgEl.className = 'profile-msg-box success';
                msgEl.textContent = 'Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới.';
                curPassInput.value = '';
                newPassInput.value = '';
                confirmPassInput.value = '';
            } else {
                msgEl.className = 'profile-msg-box error';
                msgEl.textContent = res.error || 'Mật khẩu hiện tại không đúng!';
            }
        } catch (err) {
            msgEl.className = 'profile-msg-box error';
            msgEl.textContent = err.message || 'Lỗi kết nối khi đổi mật khẩu!';
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<svg class="mono-icon" viewBox="0 0 24 24"><path d="M7 14A5 5 0 0 1 12 9c.7 0 1.37.15 2 .41V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2h-2v2h-2v2h-2v1.59c.63.6 1.15 1.34 1.5 2.18A5 5 0 1 1 7 14zm5-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg> Đổi Mật Khẩu';
            }
        }
    };

    window.openProfileModal = async function(initialTab = 'avatar') {
        selectedAvatarId = localStorage.getItem('userAvatar') || 'bunny_pirate';
        selectedAnimId = localStorage.getItem('userCelebrationAnim') || 'bunny_anim';
        renderAvatarCards();
        renderAnimOptions();
        updatePreviewLabels();
        syncAccountFormFields();

        // Clear any previous alerts
        const msgName = document.getElementById('msg-change-name');
        const msgPass = document.getElementById('msg-change-password');
        if (msgName) { msgName.className = 'profile-msg-box'; msgName.style.display = 'none'; }
        if (msgPass) { msgPass.className = 'profile-msg-box'; msgPass.style.display = 'none'; }

        modalEl.classList.remove('hidden');
        window.switchProfileTab(initialTab);

        // Initialize 3D live preview
        if (initialTab === 'avatar') {
            setTimeout(async () => {
                if (previewCelebration3D) {
                    previewCelebration3D.destroy();
                    previewCelebration3D = null;
                }
                const stage = document.getElementById('avatar-preview-3d-stage');
                if (!stage) return;
                const curChar = AVATAR_OPTIONS.find(a => a.id === selectedAvatarId) || AVATAR_OPTIONS[0];
                const curAnim = CELEBRATION_ANIMATIONS.find(a => a.id === selectedAnimId) || CELEBRATION_ANIMATIONS[0];
                previewCelebration3D = new VictoryCelebration3D('avatar-preview-3d-stage', {
                    avatar: curChar.id,
                    anim: curAnim.id
                });
                await previewCelebration3D.init();
            }, 60);
        }
    };

    window.openAvatarModal = window.openProfileModal;

    window.closeProfileModal = function() {
        if (previewCelebration3D) {
            previewCelebration3D.destroy();
            previewCelebration3D = null;
        }
        modalEl.classList.add('hidden');
    };
    window.closeAvatarModal = window.closeProfileModal;

    window.saveAvatarSelection = async function() {
        const chosenChar = AVATAR_OPTIONS.find(a => a.id === selectedAvatarId) || AVATAR_OPTIONS[0];
        const chosenAnim = CELEBRATION_ANIMATIONS.find(a => a.id === selectedAnimId) || CELEBRATION_ANIMATIONS[0];

        localStorage.setItem('userAvatar', chosenChar.id);
        localStorage.setItem('userAvatarIcon', chosenChar.icon);
        localStorage.setItem('userCelebrationAnim', chosenAnim.id);

        renderAvatarToElement(avatarEl, chosenChar.id);

        // Sync with backend database & socket
        try {
            await authFetch('/api/auth/me', {
                method: 'PUT',
                body: { avatar: chosenChar.id }
            });
            const uStr = localStorage.getItem('user');
            if (uStr) {
                const u = JSON.parse(uStr);
                u.avatar = chosenChar.id;
                localStorage.setItem('user', JSON.stringify(u));
            }
            if (socket) {
                socket.emit('user:avatar_change', { avatar: chosenChar.id });
            }
        } catch (err) {
            console.warn('Error syncing avatar:', err);
        }

        window.closeProfileModal();
    };

    const profileTrigger = document.getElementById('btn-open-profile-trigger');
    if (profileTrigger) {
        profileTrigger.onclick = () => window.openProfileModal('avatar');
    } else {
        avatarEl.onclick = () => window.openProfileModal('avatar');
    }

    if (closeBtn) {
        closeBtn.onclick = window.closeProfileModal;
    }

    if (saveBtn) {
        saveBtn.onclick = window.saveAvatarSelection;
    }

    modalEl.onclick = (e) => {
        if (e.target === modalEl) window.closeProfileModal();
    };
}
