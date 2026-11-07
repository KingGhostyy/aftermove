import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {searchingEval,evalDisplay} from '../public/eval.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function evalBoard('),app.indexOf('function requestEvaluation('));
function fixture(){
 const fill={style:{}},score={textContent:''},caption={textContent:''},attributes={};
 const bar={querySelector:s=>s==='.eval-white'?fill:score,setAttribute:(key,value)=>attributes[key]=value};
 const context={searchingEval,lastEvalScore:-363,escape:String,$:selector=>selector==='.eval-bar'?bar:caption};vm.runInNewContext(source,context);return {context,fill,score,caption,attributes};
}
test('refreshing eval retains its last fill and score and renders a visible pending badge',()=>{
 const {context,fill,score,attributes}=fixture();
 const html=context.evalBoard('<div>board</div>','w');assert.match(html,/class="eval-refresh"/);assert.doesNotMatch(html,/⌛|⏳/);assert.match(html,/aria-busy="true"/);
 context.paintEval(undefined);assert.equal(fill.style.height,evalDisplay(-363).whitePercent+'%');assert.equal(score.textContent,'-3.63');assert.equal(attributes['aria-busy'],'true');
 context.paintEval(125);assert.equal(score.textContent,'+1.25');assert.equal(attributes['aria-busy'],'false');
 context.paintEval(undefined);assert.equal(score.textContent,'+1.25');assert.equal(fill.style.height,evalDisplay(125).whitePercent+'%');
});
test('an unavailable eval keeps the old score and stops the refreshing indicator',()=>{
 const {context,score,caption,attributes}=fixture();context.paintEval(undefined);context.paintEvalUnavailable();assert.equal(score.textContent,'-3.63');assert.equal(attributes['aria-busy'],'false');assert.match(caption.textContent,/unavailable/);
});
