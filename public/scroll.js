export function captureReviewScroll(page,list){
  return {pageTop:page.scrollTop,pageLeft:page.scrollLeft,listTop:list.scrollTop};
}

// Keep the user's reading position. Keyboard/shortcut jumps reveal only as
// much of the list as needed, rather than recentering every selected move.
export function restoreReviewScroll(page,list,current,saved,reveal=true){
  if(saved)list.scrollTop=saved.listTop;
  if(current&&reveal){
    const top=current.offsetTop,bottom=top+current.offsetHeight,margin=6;
    if(top<list.scrollTop+margin)list.scrollTop=Math.max(0,top-margin);
    else if(bottom>list.scrollTop+list.clientHeight-margin)list.scrollTop=Math.max(0,bottom-list.clientHeight+margin);
  }
  if(saved){page.scrollLeft=saved.pageLeft;page.scrollTop=saved.pageTop;}
}
