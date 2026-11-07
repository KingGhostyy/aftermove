import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Chess} from 'chess.js';
import {linePositions,extendPracticeLine,explainMove} from '../public/practice.js';
import {createCorrection,replacementPositions} from '../public/corrections.js';
import {variationBoard} from '../public/variation-engine.js';
import {assessAlternative} from '../public/feedback.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const root=new Chess().fen(),prefix=linePositions(root,['e2e4','e7e5']).map((p,i)=>({...p,uci:['','e2e4','e7e5'][i]})),fen=prefix.at(-1).fen;
const correction=()=>createCorrection(prefix,fen,'f1c4','g1f3',['g1f3','b8c6'],{category:'Mistake',message:'A stronger move is available.'});
const oldLine=()=>linePositions(root,['e2e4','e7e5','f1c4','g8f6']);
test('Practice best move replaces the attempt and reply from the latest turn',()=>{
 const p={timeline:oldLine(),cursor:4,correction:correction(),arrows:[{}]};let reply;
 const context={state:{practice:p,view:'practice'},replacementPositions,explainMove,stopPlayback(){},stopEvaluation(){},showPracticeLine:(p,fen,line)=>extendPracticeLine(p,fen,line),startPlayback:(_p,max)=>reply=max};
 vm.runInNewContext(app.slice(app.indexOf('function applyPracticeBest(){'),app.indexOf('function stepPractice(')),context);context.applyPracticeBest();
 assert.deepEqual(p.timeline.map(m=>m.san),['Start','e4','e5','Nf3','Nc6']);assert.equal(p.cursor,3);assert.equal(reply,2);assert.equal(p.correction,null);assert.equal(p.category,'Best move');
});
function variation(){
 const v={positions:oldLine(),cursor:4,correction:correction(),auto:false},r={variation:v};
 const context={state:{review:r,running:false},Chess,variationBoard,replacementPositions,stopEvaluation(){},clearTimeout(){},renderReview(){}};
 vm.runInNewContext(app.slice(app.indexOf('function cancelVariation(){'),app.indexOf('function renderPractice(){')),context);return {v,r,context};
}
test('variation best move discards the opponent reply and preserves earlier moves and auto-reply setting',()=>{
 const {v,context}=variation();let automatic=false;context.replyVariation=options=>automatic=options.automatic;
 context.applyVariationBest();assert.deepEqual(v.positions.map(p=>p.san),['Start','e4','e5','Nf3']);assert.equal(v.cursor,3);assert.equal(v.correction,null);assert.equal(automatic,false);
 v.positions=oldLine();v.cursor=4;v.correction=correction();v.auto=true;context.applyVariationBest();assert.equal(automatic,true);
});
test('a later variation comparison offers a correction, but a cancelled comparison cannot publish one',async()=>{
 const {v,r,context}=variation();v.correction=null;const candidate={score:0,depth:14,pv:['b8c6']},best={score:300,depth:14,pv:['b8c6']};v.analysis={peek:()=>candidate};
 Object.assign(context,{navigator:{},createCorrection,assessAlternative,evalCache:new Map(),$:()=>null,VariationAnalysis:class{async get(){return best;}cancel(){}}});
 const attempt={fen,played:'f1c4',prefix,source:{best:'g1f3'},chosenFen:oldLine()[3].fen};v.attempt=attempt;v.checkingMove=true;
 await context.reviewVariationMove(r,v,attempt);assert.equal(v.correction.best,'g1f3');assert.equal(v.checkingMove,false);
 let finish;context.VariationAnalysis=class{get(){return new Promise(resolve=>finish=resolve);}cancel(){}};v.correction=null;v.attempt=attempt;
 const pending=context.reviewVariationMove(r,v,attempt);context.cancelMoveReview(v);finish(best);await pending;assert.equal(v.correction,null);assert.equal(v.checkingMove,false);
});

test('asking for a root hint clears a later-turn correction',()=>{
 const p={cursor:4,correction:correction()},button={},context={p,ex:{fen:root,best:'e2e4'},Chess,names:{p:'pawn'},$:()=>button,stopPlayback(){},renderPractice(){},document:{querySelector:()=>null}};
 vm.runInNewContext(app.slice(app.indexOf("$('#hint').onclick="),app.indexOf("$('#reveal').onclick=")),context);button.onclick();assert.equal(p.cursor,0);assert.equal(p.correction,null);
});
