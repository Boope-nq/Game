/**
 * main.js — Entry point, game loop, mobile-first touch controls, camera pan & pinch-zoom
 * Tích hợp với BoardGraph system (vertex/edge chính xác) & Retina canvas
 */

import { GameState, Phase } from './gameplay/GameState.js';
import { renderMap }         from './render/Renderer.js';
import { HUD }               from './ui/HUD.js';
import { hexToPixel, pixelToHex, hexCorners, HEX_SIZE } from './core/HexGrid.js';
import { TileType }          from './core/HexTile.js';

// ─── Canvas & Retina Display Scaling ──────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

let dpr = Math.min(window.devicePixelRatio || 1, 3);

// ─── Camera (Pan & Zoom) ──────────────────────────────────────────────────────
const camera = {
  x: 0,
  y: 0,
  zoom: 1.0,
  minZoom: 0.45,
  maxZoom: 2.2,
};

function calculateDefaultZoom() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Đảo Catan Seafarers có độ rộng khoảng 10-12 hex (~700-800px)
  if (w < 480) {
    return Math.max(0.55, Math.min(0.78, w / 520));
  } else if (w < 768) {
    return 0.85;
  }
  return 1.0;
}

function resetCamera() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.zoom = calculateDefaultZoom();
  camera.x = w / 2;
  // Nếu màn hình dọc, đẩy camera lên một chút để tránh HUD bottom
  camera.y = w < h ? (h / 2 - 35) : (h / 2);
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = `${w}px`;
  canvas.style.height = `${h}px`;

  // Nếu camera chưa được khởi tạo vị trí
  if (camera.x === 0 && camera.y === 0) {
    resetCamera();
  }
}
resizeCanvas();

window.addEventListener('resize', () => {
  resizeCanvas();
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    resizeCanvas();
    resetCamera();
  }, 150);
});

// ─── State ────────────────────────────────────────────────────────────────────
let gameState = null;
let hud       = null;
let uiState   = {
  hoveredTile:      null,
  hoveredVertex:    null,
  hoveredEdge:      null,
  selectedTile:     null,
  buildMode:        null,  // 'settlement'|'city'|'road'|'ship'|'moveShip'
  movingShipFrom:   null,  // edgeKey đang di chuyển
  validVertices:    [],    // highlight vertices hợp lệ
  validEdges:       [],    // highlight edges hợp lệ
};

// ─── Menu ────────────────────────────────────────────────────────────────────
function showMainMenu() {
  document.getElementById('main-menu').classList.remove('hidden');
  document.getElementById('game-container').classList.add('hidden');
}

function startGame(numPlayers) {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');

  gameState = new GameState(numPlayers);
  uiState   = {
    hoveredTile: null, hoveredVertex: null, hoveredEdge: null,
    selectedTile: null, buildMode: null, movingShipFrom: null,
    validVertices: [], validEdges: []
  };

  resetCamera();

  const hudContainer = document.getElementById('hud-overlay');
  hud = new HUD(hudContainer, gameState, {
    onRoll:       (roll) => { hud.update(); },
    onEndTurn:    ()     => { clearBuildMode(); hud.update(); },
    onBuildMode:  (type) => { enterBuildMode(type); },
    onMoveShip:   ()     => { enterMoveShipMode(); },
    onTrade:      ()     => { hud.update(); },
    onNewGame:    ()     => { showMainMenu(); },
    onDevCard:    (type, opts) => {
      const r = gameState.playDevCard(type, opts);
      hud.update();
      return r;
    },
    onDiscard:    (pid, toDiscard) => {
      const r = gameState.discardResources(pid, toDiscard);
      hud.update();
      return r;
    },
    onPickGold:   (pid, choices) => {
      const r = gameState.pickGoldResources(pid, choices);
      hud.update();
      return r;
    },
    onSteal:      (victimId) => {
      const r = gameState.stealFrom(victimId);
      hud.update();
      return r;
    },
  });

  // Tự động kích hoạt build mode phù hợp cho lượt setup đầu tiên
  syncSetupBuildMode();

  requestAnimationFrame(gameLoop);
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function gameLoop() {
  if (!gameState) return;
  renderMap(ctx, gameState.tiles, gameState, uiState, camera);
  requestAnimationFrame(gameLoop);
}

// ─── Build Mode ───────────────────────────────────────────────────────────────
function enterBuildMode(type) {
  uiState.buildMode = type;
  const gs = gameState;

  switch (type) {
    case 'settlement':
      uiState.validVertices = gs.getValidSettlementVertices();
      uiState.validEdges    = [];
      break;
    case 'city':
      uiState.validVertices = gs.getValidCityVertices();
      uiState.validEdges    = [];
      break;
    case 'road':
      uiState.validVertices = [];
      uiState.validEdges    = gs.getValidRoadEdges();
      break;
    case 'ship':
      uiState.validVertices = [];
      uiState.validEdges    = gs.getValidShipEdges();
      break;
    case 'setupSettlement':
      uiState.validVertices = gs.getValidSetupVertices();
      uiState.validEdges    = [];
      break;
    case 'setupRoad':
      uiState.validVertices = [];
      uiState.validEdges    = gs.getValidRoadEdges(true, gs.setupSettlementVertex);
      // cho phép đặt tàu nếu ven biển
      const shipEdges = gs.getValidShipEdges(true, gs.setupSettlementVertex);
      uiState.validEdges    = [...uiState.validEdges, ...shipEdges];
      break;
  }

  hud?.showBuildHint(type);
}

function enterMoveShipMode() {
  uiState.buildMode      = 'moveShip_select';
  uiState.movingShipFrom = null;
  uiState.validEdges     = gameState.getMovableShips();
  uiState.validVertices  = [];
  hud?.showBuildHint('moveShip_select');
}

function clearBuildMode() {
  uiState.buildMode      = null;
  uiState.movingShipFrom = null;
  uiState.validVertices  = [];
  uiState.validEdges     = [];
}

// ─── AUTO enter build mode during setup ───────────────────────────────────────
function syncSetupBuildMode() {
  const gs = gameState;
  if (!gs) return;
  if (gs.phase === Phase.SETUP_SETTLEMENT) {
    enterBuildMode('setupSettlement');
  } else if (gs.phase === Phase.SETUP_ROAD) {
    enterBuildMode('setupRoad');
  } else {
    clearBuildMode();
  }
}

// ─── Tìm Vertex & Edge gần nhất (Tính theo Screen-Space Threshold) ─────────────
function findNearestVertex(mx, my, candidateKeys, screenThreshold = 34) {
  let bestKey  = null;
  // Quy đổi threshold từ màn hình sang world coordinates
  let bestDist = screenThreshold / camera.zoom;

  for (const vKey of candidateKeys) {
    const vertex = gameState.vertices.get(vKey);
    if (!vertex) continue;
    const dx = mx - vertex.pos.x;
    const dy = my - vertex.pos.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) {
      bestDist = d;
      bestKey  = vKey;
    }
  }
  return bestKey;
}

function findNearestEdge(mx, my, candidateKeys, screenThreshold = 36) {
  let bestKey  = null;
  let bestDist = screenThreshold / camera.zoom;

  for (const eKey of candidateKeys) {
    const edge = gameState.edges.get(eKey);
    if (!edge) continue;
    const v1 = gameState.vertices.get(edge.vertices[0]);
    const v2 = gameState.vertices.get(edge.vertices[1]);
    if (!v1 || !v2) continue;

    // Trung điểm của cạnh
    const mx2 = (v1.pos.x + v2.pos.x) / 2;
    const my2 = (v1.pos.y + v2.pos.y) / 2;
    const dx = mx - mx2;
    const dy = my - my2;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) {
      bestDist = d;
      bestKey  = eKey;
    }
  }
  return bestKey;
}

// ─── Core Interaction Logic (Tap / Click on Map) ──────────────────────────────
function handleMapTap(screenX, screenY) {
  if (!gameState) return;

  // Chuyển đổi Screen Coordinates -> World Coordinates
  const mx = (screenX - camera.x) / camera.zoom;
  const my = (screenY - camera.y) / camera.zoom;

  const gs = gameState;

  // === SETUP PHASES ===
  if (gs.phase === Phase.SETUP_SETTLEMENT) {
    const vKey = findNearestVertex(mx, my, uiState.validVertices, 36);
    if (vKey) {
      const result = gs.setupPlaceSettlement(vKey);
      if (result.ok) {
        hud.update();
        syncSetupBuildMode();
      } else {
        showToast(result.reason);
      }
    }
    return;
  }

  if (gs.phase === Phase.SETUP_ROAD) {
    const eKey = findNearestEdge(mx, my, uiState.validEdges, 38);
    if (eKey) {
      const edge = gs.edges.get(eKey);
      let type = 'road';
      if (!edge.isLand) type = 'ship';
      const result = gs.setupPlaceRoadOrShip(eKey, type);
      if (result.ok) {
        hud.update();
        syncSetupBuildMode();
      } else {
        showToast(result.reason);
      }
    }
    return;
  }

  // === ROBBER/PIRATE PHASE ===
  if (gs.phase === Phase.ROBBER) {
    const { q, r } = pixelToHex(mx, my, HEX_SIZE);
    const tile = gs.getTile(q, r);
    if (!tile) return;

    let result;
    if (tile.type === TileType.SEA) {
      result = gs.movePirate(q, r);
    } else {
      result = gs.moveRobber(q, r);
    }

    if (result.ok) {
      hud.update();
      if (gs.phase === Phase.STEAL && result.victims.length > 0) {
        hud.showStealDialog(result.victims);
      }
    } else {
      showToast(result.reason);
    }
    return;
  }

  // === BUILD PHASE ===
  if (gs.phase === Phase.BUILD) {
    const mode = uiState.buildMode;

    if (mode === 'settlement') {
      const vKey = findNearestVertex(mx, my, uiState.validVertices, 36);
      if (vKey) {
        const r = gs.placeSettlement(vKey);
        if (r.ok) { clearBuildMode(); hud.update(); }
        else showToast(r.reason);
      }
    } else if (mode === 'city') {
      const vKey = findNearestVertex(mx, my, uiState.validVertices, 36);
      if (vKey) {
        const r = gs.placeCity(vKey);
        if (r.ok) { clearBuildMode(); hud.update(); }
        else showToast(r.reason);
      }
    } else if (mode === 'road') {
      const eKey = findNearestEdge(mx, my, uiState.validEdges, 38);
      if (eKey) {
        const r = gs.placeRoad(eKey);
        if (r.ok) { clearBuildMode(); hud.update(); }
        else showToast(r.reason);
      }
    } else if (mode === 'ship') {
      const eKey = findNearestEdge(mx, my, uiState.validEdges, 38);
      if (eKey) {
        const r = gs.placeShip(eKey);
        if (r.ok) { clearBuildMode(); hud.update(); }
        else showToast(r.reason);
      }
    } else if (mode === 'moveShip_select') {
      const eKey = findNearestEdge(mx, my, uiState.validEdges, 38);
      if (eKey) {
        uiState.movingShipFrom = eKey;
        uiState.buildMode      = 'moveShip_place';
        uiState.validEdges     = gs.getValidShipEdges().filter(k => k !== eKey);
        hud?.showBuildHint('moveShip_place');
      }
    } else if (mode === 'moveShip_place') {
      const eKey = findNearestEdge(mx, my, uiState.validEdges, 38);
      if (eKey && uiState.movingShipFrom) {
        const r = gs.moveShip(uiState.movingShipFrom, eKey);
        if (r.ok) { clearBuildMode(); hud.update(); }
        else showToast(r.reason);
      }
    }
  }
}

// ─── Touch & Multi-Touch Gestures (Pan & Pinch-to-Zoom) ───────────────────────
let activeTouches = new Map();
let isDragging = false;
let startTouchPos = { x: 0, y: 0 };
let lastPinchDist = 0;
let lastPinchCenter = { x: 0, y: 0 };
let touchStartTime = 0;
let totalDragDistance = 0;

function getTouchDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(t1, t2) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2
  };
}

// Touch Start
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
  }

  touchStartTime = Date.now();
  totalDragDistance = 0;

  if (activeTouches.size === 1) {
    const t = e.touches[0];
    startTouchPos = { x: t.clientX, y: t.clientY };
    isDragging = true;
  } else if (activeTouches.size === 2) {
    isDragging = false;
    const [t1, t2] = [e.touches[0], e.touches[1]];
    lastPinchDist = getTouchDistance(t1, t2);
    lastPinchCenter = getTouchCenter(t1, t2);
  }
}, { passive: false });

// Touch Move
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();

  if (activeTouches.size === 1 && isDragging) {
    // 1 Ngón: Pan bản đồ
    const t = e.touches[0];
    const prev = activeTouches.get(t.identifier);
    if (prev) {
      const dx = t.clientX - prev.x;
      const dy = t.clientY - prev.y;
      camera.x += dx;
      camera.y += dy;
      totalDragDistance += Math.sqrt(dx * dx + dy * dy);
      activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  } else if (activeTouches.size >= 2) {
    // 2 Ngón: Pinch-to-zoom quanh tâm 2 ngón & Pan
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const currentDist = getTouchDistance(t1, t2);
    const currentCenter = getTouchCenter(t1, t2);

    if (lastPinchDist > 0) {
      const factor = currentDist / lastPinchDist;
      const oldZoom = camera.zoom;
      const newZoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, oldZoom * factor));

      // Zoom quanh tâm của 2 ngón tay
      const rect = canvas.getBoundingClientRect();
      const focalX = currentCenter.x - rect.left;
      const focalY = currentCenter.y - rect.top;

      // camera.x = focalX - (focalX - camera.x) * (newZoom / oldZoom) + panDx
      const panDx = currentCenter.x - lastPinchCenter.x;
      const panDy = currentCenter.y - lastPinchCenter.y;

      camera.x = focalX - (focalX - camera.x) * (newZoom / oldZoom) + panDx;
      camera.y = focalY - (focalY - camera.y) * (newZoom / oldZoom) + panDy;
      camera.zoom = newZoom;

      totalDragDistance += 20; // đánh dấu là thao tác cử chỉ, không phải tap
    }

    lastPinchDist = currentDist;
    lastPinchCenter = currentCenter;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  }
}, { passive: false });

// Touch End
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  const touchDuration = Date.now() - touchStartTime;

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    activeTouches.delete(t.identifier);

    // Kiểm tra xem có phải là thao tác Chạm (Tap) không:
    // Điều kiện: Quãng đường rê ngón tay < 12px và thời gian chạm < 400ms
    if (totalDragDistance < 12 && touchDuration < 400) {
      const rect = canvas.getBoundingClientRect();
      const screenX = t.clientX - rect.left;
      const screenY = t.clientY - rect.top;
      handleMapTap(screenX, screenY);
    }
  }

  if (activeTouches.size === 1) {
    // Chuyển lại về chế độ 1 ngón drag nếu còn 1 ngón
    const remaining = [...activeTouches.values()][0];
    startTouchPos = { x: remaining.x, y: remaining.y };
    isDragging = true;
    lastPinchDist = 0;
  } else if (activeTouches.size === 0) {
    isDragging = false;
    lastPinchDist = 0;
  }
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
  activeTouches.clear();
  isDragging = false;
  lastPinchDist = 0;
});

// ─── Mouse Interactions (Desktop & Tablet Mouse/Trackpad Support) ─────────────
let isMouseDown = false;
let mouseStart = { x: 0, y: 0 };
let mouseDragDist = 0;

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
  isMouseDown = true;
  mouseStart = { x: e.clientX, y: e.clientY };
  mouseDragDist = 0;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const screenX = e.clientX - rect.left;
  const screenY = e.clientY - rect.top;

  if (isMouseDown) {
    const dx = e.clientX - mouseStart.x;
    const dy = e.clientY - mouseStart.y;
    camera.x += dx;
    camera.y += dy;
    mouseDragDist += Math.sqrt(dx * dx + dy * dy);
    mouseStart = { x: e.clientX, y: e.clientY };
  } else if (gameState) {
    // Hover highlight khi di chuột trên desktop
    const mx = (screenX - camera.x) / camera.zoom;
    const my = (screenY - camera.y) / camera.zoom;
    const { q, r } = pixelToHex(mx, my, HEX_SIZE);
    uiState.hoveredTile   = gameState.getTile(q, r) ?? null;
    uiState.hoveredVertex = findNearestVertex(mx, my, [...gameState.vertices.keys()], 24);
    uiState.hoveredEdge   = findNearestEdge(mx, my, [...gameState.edges.keys()], 26);
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (!isMouseDown) return;
  isMouseDown = false;
  if (mouseDragDist < 6) {
    const rect = canvas.getBoundingClientRect();
    handleMapTap(e.clientX - rect.left, e.clientY - rect.top);
  }
});

// Mouse Wheel Zoom
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const focalX = e.clientX - rect.left;
  const focalY = e.clientY - rect.top;

  const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
  const oldZoom = camera.zoom;
  const newZoom = Math.min(camera.maxZoom, Math.max(camera.minZoom, oldZoom * zoomFactor));

  camera.x = focalX - (focalX - camera.x) * (newZoom / oldZoom);
  camera.y = focalY - (focalY - camera.y) * (newZoom / oldZoom);
  camera.zoom = newZoom;
}, { passive: false });

// ─── Toast Message ────────────────────────────────────────────────────────────
function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg ?? 'Hành động không hợp lệ';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

// ─── Expose Globals ───────────────────────────────────────────────────────────
window._showToast      = showToast;
window._clearBuildMode = clearBuildMode;
window._enterBuildMode = enterBuildMode;
window._syncSetup      = syncSetupBuildMode;
window._resetCamera    = resetCamera;
window._zoomIn         = () => {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const oldZ = camera.zoom;
  const newZ = Math.min(camera.maxZoom, oldZ * 1.25);
  camera.x = cx - (cx - camera.x) * (newZ / oldZ);
  camera.y = cy - (cy - camera.y) * (newZ / oldZ);
  camera.zoom = newZ;
};
window._zoomOut        = () => {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const oldZ = camera.zoom;
  const newZ = Math.max(camera.minZoom, oldZ * 0.8);
  camera.x = cx - (cx - camera.x) * (newZ / oldZ);
  camera.y = cy - (cy - camera.y) * (newZ / oldZ);
  camera.zoom = newZ;
};

// ─── Menu Buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.btn-start-game').forEach(btn => {
  btn.addEventListener('click', () => {
    startGame(parseInt(btn.dataset.players ?? '3'));
  });
});

showMainMenu();
