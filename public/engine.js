import { Chess } from 'chess.js';

export function requireEvaluation(result){
  if(!result?.depth||!Number.isFinite(result.score))throw new Error('The engine could not evaluate this position. Please try again.');
  return result;
}

export class Engine {
  constructor(){this.worker=null;this.pending=null;}
  async start(){
    if(this.worker)return;
    this.worker=new Worker('/engine/stockfish-19-lite-single.js');
    this.worker.onmessage=e=>this.pending?.onLine(String(e.data));
    this.worker.onerror=()=>this.fail(new Error('Stockfish could not start. Try a current Chrome, Safari, or Firefox browser.'));
    await this.command('uci',line=>line==='uciok'?true:undefined);
    this.worker.postMessage('setoption name Hash value 32');
    await this.command('isready',line=>line==='readyok'?true:undefined);
  }
  command(command,parse,timeout=20000){
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.fail(new Error('The chess engine timed out. Stop and retry analysis.')),timeout);
      this.pending={reject,timer,onLine:line=>{const value=parse(line);if(value!==undefined){clearTimeout(timer);this.pending=null;resolve(value);}}};
      this.worker.postMessage(command);
    });
  }
  fail(error){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null;}this.worker?.terminate();this.worker=null;}
  stop(){this.fail(new DOMException('Analysis stopped','AbortError'));}
  async evaluate(fen,ms=250){
    const board=new Chess(fen);
    if(board.isCheckmate())return {score:board.turn()==='w'?-100000:100000,depth:99,best:null,pv:[],mate:0};
    if(board.isStalemate()||board.isInsufficientMaterial()||board.isDrawByFiftyMoves())return {score:0,depth:99,best:null,pv:[]};
    await this.start();
    this.worker.postMessage(`position fen ${fen}`);
    let info=null;
    return this.command(`go movetime ${ms}`,line=>{
      const score=line.match(/\bscore (cp|mate) (-?\d+)/),depth=line.match(/\bdepth (\d+)/),pv=line.match(/\bpv (.+)$/);
      if(score && depth && pv && !line.includes('bound')){
        const value=Number(score[2]);const side=board.turn()==='w'?1:-1;
        info={score:(score[1]==='mate'?Math.sign(value)*(100000-Math.min(999,Math.abs(value))):value)*side,depth:Number(depth[1]),pv:pv[1].trim().split(/\s+/),mate:score[1]==='mate'?value:null};
      }
      if(line.startsWith('bestmove')){
        if(!info){return {score:0,depth:0,best:null,pv:[]};}
        return {...info,best:line.split(' ')[1]};
      }
    },Math.max(10000,ms+5000));
  }
}
