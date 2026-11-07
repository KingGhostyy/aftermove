import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Chess} from 'chess.js';
import {linePositions,practicePosition} from '../public/practice.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const playback=app.slice(app.indexOf('function startPlayback('),app.indexOf('function showPracticeLine('));
function start(line,maxPly){
 const board=new Chess(),p={board,timeline:linePositions(board.fen(),line),cursor:0,busy:false,playing:false},pending=[],frames=[];
 const context={state:{practice:p,view:'practice'},playbackTimer:null,stopPlayback(){p.playing=false;},renderPractice(){frames.push({cursor:p.cursor,playable:practicePosition(p,'w').playable});},setTimeout(callback){pending.push(callback);return pending.length;}};
 vm.runInNewContext(playback+';this.startPlayback=startPlayback;',context);
 context.startPlayback(p,maxPly);return {p,pending,frames};
}
test('automatic reply unlocks your next move in the same frame it appears',()=>{
 const {p,pending,frames}=start(['e2e4','e7e5','g1f3','b8c6'],2);
 assert.equal(p.playing,true);pending.shift()();
 assert.equal(p.cursor,2);assert.equal(p.playing,false);assert.equal(frames.at(-1).playable,true);assert.equal(pending.length,0);
});
test('a line ending with your move does not leave an invisible playback lock',()=>{
 const {p,pending}=start(['e2e4'],2);assert.equal(p.playing,false);assert.equal(pending.length,0);
});
