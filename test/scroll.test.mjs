import test from 'node:test';
import assert from 'node:assert/strict';
import {captureReviewScroll,restoreReviewScroll} from '../public/scroll.js';
test('selecting a visible late move preserves both page and list positions',()=>{
 const page={scrollTop:320,scrollLeft:0},oldList={scrollTop:920};
 const saved=captureReviewScroll(page,oldList);page.scrollTop=0;
 const list={scrollTop:0,clientHeight:355};
 restoreReviewScroll(page,list,{offsetTop:1050,offsetHeight:48},saved);
 assert.equal(list.scrollTop,920);assert.equal(page.scrollTop,320);
});
test('keyboard navigation below the visible list reveals only the new row',()=>{
 const page={scrollTop:200,scrollLeft:0},list={scrollTop:0,clientHeight:300};
 restoreReviewScroll(page,list,{offsetTop:1220,offsetHeight:40},{pageTop:200,pageLeft:0,listTop:920});
 assert.equal(list.scrollTop,966);assert.equal(page.scrollTop,200);
});
test('navigation above the visible list reveals the preceding row without recentering',()=>{
 const page={scrollTop:100,scrollLeft:0},list={scrollTop:0,clientHeight:300};
 restoreReviewScroll(page,list,{offsetTop:880,offsetHeight:40},{pageTop:100,pageLeft:0,listTop:920});
 assert.equal(list.scrollTop,874);assert.equal(page.scrollTop,100);
});
test('initial late-move selection is visible and missing selection retains manual scroll',()=>{
 const page={scrollTop:40,scrollLeft:0},list={scrollTop:0,clientHeight:300};
 restoreReviewScroll(page,list,{offsetTop:1400,offsetHeight:40},null);
 assert.equal(list.scrollTop,1146);assert.equal(page.scrollTop,40);
 restoreReviewScroll(page,list,null,{pageTop:90,pageLeft:0,listTop:700});
 assert.equal(list.scrollTop,700);assert.equal(page.scrollTop,90);
});

test('unrelated board or engine refreshes preserve manually scrolled list position',()=>{
 const page={scrollTop:240,scrollLeft:0},list={scrollTop:0,clientHeight:300};
 restoreReviewScroll(page,list,{offsetTop:50,offsetHeight:40},{pageTop:240,pageLeft:0,listTop:1200},false);
 assert.equal(list.scrollTop,1200);assert.equal(page.scrollTop,240);
});
