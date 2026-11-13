import {moveInsight,playedMoveInsight} from './insights.js';
import {createCorrection,replacementPositions,comparisonPositions} from './corrections.js';
import {VariationAnalysis,variationBoard} from './variation-engine.js';
import { savedGameCollection, progressSummary } from './progress.js';
import { PUZZLES, THEMES, freshExercises, weaknessProfile, readPuzzleHistory, markPuzzleSeen } from './puzzles.js';
import { gameChoices, selectedGames } from './game-picker.js';
import { captureReviewScroll, restoreReviewScroll } from './scroll.js';
import { persistWorkspace, SAVE_WARNING } from './storage.js';
import { reviewMoves, reviewSelection, reviewMoveQuality, reviewAlternativeSource } from './review.js';
import { Chess } from 'chess.js';
import { Engine, requireEvaluation } from './engine.js';
import { searchingEval } from './eval.js';
import { assessAlternative, continuationConsequence } from './feedback.js';
import { attachPieceDrag } from './drag.js';
import { thinkingMoments, gameThinkingSummary } from './timing.js';
import { linePositions, explainMove, attachArrows, practicePosition, practiceHasStarted, solutionContinuation, extendPracticeLine } from './practice.js';
import { ANALYSIS_VERSION, parseGame, classifyMove, summarize, makeExercise, sanLine } from './analysis.js';

const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols={wk:'♚',wq:'♛',wr:'♜',wb:'♝',wn:'♞',wp:'♟',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
const names={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
let state={username:'',games:[],view:'overview',running:false,engine:null,abort:null,exerciseIndex:0,practice:null,review:null,cache:new Map()};
let db;
let picker=null,pickerLoading=false;
let practiceMode='fresh',freshSession=null,reviewSeen=false,progressFormat=null;
let deepJob=null;
let renderedReview=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function notice(message,error=false){$('#notice').textContent=message;$('#notice').className=error?'error':'';$('#notice').hidden=!message;}
async function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open('aftermove',1);request.onupgradeneeded=()=>request.result.createObjectStore('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function dbGet(key){return new Promise((resolve,reject)=>{const request=db.transaction('workspace').objectStore('workspace').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function save(){const saved=await persistWorkspace(db?dbSnapshot:null,state.username,state.games,state.cache,ANALYSIS_VERSION);state.saveFailed=!saved;if(!saved)notice(SAVE_WARNING,true);return saved;}
function dbSnapshot(key,value,username){return new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace');store.put(value,key);store.put(username,'last-user');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function cancelPractice(){const p=state.practice;if(p?.engine){p.cancelled=true;p.engine.stop();p.engine=null;p.busy=false;}}

function allSavedGames(){return savedGameCollection(state.cache,state.games);}
function puzzleHistory(){try{return readPuzzleHistory(localStorage,state.username||'@guest');}catch{return {};}}
function exercises(){if(practiceMode==='fresh')return freshSession?.username===state.username?freshSession.list:freshExercises(allSavedGames(),puzzleHistory(),reviewSeen);return state.games.flatMap(g=>g.moves.map(m=>{const ex=makeExercise(m);return ex?{...ex,game:g,id:`${g.id}:${m.ply}`}:null;}).filter(Boolean)).sort((a,b)=>b.loss-a.loss).slice(0,30);}
function setView(view){if(view==='practice'){freshSession=null;reviewSeen=false;state.exerciseIndex=0;}cancelPractice();lastEvalScore=undefined;cancelVariation();cancelDeep();stopPlayback();stopEvaluation();state.view=view;state.review=null;state.practice=null;render();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));

const evalCache=new Map();
let lastEvalScore;
let evalRequest=null,evalEngine=null,evalTimer=null;
function stopEvaluation(){evalRequest=null;clearTimeout(evalTimer);evalEngine?.stop();evalEngine=null;}
function evalBoard(board,orientation){const d=searchingEval(undefined,lastEvalScore);return '<div class="evaluated-board"><div class="eval-bar '+(orientation==='b'?'flipped':'')+'" role="img" aria-busy="true" aria-label="'+escape(d.description)+'"><div class="eval-white" style="height:'+d.whitePercent+'%"></div><span class="eval-refresh" aria-hidden="true"></span><span class="eval-score">'+d.label+'</span></div>'+board+'</div><div class="eval-caption">'+(Number.isFinite(lastEvalScore)?'Previous eval · updating…':'Evaluating…')+'</div>';}
function paintEval(score){const bar=$('.eval-bar');if(!bar)return;if(Number.isFinite(score))lastEvalScore=score;const d=searchingEval(score,lastEvalScore);bar.querySelector('.eval-white').style.height=d.whitePercent+'%';bar.querySelector('.eval-score').textContent=d.label;bar.setAttribute('aria-label',d.description);bar.setAttribute('aria-busy',String(d.pending));bar.title=d.description;const caption=$('.eval-caption');if(caption)caption.textContent=d.pending?(Number.isFinite(lastEvalScore)?'Previous eval · updating…':'Evaluating…'):'Eval · White + / Black −';}
function paintEvalUnavailable(){
 const bar=$('.eval-bar');if(!bar)return;
 bar.title=Number.isFinite(lastEvalScore)?'Previous position evaluation. Current evaluation unavailable; change moves to retry.':'Evaluation unavailable. Change moves to retry.';
 bar.setAttribute('aria-busy','false');bar.setAttribute('aria-label',bar.title);
 const caption=$('.eval-caption');if(caption)caption.textContent=Number.isFinite(lastEvalScore)?'Previous eval · update unavailable':'Evaluation unavailable';
}
function requestEvaluation(fen,known){
  if(Number.isFinite(known))evalCache.set(fen,known);
  if(!evalCache.has(fen))for(const game of state.games){for(const move of game.moves){if(move.fen===fen)evalCache.set(fen,move.beforeScore);else if(move.afterFen===fen)evalCache.set(fen,move.afterScore);}}
  if(Number.isFinite(evalCache.get(fen))){stopEvaluation();paintEval(evalCache.get(fen));return;}
  paintEval(undefined);
  if(evalRequest===fen)return;
  stopEvaluation();evalRequest=fen;
  const run=async()=>{
    if(evalRequest!==fen||!$('.eval-bar'))return;
    if(state.running){$('.eval-bar').title='Waiting for batch analysis';evalTimer=setTimeout(run,500);return;}
    const work=async()=>{
      if(evalRequest!==fen)return;
      const engine=new Engine();evalEngine=engine;
      try{const result=await engine.evaluate(fen,300);requireEvaluation(result);evalCache.set(fen,result.score);if(evalRequest===fen)paintEval(result.score);}
      catch(error){if(evalRequest===fen&&error.name!=='AbortError')paintEvalUnavailable();}
      finally{engine.stop();if(evalEngine===engine)evalEngine=null;}
    };
    if(navigator.locks)await navigator.locks.request('aftermove-analysis',{ifAvailable:true},async lock=>{if(!lock){if(evalRequest===fen)evalTimer=setTimeout(run,350);return;}await work();});else await work();
  };
  evalTimer=setTimeout(run,120);
}

function boardMarkup(fen,orientation='w',interactive=false,selected=null,targets=[],last=[]){
  const chess=new Chess(fen),files=orientation==='w'?'abcdefgh':'hgfedcba',ranks=orientation==='w'?'87654321':'12345678';
  return `<div class="board" aria-label="Chessboard">${[...ranks].map((rank,ri)=>[...files].map((file,fi)=>{
    const square=file+rank,p=chess.get(square),dark=(file.charCodeAt(0)-97+Number(rank))%2===0;
    return `<button type="button" class="square ${dark?'dark':''} ${square===selected?'selected':''} ${last.includes(square)?'last':''} ${targets.includes(square)?'legal-target':''} ${targets.includes(square)&&p?'legal-capture':''}" data-square="${square}" ${interactive?'':'tabindex="-1"'} aria-label="${square}${p?`, ${p.color==='w'?'white':'black'} ${names[p.type]}`:', empty'}">${p?`<span class="piece ${p.color==='w'?'white-piece':''}">${symbols[p.color+p.type]}</span>`:''}${targets.includes(square)?`<span class="dot ${p?'capture-dot':''}"></span>`:''}${fi===0?`<span class="coord rank">${rank}</span>`:''}${ri===7?`<span class="coord">${file}</span>`:''}</button>`;
  }).join('')).join('')}</div>`;
}
function emptyOverview(){
  return `<div class="welcome-grid"><section class="hero-card"><span class="tag">FROM PLAYING TO IMPROVING</span><h2>Your next breakthrough is in your last game.</h2><p>A missed opportunity. A good instinct. A pattern you haven’t noticed yet.</p><span class="hero-bottom">Small lessons.<br>Stronger moves.</span><div class="mini-board-wrap" aria-hidden="true">${boardMarkup('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 4')}</div></section><section class="how-panel"><div class="panel-header"><h2>A coach built around you</h2><span class="muted">HOW IT WORKS</span></div><div class="step"><span class="step-num">01</span><div><h3>Look back at your games</h3><p>Bring in 1–15 recent games. We’ll look at your moves, one position at a time.</p></div></div><div class="step"><span class="step-num">02</span><div><h3>Know what to work on</h3><p>See where you lose ground, what you do well, and which game phase needs attention.</p></div></div><div class="step"><span class="step-num">03</span><div><h3>Make the next move better</h3><p>Practice real moments from your games. Find a stronger move before seeing the answer.</p></div></div></section></div><div class="empty-metrics"><div class="empty-metric"><span class="metric-icon">◎</span><div><strong>Your games. Your lessons.</strong><p>Practice that starts with how you play.</p></div></div><div class="empty-metric"><span class="metric-icon">♧</span><div><strong>A manageable first step</strong><p>10 games to start. Up to 15 per batch.</p></div></div><div class="empty-metric"><span class="metric-icon">◇</span><div><strong>Free engine. Local analysis.</strong><p>No AI credits or subscription needed.</p></div></div></div>`;
}
function overview(){
  if(!state.games.length)return emptyOverview();
  const s=summarize(state.games),focus=s.phases.find(p=>p.name===s.focus),strength=s.strength;
  return `<div class="metrics"><div class="metric"><span>GAMES ANALYZED</span><strong>${state.games.length}</strong><small>Your latest saved batch</small></div><div class="metric"><span>RESULTS</span><strong>${s.wins}<span style="font-size:17px">W · ${state.games.length-s.wins-s.draws}L · ${s.draws}D</span></strong><small>Across this sample</small></div><div class="metric"><span>COSTLY MOVES</span><strong>${s.blunders+s.mistakes}</strong><small>${s.blunders} blunders · ${s.mistakes} mistakes</small></div><div class="metric"><span>PRACTICE POSITIONS</span><strong>${exercises().length}</strong><small>Fresh drills + game moments</small></div></div><div class="insight-grid"><section class="insight focus"><span class="tag">YOUR NEXT FOCUS</span><h3>${focus&&focus.errors?`${escape(focus.name)} decisions`:'Keep checking your candidates'}</h3><p>${focus&&focus.errors?`${focus.errors} mistakes or blunders in ${focus.count} ${focus.name.toLowerCase()} moves. Before committing, check your opponent’s checks, captures, and threats. Start with the positions where you lost the most ground.`:'No clear recurring problem yet. Review your largest evaluation drops and compare your move with the engine’s suggestion.'}</p><button class="secondary" id="focus-practice">Practice these moments →</button></section><section class="insight"><span class="tag">SOMETHING TO BUILD ON</span><h3>${strength?`${escape(strength.name)} is your steadiest phase`:'Your good moves matter, too'}</h3><p>${strength?`Your lowest average evaluation loss was in the ${strength.name.toLowerCase()}: ${(strength.loss/100).toFixed(2)} pawns per move across ${strength.numericCount} non-mate positions. This is a relative strength in this sample, not a rating of your overall ability.`:'We need at least five analyzed moves in a phase before highlighting a relative strength.'} ${s.sound} of ${s.totalMoves} moves were classified as sound by the quick search.</p></section></div><section class="panel"><div class="panel-header"><h2>Where your position changes</h2><span class="muted">AVERAGE LOSS PER MOVE</span></div>${s.phases.map(p=>`<div class="phase-row"><span>${p.name}</span><div class="phase-bar"><i style="width:${p.count?Math.min(100,Math.max(2,p.loss/3)):0}%"></i></div><small>${p.count?`${(p.loss/100).toFixed(2)} pawns · ${p.count} moves`:'Not enough data'}</small></div>`).join('')}<p class="sample-note">Lower is better. Forced-mate positions are excluded from pawn averages. Quick Stockfish analysis is an estimate; short searches can miss deeper ideas. A 1–15 game sample suggests things to investigate, not firm conclusions.</p></section>${thinkingSection()}${gameTable(state.games.slice(0,4),true)}`;
}
function thinkingSection(){
  const moments=thinkingMoments(state.games),hasTiming=state.games.some(g=>g.moves.some(m=>Number.isFinite(m.thinkSeconds)));
  return '<section class="panel"><div class="panel-header"><h2>Where your thinking got stuck</h2><span class="muted">CLOCK + MOVE QUALITY</span></div>'+ (moments.length?moments.map(({game,move,median})=>`<div class="thinking-row"><div><strong>${Math.round(move.thinkSeconds)} seconds on ${move.moveNumber}. ${escape(move.san)}</strong><p>Typical move: ${Math.round(median)}s in this game · ${escape(move.label)} · vs ${escape(game.opponent)}</p></div><button class="secondary review" data-id="${escape(game.id)}" data-ply="${move.ply}">Look deeper →</button></div>`).join(''): '<p class="sample-note">'+(hasTiming?'No unusually long-think mistakes found in this batch. That is not a judgment of your overall thinking.':'Clock data is missing from these saved games. Missing clocks stay marked as unavailable.')+'</p>')+'<p class="sample-note">Flags mistakes after at least 15 seconds and twice your median move time in the same game, with at least five timed moves. Time spent does not tell us what you were thinking.</p></section>';
}
function gameTable(games,preview=false){return `<div class="section-title"><div><h2>${preview?'Recent games':'Your analyzed games'}</h2><p>Explore the turning points, one move at a time.</p></div>${preview?'<button class="text-button" id="all-games">View all games →</button>':''}</div><div class="panel table-wrap" style="margin-top:0;padding:5px 10px"><table class="game-table"><thead><tr><th>Opponent / opening</th><th>Format</th><th>Result</th><th>Costly moves</th><th></th></tr></thead><tbody>${games.map(g=>`<tr><td><strong>${escape(g.opponent)}</strong><span class="opening">${escape(g.opening)}</span></td><td>${escape(g.timeClass)}<span class="opening">${g.color==='w'?'White':'Black'} · ${g.date?new Date(g.date*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'}):''}</span></td><td><span class="pill ${g.result.toLowerCase()}">${g.result}</span></td><td>${g.moves.filter(m=>m.loss>=100).length}</td><td><button class="text-button review" data-id="${escape(g.id)}">Explore →</button></td></tr>`).join('')}</tbody></table></div>`;}
function emptyState(title,description){return `<section class="empty-state"><div class="empty-piece">♘</div><h2>${title}</h2><p>${description}</p><button class="secondary" id="back-overview">Back to overview</button></section>`;}
function renderProgress(){
 const games=allSavedGames(),formats=[...new Set(games.map(g=>g.timeClass).filter(Boolean))];
 if(progressFormat===null)progressFormat=formats.includes('rapid')?'rapid':formats[0]||'rapid';
 const s=progressSummary(games,progressFormat),points=s.points;
 const max=Math.max(10,...points.map(p=>p.errorRate)),first=points[0]?.date||0,last=points.at(-1)?.date||first;
 const x=p=>50+(last===first?0.5:(p.date-first)/(last-first))*620,y=p=>175-p.errorRate/max*140;
 const date=seconds=>new Date(seconds*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'});
 const chart=points.length?`<svg class="progress-chart" viewBox="0 0 720 220" role="img" aria-label="Costly moves per 100 analyzed moves, ordered by game date. Lower is better."><line x1="50" y1="175" x2="670" y2="175" stroke="#cbd6c0"/><line x1="50" y1="35" x2="670" y2="35" stroke="#e7edde" stroke-dasharray="4 5"/><text x="6" y="40">${max.toFixed(0)}</text><text x="18" y="179">0</text><polyline fill="none" stroke="#6d8d50" stroke-width="3" points="${points.map(p=>x(p)+','+y(p)).join(' ')}"/>${points.map(p=>`<circle cx="${x(p)}" cy="${y(p)}" r="5" fill="#315943"><title>${escape(date(p.date)+' · vs '+p.opponent+' · '+p.errorRate.toFixed(1)+' costly moves per 100 · '+p.moves+' analyzed moves')}</title></circle>`).join('')}<text x="50" y="210">${date(first)}</text><text x="670" y="210" text-anchor="end">${date(last)}</text></svg>`:'<div class="progress-empty">Analyze a game to start your timeline. Saved games need a played date and assessed moves to appear here.</div>';
 const c=s.comparison;
 $('#view').innerHTML=`<section class="progress-intro"><div><span class="tag">YOUR LONG GAME</span><h2>Small improvements add up.</h2><p>Across all saved analysis for ${escape(state.username||'your account')}, ordered by when each game was played.</p></div><div class="progress-filter"><span>Compare one format</span><div class="format-buttons" role="group" aria-label="Game format">${[...new Set([...formats,'rapid','blitz','bullet','daily','all'])].map(f=>`<button type="button" data-progress-format="${escape(f)}" aria-pressed="${f===progressFormat}">${f==='all'?'All formats':escape(f[0].toUpperCase()+f.slice(1))}</button>`).join('')}</div></div></section><div class="metrics"><div class="metric"><span>GAMES IN THIS VIEW</span><strong>${s.games}</strong><small>${s.moves} analyzed moves</small></div><div class="metric"><span>MISTAKES / 100 MOVES</span><strong>${s.moves?s.mistakeRate.toFixed(1):'—'}</strong><small>${s.mistakes} mistakes total</small></div><div class="metric"><span>BLUNDERS / 100 MOVES</span><strong>${s.moves?s.blunderRate.toFixed(1):'—'}</strong><small>${s.blunders} blunders total</small></div><div class="metric"><span>ALL SAVED GAMES</span><strong>${games.length}</strong><small>For this username, including older batches</small></div></div><section class="panel progress-panel"><div class="panel-header"><div><h2>Costly moves over time</h2><p class="sample-note">Mistakes + blunders per 100 analyzed moves · lower is better</p></div><span class="pill">${s.games} games</span></div>${chart}<p class="sample-note">Each point is one game; hover for its sample size. A short game can swing the rate sharply. This reflects the selected saved games, not your rating or proof of lasting improvement.${progressFormat==='all'?' Different time controls are mixed in this view.':''}</p></section><section class="insight progress-comparison"><span class="tag">EARLIER → RECENT</span><h3>${c?(c.change===0?'No change in the rate of costly moves':`${Math.abs(c.change).toFixed(1)} ${c.change<0?'fewer':'more'} costly moves per 100`):'More games will make the comparison useful'}</h3><p>${c?`Earlier ${c.before.games} games: ${c.before.errorRate.toFixed(1)} per 100 across ${c.before.moves} moves. Latest ${c.after.games} games: ${c.after.errorRate.toFixed(1)} per 100 across ${c.after.moves} moves. Rates are weighted by analyzed moves, so short games do not count as much as long games.`:'Save at least six dated games in one format for an earlier-versus-recent comparison. You can still explore individual games above.'}</p></section><section class="panel"><div class="panel-header"><h2>Games behind the chart</h2><span class="muted">${Math.min(20,points.length)} most recent</span></div><div class="progress-games">${points.slice(-20).reverse().map(p=>`<button class="progress-game" data-progress-game="${escape(p.id)}"><span><strong>vs ${escape(p.opponent)}</strong><small>${date(p.date)} · ${escape(p.timeClass)} · ${p.moves} moves analyzed</small></span><span>${p.mistakes} mistakes · ${p.blunders} blunders<strong>${p.errorRate.toFixed(1)} / 100 →</strong></span></button>`).join('')||'<p class="sample-note">Your dated analyzed games will appear here.</p>'}</div><p class="sample-note">Mistake: 1–2 pawns of evaluation lost; blunder: 2+ or a lost forced mate. Short engine searches are estimates. Deeper rechecks can change older labels and the chart; missing dates or assessments are excluded.</p></section>`;
 document.querySelectorAll('[data-progress-format]').forEach(button=>button.onclick=()=>{progressFormat=button.dataset.progressFormat;renderProgress();Array.from(document.querySelectorAll('[data-progress-format]')).find(b=>b.dataset.progressFormat===progressFormat)?.focus({preventScroll:true});});
 document.querySelectorAll('[data-progress-game]').forEach(button=>button.onclick=()=>{const game=games.find(g=>g.id===button.dataset.progressGame);if(!game)return;setView('games');state.review={game,index:Math.max(0,game.moves.findIndex(m=>m.loss>=100)),after:false};render();});
}
function practiceHeader(){
 const profile=weaknessProfile(allSavedGames()),top=Object.keys(profile).sort((a,b)=>profile[b]-profile[a])[0],count=profile[top];
 return `<section class="practice-library"><div class="practice-tabs" role="group" aria-label="Practice source"><button id="fresh-mode" class="${practiceMode==='fresh'?'primary':'secondary'}" aria-pressed="${practiceMode==='fresh'}">Fresh puzzles</button><button id="game-mode" class="${practiceMode==='games'?'primary':'secondary'}" aria-pressed="${practiceMode==='games'}">From your games</button></div><div><strong>${practiceMode==='fresh'?'New positions. Familiar skills.':'Revisit your turning points.'}</strong><p>${practiceMode==='fresh'?`${PUZZLES.length} distinct Lichess puzzles, checked with Stockfish. ${reviewSeen?'Reviewing seen puzzles.':'Only unseen puzzles are shown.'} ${count?`Suggested theme: ${THEMES[top]} (${count} relevant analyzed errors).`:'Analyze games for theme suggestions.'} Themes are broad training suggestions, not a diagnosis.`:'Positions from your selected game batch. Switch to Fresh puzzles to train on boards outside your imported games.'}</p></div></section>`;
}
function bindPracticeModes(){
 for(const [id,mode] of [['fresh-mode','fresh'],['game-mode','games']])$('#'+id).onclick=()=>{if(state.running)return;cancelPractice();stopPlayback();stopEvaluation();practiceMode=mode;reviewSeen=false;freshSession=null;state.exerciseIndex=0;state.practice=null;render();};
}

function render(){
  const titles={overview:state.games.length?'A clearer picture of your chess.':'Every game has a lesson.',games:'Look back. See more.',practice:'A second chance at the right move.',progress:'Your chess, over time.'};
  const subtitles={overview:state.games.length?`A few lessons from ${state.games.length} ${state.games.length===1?'game':'games'} by ${state.username}.`: 'Find yours. Turn your recent games into a clear path forward.',games:'Follow your decisions and uncover the moments that changed the game.',practice:'Fresh training positions and real moments from your games.',progress:'Look for a direction across all your saved games.'};
  $('#page-title').textContent=titles[state.view];$('#page-subtitle').textContent=subtitles[state.view];$('#breadcrumb').textContent=state.view==='games'?'Your games':state.view[0].toUpperCase()+state.view.slice(1);
  $('#game-count').textContent=state.games.length;$('#practice-count').textContent=exercises().length;$('#sidebar-user').textContent=state.username||'Your next move';
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  $('#import-panel').hidden=state.view!=='overview';renderGamePicker();
  if(state.view==='progress'){renderProgress();return;}
  if(state.view==='practice'){renderPractice();return;}
  if(state.review){renderReview();return;}
  $('#view').innerHTML=state.view==='overview'?overview():state.games.length?gameTable(state.games):emptyState('Your story starts with a game','Enter your Chess.com username in Overview to analyze your first batch.');
  $('#focus-practice')?.addEventListener('click',()=>setView('practice'));
  $('#all-games')?.addEventListener('click',()=>setView('games'));
  $('#back-overview')?.addEventListener('click',()=>setView('overview'));
  document.querySelectorAll('.review').forEach(b=>b.onclick=()=>{const game=state.games.find(g=>g.id===b.dataset.id);lastEvalScore=undefined;state.view='games';state.review={game,index:Math.max(0,b.dataset.ply?game.moves.findIndex(m=>m.ply===Number(b.dataset.ply)):game.moves.findIndex(m=>m.loss>=100)),after:false};render();});
}

function renderGamePicker(){
 const panel=$('#game-picker');panel.hidden=!picker||state.view!=='overview';if(!picker){panel.replaceChildren();return;}
 const page=document.scrollingElement||document.documentElement,pageTop=page.scrollTop,listTop=panel.querySelector('.picker-list')?.scrollTop||0,focused=panel.contains(document.activeElement)?document.activeElement.dataset.pick:null;
 const count=selectedGames(picker.choices,picker.selected).length;
 panel.innerHTML=`<div class="section-title"><div><h2>Choose your games</h2><p>${picker.choices.length} recent completed games for ${escape(picker.username)}. Select up to 15 to analyze.</p></div><span class="pill">${count} selected</span></div><div class="picker-list">${picker.choices.map(g=>`<div class="picker-row ${g.saved?'saved':''}"><label><input type="checkbox" data-pick="${escape(g.id)}" aria-label="Select game against ${escape(g.opponent)} on ${new Date(g.date*1000).toLocaleString()}" ${picker.selected.has(g.id)?'checked':''} ${g.saved||state.running?'disabled':''}><span><strong>vs ${escape(g.opponent)}</strong><small>${new Date(g.date*1000).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})} · ${escape(g.timeClass)} · ${g.color==='w'?'White':'Black'}</small></span></label><span class="pill ${g.result.toLowerCase()}">${g.result}</span>${g.saved?`<button class="text-button" data-saved-game="${escape(g.id)}" ${state.running?'disabled':''}>Analyzed · Review →</button>`:'<span class="picker-status">Not analyzed</span>'}</div>`).join('')}</div><div class="picker-actions"><button class="primary" id="analyze" ${!count||state.running?'disabled':''}>${state.running?'Analyzing…':`Analyze ${count||''} selected ${count===1?'game':'games'}`}</button><span>Selections stay tied to these exact games, even when you play a newer one.</span></div>`;
 panel.querySelectorAll('[data-pick]').forEach(input=>input.onchange=()=>{if(input.checked)picker.selected.add(input.dataset.pick);else picker.selected.delete(input.dataset.pick);renderGamePicker();});
 panel.querySelectorAll('[data-saved-game]').forEach(button=>button.onclick=()=>{const game=picker.cache.get(button.dataset.savedGame);if(!game)return;const username=picker.username,cache=picker.cache;setView('games');if(state.username.toLowerCase()!==username.toLowerCase())progressFormat=null;state.username=username;state.cache=cache;state.games=[game];state.review={game,index:0,after:false};render();});
 $('#analyze').onclick=analyzeSelectedGames;
 panel.querySelector('.picker-list').scrollTop=listTop;
 if(focused)Array.from(panel.querySelectorAll('[data-pick]')).find(input=>input.dataset.pick===focused)?.focus({preventScroll:true});
 page.scrollTop=pageTop;
}
$('#username').addEventListener('input',()=>{picker=null;renderGamePicker();});
$('#import-form').onsubmit=async e=>{
 e.preventDefault();if(state.running||pickerLoading)return;
 const username=$('#username').value.trim();if(!username)return;
 pickerLoading=true;picker=null;renderGamePicker();$('#load-games').disabled=true;$('#username').disabled=true;notice('Loading recent games…');
 try{
  const response=await fetch(`/api/games?username=${encodeURIComponent(username)}&limit=15`);const data=await response.json();if(!response.ok)throw new Error(data.error);
  const cached=db?await dbGet(username.toLowerCase()).catch(()=>null):null;
  const existing=cached?.version===ANALYSIS_VERSION?(cached.cache||cached.games||[]):[];
  const cache=new Map([...existing,...(state.username.toLowerCase()===username.toLowerCase()?[...state.cache.values(),...state.games]:[])].map(g=>[g.id,g]));
  picker={username,cache,choices:gameChoices(data.games,username,new Set(cache.keys())),selected:new Set(),limited:data.limited};renderGamePicker();
  notice(picker.choices.length?'Choose the exact games you want to analyze below.':'No completed standard games found in the recent archives.');
 }catch(error){notice(error.message||'Could not load your games.',true);}
 finally{pickerLoading=false;$('#load-games').disabled=false;$('#username').disabled=false;}
};

$('#stop').onclick=()=>{if(!state.running)return;state.running=false;state.abort?.abort();state.engine?.stop();notice(state.saveFailed?SAVE_WARNING:'Analysis stopped. Completed games remain available; analyze the same batch to continue.',!!state.saveFailed);};
async function analyzeSelectedGames(){
  if(state.running||!picker||picker.username.toLowerCase()!==$('#username').value.trim().toLowerCase())return;stopEvaluation();
  const username=picker.username,data={games:selectedGames(picker.choices,picker.selected),limited:picker.limited};
  if(!data.games.length)return;
  const work=async()=>{
    state.running=true;state.abort=new AbortController();$('#load-games').disabled=true;$('#username').disabled=true;renderGamePicker();$('#job-panel').hidden=false;$('#stop').disabled=false;notice('');$('#job-title').textContent='Preparing your selected games…';$('#job-progress').value=0;$('#job-detail').textContent='Reading completed games from Chess.com. No password needed.';
    let skipped=0,analyzed=0;
    try{
      const cached=db?await dbGet(username.toLowerCase()).catch(()=>null):null;
      const existing=cached?.version===ANALYSIS_VERSION?(cached.cache||cached.games||[]):[];
      const sameUser=state.username.toLowerCase()===username.toLowerCase();
      const byId=new Map([...existing,...(sameUser?[...state.cache.values(),...state.games]:[])].map(g=>[g.id,g]));
      if(!state.running)return;
      if(!sameUser)progressFormat=null;
      state.cache=byId;state.username=username;state.games=[];state.practice=null;state.review=null;
      state.engine=new Engine();
      for(let i=0;i<data.games.length;i++){
        if(!state.running)break;
        const raw=data.games[i];
        if(byId.has(raw.url)){
          const cachedGame=byId.get(raw.url);
          try{const metadata=parseGame(raw,username);const byPly=new Map(metadata.moves.map(m=>[m.ply,m]));cachedGame.history=metadata.history;cachedGame.timeControl=metadata.timeControl;cachedGame.moves.forEach(m=>{const timing=byPly.get(m.ply);if(timing){m.thinkSeconds=timing.thinkSeconds;m.clockSeconds=timing.clockSeconds;}});}catch{}
          state.games.push(cachedGame);await save();render();continue;
        }
        let game;
        try{game=parseGame(raw,username);}catch{skipped++;continue;}
        $('#job-title').textContent=`Analyzing game ${i+1} of ${data.games.length} · vs ${game.opponent}`;
        $('#job-progress').value=0;
        for(let j=0;j<game.moves.length;j++){
          if(!state.running)break;
          const m=game.moves[j];
          $('#job-detail').textContent=`Move ${m.moveNumber} · ${m.phase.toLowerCase()} · One engine thread. You can stop anytime.`;
          const before=await state.engine.evaluate(m.fen),after=await state.engine.evaluate(m.afterFen);
          if(!before.depth || !after.depth)throw new Error('The engine could not evaluate this position. Retry the batch to continue.');
          Object.assign(m,classifyMove(before.score,after.score,game.color),{beforeScore:before.score,afterScore:after.score,best:before.best,pv:before.pv,depth:before.depth,afterDepth:after.depth});
          $('#job-progress').value=((j+1)/game.moves.length)*100;
          await sleep(75);
        }
        if(!state.running)break;
        state.games.push(game);analyzed++;await save();render();
      }
      if(state.running&&await save()){notice(`Analyzed and saved ${analyzed} selected ${analyzed===1?'game':'games'}. ${skipped?`${skipped} unreadable game(s) skipped. `:''}${data.limited?'Import checked the most recent 24 archive months. ':''}Your lessons and practice positions are ready.`);}
    }catch(error){if(error.name!=='AbortError')notice(error.message||'Something went wrong. Please try again.',true);}
    finally{state.engine?.stop();state.engine=null;state.running=false;$('#load-games').disabled=false;$('#username').disabled=false;if(picker?.username.toLowerCase()===username.toLowerCase()&&state.username.toLowerCase()===username.toLowerCase()){picker.cache=state.cache;picker.choices=gameChoices(picker.choices.map(g=>g.raw),username,new Set(state.cache.keys()));picker.selected=new Set([...picker.selected].filter(id=>!state.cache.has(id)));}$('#job-panel').hidden=true;render();}
  };
  if(navigator.locks){await navigator.locks.request('aftermove-analysis',{ifAvailable:true},async lock=>{if(!lock){notice('Analysis is already running in another tab. Stop it there before starting a new batch.',true);return;}await work();});}else await work();
}

function lossText(m){return m.mateLost?(m.beforeScore*(m.color==='w'?1:-1)>99000?'a forced-mate opportunity':'the chance to avoid forced mate'):`approximately ${(m.loss/100).toFixed(2)} pawns of evaluation`;}
function evalText(value){if(Math.abs(value)>99000)return value>0?'White has a forced mate':'Black has a forced mate';return `${value>0?'+':''}${(value/100).toFixed(2)} (White’s perspective)`;}
function cancelDeep(refresh=false){if(deepJob){deepJob.cancelled=true;deepJob.engine.stop();deepJob=null;}if(refresh&&state.review)renderReview();}
async function analyzeDeeper(){
  if(!state.review||deepJob)return;
  stopEvaluation();const review=state.review,move=review.game.moves[review.index];
  const run=async()=>{
    if(state.review!==review||review.game.moves[review.index]!==move)return;
    const job={engine:new Engine(),cancelled:false};deepJob=job;renderReview();
    try{
      const before=await job.engine.evaluate(move.fen,2000),after=await job.engine.evaluate(move.afterFen,2000);
      if(job.cancelled)return;
      if(!before.depth||!after.depth)throw new Error('The deeper search could not evaluate this move.');
      Object.assign(move,classifyMove(before.score,after.score,review.game.color),{beforeScore:before.score,afterScore:after.score,best:before.best,pv:before.pv,depth:before.depth,afterDepth:after.depth,deepAt:Date.now()});
      evalCache.set(move.fen,before.score);evalCache.set(move.afterFen,after.score);const saved=await save();
      if(saved)notice('Deeper analysis saved. The move label and suggested continuation reflect the longer search.');
    }catch(error){if(error.name!=='AbortError')notice(error.message,true);}
    finally{job.engine.stop();if(deepJob===job)deepJob=null;if(state.review===review)renderReview();}
  };
  if(navigator.locks)await navigator.locks.request('aftermove-analysis',{ifAvailable:true},async lock=>{if(!lock){notice('Another engine task is running. Finish or stop it before deeper analysis.',true);return;}await run();});else await run();
}
function reviewMovePanel(game,index,after){
  const timing=gameThinkingSummary(game),flagged=new Set(timing.mistakes.map(m=>m.ply)),moves=reviewMoves(game),current=state.review.position?.ply??game.moves[index].ply-(after?0:1),rows=new Map(),annotations=new Map(game.moves.map(m=>[m.ply,m]));
  for(const move of moves){const number=move.moveNumber; if(!rows.has(number))rows.set(number,{});rows.get(number)[move.color]=move;}
  const cell=(move,color)=>{if(!move)return '<span class="review-move-empty">—</span>';const own=annotations.get(move.ply),quality=reviewMoveQuality(own),label=quality?.label||own?.label,seconds=own?.thinkSeconds,timed=Number.isFinite(seconds),warning=flagged.has(move.ply),width=timed&&timing.maxSeconds?Math.min(100,seconds/timing.maxSeconds*100):0;return `<button type="button" class="timed-move ${warning?'long-think-error':''}" data-quality="${quality?.tone||''}" style="--thinking-width:${width}%" data-review-ply="${move.ply}" aria-current="${move.ply===current?'step':'false'}" aria-label="${move.moveNumber}. ${color==='w'?'White':'Black'} ${escape(move.san)}${label?`, ${label}`:''}${timed?`, ${seconds.toFixed(1)} seconds`:''}${warning?', long-think mistake':''}" ${deepJob?'disabled':''}><span>${escape(move.san)}</span>${own?`<span class="move-time">${timed?seconds.toFixed(1)+'s':'—'}</span>`:''}${label&&label!=='Sound'?`<small class="quality-label" data-tone="${quality?.tone||''}">${warning?'◆ ':''}${escape(label)}</small>`:''}</button>`;};
  return `<section class="review-moves" aria-label="Game move list"><div class="review-moves-title"><h3>Moves</h3><span>${game.color==='w'?'You played White':'You played Black'}</span></div><div class="review-moves-head"><span>#</span><span>White</span><span>Black</span></div><div class="review-move-scroll">${[...rows].map(([number,row])=>`<div class="review-move-row"><span class="review-move-number">${number}.</span>${cell(row.w,'w')}${cell(row.b,'b')}</div>`).join('')}</div><p>${timing.longest.length?`<button class="thinking-longest" data-thinking-ply="${timing.longest[0].ply}" ${deepJob?'disabled':''}>Longest think: ${timing.maxSeconds.toFixed(1)}s · ${timing.longest[0].moveNumber}. ${escape(timing.longest[0].san)} · ${escape(reviewMoveQuality(timing.longest[0])?.label||timing.longest[0].label||'Unrated')} ↗</button>`:'Time unavailable · re-import this game to load clock data.'}<span class="time-legend">Bars show thinking time. Green: best/good · Red: mistake/blunder. ◆ Long-think mistake. Quick engine estimates.</span></p></section>`;
}
function reviewThinkingPanel(game){
  const timing=gameThinkingSummary(game);
  if(!timing.longest.length)return '';
  const links=moves=>moves.map(m=>`<button class="thinking-jump" data-quality="${reviewMoveQuality(m)?.tone||''}" data-thinking-ply="${m.ply}" ${deepJob?'disabled':''}><span>${m.moveNumber}. ${escape(m.san)} <small>${escape(reviewMoveQuality(m)?.label||m.label||'Unrated')}</small></span><strong>${m.thinkSeconds.toFixed(1)}s <span aria-hidden="true">↗</span></strong></button>`).join('');
  return `<section class="review-thinking"><div><h3>Your longest thinks</h3><p>Jump to the moves you spent the most time on.</p>${links(timing.longest)}</div><div class="thinking-mistakes"><h3>Long thinks, costly moves</h3><p>15+ seconds, at least twice your typical move time, and a mistake or blunder.</p>${timing.mistakes.length?links(timing.mistakes.slice(0,3)):'<p>No moves meet this threshold in this game.</p>'}</div></section>`;
}
function renderReview(){
  if(state.review.variation){renderedReview=null;renderVariation();return;}
  const page=document.scrollingElement||document.documentElement,previousList=renderedReview===state.review?$('.review-move-scroll'):null;
  const scroll=previousList?captureReviewScroll(page,previousList):null,previouslySelected=previousList?.querySelector('[aria-current="step"]')?.dataset.reviewPly;renderedReview=state.review;
  const {game,index,after}=state.review,m=game.moves[index];
  if(!m){$('#view').innerHTML=emptyState('No player moves','This game ended before there were moves to analyze.');$('#back-overview').onclick=()=>setView('overview');return;}
  const fullMoves=reviewMoves(game),currentPly=state.review.position?.ply??m.ply-(after?0:1);
  const alternative=reviewAlternativeSource(game,currentPly);
  const idea=alternative?moveInsight(alternative.fen,[alternative.move.from+alternative.move.to+(alternative.move.promotion||'')]):null;
  const detailTitle=currentPly===m.ply?'Your move details':currentPly<m.ply?'Your next analyzed move':'Your last analyzed move';
  const fen=state.review.position?.fen||(after?m.afterFen:m.fen),board=new Chess(fen),selected=state.review.selection?.fen===fen?state.review.selection.square:null,targets=selected?board.moves({square:selected,verbose:true}).map(m=>m.to):[];
  const coaching=idea?.fen===fen?idea:null;
  $('#view').innerHTML=`<div class="section-title"><button class="text-button" id="close-review">← All games</button><span class="pill ${game.result.toLowerCase()}">${game.result} vs ${escape(game.opponent)}</span></div><div class="practice-layout review-layout"><div class="board-shell"><div class="board-meta"><strong>${game.color==='w'?'White':'Black'} · ${escape(state.username)}</strong><small>${currentPly<0?'Starting position':state.review.position?`After ${state.review.position.color==='w'?'White':'Black'}’s move ${state.review.position.moveNumber}`:after?'After your move':'Before your move'}</small></div>${evalBoard(boardMarkup(fen,game.color,!deepJob,selected,targets,state.review.position?[state.review.position.from,state.review.position.to]:after?[m.from,m.to]:[]),game.color)}${coachingMarkup(coaching,state.review)}<div class="detail-controls"><button class="secondary" id="previous" ${currentPly<0?'disabled':''}>← Previous</button><button class="secondary" id="toggle-position">${after?'Before move':'Show your move'}</button><button class="secondary" id="next" ${currentPly>=fullMoves.at(-1).ply?'disabled':''}>Next →</button></div></div><div class="practice-card review-side">${alternative?`<div class="review-alternative"><span>Selected move <strong>${alternative.move.color==='w'?'White':'Black'} · ${alternative.move.moveNumber}. ${escape(alternative.move.san)}</strong></span><button class="secondary" id="review-best-instead" ${deepJob||state.running?'disabled':''}>Show best instead</button></div>`:''}${reviewMovePanel(game,index,after)}</div><details class="review-details" id="review-details" ${state.review.detailsOpen||deepJob?'open':''}><summary><span>${detailTitle} <small>${m.moveNumber}. ${escape(m.san)} · ${escape(reviewMoveQuality(m)?.label||m.label)}</small></span><span aria-hidden="true">⌄</span></summary><div class="practice-card review-details-content"><span class="tag">MOVE ${m.moveNumber} · ${m.phase.toUpperCase()}</span><h2>${escape(m.san)} <span style="font-size:18px;color:#8c9a7e">${escape(reviewMoveQuality(m)?.label||m.label)}</span></h2><p>${m.loss>=100?`This move lost ${lossText(m)}. Compare the stronger continuation below.`:'This move kept your position relatively close to the engine’s evaluation. Look at the continuation to understand the next idea.'}</p><section class="coach-note"><span class="tag">THINKING TIME</span><p>${Number.isFinite(m.thinkSeconds)?`You spent ${m.thinkSeconds.toFixed(1)} seconds on this move${Number.isFinite(m.clockSeconds)?`, with ${Math.round(m.clockSeconds)} seconds left afterward`:""}.`:"Timing unavailable for this saved game."}</p><button class="secondary" id="deep-check">${deepJob?"Stop deeper analysis":"Analyze this moment deeper"}</button><p class="sample-note">${deepJob?"Checking this move and the alternative…":m.deepAt?`Rechecked with a longer search · depth ${m.depth}/${m.afterDepth}.`:"A bounded four-second engine search, only for this moment."}</p></section><div class="feedback"><strong>Why the suggested move helps</strong><p>${escape(explainMove(m.fen,m.pv))}</p><strong>Engine’s suggested continuation</strong><br>${escape(sanLine(m.fen,m.pv))||'No continuation available'}<br><small>Before: ${evalText(m.beforeScore)}<br>After your move: ${evalText(m.afterScore)}</small></div><p class="sample-note">Short-search estimate · depth ${m.depth}/${m.afterDepth}. Evaluation loss measures the change before and after your move; it is not Chess.com accuracy.</p><div class="source">${escape(game.opening)}<br><a href="${escape(game.url)}" target="_blank" rel="noopener">Open original game ↗</a></div></div></details>${reviewThinkingPanel(game)}</div>`;
  document.querySelectorAll('[data-thinking-ply]').forEach(button=>button.onclick=()=>{if(deepJob)return;state.review.detailsOpen=true;selectReviewPly(Number(button.dataset.thinkingPly));});
  $('#review-details').ontoggle=e=>{if(state.review)state.review.detailsOpen=e.target.open;};
  $('#view .detail-controls').insertAdjacentHTML('afterend',`<div class="board-bottom review-actions"><button class="secondary" id="review-engine" ${deepJob||state.running||board.isGameOver()?'disabled':''}>Play engine move</button><button class="secondary" id="try-variation" ${deepJob?'disabled':''}>Try your own moves</button></div>`);
  $('#review-best-instead')?.addEventListener('click',()=>{
    if(!alternative||deepJob||state.running)return;
    stopEvaluation();state.review.selection=null;
    state.review.variation={positions:[{fen:alternative.fen,san:'Before '+alternative.move.san,last:[]}],cursor:0,selected:null,arrows:[],busy:false,auto:false,message:'',replacedMove:alternative.move};
    renderReview();replyVariation();
  });
  $('#try-variation').onclick=()=>{stopEvaluation();state.review.variation={positions:[{fen,san:'Start',last:[]}],cursor:0,selected:null,arrows:[],busy:false,auto:true,message:''};renderReview();};
  $('#review-engine').onclick=()=>{stopEvaluation();state.review.variation={positions:[{fen,san:'Start',last:[]}],cursor:0,selected:null,arrows:[],busy:false,auto:true,message:''};renderReview();replyVariation();};
  const annotations=attachArrows($('#view .board'),game.color,state.review,null,state.review.showIdeas===false?[]:coaching?.arrows||[]);bindCoaching(state.review,coaching,annotations);if(!deepJob)requestEvaluation(fen,state.review.position?undefined:after?m.afterScore:m.beforeScore);
  const trySquare=square=>{
    if(deepJob)return;
    const r=state.review,piece=board.get(square);
    if(piece?.color===board.turn()){r.selection={fen,square:selected===square?null:square};renderReview();return;}
    const from=r.selection?.fen===fen?r.selection.square:null;
    if(!from)return;
    if(!board.moves({square:from,verbose:true}).some(m=>m.to===square)){r.selection=null;renderReview();return;}
    stopEvaluation();r.selection=null;r.variation={positions:[{fen,san:'Start',last:[]}],cursor:0,selected:from,arrows:[],busy:false,auto:true,message:''};renderReview();playVariation(square);
  };
  attachPieceDrag($('#view .board'),game.color,square=>!deepJob&&board.get(square)?.color===board.turn(),(from,to)=>{state.review.selection={fen,square:from};trySquare(to);},from=>board.moves({square:from,verbose:true}).map(m=>m.to));
  document.querySelectorAll('[data-square]').forEach(b=>b.onclick=()=>trySquare(b.dataset.square));
  $('#deep-check').onclick=()=>deepJob?cancelDeep(true):analyzeDeeper();
  $('#close-review').onclick=()=>{cancelVariation();cancelDeep();stopEvaluation();state.review=null;render();};
  $('#previous').onclick=()=>stepReview(-1);
  $('#next').onclick=()=>stepReview(1);
  $('#toggle-position').onclick=()=>{if(deepJob)return;state.review.position=null;state.review.after=!state.review.after;renderReview();};
  document.querySelectorAll('[data-review-ply]').forEach(button=>button.onclick=()=>{if(deepJob)return;selectReviewPly(Number(button.dataset.reviewPly));document.querySelector('[data-review-ply="'+button.dataset.reviewPly+'"]')?.focus({preventScroll:true});});
  const list=$('.review-move-scroll'),current=list?.querySelector('[aria-current="step"]');if(list)restoreReviewScroll(page,list,current,scroll,!previousList||previouslySelected!==current?.dataset.reviewPly);
}

function optionButton(id,label,on,disabled=false){
 return `<button type="button" class="option-toggle" id="${id}" aria-pressed="${!!on}" ${disabled?'disabled':''}><span>${label}</span><span class="toggle-state" aria-hidden="true">${on?'On':'Off'}</span></button>`;
}
function paintOption(button,on){
 if(!button)return;button.setAttribute('aria-pressed',String(!!on));const badge=button.querySelector('.toggle-state');if(badge)badge.textContent=on?'On':'Off';
}
function comparisonMarkup(c,model,mode){
 if(!c)return '';
 const card=(choice,label,uci)=>{const idea=moveInsight(c.fen,[uci]);return `<button type="button" class="comparison-choice" data-compare-mode="${mode}" data-compare-choice="${choice}" aria-pressed="${(model.comparisonChoice||'your')===choice}" ${model.busy?'disabled':''}><span>${label}</span><strong>${escape(sanLine(c.fen,[uci]))}</strong><span>${escape(idea?.text||'Step through the continuation to explore this move.')}</span></button>`;};
 return `<section class="move-comparison" aria-label="Compare your move with the best move"><h3>Compare the two moves</h3><p>Same starting position. Select a move to see its arrows, then step forward to see the reply.</p><div class="comparison-choices">${card('your',c.playedLabel||'Your move',c.played)}${card('best','Best move',c.best)}</div>${c.assessment?.message?`<p class="sample-note">${escape(c.assessment.message)}</p>`:''}</section>`;
}
function bindComparison(mode){
 document.querySelectorAll('[data-compare-mode="'+mode+'"]').forEach(button=>button.onclick=()=>mode==='variation'?compareVariation(button.dataset.compareChoice):comparePractice(button.dataset.compareChoice));
}
function compareVariation(choice){
 const v=state.review?.variation,c=v?.comparison||v?.correction;if(!c||v.busy||state.running)return;
 cancelVariation();stopEvaluation();v.comparison=c;v.comparisonChoice=choice;v.positions=comparisonPositions(c,choice);v.cursor=c.prefix.length;v.selected=null;v.arrows=[];v.showIdeas=true;v.message='Comparing '+(choice==='best'?'the best move.':'the played move.');renderReview();
}
function comparePractice(choice){
 const p=state.practice,c=p?.comparison||p?.correction;if(!c||p.busy||state.running)return;
 stopPlayback();stopEvaluation();p.comparison=c;p.comparisonChoice=choice;p.timeline=comparisonPositions(c,choice);p.cursor=c.prefix.length;p.lineStart=c.prefix.length-1;p.selected=null;p.arrows=[];p.showIdeas=true;p.explanation=explainMove(c.fen,choice==='best'?c.line:c.playedLine||[c.played]);p.category='Comparing '+(choice==='best'?'best move':'your move');p.feedback='Both moves start from the same position. Step forward to compare the replies.';renderPractice();
}
function completeComparisonLine(v,fen,result){
 const c=v.comparison;if(!c||v.comparisonChoice!=='your'||c.playedLine?.length!==1||!result?.pv?.length)return false;
 const move=new Chess(c.fen).move({from:c.played.slice(0,2),to:c.played.slice(2,4),promotion:c.played[4]});
 if(move.after!==fen||v.cursor!==c.prefix.length)return false;
 c.playedLine=[c.played,...result.pv];v.positions=comparisonPositions(c,'your');return true;
}
function coachingMarkup(idea,model){
 if(!idea)return '';
 return `<section class="board-coaching ${idea.tone==='risk'?'board-risk':''}" aria-label="Move explanation"><div><strong>${idea.tone==='risk'?'Watch the reply':'The idea'}</strong>${optionButton('why-arrows','Idea arrows',model.showIdeas!==false)}</div><p>${escape(idea.text)}</p></section>`;
}
function bindCoaching(model,idea,annotations){
 const toggle=$('#why-arrows');if(toggle&&idea){
  toggle.onclick=()=>{model.showIdeas=model.showIdeas===false;annotations.setIdeas(model.showIdeas?idea.arrows:[]);paintOption(toggle,model.showIdeas);};
  annotations.onIdeasCleared=()=>paintOption(toggle,false);
 }
}
function cancelVariation(){const v=state.review?.variation;if(v){clearTimeout(v.autoTimer);v.autoTimer=null;v.autoBoth=false;v.request=null;v.analysis?.cancel();cancelMoveReview(v);v.busy=false;}}
function returnToOriginalGame(){
 const r=state.review;if(!r?.variation)return;
 cancelVariation();stopEvaluation();r.variation=null;renderReview();
}
function cancelMoveReview(v){v.reviewAnalysis?.cancel();v.reviewAnalysis=null;v.attempt=null;v.correction=null;v.checkingMove=false;}
function variationCorrectionMarkup(v){
 if(v.comparison)return comparisonMarkup(v.comparison,v,'variation');
 if(v.checkingMove)return '<p class="sample-note">Checking your move…</p>';
 const c=v.correction;if(!c)return '';
 return comparisonMarkup(c,v,'variation')+`<div class="correction-actions"><button class="secondary" id="variation-best" ${v.busy||state.running?'disabled':''}>Play best move</button></div>`;
}
function paintVariationCorrection(r,v){
 if(state.review!==r||r.variation!==v)return;
 const slot=$('.variation-correction');if(!slot)return;slot.innerHTML=variationCorrectionMarkup(v);
 $('#variation-best')?.addEventListener('click',()=>applyVariationBest());bindComparison('variation');
}
async function reviewVariationMove(r,v,attempt){
 const active=()=>state.review===r&&r.variation===v&&v.attempt===attempt;
 const analysis=new VariationAnalysis({withLock:(signal,run)=>navigator.locks?navigator.locks.request('aftermove-analysis',{signal},run):run()});v.reviewAnalysis=analysis;
 try{
  const source=attempt.source||await analysis.get(attempt.fen);if(!active()||source.best===attempt.played)return;
  const bestBoard=new Chess(attempt.fen),bestMove=source.best;bestBoard.move({from:bestMove.slice(0,2),to:bestMove.slice(2,4),promotion:bestMove[4]});
  const best=await analysis.get(bestBoard.fen());if(!active())return;
  const candidate=v.analysis.peek(attempt.chosenFen)||await analysis.get(attempt.chosenFen);if(!active())return;
  const assessment=assessAlternative(best,candidate,new Chess(attempt.fen).turn());
  v.correction=createCorrection(attempt.prefix,attempt.fen,attempt.played,bestMove,[bestMove,...best.pv],assessment);
  if(v.correction)v.correction.playedLine=[attempt.played,...candidate.pv];
  evalCache.set(bestBoard.fen(),best.score);
 }catch{/* A failed comparison must not invent a mistake or change the board. */}
 finally{analysis.cancel();if(v.reviewAnalysis===analysis)v.reviewAnalysis=null;if(active()){v.checkingMove=false;paintVariationCorrection(r,v);}}
}
function applyVariationBest(){
 const r=state.review,v=r?.variation,c=v?.correction;if(!c||v.busy||state.running)return;
 cancelVariation();stopEvaluation();v.positions=replacementPositions(c).slice(0,c.prefix.length+1);v.cursor=c.prefix.length;v.selected=null;v.arrows=[];
 const board=variationBoard(v);
 v.message='Played the engine’s best move from before your attempt.';renderReview();if(v.auto&&!board.isGameOver())replyVariation({automatic:true});
}
function stepVariation(delta){const v=state.review?.variation;if(!v)return;cancelVariation();v.cursor=Math.max(0,Math.min(v.positions.length-1,v.cursor+delta));v.selected=null;v.arrows=[];v.message='';renderReview();}
function variationAnalysis(r,v){
 if(!v.analysis)v.analysis=new VariationAnalysis({
  withLock:(signal,run)=>navigator.locks?navigator.locks.request('aftermove-analysis',{signal},run):run(),
  onUpdate:({fen,result,error})=>{
   if(state.review!==r||r.variation!==v||v.positions[v.cursor].fen!==fen)return;
   if(result)evalCache.set(fen,result.score);
   if(error){v.message=error.message;v.autoBoth=false;clearTimeout(v.autoTimer);}
   paintVariationAnalysis(r,v,fen);
  }
 });
 return v.analysis;
}
function paintVariationAnalysis(r,v,fen){
 if(state.review!==r||r.variation!==v||v.positions[v.cursor].fen!==fen)return;
 const result=v.analysis.peek(fen),board=variationBoard(v),ended=board.isGameOver();
 if(completeComparisonLine(v,fen,result)){renderReview();return;}
 paintEval(result?.score??evalCache.get(fen));if(v.analysis.failure?.fen===fen)paintEvalUnavailable();
 v.suggestArrow?.(v.showSuggestion&&result?.best&&!ended?{from:result.best.slice(0,2),to:result.best.slice(2,4)}:null);
 const status=$('.variation-status');if(status)status.textContent=ended?(board.isCheckmate()?'Checkmate.':'Drawn position.'):(v.message||(result?.best?(v.showSuggestion?'Suggestion: '+sanLine(fen,[result.best]):'Next engine move ready.'):'Calculating next best move…'))+(v.autoBoth?' Autoplay is on. Press Play both sides to stop.':'');
 const both=$('#variation-both');paintOption(both,v.autoBoth);
 const auto=$('#variation-auto');if(auto)auto.disabled=!!v.autoBoth;
 const move=$('#variation-engine');if(move)move.disabled=!!(v.busy||v.autoBoth||ended||state.running);
}
function scheduleVariation(v){
 clearTimeout(v.autoTimer);v.autoTimer=null;
 if(v.autoBoth&&!v.busy&&!state.running&&!variationBoard(v).isGameOver())v.autoTimer=setTimeout(()=>{v.autoTimer=null;if(state.review?.variation===v&&v.autoBoth)replyVariation();},1000);
}
function renderVariation(){
  const r=state.review,v=r.variation,shown=v.positions[v.cursor],board=variationBoard(v),targets=v.selected?board.moves({square:v.selected,verbose:true}).map(m=>m.to):[];
  const ended=board.isGameOver(),analysis=variationAnalysis(r,v);
  if(ended){v.autoBoth=false;clearTimeout(v.autoTimer);analysis.cancel();evalCache.set(shown.fen,board.isCheckmate()?(board.turn()==='w'?-100000:100000):0);}
  if(!state.running&&!ended)analysis.get(shown.fen).catch(()=>{});
  const suggestion=analysis.peek(shown.fen),ready=!!suggestion?.best,interactive=!v.busy&&!v.autoBoth&&!ended;
  const suggestionText=ready?sanLine(shown.fen,[suggestion.best]):'';
  const coaching=playedMoveInsight(v.positions,v.cursor);
  $('#view').innerHTML=`<div class="section-title"><button class="text-button" id="return-game">← Return to original game</button><span class="pill">Your variation</span></div><div class="practice-layout"><div class="board-shell"><div class="board-meta"><strong>${board.turn()==='w'?'White':'Black'} to move</strong><small>Exploring move ${v.replacedMove?.moveNumber??r.game.moves[r.index].moveNumber}</small></div>${evalBoard(boardMarkup(shown.fen,r.game.color,interactive,v.selected,targets,shown.last),r.game.color)}${coachingMarkup(coaching,v)}<div class="line-controls"><button class="secondary" id="variation-back" aria-label="Previous variation move" ${v.cursor===0?'disabled':''}>←</button><span class="variation-navigation-title">${escape(shown.san)}<small>Step ${v.cursor} · ← / → keys</small><button class="variation-return" id="variation-return" aria-label="Back to original game">Back to original game</button></span><button class="secondary" id="variation-forward" aria-label="Next variation move" ${v.cursor===v.positions.length-1?'disabled':''}>→</button></div><div class="move-chips" aria-label="Your variation moves">${v.positions.map((p,i)=>`<button class="move-chip ${i===v.cursor?'current':''}" data-variation-ply="${i}">${escape(p.san)}</button>`).join('')}</div></div><section class="practice-card"><span class="tag">TRY YOUR IDEA</span><h2>${v.replacedMove?'The best move instead':'What if you played differently?'}</h2>${v.replacedMove?`<p class="replacement-context">Alternative to ${v.replacedMove.color==='w'?'White':'Black'}’s ${v.replacedMove.moveNumber}. ${escape(v.replacedMove.san)}. Your original game is unchanged.${(v.comparison?.best??v.positions[1]?.uci)===v.replacedMove.from+v.replacedMove.to+(v.replacedMove.promotion||'')?' This was already the engine’s preferred move.':''}</p>`:''}<p>Drag a piece or click its destination. You can play either side. Going back and playing a new move starts a new line from there.</p><div class="variation-correction">${variationCorrectionMarkup(v)}</div><div class="variation-options">${optionButton('variation-suggestion','Show engine suggestion',v.showSuggestion)}${optionButton('variation-auto','Automatic engine replies',v.auto,v.autoBoth)}${optionButton('variation-both','Play both sides',v.autoBoth,ended||state.running)}</div><div class="practice-actions"><button class="secondary" id="variation-engine" ${v.busy||v.autoBoth||ended||state.running?'disabled':''}>${v.busy?'Engine thinking…':'Play engine move'}</button><button class="text-button" id="variation-reset">Reset variation</button></div><p class="variation-status" role="status">${ended?(board.isCheckmate()?'Checkmate.':'Drawn position.'):escape(v.message||(ready?(v.showSuggestion?'Suggestion: '+suggestionText:'Next engine move ready.'):'Calculating next best move…'))}${v.autoBoth&&!ended?' Autoplay is on. Press Play both sides to stop.':''}</p><p class="sample-note">The evaluation bar follows your variation. Navigation pauses autoplay. Return to the original game whenever you’re ready.</p></section></div>`;
  const annotations=attachArrows($('#view .board'),r.game.color,v,v.showSuggestion&&ready&&!ended?{from:suggestion.best.slice(0,2),to:suggestion.best.slice(2,4)}:null,v.showIdeas===false?[]:coaching?.arrows||[]);v.suggestArrow=annotations.setSuggestion;bindCoaching(v,coaching,annotations);
  paintEval(suggestion?.score??evalCache.get(shown.fen));if(analysis.failure?.fen===shown.fen)paintEvalUnavailable();
  attachPieceDrag($('#view .board'),r.game.color,square=>interactive&&board.get(square)?.color===board.turn(),(from,to)=>{v.selected=from;playVariation(to);},from=>board.moves({square:from,verbose:true}).map(m=>m.to));
  document.querySelectorAll('[data-square]').forEach(b=>b.onclick=()=>playVariation(b.dataset.square));
  $('#return-game').onclick=returnToOriginalGame;
  $('#variation-return').onclick=returnToOriginalGame;
  $('#variation-reset').onclick=()=>{cancelVariation();stopEvaluation();v.positions=v.positions.slice(0,1);v.comparison=null;v.comparisonChoice=null;v.cursor=0;v.selected=null;v.arrows=[];v.message='';renderReview();};
  $('#variation-auto').onclick=()=>{v.auto=!v.auto;paintOption($('#variation-auto'),v.auto);};
  $('#variation-suggestion').onclick=()=>{v.showSuggestion=!v.showSuggestion;renderReview();};
  $('#variation-both').onclick=()=>{if(!v.autoBoth){cancelMoveReview(v);v.autoBoth=true;v.selected=null;}else cancelVariation();v.message='';renderReview();};
  $('#variation-engine').onclick=()=>replyVariation();
  $('#variation-back').onclick=()=>stepVariation(-1);$('#variation-forward').onclick=()=>stepVariation(1);
  document.querySelectorAll('[data-variation-ply]').forEach(b=>b.onclick=()=>{cancelVariation();v.cursor=Number(b.dataset.variationPly);v.selected=null;v.arrows=[];v.message='';renderReview();});
  paintVariationCorrection(r,v);
  scheduleVariation(v);
}
function appendVariation(v,board,move){v.analysis?.cancel();v.positions=v.positions.slice(0,v.cursor+1);v.positions.push({fen:board.fen(),san:move.san,uci:move.from+move.to+(move.promotion||''),last:[move.from,move.to]});v.cursor++;v.selected=null;v.arrows=[];}
async function playVariation(square){
  const r=state.review,v=r?.variation;if(!v||v.busy||v.autoBoth)return;
  const board=variationBoard(v),fen=board.fen(),piece=board.get(square);if(board.isGameOver())return;
  if(piece?.color===board.turn()){v.selected=v.selected===square?null:square;renderReview();return;}
  if(!v.selected)return;
  const options=board.moves({square:v.selected,verbose:true}).filter(m=>m.to===square);if(!options.length){v.selected=null;renderReview();return;}
  const request={};v.request=request;v.busy=true;const promote=options[0].promotion?await promotion():undefined;
  if(state.review!==r||r.variation!==v||v.request!==request||v.positions[v.cursor].fen!==fen)return;
  v.busy=false;v.request=null;if(promote===null)return;
  const move=board.move({from:v.selected,to:square,promotion:promote});
  const attempt={fen,played:move.from+move.to+(move.promotion||''),prefix:v.positions.slice(0,v.cursor+1),source:v.analysis?.peek(fen),chosenFen:board.fen()};
  cancelMoveReview(v);v.comparison=null;v.comparisonChoice=null;v.attempt=attempt;v.checkingMove=true;stopEvaluation();appendVariation(v,board,move);v.message='';renderReview();reviewVariationMove(r,v,attempt);if(v.auto&&!board.isGameOver())await replyVariation({automatic:true});
}
async function replyVariation({automatic=false}={}){
  const r=state.review,v=r?.variation;if(!v||v.busy||state.running)return;
  const board=variationBoard(v),fen=board.fen();if(board.isGameOver())return;
  if(!automatic)cancelMoveReview(v);
  stopEvaluation();clearTimeout(v.autoTimer);v.autoTimer=null;const request={};v.request=request;v.busy=true;v.message='';
  const pending=variationAnalysis(r,v).get(fen,{retry:true});renderReview();
  try{
    const result=await pending;
    if(state.review!==r||r.variation!==v||v.request!==request||v.positions[v.cursor].fen!==fen)return;
    const uci=result.best;if(uci){
      if(v.replacedMove&&v.cursor===0){const original=v.replacedMove.from+v.replacedMove.to+(v.replacedMove.promotion||'');if(original!==uci){v.comparison={prefix:v.positions.slice(0,1),fen,played:original,playedLabel:v.replacedMove.color===r.game.color?'Your move':'Opponent’s move',best:uci,line:result.pv?.[0]===uci?result.pv:[uci],playedLine:[original]};v.comparisonChoice='best';}}
      const move=board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});appendVariation(v,board,move);if(v.replacedMove&&v.comparisonChoice==='best'&&v.cursor===v.comparison?.prefix.length)v.positions=comparisonPositions(v.comparison,'best');}else{v.message='No engine move available. You can still explore manually.';v.autoBoth=false;}
  }catch(error){if(v.request===request&&error.name!=='AbortError'){v.message=error.message;v.autoBoth=false;}}
  finally{if(v.request===request){v.request=null;v.busy=false;if(state.review===r&&r.variation===v)renderReview();}}
}

function renderPractice(){
  if(practiceMode==='fresh'&&freshSession?.username!==state.username)freshSession={username:state.username,list:freshExercises(allSavedGames(),puzzleHistory(),reviewSeen)};
  const list=exercises();
  if(!list.length&&practiceMode==='fresh'){$('#view').innerHTML=practiceHeader()+`<section class="coach-note"><h2>${reviewSeen?'No seen puzzles to review':'You’ve seen all available puzzles'}</h2><p>${reviewSeen?'Switch to unseen puzzles to find a new position.':'There are no more unseen positions outside your imported games in this library. Revisit earlier puzzles when you want to practice them again.'}</p><button class="secondary" id="review-puzzles">${reviewSeen?'Find unseen puzzles':'Review seen puzzles'}</button></section>`;bindPracticeModes();$('#review-puzzles').onclick=()=>{reviewSeen=!reviewSeen;freshSession=null;state.exerciseIndex=0;state.practice=null;renderPractice();};return;}
  if(!list.length){$('#view').innerHTML=practiceHeader()+emptyState(state.games.length?'No clear practice positions yet':'Train on your own turning points',state.games.length?'This batch has no sufficiently analyzed mistakes to turn into exercises. You can explore your games or import a newer batch.':'Analyze your games first. We’ll pick moments where a better move could have made a difference.');$('#back-overview').onclick=()=>setView('overview');bindPracticeModes();return;}
  state.exerciseIndex%=list.length;
  const ex=list[state.exerciseIndex];
  const starting=!state.practice||state.practice.id!==ex.id;
  if(starting)state.practice={id:ex.id,board:new Chess(ex.fen),selected:null,feedback:'',solved:false,revealed:false,busy:false,arrows:[],timeline:null,cursor:0,explanation:'',playing:false,category:'',demonstrate:false};
  if(starting&&ex.fresh){try{if(!markPuzzleSeen(localStorage,state.username||'@guest',ex.id))notice('Puzzle history could not be saved; unseen ordering may reset.',true);}catch{notice('Puzzle history could not be saved; unseen ordering may reset.',true);}}
  const p=state.practice;
  const shown=p.timeline?.[p.cursor]||{fen:p.board.fen(),last:p.last||[]};
  const {board,playable}=practicePosition(p,ex.color);
  const coaching=playedMoveInsight(p.timeline,p.cursor);
  const targets=p.selected&&playable?board.moves({square:p.selected,verbose:true}).map(m=>m.to):[];
  $('#view').innerHTML=practiceHeader()+`<div class="practice-layout"><div class="board-shell"><div class="board-meta"><strong>${new Chess(shown.fen).turn()==='w'?'White':'Black'} to move</strong><small>Position ${state.exerciseIndex+1} of ${list.length}${ex.fresh?` · Puzzle rating ${ex.rating}`:''}</small></div>${evalBoard(boardMarkup(shown.fen,ex.color,playable,p.selected,targets,shown.last),ex.color)}${coachingMarkup(coaching,p)}<div class="board-bottom"><span>Right-click + drag to draw arrows.</span><button class="text-button" id="clear-arrows">Clear arrows</button></div><div class="line-controls"><button class="secondary" id="line-back" aria-label="Previous move" ${!p.timeline||p.cursor===0||p.busy?'disabled':''}>←</button><span>${p.timeline?(p.cursor===0?'Starting position':p.timeline[p.cursor].san):'Try a move to explore its line'}<small>${p.timeline?`Step ${p.cursor} of ${p.timeline.length-1} · ← / → keys`:'Drag a piece, or click then click'}</small></span><button class="secondary" id="line-forward" aria-label="Next move" ${!p.timeline||p.cursor===p.timeline.length-1||p.busy?'disabled':''}>→</button></div>${p.revealed&&p.timeline?`<div class="move-chips" aria-label="Continuation moves">${p.timeline.map((position,i)=>`<button class="move-chip ${i===p.cursor?'current':''}" data-ply="${i}" aria-current="${i===p.cursor?'step':'false'}" ${p.busy?'disabled':''}>${i===0?'Start':escape(position.san)}</button>`).join('')}</div>`:''}</div><section class="practice-card"><span class="tag">${ex.fresh?'FRESH POSITION · '+THEMES[ex.theme].toUpperCase():'YOUR GAME. ANOTHER CHANCE.'}</span><h2>${ex.kind}</h2><p class="instructions">Look for checks, captures, and threats. Sketch your ideas, then drag a piece to play your move. Keep playing your side after each engine reply.</p>${p.feedback?`<div class="feedback ${['Mistake','Missed opportunity','Unclear'].includes(p.category)?'wrong':''}" role="status">${p.category?`<strong>${escape(p.category)}</strong><br>`:''}${escape(p.feedback)}${p.correction?`<div class="correction-actions"><button class="secondary" id="practice-best" ${p.busy||state.running?'disabled':''}>Play best move</button></div>`:''}</div>`:''}${p.explanation?`<section class="coach-note"><span class="tag">${p.category==='Mistake'?'WHAT YOUR MOVE ALLOWS':'WHY THIS MOVE MATTERS'}</span><p>${escape(p.explanation)}</p></section>`:''}${p.solved&&!ex.fresh?`<div class="feedback"><strong>Compare with your game</strong><br><small>Earlier analysis flagged ${escape(ex.san)}. This fresh search checks your chosen move independently; a short search can change its assessment. Use the arrows below the board to compare the continuation.</small></div>`:''}${comparisonMarkup(p.comparison||p.correction,p,'practice')}<div class="practice-actions">${p.revealed&&p.timeline&&p.timeline.length>1?`<button class="secondary" id="play-line" ${p.busy?'disabled':''}>${p.playing?'Pause demonstration':'▶ Replay continuation'}</button>`:''}<button class="secondary" id="hint" ${p.solved||p.busy?'disabled':''}>Give me a hint</button><button class="text-button" id="reveal" ${p.revealed||p.busy?'disabled':''}>Show solution</button><button class="primary" id="next-exercise" ${p.busy?'disabled':''}>Next position →</button>${practiceHasStarted(p)?`<button class="text-button" id="retry" ${p.busy?'disabled':''}>Try again from start</button>`:''}</div><p class="sample-note">Explanations follow legal moves in the engine’s line. Short searches may miss deeper ideas.</p><div class="source">${ex.fresh?`<a href="${escape(ex.source)}" target="_blank" rel="noopener noreferrer">Lichess puzzle</a> · ${THEMES[ex.theme]}<br>CC0 puzzle database · checked with Stockfish 19 Lite.`:`From your game against ${escape(ex.game.opponent)} · ${escape(ex.game.timeClass)}<br>${escape(ex.game.opening)}`}</div></section></div>`;
  bindPracticeModes();
  if(!p.busy)requestEvaluation(shown.fen,shown.fen===ex.fen?ex.beforeScore:undefined);
  bindComparison('practice');
  const clear=attachArrows($('#view .board'),ex.color,p,null,p.showIdeas===false?[]:coaching?.arrows||[]);bindCoaching(p,coaching,clear);$('#clear-arrows').onclick=clear;
  attachPieceDrag($('#view .board'),ex.color,square=>playable&&!state.running&&board.get(square)?.color===ex.color,(from,to)=>{p.selected=from;clickSquare(to,ex);},from=>board.moves({square:from,verbose:true}).map(m=>m.to));
  $('#practice-best')?.addEventListener('click',()=>applyPracticeBest());
  $('#play-line')?.addEventListener('click',()=>{if(p.playing){stopPlayback();renderPractice();}else startPlayback(p);});
  document.querySelectorAll('[data-square]').forEach(b=>b.onclick=e=>{if(e.button===0)clickSquare(b.dataset.square,ex);});
  $('#line-back').onclick=()=>stepPractice(-1);$('#line-forward').onclick=()=>stepPractice(1);
  document.querySelectorAll('[data-ply]').forEach(b=>b.onclick=()=>{stopPlayback();p.cursor=Number(b.dataset.ply);p.selected=null;renderPractice();});
  $('#hint').onclick=()=>{stopPlayback();p.correction=null;p.comparison=null;p.comparisonChoice=null;p.cursor=0;p.feedback=`Look for a move with your ${names[new Chess(ex.fen).get(ex.best.slice(0,2))?.type]||'piece'} on ${ex.best.slice(0,2)}. Check what it can attack or defend.`;renderPractice();document.querySelector(`[data-square="${ex.best.slice(0,2)}"]`)?.classList.add('hint');};
  $('#reveal').onclick=()=>{stopPlayback();p.correction=null;p.comparison=null;p.comparisonChoice=null;p.category='Suggested move';p.solved=true;p.revealed=true;p.timeline=null;p.cursor=0;showPracticeLine(p,ex.fen,ex.pv);p.feedback='Here is the engine’s preferred move. Step through the reply to see the idea.';renderPractice();};
  $('#next-exercise').onclick=()=>{stopPlayback();stopEvaluation();state.exerciseIndex=(state.exerciseIndex+1)%list.length;if(practiceMode==='fresh'&&state.exerciseIndex===0)freshSession=null;state.practice=null;renderPractice();};
  $('#retry')?.addEventListener('click',()=>{stopPlayback();stopEvaluation();state.practice=null;renderPractice();});
}
let playbackTimer=null;
function stopPlayback(){clearTimeout(playbackTimer);playbackTimer=null;if(state.practice)state.practice.playing=false;}
function startPlayback(p,maxPly=Infinity){
  stopPlayback();if(!p.timeline||p.timeline.length<2||state.practice!==p)return;
  const end=Math.min(p.timeline.length-1,(p.lineStart||0)+maxPly);
  p.cursor=Math.min((p.lineStart||0)+1,end);p.playing=p.cursor<end;p.selected=null;renderPractice();
  if(!p.playing)return;
  const advance=()=>{
    if(state.practice!==p||state.view!=='practice'||!p.playing)return;
    if(p.cursor>=Math.min(p.timeline.length-1,(p.lineStart||0)+maxPly)){p.playing=false;renderPractice();return;}
    p.cursor++;p.playing=p.cursor<end;renderPractice();
    playbackTimer=p.playing?setTimeout(advance,1400):null;
  };
  playbackTimer=setTimeout(advance,1400);
}
function showPracticeLine(p,fen,line,cursor=p.cursor){extendPracticeLine(p,fen,line,cursor);p.explanation=explainMove(fen,line);p.selected=null;}
function applyPracticeBest(){
 const p=state.practice,c=p?.correction;if(state.view!=='practice'||!c||p.busy||state.running)return;
 stopPlayback();stopEvaluation();p.timeline=replacementPositions(c);p.lineStart=c.prefix.length-1;p.cursor=p.lineStart+1;p.selected=null;p.arrows=[];p.correction=null;p.comparison=null;p.comparisonChoice=null;
 p.category='Best move';p.feedback='Played the engine’s best move from before your attempt. Watch the reply to see the difference.';p.solved=true;
 p.explanation=explainMove(c.fen,c.line);startPlayback(p,2);
}
function stepPractice(delta){stopPlayback();const p=state.practice;if(!p?.timeline||p.busy)return;p.cursor=Math.max(0,Math.min(p.timeline.length-1,p.cursor+delta));p.selected=null;renderPractice();}
function selectReviewPly(ply){const r=state.review;if(!r||deepJob)return;stopEvaluation();r.selection=null;r.arrows=[];if(ply<0){r.index=0;r.after=false;r.position={ply:-1,fen:reviewMoves(r.game)[0].fen};}else Object.assign(r,reviewSelection(r.game,ply));renderReview();}
function stepReview(delta){if(deepJob)return;const r=state.review;if(!r)return;if(r.variation){stepVariation(delta);return;}const moves=reviewMoves(r.game),current=r.position?.ply??r.game.moves[r.index].ply-(r.after?0:1);const target=delta>0?moves.find(m=>m.ply>current):moves.findLast(m=>m.ply<current);selectReviewPly(target?.ply??(delta<0?-1:current));}

document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;
  const delta=e.key==='ArrowLeft'?-1:1;
  if(state.view==='practice'&&state.practice?.timeline){e.preventDefault();stepPractice(delta);}
  else if(state.view==='games'&&state.review){e.preventDefault();stepReview(delta);}
});

async function promotion(){return new Promise(resolve=>{const dialog=document.createElement('dialog');dialog.innerHTML='<h2>Promote your pawn</h2><div class="promotion-options">'+['q','r','b','n'].map(p=>`<button data-piece="${p}" aria-label="Promote to ${names[p]}">${symbols['w'+p]}</button>`).join('')+'</div>';document.body.append(dialog);dialog.oncancel=e=>{e.preventDefault();dialog.close();dialog.remove();resolve(null);};dialog.querySelectorAll('button').forEach(b=>b.onclick=()=>{dialog.close();dialog.remove();resolve(b.dataset.piece);});dialog.showModal();});}
async function clickSquare(square,ex){
  const p=state.practice;const {board,playable}=practicePosition(p,ex.color);if(!playable)return;if(state.running){p.feedback='Stop batch analysis before practicing moves.';renderPractice();return;}
  const piece=board.get(square);
  if(piece?.color===ex.color){p.selected=p.selected===square?null:square;renderPractice();return;}
  if(!p.selected)return;
  const from=p.selected,options=board.moves({square:from,verbose:true}).filter(m=>m.to===square);
  if(!options.length){p.selected=null;renderPractice();return;}
  const promote=options[0].promotion?await promotion():undefined;if(promote===null)return;
  if(state.practice!==p||state.view!=='practice')return;
  const fen=board.fen();
  stopPlayback();p.correction=null;p.comparison=null;p.comparisonChoice=null;p.explanation='';p.category='';p.demonstrate=false;
  const move=board.move({from,to:square,promotion:promote});p.attempted=true;
  const uci=from+square+(move.promotion||'');p.selected=null;
  const solution=solutionContinuation(ex,fen);
  if(uci===solution[0]){p.category='Good move';p.solved=true;p.last=[from,square];p.feedback='Good find. That matches the solution in this position.';showPracticeLine(p,fen,solution);startPlayback(p,2);return;}
  const startCursor=p.cursor,previousTimeline=p.timeline,previousLineStart=p.lineStart;
  const restorePosition=()=>{p.timeline=previousTimeline;p.cursor=startCursor;p.lineStart=previousLineStart;};
  extendPracticeLine(p,fen,[uci]);
  stopEvaluation();p.busy=true;p.feedback='Checking your move…';renderPractice();
  const engine=new Engine();p.engine=engine;p.cancelled=false;
  const check=async()=>{
  if(p.cancelled||state.practice!==p||state.view!=='practice')return;
  let checked=false;
  try{
    // Re-evaluate both candidates with the same budget, rather than comparing against a stale score.
    const suggested=fen===ex.fen?ex.best:requireEvaluation(await engine.evaluate(fen,600)).best;
    const bestBoard=new Chess(fen);bestBoard.move({from:suggested.slice(0,2),to:suggested.slice(2,4),promotion:suggested[4]});
    const candidate=requireEvaluation(await engine.evaluate(board.fen(),600));
    const best=uci===suggested?candidate:requireEvaluation(await engine.evaluate(bestBoard.fen(),600));
    const assessment=uci===suggested?{category:'Good move',accepted:true,demonstrate:false,message:'Good find. That’s the engine’s preferred move in this position.'}:assessAlternative(best,candidate,ex.color);
    showPracticeLine(p,fen,[uci,...candidate.pv],startCursor);
    p.explanation+=" "+continuationConsequence(fen,[uci,...candidate.pv],ex.color);
    p.category=assessment.category;p.feedback=assessment.message;p.demonstrate=assessment.demonstrate;checked=true;
    p.correction=createCorrection(previousTimeline?previousTimeline.slice(0,startCursor+1):linePositions(fen,[]),fen,uci,suggested,[suggested,...best.pv],assessment);
    if(p.correction)p.correction.playedLine=[uci,...candidate.pv];
    evalCache.set(bestBoard.fen(),best.score);
    if(assessment.accepted){p.solved=true;p.last=[from,square];}
    

  }catch{restorePosition();p.feedback='The engine could not check this move. Returned to your turn so you can try again.';}
  finally{engine.stop();if(p.engine===engine)p.engine=null;p.busy=false;if(state.view==='practice'&&state.practice===p){renderPractice();if(checked)startPlayback(p,2);}}
  };
  if(navigator.locks){await navigator.locks.request('aftermove-analysis',{ifAvailable:true},async lock=>{if(!lock){engine.stop();if(p.engine===engine)p.engine=null;restorePosition();p.busy=false;p.feedback='Another tab is analyzing. Stop that analysis before checking this move.';if(state.view==='practice'&&state.practice===p)renderPractice();return;}await check();});}else await check();
}

async function initialize(){
  try{db=await openDb();const username=await dbGet('last-user');if(username){const saved=await dbGet(username.toLowerCase());if(saved?.version===ANALYSIS_VERSION){state.username=username;state.games=saved.games||[];state.cache=new Map((saved.cache||saved.games||[]).map(g=>[g.id,g]));$('#username').value=username;}}}
  catch{notice('Browser storage is unavailable. Analysis will work, but results will not survive closing this tab.',true);}
  render();
}
initialize();
