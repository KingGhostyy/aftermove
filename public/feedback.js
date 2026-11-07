import { Chess } from 'chess.js';

export function continuationConsequence(fen,line,color){
  const board=new Chess(fen),values={p:1,n:3,b:3,r:5,q:9,k:0};
  const balance=()=>board.board().flat().filter(Boolean).reduce((sum,p)=>sum+values[p.type]*(p.color===color?1:-1),0);
  const before=balance();
  for(const uci of line.slice(0,9)){try{board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}catch{break;}}
  if(board.isCheckmate())return board.turn()===color?'The shown continuation ends with your king checkmated.':'The shown continuation ends with checkmate for your side.';
  if(board.isStalemate())return 'This ends in stalemate: the opponent has no legal move and is not in check, so the game is drawn.';
  if(balance()<before)return 'By the end of this shown line, your side has lost more material than it gained. Follow the captures on the board to see the tradeoff.';
  return '';
}

export function assessAlternative(best,candidate,color){
  if(best.depth<10||candidate.depth<10)return {category:'Unclear',accepted:false,demonstrate:false,message:'The search is not deep enough to judge this move confidently. Explore the line or try another idea.'};
  const side=color==='w'?1:-1,b=best.score*side,c=candidate.score*side;
  if((b>99000&&c>99000)||c>=b-35)return {category:'Good alternative',accepted:true,demonstrate:false,message:'Your move works too.'};
  if(b-c<100)return {category:'Playable alternative',accepted:true,demonstrate:false,message:'Your move is playable. The engine slightly prefers another idea, but this small difference does not establish a mistake.'};
  if(b>=150&&c>=-50)return {category:'Missed opportunity',accepted:false,demonstrate:true,message:'You missed a stronger opportunity. Your position is still playable, but the stronger continuation achieves more. Watch the reply, then compare with the suggested move.'};
  return {category:'Mistake',accepted:false,demonstrate:true,message:c< -99000&&b>=-99000?'This lets your opponent force checkmate. Watch their continuation to see the threat.':'The engine finds a stronger reply to your move. Watch the continuation below to see what it allows.'};
}
