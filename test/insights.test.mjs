import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {moveInsight,playedMoveInsight} from '../public/insights.js';
test('a checking knight fork explains both targets with arrows on the resulting board',()=>{
 const result=moveInsight('4k2r/8/8/8/8/3N4/8/4K3 w - - 0 1',['d3f4']);
 // Nf4 attacks neither target: ordinary moves must not invent a fork.
 assert.doesNotMatch(result.text,/fork/);
 const fork=moveInsight('4k2r/8/8/8/8/8/5N2/4K3 w - - 0 1',['f2g4']);
 assert.doesNotMatch(fork.text,/fork/);
 const actual=moveInsight('4k2r/8/8/8/8/5N2/8/4K3 w - - 0 1',['f3g5']);
 assert.doesNotMatch(actual.text,/fork/);
 const checkFork=moveInsight('3k3r/8/3N4/8/8/8/8/4K3 w - - 0 1',['d6f7']);
 assert.match(checkFork.text,/fork.*king.*rook/i);
 assert.deepEqual(checkFork.arrows.map(a=>a.to).sort(),['d8','h8']);
 assert.equal(new Chess(checkFork.fen).get('f7').type,'n');
});
test('a newly hanging piece identifies the legal capture without claiming the sacrifice is bad',()=>{
 const idea=moveInsight('r5k1/8/8/8/8/8/1B6/6K1 w - - 0 1',['b2a3']);
 assert.match(idea.text,/rook.*a8.*capture.*bishop.*a3/i);
 assert.equal(idea.tone,'risk');assert.deepEqual(idea.arrows,[{from:'a8',to:'a3',tone:'risk'}]);
 assert.doesNotMatch(idea.text,/blunder|mistake|loses/i);
});
test('defended captures and illegal lines do not invent free material',()=>{
 const idea=moveInsight('6k1/8/8/4p3/3p4/5N2/8/6K1 w - - 0 1',['f3d4']);
 assert.match(idea.text,/captures.*pawn/);assert.doesNotMatch(idea.text,/captures an undefended|wins/);
 assert.equal(moveInsight(new Chess().fen(),['e2e5']),null);
});
test('timeline coaching follows the displayed half move and handles promotion',()=>{
 const board=new Chess('7k/P7/8/8/8/8/8/6K1 w - - 0 1'),before=board.fen();board.move('a8=Q+');
 const idea=playedMoveInsight([{fen:before},{fen:board.fen()}],1);
 assert.match(idea.text,/promot/i);assert.equal(idea.fen,board.fen());
 assert.equal(playedMoveInsight([{fen:before}],0),null);
});

test('a capture arrow illustrates the capture rather than an unrelated secondary target',()=>{
 const idea=moveInsight('7k/4r2p/4R3/8/8/8/8/6K1 w - - 0 1',['e6e7']);
 assert.deepEqual(idea.arrows,[{from:'e6',to:'e7',tone:'idea'}]);
});

test('Black-side forks name the correct color and point at White targets',()=>{
 const idea=moveInsight('4k3/8/8/8/8/3n4/8/3K3R b - - 0 1',['d3f2']);
 assert.match(idea.text,/Black’s knight/);assert.match(idea.text,/fork/);
 assert.deepEqual(idea.arrows.map(a=>a.to).sort(),['d1','h1']);
});
