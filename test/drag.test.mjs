import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPieceDrag } from '../public/drag.js';
function fixture(orientation='w'){
  const handlers={},classes={add(){},remove(){}},piece={classList:classes,cloneNode(){return {classList:classes,style:{},remove(){}};}};
  const square={dataset:{square:'e2'},setPointerCapture(){board.captured=true;},classList:classes,querySelector:()=>piece};
  const board={addEventListener(n,h){handlers[n]=h;},querySelectorAll:()=>[],querySelector:()=>null,append(){},setPointerCapture(){this.captured=true;},getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})};
  const staleClasses=new Set(['legal-target','legal-capture']);const staleTarget={classList:{remove:(...names)=>names.forEach(name=>staleClasses.delete(name))}};board.querySelectorAll=selector=>selector==='.legal-target, .legal-capture'?[staleTarget]:[];
  const drops=[];attachPieceDrag(board,orientation,()=>true,(from,to)=>drops.push([from,to]));
  const event=(x,y,hasPiece=true)=>({button:0,pointerId:1,clientX:x,clientY:y,target:{closest:()=>hasPiece?square:null},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
  return {handlers,board,drops,event,staleClasses};
}
test('a missing synthetic drag click cannot swallow the next physical click',()=>{
  const {handlers:h,drops,event}=fixture();
  h.pointerdown(event(450,650));h.pointermove(event(450,450));h.pointerup(event(450,450));
  assert.deepEqual(drops,[['e2','e4']]);
  h.pointerdown(event(550,450,false));h.pointerup(event(550,450,false));
  const click=event(550,450,false);h.click(click);assert.equal(click.stopped,undefined);
});
test('small pointer movement within a square keeps normal click selection',()=>{
  const {handlers:h,board,drops,event}=fixture();
  h.pointerdown(event(450,650));h.pointermove(event(465,665));h.pointerup(event(465,665));
  assert.equal(board.captured,true);assert.deepEqual(drops,[]);
  const click=event(465,665);h.click(click);assert.equal(click.stopped,undefined);
});
test('a completed drag handles its move once and suppresses its synthetic click',()=>{
  const {handlers:h,drops,event}=fixture();
  h.pointerdown(event(450,650));h.pointermove(event(450,450));h.pointerup(event(450,450));
  const click=event(450,450);h.click(click);assert.equal(click.stopped,true);assert.equal(drops.length,1);
});

test('a quick drag still moves on the first attempt when no pointermove event arrives',()=>{
 const {handlers:h,drops,event}=fixture();
 h.pointerdown(event(450,650));h.pointerup(event(450,450));
 assert.deepEqual(drops,[['e2','e4']]);
 const click=event(450,450);h.click(click);assert.equal(click.stopped,true);
});

test('drag tracking starts on the pressed square before any movement',()=>{
 const {handlers:h,board,event}=fixture();h.pointerdown(event(450,650));assert.equal(board.captured,true);
});
test('an unrelated lost-capture event cannot cancel a quick drag',()=>{
 const {handlers:h,drops,event}=fixture();h.pointerdown(event(450,650));h.lostpointercapture({...event(450,650),target:{}});h.pointerup(event(401,401));assert.deepEqual(drops,[['e2','e4']]);
});
test('every part of the target square accepts a fast drop, including its corners',()=>{
 for(const [x,y] of [[400.1,400.1],[499.9,400.1],[400.1,499.9],[499.9,499.9]]){const {handlers:h,drops,event}=fixture();h.pointerdown(event(450,650));h.pointerup(event(x,y));assert.deepEqual(drops,[['e2','e4']]);}
});

test('starting a drag clears target tints from the previously selected piece',()=>{
 const {handlers:h,event,staleClasses}=fixture();h.pointerdown(event(450,650));assert.equal(staleClasses.size,0);
});

test('quick corner drops work when the board is flipped',()=>{
 for(const [x,y] of [[300.1,300.1],[399.9,300.1],[300.1,399.9],[399.9,399.9]]){const {handlers:h,drops,event}=fixture('b');h.pointerdown(event(350,150));h.pointerup(event(x,y));assert.deepEqual(drops,[['e2','e4']]);}
});
