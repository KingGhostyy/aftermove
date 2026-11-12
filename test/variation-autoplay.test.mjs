import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Chess} from 'chess.js';
import {playedMoveInsight} from '../public/insights.js';
import {variationBoard} from '../public/variation-engine.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const code=app.slice(app.indexOf('function coachingMarkup('),app.indexOf('function renderPractice(){'));
function setup(){
 const v={positions:[{fen:new Chess().fen(),san:'Start'}],cursor:0,autoBoth:true,auto:false,busy:false},r={variation:v},timers=new Map();let id=0;
 const context={state:{review:r,running:false},playedMoveInsight,variationBoard,Chess,stopEvaluation(){},clearTimeout:id=>timers.delete(id),setTimeout:callback=>{timers.set(++id,callback);return id;},renderReview:()=>context.scheduleVariation(v)};
 vm.runInNewContext(code,context);return {v,r,timers,context};
}
test('both-side autoplay makes consecutive White and Black moves and stops immediately on cancel',async()=>{
 const {v,timers,context}=setup(),moves=['e2e4','e7e5','g1f3'];
 const analysis={get:async()=>({best:moves.shift()}),cancel(){}};v.analysis=analysis;context.variationAnalysis=()=>analysis;
 context.scheduleVariation(v);
 for(let i=1;i<=3;i++){assert.equal(timers.size,1);const [id,callback]=timers.entries().next().value;timers.delete(id);callback();await new Promise(setImmediate);assert.equal(v.cursor,i);}
 assert.deepEqual(v.positions.slice(1).map(p=>p.uci),['e2e4','e7e5','g1f3']);
 context.cancelVariation();assert.equal(v.autoBoth,false);assert.equal(timers.size,0);
});
test('navigation during thinking rejects a late engine move and pauses autoplay',async()=>{
 const {v,timers,context}=setup();let finish;const analysis={get:()=>new Promise(resolve=>finish=resolve),cancel(){}};v.analysis=analysis;context.variationAnalysis=()=>analysis;
 const pending=context.replyVariation();assert.equal(v.busy,true);context.stepVariation(-1);finish({best:'e2e4'});await pending;
 assert.equal(v.cursor,0);assert.equal(v.positions.length,1);assert.equal(v.busy,false);assert.equal(v.autoBoth,false);assert.equal(timers.size,0);
});
test('autoplay does not schedule another move after a terminal position',()=>{
 const {v,timers,context}=setup();v.positions=[{fen:'7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'}];context.scheduleVariation(v);assert.equal(timers.size,0);
});

test('ready suggestions render using actual SAN text with hints on or off',async()=>{
 const {sanLine}=await import('../public/analysis.js');const {v,r,context}=setup();v.autoBoth=false;r.game={color:'w',moves:[{moveNumber:1}]};r.index=0;
 const elements=new Map(),view={innerHTML:''};const result={best:'e2e4',score:20};let suggested;
 Object.assign(context,{sanLine,variationAnalysis:()=>({get:()=>Promise.resolve(result),peek:()=>result}),$:selector=>selector==='#view'?view:elements.get(selector)||(()=>{const el={addEventListener(){}};elements.set(selector,el);return el;})(),escape:String,evalBoard:()=>'',boardMarkup:()=>'',attachArrows:(_board,_color,_model,arrow)=>{suggested=arrow;return {setSuggestion(){}};},paintEval(){},evalCache:new Map(),attachPieceDrag(){},document:{querySelectorAll:()=>[]}});
 context.renderVariation();assert.equal(suggested,null);assert.match(view.innerHTML,/Next engine move ready/);
 v.showSuggestion=true;context.renderVariation();assert.equal(suggested.from,'e2');assert.equal(suggested.to,'e4');assert.match(view.innerHTML,/Suggestion: e4/);
});

test('returning to original game cancels pending work and preserves the selected game move',()=>{
 const {v,r,timers,context}=setup();let cancelled=0,rendered=0,stopped=0;
 r.index=4;r.position={ply:9,fen:'selected original position'};
 v.analysis={cancel(){cancelled++;}};
 context.renderReview=()=>rendered++;context.stopEvaluation=()=>stopped++;
 context.scheduleVariation(v);assert.equal(timers.size,1);
 context.returnToOriginalGame();
 assert.equal(r.variation,null);assert.equal(r.index,4);assert.equal(r.position.ply,9);
 assert.equal(timers.size,0);assert.equal(cancelled,1);assert.equal(stopped,1);assert.equal(rendered,1);
});
