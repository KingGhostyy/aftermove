import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {server} from '../server.mjs';

test('HTTP server validates requests and imports bounded games from a fixed upstream',async t=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{calls.push(String(url));if(url.includes('missing'))return Response.json({}, {status:404});return Response.json(url.endsWith('/archives')?{archives:['https://untrusted.example/games/2026/10']}:{games:Array.from({length:20},(_,i)=>({url:String(i),rules:'chess',pgn:'1.e4 *',end_time:i+1,white:{result:'win'},black:{result:'resigned'}}))});};
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const request=(url,headers={},method='GET',body)=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:url,method,headers:{Host:'127.0.0.1:'+(Number(process.env.PORT)||5173),...headers}},res=>{let body='';res.on('data',data=>body+=data);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end(body);});
  try{
    await t.test('serves app, modules and WASM with correct types',async()=>{
      for(const [url,type] of [['/','text/html'],['/app.js','text/javascript'],['/engine/stockfish-19-lite-single.wasm','application/wasm']]){const r=await request(url);assert.equal(r.status,200);assert.ok(r.headers['content-type'].startsWith(type));assert.ok(r.body.length>0);}
    });
    await t.test('rejects remote hosts, cross-origin requests and mutations',async()=>{
      assert.equal((await request('/',{Host:'evil.example'})).status,403);
      assert.equal((await request('/api/games?username=Luke',{Origin:'https://evil.example'})).status,403);
      assert.equal((await request('/',{},'POST')).status,405);
    });
    await t.test('rejects malformed paths and missing files without crashing',async()=>{
      assert.equal((await request('/%zz')).status,400);
      assert.equal((await request('/%2e%2e%2fpackage.json')).status,403);
      assert.equal((await request('/does-not-exist')).status,404);
      assert.equal((await request('/')).status,200);
    });
    await t.test('validates username and never follows archive hosts',async()=>{
      assert.equal((await request('/api/games?username=!')).status,400);
      const result=await request('/api/games?username=LuKe&limit=1');assert.equal(result.status,200);assert.equal(JSON.parse(result.body).games.length,1);assert.ok(calls.every(url=>url.startsWith('https://api.chess.com/pub/player/luke/')));
      assert.equal((await request('/api/games?username=missing')).status,404);
    });
    await t.test('new-game imports skip saved games before counting the requested batch',async()=>{
      const result=await request('/api/games?username=Luke&limit=1',{},'POST',JSON.stringify({exclude:['19','18']}));
      assert.equal(result.status,200);assert.deepEqual(JSON.parse(result.body).games.map(g=>g.url),['17']);
      assert.equal((await request('/api/games?username=Luke',{},'POST','{')).status,400);
      assert.equal((await request('/api/games?username=Luke',{Origin:'https://evil.example'},'POST',JSON.stringify({exclude:[]}))).status,403);
      const empty=await request('/api/games?username=Luke',{},'POST',JSON.stringify({exclude:Array.from({length:20},(_,i)=>String(i))}));assert.deepEqual(JSON.parse(empty.body).games,[]);
    });
    await t.test('serializes imports and releases the lock after client disconnect',async()=>{
      let started,aborted;const ready=new Promise(resolve=>{started=resolve;}),cancelled=new Promise(resolve=>{aborted=resolve;});
      globalThis.fetch=async(url,{signal})=>{started();return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>{aborted();reject(new DOMException('Client disconnected','AbortError'));},{once:true});});};
      const first=http.get({host:'127.0.0.1',port,path:'/api/games?username=Luke',headers:{Host:'127.0.0.1:'+(Number(process.env.PORT)||5173)}});first.on('error',()=>{});
      await ready;assert.equal((await request('/api/games?username=Luke')).status,429);first.destroy();await cancelled;await new Promise(setImmediate);
      globalThis.fetch=async url=>Response.json(url.endsWith('/archives')?{archives:[]}:{games:[]});assert.equal((await request('/api/games?username=Luke')).status,200);
      globalThis.fetch=async url=>Response.json(url.endsWith('/archives')?{archives:['https://api.chess.com/pub/player/luke/games/2026/10']}:{games:Array.from({length:20},(_,i)=>({url:String(i),rules:'chess',pgn:'1.e4 *',end_time:i+1,white:{result:'win'},black:{result:'resigned'}}))});
    });
    await t.test('clamps oversized batches and recovers after upstream failure',async()=>{
      const result=await request('/api/games?username=Luke&limit=999');assert.equal(JSON.parse(result.body).games.length,15);
      globalThis.fetch=async()=>{throw new Error('Simulated network failure');};assert.equal((await request('/api/games?username=Luke')).status,502);
      globalThis.fetch=async()=>Response.json({archives:[]});assert.equal((await request('/api/games?username=Luke')).status,200);
    });
  }finally{globalThis.fetch=original;await new Promise(resolve=>server.close(resolve));}
});
