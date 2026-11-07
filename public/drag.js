export function attachPieceDrag(board,orientation,canDrag,onDrop,legalTargets=()=>[]){
  let drag=null,suppressClick=false;
  const squareAt=e=>{const r=board.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*8),y=Math.floor((e.clientY-r.top)/r.height*8);return x<0||y<0||x>7||y>7?null:orientation==='w'?'abcdefgh'[x]+(8-y):'hgfedcba'[x]+(y+1);};
  const cleanup=()=>{drag?.ghost?.remove();drag?.piece?.classList.remove('drag-origin');board.querySelectorAll('.drag-dot').forEach(el=>el.remove());board.querySelectorAll('.drag-selected').forEach(el=>el.classList.remove('drag-selected'));board.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));board.querySelectorAll('.drag-legal, .drag-capture').forEach(el=>el.classList.remove('drag-legal','drag-capture'));drag=null;};
  board.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.isPrimary===false||drag)return;
    // Suppress only the synthetic click from the preceding drag, never a
    // later physical click when the browser emitted no synthetic click.
    suppressClick=false;
    const square=e.target.closest('[data-square]'),piece=square?.querySelector('.piece');
    if(!piece||!canDrag(square.dataset.square))return;
    drag={from:square.dataset.square,piece,x:e.clientX,y:e.clientY,id:e.pointerId,moved:false,captureTarget:square};
    // Capture from the press, on the source square so ordinary clicks still target it.
    square.setPointerCapture(e.pointerId);
    board.querySelectorAll('.dot').forEach(el=>el.remove());
    board.querySelectorAll('.legal-target, .legal-capture').forEach(el=>el.classList.remove('legal-target','legal-capture'));
    square.classList.add('drag-selected');
    for(const target of legalTargets(drag.from)){
      const cell=board.querySelector(`[data-square="${target}"]`);if(!cell)continue;
      const capture=!!cell.querySelector('.piece');cell.classList.add('drag-legal');if(capture)cell.classList.add('drag-capture');
      const dot=document.createElement('span');dot.className=capture?'dot drag-dot capture-dot':'dot drag-dot';cell.append(dot);
    }
  });
  board.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(!drag.moved&&(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6||squareAt(e)===drag.from))return;
    e.preventDefault();drag.moved=true;
    if(!drag.ghost){drag.ghost=drag.piece.cloneNode(true);drag.ghost.classList.add('drag-ghost');board.append(drag.ghost);drag.piece.classList.add('drag-origin');}
    const r=board.getBoundingClientRect();drag.ghost.style.left=(e.clientX-r.left)+'px';drag.ghost.style.top=(e.clientY-r.top)+'px';
    board.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));
    const to=squareAt(e);if(to)board.querySelector(`[data-square="${to}"]`)?.classList.add('drop-target');
  });
  board.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.id||e.button!==0)return;
    const {from,moved,x,y}=drag,to=squareAt(e);
    const dropped=moved||(to!==from&&Math.hypot(e.clientX-x,e.clientY-y)>=6);
    cleanup();
    if(dropped){e.preventDefault();suppressClick=true;if(to)onDrop(from,to);}
  });
  board.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;}},true);
  board.addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.id)cleanup();});
  board.addEventListener('lostpointercapture',e=>{if(drag&&e.pointerId===drag.id&&e.target===drag.captureTarget)cleanup();});
  board.addEventListener('dragstart',e=>e.preventDefault());
}
