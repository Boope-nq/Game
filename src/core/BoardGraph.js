/**
 * BoardGraph.js — Đồ thị bàn chơi: Vertices (đỉnh) và Edges (cạnh)
 *
 * Theo nguyên tác Catan:
 *  - Mỗi đỉnh (Vertex) là giao điểm của tối đa 3 ô hex
 *  - Mỗi cạnh (Edge) nằm giữa 2 đỉnh liền kề, thuộc 1-2 ô hex
 *  - Định cư / Thành phố đặt lên Vertex
 *  - Đường / Tàu đặt lên Edge
 *
 * Sử dụng hệ toạ độ Axial (q, r) cho hex.
 * Vertex key: "q1,r1|q2,r2|q3,r3" (3 hex tạo ra vertex, sort tăng dần)
 * Edge key: "vKEY1||vKEY2" (2 vertex tạo ra edge, sort tăng dần)
 */

import { hexToPixel, hexNeighbors, hexKey, HEX_SIZE } from './HexGrid.js';
import { TileType } from './HexTile.js';

// ─── Tạo Vertex key từ 3 toạ độ hex ─────────────────────────────────────────
export function makeVertexKey(hexes) {
  // hexes: [{q, r}, {q, r}, {q, r}] — 3 ô tạo thành đỉnh
  const sorted = [...hexes].sort((a, b) => a.q !== b.q ? a.q - b.q : a.r - b.r);
  return sorted.map(h => `${h.q},${h.r}`).join('|');
}

// ─── Tạo Edge key từ 2 vertex key ────────────────────────────────────────────
export function makeEdgeKey(vKey1, vKey2) {
  return [vKey1, vKey2].sort().join('||');
}

/**
 * Xây dựng toàn bộ đồ thị bàn chơi từ danh sách tile
 * @param {Map} tiles - Map<hexKey, HexTile>
 * @returns {{ vertices: Map, edges: Map }}
 *
 * vertices: Map<vertexKey, { key, hexes, pos:{x,y}, adjacentVertices:Set<key>, adjacentEdges:Set<key>, building:null|{playerId, type} }>
 * edges: Map<edgeKey, { key, vertices:[vKey,vKey], hexes:[{q,r},...], isLand:bool, isSea:bool, piece:null|{playerId, type} }>
 */
export function buildBoardGraph(tiles) {
  const vertices = new Map();
  const edges    = new Map();

  const landKeys = new Set(
    [...tiles.values()]
      .filter(t => t.type !== TileType.SEA)
      .map(t => hexKey(t.q, t.r))
  );

  // ─── Bước 1: Tìm tất cả Vertices ─────────────────────────────────────────
  // Mỗi vertex là bộ 3 hex liền nhau (chia sẻ một đỉnh chung)
  // Với mỗi hex, nó có 6 đỉnh. Mỗi đỉnh là trung tâm của 3 hex.
  // Theo toạ độ axial, 2 kiểu đỉnh:
  //   Type A (top):    hex(q,r) + hex(q+1,r-1) + hex(q+1,r)   — đỉnh trên-phải
  //   Type B (bottom): hex(q,r) + hex(q,r+1)   + hex(q-1,r+1) — đỉnh dưới-trái

  const processedVertices = new Set();

  for (const tile of tiles.values()) {
    const { q, r } = tile;

    const vertexTriplets = [
      // 6 đỉnh của ô hex này (theo thứ tự pointy-top)
      [{ q, r }, { q: q+1, r: r-1 }, { q: q+1, r }    ],
      [{ q, r }, { q: q+1, r     }, { q, r: r+1 }      ],
      [{ q, r }, { q, r: r+1     }, { q: q-1, r: r+1 } ],
      [{ q, r }, { q: q-1, r: r+1}, { q: q-1, r }      ],
      [{ q, r }, { q: q-1, r     }, { q, r: r-1 }      ],
      [{ q, r }, { q, r: r-1     }, { q: q+1, r: r-1 } ],
    ];

    for (const triplet of vertexTriplets) {
      const vKey = makeVertexKey(triplet);
      if (processedVertices.has(vKey)) continue;
      processedVertices.add(vKey);

      // Chỉ tạo vertex nếu ít nhất 1 trong 3 hex là đất liền
      // (để không bỏ sót vertex ven biển)
      const hasLand = triplet.some(h => landKeys.has(hexKey(h.q, h.r)));
      const allExist = triplet.every(h => tiles.has(hexKey(h.q, h.r)));
      if (!allExist) continue; // bỏ qua nếu hex ngoài bàn

      // Tính pixel của vertex (trung bình 3 tâm hex)
      const pts = triplet.map(h => hexToPixel(h.q, h.r, HEX_SIZE));
      const pos = {
        x: (pts[0].x + pts[1].x + pts[2].x) / 3,
        y: (pts[0].y + pts[1].y + pts[2].y) / 3,
      };

      vertices.set(vKey, {
        key:              vKey,
        hexes:            triplet,
        pos,
        hasLand,
        adjacentVertices: new Set(),
        adjacentEdges:    new Set(),
        building:         null,  // null | { playerId, type: 'settlement'|'city' }
      });
    }
  }

  // ─── Bước 2: Tìm tất cả Edges ────────────────────────────────────────────
  // Hai vertex kề nhau nếu chúng chia sẻ đúng 2 trong 3 hex
  const vertexList = [...vertices.keys()];

  for (let i = 0; i < vertexList.length; i++) {
    const vA = vertices.get(vertexList[i]);

    for (let j = i + 1; j < vertexList.length; j++) {
      const vB = vertices.get(vertexList[j]);

      // Kiểm tra 2 vertex có kề nhau không (chia sẻ 2 hex chung)
      const sharedHexes = vA.hexes.filter(ha =>
        vB.hexes.some(hb => ha.q === hb.q && ha.r === hb.r)
      );
      if (sharedHexes.length !== 2) continue;

      // Edge hợp lệ
      const eKey = makeEdgeKey(vA.key, vB.key);
      const landCount = sharedHexes.filter(h => landKeys.has(hexKey(h.q, h.r))).length;
      const isLand  = (landCount === 2); // Thuần lục địa: chỉ xây được Đường bộ
      const isSea   = (landCount === 0); // Thuần đại dương: chỉ xây được Tàu biển
      const isMixed = (landCount === 1); // Bờ biển (1 lục địa + 1 đại dương): xây được cả Đường bộ lẫn Tàu biển

      edges.set(eKey, {
        key:      eKey,
        vertices: [vA.key, vB.key],
        hexes:    sharedHexes,
        isLand,
        isSea,
        isMixed,
        piece:    null, // null | { playerId, type: 'road'|'ship', builtThisTurn }
      });

      // Cập nhật adjacency
      vA.adjacentVertices.add(vB.key);
      vA.adjacentEdges.add(eKey);
      vB.adjacentVertices.add(vA.key);
      vB.adjacentEdges.add(eKey);
    }
  }

  return { vertices, edges };
}

// ─── Lấy tất cả Vertices tiếp giáp với một tile (q, r) ───────────────────────
export function getVerticesOfTile(vertices, q, r) {
  const result = [];
  for (const v of vertices.values()) {
    if (v.hexes.some(h => h.q === q && h.r === r)) {
      result.push(v);
    }
  }
  return result;
}

// ─── Lấy tất cả Edges tiếp giáp với một tile (q, r) ──────────────────────────
export function getEdgesOfTile(edges, q, r) {
  const result = [];
  for (const e of edges.values()) {
    if (e.hexes.some(h => h.q === q && h.r === r)) {
      result.push(e);
    }
  }
  return result;
}

// ─── Lấy Harbor tại vertex (theo vị trí cảng) ────────────────────────────────
export function getHarborAtVertex(harbors, vertex) {
  // Harbor nằm trên ô biển — vertex phải tiếp giáp với ô cảng đó
  for (const harbor of harbors) {
    if (vertex.hexes.some(h => h.q === harbor.q && h.r === harbor.r)) {
      return harbor;
    }
  }
  return null;
}

// ─── Kiểm tra Vertex có thể đặt Định cư không (Distance Rule) ────────────────
/**
 * @param {Map} vertices
 * @param {string} vertexKey
 * @param {number} playerId
 * @param {boolean} isSetup - true trong setup (không cần đường nối)
 * @param {Map} edges
 */
export function isValidSettlementPlacement(vertices, edges, vertexKey, playerId, isSetup = false) {
  const vertex = vertices.get(vertexKey);
  if (!vertex) return { ok: false, reason: 'Vị trí không tồn tại' };
  if (!vertex.hasLand) return { ok: false, reason: 'Chỉ đặt trên đất liền' };

  // 1. Kiểm tra vertex hiện tại trống
  if (vertex.building !== null) return { ok: false, reason: 'Vị trí đã bị chiếm' };

  // 2. Distance Rule: tất cả vertex liền kề phải trống
  for (const adjKey of vertex.adjacentVertices) {
    const adj = vertices.get(adjKey);
    if (adj?.building !== null) {
      return { ok: false, reason: 'Vi phạm luật khoảng cách (cần cách ít nhất 2 cạnh)' };
    }
  }

  // 3. Road/Ship connection (bỏ qua trong setup)
  if (!isSetup) {
    const hasConnection = [...vertex.adjacentEdges].some(eKey => {
      const edge = edges.get(eKey);
      return edge?.piece?.playerId === playerId;
    });
    if (!hasConnection) return { ok: false, reason: 'Phải nối với đường hoặc tàu của bạn' };
  }

  return { ok: true };
}

// ─── Kiểm tra Edge có thể đặt Đường không ────────────────────────────────────
export function isValidRoadPlacement(vertices, edges, edgeKey, playerId, isSetup = false) {
  const edge = edges.get(edgeKey);
  if (!edge) return { ok: false, reason: 'Cạnh không tồn tại' };
  if (edge.isSea) return { ok: false, reason: 'Đường chỉ đặt trên đất liền hoặc bờ biển' };
  if (edge.piece !== null) return { ok: false, reason: 'Cạnh đã bị chiếm' };

  if (isSetup) {
    // Setup: phải liền kề với định cư mới đặt của player
    // (kiểm tra ở GameState khi setup)
    return { ok: true };
  }

  // Phải nối với đường/tàu hoặc định cư/thành phố của player
  for (const vKey of edge.vertices) {
    const vertex = vertices.get(vKey);
    if (!vertex) continue;

    // Có định cư/thành phố của player ở đây → hợp lệ
    if (vertex.building?.playerId === playerId) return { ok: true };

    // Có đường/tàu của player nối vào vertex này → hợp lệ
    // (nhưng không bị chặn bởi định cư của đối thủ)
    const blockedByOpponent = vertex.building && vertex.building.playerId !== playerId;
    if (!blockedByOpponent) {
      const hasAdjacentPiece = [...vertex.adjacentEdges]
        .filter(ek => ek !== edgeKey)
        .some(ek => edges.get(ek)?.piece?.playerId === playerId);
      if (hasAdjacentPiece) return { ok: true };
    }
  }

  return { ok: false, reason: 'Đường phải nối với đường/định cư của bạn' };
}

// ─── Kiểm tra Edge có thể đặt Tàu không ─────────────────────────────────────
export function isValidShipPlacement(vertices, edges, edgeKey, playerId, piratePos, tiles, isSetup = false) {
  const edge = edges.get(edgeKey);
  if (!edge) return { ok: false, reason: 'Cạnh không tồn tại' };

  // Tàu chỉ đặt trên biển (isSea) hoặc bờ biển (isMixed), không thể đặt trong đất liền (isLand)
  if (edge.isLand) return { ok: false, reason: 'Tàu chỉ đặt trên biển hoặc bờ biển' };
  if (edge.piece !== null) return { ok: false, reason: 'Cạnh đã bị chiếm' };

  // Kiểm tra Pirate chặn
  if (piratePos) {
    const pirateBlocks = edge.hexes.some(h => h.q === piratePos.q && h.r === piratePos.r);
    if (pirateBlocks) return { ok: false, reason: 'Cướp biển đang chặn tuyến này' };
  }

  if (isSetup) return { ok: true };

  // Phải nối với tàu/định cư của player (tương tự Road)
  for (const vKey of edge.vertices) {
    const vertex = vertices.get(vKey);
    if (!vertex) continue;
    if (vertex.building?.playerId === playerId) return { ok: true };

    const blockedByOpponent = vertex.building && vertex.building.playerId !== playerId;
    if (!blockedByOpponent) {
      const hasAdjacentPiece = [...vertex.adjacentEdges]
        .filter(ek => ek !== edgeKey)
        .some(ek => edges.get(ek)?.piece?.playerId === playerId);
      if (hasAdjacentPiece) return { ok: true };
    }
  }

  return { ok: false, reason: 'Tàu phải nối với tàu/định cư của bạn' };
}

// ─── Tính Longest Trade Route cho một player (DFS) ───────────────────────────
/**
 * Theo nguyên tác Seafarers:
 *  - Đếm đường + tàu liên tục
 *  - Road và Ship chỉ kết nối với nhau qua Settlement/City của player đó
 *  - Nếu đối thủ có Settlement/City tại một junction → bị ngắt
 *  - Không dùng lại cùng một cạnh
 *
 * @returns {number} độ dài tuyến dài nhất
 */
export function calcLongestTradeRoute(vertices, edges, playerId) {
  // Lấy tất cả edges của player
  const playerEdges = new Map(
    [...edges.entries()].filter(([, e]) => e.piece?.playerId === playerId)
  );
  if (playerEdges.size === 0) return 0;

  let globalMax = 0;
  const visitedEdges = new Set();

  function dfs(currentVertexKey, prevEdgeKey, length) {
    if (length > globalMax) globalMax = length;

    const vertex = vertices.get(currentVertexKey);
    if (!vertex) return;

    for (const edgeKey of vertex.adjacentEdges) {
      if (edgeKey === prevEdgeKey) continue;
      if (visitedEdges.has(edgeKey)) continue;

      const edge = playerEdges.get(edgeKey);
      if (!edge) continue; // không phải edge của player

      // Kiểm tra loại piece có phù hợp không
      // Road-Ship connection: chỉ qua Settlement/City của player
      if (prevEdgeKey) {
        const prevEdge = edges.get(prevEdgeKey);
        const bothSame = edge.piece.type === prevEdge?.piece?.type;
        if (!bothSame) {
          // Khác loại (road↔ship): vertex phải có building của player
          if (vertex.building?.playerId !== playerId) continue;
        }
      }

      // Kiểm tra đối thủ chặn tại vertex trung gian (không phải vertex đầu)
      const otherVertex = edge.vertices.find(vk => vk !== currentVertexKey);
      const otherV = vertices.get(otherVertex);
      if (otherV?.building && otherV.building.playerId !== playerId) continue; // bị ngắt

      visitedEdges.add(edgeKey);
      dfs(otherVertex, edgeKey, length + 1);
      visitedEdges.delete(edgeKey);
    }
  }

  // Bắt đầu DFS từ mọi vertex có piece của player
  const startVertices = new Set();
  for (const edge of playerEdges.values()) {
    startVertices.add(edge.vertices[0]);
    startVertices.add(edge.vertices[1]);
  }
  for (const vKey of startVertices) {
    dfs(vKey, null, 0);
  }

  return globalMax;
}

// ─── Lấy các Ships có thể di chuyển (open end ships) ─────────────────────────
/**
 * Ship có thể di chuyển nếu:
 *  1. Không phải được xây trong lượt này
 *  2. Là đầu mút (open end) — một trong 2 vertex không có ship/road nào khác nối vào
 *  3. Không bị Pirate chặn
 *  4. Không nằm giữa 2 building (đường đóng)
 */
export function getMovableShips(vertices, edges, playerId, piratePos) {
  const movable = [];

  for (const [eKey, edge] of edges) {
    if (edge.piece?.playerId !== playerId) continue;
    if (edge.piece.type !== 'ship') continue;
    if (edge.piece.builtThisTurn) continue;

    // Kiểm tra Pirate
    if (piratePos) {
      const blocked = edge.hexes.some(h => h.q === piratePos.q && h.r === piratePos.r);
      if (blocked) continue;
    }

    // Kiểm tra open end: ít nhất 1 vertex là đầu mút
    let hasOpenEnd = false;
    for (const vKey of edge.vertices) {
      const vertex = vertices.get(vKey);
      if (!vertex) continue;

      // Đầu mút: không có building, và không có piece khác nối vào
      const otherPieces = [...vertex.adjacentEdges]
        .filter(ek => ek !== eKey)
        .filter(ek => edges.get(ek)?.piece?.playerId === playerId);

      if (otherPieces.length === 0 && !vertex.building) {
        hasOpenEnd = true;
        break;
      }
    }
    if (!hasOpenEnd) continue;

    // Kiểm tra không phải tuyến đóng (nối 2 building)
    const [v1, v2] = edge.vertices;
    const b1 = vertices.get(v1)?.building?.playerId === playerId;
    const b2 = vertices.get(v2)?.building?.playerId === playerId;
    if (b1 && b2) continue; // đường đóng, không di chuyển được

    movable.push(eKey);
  }

  return movable;
}
