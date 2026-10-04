import test from 'node:test';
import assert from 'node:assert/strict';
import {checkUpdate,installUpdate} from '../src/update.mjs';
test('development checkout cannot be upgraded through npm',async()=>{
 await assert.rejects(installUpdate({yes:true,agent:'codex'}),e=>e.code==='SOURCE_CHECKOUT');
});
test('offline registry preserves the installed version without mutations',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline');};try{const r=await checkUpdate('next');assert.equal(r.ok,false);assert.equal(r.updateAvailable,false);assert.equal(r.offline,'keep-current');}finally{globalThis.fetch=original;}
});
