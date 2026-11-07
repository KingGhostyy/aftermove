export function evalDisplay(score){
  if(!Number.isFinite(score))return {label:'…',whitePercent:50,description:'Evaluation pending'};
  if(Math.abs(score)>99000){
    const moves=100000-Math.abs(score),side=score>0?'White':'Black';
    return {label:`${score>0?'+':'−'}M${moves||''}`,whitePercent:score>0?100:0,description:`${side} ${moves?`has mate in ${moves}`:'has delivered checkmate'}`};
  }
  return {label:`${score>0?'+':''}${(score/100).toFixed(2)}`,whitePercent:50+45*Math.tanh(score/600),description:`Evaluation ${(score/100).toFixed(2)} from White’s perspective. Positive favors White; negative favors Black.`};
}
export function searchingEval(score,previous){
  const pending=!Number.isFinite(score),display=evalDisplay(pending?previous:score);
  return {...display,pending,description:pending&&Number.isFinite(previous)?`Previous position: ${display.description} Engine thinking; this is not yet the current position’s evaluation.`:display.description};
}
