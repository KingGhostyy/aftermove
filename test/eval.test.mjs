import test from 'node:test';
import assert from 'node:assert/strict';
import {evalDisplay} from '../public/eval.js';
test('evaluation bar uses White perspective, balanced zero and bounded fill',()=>{
  assert.equal(evalDisplay(0).whitePercent,50);
  assert.equal(evalDisplay(363).label,'+3.63');
  assert.ok(evalDisplay(-200).whitePercent<50);
  assert.ok(evalDisplay(9000).whitePercent<100);
});
test('mate and pending scores are not presented as numeric pawn evaluations',()=>{
  assert.equal(evalDisplay(-99997).label,'−M3');
  assert.equal(evalDisplay(100000).label,'+M');
  assert.equal(evalDisplay(undefined).label,'…');
});

test('searching retains the prior numeric evaluation and explicitly marks it stale',async()=>{
  const {searchingEval}=await import('../public/eval.js');
  const pending=searchingEval(undefined,-363);
  assert.equal(pending.label,'-3.63');
  assert.equal(pending.whitePercent,evalDisplay(-363).whitePercent);
  assert.equal(pending.pending,true);
  assert.match(pending.description,/Previous position.*Engine thinking/);
  assert.equal(searchingEval(undefined,undefined).label,'…');
  assert.equal(searchingEval(0,-363).label,'0.00');
  assert.equal(searchingEval(125,-363).pending,false);
  assert.equal(searchingEval(undefined,99997).label,'+M3');
});
