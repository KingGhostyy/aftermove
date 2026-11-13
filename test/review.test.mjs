import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGame } from '../public/analysis.js';
import { reviewMoves, reviewSelection } from '../public/review.js';
const raw={pgn:'1. e4 e5 2. Nf3 Nc6 *',white:{username:'White'},black:{username:'Black'},time_control:'600',time_class:'rapid'};
test('move list retains both sides including the final opponent reply',()=>{
  const game=parseGame(raw,'White');
  assert.deepEqual(reviewMoves(game).map(m=>m.san),['e4','e5','Nf3','Nc6']);
  const selected=reviewSelection(game,3);
  assert.equal(selected.position.fen,game.history[3].afterFen);
  assert.equal(selected.index,1);
});
test('older saved batches recover intervening opponent moves for either color',()=>{
  for(const username of ['White','Black']){
    const game=parseGame(raw,username);delete game.history;
    const moves=reviewMoves(game);
    assert.deepEqual(moves.map(m=>m.san),username==='White'?['e4','e5','Nf3']:['e4','e5','Nf3','Nc6']);
    assert.equal(reviewSelection(game,1).position.fen,moves[1].afterFen);
  }
});

test('best-instead starts before the selected move for either side, including the final move',async()=>{
  const {reviewAlternativeSource}=await import('../public/review.js');
  const game=parseGame(raw,'White');
  for(const ply of [0,1,3]){
    const source=reviewAlternativeSource(game,ply);
    assert.equal(source.fen,game.history[ply].fen);
    assert.equal(source.move.san,game.history[ply].san);
    assert.notEqual(source.fen,game.history[ply].afterFen);
  }
  assert.equal(reviewAlternativeSource(game,-1),null);
  assert.equal(reviewAlternativeSource(game,50),null);
  const original=JSON.stringify(game);
  reviewAlternativeSource(game,1);
  assert.equal(JSON.stringify(game),original);
});

test('exploration move list includes original history and the new line with correct move numbers',async()=>{
 const {explorationMoves}=await import('../public/review.js');
 const {linePositions}=await import('../public/practice.js');
 const game=parseGame(raw,'White'),fen=game.history[2].afterFen,positions=linePositions(fen,['g8f6','f1c4']);
 const moves=explorationMoves(game,positions);
 assert.deepEqual(moves.map(m=>m.san),['e4','e5','Nf3','Nf6','Bc4']);
 assert.deepEqual(moves.slice(3).map(m=>[m.color,m.moveNumber,m.index]),[['b',2,1],['w',3,2]]);
 assert.equal(moves[2].source,'game');assert.equal(moves[3].source,'variation');
 assert.equal(explorationMoves(game,linePositions(game.history[3].afterFen,[])).length,4);
 assert.equal(explorationMoves(game,linePositions(game.history[0].fen,[])).length,0);
});
