import {Chess} from 'chess.js';
import {linePositions} from './practice.js';
export function createCorrection(prefix,fen,played,best,line,assessment){
 if(!['Playable alternative','Missed opportunity','Mistake'].includes(assessment.category)||played===best)return null;
 if(!prefix.length||prefix.at(-1).fen!==fen)throw new Error('Correction source position does not match its history');
 const board=new Chess(fen);board.move({from:best.slice(0,2),to:best.slice(2,4),promotion:best[4]});
 if(line[0]!==best)throw new Error('Correction line must begin with the best move');
 return {prefix:prefix.slice(),fen,played,best,line:line.slice(),assessment};
}
export function replacementPositions(correction){
 return [...correction.prefix,...linePositions(correction.fen,correction.line.slice(0,9)).slice(1).map((position,i)=>({...position,uci:correction.line[i]}))];
}
