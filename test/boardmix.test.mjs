import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {closure,MANIFEST} from '../src/core.mjs';
import {componentEnvironment,doctor} from '../src/runtime.mjs';
test('visual collection installs both canvas backends and exposes Boardmix independently',()=>{
 assert.deepEqual(new Set(closure({node:'competitor-visual-canvas'}).map(n=>n.skill)),new Set(['tbcli','sealseek-media','boardmixcli','competitor-visual-canvas']));
 assert.deepEqual(closure({node:'boardmix-tools'}).map(n=>n.skill),['boardmixcli']);
 assert.ok(closure().some(n=>n.skill==='boardmixcli'));
 assert.equal(MANIFEST.components.boardmixcli.package,'@petercjl/boardmixcli');
});
test('shell dispatch selects registered tool entries and verifies Boardmix JSON identity',async()=>{
 const previous=process.env.TAOBAO_AI_OPS_STATE_DIR;
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ops-boardmix-'));
 try{
  process.env.TAOBAO_AI_OPS_STATE_DIR=root;
  const skill=path.join(root,'skill');await fs.mkdir(skill);await fs.writeFile(path.join(skill,'SKILL.md'),'fixture');
  const entry=path.join(root,'cli.mjs');await fs.writeFile(entry,'console.log(JSON.stringify({package:"@petercjl/boardmixcli",version:"0.1.6"}));');
  await fs.writeFile(path.join(root,'capabilities.json'),'{}');
  const components={boardmixcli:{root,entry,version:'0.1.6',sources:{boardmixcli:skill}},tbcli:{entry:'registered-tbcli'},'sealseek-media':{entry:'registered-media'}};
  await fs.writeFile(path.join(root,'components.json'),JSON.stringify({components}));
  const env=componentEnvironment('competitor-visual-canvas',{BOARDMIXCLI_ENTRY:'wrong-global'});
  assert.equal(env.BOARDMIXCLI_ENTRY,entry);assert.equal(env.TBCLI_ENTRY,'registered-tbcli');assert.equal(env.SEALSEEK_MEDIA_ENTRY,'registered-media');
  assert.equal(env.BOARDMIXCLI_UPDATE_CHECK,'0');
  assert.equal(componentEnvironment('other',{}).BOARDMIXCLI_ENTRY,undefined);
  assert.equal((await doctor('boardmix-tools')).ok,true);
  await fs.writeFile(entry,'console.log(JSON.stringify({version:"0.1.0"}));');
  assert.equal((await doctor('boardmix-tools')).ok,false);
 }finally{if(previous===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=previous;await fs.rm(root,{recursive:true,force:true});}
});
