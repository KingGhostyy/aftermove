import test from 'node:test';
import assert from 'node:assert/strict';
import {gameChoices,selectedGames} from '../public/game-picker.js';
const raw=(id,white='Luke',black='Opponent')=>({url:id,end_time:123,time_class:'rapid',white:{username:white,result:'win'},black:{username:black,result:'resigned'}});
test('picker identifies opponents and saved games for either player color',()=>{
 const choices=gameChoices([raw('one'),raw('two','Other','LUKE')],'luke',new Set(['one']));
 assert.equal(choices[0].opponent,'Opponent');assert.equal(choices[0].saved,true);assert.equal(choices[0].result,'Win');
 assert.equal(choices[1].opponent,'Other');assert.equal(choices[1].color,'b');assert.equal(choices[1].result,'Loss');
});
test('analysis uses exact selected game identities, not whichever is newest',()=>{
 const older=raw('older'),choices=gameChoices([raw('newest'),older,raw('saved')],'Luke',new Set(['saved']));
 assert.deepEqual(selectedGames(choices,new Set(['older','saved','unknown'])),[older]);
 assert.deepEqual(selectedGames(choices,new Set()),[]);
});
