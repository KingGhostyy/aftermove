import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../sites/aftermove/worker/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('hosted artifact serves app and browser engine with correct MIME types',async()=>{
 for(const [url,type] of [['/','text/html'],['/app.js','text/javascript'],['/engine/stockfish-19-lite-single.wasm','application/wasm']]){
  const response=await worker.fetch(new Request('https://aftermove.test'+url));assert.equal(response.status,200);assert.ok(response.headers.get('Content-Type').startsWith(type));assert.ok((await response.arrayBuffer()).byteLength>0);
 }
});
test('hosted importer rejects invalid usernames and cross-origin calls',async()=>{
 assert.equal((await worker.fetch(new Request('https://aftermove.test/api/games?username=!'))).status,400);
 assert.equal((await worker.fetch(new Request('https://aftermove.test/api/games?username=Luke',{headers:{Origin:'https://elsewhere.test'}}))).status,403);
});
test('hosted importer stays on Chess.com and respects selected count',async()=>{
 const original=globalThis.fetch,urls=[];
 globalThis.fetch=async url=>{urls.push(String(url));return Response.json(url.endsWith('/archives')?{archives:['https://evil.test/games/2026/10']}:{games:[1,2].map(n=>({url:String(n),rules:'chess',pgn:'1.e4 *',end_time:n,white:{result:'win'},black:{result:'resigned'}}))});};
 try{const response=await worker.fetch(new Request('https://aftermove.test/api/games?username=Luke&limit=1'));assert.equal(response.status,200);assert.equal((await response.json()).games.length,1);assert.ok(urls.every(u=>u.startsWith('https://api.chess.com/pub/player/luke/')));}finally{globalThis.fetch=original;}
});

test('new-game import skips saved games and continues into older archives',async()=>{
 const original=globalThis.fetch,calls=[];
 const game=(id,end)=>({url:id,rules:'chess',pgn:'1.e4 *',end_time:end,white:{result:'win'},black:{result:'resigned'}});
 globalThis.fetch=async url=>{calls.push(String(url));return Response.json(url.endsWith('/archives')?{archives:['https://api.chess.com/pub/player/luke/games/2026/09','https://api.chess.com/pub/player/luke/games/2026/10']}:url.endsWith('/10')?{games:[game('saved',20)]}:{games:[game('new',10)]});};
 try{
  const request=()=>new Request('https://aftermove.test/api/games?username=Luke&limit=1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exclude:['saved']})});
  const response=await worker.fetch(request());assert.equal(response.status,200);assert.deepEqual((await response.json()).games.map(g=>g.url),['new']);assert.ok(calls.some(url=>url.endsWith('/09')));
  const empty=await worker.fetch(new Request('https://aftermove.test/api/games?username=Luke&limit=1',{method:'POST',body:JSON.stringify({exclude:['saved','new']})}));assert.equal(empty.status,200);assert.deepEqual((await empty.json()).games,[]);
 }finally{globalThis.fetch=original;}
});
