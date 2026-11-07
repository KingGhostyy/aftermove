function json(status,data){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
function selectGames(games,limit,excluded=new Set()){const seen=new Set();return games.filter(g=>!excluded.has(g.url)&&g.rules==='chess'&&g.pgn&&g.end_time&&g.white?.result&&g.black?.result).sort((a,b)=>b.end_time-a.end_time).filter(g=>{if(seen.has(g.url))return false;seen.add(g.url);return true;}).slice(0,limit);}
async function chessFetch(url,signal){
 const response=await fetch(url,{headers:{'User-Agent':'Aftermove/0.1 (private chess coaching)'},signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
 if(!response.ok)throw Object.assign(new Error(response.status===404?'Username not found. Check the spelling and try again.':response.status===429?'Chess.com is busy. Wait a minute and try again.':'Chess.com could not return your games. Please try again.'),{status:response.status===404?404:502});
 return response.json();
}
async function importGames(request,url){
 const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json(403,{error:'Same-origin access only.'});
 const username=url.searchParams.get('username')?.trim()||'';
 if(!/^[a-zA-Z0-9_-]{2,50}$/.test(username))return json(400,{error:'Enter a valid Chess.com username (letters, numbers, underscores or hyphens).'});
 let excluded=new Set();
 if(request.method==='POST'){try{let text='',size=0;const decoder=new TextDecoder();for await(const chunk of request.body){size+=chunk.byteLength;if(size>262144)return json(413,{error:'Saved game list is too large.'});text+=decoder.decode(chunk,{stream:true});}text+=decoder.decode();const body=JSON.parse(text);if(!Array.isArray(body.exclude)||body.exclude.some(id=>typeof id!=='string'))return json(400,{error:'Invalid saved game list.'});excluded=new Set(body.exclude);}catch{return json(400,{error:'Invalid saved game list.'});}}
 const limit=Math.min(15,Math.max(1,Number(url.searchParams.get('limit'))||10));
 try{
  const base='https://api.chess.com/pub/player/'+encodeURIComponent(username.toLowerCase());
  const {archives=[]}=await chessFetch(base+'/games/archives',request.signal);
  const collected=[];let checked=0;
  for(const archive of [...archives].reverse()){
   const suffix=String(archive).match(/\/games\/(\d{4})\/(\d{2})$/);if(!suffix)continue;
   if(++checked>24)break;
   const {games=[]}=await chessFetch(base+'/games/'+suffix[1]+'/'+suffix[2],request.signal);collected.push(...games);
   if(selectGames(collected,limit,excluded).length>=limit)break;
  }
  return json(200,{games:selectGames(collected,limit,excluded),limited:checked>24});
 }catch(error){return json(error.status||502,{error:error.name==='TimeoutError'?'Chess.com took too long to respond. Please try again.':error.message});}
}
