import {Chess} from 'chess.js';
export {PUZZLES} from './puzzle-bank.js';
import {PUZZLES} from './puzzle-bank.js';
export const THEMES={mate:'Forcing mates',material:'Winning material',defense:'Safe replies',endgame:'Endgame decisions'};
const key=fen=>String(fen||'').split(' ').slice(0,4).join(' ');
export function weaknessProfile(games){
 const counts={mate:0,material:0,defense:0,endgame:0};
 for(const game of games)for(const move of game.moves||[]){
  if(!Number.isFinite(move.loss)||move.loss<100)continue;
  const side=game.color==='b'?-1:1;
  if(move.beforeScore*side>99000){counts.mate++;continue;}
  if(move.mateLost||move.afterScore*side< -99000){counts.defense++;continue;}
  if(move.phase==='Endgame'){counts.endgame++;continue;}
  let capture=false;try{const b=new Chess(move.fen),uci=move.best;capture=!!b.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}).captured;}catch{}
  counts[capture||move.beforeScore*side>=150?'material':'defense']++;
 }
 return counts;
}
export function freshExercises(games=[],seen={},reviewSeen=false){
 const imported=new Set(games.flatMap(g=>[...(g.moves||[]).flatMap(m=>[key(m.fen),key(m.afterFen)]),...(g.history||[]).flatMap(m=>[key(m.fen),key(m.afterFen)])]));
 const profile=weaknessProfile(games);
 return PUZZLES.filter(p=>!imported.has(key(p.fen))&&(reviewSeen?!!seen[p.id]:!seen[p.id])).map(p=>({...p,fresh:true,kind:{mate:'Find a forcing move',material:'Find a way to win material',defense:'Find a safe reply',endgame:'Make the endgame count'}[p.theme]})).sort((a,b)=>{
  const sa=seen[a.id]||0,sb=seen[b.id]||0;
  if(!!sa!==!!sb)return sa?1:-1;
  if(sa&&sb&&sa!==sb)return sa-sb;
  return profile[b.theme]-profile[a.theme]||a.id.localeCompare(b.id);
 });
}
export function readPuzzleHistory(storage,username){
 try{const value=JSON.parse(storage.getItem('aftermove:puzzles:'+username.toLowerCase())||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([id,time])=>PUZZLES.some(p=>p.id===id)&&Number.isFinite(time)&&time>0)):{};}catch{return {};}
}
export function markPuzzleSeen(storage,username,id,now=Date.now()){
 try{const seen=readPuzzleHistory(storage,username);seen[id]=now;storage.setItem('aftermove:puzzles:'+username.toLowerCase(),JSON.stringify(seen));return true;}catch{return false;}
}
