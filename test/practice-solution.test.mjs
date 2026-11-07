import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Chess} from 'chess.js';
import {linePositions,practicePosition,solutionContinuation,extendPracticeLine,explainMove} from '../public/practice.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const handler=app.slice(app.indexOf('async function clickSquare('),app.indexOf('async function initialize('));
test('playing the solution capture on the second turn is Good move and preserves the preceding moves',async()=>{
 const ex={fen:'6k1/8/8/8/4n3/7Q/8/3R3K b - - 0 1',pv:['e4f2','h1h2','f2h3','h2h3'],color:'b',best:'e4f2'};
 const p={board:new Chess(ex.fen),timeline:linePositions(ex.fen,ex.pv),cursor:2,selected:'f2',busy:false};let playback=0;
 const context={state:{practice:p,view:'practice',running:false},Chess,practicePosition,solutionContinuation,stopPlayback:()=>{},showPracticeLine:(p,fen,line)=>{extendPracticeLine(p,fen,line);p.explanation=explainMove(fen,line);},startPlayback:()=>playback++,Engine:class{constructor(){throw Error('Known solution must not be graded as an alternative');}}};
 vm.runInNewContext(handler,context);await context.clickSquare('h3',ex);
 assert.equal(p.category,'Good move');assert.match(p.feedback,/matches the solution/);assert.equal(playback,1);
 assert.deepEqual(p.timeline.map(m=>m.san),['Start','Nf2+','Kh2','Nxh3','Kxh3']);assert.equal(p.cursor,3);assert.equal(p.attempted,true);
});
