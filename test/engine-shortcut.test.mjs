import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function setup(variation=false){
 let clicks=0;const page={scrollTop:120},button={disabled:false,click(){clicks++;page.scrollTop=700;}},context={requestAnimationFrame:callback=>callback(),document:{scrollingElement:page},state:{view:'games',review:{variation:variation?{}:null}},$:selector=>selector===(variation?'#variation-engine':'#review-engine')?button:null};
 const code=app.slice(app.indexOf('let engineSpaceHeld='),app.indexOf("document.addEventListener('keydown',engineMoveShortcut)"));vm.runInNewContext(code,context);
 const event=(extra={})=>({key:' ',code:'Space',target:{closest:()=>null},preventDefault(){this.prevented=true;},...extra});
 return {context,button,event,clicks:()=>clicks};
}
test('Space plays the visible engine action and suppresses scrolling and keyup activation',()=>{
 for(const variation of [false,true]){const {context,event,clicks}=setup(variation),down=event(),up=event();context.engineMoveShortcut(down);context.releaseEngineSpace(up);assert.equal(clicks(),1);assert.equal(down.prevented,true);assert.equal(up.prevented,true);assert.equal(context.document.scrollingElement.scrollTop,120);}
});
test('held Space and busy engine buttons do not play extra moves or scroll',()=>{
 const {context,button,event,clicks}=setup(true);const repeated=event({repeat:true});context.engineMoveShortcut(repeated);assert.equal(clicks(),0);assert.equal(repeated.prevented,true);
 button.disabled=true;const busy=event();context.engineMoveShortcut(busy);assert.equal(clicks(),0);assert.equal(busy.prevented,true);
});
test('typing, modifier shortcuts, and other pages keep their normal Space behavior',()=>{
 const {context,event,clicks}=setup();
 for(const extra of [{target:{closest:()=>({})}},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{defaultPrevented:true}]){const e=event(extra);context.engineMoveShortcut(e);assert.equal(e.prevented,undefined);}
 context.state.view='overview';const outside=event();context.engineMoveShortcut(outside);assert.equal(outside.prevented,undefined);assert.equal(clicks(),0);
});
