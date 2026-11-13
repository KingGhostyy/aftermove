import { Chess } from 'chess.js';

// Older saved batches kept only the player's moves. Recover intervening
// opponent moves by matching their legal resulting positions.
export function reviewMoves(game){
  if(game.history?.length)return game.history;
  const result=[];
  let previous=new Chess().fen();
  for(const move of game.moves){
    if(previous!==move.fen){
      const board=new Chess(previous);
      const reply=board.moves({verbose:true}).find(candidate=>candidate.after===move.fen);
      if(reply)result.push({...reply,fen:reply.before,afterFen:reply.after,ply:move.ply-1,moveNumber:Math.floor((move.ply-1)/2)+1});
    }
    result.push(move);previous=move.afterFen;
  }
  return result.sort((a,b)=>a.ply-b.ply);
}
export function reviewSelection(game,ply){
  const history=reviewMoves(game),position=history.find(m=>m.ply===ply);
  const next=game.moves.findIndex(m=>m.ply>=ply);
  const index=next<0?game.moves.length-1:next;
  return {index,after:game.moves[index]?.ply===ply,position:position?{...position,fen:position.afterFen}:null};
}

export function reviewAlternativeSource(game,ply){
 const move=reviewMoves(game).find(move=>move.ply===ply);
 return move?{move,fen:move.fen}:null;
}

export function explorationMoves(game,positions){
 const history=reviewMoves(game),origin=positions[0]?.fen;
 const end=history.findIndex(move=>move.afterFen===origin);
 const annotations=new Map(game.moves.map(move=>[move.ply,move]));
 const result=history.slice(0,end+1).map(move=>({...move,...annotations.get(move.ply),source:'game'}));
 for(let index=1;index<positions.length;index++){
  const fen=positions[index-1].fen;
  result.push({san:positions[index].san,color:new Chess(fen).turn(),moveNumber:Number(fen.split(' ')[5]),source:'variation',index});
 }
 return result;
}

// Display-only grades: preserve stored error thresholds and cached analysis.
export function reviewMoveQuality(move){
 if(!Number.isFinite(move?.loss))return null;
 if(move.loss>=200)return {label:'Blunder',tone:'blunder'};
 if(move.loss>=100)return {label:'Mistake',tone:'mistake'};
 if(move.loss>=50)return {label:'Inaccuracy',tone:'inaccuracy'};
 if(!(move.depth>=10&&move.afterDepth>=10)||!Number.isFinite(move.beforeScore)||!Number.isFinite(move.afterScore)||move.mateLost)return null;
 const side=move.color==='b'?-1:1;
 if(move.beforeScore*side< -99000)return null;
 const played=move.uci||(move.from&&move.to?move.from+move.to+(move.promotion||''):'');
 if(!played||!move.best)return null;
 if(played===move.best)return {label:'Best',tone:'best'};
 if(move.loss<=20)return {label:'Good',tone:'good'};
 return null;
}
