import { Chess } from 'chess.js';

const names={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
export function linePositions(fen,line=[]){
  const board=new Chess(fen),positions=[{fen,san:'Start',last:[]}];
  for(const uci of line){
    try{const move=board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});positions.push({fen:board.fen(),san:move.san,last:[move.from,move.to]});}catch{break;}
  }
  return positions;
}
export function squarePoint(square,orientation='w'){
  const file=square.charCodeAt(0)-97,rank=Number(square[1])-1;
  return orientation==='w'?[file+.5,7.5-rank]:[7.5-file,rank+.5];
}
export function toggleArrow(arrows,from,to){
  return arrows.some(a=>a.from===from&&a.to===to)?arrows.filter(a=>a.from!==from||a.to!==to):[...arrows,{from,to}];
}
// Describe only facts demonstrated on the board or in the legal engine line.
export function explainMove(fen,line=[]){
  const board=new Chess(fen),parts=[];let first;
  try{const uci=line[0];first=board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}catch{return 'No reliable continuation is available for this position yet.';}
  if(board.isCheckmate())return `${first.san} is checkmate: the king is attacked and there is no legal escape.`;
  if(board.isStalemate())return `${first.san} leaves the opponent with no legal move but no check. That is stalemate, so the game is a draw.`;
  if(first.captured)parts.push(first.flags.includes('e')?`${first.san} captures the pawn on ${first.to[0]+first.from[1]} en passant.`:`${first.san} captures the ${names[first.captured]} on ${first.to}.`);
  if(first.promotion)parts.push(`The pawn promotes to a ${names[first.promotion]}, adding a new attacking piece.`);
  if(board.isCheck())parts.push(`${first.san} gives check, so the opponent must deal with the attack on their king.`);
  if(first.flags.includes('k')||first.flags.includes('q'))parts.push('Castling moves the king and brings the rook closer to the center.');
  if(!parts.length)parts.push(`${first.san} moves your ${names[first.piece]} from ${first.from} to ${first.to}.`);
  let positionalDetail=false;
  if(first.piece==='k'&&!first.flags.includes('k')&&!first.flags.includes('q')){
    const point=s=>[s.charCodeAt(0)-97,Number(s[1])-1];
    const distance=(a,b)=>Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]));
    const opponentKing=board.board().flat().find(p=>p?.type==='k'&&p.color!==first.color);
    const newlyControlled=[];
    for(const file of 'abcdefgh')for(const rank of '12345678'){
      const square=file+rank;
      if(distance(point(square),point(first.to))===1&&distance(point(square),point(first.from))>1)newlyControlled.push(square);
    }
    if(opponentKing)newlyControlled.sort((a,b)=>distance(point(a),point(opponentKing.square))-distance(point(b),point(opponentKing.square)));
    if(newlyControlled.length){parts.push(`From ${first.to}, your king now controls ${newlyControlled.slice(0,3).join(', ')}, keeping the opposing king off those squares.`);positionalDetail=true;}
  }
  let reply;
  for(let i=1;i<Math.min(line.length,8);i++){
    try{
      const uci=line[i],m=board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
      if(i===1){reply=m;parts.push(`The engine’s reply is ${m.san}${m.captured?`, capturing your ${names[m.captured]} on ${m.to}`:''}.`);}
      if(board.isCheckmate()){parts.push(`Following this continuation reaches checkmate with ${m.san}.`);break;}
      if(i>1&&m.captured){parts.push(`${m.color===first.color?'Your side':'The opponent'} then captures a ${names[m.captured]} with ${m.san} in the shown line.`);break;}
    }catch{break;}
  }
  if(!positionalDetail&&!first.captured&&!first.promotion&&!first.san.includes('+')&&reply&&!reply.captured)parts.push('Step through the line to compare how the pieces coordinate; this short search does not establish a specific tactical motif.');
  return parts.join(' ');
}

export function attachArrows(board,orientation,model,suggestion=null){
  model.arrows??=[];
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 8 8');svg.setAttribute('aria-hidden','true');svg.classList.add('arrow-overlay');board.append(svg);
  let start=null,end=null,pointer=null;
  const squareAt=e=>{
    const r=board.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*8),y=Math.floor((e.clientY-r.top)/r.height*8);
    if(x<0||x>7||y<0||y>7)return null;
    return orientation==='w'?'abcdefgh'[x]+(8-y):'hgfedcba'[x]+(y+1);
  };
  const draw=()=>{
    svg.replaceChildren();
    const arrows=[...(suggestion?[{...suggestion,suggested:true}]:[]),...model.arrows,...(start&&end?[{from:start,to:end}]:[])];
    for(const arrow of arrows){
      const color=arrow.suggested?'#285e50':'#df9838';
      const [x1,y1]=squarePoint(arrow.from,orientation),[x2,y2]=squarePoint(arrow.to,orientation);
      if(arrow.from===arrow.to){const c=document.createElementNS(svg.namespaceURI,'circle');c.setAttribute('cx',x1);c.setAttribute('cy',y1);c.setAttribute('r','.39');c.setAttribute('fill','none');c.setAttribute('stroke','#df9838');c.setAttribute('stroke-width','.12');svg.append(c);continue;}
      const angle=Math.atan2(y2-y1,x2-x1),dx=Math.cos(angle),dy=Math.sin(angle),baseX=x2-dx*.4,baseY=y2-dy*.4;
      const line=document.createElementNS(svg.namespaceURI,'line');for(const [k,v] of Object.entries({x1,y1,x2:baseX,y2:baseY,stroke:color,'stroke-width':.16,'stroke-linecap':'round'}))line.setAttribute(k,v);svg.append(line);
      const head=document.createElementNS(svg.namespaceURI,'polygon');head.setAttribute('points',`${x2},${y2} ${baseX-dy*.24},${baseY+dx*.24} ${baseX+dy*.24},${baseY-dx*.24}`);head.setAttribute('fill',color);if(arrow.suggested){line.classList.add('engine-suggestion');head.classList.add('engine-suggestion');}svg.append(head);
    }
  };
  board.addEventListener('contextmenu',e=>e.preventDefault());
  board.addEventListener('pointerdown',e=>{if(e.button===0){model.arrows=[];start=end=pointer=null;draw();return;}if(e.button!==2)return;e.preventDefault();start=squareAt(e);end=start;pointer=e.pointerId;board.setPointerCapture(pointer);draw();});
  board.addEventListener('pointermove',e=>{if(start){end=squareAt(e);draw();}});
  board.addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;e.preventDefault();const to=squareAt(e);if(start&&to)model.arrows=toggleArrow(model.arrows,start,to);start=end=pointer=null;draw();});
  board.addEventListener('pointercancel',()=>{start=end=pointer=null;draw();});
  draw();
  const clear=()=>{model.arrows=[];draw();};
  clear.setSuggestion=value=>{suggestion=value;draw();};
  return clear;
}

export function practicePosition(p,color){
  const board=new Chess(p.timeline?.[p.cursor]?.fen||p.board.fen());
  return {board,playable:!p.busy&&!p.playing&&board.turn()===color&&!board.isGameOver()};
}
export function extendPracticeLine(p,fen,line,cursor=p.cursor){
  const prefix=p.timeline?p.timeline.slice(0,cursor+1):linePositions(fen,[]);
  p.lineStart=prefix.length-1;
  p.timeline=[...prefix,...linePositions(fen,line.slice(0,9)).slice(1)];
  p.cursor=Math.min(p.lineStart+1,p.timeline.length-1);
}

export function practiceHasStarted(p){return !!p.attempted&&p.cursor>0;}

// Match the position within the authored solution, not only its first move.
export function solutionContinuation(ex,fen){
 const key=value=>value.split(' ').slice(0,4).join(' ');
 const positions=linePositions(ex.fen,ex.pv);
 const index=positions.findIndex(position=>key(position.fen)===key(fen));
 return index<0?[]:(ex.pv||[]).slice(index);
}
