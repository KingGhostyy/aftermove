export function gameChoices(games,username,saved=new Set()){
 const draws=new Set(['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient']);
 return games.flatMap(raw=>{
  const color=raw.white?.username?.toLowerCase()===username.toLowerCase()?'w':raw.black?.username?.toLowerCase()===username.toLowerCase()?'b':null;
  if(!color)return [];
  const player=color==='w'?raw.white:raw.black,opponent=color==='w'?raw.black:raw.white;
  return [{id:raw.url,raw,color,opponent:opponent.username,date:raw.end_time,timeClass:raw.time_class||'chess',timeControl:raw.time_control,result:player.result==='win'?'Win':draws.has(player.result)?'Draw':'Loss',saved:saved.has(raw.url)}];
 });
}
export function selectedGames(choices,ids){return choices.filter(g=>!g.saved&&ids.has(g.id)).slice(0,15).map(g=>g.raw);}
