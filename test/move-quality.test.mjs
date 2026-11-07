import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {gameThinkingSummary} from '../public/timing.js';
const analyzed={uci:'e2e4',best:'e2e4',loss:0,label:'Sound',beforeScore:100,afterScore:100,depth:14,afterDepth:14};
test('best and good moves require analyzed evidence while ordinary moves remain unmarked',async()=>{
 const {reviewMoveQuality}=await import('../public/review.js');
 assert.equal(reviewMoveQuality(analyzed).label,'Best');
 assert.equal(reviewMoveQuality({...analyzed,uci:'d2d4',loss:15,afterScore:85}).label,'Good');
 assert.equal(reviewMoveQuality({...analyzed,uci:'d2d4',loss:35,afterScore:65}),null);
 assert.equal(reviewMoveQuality({...analyzed,color:'b',uci:'d7d5',best:'e7e5',loss:15,beforeScore:-100,afterScore:-85}).label,'Good');
 assert.equal(reviewMoveQuality({...analyzed,color:'b',beforeScore:99995,afterScore:99990}),null);
 for(const fields of [{depth:4},{afterDepth:4},{best:null},{beforeScore:undefined},{mateLost:true},{beforeScore:-99995,afterScore:-99990,matePosition:true}])assert.equal(reviewMoveQuality({...analyzed,...fields}),null);
});
test('negative move grades keep the existing thresholds',async()=>{
 const {reviewMoveQuality}=await import('../public/review.js');
 for(const [loss,label,tone] of [[50,'Inaccuracy','inaccuracy'],[100,'Mistake','mistake'],[200,'Blunder','blunder']])assert.deepEqual(reviewMoveQuality({...analyzed,loss}),{label,tone});
});
test('move rows show quality with seconds, keep ordinary moves neutral, and leave opponents unrated',async()=>{
 const {reviewMoveQuality}=await import('../public/review.js');const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const moves=[{...analyzed,ply:0,moveNumber:1,san:'e4',color:'w',thinkSeconds:42},{...analyzed,uci:'g1f3',best:'f1c4',loss:35,ply:2,moveNumber:2,san:'Nf3',color:'w',thinkSeconds:8}];
 const game={color:'w',moves,history:[moves[0],{ply:1,moveNumber:1,san:'e5',color:'b'},moves[1]]};
 const context={gameThinkingSummary,reviewMoveQuality,reviewMoves:g=>g.history,state:{review:{}},deepJob:null,escape:String};
 vm.runInNewContext(app.slice(app.indexOf('function reviewMovePanel('),app.indexOf('function renderReview(){')),context);
 const html=context.reviewMovePanel(game,0,false);
 assert.match(html,/data-quality="best"/);assert.match(html,/Best/);assert.match(html,/42.0s/);assert.match(html,/Longest think:.*Best/);
 const cell=ply=>html.match(new RegExp('<button[^>]*data-review-ply="'+ply+'"[^>]*>[\\s\\S]*?<\\/button>'))[0];
 assert.doesNotMatch(cell(1),/data-quality="best"|quality-label/);assert.doesNotMatch(cell(2),/quality-label/);
 const panel=context.reviewThinkingPanel(game);assert.match(panel,/Best/);assert.match(panel,/42.0s/);
});
