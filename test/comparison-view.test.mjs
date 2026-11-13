import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Chess} from 'chess.js';
import {linePositions} from '../public/practice.js';
import {comparisonPositions} from '../public/corrections.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const code=app.slice(app.indexOf('function optionButton('),app.indexOf('function renderPractice(){'));
function setup(){
 const root=new Chess().fen(),prefix=linePositions(root,['e2e4','e7e5']);
 const c={prefix,fen:prefix.at(-1).fen,played:'f1a6',best:'g1f3',line:['g1f3','b8c6'],playedLine:['f1a6','b7a6']};
 const v={positions:comparisonPositions(c,'your'),cursor:4,correction:c,busy:false,autoBoth:true,analysis:{cancel(){}}},p={timeline:comparisonPositions(c,'your'),cursor:4,correction:c,busy:false,solved:false};let renders=0;
 const context={state:{review:{variation:v},practice:p,view:'practice',running:false},comparisonPositions,clearTimeout(){},stopEvaluation(){},stopPlayback(){},renderReview(){renders++;},renderPractice(){renders++;},explainMove:()=>'',document:{querySelectorAll:()=>[]}};
 vm.runInNewContext(code,context);return {context,v,p,c,renders:()=>renders};
}
test('comparison switches back and forth, pauses autoplay, and preserves both lines',()=>{
 const {context,v,c}=setup(),original=JSON.stringify(c);
 context.compareVariation('best');assert.equal(v.positions[v.cursor].san,'Nf3');assert.equal(v.autoBoth,false);assert.equal(v.comparisonChoice,'best');assert.equal(v.showIdeas,true);
 context.compareVariation('your');assert.equal(v.positions[v.cursor].san,'Ba6');assert.equal(v.positions[v.cursor+1].san,'bxa6');assert.equal(JSON.stringify(c),original);
});
test('practice comparisons remain reversible and do not count as solving the puzzle',()=>{
 const {context,p}=setup();context.comparePractice('best');assert.equal(p.timeline[p.cursor].san,'Nf3');assert.equal(p.solved,false);
 context.comparePractice('your');assert.equal(p.timeline[p.cursor].san,'Ba6');assert.equal(p.solved,false);
});
test('rounded option buttons expose pressed state and an explicit On/Off label',()=>{
 const {context}=setup();
 assert.match(context.optionButton('both','Play both sides',true),/aria-pressed="true"/);
 assert.match(context.optionButton('both','Play both sides',false),/>Off</);
 assert.doesNotMatch(context.optionButton('both','Play both sides',true),/checkbox|input/);
});

test('historical comparisons fill the original move reply only for the matching active position',()=>{
 const {context,v,c}=setup();context.Chess=Chess;c.playedLine=[c.played];v.comparison=c;v.comparisonChoice='your';v.positions=comparisonPositions(c,'your');v.cursor=c.prefix.length;
 const fen=v.positions[v.cursor].fen;
 assert.equal(context.completeComparisonLine(v,new Chess().fen(),{pv:['b7a6']}),false);
 assert.equal(context.completeComparisonLine(v,fen,{pv:['b7a6']}),true);
 assert.equal(v.positions[v.cursor+1].san,'bxa6');
 assert.equal(context.completeComparisonLine(v,fen,{pv:['b7a6']}),false);
});
