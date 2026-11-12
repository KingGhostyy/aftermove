import test from 'node:test';
import assert from 'node:assert/strict';
import { linePositions, explainMove, squarePoint, toggleArrow, attachArrows } from '../public/practice.js';

test('continuations preserve start and advance one legal half-move at a time',()=>{
  const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const line=linePositions(fen,['e2e4','e7e5','bad']);
  assert.equal(line.length,3);
  assert.equal(line[0].fen,fen);
  assert.equal(line[1].san,'e4');
  assert.equal(line[2].san,'e5');
  assert.equal(line[1].fen.split(' ')[1],'b');
});
test('arrows map both orientations and toggle without changing existing arrows',()=>{
  assert.deepEqual(squarePoint('a8','w'),[0.5,0.5]);
  assert.deepEqual(squarePoint('a8','b'),[7.5,7.5]);
  const arrows=toggleArrow([],'e2','e4');
  assert.deepEqual(arrows,[{from:'e2',to:'e4'}]);
  assert.deepEqual(toggleArrow(arrows,'e2','e4'),[]);
  assert.equal(arrows.length,1);
});
test('coaching explains a demonstrated mate rather than only its score',()=>{
  const fen='7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
  assert.match(explainMove(fen,['g6g7']),/checkmate/i);
});
test('coaching identifies a captured piece and opponent reply in the line',()=>{
  const fen='4k3/8/8/8/8/8/4q3/4R1K1 w - - 0 1';
  assert.match(explainMove(fen,['e1e2','e8d7']),/captures.*queen.*e2/i);
  assert.match(explainMove(fen,['e1e2','e8d7']),/Kd7/);
});
test('coaching treats stalemate as a draw, never as a winning check',()=>{
  assert.match(explainMove('7k/8/5KQ1/8/8/8/8/8 w - - 0 1',['g6f7']),/stalemate.*draw/i);
});

test('quiet king moves explain newly controlled squares',()=>{
  assert.match(explainMove('8/4bp2/4k3/8/7p/5K2/8/8 b - - 0 42',['e6f5','f3f2']),/controls e4, f4, g4/);
});

test('right-button pointer gesture draws, toggles, cancels and clears annotations',()=>{
  const element=()=>({children:[],attrs:{},handlers:{},namespaceURI:'http://www.w3.org/2000/svg',classList:{add(){}},setAttribute(k,v){this.attrs[k]=String(v);},append(node){this.children.push(node);},replaceChildren(){this.children=[];},addEventListener(name,handler){this.handlers[name]=handler;},setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:800,height:800};}});
  globalThis.document={createElementNS:element};
  try{
    const board=element(),model={arrows:[]},clear=attachArrows(board,'w',model);
    const event=(x,y,button=2)=>({clientX:x,clientY:y,button,pointerId:1,preventDefault(){}});
    const draw=()=>{board.handlers.pointerdown(event(450,650));board.handlers.pointermove(event(450,450));board.handlers.pointerup(event(450,450));};
    draw();assert.deepEqual(model.arrows,[{from:'e2',to:'e4'}]);
    assert.equal(board.children[0].children.length,2);
    draw();assert.deepEqual(model.arrows,[]);
    board.handlers.pointerdown(event(450,650));board.handlers.pointercancel();assert.deepEqual(model.arrows,[]);
    board.handlers.pointerdown(event(450,650,0));board.handlers.pointerup(event(450,450,0));assert.deepEqual(model.arrows,[]);
    draw();board.handlers.pointerdown(event(450,650,0));assert.deepEqual(model.arrows,[]);
    draw();clear();assert.deepEqual(model.arrows,[]);assert.equal(board.children[0].children.length,0);
    clear.setSuggestion({from:'e2',to:'e4'});assert.equal(board.children[0].children.length,2);assert.deepEqual(model.arrows,[]);
    board.handlers.pointerdown(event(450,650,0));assert.equal(board.children[0].children.length,2);
    clear.setSuggestion(null);assert.equal(board.children[0].children.length,0);
    let dismissed=0;clear.onIdeasCleared=()=>dismissed++;
    clear.setIdeas([{from:'a8',to:'a3',tone:'risk'}]);assert.equal(board.children[0].children.length,2);
    board.handlers.pointerdown(event(450,650,0));assert.equal(board.children[0].children.length,0);assert.equal(model.showIdeas,false);assert.equal(dismissed,1);
    clear.setIdeas([{from:'e2',to:'e4',tone:'idea'}]);clear();assert.equal(board.children[0].children.length,0);assert.equal(dismissed,2);
  }finally{delete globalThis.document;}
});

test('continuations preserve all four promotion choices',()=>{
 const fen='7k/P7/7K/8/8/8/8/8 w - - 0 1';
 for(const piece of ['q','r','b','n']){
  const positions=linePositions(fen,['a7a8'+piece]);assert.equal(positions.length,2);assert.ok(positions[1].fen.startsWith(piece.toUpperCase()));
 }
});
test('castling continuation moves both king and rook',()=>{
 const positions=linePositions('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',['e1g1']);
 assert.equal(positions.length,2);assert.equal(positions[1].fen.split(' ')[0].split('/').at(-1),'R4RK1');
});
test('en passant continuation removes the captured pawn and explains the right square',()=>{
 const fen='4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',positions=linePositions(fen,['e5d6']);
 assert.equal(positions.length,2);assert.ok(!positions[1].fen.includes('p'));assert.match(explainMove(fen,['e5d6']),/pawn on d5 en passant/);
});

test('practice remains playable after the first answer and engine reply, including a new branch',async()=>{
 const {practicePosition,extendPracticeLine}=await import('../public/practice.js');
 const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
 const p={board:{fen:()=>fen},cursor:0,solved:true,busy:false,playing:false};
 extendPracticeLine(p,fen,['e2e4','e7e5','g1f3']);p.cursor=2;
 assert.equal(practicePosition(p,'w').playable,true);
 extendPracticeLine(p,practicePosition(p,'w').board.fen(),['f1c4','g8f6']);p.cursor=4;
 assert.equal(practicePosition(p,'w').playable,true);
 assert.deepEqual(p.timeline.map(m=>m.san),['Start','e4','e5','Bc4','Nf6']);
 p.cursor=2;extendPracticeLine(p,practicePosition(p,'w').board.fen(),['g1f3','b8c6']);
 assert.deepEqual(p.timeline.map(m=>m.san),['Start','e4','e5','Nf3','Nc6']);
 p.cursor=3;assert.equal(practicePosition(p,'w').playable,false);
 p.cursor=4;p.busy=true;assert.equal(practicePosition(p,'w').playable,false);
 p.busy=false;p.playing=true;assert.equal(practicePosition(p,'w').playable,false);
});

test('practice shows the played position before analysis, then adds the reply without duplicating the move',async()=>{
 const {Chess}=await import('chess.js');
 const {practicePosition,extendPracticeLine}=await import('../public/practice.js');
 const board=new Chess(),fen=board.fen(),p={board,cursor:0,busy:true};
 extendPracticeLine(p,fen,['e2e4']);
 assert.equal(practicePosition(p,'w').board.get('e4').type,'p');
 assert.equal(practicePosition(p,'w').board.get('e2'),undefined);
 assert.equal(p.cursor,1);
 extendPracticeLine(p,fen,['e2e4','e7e5'],0);
 assert.deepEqual(p.timeline.map(m=>m.san),['Start','e4','e5']);
 p.cursor=2;const nextFen=practicePosition(p,'w').board.fen();
 extendPracticeLine(p,nextFen,['g1f3']);
 assert.equal(practicePosition(p,'w').board.get('f3').type,'n');
 extendPracticeLine(p,nextFen,['g1f3','b8c6'],2);
 assert.deepEqual(p.timeline.map(m=>m.san),['Start','e4','e5','Nf3','Nc6']);
});

test('retry appears only after the player moves and is away from the start',async()=>{
 const {practiceHasStarted}=await import('../public/practice.js');
 assert.equal(practiceHasStarted({selected:'e2',feedback:'hint',timeline:null}),false);
 assert.equal(practiceHasStarted({timeline:[{fen:'start'}]}),false);
 assert.equal(practiceHasStarted({attempted:true,timeline:[{fen:'start'},{fen:'moved'}],cursor:0}),false);
 assert.equal(practiceHasStarted({attempted:true,timeline:[{fen:'start'},{fen:'moved'}],cursor:1}),true);
 assert.equal(practiceHasStarted({revealed:true,timeline:[{fen:'start'},{fen:'moved'}],cursor:1}),false);
});

test('later moves in the solution are recognized from their actual position',async()=>{
 const {Chess}=await import('chess.js');
 const {solutionContinuation}=await import('../public/practice.js');
 const ex={fen:'6k1/8/8/8/4n3/7Q/8/3R3K b - - 0 1',pv:['e4f2','h1h2','f2h3','h2h3']};
 const positions=linePositions(ex.fen,ex.pv);
 assert.deepEqual(solutionContinuation(ex,ex.fen),ex.pv);
 assert.deepEqual(solutionContinuation(ex,positions[2].fen),['f2h3','h2h3']);
 assert.deepEqual(solutionContinuation(ex,positions[4].fen),[]);
 assert.deepEqual(solutionContinuation(ex,new Chess().fen()),[]);
});
