// Build a bounded offline selection from the official Lichess CC0 puzzle CSV.
// Usage: node scripts/import-puzzles.mjs /path/to/lichess_db_puzzle.csv
// FEN precedes the opponent's move: apply Moves[0] before presenting the puzzle.
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {Chess} from 'chess.js';
import {PUZZLES} from '../public/puzzle-bank.js';
import {Engine,requireEvaluation} from '../public/engine.js';
class NodeWorker{
 constructor(){this.child=spawn(process.execPath,['node_modules/stockfish/bin/stockfish-19-lite-single.js']);let pending='';this.child.stdout.on('data',chunk=>{pending+=chunk;let n;while((n=pending.indexOf('\n'))>=0){const data=pending.slice(0,n).trim();pending=pending.slice(n+1);this.onmessage?.({data});}});this.child.on('error',error=>this.onerror?.(error));}
 postMessage(message){this.child.stdin.write(message+'\n');}terminate(){this.child.kill();}
}
const option=(name,fallback)=>Number(process.argv.find(arg=>arg.startsWith('--'+name+'='))?.split('=')[1]??fallback);
const minRating=option('min-rating',800),maxRating=option('max-rating',1800),perTheme=option('per-theme',30),budget=option('budget',500),append=process.argv.includes('--append');
if(![minRating,maxRating,perTheme,budget].every(Number.isFinite)||minRating<0||maxRating<minRating||perTheme<1||perTheme>250||!Number.isInteger(perTheme)||budget<100||budget>5000)throw new Error('Invalid import options');
const csv=await readFile(process.argv[2],'utf8');
const candidates=csv.split('\n').slice(1,-1).map(row=>row.split(',')).filter(c=>c.length>=10&&/^[A-Za-z0-9]{5}$/.test(c[0])&&+c[3]>=minRating&&+c[3]<=maxRating&&+c[5]>=80&&+c[6]>=100);
const theme=c=>c[7].split(' ').includes('mate')?'mate':c[7].includes('defensiveMove')?'defense':c[7].includes('endgame')?'endgame':'material';
const sourceGames=new Map(csv.split('\n').slice(1,-1).map(row=>{const c=row.split(',');return ['lichess-'+c[0],c[8]?.match(/\/(?:game\/)?([A-Za-z0-9]{8})(?:\/|#|$)/)?.[1]];}));
const puzzles=append?PUZZLES.map(p=>({...p,sourceGame:p.sourceGame||sourceGames.get(p.id)})):[],ids=new Set(puzzles.map(p=>p.id)),games=new Set(puzzles.map(p=>p.sourceGame).filter(Boolean)),positions=new Set(puzzles.map(p=>p.fen.split(' ').slice(0,4).join(' '))),counts={mate:0,defense:0,endgame:0,material:0};
const target=puzzles.length+perTheme*4;
globalThis.Worker=NodeWorker;const engine=new Engine();
try{
 for(const c of candidates){
  const kind=theme(c);if(counts[kind]>=perTheme||ids.has('lichess-'+c[0]))continue;
  const game=c[8].match(/\/(?:game\/)?([A-Za-z0-9]{8})(?:\/|#|$)/)?.[1];if(!game||games.has(game))continue;
  try{
   const moves=c[2].split(' '),board=new Chess(c[1]);const play=uci=>board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
   play(moves[0]);const fen=board.fen(),color=board.turn(),key=fen.split(' ').slice(0,4).join(' ');if(positions.has(key)||board.isGameOver())continue;
   for(const uci of moves.slice(1))play(uci);
   const result=requireEvaluation(await engine.evaluate(fen,budget)),score=result.score*(color==='w'?1:-1);
   if(result.depth<10||result.best!==moves[1]||score< -200||kind==='mate'&&score<99000||['material','endgame'].includes(kind)&&score<100)continue;
   puzzles.push({id:'lichess-'+c[0],theme:kind,fen,color,best:result.best,pv:moves.slice(1),beforeScore:result.score,depth:result.depth,rating:+c[3],source:'https://lichess.org/training/'+c[0],license:'CC0-1.0',sourceGame:game});
   counts[kind]++;ids.add('lichess-'+c[0]);games.add(game);positions.add(key);console.log(puzzles.length,JSON.stringify(counts));
   if(puzzles.length===target)break;
  }catch(error){console.error('Skipped',c[0],error.message);}
 }
 if(puzzles.length<target)throw new Error('Not enough validated puzzles: '+JSON.stringify(counts));
 await writeFile(new URL('../public/puzzle-bank.js',import.meta.url),'// Lichess puzzle database (CC0): https://database.lichess.org/#puzzles\n// Distinct source games; solutions checked with Stockfish 19 Lite. See scripts/import-puzzles.mjs.\nexport const PUZZLES='+JSON.stringify(puzzles,null,2)+';\n');
}finally{engine.stop();delete globalThis.Worker;}
