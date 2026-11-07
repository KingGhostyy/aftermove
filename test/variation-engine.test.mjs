import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
const start=new Chess().fen(),next=(()=>{const b=new Chess();b.move('e4');return b.fen();})();
const result=best=>({best,score:25,depth:14,pv:[best]});
test('precomputation and a click share one search, then cached moves return without another search',async()=>{
 const {VariationAnalysis}=await import('../public/variation-engine.js');let calls=0,finish;const updates=[];
 const analysis=new VariationAnalysis({createEngine:()=>({evaluate(){calls++;return new Promise(resolve=>finish=resolve);},stop(){}}),onUpdate:event=>updates.push(event)});
 const background=analysis.get(start),click=analysis.get(start);assert.equal(background,click);await Promise.resolve();await Promise.resolve();
 finish(result('e2e4'));await background;assert.equal((await analysis.get(start)).best,'e2e4');assert.equal(calls,1);assert.equal(updates.length,1);
});
test('changing positions cancels stale work and never caches or publishes its late result',async()=>{
 const {VariationAnalysis}=await import('../public/variation-engine.js');const finishes=[],updates=[];let stops=0;
 const analysis=new VariationAnalysis({createEngine:()=>({evaluate:()=>new Promise(resolve=>finishes.push(resolve)),stop(){stops++;}}),onUpdate:event=>updates.push(event)});
 const old=analysis.get(start);await Promise.resolve();await Promise.resolve();const current=analysis.get(next);await Promise.resolve();await Promise.resolve();
 finishes[0](result('e2e4'));await assert.rejects(old,{name:'AbortError'});assert.equal(analysis.peek(start),undefined);
 finishes[1](result('e7e5'));await current;assert.deepEqual(updates.map(e=>e.fen),[next]);assert.ok(stops>=2);
});
test('failed searches stop retrying in the background but can be retried explicitly',async()=>{
 const {VariationAnalysis}=await import('../public/variation-engine.js');let calls=0;
 const analysis=new VariationAnalysis({createEngine:()=>({evaluate:async()=>{if(++calls===1)throw Error('Failed');return result('e2e4');},stop(){}})});
 await assert.rejects(analysis.get(start),/Failed/);await assert.rejects(analysis.get(start),/Failed/);assert.equal(calls,1);
 assert.equal((await analysis.get(start,{retry:true})).best,'e2e4');assert.equal(calls,2);
});
test('variation board reconstructs repetition so both-side autoplay can stop on a draw',async()=>{
 const {variationBoard}=await import('../public/variation-engine.js');let board=new Chess();const positions=[{fen:board.fen()}];
 for(const uci of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']){board.move({from:uci.slice(0,2),to:uci.slice(2,4)});positions.push({fen:board.fen(),uci});}
 assert.equal(variationBoard({positions,cursor:8}).isThreefoldRepetition(),true);
});
