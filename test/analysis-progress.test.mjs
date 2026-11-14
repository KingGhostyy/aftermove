import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parseGame} from '../public/analysis.js';
import {analyzeFullGame} from '../public/full-analysis.js';
import {savedGameCollection} from '../public/progress.js';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('async function analyzeSelectedGames(){'),app.indexOf('function lossText('));
test('each analyzed game fills one whole bar and the next game starts at zero',async()=>{
 const elements=new Map(),updates=[];const element=selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector);};element('#username').value='ProgressQA';
 let percent=0;Object.defineProperty(element('#job-progress'),'value',{get:()=>percent,set:value=>{percent=value;updates.push({title:element('#job-title').textContent,value});}});
 const raw=[{url:'one',pgn:'1. e4 e5 *'},{url:'two',pgn:'1. e4 e5 2. Nf3 Nc6 *'}].map(r=>({...r,white:{username:'ProgressQA'},black:{username:r.url}}));const firstSearch=[];
 const context={state:{username:'ProgressQA',games:[],cache:new Map()},picker:{username:'ProgressQA',choices:raw,selected:new Set(['one','two'])},$:element,selectedGames:choices=>choices,stopEvaluation(){},AbortController,renderGamePicker(){},notice(){},db:null,ANALYSIS_VERSION:'test',parseGame,analyzeFullGame,savedGameCollection,Engine:class{async evaluate(fen){if(fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'))firstSearch.push({game:element('#job-title').textContent.endsWith('vs one')?'one:0':'two:0',percent});return {depth:14,score:0,pv:[],best:'e2e4'};}stop(){}},classifyMove:()=>({loss:0}),sleep:async()=>{},save:async()=>true,render(){},navigator:{},gameChoices:()=>[],SAVE_WARNING:'failed'};
 vm.runInNewContext(source,context);await context.analyzeSelectedGames();
 assert.deepEqual(firstSearch,[{game:'one:0',percent:0},{game:'two:0',percent:0}]);
 assert.deepEqual(updates.filter(p=>p.title?.includes('vs one')).map(p=>p.value),[0,0,50,100]);
 assert.deepEqual(updates.filter(p=>p.title?.includes('vs two')).map(p=>p.value),[0,0,25,50,75,100]);
});
