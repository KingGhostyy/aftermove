import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGame,classifyMove,summarize} from '../public/analysis.js';
import {analyzeFullGame} from '../public/full-analysis.js';

const raw={pgn:'1. e4 e5 2. Nf3 Nc6 *',white:{username:'Luke'},black:{username:'Other'}};
test('full game rates both colors with their own perspective and reuses adjacent searches',async()=>{
 const game=parseGame(raw,'Luke'),original=JSON.stringify(game);let calls=0;
 const scores=[100,100,300,300,300],engine={evaluate:async()=>({score:scores[calls++],depth:14,best:'e2e4',pv:[]})};
 const result=await analyzeFullGame(game,engine,()=>{},()=>false);
 assert.equal(calls,5);assert.equal(result.history.length,4);assert.equal(result.history[1].loss,200);assert.equal(result.history[1].label,'Blunder');
 assert.equal(result.moves.length,2);assert.equal(summarize([result]).totalMoves,2);assert.equal(result.bothSidesAnalyzed,true);
 assert.equal(JSON.stringify(game),original);assert.equal(result.moves[0],result.history[0]);
});
test('cancelled upgrade does not publish partial ratings or erase deeper own analysis',async()=>{
 const game=parseGame(raw,'Luke');game.moves[0].deepAt=123;game.moves[0].depth=20;
 let calls=0;
 await assert.rejects(analyzeFullGame(game,{evaluate:async()=>{calls++;return {depth:14,score:0,best:'e2e4',pv:[]};}},()=>{},()=>calls>=2),{name:'AbortError'});
 assert.equal(game.moves[0].deepAt,123);assert.equal(game.bothSidesAnalyzed,undefined);
});
test('miss distinguishes a passed-up advantage or mate from a move that leaves its side losing',()=>{
 assert.equal(classifyMove(300,0,'w').label,'Miss');assert.equal(classifyMove(-300,0,'b').label,'Miss');
 assert.equal(classifyMove(99995,0,'w').label,'Miss');assert.equal(classifyMove(0,-99995,'w').label,'Blunder');
 assert.equal(classifyMove(300,-200,'w').label,'Blunder');
});
test('upgrading a saved game preserves its deliberate deeper rechecks',async()=>{
 const game=parseGame(raw,'Luke');Object.assign(game.moves[0],{deepAt:123,depth:14,afterDepth:15,beforeScore:31,afterScore:25,best:'e2e4',loss:6,label:'Sound'});
 const result=await analyzeFullGame(game,{evaluate:async()=>({depth:18,score:100,best:'d2d4',pv:[]})});
 assert.equal(result.moves[0].beforeScore,31);assert.equal(result.moves[0].deepAt,123);assert.equal(result.moves[0].depth,14);assert.equal(result.history[1].depth,18);
});
