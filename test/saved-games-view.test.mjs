import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {savedGameCollection} from '../public/progress.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function setup(batch){
 const older={id:'old',date:1,moves:[{ply:0,loss:0}]},newer={id:'new',date:3,moves:[{ply:0,loss:0}]};
 const state={username:'Luke',view:'games',games:batch?[newer]:[],cache:new Map([['old',older],['new',{...newer,date:2}]])};
 const elements=new Map(),$=selector=>{if(!elements.has(selector))elements.set(selector,{addEventListener(){}});return elements.get(selector);};
 const review={dataset:{id:'old'}},context={state,$,savedGameCollection,document:{body:{classList:{remove(){}}},querySelectorAll:selector=>selector==='.review'?[review]:[]},exercises:()=>[],renderGamePicker(){},gameTable:games=>{context.shown=games;return 'table';},emptyState:()=> 'empty',renderReview(){},lastEvalScore:0};
 vm.runInNewContext(app.slice(app.indexOf('function render(){'),app.indexOf('function renderGamePicker(){')),context);
 return {context,state,$,review,older,newer};
}
test('Your games and its badge include all saved batches, newest first, without duplicate games',()=>{
 const {context,state,$,review,older,newer}=setup(true);context.render();
 assert.deepEqual(context.shown.map(g=>g.id),['new','old']);assert.equal(context.shown[0],newer);assert.equal($('#game-count').textContent,2);
 review.onclick();assert.equal(state.review.game,older);assert.deepEqual(state.games,[newer]);
});
test('older saved games remain visible even when the latest batch is empty',()=>{
 const {context,$}=setup(false);context.render();assert.equal(context.shown.length,2);assert.equal($('#game-count').textContent,2);
});
