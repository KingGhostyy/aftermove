import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMove, selectGames, summarize, parseGame, makeExercise } from '../public/analysis.js';

test('evaluations are converted to the player perspective, including black', () => {
  assert.equal(classifyMove(100, -200, 'w').loss, 300);
  assert.equal(classifyMove(-100, 200, 'b').loss, 300);
  assert.equal(classifyMove(-100, -200, 'b').loss, 0);
  assert.equal(classifyMove(100, -200, 'w').label, 'Blunder');
});
test('imports only completed standard games, newest first, with a hard 15 limit', () => {
  const games = Array.from({length:20}, (_,i) => ({url:String(i),pgn:'pgn',rules:'chess',end_time:i,white:{result:'win'},black:{result:'resigned'}}));
  games.push({...games[0],url:'variant',rules:'chess960',end_time:100});
  assert.equal(selectGames(games,50).length,15);
  assert.equal(selectGames(games,10)[0].url,'19');
  assert.equal(selectGames([...games,games[19]],10).length,10);
  assert.equal(selectGames(games,1).length,1);
  assert.equal(selectGames(games,7).length,7);
});
test('parses black player and correct position before their move', () => {
  const game = parseGame({pgn:'1. f3 e5 2. g4 Qh4# 0-1', white:{username:'a'},black:{username:'Luke'}},'luke');
  assert.equal(game.color,'b');
  assert.equal(game.moves.length,2);
  assert.equal(game.moves[1].san,'Qh4#');
  assert.equal(game.moves[1].fen.split(' ')[1],'b');
});
test('summary uses only analyzed moves and does not invent strengths from empty data', () => {
  assert.equal(summarize([]).totalMoves,0);
  assert.equal(summarize([]).strength,null);
  const s=summarize([{moves:[{phase:'Opening',loss:0,label:'Sound'},{phase:'Middlegame',loss:300,label:'Blunder'}]}]);
  assert.equal(s.totalMoves,2);
  assert.equal(s.blunders,1);
  assert.equal(s.focus,null); // Too few moves to call a phase a pattern.
  const enough=summarize([{moves:Array.from({length:5},()=>({phase:'Middlegame',loss:300,label:'Blunder'}))}]);
  assert.equal(enough.focus,'Middlegame');
});
test('practice excludes unchanged best moves and shallow analysis', () => {
  const move={fen:'',uci:'e2e4',best:'e2e4',loss:300,depth:14,afterDepth:14};
  assert.equal(makeExercise(move),null);
  assert.equal(makeExercise({...move,best:'d2d4',depth:3}),null);
  assert.equal(makeExercise({...move,best:'d2d4'}).best,'d2d4');
});

test('forced mates are not reported as hundreds of pawns or penalized for taking longer', () => {
  assert.equal(classifyMove(99998,99995,'w').loss,0);
  assert.equal(classifyMove(-99998,-99995,'b').loss,0);
  assert.equal(classifyMove(10,-99998,'w').mateLost,true);
  const s=summarize([{moves:[{phase:'Opening',...classifyMove(10,-99998,'w')},{phase:'Opening',...classifyMove(100,50,'w')}]}]);
  assert.equal(s.phases[0].loss,50);
});
