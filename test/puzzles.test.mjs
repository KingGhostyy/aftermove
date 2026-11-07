import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {PUZZLES,weaknessProfile,freshExercises} from '../public/puzzles.js';
test('fresh library has legal engine-checked solutions and distinct starting positions',()=>{
 assert.ok(PUZZLES.length>=120);const positions=new Set();
 for(const p of PUZZLES){const board=new Chess(p.fen);assert.equal(board.isGameOver(),false,p.id);assert.ok(p.depth>=10,p.id);assert.ok(Number.isFinite(p.beforeScore));assert.ok(p.pv.length>0);assert.equal(p.best,p.pv[0]);for(const uci of p.pv)board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});assert.ok(!positions.has(p.fen));positions.add(p.fen);}
});
test('unseen puzzles come first and never reuse imported game positions',()=>{
 const seen=Object.fromEntries(PUZZLES.slice(0,4).map((p,i)=>[p.id,i+1]));
 const games=[{color:'w',history:[{fen:PUZZLES[5].fen}],moves:[{fen:PUZZLES[4].fen,afterFen:PUZZLES[6].fen,loss:200,phase:'Endgame'}]}];
 const list=freshExercises(games,seen);assert.equal(list[0].fresh,true);assert.ok(!seen[list[0].id]);for(const index of [4,5,6])assert.ok(!list.some(p=>p.id===PUZZLES[index].id));
});
test('theme suggestions use analyzed errors, not wins or account rating',()=>{
 const profile=weaknessProfile([{color:'w',moves:[{loss:200,mateLost:true,beforeScore:0,afterScore:-99998},{loss:100,phase:'Endgame'},{loss:0,phase:'Endgame'}]}]);
 assert.equal(profile.defense,1);assert.equal(profile.endgame,1);assert.equal(profile.material,0);
});

test('unseen history is case-insensitive and separate for each username',async()=>{
 const {readPuzzleHistory,markPuzzleSeen}=await import('../public/puzzles.js');const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(markPuzzleSeen(storage,'Luke',PUZZLES[0].id,123),true);assert.equal(readPuzzleHistory(storage,'LUKE')[PUZZLES[0].id],123);assert.deepEqual(readPuzzleHistory(storage,'SomeoneElse'),{});
 assert.equal(markPuzzleSeen({getItem(){throw Error();},setItem(){throw Error();}},'Luke',PUZZLES[0].id),false);
});

test('unseen puzzles prioritize weak areas and never silently cycle seen puzzles',()=>{
 const games=[{color:'w',moves:[{loss:200,phase:'Endgame'}]}];assert.equal(freshExercises(games,{})[0].theme,'endgame');
 const seen=Object.fromEntries(PUZZLES.map((p,i)=>[p.id,i+1]));assert.deepEqual(freshExercises([],seen),[]);assert.equal(freshExercises([],seen,true).length,PUZZLES.length);assert.equal(freshExercises([],seen,true)[0].id,PUZZLES[0].id);
 for(const p of PUZZLES.filter(p=>p.theme==='defense'))assert.ok(p.beforeScore*(p.color==='w'?1:-1)> -99000,'defensive drill must not be forced mate: '+p.id);
});

test('every fresh puzzle is unseen, and explicit review contains only seen puzzles',()=>{
 const seen=Object.fromEntries(PUZZLES.slice(0,5).map(p=>[p.id,123]));
 const list=freshExercises([],seen);assert.equal(list.length,PUZZLES.length-5);assert.ok(list.every(p=>!seen[p.id]));
 const review=freshExercises([],seen,true);assert.equal(review.length,5);assert.ok(review.every(p=>seen[p.id]));
 const canonical=new Set(PUZZLES.map(p=>p.fen.split(' ').slice(0,4).join(' ')));assert.equal(canonical.size,PUZZLES.length);
 for(const theme of ['mate','material','defense','endgame'])assert.equal(PUZZLES.filter(p=>p.theme===theme).length,90);
 for(const p of PUZZLES){assert.match(p.source,/^https:\/\/lichess.org\/training\/[a-zA-Z0-9]{5}$/);assert.equal(p.license,'CC0-1.0');assert.ok(p.beforeScore*(p.color==='w'?1:-1)>=-200);}
});

test('expanded library adds harder puzzles while preserving starter history',async()=>{
 assert.ok(PUZZLES.length>=360);
 assert.equal(PUZZLES.slice(120).length,240);assert.ok(PUZZLES.slice(120).every(p=>p.rating>=1400&&p.rating<=2200));assert.equal(PUZZLES.filter(p=>p.rating>=1800).length,120);
 assert.equal(new Set(PUZZLES.map(p=>p.id)).size,PUZZLES.length);
 for(const id of ['lichess-0000D','lichess-0008Q','lichess-0009B','lichess-000Pw'])assert.ok(PUZZLES.some(p=>p.id===id));
 assert.equal(new Set(PUZZLES.map(p=>p.sourceGame)).size,PUZZLES.length);
 const {readPuzzleHistory}=await import('../public/puzzles.js');const seen=readPuzzleHistory({getItem:()=>JSON.stringify({'lichess-0000D':123})},'Luke');
 assert.equal(seen['lichess-0000D'],123);assert.ok(!freshExercises([],seen).some(p=>p.id==='lichess-0000D'));
});
