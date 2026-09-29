import { GameState } from '../../src/gameplay/GameState.js';

const gs = new GameState(2, ['P1', 'P2'], 'TEST');
console.log('Phase:', gs.phase);
const vList = gs.getValidSetupVertices();
console.log('Valid setup vertices count:', vList.length);
const vKey = vList[0];
console.log('Selected vKey:', vKey);

const v = gs.vertices.get(vKey);
console.log('v.adjacentEdges:', v ? [...v.adjacentEdges] : null);

const res = gs.setupPlaceSettlement(vKey);
console.log('setupPlaceSettlement res:', res);
console.log('gs.setupSettlementVertex:', gs.setupSettlementVertex);

const roadEdges = gs.getValidRoadEdges(true, gs.setupSettlementVertex);
const shipEdges = gs.getValidShipEdges(true, gs.setupSettlementVertex);
console.log('roadEdges:', roadEdges);
console.log('shipEdges:', shipEdges);

for (const ek of v.adjacentEdges) {
    const edge = gs.edges.get(ek);
    console.log('Edge', ek, '-> isLand:', edge?.isLand, 'isMixed:', edge?.isMixed, 'isSea:', edge?.isSea, 'piece:', edge?.piece, 'vertices:', edge?.vertices);
}
