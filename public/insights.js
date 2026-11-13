import {Chess} from 'chess.js';
const names={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'},value={p:1,n:3,b:3,r:5,q:9,k:100};
const play=(board,uci)=>board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
// These are board facts, not a replacement for the engine's assessment of a sacrifice.
export function moveInsight(fen,line=[]){
 const before=new Chess(fen),board=new Chess(fen);let move;
 try{move=play(board,line[0]);}catch{return null;}
 const side=move.color,enemy=side==='w'?'b':'w',player=side==='w'?'White':'Black',opponent=side==='w'?'Black':'White',arrows=[],parts=[];
 const add=(from,to,tone='idea')=>arrows.push({from,to,tone});
 if(board.isCheckmate()){
  parts.push(`${move.san} is checkmate. The king is in check and has no legal escape.`);
 }else if(board.isStalemate())parts.push(`${move.san} causes stalemate: no legal move and no check, so the game is drawn.`);
 else {
  if(move.captured){
   const square=move.flags.includes('e')?move.to[0]+move.from[1]:move.to;
   const undefended=!before.attackers(square,enemy).length;
   parts.push(`${move.san} captures ${undefended?'an undefended':'a'} ${names[move.captured]} on ${square}${move.flags.includes('e')?' en passant':''}.`);
   add(move.from,move.to);
  }
  if(move.promotion)parts.push(`${player}’s pawn promotes to a ${names[move.promotion]}.`);
  const fields=board.fen().split(' ');fields[1]=side;fields[3]='-';
  const ownTurn=new Chess(fields.join(' '));
  const legal=ownTurn.moves({square:move.to,verbose:true});
  const targets=board.board().flat().filter(p=>p&&p.color===enemy&&value[p.type]>=3&&board.attackers(p.square,side).includes(move.to)&&(p.type==='k'?board.isCheck():legal.some(m=>m.to===p.square)));
  if(targets.length>=2){
   arrows.length=0;
   targets.sort((a,b)=>value[b.type]-value[a.type]);const pair=targets.slice(0,2);
   parts.push(`${move.san} creates a fork: ${player}’s ${names[move.piece]} attacks the ${names[pair[0].type]} on ${pair[0].square} and the ${names[pair[1].type]} on ${pair[1].square} at the same time.`);
   for(const target of pair)add(move.to,target.square);
   if(board.isCheck())parts.push('The king must deal with check first.');
  }else if(board.isCheck()){
   const king=board.board().flat().find(p=>p?.type==='k'&&p.color===enemy);
   parts.push(`${move.san} gives check, making ${opponent} respond to the attack on their king.`);
   for(const from of board.attackers(king.square,side).slice(0,2))add(from,king.square);
  }
  const loose=board.moves({verbose:true}).filter(m=>m.captured&&value[m.captured]>=3&&!board.attackers(m.to,side).length&&(m.to===move.to||before.attackers(m.to,side).length));
  loose.sort((a,b)=>value[b.captured]-value[a.captured]);
  if(loose.length&&!board.isGameOver()){
   const capture=loose[0];parts.push(`${opponent}’s ${names[capture.piece]} on ${capture.from} can capture ${player}’s undefended ${names[capture.captured]} on ${capture.to} with ${capture.san}. Follow the continuation to see whether ${player} gets enough in return.`);
   arrows.length=0;add(capture.from,capture.to,'risk');
  }
  if(!parts.length){
   if(move.flags.includes('k')||move.flags.includes('q'))parts.push(`${move.san} castles: ${player}’s king moves away from the center and rook comes into play.`);
   else if(move.piece==='p'&&['d4','e4','d5','e5'].includes(move.to)){
    const rank=Number(move.to[1])+(side==='w'?1:-1),file=move.to.charCodeAt(0);
    const controlled=[String.fromCharCode(file-1)+rank,String.fromCharCode(file+1)+rank];
    parts.push(`${move.san} puts ${player}’s pawn in the center, controlling ${controlled.join(' and ')}.`);
   }
   else if(['n','b'].includes(move.piece)&&move.from[1]===(side==='w'?'1':'8'))parts.push(`${move.san} develops ${player}’s ${names[move.piece]} from the back rank, bringing another piece into play.`);
   else parts.push(`${move.san} moves ${player}’s ${names[move.piece]} to ${move.to}. No clear forcing tactic is established by this move alone; compare the engine continuation.`);
  }
  if(!arrows.length&&!board.isGameOver()){
   const target=legal.find(candidate=>candidate.captured&&candidate.captured!=='k');
   if(target){parts.push(`From ${move.to}, ${player}’s ${names[move.piece]} also attacks the ${names[target.captured]} on ${target.to}.`);add(move.to,target.to);}
  }
 }
 if(!arrows.length)add(move.from,move.to);
 return {fen:board.fen(),text:parts.join(' '),arrows,tone:arrows.some(a=>a.tone==='risk')?'risk':'idea'};
}
export function playedMoveInsight(positions,cursor){
 if(!positions?.[cursor-1]||!positions[cursor])return null;
 const before=positions[cursor-1].fen,after=positions[cursor].fen;
 const move=new Chess(before).moves({verbose:true}).find(move=>move.after===after);
 return move?moveInsight(before,[move.from+move.to+(move.promotion||'')]):null;
}
