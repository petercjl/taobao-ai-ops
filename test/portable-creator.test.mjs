import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {MANIFEST,ROOT,closure,componentRecords,nodeFor,source} from '../src/core.mjs';
import {inspectComponent} from '../src/components.mjs';import {install,status} from '../src/skill-manager.mjs';import {doctor,componentEnvironment} from '../src/runtime.mjs';import {collectionPrepare} from '../src/subscription.mjs';
const name='portable-skill-creator';
test('creator is independently selectable and resolves its exact current owning package',async()=>{
 assert.deepEqual(closure({name}).map(n=>n.skill),[name]);assert.ok(closure().some(n=>n.skill===name));assert.ok(nodeFor('operations').requires_skills.includes(name));assert.equal(MANIFEST.components[name].skill_installation,'component-managed');
 const r=componentRecords()[name];assert.ok(r);assert.equal((await inspectComponent(name,r.root)).sources[name],source(nodeFor(name)));await assert.rejects(fs.stat(path.join(ROOT,'skills',name)));
 const d=await doctor(name);assert.equal(d.ok,true,JSON.stringify(d));assert.equal(d.service_access,'not-required');assert.deepEqual(d.native_requirements,[{id:'agent.skill.base-creator.resolve',status:'requires-active-agent-verification'}]);assert.equal(componentEnvironment(name,{}).PORTABLE_SKILL_UPDATE_CHECK,'0');
});
test('suite copies include component-owned runtime and survive source and sibling removal; edited copies refuse',async()=>{
 const old=process.env.TAOBAO_AI_OPS_STATE_DIR,root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-creator-isolation-'));
 try{
  const original=componentRecords()[name],clone=path.join(root,'component');await fs.cp(original.root,clone,{recursive:true});
  const record=await inspectComponent(name,clone);process.env.TAOBAO_AI_OPS_STATE_DIR=path.join(root,'state');await fs.mkdir(process.env.TAOBAO_AI_OPS_STATE_DIR);await fs.writeFile(path.join(process.env.TAOBAO_AI_OPS_STATE_DIR,'components.json'),JSON.stringify({components:{[name]:record}}));
  const a=path.join(root,'a'),b=path.join(root,'b');await install({name,targetDir:a,mode:'copy'});await install({name,targetDir:b,mode:'copy'});
  assert.equal((await status(b,nodeFor(name))).state,'current');assert.equal((await install({name,targetDir:b,mode:'copy'})).skills[0].action,'unchanged');
  const entry=path.join(b,name,'.runtime/bin/portable-skill-creator.mjs');assert.notEqual((await fs.stat(entry)).ino,(await fs.stat(path.join(a,name,'.runtime/bin/portable-skill-creator.mjs'))).ino);
  await fs.appendFile(path.join(b,name,'SKILL.md'),'\nlocal edits');await assert.rejects(install({name,targetDir:b,mode:'copy'}),e=>e.code==='LOCAL_CHANGES');
  await fs.rm(clone,{recursive:true});await fs.rm(a,{recursive:true});
  const r=spawnSync(process.execPath,[entry,'version','--json'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).version,original.version);
  const asset=path.join(b,name,'assets/node-ledger/ledger.py');await fs.access(asset);
 }finally{if(old===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=old;await fs.rm(root,{recursive:true,force:true});}
});
test('creator preflight rejects absent, old, mismatched and failed component runtime',async()=>{
 const old=process.env.TAOBAO_AI_OPS_STATE_DIR,root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-creator-negative-'));
 try{process.env.TAOBAO_AI_OPS_STATE_DIR=root;assert.equal((await doctor(name)).ok,false);
 const skill=path.join(root,'skill');await fs.mkdir(skill);await fs.writeFile(path.join(skill,'SKILL.md'),'fixture');const entry=path.join(root,'cli.mjs');
 const records={[name]:{package:'@petercjl/'+name,version:'0.2.1',root,entry,sources:{[name]:skill}}};
 const write=()=>fs.writeFile(path.join(root,'components.json'),JSON.stringify({components:records}));await write();
 await fs.writeFile(entry,`console.log(JSON.stringify({ok:true,package:'@petercjl/portable-skill-creator',version:'0.2.1',python:{version:[3,12]}}))`);assert.equal((await doctor(name)).ok,true);
 records[name].version='0.2.0';await write();assert.equal((await doctor(name)).ok,false);
 records[name].version='0.2.1';await write();await fs.writeFile(entry,`console.log(JSON.stringify({ok:false,package:'@petercjl/portable-skill-creator',version:'0.2.1'}));process.exitCode=1`);assert.equal((await doctor(name)).ok,false);
 }finally{if(old===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=old;await fs.rm(root,{recursive:true,force:true});}
});

test('host-owned collection also materializes the creator runtime through its actual installer',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'collection-creator-')),previous=MANIFEST.components,npm=process.env.npm_execpath,record=componentRecords()[name];
 try{
  MANIFEST.components={[name]:previous[name]};process.env.npm_execpath='fixture-npm-cli.js';
  const result=await collectionPrepare({directory:path.join(root,'candidate'),yes:true},{registry:async()=>({ok:true,json:async()=>({name:record.package,version:record.version})}),run:async(command,args)=>{
   const prefix=args[args.indexOf('--prefix')+1],dest=path.join(prefix,'node_modules',...record.package.split('/'));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.cp(record.root,dest,{recursive:true});return '';
  }});
  const skill=result.skills.find(s=>s.name===name);assert.ok(skill);assert.equal(JSON.parse(await fs.readFile(path.join(skill.directory,'.collection-runtime.json'))).version,record.version);
  const entry=path.join(skill.directory,'.runtime/bin/portable-skill-creator.mjs');await fs.rm(path.join(root,'candidate/runtime'),{recursive:true});
  const run=spawnSync(process.execPath,[entry,'version','--json'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).version,record.version);
 }finally{MANIFEST.components=previous;if(npm===undefined)delete process.env.npm_execpath;else process.env.npm_execpath=npm;await fs.rm(root,{recursive:true,force:true});}
});
