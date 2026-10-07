/**
 * regression.test.js — Đảm bảo Base Game (Seafarers) vẫn chạy bình thường 100%
 */

import assert from 'assert';
import { TestSuite } from './test_runner.js';
import { GameState, Phase } from '../src/gameplay/GameState.js';
import { Player } from '../src/entities/Player.js';

const suite = new TestSuite('Regression: Base Game Behavior');

suite.test('Base Game GameState khởi tạo nguyên bản', () => {
  const gs = new GameState(3, ['Player 1', 'Player 2', 'Player 3'], 99999);
  
  assert.strictEqual(gs.winningVP, 13);
  assert.ok(gs.devCardDeck.length > 0, 'Base game phải có dev cards');
  assert.strictEqual(gs.devCardDeck.length, 25, 'Base game dev deck phải có 25 thẻ');
  assert.ok(gs.players[0] instanceof Player);
  assert.strictEqual(gs.robberPos !== null, true, 'Base game Robber phải ở trên bàn (sa mạc)');
  assert.strictEqual(gs.phase, Phase.SETUP_SETTLEMENT);
});

suite.test('Base Game Setup Vòng 2 đặt Settlement (KHÔNG PHẢI City)', () => {
  const gs = new GameState(3, ['A', 'B', 'C'], 1111);

  // Vòng 1
  for (let i = 0; i < 3; i++) {
    const v = gs.getValidSetupVertices()[0];
    gs.setupPlaceSettlement(v);
    const r = gs.getValidRoadEdges(true, v)[0];
    gs.setupPlaceRoadOrShip(r, 'road');
  }

  assert.strictEqual(gs.setupRound, 2);
  assert.strictEqual(gs.currentPlayerIndex, 2);

  // Vòng 2
  const vRound2 = gs.getValidSetupVertices()[0];
  gs.setupPlaceSettlement(vRound2);
  
  const b = gs.vertices.get(vRound2).building;
  assert.strictEqual(b.type, 'settlement', 'Base game Vòng 2 PHẢI đặt settlement, không phải city');
});

suite.run();
