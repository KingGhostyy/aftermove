import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Chess} from 'chess.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function boardMarkup('),app.indexOf('function emptyOverview('));
test('legal capture markers appear above occupied targets in either board orientation',()=>{
 const fen='8/5ppk/2R1p2p/3pP3/7P/2n2PP1/1p4K1/8 w - - 0 1',board=new Chess(fen),targets=board.moves({square:'c6',verbose:true}).map(m=>m.to);
 assert.ok(targets.includes('c3'));
 const context={Chess,symbols:{wr:'R',bn:'N'},names:{r:'rook',n:'knight',p:'pawn',k:'king'}};vm.runInNewContext(source,context);
 for(const orientation of ['w','b']){const html=context.boardMarkup(fen,orientation,true,'c6',targets);const cell=square=>html.match(new RegExp('<button[^>]*data-square="'+square+'"[^>]*>[\\s\\S]*?<\\/button>'))[0];
 assert.match(cell('c3'),/legal-capture/);assert.match(cell('c3'),/dot capture-dot/);assert.match(cell('c5'),/legal-target/);assert.doesNotMatch(cell('c5'),/capture-dot/);assert.doesNotMatch(cell('b3'),/legal-target/);
 }
});
