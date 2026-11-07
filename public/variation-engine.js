import {Chess} from 'chess.js';
import {Engine,requireEvaluation} from './engine.js';
const aborted=()=>new DOMException('Position changed','AbortError');
export class VariationAnalysis{
 constructor({createEngine=()=>new Engine(),withLock=(_signal,run)=>run(),onUpdate=()=>{}}={}){this.createEngine=createEngine;this.withLock=withLock;this.onUpdate=onUpdate;this.cache=new Map();this.job=null;this.failure=null;}
 peek(fen){return this.cache.get(fen);}
 cancel(){const job=this.job;this.job=null;this.failure=null;if(job){job.abort.abort();job.engine?.stop();}}
 get(fen,{retry=false}={}){
  if(this.job?.fen===fen)return this.job.promise;
  if(this.job)this.cancel();
  if(this.cache.has(fen))return Promise.resolve(this.cache.get(fen));
  if(this.failure?.fen===fen&&!retry)return Promise.reject(this.failure.error);
  this.failure=null;
  const job={fen,abort:new AbortController(),engine:null};this.job=job;
  job.promise=Promise.resolve().then(()=>this.withLock(job.abort.signal,async()=>{
   if(job.abort.signal.aborted)throw aborted();
   job.engine=this.createEngine();
   const result=requireEvaluation(await job.engine.evaluate(fen,700));
   if(job.abort.signal.aborted||this.job!==job)throw aborted();
   const board=new Chess(fen);
   if(!board.isGameOver()){
    if(!result.best)throw new Error('No engine move available. Try again.');
    board.move({from:result.best.slice(0,2),to:result.best.slice(2,4),promotion:result.best[4]});
   }
   this.cache.set(fen,result);if(this.cache.size>64)this.cache.delete(this.cache.keys().next().value);
   return result;
  })).catch(error=>{if(job.abort.signal.aborted)throw aborted();if(this.job===job)this.failure={fen,error};throw error;}).finally(()=>{
   job.engine?.stop();
   if(this.job===job){this.job=null;this.onUpdate({fen,result:this.cache.get(fen),error:this.failure?.fen===fen?this.failure.error:null});}
  });
  // Background callers may leave a cancelled search unobserved.
  job.promise.catch(()=>{});
  return job.promise;
 }
}
export function variationBoard(v){
 const board=new Chess(v.positions[0].fen);
 for(const position of v.positions.slice(1,v.cursor+1)){const uci=position.uci;board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});}
 return board;
}
