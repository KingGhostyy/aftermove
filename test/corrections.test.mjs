import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {linePositions} from '../public/practice.js';
test('correction replaces a later attempt and reply while preserving earlier moves',async()=>{
 const {createCorrection,replacementPositions}=await import('../public/corrections.js');
 const root=new Chess().fen(),prefix=linePositions(root,['e2e4','e7e5']),fen=prefix.at(-1).fen;
 const correction=createCorrection(prefix,fen,'f1c4','g1f3',['g1f3','b8c6'],{category:'Missed opportunity'});
 assert.deepEqual(replacementPositions(correction).map(p=>p.san),['Start','e4','e5','Nf3','Nc6']);
 assert.deepEqual(prefix.map(p=>p.san),['Start','e4','e5']);
});
test('good or uncertain alternatives do not offer a best-move correction',async()=>{
 const {createCorrection}=await import('../public/corrections.js');const fen=new Chess().fen(),prefix=linePositions(fen,[]);
 for(const category of ['Good move','Good alternative','Unclear'])assert.equal(createCorrection(prefix,fen,'d2d4','e2e4',['e2e4'],{category}),null);
 assert.ok(createCorrection(prefix,fen,'d2d4','e2e4',['e2e4'],{category:'Playable alternative'}));
});
test('a root correction supports Black promotions and rejects a mismatched source position',async()=>{
 const {createCorrection,replacementPositions}=await import('../public/corrections.js');const fen='7K/8/8/8/8/8/p7/7k b - - 0 1',prefix=linePositions(fen,[]);
 const c=createCorrection(prefix,fen,'h1g1','a2a1q',['a2a1q'],{category:'Mistake'});assert.equal(replacementPositions(c).at(-1).san,'a1=Q+');
 assert.throws(()=>createCorrection(linePositions(new Chess().fen(),[]),fen,'h1g1','a2a1q',['a2a1q'],{category:'Mistake'}),/position/i);
});
