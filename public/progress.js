import {isMiss} from './analysis.js';
export function savedGameCollection(cache=new Map(),games=[]){
 return [...new Map([...cache.values(),...games].map(g=>[g.id,g])).values()].sort((a,b)=>(a.date||0)-(b.date||0));
}
function rates(points){
 const moves=points.reduce((n,p)=>n+p.moves,0),mistakes=points.reduce((n,p)=>n+p.mistakes,0),blunders=points.reduce((n,p)=>n+p.blunders,0),misses=points.reduce((n,p)=>n+p.misses,0);
 return {games:points.length,moves,mistakes,blunders,misses,errorRate:moves?(mistakes+blunders+misses)/moves*100:0,mistakeRate:moves?mistakes/moves*100:0,blunderRate:moves?blunders/moves*100:0};
}
export function progressSummary(games,format='rapid'){
 const points=savedGameCollection(new Map(),games).filter(g=>Number.isFinite(g.date)&&g.date>0&&(format==='all'||g.timeClass===format)).flatMap(g=>{
  const moves=g.moves.filter(m=>Number.isFinite(m.loss));if(!moves.length)return [];
  const mistakes=moves.filter(m=>m.loss>=100&&m.loss<200&&!isMiss(m)).length,blunders=moves.filter(m=>m.loss>=200&&!isMiss(m)).length,misses=moves.filter(isMiss).length;
  return [{id:g.id,date:g.date,opponent:g.opponent,timeClass:g.timeClass,moves:moves.length,mistakes,blunders,misses,errorRate:(mistakes+blunders+misses)/moves.length*100}];
 });
 let comparison=null;
 if(points.length>=6){const split=Math.floor(points.length/2),before=rates(points.slice(0,split)),after=rates(points.slice(split));comparison={before,after,change:after.errorRate-before.errorRate};}
 return {...rates(points),points,comparison};
}
