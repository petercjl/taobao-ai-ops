import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {MANIFEST,ROOT,closure,componentRecords,nodeFor} from '../src/core.mjs';
import {inspectComponent} from '../src/components.mjs';
import {install,status} from '../src/skill-manager.mjs';
import {doctor,componentEnvironment} from '../src/runtime.mjs';
const name='aigc-generation-review';
test('AIGC review remains independently owned with source, doctor and suite environment',async()=>{
 assert.deepEqual(closure({name}).map(n=>n.skill),[name]);assert.ok(nodeFor('operations').requires_skills.includes(name));
 assert.equal(MANIFEST.components[name].package,'@petercjl/aigc-generation-review');assert.equal(MANIFEST.components[name].skill_installation,'component-managed');
 await assert.rejects(fs.stat(path.join(ROOT,'skills',name)));
 const record=componentRecords()[name];assert.ok(record);assert.ok((await inspectComponent(name,record.root)).sources[name]);
 assert.equal((await doctor(name)).ok,true);assert.equal(componentEnvironment(name,{}).AIGC_REVIEW_UPDATE_CHECK,'0');
});
test('AIGC review suite-managed physical install, report, no-op, edit guard and isolation',async()=>{
 const previous=process.env.TAOBAO_AI_OPS_STATE_DIR,record=componentRecords()[name];
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'suite-aigc-'))),clone=path.join(root,'component');
 const invoke=(entry,args)=>{const r=spawnSync(process.execPath,[entry,...args],{encoding:'utf8',env:{...process.env,AIGC_REVIEW_UPDATE_CHECK:'0'}});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 try{
  await fs.cp(record.root,clone,{recursive:true});const owned=await inspectComponent(name,clone);
  process.env.TAOBAO_AI_OPS_STATE_DIR=path.join(root,'state');await fs.mkdir(process.env.TAOBAO_AI_OPS_STATE_DIR);await fs.writeFile(path.join(process.env.TAOBAO_AI_OPS_STATE_DIR,'components.json'),JSON.stringify({components:{[name]:owned}}));
  const a=path.join(root,'a'),b=path.join(root,'b');await install({name,targetDir:a});await install({name,targetDir:b});
  assert.equal((await status(b,nodeFor(name))).state,'current');assert.equal((await install({name,targetDir:b})).skills[0].action,'unchanged');
  const entry=path.join(b,name,'.runtime/cli.mjs');await fs.rm(clone,{recursive:true});await fs.rm(a,{recursive:true});
  assert.equal(invoke(entry,['doctor','--json']).version,record.version);
  await fs.writeFile(path.join(root,'pixel.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvl0AAAAASUVORK5CYII=','base64'));
  const input=path.join(root,'input.json');await fs.writeFile(input,JSON.stringify({schemaVersion:1,title:'生成审核',items:[{id:'one',title:'产品',references:[{kind:'image',path:'pixel.png',label:'参考图'}],result:{kind:'image',path:'pixel.png',label:'生成图'},prompt:'完整提示词',parameters:{model:null,requestedAspectRatio:'1:1',requestedResolution:null}}]}));
  const out=path.join(root,'report.html');assert.equal(invoke(entry,['render','--input',input,'--output',out,'--json']).ok,true);const html=await fs.readFile(out,'utf8');assert.ok(html.includes('完整提示词'));assert.ok(html.includes('data-compare-select'));assert.ok(html.includes('compare-viewer'));
  await fs.cp(record.root,clone,{recursive:true});await fs.appendFile(path.join(b,name,'SKILL.md'),'\nlocal change');await assert.rejects(install({name,targetDir:b}),e=>e.code==='LOCAL_CHANGES');
 }finally{if(previous===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=previous;await fs.rm(root,{recursive:true,force:true});}
});
