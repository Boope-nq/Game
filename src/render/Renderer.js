/**
 * Renderer.js — Vẽ bản đồ lên Canvas 2D
 * Tích hợp với BoardGraph (vertices/edges chính xác)
 */

import { hexToPixel, hexCorners, HEX_SIZE } from '../core/HexGrid.js';
import { TileType, TileColor, TileEmoji }   from '../core/HexTile.js';

const TILE_DARK    = 'rgba(0,0,0,0.45)';
const BORDER_SEA   = '#1a5276';
const BORDER_LAND  = '#5d4037';
const BORDER_GOLD  = '#c9a227';

// ─── Main render ────────────────────────────────────────────────────────────
export function renderMap(ctx, tiles, gameState, uiState = {}, camera = { x: 0, y: 0, zoom: 1 }) {
  let camX = 0, camY = 0, zoom = 1;
  if (typeof camera === 'object' && camera !== null) {
    camX = camera.x ?? 0;
    camY = camera.y ?? 0;
    zoom = camera.zoom ?? 1;
  } else if (typeof camera === 'number') {
    camX = camera;
    camY = arguments[5] || 0;
    zoom = arguments[6] || 1;
  }

  const dpr = window.devicePixelRatio || 1;
  const screenW = ctx.canvas.width / dpr;
  const screenH = ctx.canvas.height / dpr;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, screenW, screenH);

  // Ocean background
  const bg = ctx.createLinearGradient(0, 0, 0, screenH);
  bg.addColorStop(0, '#0d2340');
  bg.addColorStop(1, '#1a4a7a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, screenW, screenH);

  // Apply Camera Transform
  ctx.save();
  ctx.translate(camX, camY);
  ctx.scale(zoom, zoom);

  // Vẽ tiles
  for (const tile of tiles.values()) {
    const { x, y } = hexToPixel(tile.q, tile.r, HEX_SIZE);
    if (!isTileVisible(x, y, zoom, screenW, screenH, camX, camY)) continue;
    drawHex(ctx, tile, x, y, uiState);
  }

  // Vẽ cảng
  if (gameState?.harbors) {
    for (const harbor of gameState.harbors) {
      const { x, y } = hexToPixel(harbor.q, harbor.r, HEX_SIZE);
      drawHarbor(ctx, harbor, x, y);
    }
  }

  if (gameState) {
    // Vẽ valid edges (highlight)
    if (uiState.validEdges?.length) {
      drawValidEdges(ctx, uiState.validEdges, gameState, 0, 0);
    }

    // Vẽ valid vertices (highlight)
    if (uiState.validVertices?.length) {
      drawValidVertices(ctx, uiState.validVertices, gameState, 0, 0);
    }

    // Vẽ tất cả edges (đường + tàu)
    drawAllEdges(ctx, gameState, uiState, 0, 0);

    // Vẽ tất cả vertices (định cư + thành phố)
    drawAllVertices(ctx, gameState, uiState, 0, 0);

    // Vẽ Pirate (Monochrome Vector)
    if (gameState.piratePos) {
      const { x, y } = hexToPixel(gameState.piratePos.q, gameState.piratePos.r, HEX_SIZE);
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 4);
      ctx.lineTo(x + 12, y + 4);
      ctx.lineTo(x + 8, y + 10);
      ctx.lineTo(x - 8, y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x, y - 10);
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - 9, y - 10, 9, 6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 9, y - 10, 9, 6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - 4.5, y - 7, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore(); // End camera transform
  ctx.restore(); // End dpr transform
}

// ─── Hex Tile ────────────────────────────────────────────────────────────────
function drawHex(ctx, tile, cx, cy, uiState) {
  const corners = hexCorners(cx, cy, HEX_SIZE);

  // Fog of War — ô chưa khám phá
  if (!tile.isDiscovered) {
    ctx.beginPath();
    corners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = '#0d1f35';
    ctx.fill();
    ctx.strokeStyle = '#1a3a5a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Dấu ? mờ
    ctx.fillStyle = 'rgba(100,160,220,0.35)';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
    return;
  }

  // Gradient fill
  const baseHex = '#' + TileColor[tile.type].toString(16).padStart(6, '0');
  const isSea   = tile.type === TileType.SEA;
  const grad    = ctx.createRadialGradient(cx, cy - 8, 4, cx, cy + 5, HEX_SIZE);
  grad.addColorStop(0, lightenHex(baseHex, 35));
  grad.addColorStop(1, baseHex);

  ctx.beginPath();
  corners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();

  const isHovered = uiState.hoveredTile?.q === tile.q && uiState.hoveredTile?.r === tile.r;
  ctx.fillStyle = (isHovered && !isSea) ? lightenHex(baseHex, 55) : (isSea ? baseHex : grad);
  ctx.fill();

  // Border
  ctx.strokeStyle = isSea ? BORDER_SEA : (tile.type === TileType.GOLD ? BORDER_GOLD : BORDER_LAND);
  ctx.lineWidth   = isSea ? 1 : 1.8;
  ctx.stroke();

  if (isSea) return;

  // Robber (Monochrome Pawn)
  if (tile.hasRobber) {
    ctx.fillStyle = TILE_DARK;
    ctx.beginPath();
    corners.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy - 7, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 11);
    ctx.quadraticCurveTo(cx, cy - 1, cx + 9, cy + 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Monochrome Tile Icon
  drawTileMonoIcon(ctx, tile.type, cx, cy - 16);

  // Number token
  if (tile.number) {
    const isRed = tile.number === 6 || tile.number === 8;
    const R = 16;
    ctx.beginPath();
    ctx.arc(cx, cy + 10, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.strokeStyle = isRed ? '#c0392b' : '#666';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isRed ? '#c0392b' : '#111';
    ctx.font      = `bold ${tile.number >= 10 ? 11 : 13}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.number, cx, cy + 10);

    // Probability dots
    const dots = 6 - Math.abs(7 - tile.number);
    const dotSpacing = 5;
    const startX = cx - (dots - 1) * dotSpacing / 2;
    for (let d = 0; d < dots; d++) {
      ctx.beginPath();
      ctx.arc(startX + d * dotSpacing, cy + 22, 2, 0, Math.PI * 2);
      ctx.fillStyle = isRed ? '#c0392b' : '#444';
      ctx.fill();
    }
  }
}

// ─── Harbor ──────────────────────────────────────────────────────────────────
function drawHarbor(ctx, harbor, cx, cy) {
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,220,80,0.18)';
  ctx.fill();
  ctx.strokeStyle = '#f0c040';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f0e6cc';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(harbor.type === 'GENERIC' ? '3:1' : '2:1', cx, cy);
}

// ─── Edges (đường + tàu) ─────────────────────────────────────────────────────
function drawAllEdges(ctx, gameState, uiState, OX, OY) {
  for (const [eKey, edge] of gameState.edges) {
    if (!edge.piece) continue;
    const v1 = gameState.vertices.get(edge.vertices[0]);
    const v2 = gameState.vertices.get(edge.vertices[1]);
    if (!v1 || !v2) continue;

    const x1 = v1.pos.x + OX, y1 = v1.pos.y + OY;
    const x2 = v2.pos.x + OX, y2 = v2.pos.y + OY;
    const player = gameState.players[edge.piece.playerId];
    const isMovable = uiState.buildMode === 'moveShip_select' && uiState.validEdges?.includes(eKey);

    ctx.strokeStyle = player.color;
    ctx.lineWidth   = edge.piece.type === 'ship' ? 3 : 4.5;
    ctx.setLineDash(edge.piece.type === 'ship' ? [8, 4] : []);

    if (isMovable) {
      // Highlight tàu có thể di chuyển
      ctx.shadowColor = '#fff';
      ctx.shadowBlur  = 8;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
    ctx.setLineDash([]);

    // Icon tàu (Monochrome Silhouette)
    if (edge.piece.type === 'ship') {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx - 6, my + 2);
      ctx.lineTo(mx + 6, my + 2);
      ctx.lineTo(mx + 4, my + 6);
      ctx.lineTo(mx - 4, my + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my + 2);
      ctx.lineTo(mx, my - 6);
      ctx.lineTo(mx + 5, my - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ─── Vertices (định cư + thành phố) ──────────────────────────────────────────
function drawAllVertices(ctx, gameState, uiState, OX, OY) {
  for (const [vKey, vertex] of gameState.vertices) {
    if (!vertex.building) continue;
    const x  = vertex.pos.x + OX;
    const y  = vertex.pos.y + OY;
    const p  = gameState.players[vertex.building.playerId];
    const isHovered = uiState.hoveredVertex === vKey;

    if (vertex.building.type === 'settlement') {
      drawSettlement(ctx, x, y, p.color, isHovered);
    } else {
      drawCity(ctx, x, y, p.color, isHovered);
    }
  }
}

// ─── Highlight valid edges ────────────────────────────────────────────────────
function drawValidEdges(ctx, validEdgeKeys, gameState, OX, OY) {
  for (const eKey of validEdgeKeys) {
    const edge = gameState.edges.get(eKey);
    if (!edge) continue;
    const v1 = gameState.vertices.get(edge.vertices[0]);
    const v2 = gameState.vertices.get(edge.vertices[1]);
    if (!v1 || !v2) continue;

    const x1 = v1.pos.x + OX, y1 = v1.pos.y + OY;
    const x2 = v2.pos.x + OX, y2 = v2.pos.y + OY;

    ctx.strokeStyle = 'rgba(255, 230, 50, 0.75)';
    ctx.lineWidth   = 6;
    ctx.setLineDash([6, 3]);
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
  }
}

// ─── Highlight valid vertices ─────────────────────────────────────────────────
function drawValidVertices(ctx, validVertexKeys, gameState, OX, OY) {
  for (const vKey of validVertexKeys) {
    const vertex = gameState.vertices.get(vKey);
    if (!vertex) continue;
    const x = vertex.pos.x + OX;
    const y = vertex.pos.y + OY;

    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(255, 220, 40, 0.85)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.stroke();
  }
}

// ─── Settlement shape ─────────────────────────────────────────────────────────
function drawSettlement(ctx, x, y, color, isHovered = false) {
  const s = isHovered ? 1.2 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Thân nhà
  ctx.beginPath();
  ctx.moveTo(-9, 8); ctx.lineTo(9, 8); ctx.lineTo(9, -2);
  ctx.lineTo(0, -12); ctx.lineTo(-9, -2); ctx.closePath();
  ctx.fillStyle   = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Cửa
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-3, 2, 6, 6);

  ctx.restore();
}

// ─── City shape ──────────────────────────────────────────────────────────────
function drawCity(ctx, x, y, color, isHovered = false) {
  const s = isHovered ? 1.2 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);

  // Toà nhà to
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.rect(-12, -8, 24, 18); ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Tháp nhọn
  ctx.beginPath();
  ctx.moveTo(-12, -8); ctx.lineTo(-12, -18); ctx.lineTo(-5, -18);
  ctx.lineTo(-5, -8); ctx.closePath();
  ctx.fillStyle = lightenHex('#' + parseInt(color.slice(1), 16).toString(16).padStart(6,'0'), 30);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Cờ
  ctx.fillStyle   = '#FFD700';
  ctx.fillRect(-12, -22, 2, 6);
  ctx.beginPath();
  ctx.moveTo(-10, -22); ctx.lineTo(-4, -19); ctx.lineTo(-10, -16); ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function isTileVisible(wx, wy, zoom, screenW, screenH, camX, camY) {
  const sx = wx * zoom + camX;
  const sy = wy * zoom + camY;
  const margin = HEX_SIZE * zoom * 2;
  return sx >= -margin && sx <= screenW + margin &&
         sy >= -margin && sy <= screenH + margin;
}

function lightenHex(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

// ─── Monochrome Tile Icons (Clean Vector Canvas) ─────────────────────────────
function drawTileMonoIcon(ctx, type, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === TileType.BRICK) {
    ctx.strokeRect(cx - 9, cy - 6, 8, 5);
    ctx.strokeRect(cx + 1, cy - 6, 8, 5);
    ctx.strokeRect(cx - 5, cy, 10, 5);
  } else if (type === TileType.LUMBER) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 6, cy - 1);
    ctx.lineTo(cx + 3, cy - 1);
    ctx.lineTo(cx + 7, cy + 5);
    ctx.lineTo(cx - 7, cy + 5);
    ctx.lineTo(cx - 3, cy - 1);
    ctx.lineTo(cx - 6, cy - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - 1.5, cy + 5, 3, 3);
  } else if (type === TileType.GRAIN) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 7);
    ctx.lineTo(cx, cy - 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 4, 3, 1.8, -0.6, 0, Math.PI * 2);
    ctx.ellipse(cx + 4, cy - 4, 3, 1.8, 0.6, 0, Math.PI * 2);
    ctx.ellipse(cx - 4, cy + 1, 3, 1.8, -0.6, 0, Math.PI * 2);
    ctx.ellipse(cx + 4, cy + 1, 3, 1.8, 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === TileType.WOOL) {
    ctx.beginPath();
    ctx.arc(cx - 4, cy, 4, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy, 4, 0, Math.PI * 2);
    ctx.arc(cx, cy - 4, 4.5, 0, Math.PI * 2);
    ctx.arc(cx, cy + 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === TileType.ORE) {
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 6);
    ctx.quadraticCurveTo(cx, cy - 2, cx + 7, cy - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx - 5, cy + 6);
    ctx.stroke();
  } else if (type === TileType.GOLD) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + 8 * Math.cos(a);
      const y = cy + 8 * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (type === TileType.DESERT) {
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 3);
    ctx.quadraticCurveTo(cx - 3, cy - 5, cx + 2, cy + 3);
    ctx.quadraticCurveTo(cx + 6, cy - 2, cx + 9, cy + 3);
    ctx.stroke();
  }
  ctx.restore();
}
