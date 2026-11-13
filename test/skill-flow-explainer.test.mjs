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
const name='skill-flow-explainer';
test('flow explainer is an independent node with exact source and runtime checks',async()=>{
 assert.deepEqual(closure({name}).map(n=>n.skill),[name]);
 assert.ok(nodeFor('operations').requires_skills.includes(name));
 assert.equal(MANIFEST.components[name].skill_installation,'component-managed');
 await assert.rejects(fs.stat(path.join(ROOT,'skills',name)));
 const record=componentRecords()[name];assert.ok(record);
 assert.ok((await inspectComponent(name,record.root)).sources[name]);
 const d=await doctor(name);assert.equal(d.ok,true,JSON.stringify(d));
 assert.equal(d.service_access,'not-required');
 assert.equal(componentEnvironment(name,{}).SKILL_FLOW_UPDATE_CHECK,'0');
});
test('flow explainer physical install, no-op, report, edit protection and isolation',async()=>{
 const previous=process.env.TAOBAO_AI_OPS_STATE_DIR;
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'suite-flow-')));
 const original=componentRecords()[name];
 const run=(entry,args)=>{const p=spawnSync(process.execPath,[entry,...args],{encoding:'utf8',env:{...process.env,SKILL_FLOW_UPDATE_CHECK:'0'}});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
 try{
  const clone=path.join(root,'component');await fs.cp(original.root,clone,{recursive:true});
  const record=await inspectComponent(name,clone);process.env.TAOBAO_AI_OPS_STATE_DIR=path.join(root,'state');
  await fs.mkdir(process.env.TAOBAO_AI_OPS_STATE_DIR);await fs.writeFile(path.join(process.env.TAOBAO_AI_OPS_STATE_DIR,'components.json'),JSON.stringify({components:{[name]:record}}));
  const a=path.join(root,'a'),b=path.join(root,'b');await install({name,targetDir:a});await install({name,targetDir:b});
  assert.equal((await status(b,nodeFor(name))).state,'current');
  assert.equal((await install({name,targetDir:b})).skills[0].action,'unchanged');
  const entry=path.join(b,name,'scripts/cli.mjs');
  await fs.rm(clone,{recursive:true});await fs.rm(a,{recursive:true});
  assert.equal(run(entry,['doctor','--json']).version,original.version);
  const input=path.join(root,'input');await fs.mkdir(input);await fs.writeFile(path.join(input,'SKILL.md'),'# Example\nRead and explain facts.\n');
  const sf=path.join(root,'source.json');run(entry,['collect','--source',input,'--out',sf]);const source=JSON.parse(await fs.readFile(sf));
  const analysis={schemaVersion:1,title:'流程报告',skill:'example',summary:'读取事实后解释',scope:'静态源码',input:'事实',output:'说明',sourceHash:source.sourceHash,nodes:[{id:'explain',title:'解释事实',purpose:'理解',input:'事实',output:'说明',dependsOn:[],items:[{kind:'策略',title:'依据事实',text:'读取后解释',basis:'explicit',evidence:[{file:'SKILL.md',start:2,end:2,quote:'Read and explain facts.'}]}]}],files:[{path:'SKILL.md',role:'入口',coverage:'full'}],branches:[],limitations:[]};
  const af=path.join(root,'analysis.json'),out=path.join(root,'report.html');await fs.writeFile(af,JSON.stringify(analysis));run(entry,['render','--source',sf,'--analysis',af,'--out',out]);assert.ok((await fs.readFile(out,'utf8')).includes('流程报告'));
  // Restore component source only to exercise the suite's ownership guard.
  await fs.cp(original.root,clone,{recursive:true});await fs.appendFile(path.join(b,name,'SKILL.md'),'\nuser edit');
  await assert.rejects(install({name,targetDir:b}),e=>e.code==='LOCAL_CHANGES');
 }finally{if(previous===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=previous;await fs.rm(root,{recursive:true,force:true});}
});
