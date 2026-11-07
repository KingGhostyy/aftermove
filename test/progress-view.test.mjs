import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {progressSummary} from '../public/progress.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function renderProgress(){'),app.indexOf('function practiceHeader(){'));
test('choosing an empty format keeps that filter and displays no invented zero-rate success',()=>{
 const view={innerHTML:''},select={};
 const context={allSavedGames:()=>[{id:'one',date:1,opponent:'One',timeClass:'rapid',moves:[{loss:200}]}],progressFormat:'daily',progressSummary,state:{username:'Luke'},escape:String,$:selector=>selector==='#view'?view:select,document:{querySelectorAll:()=>[]}};
 vm.runInNewContext(source+';renderProgress();',context);
 assert.equal(context.progressFormat,'daily');assert.ok(view.innerHTML.includes('data-progress-format="daily" aria-pressed="true"'));assert.ok(view.innerHTML.includes('Analyze a game to start'));assert.ok(view.innerHTML.includes('<strong>—</strong>'));
});
