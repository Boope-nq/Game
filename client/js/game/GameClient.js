import { io } from 'socket.io-client';

export class GameClient {
    constructor(serverUrl, token, roomCode, callbacks = {}) {
        this.roomCode = roomCode;
        this.callbacks = callbacks;
        this.roomId = roomCode; // Default to roomCode so sendAction is never blocked
        
        try {
            this.socket = io(serverUrl || window.location.origin, {
                auth: {
                    token: token || localStorage.getItem('token'),
                    clientType: 'game',
                    roomCode: this.roomCode
                }
            });

            this.socket.on('connect', () => {
                console.log('Connected to game server socket');
                this.joinRoomChannel();
            });

            this.setupListeners();
        } catch (err) {
            console.warn('Socket connection failed, using dummy socket:', err);
            this.socket = {
                emit: (event, data) => console.log(`[Socket Emit] ${event}:`, data),
                on: (event, cb) => console.log(`[Socket On] Registered ${event}`)
            };
        }
    }

    async joinRoomChannel() {
        if (!this.roomCode) return;
        // Join channel using roomCode immediately
        this.socket.emit('game:join_channel', this.roomCode);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/rooms/${this.roomCode}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const room = await res.json();
            if (room && room.id) {
                this.roomId = room.id;
                this.socket.emit('game:join_channel', room.id);
            }
        } catch (err) {
            console.error('Failed to get room info:', err);
        }
    }

    setupListeners() {
        this.socket.on('game:state', (state) => {
            if (this.callbacks.onGameState) this.callbacks.onGameState(state);
        });
        this.socket.on('game:start', (state) => {
            if (this.callbacks.onGameStart) this.callbacks.onGameStart(state);
        });
        this.socket.on('game:rolled', (roll) => {
            if (this.callbacks.onGameRolled) this.callbacks.onGameRolled(roll);
        });
        this.socket.on('game:ended', (res) => {
            if (this.callbacks.onGameOver) this.callbacks.onGameOver(res);
        });
        this.socket.on('chat:message', (msg) => {
            if (this.callbacks.onChat) this.callbacks.onChat(msg);
        });
        this.socket.on('game:action_broadcast', ({ userId, action }) => {
            if (this.callbacks.onRemoteAction) this.callbacks.onRemoteAction(action, userId);
        });
        this.socket.on('game:player_joined', (data) => {
            if (this.callbacks.onPlayerJoined) this.callbacks.onPlayerJoined(data);
        });
        this.socket.on('room:closed', (data) => {
            if (this.callbacks.onRoomClosed) this.callbacks.onRoomClosed(data);
        });
        this.socket.on('room_closed', (data) => {
            if (this.callbacks.onRoomClosed) this.callbacks.onRoomClosed(data);
        });
        this.socket.on('game:room_started', (data) => {
            if (this.callbacks.onRoomStarted) this.callbacks.onRoomStarted(data);
        });
        this.socket.on('game:player_disconnected', (data) => {
            if (this.callbacks.onPlayerDisconnected) this.callbacks.onPlayerDisconnected(data);
        });
        this.socket.on('game:player_reconnected', (data) => {
            if (this.callbacks.onPlayerReconnected) this.callbacks.onPlayerReconnected(data);
        });
        this.socket.on('game:rematch_start', (data) => {
            if (this.callbacks.onRematch) this.callbacks.onRematch(data);
        });
        this.socket.on('game:rematch_waiting', (data) => {
            if (this.callbacks.onRematchWaiting) this.callbacks.onRematchWaiting(data);
        });
        this.socket.on('room:invited', (data) => {
            if (this.callbacks.onRoomInvited) this.callbacks.onRoomInvited(data);
        });
        this.socket.on('room:player_left', (data) => {
            if (this.callbacks.onPlayerLeft) this.callbacks.onPlayerLeft(data);
        });
        this.socket.on('room:update', (data) => {
            if (this.callbacks.onRoomUpdate) this.callbacks.onRoomUpdate(data);
        });
        this.socket.on('game:room_restore', (data) => {
            if (this.callbacks.onRoomRestore) this.callbacks.onRoomRestore(data);
        });
        this.socket.on('game:room_presence', (data) => {
            if (this.callbacks.onRoomPresence) this.callbacks.onRoomPresence(data);
        });
        this.socket.on('game:error', (err) => {
            alert(err);
        });
    }

    requestRestore() {
        this.socket.emit('game:request_restore', { roomId: this.roomId, roomCode: this.roomCode });
    }

    startRoomGame(players, maxPlayers, useBots) {
        this.socket.emit('game:room_start', {
            roomId: this.roomId,
            roomCode: this.roomCode,
            players,
            maxPlayers,
            useBots,
            seed: this.roomCode
        });
    }

    leaveRoom() {
        this.socket.emit('game:player_leave', { roomId: this.roomId, roomCode: this.roomCode });
        this.socket.emit('room:leave', this.roomId || this.roomCode);
    }

    sendRematch() {
        this.socket.emit('game:rematch', { roomId: this.roomId, roomCode: this.roomCode });
    }

    closeRoom() {
        this.socket.emit('game:close_room', { roomId: this.roomId, roomCode: this.roomCode });
    }

    sendAction(action) {
        const targetRoom = this.roomId || this.roomCode;
        if (!targetRoom) return;
        this.socket.emit('game:action', { roomId: this.roomId, roomCode: this.roomCode, action });
    }

    roll() {
        this.socket.emit('game:roll', { roomId: this.roomId });
    }

    build(type, position) {
        this.socket.emit('game:build', { roomId: this.roomId, type, position });
    }

    moveRobber(targetHex) {
        this.socket.emit('game:move_robber', { roomId: this.roomId, targetHex, type: 'robber' });
    }

    movePirate(targetHex) {
        this.socket.emit('game:move_robber', { roomId: this.roomId, targetHex, type: 'pirate' });
    }

    steal(targetUserId) {
        this.socket.emit('game:steal', { roomId: this.roomId, targetUserId });
    }

    tradeBank(give, take) {
        this.socket.emit('game:trade_bank', { roomId: this.roomId, give, take });
    }

    tradeOffer(offer) {
        this.socket.emit('game:trade_offer', { roomId: this.roomId, offer });
    }

    tradeAccept(offerId) {
        this.socket.emit('game:trade_accept', { roomId: this.roomId, offerId });
    }

    buyDevCard() {
        this.socket.emit('game:devcard_buy', { roomId: this.roomId });
    }

    playDevCard(cardType) {
        this.socket.emit('game:devcard_play', { roomId: this.roomId, cardType });
    }

    endTurn() {
        this.socket.emit('game:end_turn', { roomId: this.roomId });
    }

    sendGameOver(winnerId, vpReached, duration) {
        this.socket.emit('game:over', {
            roomId: this.roomId,
            roomCode: this.roomCode,
            winnerId,
            vpReached,
            duration
        });
    }
}
