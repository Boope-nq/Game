import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HexBoard3D } from './HexBoard3D.js';
import { Pieces3D } from './Pieces3D.js';
import { Dice3D } from './Dice3D.js?v=solid5';
import { GameClient } from './GameClient.js';
import { DecorativeIslands } from './DecorativeIslands.js';
import { GameState, Phase, BUILD_COST } from '/src/gameplay/GameState.js';
import { TileType } from '/src/core/HexTile.js';
import { BGMManager } from '../audio/bgmManager.js';
import { VictoryCelebration3D } from './VictoryCelebration3D.js';

let scene, camera, renderer, controls;
let hexBoard, pieces, dice3D, decorativeIslands;
let oceanMesh = null;
let victoryCelebration = null;
let gameState;
let gameClient;
let clock;
let raycaster, mouse;
let hoveredObject = null;
let currentBuildMode = null; // 'settlement' | 'city' | 'road' | 'ship'
let cameraTransition = null;
let isGamePaused = false;
let currentRoomPresence = null;

function applyRoomPresence(data) {
    if (!data) return;
    currentRoomPresence = data;
    if (!gameStarted || gameState?.winner) return;

    const myUser = JSON.parse(localStorage.getItem('user') || '{}');
    const myId = String(myUser.id || '');
    const myName = myUser.username || '';

    const missing = (data.missingPlayers || []).filter(p => {
        const pid = String(p.user_id || p.id || '');
        return p && pid !== myId && p.username !== myName;
    });
    const pausedModal = document.getElementById('player-paused-modal');
    const nameEl = document.getElementById('paused-player-name');

    if (missing.length > 0) {
        isGamePaused = true;
        if (nameEl) {
            nameEl.textContent = missing.map(p => p.username).join(', ');
        }
        if (pausedModal) pausedModal.classList.remove('hidden');
        logEvent(`[Tạm dừng] Đang chờ ${missing.map(p => p.username).join(", ")} vào lại phòng...`);
    } else {
        if (isGamePaused) {
            isGamePaused = false;
            if (pausedModal) pausedModal.classList.add('hidden');
            showTurnToast('Tất cả người chơi đã vào lại phòng! Trận đấu tiếp tục.');
            logEvent('▶️ Tất cả người chơi đã quay lại, trận đấu tiếp tục!');
        }
    }
}

function smoothMoveCamera(endPos, endTarget, duration = 650) {
    if (!camera || !controls) return;
    cameraTransition = {
        startPos: camera.position.clone(),
        endPos: endPos.clone(),
        startTarget: controls.target.clone(),
        endTarget: endTarget.clone(),
        startTime: performance.now(),
        duration: duration
    };
}

let myPlayerIndex = 0;
let roomData = null;
let roomCode = 'LOCAL';

const PLAYER_COLORS_3D = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12];
const DICE_ICON_HTML = `<svg class="mono-icon" style="width:22px;height:22px;vertical-align:-3px;margin-right:6px;" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-8c-.83 0-1.5-.67-1.5-1.5S11.17 6 12 6s1.5.67 1.5 1.5S12.83 9 12 9z"/></svg>`;

export const AVATAR_IMAGE_MAP = {
    'bunny_pirate': 'assets/images/avatars/avatar_bunny.png',
    'fox_explorer': 'assets/images/avatars/avatar_fox.png',
    'monkey_pirate': 'assets/images/avatars/avatar_monkey.png',
    'otter_pirate': 'assets/images/avatars/avatar_otter.png'
};

export function getPlayerAvatarUrl(avatarKey, playerIndex = 0) {
    if (avatarKey && AVATAR_IMAGE_MAP[avatarKey]) return AVATAR_IMAGE_MAP[avatarKey];
    if (avatarKey && (avatarKey.startsWith('assets/') || avatarKey.startsWith('http') || avatarKey.startsWith('/'))) {
        return avatarKey;
    }
    if (typeof avatarKey === 'string') {
        if (avatarKey.includes('fox') || avatarKey === '🦊') return AVATAR_IMAGE_MAP['fox_explorer'];
        if (avatarKey.includes('monkey') || avatarKey === '🐵' || avatarKey === '🐒') return AVATAR_IMAGE_MAP['monkey_pirate'];
        if (avatarKey.includes('otter') || avatarKey === '🦦') return AVATAR_IMAGE_MAP['otter_pirate'];
        if (avatarKey.includes('bunny') || avatarKey === '🐰') return AVATAR_IMAGE_MAP['bunny_pirate'];
    }
    const defaultList = [
        'assets/images/avatars/avatar_bunny.png',
        'assets/images/avatars/avatar_fox.png',
        'assets/images/avatars/avatar_monkey.png',
        'assets/images/avatars/avatar_otter.png'
    ];
    return defaultList[playerIndex % defaultList.length];
}

async function init() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        roomCode = urlParams.get('room') || 'LOCAL';
        const isTutorialMode = (urlParams.get('tutorial') === 'true');
        window.isTutorial = isTutorialMode;
        const token = localStorage.getItem('token');

        // ─── Three.js Scene Setup (Palette: #E0F4FF, #87C4FF, #39A7FF, #FFEED9) ───
        scene = new THREE.Scene();

        // Radiant sky vertical canvas gradient: #E0F4FF (zenith) to #87C4FF (horizon)
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 2;
        skyCanvas.height = 512;
        const skyCtx = skyCanvas.getContext('2d');
        const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
        skyGrad.addColorStop(0.0, '#E0F4FF');   // Soft sky zenith
        skyGrad.addColorStop(0.55, '#87C4FF');  // Fresh azure mid-sky
        skyGrad.addColorStop(1.0, '#87C4FF');   // Horizon haze
        skyCtx.fillStyle = skyGrad;
        skyCtx.fillRect(0, 0, 2, 512);
        const skyTex = new THREE.CanvasTexture(skyCanvas);
        scene.background = skyTex;

        // Fresh atmospheric distance fog blending with horizon (#87C4FF)
        scene.fog = new THREE.FogExp2(0x87C4FF, 0.0032);

        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 16.5, 23.5);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        // On mobile, limit pixel ratio to 1.5 for better performance
        const maxPixelRatio = (window.innerWidth <= 768) ? 1.5 : 2;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 8;
        controls.maxDistance = 110;
        controls.maxPolarAngle = Math.PI / 2.12;
        controls.target.set(0, 0, 0);

        // Mobile touch optimizations
        const isMobileDevice = window.innerWidth <= 768 || ('ontouchstart' in window);
        if (isMobileDevice) {
            // On mobile: use 1 finger to rotate, 2 fingers to zoom/pan
            controls.touches = {
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_PAN
            };
            controls.rotateSpeed = 0.7;
            controls.zoomSpeed = 1.2;
            controls.panSpeed = 0.8;
            // Tighter zoom range for mobile
            controls.minDistance = 10;
            controls.maxDistance = 70;
        }

        // ─── Cinematic Lighting with Warm Sunlight (#FFEED9) ───────────────────
        const ambientLight = new THREE.AmbientLight(0xffeed9, 0.95);
        scene.add(ambientLight);

        // Warm direct sun
        const dirLight = new THREE.DirectionalLight(0xfff9ea, 2.1);
        dirLight.position.set(24, 46, 22);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -30;
        dirLight.shadow.camera.right = 30;
        dirLight.shadow.camera.top = 30;
        dirLight.shadow.camera.bottom = -30;
        dirLight.shadow.bias = -0.0003;
        scene.add(dirLight);

        // Sky (#E0F4FF) & Caribbean Sea (#39A7FF) bounce light
        const hemiLight = new THREE.HemisphereLight(0xe0f4ff, 0x39a7ff, 0.75);
        hemiLight.position.set(0, 50, 0);
        scene.add(hemiLight);

        // Soft sunny rim light for 3D depth (#87C4FF)
        const rimLight = new THREE.DirectionalLight(0x87c4ff, 0.55);
        rimLight.position.set(-22, 28, -20);
        scene.add(rimLight);

        // ─── Bright Caribbean Turquoise Ocean Plane (#39A7FF) ───────────────────
        const oceanGeo = new THREE.PlaneGeometry(650, 650, 64, 64);
        const oceanMat = new THREE.MeshStandardMaterial({
            color: 0x39A7FF, // Vibrant clear tropical ocean (#39A7FF)
            roughness: 0.16,
            metalness: 0.25,
            transparent: true,
            opacity: 0.92
        });
        const ocean = new THREE.Mesh(oceanGeo, oceanMat);
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.y = -0.06;
        ocean.receiveShadow = true;
        scene.add(ocean);
        oceanMesh = ocean;

        // ─── Decorative Distant Archipelago Islands & Clouds ────────────────────
        decorativeIslands = new DecorativeIslands(scene);

        // ─── Game Systems ──────────────────────────────────────────────────────
        hexBoard = new HexBoard3D(scene);
        pieces = new Pieces3D(scene);
        dice3D = new Dice3D(scene, camera);
        window.dice3D = dice3D;
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // ─── Connect Socket.io for Real-Time Multiplayer Sync ───────────────────
        gameClient = new GameClient(window.location.origin, token, roomCode, {
            onRemoteAction: (action, fromUserId) => {
                applyAction(action, false);
            },
            onPlayerJoined: async (data) => {
                const username = typeof data === 'object' ? data.username : null;
                logEvent(`[Tham gia] ${username || 'Người chơi khác'} đã tham gia phòng!`);
                if (!gameStarted) {
                    await refreshRoomAndCheckStart();
                }
            },
            onChat: (msg) => {
                logEvent(typeof msg === 'string' ? msg : `${msg.username || 'Khách'}: ${msg.text}`);
            },
            onRoomClosed: (data) => {
                showRoomClosedNotification(data?.message);
            },
            onRoomInvited: (data) => {
                showTurnToast(`✉️ ${data.fromUser || 'Bạn bè'} vừa mời bạn vào phòng "${data.roomName || data.roomCode}"!`);
            },
            onRoomStarted: (data) => {
                const waitingModal = document.getElementById('waiting-modal');
                if (waitingModal) waitingModal.classList.add('hidden');
                const winModal = document.getElementById('win-modal');
                if (winModal) winModal.classList.add('hidden');
                if (victoryCelebration) {
                    victoryCelebration.destroy();
                    victoryCelebration = null;
                }
                initGameWithPlayers(data.players, data.maxPlayers, data.useBots, data.seed);
                showTurnToast('Chủ phòng đã bắt đầu trận đấu! Chúc các bạn may mắn!');
            },
            onPlayerLeft: async (data) => {
                const myUser = JSON.parse(localStorage.getItem('user') || '{}');
                if (data.userId === myUser.id) return;
                logEvent(`[Rời phòng] ${data.username || 'Một người chơi'} đã rời khỏi phòng.`);
                if (!gameStarted) {
                    await refreshRoomAndCheckStart();
                }
            },
            onRoomUpdate: (data) => {
                if (!gameStarted && data && data.players) {
                    roomData = data;
                    checkRoomAndShowWaitingModal(data.players, data.max_players || 3);
                }
            },
            onRoomPresence: (data) => {
                applyRoomPresence(data);
            },
            onPlayerDisconnected: (data) => {
                const myUser = JSON.parse(localStorage.getItem('user') || '{}');
                if (data.userId === myUser.id) return;

                if (!gameStarted) {
                    refreshRoomAndCheckStart();
                    return;
                }
                if (!gameState?.winner) {
                    isGamePaused = true;
                    const pausedModal = document.getElementById('player-paused-modal');
                    const nameEl = document.getElementById('paused-player-name');
                    if (nameEl) nameEl.textContent = data.username || 'Một người chơi';
                    if (pausedModal) pausedModal.classList.remove('hidden');
                    logEvent(`[Tạm dừng] Đang chờ ${data.username} kết nối lại...`);
                }
            },
            onPlayerReconnected: (data) => {
                if (currentRoomPresence && currentRoomPresence.missingPlayers) {
                    currentRoomPresence.missingPlayers = currentRoomPresence.missingPlayers.filter(p => p && p.id !== data.userId && p.username !== data.username);
                    applyRoomPresence(currentRoomPresence);
                } else if (isGamePaused) {
                    isGamePaused = false;
                    const pausedModal = document.getElementById('player-paused-modal');
                    if (pausedModal) pausedModal.classList.add('hidden');
                    showTurnToast(`${data.username || 'Người chơi'} đã kết nối lại! Trận đấu tiếp tục.`);
                    logEvent(`▶️ ${data.username || 'Người chơi'} đã quay lại, trận đấu tiếp tục!`);
                }
            },
            onRematchWaiting: (data) => {
                if (!data) return;
                const winModal = document.getElementById('win-modal');
                const isWinModalOpen = winModal && !winModal.classList.contains('hidden');

                if (roomData) {
                    roomData.status = 'waiting';
                    if (data.players) roomData.players = data.players;
                }

                if (!isWinModalOpen) {
                    // Người chơi này đã bấm Chơi Lại và đang ở phòng chờ: cập nhật danh sách người chơi
                    gameStarted = false;
                    checkRoomAndShowWaitingModal(data.players || [], data.maxPlayers || 3, true);
                } else {
                    const myUser = JSON.parse(localStorage.getItem('user') || '{}');
                    if (String(data.userWhoClicked) !== String(myUser.id)) {
                        showTurnToast('Một người chơi đã sẵn sàng chơi lại và đang ở trong phòng chờ!');
                    }
                }
            },
            onRematch: (data) => {
                clearSavedGameProgress();
                gameStarted = false;
                const winModal = document.getElementById('win-modal');
                if (winModal) winModal.classList.add('hidden');
                if (victoryCelebration) {
                    victoryCelebration.destroy();
                    victoryCelebration = null;
                }
                const myName = localStorage.getItem('username') || 'Bạn';
                const myUser = JSON.parse(localStorage.getItem('user') || '{}');
                const players = data?.players || (roomData?.players) || [{ id: myUser.id || 1, username: myName }];
                checkRoomAndShowWaitingModal(players, data?.maxPlayers || roomData?.max_players || 3, true);
            },
            onRoomRestore: (data) => {
                if (data && data.startPayload) {
                    restoreGameSession(data.startPayload, data.actions || []);
                }
            }
        });

        // ─── Room & Player Setup (With Waiting Room) ────────────────────────────
        await refreshRoomAndCheckStart();

        // Bind DOM & Raycaster events
        setupUIEvents();
        setupRaycasterEvents(canvas);

        // Start In-Game Background Music (Game Room BGM)
        window.gameBGM = new BGMManager('assets/audio/game_bgm.mp3', 'game-music-btn', 0.35);

        clock = new THREE.Clock();
        window.addEventListener('resize', onWindowResize);
        initTutorialCoach();
        animate();
    } catch (err) {
        console.error('Initialization error in main3d.js:', err);
        const hintText = document.getElementById('hint-text');
        if (hintText) hintText.textContent = `Lỗi khởi tạo: ${err.message}`;
    }
}

let gameStarted = false;
let recordedActions = [];
let activeGameSeed = null;

// ─── TIẾN TRÌNH & ĐỒNG BỘ TRẠNG THÁI GAME (PERSISTENCE & STATE HYDRATION) ─────
function saveGameProgress() {
    if (!gameState) return;
    const saveObj = {
        roomCode,
        isFinished: !!gameState.winner,
        startPayload: {
            players: cachedJoinedPlayers,
            maxPlayers: cachedMaxPlayers,
            useBots: cachedUseBots,
            seed: activeGameSeed || roomCode
        },
        actions: recordedActions,
        savedAt: Date.now()
    };

    if (roomCode === 'LOCAL') {
        try {
            localStorage.setItem('catan_local_game_save', JSON.stringify(saveObj));
        } catch (e) {
            console.warn('[Storage] Không thể lưu local game save:', e);
        }
    } else {
        try {
            sessionStorage.setItem(`catan_room_${roomCode}_save`, JSON.stringify(saveObj));
            localStorage.setItem(`catan_room_${roomCode}_save`, JSON.stringify(saveObj));
        } catch (e) {
            console.warn('[Storage] Không thể lưu room game save:', e);
        }
    }
}

function clearSavedGameProgress() {
    recordedActions = [];
    if (roomCode === 'LOCAL') {
        localStorage.removeItem('catan_local_game_save');
    } else {
        sessionStorage.removeItem(`catan_room_${roomCode}_save`);
        localStorage.removeItem(`catan_room_${roomCode}_save`);
    }
}

function restoreGameSession(startPayload, actions = []) {
    if (!startPayload || !startPayload.players || startPayload.players.length === 0) return false;

    // Nếu game đã khởi động và số hành động đã áp dụng bằng hoặc nhiều hơn -> không cần tua lại
    if (gameStarted && recordedActions.length >= actions.length && recordedActions.length > 0) {
        return false;
    }

    console.log(`[GameRestore] Đang khôi phục ván đấu (${actions.length} hành động)...`);

    // 1. Ẩn modal phòng chờ nếu đang hiển thị
    const waitingModal = document.getElementById('waiting-modal');
    if (waitingModal) waitingModal.classList.add('hidden');

    // 2. Khởi tạo lại ván cờ với cấu hình ban đầu
    initGameWithPlayers(
        startPayload.players,
        startPayload.maxPlayers || 3,
        !!startPayload.useBots,
        startPayload.seed || roomCode,
        { isRestoring: true }
    );

    // 3. Fast-forward replay tuần tự các hành động (không animation 3D xúc xắc để tức thì)
    recordedActions = [];
    for (const act of actions) {
        if (act && act.type) {
            recordedActions.push(act);
            applyAction(act, false, true); // shouldBroadcast = false, isReplaying = true
        }
    }

    // 4. Lưu lại vào cache
    saveGameProgress();

    // 5. Đồng bộ hóa HUD, điểm số và trạng thái bàn cờ
    currentBuildMode = null;
    syncAll();
    if (currentRoomPresence) {
        applyRoomPresence(currentRoomPresence);
    }
    showTurnToast(`Đã khôi phục tiếp tục tiến trình ván đấu!`);
    logEvent(`[Khôi phục] Tiến trình ván đấu đã được tiếp tục thành công (${recordedActions.length} thao tác).`);
    return true;
}

function tryRestoreLocalGame() {
    try {
        const raw = localStorage.getItem('catan_local_game_save');
        if (!raw) return false;
        const saved = JSON.parse(raw);
        if (saved && saved.startPayload && !saved.isFinished && Array.isArray(saved.actions)) {
            return restoreGameSession(saved.startPayload, saved.actions);
        }
    } catch (e) {
        console.warn('Lỗi đọc local save:', e);
    }
    return false;
}

function tryRestoreRoomGame(code) {
    try {
        const raw = sessionStorage.getItem(`catan_room_${code}_save`) || localStorage.getItem(`catan_room_${code}_save`);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        if (saved && saved.startPayload && !saved.isFinished && Array.isArray(saved.actions)) {
            return restoreGameSession(saved.startPayload, saved.actions);
        }
    } catch (e) {
        console.warn('Lỗi đọc room save:', e);
    }
    return false;
}

let hasJoinedRoomApi = false;
async function refreshRoomAndCheckStart(forceJoin = false) {
    const myName = localStorage.getItem('username') || 'Bạn';
    const myUser = JSON.parse(localStorage.getItem('user') || '{}');
    const token = localStorage.getItem('token');

    // ─── DEDICATED TEST ROOM: TESTWIN (Instant Victory Preview) ───────────────────
    if (roomCode === 'TESTWIN') {
        const myAvatar = localStorage.getItem('userAvatar') || localStorage.getItem('userAvatarIcon') || 'bunny_pirate';
        const waitingModal = document.getElementById('waiting-modal');
        if (waitingModal) waitingModal.classList.add('hidden');

        initGameWithPlayers([
            { id: myUser.id || 1, username: myName, avatar: myAvatar },
            { id: 99, username: 'Thuyền Trưởng AI', avatar: 'fox_explorer' }
        ], 2, false);

        setTimeout(() => {
            showVictoryCelebration({
                name: myName,
                avatar: myAvatar,
                totalVP: () => 13,
                victoryPoints: 13
            });
        }, 500);
        return;
    }

    // ─── LOCAL / OFFLINE / BOT GAME: KIỂM TRA TIẾN TRÌNH ĐÃ LƯU TRƯỚC ĐÓ ─────────
    if (roomCode === 'LOCAL') {
        const restored = tryRestoreLocalGame();
        if (restored) return;

        const myAvatar = localStorage.getItem('userAvatar') || localStorage.getItem('userAvatarIcon') || 'bunny_pirate';
        let joinedPlayers = [{ id: myUser.id || 1, username: myName, avatar: myAvatar }];
        const waitingModal = document.getElementById('waiting-modal');
        if (waitingModal) waitingModal.classList.add('hidden');
        initGameWithPlayers(joinedPlayers, 3, true);
        return;
    }

    let maxPlayers = 2;
    let joinedPlayers = [];

    try {
        // Ensure user is joined in room_players once on room entry
        if (!hasJoinedRoomApi || forceJoin) {
            hasJoinedRoomApi = true;
            await fetch('/api/rooms/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: roomCode })
            });
        }

        const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            roomData = await res.json();
            maxPlayers = parseInt(roomData.max_players, 10) || 2;
            if (roomData.players) {
                joinedPlayers = roomData.players;
            }
        }
    } catch (err) {
        console.warn('Cannot fetch room info:', err);
    }

    // ─── MULTIPLAYER: NẾU PHÒNG ĐANG TRONG TRẬN ĐẤU (STATUS === 'PLAYING') ────────
    if (roomData && roomData.status === 'playing') {
        const waitingModal = document.getElementById('waiting-modal');
        if (waitingModal) waitingModal.classList.add('hidden');

        // Kiểm tra danh sách người chơi thực còn thiếu từ connected_user_ids nếu có
        if (roomData.connected_user_ids && Array.isArray(roomData.connected_user_ids)) {
            const otherHumans = (joinedPlayers || []).filter(p => p && String(p.id) !== String(myUser.id) && !p.isBot && !String(p.username || '').includes('AI'));
            const missing = otherHumans.filter(p => !roomData.connected_user_ids.includes(String(p.id)));
            if (otherHumans.length > 0) {
                currentRoomPresence = {
                    missingPlayers: missing.map(p => ({ id: p.id, username: p.username })),
                    isPaused: missing.length > 0
                };
            }
        }

        // Thử khôi phục từ cache phía client trước nếu có
        const restoredLocal = tryRestoreRoomGame(roomCode);
        if (restoredLocal) {
            console.log('[GameRestore] Đã khôi phục tạm từ cache máy khách, đang đồng bộ cùng máy chủ...');
            if (currentRoomPresence) applyRoomPresence(currentRoomPresence);
        } else if (!gameStarted) {
            // Khởi tạo bàn cờ dự phòng ngay lập tức nếu chưa khởi tạo để người chơi không bị kẹt ở "Đang tải bàn cờ..."
            if (joinedPlayers.length === 0) {
                joinedPlayers = [{ id: myUser.id || 1, username: myName }];
            }
            myPlayerIndex = joinedPlayers.findIndex(p => p && (p.id == myUser.id || String(p.id) === String(myUser.id) || p.username === myName));
            if (myPlayerIndex === -1) myPlayerIndex = 0;
            initGameWithPlayers(joinedPlayers, maxPlayers, (joinedPlayers.length < maxPlayers), roomCode);
            showTurnToast('Đang kết nối và đồng bộ bàn cờ...');
            if (currentRoomPresence) applyRoomPresence(currentRoomPresence);
        }

        // Yêu cầu máy chủ socket gửi lại snapshot hành động
        if (gameClient) {
            gameClient.requestRestore();
        }
        return;
    }

    if (joinedPlayers.length === 0) {
        joinedPlayers = [{ id: myUser.id || 1, username: myName }];
    }

    // Determine my player index among joined players
    myPlayerIndex = joinedPlayers.findIndex(p => p.id === myUser.id || p.username === myName);
    if (gameStarted) {
        // Game is already running, just update HUD
        updateHUD();
        return;
    }

    checkRoomAndShowWaitingModal(joinedPlayers, maxPlayers);
}

function isCurrentPlayerHost() {
    if (window.__forceHostTest !== undefined && window.__forceHostTest !== null) {
        return !!window.__forceHostTest;
    }
    if (!roomCode || roomCode === 'LOCAL' || roomCode === 'TESTWIN' || window.isTutorial) {
        return true;
    }
    const myName = localStorage.getItem('username') || 'Bạn';
    const myUser = JSON.parse(localStorage.getItem('user') || '{}');
    const myId = myUser.id;

    if (roomData && (roomData.host_id !== undefined && roomData.host_id !== null)) {
        if (roomData.host_id == myId || String(roomData.host_id) === String(myId)) return true;
        if (roomData.host_name && roomData.host_name === myName) return true;
        return false;
    }

    if (cachedJoinedPlayers && cachedJoinedPlayers.length > 0 && cachedJoinedPlayers[0]) {
        const hostPlayer = cachedJoinedPlayers[0];
        if (hostPlayer.id == myId || String(hostPlayer.id) === String(myId) || hostPlayer.username === myName) {
            return true;
        }
        return false;
    }

    return myPlayerIndex === 0;
}
window.isCurrentPlayerHost = isCurrentPlayerHost;

function checkRoomAndShowWaitingModal(joinedPlayers, maxPlayers = 3, isRematch = false) {
    if (gameStarted && !isRematch) return;
    if (isRematch) gameStarted = false;
    const myName = localStorage.getItem('username') || 'Bạn';
    const myUser = JSON.parse(localStorage.getItem('user') || '{}');

    // Determine my player index among joined players
    myPlayerIndex = joinedPlayers.findIndex(p => p && (p.id == myUser.id || String(p.id) === String(myUser.id) || p.username === myName));
    if (myPlayerIndex === -1) myPlayerIndex = 0;

    // Check if we have enough players to start
    const waitingModal = document.getElementById('waiting-modal');
    const codeEl = document.getElementById('waiting-room-code');
    const listEl = document.getElementById('waiting-player-list');
    const statusEl = document.getElementById('waiting-status-text');
    const startBtn = document.getElementById('btn-start-game');
    const botBtn = document.getElementById('btn-start-with-bots');
    const hostActions = document.getElementById('waiting-host-actions');
    const guestNotice = document.getElementById('waiting-guest-notice');

    if (codeEl) codeEl.textContent = roomCode;

    // Solo tutorial or dedicated test win room start immediately (trừ khi đang mở lại từ Rematch)
    if (!isRematch && (window.isTutorial || roomCode === 'LOCAL' || roomCode === 'TESTWIN')) {
        if (waitingModal) waitingModal.classList.add('hidden');
        initGameWithPlayers(joinedPlayers, maxPlayers, (joinedPlayers.length < maxPlayers || window.isTutorial));
        return;
    }

    // Determine if the current client is the room host
    const isHost = isCurrentPlayerHost();

    // Show Waiting Room Modal until host explicitly starts the match
    if (waitingModal) waitingModal.classList.remove('hidden');

    if (listEl) {
        listEl.innerHTML = joinedPlayers.map((p, idx) => {
            const playerIsHost = (roomData && (p.id == roomData.host_id || String(p.id) === String(roomData.host_id) || p.username === roomData.host_name)) || (!roomData && idx === 0);
            return `
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:5px 0;">
                    <img src="${getPlayerAvatarUrl(p.avatar)}" alt="${escapeHtml(p.username)}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; border:1.5px solid #FFEED9; vertical-align:middle;">
                    <span style="font-weight:700;">${escapeHtml(p.username)}</span>
                    ${playerIsHost ? '<span style="font-size:0.68rem; background:var(--gold); color:#000; padding:1px 6px; font-weight:800; border-radius:3px; letter-spacing:0.5px;">CHỦ PHÒNG</span>' : ''}
                </div>
            `;
        }).join('');
    }

    if (statusEl) {
        if (!roomData && roomCode !== 'LOCAL' && roomCode !== 'TESTWIN') {
            statusEl.innerHTML = `<span style="color:#f59e0b;">[Lỗi] Không tìm thấy phòng "${escapeHtml(roomCode)}". Bạn có thể bấm nút dưới để chơi ngay với Bot AI!</span>`;
        } else {
            statusEl.textContent = `Đang có (${joinedPlayers.length}/${maxPlayers}) người chơi trong phòng`;
        }
    }

    if (isHost) {
        if (hostActions) hostActions.style.display = 'flex';
        if (guestNotice) guestNotice.style.display = 'none';

        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<span>Bắt Đầu Trận Đấu</span>';
            startBtn.onclick = () => {
                if (joinedPlayers.length < 2) {
                    alert('Cần ít nhất 2 người chơi để bắt đầu trận đấu!\n\nNếu chưa có đủ người bạn có thể bấm nút "Bắt đầu ngay (Lấp slot còn trống bằng Bot AI)".');
                    return;
                }
                startBtn.disabled = true;
                startBtn.innerHTML = '<span>⏳ Đang khởi động...</span>';
                if (gameClient && roomData) {
                    gameClient.startRoomGame(joinedPlayers, maxPlayers, false);
                    setTimeout(() => {
                        if (!gameStarted) {
                            if (waitingModal) waitingModal.classList.add('hidden');
                            initGameWithPlayers(joinedPlayers, maxPlayers, false);
                        }
                    }, 1500);
                } else {
                    if (waitingModal) waitingModal.classList.add('hidden');
                    initGameWithPlayers(joinedPlayers, maxPlayers, false);
                }
            };
        }

        if (botBtn) {
            botBtn.disabled = false;
            botBtn.innerHTML = `<svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h4a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1V9a2 2 0 0 1 2-2h4V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zm-4 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-9 6h10v-1H7v1z"/></svg><span>Bắt đầu ngay (Lấp slot còn trống bằng Bot AI)</span>`;
            botBtn.onclick = () => {
                botBtn.disabled = true;
                botBtn.innerHTML = '<span>⏳ Đang chuẩn bị bàn chơi...</span>';
                if (gameClient && roomData) {
                    gameClient.startRoomGame(joinedPlayers, maxPlayers, true);
                    setTimeout(() => {
                        if (!gameStarted) {
                            if (waitingModal) waitingModal.classList.add('hidden');
                            initGameWithPlayers(joinedPlayers, maxPlayers, true);
                        }
                    }, 1500);
                } else {
                    if (waitingModal) waitingModal.classList.add('hidden');
                    initGameWithPlayers(joinedPlayers, maxPlayers, true);
                }
            };
        }
    } else {
        if (hostActions) hostActions.style.display = 'none';
        if (guestNotice) guestNotice.style.display = 'block';
    }

    setupInviteFriendsModal(joinedPlayers);
}

// ─── INVITE FRIENDS MODAL LOGIC ──────────────────────────────────────────────
function setupInviteFriendsModal(joinedPlayers) {
    const openBtn = document.getElementById('btn-open-invite');
    const modal = document.getElementById('invite-friends-modal');
    const closeBtn1 = document.getElementById('btn-close-invite');
    const closeBtn2 = document.getElementById('btn-close-invite-2');
    const listContainer = document.getElementById('invite-friends-list');

    if (!openBtn || !modal) return;

    const closeModal = () => modal.classList.add('hidden');
    if (closeBtn1) closeBtn1.onclick = closeModal;
    if (closeBtn2) closeBtn2.onclick = closeModal;

    openBtn.onclick = async () => {
        modal.classList.remove('hidden');
        if (!listContainer) return;
        listContainer.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:16px;">⏳ Đang tải danh sách bạn bè...</div>';

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/friends', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Không thể tải bạn bè');
            const friends = await res.json();

            if (!Array.isArray(friends) || friends.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align:center; color:#94a3b8; padding:20px; font-size:0.9rem;">
                        <div style="font-size:0.9rem; color:#94a3b8; margin-bottom:6px;">(Trống)</div>
                        <div>Bạn chưa có người bạn nào trong danh sách. Hãy kết bạn ở Sảnh chờ nhé!</div>
                    </div>
                `;
                return;
            }

            // Sort: online first, then offline
            const sortedFriends = [...friends].sort((a, b) => (b.online || 0) - (a.online || 0));

            listContainer.innerHTML = sortedFriends.map(f => {
                const isOnline = (f.online === 1);
                const isAlreadyJoined = joinedPlayers.some(p => p && (p.id == f.id || String(p.id) === String(f.id) || p.username === f.username));

                let actionHtml = '';
                if (isAlreadyJoined) {
                    actionHtml = `<span style="font-size:0.8rem; color:#38bdf8; background:rgba(56,189,248,0.15); padding:3px 8px; border-radius:4px; border:1px solid rgba(56,189,248,0.3);">Đã trong phòng</span>`;
                } else if (isOnline) {
                    actionHtml = `<button class="btn btn-primary btn-sm btn-send-invite-user" data-user-id="${f.id}" data-username="${escapeHtml(f.username)}" style="padding:4px 12px; font-size:0.82rem; font-weight:600; cursor:pointer;">✉️ Mời vào</button>`;
                } else {
                    actionHtml = `<button class="btn btn-ghost btn-sm" disabled style="padding:4px 10px; font-size:0.8rem; opacity:0.4; cursor:not-allowed;">Ngoại tuyến</button>`;
                }

                const statusBadge = isOnline
                    ? `<span style="display:inline-flex; align-items:center; gap:4px; color:#4ade80; font-size:0.75rem; background:rgba(34,197,94,0.15); padding:2px 7px; border-radius:10px; border:1px solid rgba(34,197,94,0.3);"><span style="width:6px; height:6px; border-radius:50%; background:#22c55e;"></span>Online</span>`
                    : `<span style="display:inline-flex; align-items:center; gap:4px; color:#94a3b8; font-size:0.75rem; background:rgba(148,163,184,0.1); padding:2px 7px; border-radius:10px; border:1px solid rgba(148,163,184,0.2);"><span style="width:6px; height:6px; border-radius:50%; background:#64748b;"></span>Offline</span>`;

                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(0,0,0,0.3); border-radius:4px; border:1px solid rgba(255,255,255,0.08); margin-bottom:6px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${getPlayerAvatarUrl(f.avatar)}" alt="${escapeHtml(f.username)}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1.5px solid #FFEED9; vertical-align:middle;">
                            <div>
                                <div style="font-weight:600; color:#fff; font-size:0.95rem;">${escapeHtml(f.username)}</div>
                                <div>${statusBadge}</div>
                            </div>
                        </div>
                        <div>
                            ${actionHtml}
                        </div>
                    </div>
                `;
            }).join('');

            // Attach click listeners to invite buttons
            listContainer.querySelectorAll('.btn-send-invite-user').forEach(btn => {
                btn.onclick = async () => {
                    const targetUserId = btn.getAttribute('data-user-id');
                    const targetUsername = btn.getAttribute('data-username');
                    btn.disabled = true;
                    btn.textContent = 'Đang gửi...';

                    try {
                        const targetId = roomData?.id || roomCode;
                        const invRes = await fetch(`/api/rooms/${targetId}/invite`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ target_user_id: targetUserId })
                        });
                        const invData = await invRes.json();
                        if (invRes.ok) {
                            btn.textContent = 'Đã gửi ✓';
                            btn.style.color = '#4ade80';
                            btn.style.borderColor = '#22c55e';
                            btn.style.background = 'transparent';
                            showTurnToast(`✉️ Đã gửi lời mời tham gia phòng tới ${targetUsername}!`);
                        } else {
                            btn.disabled = false;
                            btn.textContent = 'Mời lại';
                            alert(invData.error || 'Gửi lời mời thất bại');
                        }
                    } catch (e) {
                        btn.disabled = false;
                        btn.textContent = 'Mời lại';
                        console.error('Invite error:', e);
                    }
                };
            });
        } catch (err) {
            console.error('Load friends error:', err);
            listContainer.innerHTML = '<div style="text-align:center; color:#f87171; padding:16px;">Không thể tải danh sách bạn bè. Vui lòng thử lại sau!</div>';
        }
    };
}

let cachedJoinedPlayers = [];
let cachedMaxPlayers = 2;
let cachedUseBots = false;

function initGameWithPlayers(joinedPlayers, maxPlayers, useBots = false, customSeed = null, options = {}) {
    cachedJoinedPlayers = [...joinedPlayers];
    cachedMaxPlayers = maxPlayers;
    cachedUseBots = useBots;

    // Update myPlayerIndex reliably based on logged in user
    const myUser = JSON.parse(localStorage.getItem('user') || '{}');
    const myName = myUser.username || 'Khách';
    const myIdx = joinedPlayers.findIndex(p => p && (p.id == myUser.id || String(p.id) === String(myUser.id) || p.username === myName));
    if (myIdx !== -1) {
        myPlayerIndex = myIdx;
        window.myPlayerIndex = myIdx;
    }

    gameStarted = true;
    const playerNames = joinedPlayers.map(p => p.username);
    const humanCount = joinedPlayers.length;

    // If using bots, fill up to maxPlayers
    if (useBots) {
        const botPool = ['Thuyền Trưởng AI', 'Hoa Tiêu AI', 'Thương Gia AI'];
        let pick = 0;
        while (playerNames.length < maxPlayers) {
            playerNames.push(botPool[pick % botPool.length]);
            pick++;
        }
    }

    // Initialize Game Engine with EXACT players and ROOM CODE SEED!
    const activeSeed = customSeed || roomCode;
    activeGameSeed = activeSeed;
    window.activeGameSeed = activeSeed;
    gameState = new GameState(playerNames.length, playerNames, activeSeed);

    // Tag each player as human or bot and assign synchronized avatars
    gameState.players.forEach((p, idx) => {
        p.isBot = (idx >= humanCount);
        if (idx < humanCount && joinedPlayers[idx]) {
            p.avatar = joinedPlayers[idx].avatar || (idx === myPlayerIndex ? (localStorage.getItem('userAvatar') || localStorage.getItem('userAvatarIcon') || 'bunny_pirate') : 'fox_explorer');
        } else {
            const botAvatars = ['fox_explorer', 'monkey_pirate', 'otter_pirate', 'bunny_pirate'];
            p.avatar = botAvatars[idx % botAvatars.length];
        }
    });

    window.THREE = THREE;
    window.gameState = gameState;
    window.pieces = pieces;
    window.hexBoard = hexBoard;
    window.decorativeIslands = decorativeIslands;
    window.camera = camera;
    window.dice3D = dice3D;
    window.myPlayerIndex = myPlayerIndex;
    window.performAction = performAction;

    // Clear and build 3D Board
    pieces.clearAll();
    hexBoard.buildBoardFromGameState(gameState);

    // Initial 3D Robber
    if (gameState.robberPos) {
        const rPos = hexBoard.hexToWorld(gameState.robberPos.q, gameState.robberPos.r);
        pieces.setRobberPos(rPos);
    }

    if (!options.isRestoring) {
        recordedActions = [];
        saveGameProgress();
        logEvent(`[Bắt đầu] Trận đấu bắt đầu với ${playerNames.length} người chơi: ${playerNames.join(', ')}`);
        syncAll();
    }

    if (currentRoomPresence) {
        applyRoomPresence(currentRoomPresence);
    }
}

// ─── UNIFIED ACTION DISPATCHER (LOCAL + MULTIPLAYER SYNC) ─────────────────────
function performAction(action) {
    if (isGamePaused) {
        showTurnToast('⏸️ Trận đấu đang tạm dừng để chờ người chơi quay lại!');
        return;
    }
    applyAction(action, true, false);
}
window.performAction = performAction;

function applyAction(action, shouldBroadcast = true, isReplaying = false) {
    if (!action) return;

    if (!isReplaying) {
        recordedActions.push(action);
        saveGameProgress();
    }

    const cp = gameState.currentPlayer;
    const colorHex = PLAYER_COLORS_3D[gameState.currentPlayerIndex];

    switch (action.type) {
        case 'setup_settlement': {
            const v = gameState.vertices.get(action.vKey);
            if (v && gameState.setupPlaceSettlement(action.vKey).ok) {
                pieces.placeSettlement(action.vKey, hexBoard.vertexToWorld(v), colorHex);
                if (!isReplaying) logEvent(`[Xây dựng] ${cp.name} đặt Định cư.`);
            }
            break;
        }
        case 'setup_road': {
            const edge = gameState.edges.get(action.eKey);
            if (edge && gameState.setupPlaceRoadOrShip(action.eKey, action.roadType).ok) {
                const v1 = gameState.vertices.get(edge.vertices[0]);
                const v2 = gameState.vertices.get(edge.vertices[1]);
                const p1 = hexBoard.vertexToWorld(v1);
                const p2 = hexBoard.vertexToWorld(v2);

                if (action.roadType === 'road') pieces.placeRoad(action.eKey, p1, p2, colorHex);
                else pieces.placeShip(action.eKey, p1, p2, colorHex);

                if (!isReplaying) logEvent(`[Xây dựng] ${cp.name} đặt ${action.roadType === 'road' ? 'Đường' : 'Tàu'}.`);
            }
            break;
        }
        case 'roll': {
            const res = gameState.rollDice(action.d1, action.d2);
            if (res.ok) {
                const { d1, d2, total } = res.roll;
                const diceDisplay = document.getElementById('dice-display');
                if (isReplaying) {
                    if (diceDisplay) {
                        diceDisplay.style.display = 'inline-flex';
                        diceDisplay.innerHTML = `${DICE_ICON_HTML} ${d1} + ${d2} = ${total}`;
                        diceDisplay.style.color = (total === 7) ? '#ff4d4d' : 'var(--gold)';
                    }
                } else {
                    if (diceDisplay) {
                        diceDisplay.style.display = 'inline-flex';
                        diceDisplay.innerHTML = `${DICE_ICON_HTML} Đang đổ xúc xắc...`;
                        diceDisplay.style.color = 'var(--gold)';
                    }

                    if (dice3D) {
                        dice3D.roll(d1, d2, (finalD1, finalD2) => {
                            if (diceDisplay) {
                                diceDisplay.innerHTML = `${DICE_ICON_HTML} ${finalD1} + ${finalD2} = ${total}`;
                                diceDisplay.style.color = (total === 7) ? '#ff4d4d' : 'var(--gold)';
                            }
                        });
                    } else if (diceDisplay) {
                        diceDisplay.innerHTML = `${DICE_ICON_HTML} ${d1} + ${d2} = ${total}`;
                        diceDisplay.style.color = (total === 7) ? '#ff4d4d' : 'var(--gold)';
                    }

                    logEvent(`[Xúc xắc] ${cp.name} đổ được: ${d1} + ${d2} = ${total}`);
                }
            }
            break;
        }
        case 'build_road': {
            const edge = gameState.edges.get(action.eKey);
            if (edge && gameState.placeRoad(action.eKey).ok) {
                const v1 = gameState.vertices.get(edge.vertices[0]);
                const v2 = gameState.vertices.get(edge.vertices[1]);
                pieces.placeRoad(action.eKey, hexBoard.vertexToWorld(v1), hexBoard.vertexToWorld(v2), colorHex);
                if (!isReplaying) logEvent(`[Xây dựng] ${cp.name} xây Đường.`);
            }
            break;
        }
        case 'build_ship': {
            const edge = gameState.edges.get(action.eKey);
            if (edge && gameState.placeShip(action.eKey).ok) {
                const v1 = gameState.vertices.get(edge.vertices[0]);
                const v2 = gameState.vertices.get(edge.vertices[1]);
                pieces.placeShip(action.eKey, hexBoard.vertexToWorld(v1), hexBoard.vertexToWorld(v2), colorHex);
                if (!isReplaying) logEvent(`[Xây dựng] ${cp.name} đóng Tàu.`);
            }
            break;
        }
        case 'build_settlement': {
            const v = gameState.vertices.get(action.vKey);
            if (v && gameState.placeSettlement(action.vKey).ok) {
                pieces.placeSettlement(action.vKey, hexBoard.vertexToWorld(v), colorHex);
                if (!isReplaying) logEvent(`[Xây dựng] ${cp.name} xây thêm Định cư!`);
            }
            break;
        }
        case 'build_city': {
            const v = gameState.vertices.get(action.vKey);
            if (v && gameState.placeCity(action.vKey).ok) {
                pieces.placeCity(action.vKey, hexBoard.vertexToWorld(v), colorHex);
                if (!isReplaying) logEvent(`[Nâng cấp] ${cp.name} nâng cấp lên Thành phố (+2 VP)!`);
            }
            break;
        }
        case 'robber': {
            gameState.moveRobber(action.q, action.r);
            pieces.setRobberPos(hexBoard.hexToWorld(action.q, action.r));
            if (!isReplaying) logEvent(`[Tên Cướp] ${cp.name} dời Tên Cướp.`);
            break;
        }
        case 'pirate': {
            gameState.movePirate(action.q, action.r);
            pieces.setPiratePos(hexBoard.hexToWorld(action.q, action.r));
            if (!isReplaying) logEvent(`[Cướp Biển] ${cp.name} dời Cướp Biển.`);
            break;
        }
        case 'steal': {
            const res = gameState.stealFrom(action.victimId, action.stolenResource);
            if (res.ok && !isReplaying) {
                const victimName = gameState.players[action.victimId]?.name || 'đối thủ';
                if (res.stolen) {
                    logEvent(`[Cướp] ${cp.name} đã cướp 1 ${res.stolen} từ ${victimName}!`);
                } else {
                    logEvent(`[Cướp] ${cp.name} đã cướp ${victimName} (nhưng đối thủ không có tài nguyên).`);
                }
            }
            break;
        }
        case 'move_ship': {
            const res = gameState.moveShip(action.fromEdgeKey, action.toEdgeKey);
            if (res.ok) {
                pieces.removeShip(action.fromEdgeKey);
                const edge = gameState.edges.get(action.toEdgeKey);
                const v1 = gameState.vertices.get(edge.vertices[0]);
                const v2 = gameState.vertices.get(edge.vertices[1]);
                pieces.placeShip(action.toEdgeKey, hexBoard.vertexToWorld(v1), hexBoard.vertexToWorld(v2), colorHex);
                if (!isReplaying) logEvent(`[Hải trình] ${cp.name} di chuyển Tàu biển.`);
            }
            break;
        }
        case 'trade_bank': {
            gameState.tradeWithBank(action.give, action.rate || 4, action.get);
            if (!isReplaying) logEvent(`[Ngân hàng] ${cp.name} đổi ${action.give} lấy ${action.get}.`);
            break;
        }
        case 'buy_dev': {
            const res = gameState.buyDevCard();
            if (res.ok && !isReplaying) {
                logEvent(`[Thẻ bài] ${cp.name} mua 1 Thẻ Phát Triển!`);
            }
            break;
        }
        case 'play_dev': {
            const res = gameState.playDevCard(action.cardType, action.options);
            if (res.ok && !isReplaying) {
                const names = {
                    'KNIGHT': 'Hiệp Sĩ (Knight)',
                    'YEAR_OF_PLENTY': 'Năm Bội Thu (Year of Plenty)',
                    'MONOPOLY': 'Độc Quyền (Monopoly)',
                    'ROAD_BUILDING': 'Xây Đường (Road Building)'
                };
                logEvent(`[Thẻ bài] ${cp.name} đã đánh ${names[action.cardType] || action.cardType}!`);
            }
            break;
        }
        case 'discard': {
            gameState.discardResources(action.playerId, action.toDiscard);
            if (!isReplaying) logEvent(`[Bỏ bài] ${gameState.players[action.playerId].name} bỏ bớt tài nguyên.`);
            break;
        }
        case 'gold_pick': {
            gameState.pickGoldResources(action.playerId, action.choices);
            if (!isReplaying) logEvent(`[Mỏ Vàng] ${gameState.players[action.playerId].name} nhận tài nguyên từ Ô Vàng.`);
            break;
        }
        case 'end_turn': {
            gameState.endTurn();
            if (!isReplaying) logEvent(`⏭️ ${cp.name} kết thúc lượt.`);
            break;
        }
    }

    if (shouldBroadcast && gameClient) {
        gameClient.sendAction(action);
    }

    if (!isReplaying) {
        currentBuildMode = null;
        syncAll();
    }
}

// ─── SYNC ALL (HUD, HIGHLIGHTS, DISCARD MODAL, BOTS) ──────────────────────────
function syncAll() {
    updateHUD();
    syncHighlights();
    handleDiscardPhase();
    checkWinCondition();
    triggerBotIfNeeded();
    updateTutorialCoachHUD();
}

function updateHUD() {
    const cp = gameState.currentPlayer;
    const isMyTurn = (gameState.currentPlayerIndex === myPlayerIndex);

    // Top Bar Players (Shows EXACTLY maxPlayers with official Catan public rules)
    const playersEl = document.getElementById('players-container');
    if (playersEl) {
        playersEl.innerHTML = gameState.players.map((p, idx) => {
            const isActive = (idx === gameState.currentPlayerIndex);
            const isMe = (idx === myPlayerIndex);
            const colorHex = '#' + PLAYER_COLORS_3D[idx].toString(16).padStart(6, '0');
            const unplayedDev = (p.devCards || []).filter(c => !c.played).length;
            const avatarUrl = getPlayerAvatarUrl(p.avatar, idx);
            const vpScore = isMe ? p.totalVP() : p.victoryPoints;
            const hiddenVPText = (isMe && p.hiddenVP > 0) ? `+${p.hiddenVP}` : '';

            const badges = [];
            if (p.hasLongestRoad) badges.push('<span class="pod-badge-road" title="Đường Dài Nhất (2 VP)"><svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z"/></svg></span>');
            if (p.hasLargestArmy) badges.push('<span class="pod-badge-army" title="Đại Quân (2 VP)"><svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6.92 5h10.16L12 11.08 6.92 5zM2 3h20v2l-9 11v6h4v2H7v-2h4v-6L2 5V3z"/></svg></span>');
            const badgeStr = badges.length > 0 ? `<div class="pod-badges-wrap" style="display:inline-flex; gap:2px;">${badges.join('')}</div>` : '';

            return `
                <div class="player-pod player-score ${isActive ? 'active-turn' : ''} ${isMe ? 'is-me' : ''}" 
                     onclick="window.__showPlayerStats(${idx})" 
                     title="${escapeHtml(p.name)}: ${vpScore} Điểm, ${p.totalResources()} TN, ${unplayedDev} Thẻ PT (Nhấp xem chi tiết)"
                     style="--player-col:${colorHex};">
                    <div class="player-pod-avatar-wrap">
                        <img src="${avatarUrl}" alt="${escapeHtml(p.name)}" class="player-pod-avatar" />
                        <span class="player-pod-vp" title="${vpScore} Điểm">${vpScore}${hiddenVPText ? `<small style="font-size:0.55rem;opacity:0.9;">(${hiddenVPText})</small>` : ''}</span>
                        ${isActive ? '<span class="player-turn-indicator" title="Đang trong lượt"></span>' : ''}
                    </div>
                    <div class="player-pod-info">
                        <div class="player-pod-name" style="color:${isMe ? '#FFEED9' : '#ffffff'};">
                            <span class="player-pod-name-text">${escapeHtml(p.name)}</span>
                            ${isMe ? '<span class="pod-me-tag">Bạn</span>' : ''}
                        </div>
                        <div class="player-pod-stats">
                            <span class="pod-res-pill" title="${p.totalResources()} Thẻ tài nguyên">
                                <svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>
                                <span>${p.totalResources()}</span>
                            </span>
                            ${unplayedDev > 0 ? `
                                <span class="pod-dev-pill" title="${unplayedDev} Thẻ phát triển">
                                    <svg class="mono-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M19 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-7 15l-4-4 1.41-1.41L12 14.17l5.59-5.59L19 10l-7 7z"/></svg>
                                    <span>${unplayedDev}</span>
                                </span>
                            ` : ''}
                            ${badgeStr}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Phase Indicator
    const phaseLabel = document.getElementById('phase-label');
    const hintText = document.getElementById('hint-text');

    if (phaseLabel && hintText) {
        switch (gameState.phase) {
            case Phase.SETUP_SETTLEMENT:
                phaseLabel.textContent = `SETUP (VÒNG ${gameState.setupRound}/2): ĐẶT ĐỊNH CƯ`;
                hintText.textContent = isMyTurn ? 'Nhấp chuột vào điểm tròn màu vàng trên bàn cờ để đặt Định cư' : `Đang chờ ${cp.name}...`;
                break;
            case Phase.SETUP_ROAD:
                phaseLabel.textContent = `SETUP (VÒNG ${gameState.setupRound}/2): ĐẶT ĐƯỜNG / TÀU`;
                hintText.textContent = isMyTurn ? 'Nhấp chuột vào cạnh màu vàng liền kề với Định cư vừa đặt' : `Đang chờ ${cp.name}...`;
                break;
            case Phase.ROLL:
                phaseLabel.textContent = `LƯỢT CỦA ${cp.name.toUpperCase()}: TUNG XÚC XẮC`;
                hintText.textContent = isMyTurn ? 'Nhấp vào nút "Đổ xúc xắc" màu vàng ở góc phải' : `Đang chờ ${cp.name} đổ xúc xắc...`;
                break;
            case Phase.BUILD:
                phaseLabel.textContent = `LƯỢT CỦA ${cp.name.toUpperCase()}: XÂY DỰNG & HÀNH ĐỘNG`;
                hintText.textContent = isMyTurn ? 'Bạn có thể xây công trình, đổi tài nguyên hoặc bấm "Kết thúc lượt"' : `Đang chờ ${cp.name}...`;
                break;
            case Phase.ROBBER:
                phaseLabel.textContent = `SỐ 7: DI CHUYỂN TÊN CƯỚP HOẶC CƯỚP BIỂN`;
                hintText.textContent = isMyTurn ? 'Nhấp vào ô đất để đặt Robber, hoặc nhấp vào ô biển để đặt Pirate' : `Đang chờ ${cp.name} di chuyển...`;
                break;
            case Phase.DISCARD:
                phaseLabel.textContent = `SỐ 7: BỎ BỚT TÀI NGUYÊN`;
                hintText.textContent = 'Người chơi có trên 7 thẻ bài phải bỏ một nửa số thẻ.';
                break;
            case Phase.STEAL:
                phaseLabel.textContent = `CƯỚP TÀI NGUYÊN`;
                hintText.textContent = isMyTurn ? `Đang cướp tài nguyên từ ${gameState.stealTargets?.map(id => gameState.players[id]?.name).join(', ') || 'đối thủ'}...` : `${cp.name} đang cướp tài nguyên...`;
                break;
            case Phase.GOLD_PICK:
                phaseLabel.textContent = `NHẬN TÀI NGUYÊN TỪ MỎ VÀNG`;
                hintText.textContent = 'Đang nhận tài nguyên từ mỏ vàng...';
                break;
            case Phase.GAME_OVER:
                phaseLabel.textContent = `TRẬN ĐẤU KẾT THÚC`;
                hintText.textContent = `${gameState.winner ? gameState.winner.name : 'Người chơi'} đã chiến thắng!`;
                break;
            default:
                phaseLabel.textContent = `GIAI ĐOẠN: ${gameState.phase}`;
                hintText.textContent = '';
        }
    }

    // Current Player's Resources
    const myPlayer = gameState.players[myPlayerIndex] || gameState.players[0];
    if (myPlayer) {
        checkAndAnimateGains(myPlayer);
        setResValue('res-wood', myPlayer.resources['LUMBER'] || 0);
        setResValue('res-brick', myPlayer.resources['BRICK'] || 0);
        setResValue('res-wheat', myPlayer.resources['GRAIN'] || 0);
        setResValue('res-sheep', myPlayer.resources['WOOL'] || 0);
        setResValue('res-ore', myPlayer.resources['ORE'] || 0);
        setResValue('res-gold', myPlayer.resources['GOLD'] || 0);
    }

    // Dice Button & Display State
    const rollBtn = document.getElementById('btn-roll');
    const diceDisplay = document.getElementById('dice-display');
    const isSetupPhase = (gameState.phase === Phase.SETUP_ROUND_1 || gameState.phase === Phase.SETUP_ROUND_2);

    if (rollBtn) {
        if (isSetupPhase) {
            rollBtn.style.display = 'none';
            rollBtn.classList.remove('can-roll');
        } else if (gameState.phase === Phase.ROLL) {
            rollBtn.style.display = 'inline-flex';
            const canRoll = isMyTurn;
            rollBtn.dataset.enabled = canRoll ? 'true' : 'false';
            rollBtn.classList.toggle('can-roll', canRoll);
            rollBtn.style.opacity = canRoll ? '1.0' : '0.45';
            rollBtn.style.cursor = canRoll ? 'pointer' : 'not-allowed';
        } else {
            // Already rolled this turn
            rollBtn.style.display = 'none';
            rollBtn.classList.remove('can-roll');
        }
    }

    if (diceDisplay) {
        if (isSetupPhase) {
            diceDisplay.style.display = 'none';
        } else if (gameState.lastRoll) {
            diceDisplay.style.display = 'inline-flex';
        }
    }

    // End Turn Button State
    const endTurnBtn = document.getElementById('btn-end-turn');
    if (endTurnBtn) {
        const canEnd = isMyTurn && gameState.phase === Phase.BUILD;
        endTurnBtn.dataset.enabled = canEnd ? 'true' : 'false';
        endTurnBtn.style.opacity = canEnd ? '1.0' : '0.45';
        endTurnBtn.style.cursor = canEnd ? 'pointer' : 'default';
    }

    // Build Buttons
    const canAct = isMyTurn && gameState.phase === Phase.BUILD;
    setBtnState('btn-road', canAct && myPlayer.canAfford(BUILD_COST.road) && myPlayer.stock.roads > 0, currentBuildMode === 'road');
    setBtnState('btn-ship', canAct && myPlayer.canAfford(BUILD_COST.ship) && myPlayer.stock.ships > 0, currentBuildMode === 'ship');
    setBtnState('btn-settlement', canAct && myPlayer.canAfford(BUILD_COST.settlement) && myPlayer.stock.settlements > 0, currentBuildMode === 'settlement');
    setBtnState('btn-city', canAct && myPlayer.canAfford(BUILD_COST.city) && myPlayer.stock.cities > 0 && myPlayer.placed.settlements.length > 0, currentBuildMode === 'city');
    setBtnState('btn-dev-buy', canAct && myPlayer.canAfford(BUILD_COST.devCard) && gameState.devCardDeck.length > 0);
    setBtnState('btn-trade', canAct);

    const devCards = myPlayer.devCards || [];
    const unplayedCards = devCards.filter(c => !c.played);
    const devViewBtn = document.getElementById('btn-dev-view');
    if (devViewBtn) {
        devViewBtn.textContent = `Thẻ Của Bạn (${unplayedCards.length})`;
    }

    const tradeBtn = document.getElementById('btn-trade');
    if (tradeBtn) {
        const hasHarbor = myPlayer.harborAccess && myPlayer.harborAccess.size > 0;
        tradeBtn.textContent = hasHarbor ? 'Đổi Cảng Biển' : 'Đổi Ngân Hàng (4:1)';
    }
}

let lastTrackedResources = null;
let lastTrackedDevCards = null;

function checkAndAnimateGains(myPlayer) {
    if (!lastTrackedResources) {
        lastTrackedResources = { ...myPlayer.resources };
        lastTrackedDevCards = (myPlayer.devCards || []).length;
        return;
    }

    const gains = [];
    const RES_MAP = {
        'LUMBER': { id: 'res-wood', name: 'Gỗ', color: '#4ade80' },
        'BRICK':  { id: 'res-brick', name: 'Gạch', color: '#f87171' },
        'GRAIN':  { id: 'res-wheat', name: 'Lúa', color: '#facc15' },
        'WOOL':   { id: 'res-sheep', name: 'Cừu', color: '#a3e635' },
        'ORE':    { id: 'res-ore', name: 'Quặng', color: '#94a3b8' },
        'GOLD':   { id: 'res-gold', name: 'Vàng', icon: '', color: '#fbbf24' }
    };

    for (const [resType, meta] of Object.entries(RES_MAP)) {
        const cur = myPlayer.resources[resType] || 0;
        const prev = lastTrackedResources[resType] || 0;
        if (cur > prev) {
            const diff = cur - prev;
            gains.push({ ...meta, type: resType, count: diff });
            animateCardGain(meta.id, diff);
        }
    }

    const curDevCount = (myPlayer.devCards || []).length;
    if (curDevCount > lastTrackedDevCards) {
        const diff = curDevCount - lastTrackedDevCards;
        const newCard = (myPlayer.devCards || [])[curDevCount - 1];
        const meta = DEV_CARD_METADATA[newCard?.type] || { name: 'Thẻ Phát Triển', icon: '', theme: 'var(--gold)', img: 'assets/cards/card_knight.png' };
        gains.push({ name: meta.name, icon: meta.icon, color: meta.theme, count: diff, isDev: true, devCardImg: meta.img });
        const devBtn = document.getElementById('btn-dev-view');
        if (devBtn) {
            devBtn.classList.add('pulse-glow');
            setTimeout(() => devBtn.classList.remove('pulse-glow'), 1200);
        }
    }

    if (gains.length > 0) {
        showCelebrationBanner(gains);
    }

    lastTrackedResources = { ...myPlayer.resources };
    lastTrackedDevCards = curDevCount;
}

function animateCardGain(elementId, amount) {
    const cardEl = document.getElementById(elementId)?.closest('.res-card');
    if (!cardEl) return;

    cardEl.classList.remove('pulse-glow');
    void cardEl.offsetWidth; // trigger reflow
    cardEl.classList.add('pulse-glow');

    const badge = document.createElement('div');
    badge.className = 'res-gain-badge';
    badge.textContent = `+${amount}`;
    cardEl.appendChild(badge);

    setTimeout(() => {
        badge.remove();
        cardEl.classList.remove('pulse-glow');
    }, 1400);
}

function showCelebrationBanner(gains) {
    const bannerContainer = document.getElementById('card-receive-banner');
    if (!bannerContainer) return;

    const pill = document.createElement('div');
    pill.className = 'receive-card-pill';
    
    const itemsHtml = gains.map(g => {
        const cardImg = g.isDev ? (g.devCardImg || 'assets/cards/card_knight.png') : `assets/cards/card_${g.type.toLowerCase()}.png`;
        return `
            <div style="display:inline-flex; align-items:center; gap:8px; background:rgba(0,0,0,0.5); border:1.5px solid ${g.color}; padding:5px 10px; border-radius:6px; box-shadow:0 4px 14px rgba(0,0,0,0.6);">
                <img src="${cardImg}" alt="${g.name}" style="width:28px; height:42px; object-fit:cover; border-radius:3px; border:1px solid ${g.color}; box-shadow:0 0 10px ${g.color}; display:block;">
                <div style="text-align:left;">
                    <div style="font-weight:900; color:${g.color}; font-size:1.15rem; text-shadow:0 0 10px ${g.color}; line-height:1.1;">+${g.count}</div>
                    <div style="font-weight:700; color:#fff; font-size:0.8rem; margin-top:2px;">${g.name}</div>
                </div>
            </div>
        `;
    }).join('');

    pill.innerHTML = `
        <div style="text-align:left; width:100%;">
            <div style="font-size:0.75rem; color:#85e3ff; text-transform:uppercase; letter-spacing:0.8px; font-weight:800; margin-bottom:6px;">Bạn Vừa Nhận Được:</div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">${itemsHtml}</div>
        </div>
    `;

    bannerContainer.appendChild(pill);

    if (navigator.vibrate) {
        try { navigator.vibrate([25, 40, 25]); } catch (_) {}
    }

    setTimeout(() => {
        pill.style.opacity = '0';
        pill.style.transform = 'translateY(-20px) scale(0.9)';
        pill.style.transition = 'all 0.4s ease';
        setTimeout(() => pill.remove(), 400);
    }, 3200);
}

function setResValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setBtnState(id, enabled, isActive = false) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.dataset.enabled = enabled ? 'true' : 'false';
    btn.style.opacity = enabled ? '1.0' : '0.45';
    btn.style.cursor = enabled ? 'pointer' : 'default';
    btn.classList.toggle('btn-build-active', isActive);
}

// ─── 3D HIGHLIGHTS (SPOTS TO CLICK) ──────────────────────────────────────────
function syncHighlights() {
    if (hoveredObject) {
        try { hoveredObject.scale.set(1, 1, 1); } catch (_) {}
        hoveredObject = null;
    }
    hexBoard.clearHighlights();

    if (gameState.currentPlayerIndex !== myPlayerIndex) return; // Only highlight for active player

    if (gameState.phase === Phase.SETUP_SETTLEMENT) {
        const valid = gameState.getValidSetupVertices();
        hexBoard.showVertexHighlights(valid, gameState);
    } else if (gameState.phase === Phase.SETUP_ROAD) {
        const roadEdges = gameState.getValidRoadEdges(true, gameState.setupSettlementVertex);
        const shipEdges = gameState.getValidShipEdges(true, gameState.setupSettlementVertex);
        hexBoard.showEdgeHighlights([...roadEdges, ...shipEdges], gameState);
    } else if (gameState.phase === Phase.BUILD) {
        if (currentBuildMode === 'settlement') {
            const valid = gameState.getValidSettlementVertices();
            hexBoard.showVertexHighlights(valid, gameState);
        } else if (currentBuildMode === 'city') {
            const valid = gameState.getValidCityVertices();
            hexBoard.showVertexHighlights(valid, gameState);
        } else if (currentBuildMode === 'road') {
            const valid = gameState.getValidRoadEdges(false);
            hexBoard.showEdgeHighlights(valid, gameState);
        } else if (currentBuildMode === 'ship') {
            const valid = gameState.getValidShipEdges(false);
            hexBoard.showEdgeHighlights(valid, gameState);
        }
    } else if (gameState.phase === Phase.ROBBER) {
        hexBoard.showTileHighlights(t => t.type !== TileType.DESERT);
    }
}

// ─── DISCARD PHASE HANDLING (NEVER GET STUCK) ────────────────────────────────
function handleDiscardPhase() {
    const discardModal = document.getElementById('discard-modal');
    if (!discardModal) return;

    if (gameState.phase !== Phase.DISCARD || !gameState.discardPending || gameState.discardPending.length === 0) {
        discardModal.classList.add('hidden');
        return;
    }

    const myPlayer = gameState.players[myPlayerIndex];
    const isMyTurnToDiscard = gameState.discardPending.includes(myPlayer.id);

    if (isMyTurnToDiscard) {
        discardModal.classList.remove('hidden');
        renderDiscardControls(myPlayer);
    } else {
        discardModal.classList.add('hidden');
    }
}

function renderDiscardControls(player) {
    const required = Math.floor(player.totalResources() / 2);
    const infoEl = document.getElementById('discard-info');
    const controlsEl = document.getElementById('discard-controls');
    const statusEl = document.getElementById('discard-count-status');
    const confirmBtn = document.getElementById('btn-confirm-discard');

    if (infoEl) infoEl.textContent = `Bạn có ${player.totalResources()} thẻ (>7). Bạn phải bỏ bớt ${required} thẻ.`;

    const selected = { LUMBER: 0, BRICK: 0, GRAIN: 0, WOOL: 0, ORE: 0 };

    const updateStatus = () => {
        const totalSelected = Object.values(selected).reduce((a, b) => a + b, 0);
        if (statusEl) statusEl.textContent = `Đã chọn: ${totalSelected} / ${required}`;
        if (confirmBtn) confirmBtn.disabled = (totalSelected !== required);
    };

    if (controlsEl) {
        const names = { LUMBER: 'Gỗ', BRICK: 'Gạch', GRAIN: 'Lúa', WOOL: 'Cừu', ORE: 'Quặng' };
        controlsEl.innerHTML = ['LUMBER', 'BRICK', 'GRAIN', 'WOOL', 'ORE'].map(r => {
            const count = player.resources[r] || 0;
            return `
                <div style="background:rgba(0,0,0,0.4); border:1px solid var(--border); border-radius:6px; padding:6px 10px; min-width:65px;">
                    <div style="font-size:0.75rem;">${names[r]} (${count})</div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:6px; margin-top:4px;">
                        <button class="btn btn-ghost btn-sm" id="sub-${r}" style="padding:1px 6px;">-</button>
                        <span id="val-${r}" style="font-weight:bold; color:var(--gold);">0</span>
                        <button class="btn btn-ghost btn-sm" id="add-${r}" style="padding:1px 6px;">+</button>
                    </div>
                </div>
            `;
        }).join('');

        ['LUMBER', 'BRICK', 'GRAIN', 'WOOL', 'ORE'].forEach(r => {
            const count = player.resources[r] || 0;
            document.getElementById(`add-${r}`)?.addEventListener('click', () => {
                const cur = Object.values(selected).reduce((a, b) => a + b, 0);
                if (cur < required && selected[r] < count) {
                    selected[r]++;
                    document.getElementById(`val-${r}`).textContent = selected[r];
                    updateStatus();
                }
            });
            document.getElementById(`sub-${r}`)?.addEventListener('click', () => {
                if (selected[r] > 0) {
                    selected[r]--;
                    document.getElementById(`val-${r}`).textContent = selected[r];
                    updateStatus();
                }
            });
        });
    }

    updateStatus();

    // Confirm button
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            performAction({ type: 'discard', playerId: player.id, toDiscard: selected });
            discardModal.classList.add('hidden');
        };
    }

    // Auto-discard button
    const autoBtn = document.getElementById('btn-auto-discard');
    if (autoBtn) {
        autoBtn.onclick = () => {
            const toDiscard = {};
            let count = 0;
            for (const r of ['LUMBER', 'BRICK', 'GRAIN', 'WOOL', 'ORE']) {
                const has = player.resources[r] || 0;
                const take = Math.min(has, required - count);
                if (take > 0) {
                    toDiscard[r] = take;
                    count += take;
                }
                if (count >= required) break;
            }
            performAction({ type: 'discard', playerId: player.id, toDiscard });
            discardModal.classList.add('hidden');
        };
    }
}

let toastTimer = null;
function showTurnToast(msg, duration = 3200) {
    let toast = document.getElementById('turn-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'turn-toast';
        toast.style.cssText = `
            position: fixed;
            top: 140px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 25, 47, 0.95);
            border: 2px solid var(--gold);
            color: #fff;
            padding: 12px 28px;
            border-radius: 30px;
            font-size: 1.02rem;
            font-weight: bold;
            box-shadow: 0 8px 30px rgba(0,0,0,0.85);
            z-index: 9999;
            pointer-events: none;
            transition: opacity 0.25s, transform 0.25s;
            text-align: center;
        `;
        document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
    }, duration);
}
window.showTurnToast = showTurnToast;

// ─── RAYCASTER & MOUSE CLICKS ON 3D WORLD ────────────────────────────────────
function setupRaycasterEvents(canvas) {
    let downX = 0, downY = 0;
    let downTime = 0;

    canvas.addEventListener('pointerdown', (e) => {
        downX = e.clientX;
        downY = e.clientY;
        downTime = Date.now();
    });

    canvas.addEventListener('pointermove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(hexBoard.highlightObjects, true);

        if (intersects.length > 0) {
            let obj = intersects[0].object;
            const target = (obj.parent && obj.parent.userData?.targetType) ? obj.parent : (obj.userData?.targetType ? obj : obj.parent) || obj;
            if (hoveredObject !== target) {
                if (hoveredObject) hoveredObject.scale.set(1, 1, 1);
                hoveredObject = target;
                if (hoveredObject) hoveredObject.scale.set(1.2, 1.2, 1.2);
            }
            canvas.style.cursor = 'pointer';
        } else {
            if (hoveredObject) {
                hoveredObject.scale.set(1, 1, 1);
                hoveredObject = null;
            }
            canvas.style.cursor = 'grab';
        }
    });

    const triggerClickAt = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        const clickCoord = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );

        if (gameState.currentPlayerIndex !== myPlayerIndex) {
            const cpName = gameState.currentPlayer?.name || 'Đối thủ';
            showTurnToast(`⏳ Chưa đến lượt của bạn! Đang chờ <strong>${escapeHtml(cpName)}</strong> thực hiện...`);
            return;
        }

        raycaster.setFromCamera(clickCoord, camera);
        const intersects = raycaster.intersectObjects(hexBoard.highlightObjects, true);
        if (intersects.length === 0) return;

        let obj = intersects[0].object;
        let data = obj.userData;
        if (!data || !data.targetType) {
            if (obj.parent && obj.parent.userData?.targetType) {
                data = obj.parent.userData;
            }
        }
        if (!data || !data.targetType) return;

        handleSpotClicked(data);
    };

    let lastClickTime = 0;
    const safeClick = (clientX, clientY) => {
        if (Date.now() - lastClickTime < 350) return;
        lastClickTime = Date.now();
        triggerClickAt(clientX, clientY);
    };

    canvas.addEventListener('pointerup', (e) => {
        const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
        const elapsed = Date.now() - downTime;
        if (dist <= 15 && elapsed <= 700) {
            safeClick(e.clientX, e.clientY);
        }
    });
}

let pendingBuildAction = null;

function askBuildConfirmation({ title, icon, actionType, targetType, vKey, eKey, cost, onConfirm }) {
    const modal = document.getElementById('confirm-build-modal');
    if (!modal) {
        onConfirm();
        return;
    }

    const iconEl = document.getElementById('confirm-build-icon');
    const titleEl = document.getElementById('confirm-build-title');
    const descEl = document.getElementById('confirm-build-desc');
    const detailsEl = document.getElementById('confirm-build-details');
    const btnConfirm = document.getElementById('btn-confirm-build');
    const btnCancel = document.getElementById('btn-cancel-build');

    if (iconEl) iconEl.innerHTML = icon || '';
    if (titleEl) titleEl.textContent = title || 'Xác Nhận Xây Dựng';
    if (descEl) descEl.innerHTML = `Bạn có chắc chắn muốn đặt <strong>${escapeHtml(actionType)}</strong> tại vị trí này không?`;

    let detailsHtml = '';
    if (targetType === 'vertex' && vKey) {
        const vertex = gameState.vertices.get(vKey);
        const resMap = {
            'LUMBER': { name: 'Gỗ', color: '#4ade80' },
            'BRICK':  { name: 'Gạch', color: '#f87171' },
            'GRAIN':  { name: 'Lúa', color: '#facc15' },
            'WOOL':   { name: 'Cừu', color: '#a3e635' },
            'ORE':    { name: 'Quặng', color: '#94a3b8' },
            'GOLD':   { name: 'Vàng', color: '#fbbf24' },
            'DESERT': { name: 'Sa Mạc', color: '#e8cf9b' },
            'SEA':    { name: 'Biển', color: '#38bdf8' }
        };

        const adjacent = [];
        if (vertex && vertex.hexes) {
            for (const h of vertex.hexes) {
                const tile = gameState.getTile(h.q, h.r);
                if (!tile) continue;
                const meta = resMap[tile.type] || { name: tile.type, color: '#fff' };
                if (tile.type === 'SEA') {
                    adjacent.push(`<span style="color:#38bdf8; font-weight:600;">Biển</span>`);
                } else if (tile.type === 'DESERT') {
                    adjacent.push(`<span style="color:#d97706; font-weight:600;">Sa Mạc</span>`);
                } else {
                    const isHot = (tile.number === 6 || tile.number === 8);
                    const numBadge = tile.number ? ` <span style="color:${isHot ? '#ff4d4d' : '#f0c040'}; font-weight:800; font-size:0.95rem;">[${tile.number}]</span>` : '';
                    adjacent.push(`
                        <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(0,0,0,0.35); padding:3px 8px; border-radius:4px; border:1px solid rgba(255,255,255,0.15);">
                            <span style="color:${meta.color}; font-weight:700;">${meta.name}</span>${numBadge}
                        </span>
                    `);
                }
            }
        }

        let harborHtml = '';
        if (gameState.harbors && vertex && vertex.hexes) {
            const harbor = gameState.harbors.find(hb => vertex.hexes.some(h => h.q === hb.q && h.r === hb.r));
            if (harbor) {
                const resIcon = harbor.resource ? (resMap[harbor.resource]?.icon || '') + ' ' + (resMap[harbor.resource]?.name || harbor.resource) : 'Bất Kỳ';
                harborHtml = `
                    <div style="margin-top:8px; padding-top:6px; border-top:1px dashed rgba(255,215,0,0.25); color:#38bdf8; display:flex; align-items:center; gap:6px;">
                        
                        <span><strong>Cảng Giao Thương:</strong> Tỉ lệ <strong>${harbor.ratio}:1</strong> (${resIcon})</span>
                    </div>
                `;
            }
        }

        detailsHtml = `
            <div style="margin-bottom:6px; color:#cbd5e1; font-weight:600;">Tài nguyên tiếp giáp:</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
                ${adjacent.length > 0 ? adjacent.join('') : '<span style="color:#94a3b8;">Không có ô liền kề</span>'}
            </div>
            ${harborHtml}
            <div style="margin-top:8px; padding-top:6px; border-top:1px dashed rgba(255,215,0,0.25); color:#94a3b8;">
                Chi phí: <strong style="color:${cost ? '#fbbf24' : '#4ade80'};">${cost || 'Miễn phí (Giai đoạn khởi đầu)'}</strong>
            </div>
        `;
    } else if (targetType === 'edge' && eKey) {
        const edge = gameState.edges.get(eKey);
        const terrainType = edge?.isLand ? 'Đoạn đường trên đất liền' : 'Tuyến hải trình trên mặt biển';
        detailsHtml = `
            <div style="margin-bottom:6px; color:#cbd5e1; font-weight:600;">Vị trí đặt:</div>
            <div style="color:#e2edff; margin-bottom:8px; font-weight:500;">${terrainType}</div>
            <div style="margin-top:8px; padding-top:6px; border-top:1px dashed rgba(255,215,0,0.25); color:#94a3b8;">
                Chi phí: <strong style="color:${cost ? '#fbbf24' : '#4ade80'};">${cost || 'Miễn phí (Giai đoạn khởi đầu)'}</strong>
            </div>
        `;
    } else {
        detailsHtml = `
            <div style="color:#94a3b8;">
                Chi phí: <strong style="color:${cost ? '#fbbf24' : '#4ade80'};">${cost || 'Miễn phí'}</strong>
            </div>
        `;
    }

    if (detailsEl) detailsEl.innerHTML = detailsHtml;

    modal.classList.remove('hidden');

    const closeModal = () => {
        modal.classList.add('hidden');
        pendingBuildAction = null;
        document.removeEventListener('keydown', handleKey);
    };

    const handleKey = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (pendingBuildAction) {
                const action = pendingBuildAction;
                closeModal();
                action();
            }
        }
    };
    document.addEventListener('keydown', handleKey);

    pendingBuildAction = onConfirm;

    if (btnConfirm) {
        btnConfirm.onclick = (e) => {
            e.stopPropagation();
            if (pendingBuildAction) {
                const action = pendingBuildAction;
                closeModal();
                action();
            }
        };
    }

    if (btnCancel) {
        btnCancel.onclick = (e) => {
            e.stopPropagation();
            closeModal();
        };
    }

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

function handleSpotClicked(data) {
    // 1. Vertex clicked
    if (data.targetType === 'vertex') {
        const vKey = data.key;
        if (gameState.phase === Phase.SETUP_SETTLEMENT) {
            askBuildConfirmation({
                title: 'Xác Nhận Đặt Định Cư Khởi Đầu',
                icon: '',
                actionType: 'Định Cư Khởi Đầu',
                targetType: 'vertex',
                vKey,
                onConfirm: () => performAction({ type: 'setup_settlement', vKey })
            });
        } else if (currentBuildMode === 'settlement') {
            askBuildConfirmation({
                title: 'Xác Nhận Xây Định Cư',
                icon: '',
                actionType: 'Khu Định Cư (Settlement)',
                targetType: 'vertex',
                vKey,
                cost: '1 Gỗ, 1 Gạch, 1 Lúa, 1 Cừu',
                onConfirm: () => performAction({ type: 'build_settlement', vKey })
            });
        } else if (currentBuildMode === 'city') {
            askBuildConfirmation({
                title: 'Xác Nhận Nâng Cấp Thành Phố',
                icon: '',
                actionType: 'Thành Phố (City)',
                targetType: 'vertex',
                vKey,
                cost: '3 Quặng, 2 Lúa',
                onConfirm: () => performAction({ type: 'build_city', vKey })
            });
        }
    }
    // 2. Edge clicked
    else if (data.targetType === 'edge') {
        const eKey = data.key;
        const edge = gameState.edges.get(eKey);
        if (!edge) return;

        if (gameState.phase === Phase.SETUP_ROAD) {
            const roadType = edge.isLand ? 'road' : 'ship';
            const icon = '';
            const name = roadType === 'road' ? 'Đoạn Đường Bộ' : 'Thuyền Buồm';
            askBuildConfirmation({
                title: `Xác Nhận Đặt ${name} Khởi Đầu`,
                icon,
                actionType: `${name} Khởi Đầu`,
                targetType: 'edge',
                eKey,
                onConfirm: () => performAction({ type: 'setup_road', eKey, roadType })
            });
        } else if (currentBuildMode === 'road') {
            askBuildConfirmation({
                title: 'Xác Nhận Làm Đường',
                icon: '',
                actionType: 'Tuyến Đường Bộ (Road)',
                targetType: 'edge',
                eKey,
                cost: '1 Gỗ, 1 Gạch',
                onConfirm: () => performAction({ type: 'build_road', eKey })
            });
        } else if (currentBuildMode === 'ship') {
            askBuildConfirmation({
                title: 'Xác Nhận Đóng Thuyền Buồm',
                icon: '',
                actionType: 'Thuyền Buồm (Ship)',
                targetType: 'edge',
                eKey,
                cost: '1 Gỗ, 1 Cừu',
                onConfirm: () => performAction({ type: 'build_ship', eKey })
            });
        }
    }
    // 3. Tile clicked (Robber / Pirate)
    else if (data.targetType === 'tile') {
        const { q, r } = data;
        const tile = gameState.getTile(q, r);
        if (!tile) return;

        if (tile.type === TileType.SEA) {
            performAction({ type: 'pirate', q, r });
        } else {
            performAction({ type: 'robber', q, r });
        }
    }
}

// ─── HUD BUTTON EVENTS ────────────────────────────────────────────────────────
function setupUIEvents() {
    // Helper to guard button actions with clear toast feedback and spam-click defense
    const bindSafeBtn = (id, actionFn, getDisabledReason) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (btn._isActionPending) return; // Prevent double/rapid-spam click
            if (isGamePaused) {
                showTurnToast('⏸️ Trận đấu đang tạm dừng để chờ người chơi quay lại!');
                return;
            }
            const isMyTurn = (gameState && gameState.currentPlayerIndex === myPlayerIndex);
            if (!isMyTurn) {
                const cpName = gameState?.currentPlayer?.name || 'Đối thủ';
                showTurnToast(`Chưa đến lượt của bạn! Đang chờ <strong>${escapeHtml(cpName)}</strong> đi lượt.`);
                return;
            }
            if (btn.dataset.enabled !== 'true') {
                const reason = getDisabledReason ? getDisabledReason() : 'Hành động hiện tại chưa khả dụng!';
                showTurnToast(reason);
                return;
            }
            btn._isActionPending = true;
            btn.dataset.enabled = 'false';
            try {
                actionFn();
            } finally {
                setTimeout(() => {
                    btn._isActionPending = false;
                }, 350);
            }
        });
    };

    // Roll Dice
    bindSafeBtn('btn-roll', () => {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        performAction({ type: 'roll', d1, d2 });
    }, () => {
        if (gameState.phase !== Phase.ROLL) return 'Bạn đã gieo xúc xắc rồi hoặc đang ở giai đoạn khác!';
        return 'Chưa thể tung xúc xắc!';
    });

    // End Turn
    bindSafeBtn('btn-end-turn', () => {
        performAction({ type: 'end_turn' });
    }, () => {
        if (gameState.phase === Phase.ROLL) return 'Hãy bấm "Đổ xúc xắc" trước khi kết thúc lượt!';
        if (gameState.phase !== Phase.BUILD) return 'Hãy hoàn thành hành động hiện tại trước!';
        return 'Chưa thể kết thúc lượt!';
    });
    // Build Toggles
    setupBuildBtn('btn-road', 'road', 'Đường', '1 Gạch + 1 Gỗ');
    setupBuildBtn('btn-ship', 'ship', 'Tàu Biển', '1 Gỗ + 1 Cừu');
    setupBuildBtn('btn-settlement', 'settlement', 'Định Cư', '1 Gạch + 1 Gỗ + 1 Lúa + 1 Cừu');
    setupBuildBtn('btn-city', 'city', 'Thành Phố', '2 Lúa + 3 Quặng');

    // Dev Card Buy
    bindSafeBtn('btn-dev-buy', () => {
        performAction({ type: 'buy_dev' });
    }, () => {
        if (gameState.phase !== Phase.BUILD) return 'Chỉ có thể mua thẻ trong giai đoạn Xây Dựng!';
        const myPlayer = gameState.players[myPlayerIndex];
        if (!myPlayer.canAfford(BUILD_COST.devCard)) return 'Không đủ tài nguyên mua Thẻ PT (Cần: 1 Lúa + 1 Cừu + 1 Quặng)!';
        if (gameState.devCardDeck.length === 0) return 'Đã hết Thẻ Phát Triển trong chồng bài!';
        return 'Chưa thể mua Thẻ Phát Triển!';
    });

    // Dev Card View & Play Modal
    const devModal = document.getElementById('dev-modal');
    document.getElementById('btn-dev-view')?.addEventListener('click', () => {
        renderDevCardsModal();
        devModal?.classList.remove('hidden');
    });
    document.getElementById('btn-close-dev')?.addEventListener('click', () => {
        devModal?.classList.add('hidden');
    });
    document.getElementById('btn-close-dev-x')?.addEventListener('click', () => {
        devModal?.classList.add('hidden');
    });

    // Trade Modal (With Dynamic Harbor Rate Calculation)
    const tradeModal = document.getElementById('trade-modal');
    const updateTradeRateInfo = () => {
        const give = document.getElementById('trade-give')?.value;
        const infoEl = document.getElementById('trade-rate-info');
        const myPlayer = gameState?.players[myPlayerIndex];
        if (give && infoEl && myPlayer) {
            const rate = gameState._getTradeRate(myPlayer, give);
            let harborText = '';
            if (rate === 2) harborText = ' (Nhờ Cảng chuyên dụng 2:1)';
            else if (rate === 3) harborText = ' (Nhờ Cảng tổng hợp 3:1)';
            infoEl.textContent = `Tỷ lệ: ${rate} đổi 1${harborText}`;
        }
    };

    document.getElementById('trade-give')?.addEventListener('change', updateTradeRateInfo);

    document.getElementById('btn-trade')?.addEventListener('click', () => {
        if (gameState.currentPlayerIndex !== myPlayerIndex || gameState.phase !== Phase.BUILD) return;
        updateTradeRateInfo();
        tradeModal?.classList.remove('hidden');
    });

    document.getElementById('btn-close-trade')?.addEventListener('click', () => {
        tradeModal?.classList.add('hidden');
    });

    document.getElementById('btn-confirm-trade')?.addEventListener('click', () => {
        const give = document.getElementById('trade-give').value;
        const get = document.getElementById('trade-get').value;
        if (give === get) {
            alert('Vui lòng chọn 2 loại tài nguyên khác nhau!');
            return;
        }

        const myPlayer = gameState?.players[myPlayerIndex];
        const rate = myPlayer ? gameState._getTradeRate(myPlayer, give) : 4;

        if ((myPlayer.resources[give] || 0) < rate) {
            alert(`Bạn không có đủ ${rate} ${give} để đổi!`);
            return;
        }

        performAction({ type: 'trade_bank', give, rate, get });
        tradeModal?.classList.add('hidden');
    });

    // Player Inspection Modal Events
    const pinfoModal = document.getElementById('player-info-modal');
    document.getElementById('btn-close-pinfo')?.addEventListener('click', () => {
        pinfoModal?.classList.add('hidden');
    });
    document.getElementById('btn-close-pinfo-ok')?.addEventListener('click', () => {
        pinfoModal?.classList.add('hidden');
    });

    // Resource Cards Click Handler (Bottom Bar)
    document.querySelectorAll('.res-card').forEach(card => {
        card.addEventListener('click', () => {
            const res = card.getAttribute('data-res');
            if (res && window.__inspectCard) {
                window.__inspectCard(res);
            }
        });
    });

    // Card Inspect Modal Close Events
    document.getElementById('btn-close-card-inspect')?.addEventListener('click', () => {
        document.getElementById('card-inspect-modal')?.classList.add('hidden');
    });
    document.getElementById('btn-card-inspect-close')?.addEventListener('click', () => {
        document.getElementById('card-inspect-modal')?.classList.add('hidden');
    });

    // ─── Top Bar Game Menu Dropdown & Settings Modal ───
    const gameMenuBtn = document.getElementById('game-menu-btn');
    const gameMenuDropdown = document.getElementById('game-menu-dropdown');
    const menuBtnSettings = document.getElementById('menu-btn-settings');
    const menuBtnRules = document.getElementById('menu-btn-rules');
    const menuBtnLeave = document.getElementById('menu-btn-leave');

    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('btn-close-settings');
    const closeSettingsOk = document.getElementById('btn-close-settings-ok');
    const bgmVolumeSlider = document.getElementById('bgm-volume-slider');
    const bgmVolumeLabel = document.getElementById('bgm-volume-label');
    const btnResetCamera = document.getElementById('btn-reset-camera');

    // Toggle menu dropdown
    gameMenuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        gameMenuDropdown?.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (gameMenuDropdown && !gameMenuDropdown.classList.contains('hidden')) {
            if (!gameMenuBtn?.contains(e.target) && !gameMenuDropdown.contains(e.target)) {
                gameMenuDropdown.classList.add('hidden');
            }
        }
    });

    // Menu Item: Open Settings
    menuBtnSettings?.addEventListener('click', () => {
        gameMenuDropdown?.classList.add('hidden');
        if (settingsModal) {
            if (bgmVolumeSlider && window.gameBGM) {
                const volPct = Math.round((window.gameBGM.targetVolume !== undefined ? window.gameBGM.targetVolume : 0.35) * 100);
                bgmVolumeSlider.value = volPct;
                if (bgmVolumeLabel) bgmVolumeLabel.textContent = `${volPct}%`;
            }
            settingsModal.classList.remove('hidden');
        }
    });

    // Menu Item: Open Rules
    menuBtnRules?.addEventListener('click', () => {
        gameMenuDropdown?.classList.add('hidden');
        const rModal = document.getElementById('rules-modal');
        rModal?.classList.remove('hidden');
    });

    // Menu Item: Leave Room
    menuBtnLeave?.addEventListener('click', async () => {
        gameMenuDropdown?.classList.add('hidden');
        if (confirm('Bạn có chắc chắn muốn rời khỏi phòng chơi?')) {
            if (window.leaveRoomAndExit) {
                await window.leaveRoomAndExit();
            } else {
                if (gameClient) gameClient.leaveRoom();
                window.location.href = 'lobby.html';
            }
        }
    });

    window.leaveRoomAndExit = async function() {
        try {
            const token = localStorage.getItem('token');
            const targetId = roomData?.id || roomCode;
            if (gameClient) {
                gameClient.leaveRoom();
            }
            if (token && targetId && targetId !== 'LOCAL' && targetId !== 'TESTWIN') {
                await fetch(`/api/rooms/${targetId}/leave`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
        } catch (e) {
            console.warn('leaveRoom error:', e);
        }
        window.location.href = 'lobby.html';
    };

    // Settings Modal close events
    closeSettingsBtn?.addEventListener('click', () => {
        settingsModal?.classList.add('hidden');
    });
    closeSettingsOk?.addEventListener('click', () => {
        settingsModal?.classList.add('hidden');
    });
    settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    // Volume Slider input event
    bgmVolumeSlider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (bgmVolumeLabel) bgmVolumeLabel.textContent = `${val}%`;
        if (window.gameBGM) {
            window.gameBGM.setVolume(val / 100);
        }
    });

    // Static Camera View & Rotation Lock Controls
    const menuBtnStaticCam = document.getElementById('menu-btn-static-cam');
    const btnStaticCamera = document.getElementById('btn-static-camera');
    const btnLockRotation = document.getElementById('btn-lock-rotation');
    let isRotationLocked = false;

    const setStaticCameraView = () => {
        const isMobile = window.innerWidth <= 768;
        const targetPos = isMobile
            ? new THREE.Vector3(0, 58, 8.5)
            : new THREE.Vector3(0, 36.5, 6.0);
        const targetLook = isMobile
            ? new THREE.Vector3(0, 0, -2.0)
            : new THREE.Vector3(0, 0, 0);

        smoothMoveCamera(targetPos, targetLook, 700);
        showTurnToast('Đã chuyển sang Camera Tĩnh (Bao quát toàn bộ bản đồ)');
    };

    menuBtnStaticCam?.addEventListener('click', () => {
        gameMenuDropdown?.classList.add('hidden');
        setStaticCameraView();
    });

    btnStaticCamera?.addEventListener('click', () => {
        setStaticCameraView();
    });

    // Reset Camera button in Settings
    btnResetCamera?.addEventListener('click', () => {
        const targetPos = new THREE.Vector3(0, 16.5, 23.5);
        const targetLook = new THREE.Vector3(0, 0, 0);
        smoothMoveCamera(targetPos, targetLook, 700);
        showTurnToast('Đã đặt lại Góc nhìn 3D mặc định');
    });

    // Lock Rotation button in Settings
    btnLockRotation?.addEventListener('click', () => {
        isRotationLocked = !isRotationLocked;
        if (controls) {
            controls.enableRotate = !isRotationLocked;
        }
        if (btnLockRotation) {
            if (isRotationLocked) {
                btnLockRotation.innerHTML = `<span style="color:#4ade80; font-weight:800;">Đã Khóa</span>`;
                btnLockRotation.classList.add('btn-primary');
                btnLockRotation.classList.remove('btn-ghost');
                showTurnToast('Đã khóa xoay bàn cờ (Chế độ tĩnh cố định)');
            } else {
                btnLockRotation.innerHTML = `<span>Đang Mở</span>`;
                btnLockRotation.classList.remove('btn-primary');
                btnLockRotation.classList.add('btn-ghost');
                showTurnToast('Đã mở khóa xoay bàn cờ');
            }
        }
    });

    // In-Game Rules / Guide Modal
    const rulesModal = document.getElementById('rules-modal');
    const rulesBtn = document.getElementById('game-rules-btn');
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
        // If typing in input / textarea / select, ignore game shortcuts
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
            return;
        }

        if (e.key === 'Escape') {
            gameMenuDropdown?.classList.add('hidden');
            if (settingsModal && !settingsModal.classList.contains('hidden')) {
                settingsModal.classList.add('hidden');
            }
            if (rulesModal && !rulesModal.classList.contains('hidden')) {
                rulesModal.classList.add('hidden');
            }
            const confirmModal = document.getElementById('confirm-build-modal');
            if (confirmModal && !confirmModal.classList.contains('hidden')) {
                confirmModal.classList.add('hidden');
            }
            const tradeModal = document.getElementById('trade-modal');
            if (tradeModal && !tradeModal.classList.contains('hidden')) {
                tradeModal.classList.add('hidden');
            }
            const devCardsModal = document.getElementById('dev-cards-modal');
            if (devCardsModal && !devCardsModal.classList.contains('hidden')) {
                devCardsModal.classList.add('hidden');
            }
            const cardInspectModal = document.getElementById('card-inspect-modal');
            if (cardInspectModal && !cardInspectModal.classList.contains('hidden')) {
                cardInspectModal.classList.add('hidden');
            }
            // Cancel current build mode if active
            if (currentBuildMode) {
                currentBuildMode = null;
                syncHighlights();
                updateHUD();
                showTurnToast('Đã hủy chế độ xây dựng.');
            }
            return;
        }

        // Space / Enter: Roll dice (Phase.ROLL) or End Turn (Phase.BUILD)
        if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            const isMyTurn = (gameState && gameState.currentPlayerIndex === myPlayerIndex);
            if (!isMyTurn || isGamePaused) return;

            if (gameState.phase === Phase.ROLL) {
                const rollBtn = document.getElementById('btn-roll');
                if (rollBtn && rollBtn.dataset.enabled === 'true') {
                    rollBtn.click();
                }
            } else if (gameState.phase === Phase.BUILD) {
                const endBtn = document.getElementById('btn-end-turn');
                if (endBtn && endBtn.dataset.enabled === 'true') {
                    endBtn.click();
                }
            }
            return;
        }

        const isMyTurn = (gameState && gameState.currentPlayerIndex === myPlayerIndex);
        if (!isMyTurn || isGamePaused || gameState?.phase !== Phase.BUILD) return;

        // Build shortcuts: R / 1 (Road), B / 2 (Ship), S / 3 (Settlement), C / 4 (City)
        const keyLower = e.key.toLowerCase();
        if (keyLower === 'r' || e.key === '1') {
            e.preventDefault();
            document.getElementById('btn-road')?.click();
        } else if (keyLower === 'b' || e.key === '2') {
            e.preventDefault();
            document.getElementById('btn-ship')?.click();
        } else if (keyLower === 's' || e.key === '3') {
            e.preventDefault();
            document.getElementById('btn-settlement')?.click();
        } else if (keyLower === 'c' || e.key === '4') {
            e.preventDefault();
            document.getElementById('btn-city')?.click();
        } else if (keyLower === 't') {
            e.preventDefault();
            document.getElementById('btn-trade')?.click();
        } else if (keyLower === 'd') {
            e.preventDefault();
            document.getElementById('btn-dev-view')?.click();
        }
    });

    // Rules category navigation & scrollspy
    const navBtns = rulesModal ? rulesModal.querySelectorAll('.rules-nav-btn') : [];
    const rulesBody = document.getElementById('rules-body');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl && rulesBody) {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

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

    rulesBody?.addEventListener('scroll', () => {
        const sections = rulesBody.querySelectorAll('.rules-section');
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
                        b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    } else if (!isActive) {
                        b.classList.remove('active');
                    }
                });
            }
        });
    });
}

// ─── CARD DETAILS & RECIPES COMPENDIUM ───────────────────────────────────────
const CARD_DETAILS = {
    'LUMBER': {
        name: 'Gỗ Rừng (Lumber)',
        icon: '',
        img: 'assets/cards/card_lumber.png',
        source: 'Khai thác từ ô Rừng (Forest Hex)',
        lore: 'Tài nguyên nền móng của vương quốc Eldora. Dùng để ghép ván đóng tàu viễn chinh và mở những con đường xuyên đảo.',
        themeColor: '#4ade80',
        recipes: [
            { name: 'Xây Đường Bộ', cost: '1 Gỗ + 1 Gạch', desc: 'Kết nối các khu định cư.' },
            { name: 'Đóng Tàu Biển', cost: '1 Gỗ + 1 Cừu', desc: 'Ra khơi khám phá quần đảo mới.' },
            { name: 'Xây Khu Định Cư', cost: '1 Gỗ + 1 Gạch + 1 Lúa + 1 Cừu', desc: 'Tạo lập tiền đồn mới (+1 VP).' }
        ]
    },
    'BRICK': {
        name: 'Đất Sét / Gạch Nung (Brick)',
        icon: '',
        img: 'assets/cards/card_brick.png',
        source: 'Khai thác từ Đồi Đất Sét (Hill Hex)',
        lore: 'Gạch đất nung chắc chắn, chịu được bão biển và muối mặn, là vật liệu bắt buộc để đặt nền móng và rải đường.',
        themeColor: '#f87171',
        recipes: [
            { name: 'Xây Đường Bộ', cost: '1 Gỗ + 1 Gạch', desc: 'Tạo tuyến đường thông thương.' },
            { name: 'Xây Khu Định Cư', cost: '1 Gỗ + 1 Gạch + 1 Lúa + 1 Cừu', desc: 'Mở rộng lãnh thổ (+1 VP).' }
        ]
    },
    'GRAIN': {
        name: 'Lúa Mì Vàng (Grain)',
        icon: '',
        img: 'assets/cards/card_grain.png',
        source: 'Thu hoạch từ Cánh Đồng (Field Hex)',
        lore: 'Lương thực nuôi sống dân cư và thợ xây. Cần thiết để phát triển định cư, nâng cấp thành phố và chiêu mộ thẻ phát triển.',
        themeColor: '#facc15',
        recipes: [
            { name: 'Xây Khu Định Cư', cost: '1 Gỗ + 1 Gạch + 1 Lúa + 1 Cừu', desc: 'Tạo lập tiền đồn mới (+1 VP).' },
            { name: 'Lên Thành Phố', cost: '2 Lúa + 3 Quặng', desc: 'Nhân đôi sản lượng thu hoạch (+2 VP).' },
            { name: 'Mua Thẻ Phát Triển', cost: '1 Lúa + 1 Cừu + 1 Quặng', desc: 'Chiêu mộ Hiệp Sĩ và quyền năng đặc biệt.' }
        ]
    },
    'WOOL': {
        name: 'Lông Cừu (Wool)',
        icon: '',
        img: 'assets/cards/card_wool.png',
        source: 'Thu hoạch từ Đồng Cỏ (Pasture Hex)',
        lore: 'Len cừu mềm mại dùng làm buồm đón gió vượt đại dương và quần áo ấm cho các nhà thám hiểm Eldora.',
        themeColor: '#a3e635',
        recipes: [
            { name: 'Đóng Tàu Biển', cost: '1 Gỗ + 1 Cừu', desc: 'Thám hiểm và mở rộng hải lộ.' },
            { name: 'Xây Khu Định Cư', cost: '1 Gỗ + 1 Gạch + 1 Lúa + 1 Cừu', desc: 'Tạo lập tiền đồn mới (+1 VP).' },
            { name: 'Mua Thẻ Phát Triển', cost: '1 Lúa + 1 Cừu + 1 Quặng', desc: 'Nhận thẻ bài chiến thuật ẩn.' }
        ]
    },
    'ORE': {
        name: 'Quặng Sắt Đá (Ore)',
        icon: '',
        img: 'assets/cards/card_ore.png',
        source: 'Khai thác từ Dãy Núi Quặng (Mountain Hex)',
        lore: 'Kim loại nặng quý giá nhất vùng biển. Được tinh luyện để đúc giáp cho Hiệp Sĩ và nâng cấp các đại đô thị kỳ vĩ.',
        themeColor: '#94a3b8',
        recipes: [
            { name: 'Lên Thành Phố', cost: '2 Lúa + 3 Quặng', desc: 'Nâng cấp từ Khu định cư (+2 VP).' },
            { name: 'Mua Thẻ Phát Triển', cost: '1 Lúa + 1 Cừu + 1 Quặng', desc: 'Tạo đột biến sức mạnh.' }
        ]
    },
    'GOLD': {
        name: 'Vàng Sa Khoáng (Gold)',
        icon: '',
        img: 'assets/cards/card_gold.png',
        source: 'Đãi vàng từ Dòng Sông Vàng (Gold Field Hex)',
        lore: 'Tài nguyên quyền năng tối thượng! Khi đổ trúng số của Mỏ Vàng, bạn được chọn đổi thành bất kỳ loại tài nguyên nào bạn muốn.',
        themeColor: '#fbbf24',
        recipes: [
            { name: 'Quyền Năng Vạn Năng', cost: '1 Vàng', desc: 'Tự do chọn 1 tài nguyên bất kỳ trong kho.' }
        ]
    }
};

window.__inspectCard = (resType) => {
    const modal = document.getElementById('card-inspect-modal');
    const titleEl = document.getElementById('card-inspect-title');
    const bodyEl = document.getElementById('card-inspect-body');
    const actionBtn = document.getElementById('btn-card-inspect-action');
    if (!modal || !bodyEl) return;

    const data = CARD_DETAILS[resType] || {
        name: resType,
        icon: '',
        img: `assets/cards/card_${resType.toLowerCase()}.png`,
        source: 'Tài nguyên Eldora',
        lore: 'Thẻ tài nguyên quý giá trong trận đấu.',
        themeColor: 'var(--gold)',
        recipes: []
    };

    const myPlayer = gameState?.players[myPlayerIndex];
    const currentCount = myPlayer?.resources[resType] || 0;

    titleEl.innerHTML = `
        <span style="color:${data.themeColor}; font-weight:900;">${data.name}</span>
    `;

    const recipesHtml = data.recipes.map(r => `
        <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.1); padding:8px 12px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div>
                <div style="font-weight:700; color:#fff; font-size:0.88rem;">${r.name}</div>
                <div style="font-size:0.75rem; color:#85e3ff;">${r.desc}</div>
            </div>
            <div style="background:rgba(255,215,0,0.15); border:1px solid var(--gold); padding:2px 8px; font-size:0.78rem; font-weight:700; color:var(--gold); white-space:nowrap;">
                ${r.cost}
            </div>
        </div>
    `).join('');

    bodyEl.innerHTML = `
        <div style="display:flex; gap:18px; align-items:flex-start; margin-bottom:14px; flex-wrap:wrap;">
            <div style="flex:0 0 170px; margin:0 auto; text-align:center;">
                <div style="position:relative; display:inline-block; border-radius:10px; overflow:hidden; box-shadow:0 12px 30px rgba(0,0,0,0.8), 0 0 20px ${data.themeColor}55; border:2px solid ${data.themeColor};">
                    <img src="${data.img}" alt="${data.name}" style="width:170px; height:255px; object-fit:cover; display:block; transition:transform 0.3s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='none'">
                    <div style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.85); color:#ffd700; border:1px solid #ffd700; padding:2px 8px; border-radius:4px; font-weight:900; font-size:0.9rem; box-shadow:0 2px 6px rgba(0,0,0,0.6);">
                        x${currentCount}
                    </div>
                </div>
                <div style="font-size:0.72rem; color:#85e3ff; margin-top:6px; font-weight:600;">Thẻ chính thức Eldora</div>
            </div>
            <div style="flex:1 1 240px; min-width:220px;">
                <div style="background:linear-gradient(135deg, rgba(0,0,0,0.45), rgba(0,0,0,0.25)); border:1.5px solid ${data.themeColor}55; padding:12px 14px; margin-bottom:12px;">
                    <div style="font-size:0.75rem; color:#85e3ff; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">${data.source}</div>
                    <div style="font-size:1.35rem; font-weight:900; color:#fff; margin-top:2px;">
                        Số lượng trong tay: <span style="color:${data.themeColor};">${currentCount} Thẻ</span>
                    </div>
                    <div style="font-size:0.82rem; color:#d1e4ff; margin-top:6px; font-style:italic; line-height:1.45;">
                        "${data.lore}"
                    </div>
                </div>

                <div style="font-size:0.82rem; font-weight:800; color:var(--gold); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
                    Công Thức Chế Tạo Có Sử Dụng Thẻ Này:
                </div>
                <div>${recipesHtml}</div>
            </div>
        </div>
    `;

    if (actionBtn) {
        actionBtn.style.display = (currentCount >= 4) ? 'inline-block' : 'none';
        actionBtn.textContent = `Đổi 4 ${data.name.split(' ')[0]} lấy 1 thẻ khác`;
        actionBtn.onclick = () => {
            modal.classList.add('hidden');
            const tradeBtn = document.getElementById('btn-trade');
            tradeBtn?.click();
        };
    }

    modal.classList.remove('hidden');
};

// ─── DEVELOPMENT CARD DETAILS & COMPENDIUM ────────────────────────────────────
const DEV_CARD_METADATA = {
    'KNIGHT': {
        name: 'Hiệp Sĩ',
        sub: 'Knight',
        icon: '',
        img: 'assets/cards/card_knight.png',
        theme: '#60a5fa',
        desc: 'Khi chơi thẻ này, hãy di chuyển tên cướp và rút 1 thẻ tài nguyên từ một người chơi có công trình trên ô này. Tích lũy 3 Hiệp Sĩ để chiếm danh hiệu Đội Quân Lớn Nhất (+2 VP)!'
    },
    'YEAR_OF_PLENTY': {
        name: 'Phát Minh',
        sub: 'Invention / Year of Plenty',
        icon: '',
        img: 'assets/cards/card_year_of_plenty.png',
        theme: '#f59e0b',
        desc: 'Khi chơi thẻ này, bạn được lấy ngay 2 thẻ tài nguyên bất kỳ từ nguồn cung cấp mà không tốn chi phí nào. Giúp xoay chuyển tình thế ngay lập tức!'
    },
    'ROAD_BUILDING': {
        name: 'Xây Đường',
        sub: 'Road Building',
        icon: '',
        img: 'assets/cards/card_road_building.png',
        theme: '#4ade80',
        desc: 'Khi chơi thẻ này, bạn được phép xây miễn phí 2 đoạn đường bộ hoặc 2 tàu biển ngay lập tức. Đẩy nhanh cơ hội chiếm Con Đường Dài Nhất (+2 VP)!'
    },
    'MONOPOLY': {
        name: 'Độc Quyền',
        sub: 'Monopoly',
        icon: '',
        img: 'assets/cards/card_monopoly.png',
        theme: '#c084fc',
        desc: 'Khi chơi thẻ này, bạn chọn 1 loại tài nguyên. Tất cả người chơi khác buộc phải đưa cho bạn toàn bộ số thẻ tài nguyên đó mà họ đang sở hữu!'
    },
    'VP': {
        name: 'Điểm Chiến Thắng',
        sub: 'Victory Point',
        icon: '',
        img: 'assets/cards/card_victory_point.png',
        theme: '#fbbf24',
        desc: 'Kỳ quan cổ xưa bí mật! Cộng trực tiếp +1 Điểm Chiến Thắng ẩn. Thẻ này luôn được giữ kín cho đến khi bạn đủ 10 điểm để tuyên bố thắng trận!'
    }
};

window.__inspectDevCard = (cardType) => {
    const modal = document.getElementById('card-inspect-modal');
    const titleEl = document.getElementById('card-inspect-title');
    const bodyEl = document.getElementById('card-inspect-body');
    const actionBtn = document.getElementById('btn-card-inspect-action');
    if (!modal || !bodyEl) return;

    const info = DEV_CARD_METADATA[cardType] || {
        name: cardType,
        sub: 'Development Card',
        icon: '',
        img: 'assets/cards/card_knight.png',
        theme: 'var(--gold)',
        desc: 'Thẻ phát triển Catan huyền thoại.'
    };

    const myPlayer = gameState?.players[myPlayerIndex];
    const matchingCards = (myPlayer?.devCards || []).filter(c => c.type === cardType && !c.played);
    const currentCount = matchingCards.length;
    const canPlay = matchingCards.some(c => !c.newThisTurn) && !gameState.devCardPlayedThisTurn && (
        gameState.currentPlayerIndex === myPlayerIndex
    ) && (
        gameState.phase === Phase.BUILD || (gameState.phase === Phase.ROLL && cardType === 'KNIGHT')
    );

    titleEl.innerHTML = `
        
        <span style="color:${info.theme}; font-weight:900;">${info.name}</span>
        <span style="font-size:0.85rem; color:#85e3ff; font-weight:normal; margin-left:6px;">(${info.sub})</span>
    `;

    bodyEl.innerHTML = `
        <div style="display:flex; gap:18px; align-items:flex-start; margin-bottom:14px; flex-wrap:wrap;">
            <div style="flex:0 0 170px; margin:0 auto; text-align:center;">
                <div style="position:relative; display:inline-block; border-radius:10px; overflow:hidden; box-shadow:0 12px 30px rgba(0,0,0,0.8), 0 0 20px ${info.theme}66; border:2px solid ${info.theme};">
                    <img src="${info.img}" alt="${info.name}" style="width:170px; height:255px; object-fit:cover; display:block; transition:transform 0.3s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='none'">
                    ${currentCount > 0 ? `
                        <div style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.85); color:#ffd700; border:1px solid #ffd700; padding:2px 8px; border-radius:4px; font-weight:900; font-size:0.9rem; box-shadow:0 2px 6px rgba(0,0,0,0.6);">
                            x${currentCount}
                        </div>
                    ` : ''}
                </div>
                <div style="font-size:0.72rem; color:#85e3ff; margin-top:6px; font-weight:600;">Thẻ Phát Triển Eldora</div>
            </div>
            <div style="flex:1 1 240px; min-width:220px;">
                <div style="background:linear-gradient(135deg, rgba(0,0,0,0.45), rgba(0,0,0,0.25)); border:1.5px solid ${info.theme}55; padding:12px 14px; margin-bottom:12px;">
                    <div style="font-size:0.75rem; color:#85e3ff; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Hạng mục: Thẻ Bài Chiến Thuật</div>
                    <div style="font-size:1.35rem; font-weight:900; color:#fff; margin-top:2px;">
                        Số lượng trong tay: <span style="color:${info.theme};">${currentCount} Thẻ</span>
                    </div>
                    <div style="font-size:0.86rem; color:#d1e4ff; margin-top:8px; line-height:1.5;">
                        "${info.desc}"
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.1); padding:10px 12px; font-size:0.8rem; color:#aac4e0; line-height:1.45;">
                    <div style="font-weight:700; color:var(--gold); margin-bottom:4px;">Quy Tắc Đánh Thẻ (Chuẩn Catan):</div>
                    • Mỗi lượt chỉ được đánh tối đa 1 Thẻ Phát Triển.<br>
                    • Không thể đánh thẻ vừa mua trong cùng một lượt.<br>
                    • Thẻ Điểm Chiến Thắng (VP) luôn được giữ bí mật và tự động tính điểm khi đủ điều kiện thắng.
                </div>
            </div>
        </div>
    `;

    if (actionBtn) {
        if (cardType === 'VP') {
            actionBtn.style.display = 'inline-block';
            actionBtn.textContent = '⭐ Điểm Thắng Tự Động Tính (+1 VP)';
            actionBtn.disabled = true;
            actionBtn.onclick = null;
        } else if (canPlay) {
            actionBtn.style.display = 'inline-block';
            actionBtn.textContent = `✨ Đánh Thẻ ${info.name} Ngay`;
            actionBtn.disabled = false;
            actionBtn.onclick = () => {
                modal.classList.add('hidden');
                window.__playDevCard(cardType);
            };
        } else {
            actionBtn.style.display = 'none';
        }
    }

    modal.classList.remove('hidden');
};

// ─── OFFICIAL CATAN PUBLIC PLAYER STATS DOSSIER ──────────────────────────────
window.__showPlayerStats = (playerIdx) => {
    const modal = document.getElementById('player-info-modal');
    const titleEl = document.getElementById('pinfo-title');
    const bodyEl = document.getElementById('pinfo-body');
    if (!modal || !bodyEl) return;

    const p = gameState.players[playerIdx];
    if (!p) return;

    const isMe = (playerIdx === myPlayerIndex);
    const colorHex = '#' + PLAYER_COLORS_3D[playerIdx].toString(16).padStart(6, '0');
    const unplayedDevCount = (p.devCards || []).filter(c => !c.played).length;

    const avatarUrl = getPlayerAvatarUrl(p.avatar, playerIdx);
    titleEl.innerHTML = `
        <img src="${avatarUrl}" alt="${escapeHtml(p.name)}" style="width:28px; height:28px; border-radius:50%; border:2px solid ${colorHex}; margin-right:8px; vertical-align:middle; object-fit:cover; object-position:center 12%;">
        <span>Hồ Sơ: ${escapeHtml(p.name)} ${isMe ? '(Bạn)' : ''}</span>
    `;

    // Calculate public victory point components
    const settlementVP = p.placed.settlements.length * 1;
    const cityVP = p.placed.cities.length * 2;
    const longestRoadVP = p.hasLongestRoad ? 2 : 0;
    const largestArmyVP = p.hasLargestArmy ? 2 : 0;
    const islandVP = p.discoveredIslands ? p.discoveredIslands.size : 0;
    const publicVP = p.victoryPoints;

    // Harbors controlled
    const harborsList = [];
    if (p.harborAccess) {
        if (p.harborAccess.has('GENERIC')) harborsList.push('[Cảng 3:1] Đa năng');
        if (p.harborAccess.has('LUMBER')) harborsList.push('[Cảng Gỗ 2:1]');
        if (p.harborAccess.has('BRICK')) harborsList.push('[Cảng Gạch 2:1]');
        if (p.harborAccess.has('GRAIN')) harborsList.push('[Cảng Lúa 2:1]');
        if (p.harborAccess.has('WOOL')) harborsList.push('[Cảng Cừu 2:1]');
        if (p.harborAccess.has('ORE')) harborsList.push('[Cảng Quặng 2:1]');
    }
    const harborsStr = harborsList.length > 0 ? harborsList.join(', ') : 'Chưa có cảng';

    let myHandSection = '';
    if (isMe) {
        const resList = [
            { type: 'LUMBER', name: 'Gỗ', icon: '', color: '#4ade80' },
            { type: 'BRICK',  name: 'Gạch', icon: '', color: '#f87171' },
            { type: 'GRAIN',  name: 'Lúa', icon: '', color: '#facc15' },
            { type: 'WOOL',   name: 'Cừu', icon: '', color: '#a3e635' },
            { type: 'ORE',    name: 'Quặng', icon: '', color: '#94a3b8' },
            { type: 'GOLD',   name: 'Vàng', icon: '', color: '#fbbf24' }
        ];

        const cardsHeld = resList
            .map(r => ({ ...r, count: p.resources[r.type] || 0 }))
            .filter(r => r.count > 0);

        const handCardsHtml = cardsHeld.length > 0
            ? cardsHeld.map(r => `
                <div onclick="window.__inspectCard('${r.type}')" style="cursor:pointer; background:rgba(0,0,0,0.55); border:1.5px solid ${r.color}aa; padding:6px 10px; display:inline-flex; align-items:center; gap:8px; box-shadow:0 3px 10px rgba(0,0,0,0.5); transition:all 0.18s; border-radius:4px;" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='${r.color}'" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='${r.color}aa'">
                    <img src="assets/cards/card_${r.type.toLowerCase()}.png" alt="${r.name}" style="width:24px; height:36px; object-fit:cover; border-radius:3px; border:1px solid ${r.color}; display:block;">
                    <div style="text-align:left;">
                        <div style="font-weight:700; color:#fff; font-size:0.8rem;">${r.name}</div>
                        <div style="font-weight:900; color:${r.color}; font-size:1.05rem; line-height:1;">x${r.count}</div>
                    </div>
                </div>
            `).join('')
            : '<div style="font-size:0.82rem; color:#85e3ff;">(Bạn hiện chưa có thẻ tài nguyên nào trên tay)</div>';

        const myDevCards = (p.devCards || []).filter(c => !c.played);
        const myDevCardsHtml = myDevCards.length > 0
            ? myDevCards.map(c => {
                const info = DEV_CARD_METADATA[c.type] || { name: c.type, icon: '', theme: 'var(--gold)', img: 'assets/cards/card_knight.png' };
                return `
                    <div onclick="document.getElementById('player-info-modal')?.classList.add('hidden'); window.__inspectDevCard('${c.type}');" style="cursor:pointer; background:rgba(0,0,0,0.55); border:1.5px solid ${info.theme}aa; padding:6px 10px; display:inline-flex; align-items:center; gap:8px; box-shadow:0 3px 10px rgba(0,0,0,0.5); transition:all 0.18s; border-radius:4px;" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='${info.theme}'" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='${info.theme}aa'">
                        <img src="${info.img}" alt="${info.name}" style="width:24px; height:36px; object-fit:cover; border-radius:3px; border:1px solid ${info.theme}; display:block;">
                        <div style="text-align:left;">
                            <div style="font-weight:700; color:#fff; font-size:0.8rem;">${info.name}</div>
                            <div style="font-size:0.7rem; color:${info.theme};">${c.newThisTurn ? '⏳ Mới mua' : '✨ Có thể dùng'}</div>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div style="font-size:0.82rem; color:#85e3ff;">(Bạn chưa sở hữu thẻ phát triển nào trên tay)</div>';

        myHandSection = `
            <div style="background:linear-gradient(135deg, rgba(20,50,80,0.6), rgba(10,25,45,0.8)); border:1.5px solid rgba(255,215,0,0.4); padding:12px; margin-bottom:12px;">
                <div style="font-size:0.85rem; font-weight:800; color:var(--gold); display:flex; justify-content:space-between; align-items:center;">
                    <span>Thẻ Tài Nguyên Của Bạn (${p.totalResources()} Thẻ):</span>
                    <span style="font-size:0.75rem; color:#85e3ff; font-weight:normal;">Chạm vào thẻ để xem chi tiết & công thức</span>
                </div>
                <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                    ${handCardsHtml}
                </div>
            </div>

            <div style="background:linear-gradient(135deg, rgba(30,35,65,0.6), rgba(15,20,38,0.8)); border:1.5px solid rgba(96,165,250,0.4); padding:12px; margin-bottom:12px;">
                <div style="font-size:0.85rem; font-weight:800; color:#85e3ff; display:flex; justify-content:space-between; align-items:center;">
                    <span>Thẻ Phát Triển Của Bạn (${myDevCards.length} Thẻ):</span>
                    <span style="font-size:0.75rem; color:#85e3ff; font-weight:normal;">Chạm vào thẻ để xem quyền năng & đánh thẻ</span>
                </div>
                <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                    ${myDevCardsHtml}
                </div>
            </div>
        `;
    }

    bodyEl.innerHTML = `
        <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:var(--gold); font-size:1.05rem;">Điểm Chiến Thắng Công Khai:</span>
                <span style="font-size:1.3rem; font-weight:bold; color:var(--gold);">${publicVP} VP ${isMe && p.hiddenVP > 0 ? `<span style="font-size:0.85rem; color:#85e3ff;">(+${p.hiddenVP} điểm ẩn)</span>` : ''}</span>
            </div>
            <div style="font-size:0.8rem; color:#aac4e0; margin-top:8px; line-height:1.6;">
                • Khu định cư trên bàn: <b>${p.placed.settlements.length}</b> (x1 VP = ${settlementVP} VP)<br>
                • Thành phố trên bàn: <b>${p.placed.cities.length}</b> (x2 VP = ${cityVP} VP)<br>
                • Danh hiệu Con Đường Dài Nhất: ${p.hasLongestRoad ? '<b style="color:var(--gold)">+2 VP [Đường Dài]</b>' : 'Không có'}<br>
                • Danh hiệu Đội Quân Mạnh Nhất: ${p.hasLargestArmy ? '<b style="color:var(--gold)">+2 VP [Đại Quân]</b>' : 'Không có'}<br>
                • Khám phá đảo biển (Seafarers): +${islandVP} VP
            </div>
        </div>

        ${myHandSection}

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
            <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:8px; padding:10px;">
                <div style="font-size:0.8rem; color:var(--text-muted);">Thẻ bài trên tay:</div>
                <div style="font-size:1.25rem; font-weight:bold; color:#fff; margin-top:2px;">${p.totalResources()} Thẻ</div>
                <div style="font-size:0.75rem; color:#85e3ff; margin-top:4px;">(Công khai số lượng, bí mật loại thẻ)</div>
            </div>
            <div onclick="document.getElementById('player-info-modal')?.classList.add('hidden'); document.getElementById('btn-dev-view')?.click();" style="cursor:pointer; background:rgba(0,0,0,0.25); border:1px solid var(--gold); border-radius:8px; padding:10px; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,215,0,0.1)'" onmouseout="this.style.background='rgba(0,0,0,0.25)'">
                <div style="font-size:0.8rem; color:var(--gold); font-weight:700;">Thẻ phát triển chưa đánh:</div>
                <div style="font-size:1.25rem; font-weight:bold; color:#fff; margin-top:2px;">${unplayedDevCount} Thẻ</div>
                <div style="font-size:0.75rem; color:#ffe082; margin-top:4px;">Bấm để mở & đánh thẻ ➔</div>
            </div>
        </div>

        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:12px;">
            <div style="font-size:0.85rem; font-weight:bold; color:var(--gold); margin-bottom:6px;">Quân cờ còn lại trong kho dự trữ:</div>
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#fff;">
                <span>Định cư: <b>${p.stock.settlements}/5</b></span>
                <span>Thành phố: <b>${p.stock.cities}/4</b></span>
                <span>Đường: <b>${p.stock.roads}/15</b></span>
                <span>Tàu: <b>${p.stock.ships}/15</b></span>
            </div>
        </div>

        <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div style="font-size:0.85rem; font-weight:bold; color:var(--gold); margin-bottom:4px;">Quyền ưu đãi Cảng Biển:</div>
            <div style="font-size:0.85rem; color:#fff;">${harborsStr}</div>
        </div>
    `;

    modal.classList.remove('hidden');
};

function renderDevCardsModal() {
    const listEl = document.getElementById('dev-cards-list');
    if (!listEl) return;

    const myPlayer = gameState.players[myPlayerIndex];
    const devCards = (myPlayer?.devCards || []).filter(c => !c.played);

    if (devCards.length === 0) {
        const showcaseHtml = Object.entries(DEV_CARD_METADATA).map(([typeKey, c]) => `
            <div onclick="window.__inspectDevCard('${typeKey}')" style="cursor:pointer; background:rgba(0,0,0,0.45); border:1.5px solid ${c.theme}88; border-radius:8px; padding:8px; text-align:center; transition:all 0.22s;" onmouseover="this.style.transform='translateY(-5px) scale(1.03)'; this.style.borderColor='${c.theme}'" onmouseout="this.style.transform='none'; this.style.borderColor='${c.theme}88'">
                <div style="position:relative; aspect-ratio:2/3; overflow:hidden; border-radius:6px; box-shadow:0 6px 14px rgba(0,0,0,0.6); border:1px solid ${c.theme}66;">
                    <img src="${c.img}" alt="${c.name}" style="width:100%; height:100%; object-fit:cover; display:block;">
                </div>
                <div style="font-weight:800; color:${c.theme}; font-size:0.82rem; margin-top:6px;">${c.icon} ${c.name}</div>
                <div style="font-size:0.68rem; color:#85e3ff;">Chạm xem quyền năng</div>
            </div>
        `).join('');

        listEl.innerHTML = `
            <div style="text-align:center; padding:10px 6px 16px 6px;">
                <div style="font-size:2.8rem; margin-bottom:4px; filter:drop-shadow(0 4px 12px rgba(255,215,0,0.4));">🃏</div>
                <div style="font-weight:900; color:#fff; font-size:1.15rem;">Bạn Chưa Sở Hữu Thẻ Phát Triển Nào</div>
                <div style="font-size:0.85rem; color:#aac4e0; margin-top:4px; max-width:440px; margin-left:auto; margin-right:auto; line-height:1.5;">
                    Thẻ phát triển sở hữu quyền năng lật ngược thế trận. Hãy mua thẻ từ kho bài bằng <b>1 Lúa + 1 Cừu + 1 Quặng</b>!
                </div>
                <div style="margin-top:14px;">
                    <button class="btn btn-primary" onclick="document.getElementById('dev-modal')?.classList.add('hidden'); document.getElementById('btn-dev-buy')?.click();" style="padding:10px 24px; font-weight:800; font-size:0.95rem; box-shadow:0 4px 15px rgba(240,192,64,0.4);">
                        Mua Thẻ Phát Triển Ngay
                    </button>
                </div>
            </div>
            <div style="border-top:1px solid rgba(255,215,0,0.25); padding-top:14px; margin-top:8px;">
                <div style="font-size:0.82rem; font-weight:800; color:var(--gold); text-transform:uppercase; margin-bottom:10px; letter-spacing:0.5px;">Sổ Tay 5 Loại Thẻ Phát Triển Eldora (Chạm để xem chi tiết):</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(105px, 1fr)); gap:10px;">
                    ${showcaseHtml}
                </div>
            </div>
        `;
        return;
    }

    const isMyTurn = (gameState.currentPlayerIndex === myPlayerIndex);

    listEl.innerHTML = `
        <div style="font-size:0.8rem; color:#85e3ff; margin-bottom:10px;">
            Chạm vào thẻ bất kỳ để xem chi tiết.
        </div>
        <div class="tarot-cards-grid">
            ${devCards.map((card, idx) => {
                const info = DEV_CARD_METADATA[card.type] || { name: card.type, sub: '', icon: '', theme: 'var(--gold)', img: 'assets/cards/card_knight.png', desc: '' };
                const isNew = card.newThisTurn;
                let actionBtn = '';

                const canPlayThisCard = isMyTurn && !gameState.devCardPlayedThisTurn && !isNew && (
                    gameState.phase === Phase.BUILD || (gameState.phase === Phase.ROLL && card.type === 'KNIGHT')
                );

                if (card.type === 'VP') {
                    actionBtn = '<div style="color:var(--gold); font-size:0.85rem; font-weight:800; text-align:center; padding:6px; background:rgba(255,215,0,0.1); border:1px solid var(--gold);">Đang cộng +1 VP Ẩn</div>';
                } else if (isNew) {
                    actionBtn = '<div style="color:#85e3ff; font-size:0.78rem; text-align:center; padding:6px; background:rgba(0,0,0,0.35); border:1px dashed #85e3ff55;">Vừa mua (Dùng ở lượt sau)</div>';
                } else if (gameState.devCardPlayedThisTurn) {
                    actionBtn = '<div style="color:var(--text-muted); font-size:0.78rem; text-align:center; padding:6px; background:rgba(0,0,0,0.25);">Đã đánh 1 thẻ lượt này</div>';
                } else if (!isMyTurn) {
                    actionBtn = '<div style="color:var(--text-muted); font-size:0.78rem; text-align:center; padding:6px; background:rgba(0,0,0,0.25);">Chưa đến lượt của bạn</div>';
                } else if (!canPlayThisCard) {
                    actionBtn = '<div style="color:var(--text-muted); font-size:0.78rem; text-align:center; padding:6px; background:rgba(0,0,0,0.25);">Chỉ dùng trong giai đoạn xây dựng</div>';
                } else {
                    actionBtn = `<button class="btn btn-primary" onclick="window.__playDevCard('${card.type}')" style="width:100%; padding:8px; font-weight:800; font-size:0.92rem; box-shadow:0 0 15px rgba(255,215,0,0.5);">✨ Đánh Thẻ Này Ngay</button>`;
                }

                return `
                    <div class="tarot-card" style="border-color:${info.theme};">
                        <div onclick="window.__inspectDevCard('${card.type}')" style="cursor:pointer; position:relative; aspect-ratio:2/3; overflow:hidden; border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,0.6); border:1.5px solid ${info.theme};">
                            <img src="${info.img}" alt="${info.name}" style="width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.3s ease;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='none'">
                            <div style="position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.8); border:1px solid ${info.theme}; border-radius:4px; padding:2px 6px; font-size:0.72rem; color:#fff; font-weight:700;">
                                ${info.icon} ${info.name}
                            </div>
                            <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,0.85), transparent); padding:10px 6px 4px 6px; text-align:center; font-size:0.7rem; color:#85e3ff;">
                                Xem chi tiết
                            </div>
                        </div>
                        <div style="margin-top:10px;">${actionBtn}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

window.__playDevCard = (type) => {
    const devModal = document.getElementById('dev-modal');
    devModal?.classList.add('hidden');

    if (type === 'KNIGHT') {
        performAction({ type: 'play_dev', cardType: 'KNIGHT' });
    } else if (type === 'YEAR_OF_PLENTY') {
        const resChoice = prompt('Nhập tên tài nguyên thứ 1 (LUMBER, BRICK, GRAIN, WOOL, ORE):', 'GRAIN')?.trim().toUpperCase();
        const resChoice2 = prompt('Nhập tên tài nguyên thứ 2 (LUMBER, BRICK, GRAIN, WOOL, ORE):', 'ORE')?.trim().toUpperCase();
        if (resChoice && resChoice2) {
            const resources = {};
            resources[resChoice] = (resources[resChoice] || 0) + 1;
            resources[resChoice2] = (resources[resChoice2] || 0) + 1;
            performAction({ type: 'play_dev', cardType: 'YEAR_OF_PLENTY', options: { resources } });
        }
    } else if (type === 'MONOPOLY') {
        const res = prompt('Chọn loại tài nguyên muốn Độc Quyền (LUMBER, BRICK, GRAIN, WOOL, ORE):', 'GRAIN')?.trim().toUpperCase();
        if (res) {
            performAction({ type: 'play_dev', cardType: 'MONOPOLY', options: { resource: res } });
        }
    } else if (type === 'ROAD_BUILDING') {
        // Place up to 2 valid roads/ships automatically
        const validR = gameState.getValidRoadEdges(false);
        const validS = gameState.getValidShipEdges(false);
        const all = [...validR, ...validS];
        if (all.length > 0) {
            performAction({ type: 'play_dev', cardType: 'ROAD_BUILDING', options: { edges: all.slice(0, 2) } });
        } else {
            alert('Không có vị trí hợp lệ để đặt đường/tàu!');
        }
    }
};

function setupBuildBtn(id, mode, label, costStr) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
        const isMyTurn = (gameState.currentPlayerIndex === myPlayerIndex);
        if (!isMyTurn) {
            const cpName = gameState.currentPlayer?.name || 'Đối thủ';
            showTurnToast(`⏳ Chưa đến lượt của bạn! Đang chờ <strong>${escapeHtml(cpName)}</strong> đi lượt.`);
            return;
        }
        if (gameState.phase === Phase.SETUP_SETTLEMENT || gameState.phase === Phase.SETUP_ROAD) {
            showTurnToast(`Đang trong giai đoạn SETUP ban đầu! Hãy nhấp vào các điểm tròn/cạnh màu vàng trên bàn cờ.`);
            return;
        }
        if (gameState.phase === Phase.ROLL) {
            showTurnToast(`Hãy bấm "Đổ xúc xắc" trước khi bắt đầu xây dựng!`);
            return;
        }
        if (gameState.phase !== Phase.BUILD) {
            showTurnToast(`Không thể xây dựng trong giai đoạn này (${gameState.phase})!`);
            return;
        }
        if (btn.dataset.enabled !== 'true') {
            showTurnToast(`Không đủ tài nguyên để xây <strong>${label}</strong>! (Cần: ${costStr})`);
            return;
        }
        currentBuildMode = (currentBuildMode === mode) ? null : mode;
        syncAll();

        if (currentBuildMode === 'ship') {
            const valid = gameState.getValidShipEdges(false);
            if (valid.length === 0) {
                showTurnToast(`Chưa có vị trí ven biển hợp lệ! Tàu phải xuất phát từ Nhà Ven Biển hoặc nối dài từ Tàu của bạn.`);
            } else {
                showTurnToast(`Hãy nhấp vào các điểm sáng màu vàng trên mặt biển để đặt Tàu!`);
            }
        } else if (currentBuildMode === 'road') {
            const valid = gameState.getValidRoadEdges(false);
            if (valid.length === 0) {
                showTurnToast(`Không có vị trí hợp lệ để làm đường! Đường phải nối với Đường hoặc Định Cư của bạn.`);
            } else {
                showTurnToast(`Hãy nhấp vào các điểm sáng màu vàng trên đất liền để đặt Đường!`);
            }
        } else if (currentBuildMode === 'settlement') {
            const valid = gameState.getValidSettlementVertices();
            if (valid.length === 0) {
                showTurnToast(`Không có vị trí hợp lệ! Định cư phải cách các nhà khác ít nhất 2 bước và nối với đường của bạn.`);
            } else {
                showTurnToast(`Hãy nhấp vào các điểm tròn màu vàng để xây Định Cư!`);
            }
        } else if (currentBuildMode === 'city') {
            const valid = gameState.getValidCityVertices();
            if (valid.length === 0) {
                showTurnToast(`Không có Định Cư nào của bạn để nâng cấp lên Thành Phố!`);
            } else {
                showTurnToast(`Hãy nhấp vào Định Cư của bạn để nâng cấp lên Thành Phố!`);
            }
        }
    });
}

// ─── AUTOMATED BOT TURNS (AI PLAYERS) ─────────────────────────────────────────
let botActionTimer = null;

function triggerBotIfNeeded() {
    clearTimeout(botActionTimer);

    if (gameState.phase === Phase.GAME_OVER) return;

    // 1. Auto-handle STEAL phase (Human or Bot)
    if (gameState.phase === Phase.STEAL) {
        if (gameState.currentPlayerIndex === myPlayerIndex) {
            // Human player's turn to steal
            const targets = gameState.stealTargets || [];
            if (targets.length > 0) {
                const victimId = targets[0];
                const victim = gameState.players[victimId];
                let stolenResource = null;
                if (victim) {
                    const available = [];
                    for (const [r, count] of Object.entries(victim.resources)) {
                        for (let i = 0; i < count; i++) available.push(r);
                    }
                    if (available.length > 0) {
                        stolenResource = available[Math.floor(Math.random() * available.length)];
                    }
                }
                setTimeout(() => {
                    performAction({ type: 'steal', victimId, stolenResource });
                }, 400);
            } else {
                gameState.phase = Phase.BUILD;
                syncAll();
            }
            return;
        } else if (gameState.currentPlayer.isBot && myPlayerIndex === 0) {
            // Coordinator bot stealing
            const targets = gameState.stealTargets || [];
            if (targets.length > 0) {
                const victimId = targets[0];
                const victim = gameState.players[victimId];
                let stolenResource = null;
                if (victim) {
                    const available = [];
                    for (const [r, count] of Object.entries(victim.resources)) {
                        for (let i = 0; i < count; i++) available.push(r);
                    }
                    if (available.length > 0) {
                        stolenResource = available[Math.floor(Math.random() * available.length)];
                    }
                }
                botActionTimer = setTimeout(() => {
                    performAction({ type: 'steal', victimId, stolenResource });
                }, 600);
            } else {
                gameState.phase = Phase.BUILD;
                syncAll();
            }
            return;
        }
        return;
    }

    // 2. Auto-handle Discard ONLY for AI bots
    if (gameState.phase === Phase.DISCARD && gameState.discardPending && gameState.discardPending.length > 0) {
        const pid = gameState.discardPending[0];
        const playerToDiscard = gameState.players[pid];
        if (playerToDiscard && playerToDiscard.isBot && myPlayerIndex === 0) {
            const need = Math.floor(playerToDiscard.totalResources() / 2);
            const toDiscard = {};
            let count = 0;
            for (const r of ['LUMBER', 'BRICK', 'GRAIN', 'WOOL', 'ORE']) {
                const has = playerToDiscard.resources[r] || 0;
                const take = Math.min(has, need - count);
                if (take > 0) {
                    toDiscard[r] = take;
                    count += take;
                }
                if (count >= need) break;
            }
            performAction({ type: 'discard', playerId: pid, toDiscard });
        }
        return;
    }

    // 3. Auto-handle Gold Field pick
    if (gameState.phase === Phase.GOLD_PICK && gameState.goldPending && gameState.goldPending.length > 0) {
        const pending = gameState.goldPending[0];
        const p = gameState.players[pending.playerId];
        if (pending.playerId === myPlayerIndex || (p.isBot && myPlayerIndex === 0)) {
            const resChoice = (p.resources['ORE'] < 2) ? 'ORE' : 'GRAIN';
            performAction({ type: 'gold_pick', playerId: pending.playerId, choices: { [resChoice]: pending.amount } });
        }
        return;
    }

    // 4. CRITICAL: NEVER execute bot actions for human players!
    if (!gameState.currentPlayer.isBot) {
        return;
    }

    // 5. Only host (player index 0) coordinates bot moves to avoid duplicate actions
    if (myPlayerIndex !== 0) {
        return;
    }

    const botIndex = gameState.currentPlayerIndex;
    const bot = gameState.players[botIndex];

    botActionTimer = setTimeout(() => {
        // Bot Setup Settlement
        if (gameState.phase === Phase.SETUP_SETTLEMENT) {
            const valid = gameState.getValidSetupVertices();
            if (valid && valid.length > 0) {
                const choice = valid[Math.floor(Math.random() * Math.min(valid.length, 3))];
                performAction({ type: 'setup_settlement', vKey: choice });
            }
        }
        // Bot Setup Road
        else if (gameState.phase === Phase.SETUP_ROAD) {
            const roadEdges = gameState.getValidRoadEdges(true, gameState.setupSettlementVertex);
            const shipEdges = gameState.getValidShipEdges(true, gameState.setupSettlementVertex);
            if (roadEdges && roadEdges.length > 0) {
                performAction({ type: 'setup_road', eKey: roadEdges[0], roadType: 'road' });
            } else if (shipEdges && shipEdges.length > 0) {
                performAction({ type: 'setup_road', eKey: shipEdges[0], roadType: 'ship' });
            }
        }
        // Bot Roll Dice
        else if (gameState.phase === Phase.ROLL) {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            performAction({ type: 'roll', d1, d2 });
        }
        // Bot Robber Move
        else if (gameState.phase === Phase.ROBBER) {
            const allTiles = [...gameState.tiles.values()].filter(t => t.type !== TileType.SEA && t.type !== TileType.DESERT);
            if (allTiles.length > 0) {
                const pick = allTiles[Math.floor(Math.random() * allTiles.length)];
                performAction({ type: 'robber', q: pick.q, r: pick.r });
            }
        }
        // Bot Build Phase
        else if (gameState.phase === Phase.BUILD) {
            if (bot.canAfford(BUILD_COST.settlement)) {
                const validV = gameState.getValidSettlementVertices();
                if (validV.length > 0) {
                    performAction({ type: 'build_settlement', vKey: validV[0] });
                    return;
                }
            }
            if (bot.canAfford(BUILD_COST.road)) {
                const validE = gameState.getValidRoadEdges(false);
                if (validE.length > 0) {
                    performAction({ type: 'build_road', eKey: validE[0] });
                    return;
                }
            }
            performAction({ type: 'end_turn' });
        }
    }, 1100);
}

// ─── CHECK WIN CONDITION & 3D VICTORY CELEBRATION ────────────────────────────
function showVictoryCelebration(winner) {
    clearSavedGameProgress();
    const winModal = document.getElementById('win-modal');
    const winTitle = document.getElementById('win-title');
    const winDesc = document.getElementById('win-desc');
    if (!winModal) return;

    const winnerName = winner ? (winner.name || 'Người chơi') : 'Quán Quân';
    const vp = winner && typeof winner.totalVP === 'function' ? winner.totalVP() : (winner?.victoryPoints || 13);

    if (winTitle) winTitle.textContent = `${winnerName} ĐÃ CHIẾN THẮNG!`;
    if (winDesc) winDesc.textContent = `Tuyệt vời! Tổng điểm đạt ${vp} Điểm Chiến Thắng.`;
    winModal.classList.remove('hidden');

    // Lưu kết quả trận đấu và chỉ số ELO/thắng thua lên database nếu là trận online
    if (gameClient && roomCode && roomCode !== 'LOCAL' && roomCode !== 'TESTWIN' && !window.__gameOverEmitted) {
        window.__gameOverEmitted = true;
        const myUser = JSON.parse(localStorage.getItem('user') || '{}');
        const winnerId = winner?.id || (winner?.name === localStorage.getItem('username') ? myUser.id : null);
        gameClient.sendGameOver(winnerId, vp);
    }

    if (victoryCelebration) {
        victoryCelebration.destroy();
        victoryCelebration = null;
    }
    victoryCelebration = new VictoryCelebration3D('win-avatar-stage', winner);
    victoryCelebration.init();

    const btnCelebrate = document.getElementById('btn-win-celebrate');
    if (btnCelebrate) {
        btnCelebrate.onclick = () => {
            if (victoryCelebration) {
                victoryCelebration.triggerCelebrationJump();
            }
        };
    }

    // Nút Chơi Lại (Rematch)
    const btnRematch = document.getElementById('btn-win-rematch');
    if (btnRematch) {
        btnRematch.onclick = () => {
            // Ẩn bảng chiến thắng và dọn dẹp avatar 3D ăn mừng
            if (winModal) winModal.classList.add('hidden');
            if (victoryCelebration) {
                victoryCelebration.destroy();
                victoryCelebration = null;
            }
            clearSavedGameProgress();
            gameStarted = false;

            const myName = localStorage.getItem('username') || 'Bạn';
            const myUser = JSON.parse(localStorage.getItem('user') || '{}');
            const myAvatar = localStorage.getItem('userAvatar') || localStorage.getItem('userAvatarIcon') || 'bunny_pirate';

            if (gameClient && roomCode !== 'LOCAL' && roomCode !== 'TESTWIN' && !window.isTutorial) {
                // Gửi sự kiện Chơi Lại tới server để đưa mình vào phòng chờ đấu lại
                gameClient.sendRematch();
                // Mở phòng chờ hiển thị người chơi hiện tại trong lúc đợi các người chơi khác bấm Chơi Lại
                const initialPlayers = [{ id: myUser.id || 1, username: myName, avatar: myAvatar }];
                checkRoomAndShowWaitingModal(initialPlayers, roomData?.max_players || 3, true);
            } else {
                // Chế độ chơi đơn / Local / Test: Mở lại phòng chờ trận đấu
                const localPlayers = cachedJoinedPlayers.length > 0 ? cachedJoinedPlayers : [{ id: myUser.id || 1, username: myName, avatar: myAvatar }];
                checkRoomAndShowWaitingModal(localPlayers, cachedMaxPlayers || 3, true);
            }
        };
    }

    // Kiểm tra quyền Chủ phòng: Chỉ có chủ phòng mới có nút Đóng Phòng
    const isHost = isCurrentPlayerHost();

    // Nút Đóng Phòng (Close Room) - CHỈ DÀNH RIÊNG CHO CHỦ PHÒNG
    const btnCloseRoom = document.getElementById('btn-win-close-room');
    if (btnCloseRoom) {
        if (isHost) {
            btnCloseRoom.style.display = 'inline-flex';
            btnCloseRoom.onclick = async () => {
                if (confirm('Bạn có chắc chắn muốn đóng phòng chơi này và quay về sảnh chờ?\n(Phòng sẽ biến mất khỏi danh sách phòng đang mở)')) {
                    if (gameClient && roomCode !== 'LOCAL' && roomCode !== 'TESTWIN') {
                        try {
                            const token = localStorage.getItem('token');
                            const targetId = roomData?.id || roomCode;
                            await fetch(`/api/rooms/${targetId}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                        } catch (e) {
                            console.warn('DELETE room error:', e);
                        }
                        gameClient.closeRoom();
                    }
                    window.location.href = 'lobby.html';
                }
            };
        } else {
            btnCloseRoom.style.display = 'none';
        }
    }

    // Nút Rời Phòng (Leave Room) - DÀNH CHO THÀNH VIÊN KHÁC (KHÔNG PHẢI CHỦ PHÒNG)
    const btnLeaveRoom = document.getElementById('btn-win-leave-room');
    if (btnLeaveRoom) {
        if (!isHost) {
            btnLeaveRoom.style.display = 'inline-flex';
            btnLeaveRoom.onclick = async () => {
                if (confirm('Bạn có chắc chắn muốn rời phòng và quay về sảnh chờ?')) {
                    if (window.leaveRoomAndExit) {
                        await window.leaveRoomAndExit();
                    } else {
                        if (gameClient) gameClient.leaveRoom();
                        window.location.href = 'lobby.html';
                    }
                }
            };
        } else {
            btnLeaveRoom.style.display = 'none';
        }
    }
}

function restartMatch() {
    clearSavedGameProgress();
    gameStarted = false;
    const winModal = document.getElementById('win-modal');
    if (winModal) winModal.classList.add('hidden');
    if (victoryCelebration) {
        victoryCelebration.destroy();
        victoryCelebration = null;
    }

    if (cachedJoinedPlayers.length === 0) {
        const myName = localStorage.getItem('username') || 'Bạn';
        const myUser = JSON.parse(localStorage.getItem('user') || '{}');
        cachedJoinedPlayers = [{ id: myUser.id || 1, username: myName }];
    }

    checkRoomAndShowWaitingModal(cachedJoinedPlayers, cachedMaxPlayers, true);
}
window.restartMatch = restartMatch;

function checkWinCondition() {
    if (gameState && gameState.winner) {
        showVictoryCelebration(gameState.winner);
    }
}

// Global debug preview hook for user & testing
window.__testVictoryCelebration = function(customName = 'Bạn (Quán Quân)', forceHost = null) {
    if (forceHost !== null) {
        window.__forceHostTest = forceHost;
    }
    showVictoryCelebration({
        name: customName,
        totalVP: () => 13,
        victoryPoints: 13
    });
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function logEvent(msg) {
    const log = document.getElementById('event-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = 'log-item';
    div.textContent = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── INTERACTIVE TUTORIAL COACH HUD ──────────────────────────────────────────
let tutorialClosed = false;
let tutorialMinimized = false;

function initTutorialCoach() {
    if (!window.isTutorial) return;

    const tutHud = document.getElementById('tutorial-hud');
    const tutReopenBtn = document.getElementById('tut-reopen-btn');
    const tutMinimizeBtn = document.getElementById('tut-btn-minimize');
    const tutCloseBtn = document.getElementById('tut-btn-close');
    const tutCardBody = document.getElementById('tut-card-body');
    const tutCardFooter = document.querySelector('.tutorial-card-footer');
    const tutNextBtn = document.getElementById('tut-btn-next');
    const tutPrevBtn = document.getElementById('tut-btn-prev');

    if (tutHud) tutHud.classList.remove('hidden');

    tutMinimizeBtn?.addEventListener('click', () => {
        tutorialMinimized = !tutorialMinimized;
        if (tutCardBody) tutCardBody.style.display = tutorialMinimized ? 'none' : 'block';
        if (tutCardFooter) tutCardFooter.style.display = tutorialMinimized ? 'none' : 'flex';
        tutMinimizeBtn.textContent = tutorialMinimized ? '➕' : '➖';
    });

    tutCloseBtn?.addEventListener('click', () => {
        tutorialClosed = true;
        tutHud?.classList.add('hidden');
        tutReopenBtn?.classList.remove('hidden');
    });

    tutReopenBtn?.addEventListener('click', () => {
        tutorialClosed = false;
        tutHud?.classList.remove('hidden');
        tutReopenBtn?.classList.add('hidden');
        updateTutorialCoachHUD();
    });

    tutNextBtn?.addEventListener('click', () => {
        tutNextBtn.textContent = 'Đã ghi nhận ✓';
        setTimeout(() => {
            if (tutNextBtn) tutNextBtn.textContent = 'Đã hiểu ▶';
        }, 1200);
    });

    tutPrevBtn?.addEventListener('click', () => {
        showTurnToast('Mẹo: Bấm chuột trái vào các điểm phát sáng màu vàng trên bản đồ để xây dựng!');
    });

    // In-game Rules Button
    document.getElementById('game-rules-btn')?.addEventListener('click', () => {
        const rulesModal = document.getElementById('rules-modal');
        if (rulesModal) {
            rulesModal.classList.remove('hidden');
        } else {
            showTurnToast('Mở Sảnh chờ hoặc bấm tab Luật chơi để xem chi tiết!');
        }
    });

    updateTutorialCoachHUD();
}

function updateTutorialCoachHUD() {
    if (!window.isTutorial || tutorialClosed || !gameState) return;

    const tutHud = document.getElementById('tutorial-hud');
    if (tutHud && !tutorialClosed) tutHud.classList.remove('hidden');

    const badgeEl = document.getElementById('tut-step-badge');
    const titleEl = document.getElementById('tut-step-title');
    const descEl = document.getElementById('tut-step-desc');
    const hintEl = document.getElementById('tut-action-hint');

    if (!badgeEl || !titleEl || !descEl || !hintEl) return;

    const phase = gameState.phase;
    const isMyTurn = (gameState.currentPlayerIndex === myPlayerIndex);
    const cpName = gameState.currentPlayer ? gameState.currentPlayer.name : 'Người chơi';

    if (phase === Phase.SETUP_SETTLEMENT) {
        if (isMyTurn) {
            if (gameState.setupRound === 1) {
                badgeEl.textContent = 'BƯỚC 1/8';
                titleEl.textContent = 'Xây Khu Định Cư Đầu Tiên';
                descEl.innerHTML = `Chào mừng bạn đến với Catan! Ở Vòng Setup 1, bạn cần chọn một vị trí đắc địa để lập khu định cư đầu tiên (mang lại 1 Điểm Chiến Thắng). Hãy ưu tiên các ngã 3 tiếp giáp nhiều loại tài nguyên khác nhau và có số 6, 8 màu đỏ hoặc 5, 9.`;
                hintEl.innerHTML = `<strong>Thao tác:</strong> Bấm chuột trái vào một <strong>vòng tròn màu vàng phát sáng</strong> trên bàn cờ để đặt Định cư!`;
            } else {
                badgeEl.textContent = 'BƯỚC 4/8';
                titleEl.textContent = 'Đặt Định Cư Thứ 2 & Nhận Bài Khởi Đầu';
                descEl.innerHTML = `Đến lượt Setup vòng 2 (Đảo chiều)!<br><strong>Luật 2 Cạnh bắt buộc:</strong> Vị trí mới phải cách định cư khác ít nhất 2 cạnh đường trống.<br><strong>Đặc quyền:</strong> Bạn nhận ngay các thẻ tài nguyên từ các ô đất quanh định cư thứ 2 này!`;
                hintEl.innerHTML = `<strong>Thao tác:</strong> Bấm vào một vòng tròn vàng hợp lệ để đặt Khu định cư thứ 2!`;
            }
        } else {
            badgeEl.textContent = 'BƯỚC 3/8';
            titleEl.textContent = 'Quan Sát Bot AI Đặt Quân';
            descEl.innerHTML = `Đang đến lượt của <strong>${escapeHtml(cpName)}</strong>. Máy tính AI đang tính toán vị trí đặt định cư...`;
            hintEl.innerHTML = `<strong>Đang chờ:</strong> Hệ thống sẽ tự động chuyển lượt lại cho bạn ngay sau khi AI đi xong.`;
        }
    } else if (phase === Phase.SETUP_ROAD) {
        if (isMyTurn) {
            if (gameState.setupRound === 1) {
                badgeEl.textContent = 'BƯỚC 2/8';
                titleEl.textContent = 'Đặt Con Đường Đầu Tiên';
                descEl.innerHTML = `Tuyệt vời! Bạn đã có khu định cư đầu tiên. Bây giờ hãy xây một con đường nối liền với nó để mở hướng bành trướng lãnh thổ hoặc vươn ra biển khơi.`;
                hintEl.innerHTML = `<strong>Thao tác:</strong> Bấm vào một <strong>quả cầu vàng lơ lửng</strong> trên cạnh tiếp giáp với định cư của bạn để đặt Đường!`;
            } else {
                badgeEl.textContent = 'BƯỚC 5/8';
                titleEl.textContent = 'Đặt Con Đường Thứ 2';
                descEl.innerHTML = `Hãy hoàn tất giai đoạn thiết lập bằng cách đặt con đường thứ 2 nối với khu định cư bạn vừa xây.`;
                hintEl.innerHTML = `<strong>Thao tác:</strong> Bấm vào một quả cầu vàng nối với định cư thứ 2 để hoàn tất Setup!`;
            }
        } else {
            badgeEl.textContent = 'BƯỚC 3/8';
            titleEl.textContent = 'Quan Sát Bot AI Đặt Quân';
            descEl.innerHTML = `Đang đến lượt của <strong>${escapeHtml(cpName)}</strong>. Máy tính AI đang đặt đường/thuyền...`;
            hintEl.innerHTML = `<strong>Đang chờ:</strong> Vui lòng quan sát bàn cờ.`;
        }
    } else if (phase === Phase.ROLL) {
        if (isMyTurn) {
            badgeEl.textContent = 'BƯỚC 6/8';
            titleEl.textContent = 'Gieo Xúc Xắc Sản Xuất Tài Nguyên';
            descEl.innerHTML = `Ván đấu chính thức bắt đầu! Trong mỗi lượt chơi, bước đầu tiên LUÔN LUÔN là Gieo Xúc Xắc. Các ô đất có số trùng với xúc xắc sẽ phát tài nguyên cho ai có nhà tiếp giáp.`;
            hintEl.innerHTML = `<strong>Thao tác:</strong> Bấm nút <strong>'Đổ xúc xắc'</strong> ở góc dưới bên phải màn hình!`;
        } else {
            badgeEl.textContent = 'LƯỢT ĐỐI THỦ';
            titleEl.textContent = `${escapeHtml(cpName)} Đang Đổ Xúc Xắc`;
            descEl.innerHTML = `Đối thủ đang gieo xúc xắc. Nếu con số đổ ra trùng với số của ô đất bạn có công trình tiếp giáp, bạn cũng sẽ nhận được tài nguyên tương ứng!`;
            hintEl.innerHTML = `Hãy quan sát con số trên xúc xắc 3D.`;
        }
    } else if (phase === Phase.ROBBER || phase === Phase.STEAL) {
        if (isMyTurn) {
            badgeEl.textContent = 'ĐẶC BIỆT';
            titleEl.textContent = 'Bão Số 7: Di Chuyển Tên Cướp';
            descEl.innerHTML = `Xúc xắc đổ ra 7! Ai cầm trên 7 lá phải bỏ nửa bài. Bây giờ bạn được quyền chuyển Tên Cướp tới ô đất của đối phương để phong tỏa việc nhận tài nguyên và cướp 1 thẻ bài của họ!`;
            hintEl.innerHTML = `<strong>Thao tác:</strong> Bấm chuột trái vào một ô lục giác đất liền của đối thủ để đặt Tên Cướp!`;
        } else {
            badgeEl.textContent = 'BÃO SỐ 7';
            titleEl.textContent = `${escapeHtml(cpName)} Đang Dời Tên Cướp`;
            descEl.innerHTML = `Số 7 xuất hiện! Đối thủ đang chọn ô đất để phong tỏa tài nguyên...`;
            hintEl.innerHTML = `Hy vọng đối thủ không chọn ô đất trọng yếu của bạn!`;
        }
    } else if (phase === Phase.BUILD) {
        if (isMyTurn) {
            badgeEl.textContent = 'BƯỚC 7/8';
            titleEl.textContent = 'Giao Dịch & Xây Dựng Lãnh Thổ';
            descEl.innerHTML = `Tài nguyên đã vào túi đồ của bạn! Bạn có thể xây Đường (1 Gỗ + 1 Gạch), Định cư mới (1 Gỗ + 1 Gạch + 1 Lúa + 1 Cừu), nâng cấp Thành phố (3 Đá + 2 Lúa), hoặc bấm 'Đổi Cảng / Ngân Hàng' để đổi tài nguyên.`;
            hintEl.innerHTML = `<strong>Thao tác:</strong> Bấm các nút Xây Dựng sáng đèn ở thanh dưới, hoặc bấm nút đỏ <strong>'Kết Thúc Lượt'</strong> nếu đã xong!`;
        } else {
            badgeEl.textContent = 'LƯỢT ĐỐI THỦ';
            titleEl.textContent = `${escapeHtml(cpName)} Đang Hành Động`;
            descEl.innerHTML = `Đối thủ đang suy nghĩ xây dựng đường sá, tàu thuyền hoặc giao dịch với ngân hàng...`;
            hintEl.innerHTML = `Bạn sẽ được chơi tiếp ngay khi đối thủ bấm hết lượt!`;
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Update pixel ratio on resize (orientation change)
    const maxPixelRatio = (window.innerWidth <= 768) ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
}

// Listen to custom game-resize event from mobile code
window.addEventListener('game-resize', onWindowResize);

// Handle browser tab visibility change to avoid animation jumps and sync socket
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (clock) clock.getDelta(); // Reset clock delta on resume
        if (gameClient && gameClient.socket && !gameClient.socket.connected) {
            console.log('Tab became visible, reconnecting socket...');
            gameClient.socket.connect();
            setTimeout(() => {
                if (gameClient.requestRestore) gameClient.requestRestore();
            }, 400);
        }
    }
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock ? Math.min(clock.getDelta(), 0.1) : 0.016;
    const time = clock ? clock.getElapsedTime() : 0;

    // Smooth camera transition animation
    if (cameraTransition) {
        const elapsed = performance.now() - cameraTransition.startTime;
        const p = Math.min(1.0, elapsed / cameraTransition.duration);
        const ease = 1 - Math.pow(1 - p, 3);
        camera.position.lerpVectors(cameraTransition.startPos, cameraTransition.endPos, ease);
        controls.target.lerpVectors(cameraTransition.startTarget, cameraTransition.endTarget, ease);
        if (p >= 1.0) {
            cameraTransition = null;
        }
    }

    controls.update();
    pieces.update(delta);
    if (dice3D) dice3D.update(delta);
    if (decorativeIslands) decorativeIslands.update(time, delta);
    // Drive windmill rotation, tree sway, sheep idle animations
    if (hexBoard) hexBoard.update(delta, time);

    // Realistic tropical ocean wave undulation
    if (oceanMesh && oceanMesh.geometry && oceanMesh.geometry.attributes.position) {
        const pos = oceanMesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const u = pos.getX(i);
            const v = pos.getY(i);
            pos.setZ(i, Math.sin(u * 0.14 + time * 1.6) * Math.cos(v * 0.14 + time * 1.3) * 0.16);
        }
        pos.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

function showRoomClosedNotification(msg) {
    // Hide all other dialogs/modals
    document.querySelectorAll('.dialog-overlay').forEach(el => {
        if (el.id !== 'room-closed-modal') el.classList.add('hidden');
    });

    const modal = document.getElementById('room-closed-modal');
    const desc = document.getElementById('room-closed-desc');
    if (msg && desc) {
        desc.textContent = msg;
    }
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        alert(msg || 'Phòng chơi đã bị chủ phòng giải tán!');
        window.location.href = 'lobby.html';
        return;
    }

    const btn = document.getElementById('btn-return-lobby');
    if (btn) {
        btn.onclick = () => {
            window.location.href = 'lobby.html';
        };
    }

    // Auto-redirect to lobby after 4 seconds
    setTimeout(() => {
        window.location.href = 'lobby.html';
    }, 4000);
}

// Auto-start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
