import test from 'node:test';
import assert from 'node:assert/strict';
import {savedGameCollection,progressSummary} from '../public/progress.js';
const game=(id,date,losses,timeClass='rapid')=>({id,date,timeClass,opponent:id,moves:losses.map(loss=>({loss}))});
test('progress includes older cached games once and uses the latest saved review',()=>{
 const old=game('old',1,[200]),newer=game('new',2,[0]);
 assert.deepEqual(savedGameCollection(new Map([['old',old],['new',newer]]),[game('old',1,[0])]).map(g=>g.id),['old','new']);
 assert.equal(savedGameCollection(new Map([['old',old]]),[game('old',1,[0])])[0].moves[0].loss,0);
});
test('progress uses weighted rates and keeps formats separate',()=>{
 const s=progressSummary([game('a',1,[0,100,200,undefined]),game('b',2,[0]),game('c',3,[200],'blitz')],'rapid');
 assert.equal(s.games,2);assert.equal(s.moves,4);assert.equal(s.mistakes,1);assert.equal(s.blunders,1);assert.equal(s.errorRate,50);assert.equal(s.points[0].moves,3);assert.equal(s.comparison,null);
});
test('trend needs two groups of three games and orders by played date',()=>{
 const games=Array.from({length:6},(_,i)=>game(String(i),i+1,i<3?[200,100]:[0,0]));
 const s=progressSummary(games.reverse(),'rapid');assert.equal(s.points[0].id,'0');assert.equal(s.comparison.before.games,3);assert.equal(s.comparison.after.errorRate,0);assert.equal(s.comparison.change,-100);
});
test('undated and unassessed games do not invent progress',()=>{
 assert.equal(progressSummary([game('x',null,[200]),game('y',1,[undefined])],'rapid').games,0);
});
