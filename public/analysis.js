import { Chess } from 'chess.js';
import { moveTimings } from './timing.js';

export const ANALYSIS_VERSION = 'sf19-lite-250ms-v2';
export function selectGames(games, limit = 10, excluded = new Set()) {
  const seen = new Set();
  return games.filter(g => !excluded.has(g.url) && g.rules === 'chess' && g.pgn && g.end_time && g.white?.result && g.black?.result)
    .sort((a,b) => b.end_time-a.end_time).filter(g => { if(seen.has(g.url)) return false; seen.add(g.url); return true; })
    .slice(0, Math.min(15,Math.max(1,Number(limit)||10)));
}
export function classifyMove(before, after, color) {
  const side=color==='w'?1:-1,b=before*side,a=after*side;
  const matePosition=Math.abs(before)>99000||Math.abs(after)>99000;
  const mateLost=matePosition&&((b>99000&&a<=99000)||(b>=-99000&&a< -99000));
  const loss=matePosition?(mateLost?1000:0):Math.max(0,Math.round(b-a));
  return {loss,matePosition,mateLost,label:loss>=200?'Blunder':loss>=100?'Mistake':loss>=50?'Inaccuracy':'Sound'};
}
export function phaseOf(chess, ply) {
  const pieces = chess.board().flat().filter(Boolean);
  const heavy = pieces.filter(p => p.type==='q' || p.type==='r').length;
  if(pieces.length<=12 || (heavy<=2 && pieces.length<=18)) return 'Endgame';
  return ply<20?'Opening':'Middlegame';
}
export function parseGame(raw, username) {
  const chess=new Chess(); chess.loadPgn(raw.pgn);
  const history=chess.history({verbose:true});
  const timings=moveTimings(history,chess.getComments(),raw.time_control,raw.time_class);
  const color=raw.white.username.toLowerCase()===username.toLowerCase()?'w':raw.black.username.toLowerCase()===username.toLowerCase()?'b':null;
  if(!color) throw new Error('This game does not belong to this username.');
  const header=chess.getHeaders();
  const player=color==='w'?raw.white:raw.black, opponent=color==='w'?raw.black:raw.white;
  const draw=['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient'];
  return {id:raw.url, url:raw.url, color, opponent:opponent.username, rating:player.rating,timeControl:raw.time_control,
    result:player.result==='win'?'Win':draw.includes(player.result)?'Draw':'Loss',
    timeClass:raw.time_class||'unknown', opening:header.ECOUrl?.split('/').pop()?.replaceAll('-',' ')||header.ECO||'Unclassified opening',
    date:raw.end_time, history:history.map((m,i)=>({...m,ply:i,moveNumber:Math.floor(i/2)+1,fen:m.before,afterFen:m.after})), moves:history.map((m,i)=>({...m,...timings[i],ply:i,moveNumber:Math.floor(i/2)+1,fen:m.before,afterFen:m.after,uci:m.from+m.to+(m.promotion||''),phase:phaseOf(new Chess(m.before),i)})).filter(m=>m.color===color)};
}
export function summarize(games) {
  const moves=games.flatMap(g=>g.moves).filter(m=>Number.isFinite(m.loss));
  const phases=['Opening','Middlegame','Endgame'].map(name=>{
    const subset=moves.filter(m=>m.phase===name);
    const numeric=subset.filter(m=>!m.matePosition);
    return {name,count:subset.length,numericCount:numeric.length,loss:numeric.length?Math.round(numeric.reduce((s,m)=>s+m.loss,0)/numeric.length):0,errors:subset.filter(m=>m.loss>=100).length};
  });
  const eligible=phases.filter(p=>p.count>=5);
  return {totalMoves:moves.length,blunders:moves.filter(m=>m.loss>=200).length,mistakes:moves.filter(m=>m.loss>=100&&m.loss<200).length,
    sound:moves.filter(m=>m.loss<50).length,phases,focus:[...eligible].sort((a,b)=>b.loss-a.loss)[0]?.name||null,
    strength:[...eligible].filter(p=>p.numericCount>=5).sort((a,b)=>a.loss-b.loss)[0]||null,
    wins:games.filter(g=>g.result==='Win').length,draws:games.filter(g=>g.result==='Draw').length};
}
export function makeExercise(move) {
  if(move.loss<100 || !move.best || move.best===move.uci || move.depth<10 || move.afterDepth<10) return null;
  return {...move,kind:move.beforeScore*(move.color==='w'?1:-1)>=150?'Find the winning move':'Keep your position safe'};
}
export function sanLine(fen, line, max=5) {
  const board=new Chess(fen); const result=[];
  for(const uci of line.slice(0,max)) {try {const m=board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});if(!m)break; result.push(m.san);}catch{break;}}
  return result.join(' → ');
}
