import {Chess} from 'chess.js';
import {classifyMove,phaseOf} from './analysis.js';
import {reviewMoves} from './review.js';
import {requireEvaluation} from './engine.js';

// Return a complete replacement only after both sides finish; stopping keeps saved work intact.
export async function analyzeFullGame(game,engine,onProgress=()=>{},cancelled=()=>false){
 const own=new Map(game.moves.map(m=>[m.ply,m]));
 const history=reviewMoves(game).map(m=>({...m,...own.get(m.ply)})),scores=new Map();
 const check=()=>{if(cancelled())throw new DOMException('Analysis stopped','AbortError');};
 const evaluate=async fen=>{check();if(!scores.has(fen))scores.set(fen,requireEvaluation(await engine.evaluate(fen)));check();return scores.get(fen);};
 onProgress(0,history.length,null);
 for(let i=0;i<history.length;i++){
  const m=history[i],before=await evaluate(m.fen),after=await evaluate(m.afterFen);
  const keepDeep=m.deepAt&&m.depth>0&&m.afterDepth>0&&Number.isFinite(m.beforeScore)&&Number.isFinite(m.afterScore)&&m.best;
  if(!keepDeep)Object.assign(m,classifyMove(before.score,after.score,m.color),{beforeScore:before.score,afterScore:after.score,best:before.best,pv:before.pv,depth:before.depth,afterDepth:after.depth});
  m.uci=m.from+m.to+(m.promotion||'');m.phase=phaseOf(new Chess(m.fen),m.ply);
  onProgress(i+1,history.length,m);check();
 }
 return {...game,history,moves:history.filter(m=>m.color===game.color),bothSidesAnalyzed:true};
}
