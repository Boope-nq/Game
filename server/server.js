const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { router: authRouter } = require('./routes/auth');
const friendsRouter = require('./routes/friends');
const roomsRouter = require('./routes/rooms');
const lobbySocket = require('./socket/lobbySocket');
const gameSocket = require('./socket/gameSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    req.io = io;
    next();
});
app.use(express.static(path.join(__dirname, '../client')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, '../client/assets/logo.png')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.use('/vendor/socket.io', express.static(path.join(__dirname, 'node_modules/socket.io/client-dist')));
app.use('/src', express.static(path.join(__dirname, '../src')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/rooms', roomsRouter);

// Socket.io handlers
lobbySocket(io);
gameSocket(io);

// Seed dedicated TESTWIN test room
const db = require('./db/schema');
if (!db.rooms.findByCode('TESTWIN')) {
    db.rooms.insert({
        code: 'TESTWIN',
        name: '🏆 Phòng Test Chiến Thắng (Auto-Win)',
        host_id: 1,
        scenario: 'default',
        max_players: 2,
        is_private: 0
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Catan Seafarers server is running on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
