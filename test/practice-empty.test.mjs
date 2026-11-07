import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function renderPractice(){'),app.indexOf('let playbackTimer=null;'));
test('exhausted fresh library stops with an explicit review choice',()=>{
 const view={innerHTML:''},review={};
 const context={practiceMode:'fresh',freshSession:{username:'Luke',list:[]},state:{username:'Luke'},reviewSeen:false,exercises:()=>[],practiceHeader:()=>'',bindPracticeModes:()=>{},allSavedGames:()=>[],puzzleHistory:()=>({}),freshExercises:()=>[],$:selector=>selector==='#view'?view:review};
 vm.runInNewContext(source+';renderPractice();',context);
 assert.match(view.innerHTML,/You’ve seen all available puzzles/);assert.match(view.innerHTML,/Review seen puzzles/);assert.doesNotMatch(view.innerHTML,/Try again from start/);
 assert.equal(context.reviewSeen,false);review.onclick();assert.equal(context.reviewSeen,true);assert.match(view.innerHTML,/No seen puzzles to review/);
});
