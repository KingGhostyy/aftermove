import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAlternative, continuationConsequence } from '../public/feedback.js';
const score=(score,depth=14)=>({score,depth});
test('equally good alternative is accepted for either color',()=>{
  assert.equal(assessAlternative(score(100),score(80),'w').accepted,true);
  assert.equal(assessAlternative(score(-100),score(-80),'b').accepted,true);
});
test('missing a win while staying playable is a miss, not a losing blunder',()=>{
  assert.equal(assessAlternative(score(400),score(10),'w').category,'Missed opportunity');
  assert.equal(assessAlternative(score(99996),score(600),'w').category,'Missed opportunity');
});
test('retaining forced mate is accepted even if the mate takes longer',()=>{
  assert.equal(assessAlternative(score(99997),score(99980),'w').accepted,true);
});
test('allowing mate is a mistake, while shallow results remain uncertain',()=>{
  assert.equal(assessAlternative(score(20),score(-99997),'w').category,'Mistake');
  assert.equal(assessAlternative(score(400,5),score(-400),'w').category,'Unclear');
});
test('a small difference is not labeled a bad move or demonstrated as losing',()=>{
  const result=assessAlternative(score(100),score(50),'w');
  assert.equal(result.category,'Playable alternative');assert.equal(result.demonstrate,false);
});
test('material consequence follows actual captures rather than evaluation units',()=>{
  assert.match(continuationConsequence('r5k1/B7/8/8/8/8/8/6K1 w - - 0 1',['a7b8','a8b8'],'w'),/lost more material/);
});
