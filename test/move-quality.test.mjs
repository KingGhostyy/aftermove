import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {gameThinkingSummary} from '../public/timing.js';
import {reviewMoveStatus} from '../public/review.js';
const analyzed={uci:'e2e4',best:'e2e4',loss:0,label:'Sound',beforeScore:100,afterScore:100,depth:14,afterDepth:14};
test('uncolored moves explain neutral or missing analysis and mate positions retain grades',()=>{
 assert.equal(reviewMoveStatus({...analyzed,uci:'d2d4',loss:35}).label,'Neutral');
 for(const move of [undefined,{...analyzed,depth:4},{...analyzed,best:null}])assert.equal(reviewMoveStatus(move).label,'Not analyzed');
 for(const [color,score] of [['w',-99995],['b',99995]]){const status=reviewMoveStatus({...analyzed,color,beforeScore:score,afterScore:score});assert.equal(status.label,'Best');assert.equal(status.forcedMate,true);}
 assert.equal(reviewMoveStatus({...analyzed,loss:200}).label,'Blunder');
 assert.equal(reviewMoveStatus(analyzed).label,'Best');
});
test('best and good moves require analyzed evidence while ordinary moves remain unmarked',async()=>{
 const {reviewMoveQuality}=await import('../public/review.js');
 assert.equal(reviewMoveQuality(analyzed).label,'Best');
 assert.equal(reviewMoveQuality({...analyzed,uci:'d2d4',loss:15,afterScore:85}).label,'Good');
 assert.equal(reviewMoveQuality({...analyzed,uci:'d2d4',loss:35,afterScore:65}),null);
 assert.equal(reviewMoveQuality({...analyzed,color:'b',uci:'d7d5',best:'e7e5',loss:15,beforeScore:-100,afterScore:-85}).label,'Good');
 assert.equal(reviewMoveQuality({...analyzed,color:'b',beforeScore:99995,afterScore:99990}).label,'Best');
 for(const fields of [{depth:4},{afterDepth:4},{best:null},{beforeScore:undefined},{mateLost:true}])assert.equal(reviewMoveQuality({...analyzed,...fields}),null);
});
test('negative move grades keep the existing thresholds',async()=>{
 const {reviewMoveQuality}=await import('../public/review.js');
 for(const [loss,label,tone] of [[50,'Inaccuracy','inaccuracy'],[100,'Mistake','mistake'],[200,'Blunder','blunder']])assert.deepEqual(reviewMoveQuality({...analyzed,loss}),{label,tone});
});
test('move rows rate both colors while ordinary moves remain neutral',async()=>{
 const {reviewMoveQuality}=await import('../public/review.js');const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const moves=[{...analyzed,ply:0,moveNumber:1,san:'e4',color:'w',thinkSeconds:42},{...analyzed,uci:'g1f3',best:'f1c4',loss:35,ply:2,moveNumber:2,san:'Nf3',color:'w',thinkSeconds:8}];
 const game={color:'w',moves,history:[moves[0],{...analyzed,uci:'e7e5',best:'e7e5',ply:1,moveNumber:1,san:'e5',color:'b'},moves[1]]};
 const context={gameThinkingSummary,reviewMoveQuality,reviewMoveStatus,reviewMoves:g=>g.history,state:{review:{}},deepJob:null,escape:String};
 vm.runInNewContext(app.slice(app.indexOf('function reviewMovePanel('),app.indexOf('function renderReview(){')),context);
 const html=context.reviewMovePanel(game,0,false);
 assert.match(html,/data-quality="best"/);assert.match(html,/Best/);assert.match(html,/42.0s/);assert.match(html,/Longest think:.*Best/);
 const cell=ply=>html.match(new RegExp('<button[^>]*data-review-ply="'+ply+'"[^>]*>[\\s\\S]*?<\\/button>'))[0];
 assert.match(cell(1),/data-quality="best"/);assert.match(cell(2),/Neutral/);
 const panel=context.reviewThinkingPanel(game);assert.match(panel,/Best/);assert.match(panel,/42.0s/);
});

test('miss has a distinct grade for both sides, including missed mate',async()=>{
 const {reviewMoveQuality}=await import('../public/review.js');
 for(const [color,beforeScore,afterScore] of [['w',300,0],['b',-300,0],['w',99995,0]])assert.equal(reviewMoveQuality({...analyzed,color,beforeScore,afterScore,loss:300}).tone,'miss');
});
