import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Engine } from '../public/engine.js';
import { Chess } from 'chess.js';

// Exercise the real distributed engine through the same message contract as a browser Worker.
class NodeWorker {
  constructor(){
    this.child=spawn(process.execPath,['node_modules/stockfish/bin/stockfish-19-lite-single.js']);
    let pending='';
    this.child.stdout.on('data',chunk=>{pending+=chunk;let newline;while((newline=pending.indexOf('\n'))>=0){const data=pending.slice(0,newline).trim();pending=pending.slice(newline+1);this.onmessage?.({data});}});
    this.child.on('error',e=>this.onerror?.(e));
  }
  postMessage(message){this.child.stdin.write(message+'\n');}
  terminate(){this.child.kill();}
}

test('real Stockfish returns a legal mating move and white-relative score',async()=>{
  globalThis.Worker=NodeWorker;
  const engine=new Engine();
  try{
    const fen='7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
    const result=await engine.evaluate(fen,150);
    assert.ok(result.score>99000);
    const board=new Chess(fen);
    board.move({from:result.best.slice(0,2),to:result.best.slice(2,4)});
    assert.equal(board.isCheckmate(),true);
    const terminal=await engine.evaluate(board.fen());
    assert.equal(terminal.score,100000);
  }finally{engine.stop();delete globalThis.Worker;}
});
test('real Stockfish scores a Black mating attack negatively and recognizes delivered mate',async()=>{
  globalThis.Worker=NodeWorker;
  const engine=new Engine();
  try{
    const fen='8/8/8/8/8/5kq1/8/7K b - - 0 1';
    const result=await engine.evaluate(fen,150);
    assert.ok(result.score< -99000);
    const board=new Chess(fen);
    board.move({from:result.best.slice(0,2),to:result.best.slice(2,4),promotion:result.best[4]});
    assert.equal(board.isCheckmate(),true);
    assert.equal((await engine.evaluate(board.fen())).score,-100000);
  }finally{engine.stop();delete globalThis.Worker;}
});
test('terminal drawn positions return a valid zero evaluation without starting a worker',async()=>{
  const cases=[
    ['stalemate','7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'],
    ['insufficient material','7k/8/6K1/8/8/8/8/8 w - - 0 1'],
    ['fifty-move draw','7k/8/6K1/8/8/8/8/R7 w - - 100 51'],
  ];
  const engine=new Engine();
  try{
    for(const [label,fen]of cases){
      const result=await engine.evaluate(fen);
      assert.equal(result.score,0,label);
      assert.equal(result.best,null,label);
      assert.deepEqual(result.pv,[],label);
      assert.ok(result.depth>0,label);
      assert.equal(engine.worker,null,label);
    }
  }finally{engine.stop();}
});
test('stopping a pending engine search rejects promptly',async()=>{
  globalThis.Worker=NodeWorker;
  const engine=new Engine();
  try{
    await engine.start();
    const pending=engine.evaluate(new Chess().fen(),10000);
    const rejected=assert.rejects(pending,{name:'AbortError'});
    setTimeout(()=>engine.stop(),20);
    await rejected;
    assert.equal(engine.worker,null);
  }finally{engine.stop();delete globalThis.Worker;}
});

test('failed or depth-zero engine replies cannot be accepted as a zero evaluation',async()=>{
 const {requireEvaluation}=await import('../public/engine.js');
 assert.throws(()=>requireEvaluation({score:0,depth:0,best:null}),/could not evaluate/);
 assert.throws(()=>requireEvaluation({score:NaN,depth:12}),/could not evaluate/);
 assert.equal(requireEvaluation({score:0,depth:99,best:null}).score,0);
});
