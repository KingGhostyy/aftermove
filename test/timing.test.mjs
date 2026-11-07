import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTimings, thinkingMoments } from '../public/timing.js';
import { parseGame } from '../public/analysis.js';
test('PGN clock comments attach to the correct player moves',()=>{
  const game=parseGame({pgn:'1. e4 {[%clk 0:09:58]} e5 {[%clk 0:09:57]} 2. Nf3 {[%clk 0:09:38]} Nc6 {[%clk 0:09:53]} *',white:{username:'Luke'},black:{username:'Opponent'},time_control:'600',time_class:'rapid'},'Luke');
  assert.deepEqual(game.moves.map(m=>m.thinkSeconds),[2,20]);
  assert.deepEqual(game.moves.map(m=>m.clockSeconds),[598,578]);
});
test('clock differences use the same player and account for increment',()=>{
  const moves=[{color:'w',after:'a'},{color:'b',after:'b'},{color:'w',after:'c'}];
  const comments=[{fen:'a',comment:'[%clk 0:10:00]'},{fen:'b',comment:'[%clk 0:09:55]'},{fen:'c',comment:'[%clk 0:09:40]'}];
  assert.deepEqual(moveTimings(moves,comments,'600+2','rapid').map(m=>m.thinkSeconds),[2,7,22]);
});
test('missing clocks break timing continuity and daily clocks are not inferred',()=>{
  const moves=[{color:'w',after:'a'},{color:'w',after:'b'},{color:'w',after:'c'}];
  const comments=[{fen:'b',comment:'[%clk 0:09:40]'},{fen:'c',comment:'[%clk 0:09:30]'}];
  assert.deepEqual(moveTimings(moves,comments,'600','rapid').map(m=>m.thinkSeconds),[null,null,10]);
  assert.ok(moveTimings(moves,comments,'1/86400','daily').every(m=>m.thinkSeconds===null));
});
test('thinking moments require an actual mistake and enough timing evidence',()=>{
  const game={moves:[5,6,7,8,40,50].map((s,i)=>({thinkSeconds:s,loss:i===4?200:0,ply:i}))};
  assert.equal(thinkingMoments([game]).length,1);
  assert.equal(thinkingMoments([game])[0].move.thinkSeconds,40);
  assert.equal(thinkingMoments([{moves:[{thinkSeconds:60,loss:300}]}]).length,0);
});

test('game timing summary separates longest moves from long-think mistakes',async()=>{
  const {gameThinkingSummary}=await import('../public/timing.js');
  const game={moves:[2,4,6,8,22,40,null].map((time,i)=>({ply:i,thinkSeconds:time,loss:i===4?200:0,label:i===4?'Blunder':'Sound'}))};
  const summary=gameThinkingSummary(game);
  assert.equal(summary.maxSeconds,40);
  assert.deepEqual(summary.longest.map(m=>m.thinkSeconds),[40,22,8]);
  assert.deepEqual(summary.mistakes.map(m=>m.thinkSeconds),[22]);
  assert.equal(gameThinkingSummary({moves:[{thinkSeconds:null}]}).longest.length,0);
});
