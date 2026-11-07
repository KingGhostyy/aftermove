import {Chess} from 'chess.js';
function position(pieces){const board=new Chess();board.clear();for(const [square,code] of Object.entries(pieces))board.put({color:code[0],type:code[1]},square);return board.fen();}
const seeds=[
 ['back-rank','mate',{g1:'wk',a1:'wr',f2:'wp',g2:'wp',h2:'wp',g8:'bk',f7:'bp',g7:'bp',h7:'bp'}],
 ['knight-net','mate',{a1:'wk',g5:'wn',h8:'bk',g8:'br',g7:'bp',h7:'bp'}],
 ['loose-queen','material',{g1:'wk',c1:'wr',h8:'bk',c6:'bq'}],
 ['knight-fork','material',{g1:'wk',e5:'wn',h8:'bk',h6:'bq',d8:'br'}],
 ['capture-the-check','defense',{g1:'wk',d1:'wq',f2:'wp',h2:'wp',g8:'bk',e1:'br',h3:'bb'}],
 ['block-the-file','defense',{g1:'wk',a1:'wr',d1:'wq',e2:'wn',f2:'wp',h2:'wp',g8:'bk',e8:'br',g6:'bq',h3:'bb'}],
 ['promote-with-check','endgame',{f6:'wk',e7:'wp',h8:'bk'}],
 ['king-and-pawn','endgame',{e5:'wk',f6:'wp',g8:'bk'}],
];
export const PUZZLE_SEEDS=seeds.flatMap(([id,theme,pieces])=>{
 const fen=position(pieces),board=new Chess();board.clear();for(const [square,code] of Object.entries(pieces))board.put({color:code[0]==='w'?'b':'w',type:code[1]},square[0]+(9-Number(square[1])));
 const mirrored=board.fen().split(' ');mirrored[1]='b';
 return [{id:'fresh-'+id+'-w',theme,fen},{id:'fresh-'+id+'-b',theme,fen:mirrored.join(' ')}];
});
