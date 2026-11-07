import test from 'node:test';
import assert from 'node:assert/strict';
import {persistWorkspace} from '../public/storage.js';
test('workspace save reports failure when storage is unavailable',async()=>{
 const cache=new Map();assert.equal(await persistWorkspace(null,'Luke',[{id:'one'}],cache,'v1'),false);assert.ok(cache.has('one'));
});
test('workspace save reports quota or aborted transaction failure',async()=>{
 assert.equal(await persistWorkspace(async()=>{throw new DOMException('Quota exceeded','QuotaExceededError');},'Luke',[{id:'one'}],new Map(),'v1'),false);
});
test('saving a smaller batch retains cached games and normalized account identity',async()=>{
 const cache=new Map([['old',{id:'old'}]]);let stored;
 assert.equal(await persistWorkspace(async(...args)=>{stored=args;},'LuKe',[{id:'new'}],cache,'v1'),true);
 assert.equal(stored[0],'luke');assert.equal(stored[2],'LuKe');assert.deepEqual(stored[1].cache.map(g=>g.id),['old','new']);assert.equal(stored[1].games.length,1);
});
test('account snapshots use their captured identity while a write is pending',async()=>{
 let complete;let identity;const save=persistWorkspace((key,value,username)=>{identity=[key,username];return new Promise(resolve=>{complete=resolve;});},'First',[{id:'one'}],new Map(),'v1');
 await persistWorkspace(async()=>{},'Second',[{id:'two'}],new Map(),'v1');complete();assert.equal(await save,true);assert.deepEqual(identity,['first','First']);
});
