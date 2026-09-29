/**
 * HexGrid.js — Hệ thống lưới hex dùng toạ độ Axial (q, r)
 * Tài liệu tham khảo: https://www.redblobgames.com/grids/hexagons/
 *
 * Pointy-top hex layout (mũi nhọn hướng lên trên)
 */

export const HEX_SIZE = 52; // pixel radius của mỗi ô hex

// ─── Hướng 6 láng giềng trong toạ độ axial ───────────────────────────────────
export const HEX_DIRECTIONS = [
  { q: 1,  r: 0  }, // phải
  { q: 1,  r: -1 }, // phải-trên
  { q: 0,  r: -1 }, // trái-trên
  { q: -1, r: 0  }, // trái
  { q: -1, r: 1  }, // trái-dưới
  { q: 0,  r: 1  }, // phải-dưới
];

// ─── Chuyển axial (q,r) → pixel (x,y) ───────────────────────────────────────
export function hexToPixel(q, r, size = HEX_SIZE) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (3 / 2) * r;
  return { x, y };
}

// ─── Chuyển pixel (x,y) → axial (q,r) gần nhất ─────────────────────────────
export function pixelToHex(x, y, size = HEX_SIZE) {
  const q = (x * Math.sqrt(3) / 3 - y / 3) / size;
  const r = (y * 2 / 3) / size;
  return hexRound(q, r);
}

// ─── Làm tròn toạ độ hex (fractional → integer) ──────────────────────────────
export function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds)        rr = -rq - rs;
  return { q: rq, r: rr };
}

// ─── Tính khoảng cách giữa 2 ô hex ──────────────────────────────────────────
export function hexDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// ─── Lấy danh sách 6 láng giềng của ô hex ────────────────────────────────────
export function hexNeighbors(q, r) {
  return HEX_DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
}

// ─── Key duy nhất cho mỗi ô hex ──────────────────────────────────────────────
export function hexKey(q, r) {
  return `${q},${r}`;
}

// ─── 6 đỉnh (vertices) của ô hex theo pixel ──────────────────────────────────
export function hexCorners(cx, cy, size = HEX_SIZE) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i + 30); // pointy-top
    corners.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle),
    });
  }
  return corners;
}

// ─── Lấy toạ độ pixel của cạnh (edge) giữa 2 ô liền kề ──────────────────────
export function edgeMidpoint(q1, r1, q2, r2, size = HEX_SIZE) {
  const a = hexToPixel(q1, r1, size);
  const b = hexToPixel(q2, r2, size);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ─── Lấy toạ độ pixel của đỉnh (vertex) dùng cho Định cư / Thành phố ─────────
// Mỗi đỉnh là góc chung của 3 ô hex → dùng average của 3 hex centers
export function sharedVertex(hexTriplet, size = HEX_SIZE) {
  const pts = hexTriplet.map(({ q, r }) => hexToPixel(q, r, size));
  return {
    x: (pts[0].x + pts[1].x + pts[2].x) / 3,
    y: (pts[0].y + pts[1].y + pts[2].y) / 3,
  };
}
