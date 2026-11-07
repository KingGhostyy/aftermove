import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { selectGames } from './public/analysis.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT)||5173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.svg':'image/svg+xml'};
let fetching=false;
async function chessFetch(url,signal) {
  const r=await fetch(url,{headers:{'User-Agent':'ChessAccountCoach/0.1 (local personal analysis)'},signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
  if(!r.ok) throw Object.assign(new Error(r.status===404?'Username not found. Check the spelling and try again.':r.status===429?'Chess.com is busy. Wait a minute and try again.':'Chess.com could not return your games. Please try again.'),{status:r.status===404?404:502});
  return r.json();
}
export const server=http.createServer(async(req,res)=>{
  const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  // Loopback binding plus host and Origin checks keep the API local.
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return json(403,{error:'Local access only.'});
  if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))return json(403,{error:'Local access only.'});
  if(req.method!=='GET'&&!(req.method==='POST'&&req.url?.split('?')[0]==='/api/games'))return json(405,{error:'Method not allowed.'});
  let url,decodedPath;
  try{url=new URL(req.url,`http://127.0.0.1:${port}`);decodedPath=decodeURIComponent(url.pathname);}catch{return json(400,{error:'Invalid URL.'});}
  if(url.pathname==='/api/games') {
    if(fetching)return json(429,{error:'An import is already running. Please wait.'});
    const username=url.searchParams.get('username')?.trim()||'';
    if(!/^[a-zA-Z0-9_-]{2,50}$/.test(username))return json(400,{error:'Enter a valid Chess.com username (letters, numbers, underscores or hyphens).'});
    let excluded=new Set();
    if(req.method==='POST'){try{let text='',size=0;for await(const chunk of req){size+=chunk.length;if(size>262144)return json(413,{error:'Saved game list is too large.'});text+=chunk.toString('utf8');}const body=JSON.parse(text);if(!Array.isArray(body.exclude)||body.exclude.some(id=>typeof id!=='string'))return json(400,{error:'Invalid saved game list.'});excluded=new Set(body.exclude);}catch{return json(400,{error:'Invalid saved game list.'});}}
    const limit=Math.min(15,Math.max(1,Number(url.searchParams.get('limit'))||10));
    if(fetching)return json(429,{error:'An import is already running. Please wait.'});
    fetching=true;
    const controller=new AbortController();
    res.on('close',()=>controller.abort());
    try{
      const base=`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`;
      const {archives=[]}=await chessFetch(`${base}/games/archives`,controller.signal);
      const collected=[];let checked=0;
      for(const archive of [...archives].reverse()) {
        // Never follow arbitrary URLs returned by a remote service.
        const suffix=archive.match(/\/games\/(\d{4})\/(\d{2})$/);
        if(!suffix)continue;
        if(++checked>24)break;
        const {games=[]}=await chessFetch(`${base}/games/${suffix[1]}/${suffix[2]}`,controller.signal);
        collected.push(...games);
        if(selectGames(collected,limit,excluded).length>=limit)break;
      }
      json(200,{games:selectGames(collected,limit,excluded),limited:checked>24});
    }catch(e){json(e.status||502,{error:e.name==='TimeoutError'?'Chess.com took too long to respond. Please try again.':e.message});}
    finally{fetching=false;}
    return;
  }
  let file;
  if(url.pathname==='/vendor/chess.js')file=path.join(root,'node_modules/chess.js/dist/esm/chess.js');
  else if(/^\/engine\/stockfish-19-lite-single\.(js|wasm)$/.test(url.pathname))file=path.join(root,'node_modules/stockfish/bin',path.basename(url.pathname));
  else if(url.pathname==='/licenses/stockfish')file=path.join(root,'node_modules/stockfish/Copying.txt');
  else {
    const requested=url.pathname==='/'?'index.html':decodedPath.slice(1);
    file=path.resolve(root,'public',requested);
    if(!file.startsWith(path.join(root,'public')+path.sep))return json(403,{error:'Forbidden'});
  }
  try {const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'"});res.end(body);}catch{json(404,{error:'Not found'});}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(port,'127.0.0.1',()=>console.log(`Chess coach is ready at http://127.0.0.1:${port}`));
