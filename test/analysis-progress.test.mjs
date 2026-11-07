import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('async function analyzeSelectedGames(){'),app.indexOf('function lossText('));
test('each analyzed game fills one whole bar and the next game starts at zero',async()=>{
 const elements=new Map(),updates=[];const element=selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector);};element('#username').value='ProgressQA';
 let percent=0;Object.defineProperty(element('#job-progress'),'value',{get:()=>percent,set:value=>{percent=value;updates.push({title:element('#job-title').textContent,value});}});
 const raw=[{url:'one',moves:2},{url:'two',moves:4}];const firstSearch=[];
 const context={state:{username:'ProgressQA',games:[],cache:new Map()},picker:{username:'ProgressQA',choices:raw,selected:new Set(['one','two'])},$:element,selectedGames:choices=>choices,stopEvaluation(){},AbortController,renderGamePicker(){},notice(){},db:null,ANALYSIS_VERSION:'test',parseGame:r=>({id:r.url,opponent:r.url,color:'w',moves:Array.from({length:r.moves},(_,i)=>({moveNumber:i+1,phase:'Opening',fen:r.url+':'+i,afterFen:r.url+':after:'+i}))}),Engine:class{async evaluate(fen){if(/^(one|two):0$/.test(fen))firstSearch.push({game:fen,percent});return {depth:14,score:0,pv:[],best:'e2e4'};}stop(){}},classifyMove:()=>({loss:0}),sleep:async()=>{},save:async()=>true,render(){},navigator:{},gameChoices:()=>[],SAVE_WARNING:'failed'};
 vm.runInNewContext(source,context);await context.analyzeSelectedGames();
 assert.deepEqual(firstSearch,[{game:'one:0',percent:0},{game:'two:0',percent:0}]);
 assert.deepEqual(updates.filter(p=>p.title?.includes('vs one')).map(p=>p.value),[0,50,100]);
 assert.deepEqual(updates.filter(p=>p.title?.includes('vs two')).map(p=>p.value),[0,25,50,75,100]);
});
