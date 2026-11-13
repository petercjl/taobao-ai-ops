import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {MANIFEST,ROOT,PACKAGE,closure,componentRecords,componentRecord} from '../src/core.mjs';
import {collectionCheck} from '../src/subscription.mjs';
import {doctor,assertDependencies} from '../src/runtime.mjs';
const retired='@petercjl/sealseek-media-cli';
test('collection update drops a historical media member without querying its registry',async()=>{
 const visited=[];const registry=async url=>{visited.push(decodeURIComponent(url));return {ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:'1.0.0'})};};
 const current=await collectionCheck(undefined,registry);
 const previous={...current,members:[...current.members,{id:'sealseek-media',package:retired,version:'0.6.1',skills:['sealseek-media']}]};
 const next=await collectionCheck(previous,registry);assert.equal(next.changed,true);assert(!next.members.some(m=>m.package===retired));assert(visited.every(url=>!url.includes(retired)));
 assert.equal(next.members.length,Object.keys(MANIFEST.components).length);
});
test('dependent application Skills stay installable while media business calls stop before child execution',async()=>{
 for(const name of ['competitor-visual-canvas','cloud-hug-style-transfer','product-scene-replacement','product-seeding-studio']){
  assert(closure({name}).some(n=>n.skill===name));assert(!closure({name}).some(n=>n.skill==='sealseek-media'));
  const result=await doctor(name);assert.equal(result.ok,false);assert.equal(result.checks[0].code,'DEPENDENCY_RETIRED');assert.equal(result.checks[0].package,retired);
  assert.throws(()=>assertDependencies(name),e=>e.code==='DEPENDENCY_RETIRED');
 }
 assert.doesNotThrow(()=>assertDependencies('boardmixcli'));assert.doesNotThrow(()=>assertDependencies('tbcli'));
 const result=spawnSync(process.execPath,[path.join(ROOT,'bin/taobao-ai-ops.mjs'),'component','run','cloud-hug-style-transfer','run'],{encoding:'utf8'});
 assert.equal(result.status,1);assert.equal(JSON.parse(result.stderr).code,'DEPENDENCY_RETIRED');
});
test('old local component receipts cannot restore the retired CLI',async t=>{
 const previous=process.env.TAOBAO_AI_OPS_STATE_DIR,root=await fs.mkdtemp(path.join(os.tmpdir(),'retired-media-state-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 try{
  process.env.TAOBAO_AI_OPS_STATE_DIR=root;await fs.writeFile(path.join(root,'components.json'),JSON.stringify({components:{'sealseek-media':{package:retired,version:'0.6.1',entry:'retired-entry'}}}),{flag:'wx'});
  assert.equal(componentRecords()['sealseek-media'],undefined);assert.throws(()=>componentRecord('sealseek-media'),e=>e.code==='COMPONENT_RETIRED');
  const result=spawnSync(process.execPath,[path.join(ROOT,'bin/taobao-ai-ops.mjs'),'component','run','sealseek-media','version'],{encoding:'utf8',env:process.env});
  assert.equal(result.status,1);assert.equal(JSON.parse(result.stderr).code,'COMPONENT_RETIRED');
 }finally{if(previous===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=previous;}
});
