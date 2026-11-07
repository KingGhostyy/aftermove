export function moveTimings(history,comments,timeControl,timeClass){
  const control=String(timeControl||'').match(/^(\d+)(?:\+(\d+))?$/);
  const valid=control&&timeClass!=='daily';
  const increment=valid?Number(control[2]||0):0;
  const previous={w:valid?Number(control[1]):null,b:valid?Number(control[1]):null};
  const byFen=new Map(comments.map(c=>[c.fen,c.comment]));
  return history.map(move=>{
    const match=byFen.get(move.after)?.match(/\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]/);
    const remaining=valid&&match?Number(match[1])*3600+Number(match[2])*60+Number(match[3]):null;
    const elapsed=remaining!==null&&previous[move.color]!==null?previous[move.color]+increment-remaining:null;
    previous[move.color]=remaining;
    return {clockSeconds:remaining,thinkSeconds:elapsed!==null&&elapsed>=0?Math.round(elapsed*10)/10:null};
  });
}
export function thinkingMoments(games,limit=5){
  return games.flatMap(game=>{
    const times=game.moves.map(m=>m.thinkSeconds).filter(Number.isFinite).sort((a,b)=>a-b);
    if(times.length<5)return [];
    const middle=Math.floor(times.length/2),median=times.length%2?times[middle]:(times[middle-1]+times[middle])/2;
    return game.moves.filter(m=>Number.isFinite(m.thinkSeconds)&&m.thinkSeconds>=Math.max(15,median*2)&&m.loss>=100).map(move=>({game,move,median}));
  }).sort((a,b)=>b.move.thinkSeconds-a.move.thinkSeconds).slice(0,limit);
}
export function gameThinkingSummary(game){
  const timed=game.moves.filter(m=>Number.isFinite(m.thinkSeconds)&&m.thinkSeconds>=0);
  const longest=[...timed].sort((a,b)=>b.thinkSeconds-a.thinkSeconds||a.ply-b.ply);
  return {longest:longest.slice(0,3),maxSeconds:longest[0]?.thinkSeconds||0,
    mistakes:thinkingMoments([game],Infinity).map(item=>item.move)};
}
