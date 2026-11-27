import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {MANIFEST,ROOT,closure,componentRecords,nodeFor,source} from '../src/core.mjs';
import {checkComponents,inspectComponent} from '../src/components.mjs';import {install,status} from '../src/skill-manager.mjs';import {doctor,componentEnvironment} from '../src/runtime.mjs';import {collectionPrepare} from '../src/subscription.mjs';
const name='portable-skill-creator',explainer='skill-flow-explainer';
const creatorPackage='@lumyne/portable-skill-creator';
test('creator is independently selectable and resolves its exact current owning package',async()=>{
 assert.deepEqual(new Set(closure({name}).map(n=>n.skill)),new Set([name,explainer]));assert.equal(MANIFEST.components[name].package,creatorPackage);assert.ok(closure().some(n=>n.skill===name));assert.ok(nodeFor('operations').requires_skills.includes(name));assert.equal(MANIFEST.components[name].skill_installation,'component-managed');
 const r=componentRecords()[name];assert.ok(r);assert.equal((await inspectComponent(name,r.root)).sources[name],source(nodeFor(name)));await assert.rejects(fs.stat(path.join(ROOT,'skills',name)));
 const d=await doctor(name);assert.equal(d.ok,true,JSON.stringify(d));assert.equal(d.service_access,'not-required');assert.deepEqual(d.native_requirements,[{id:'agent.skill.base-creator.resolve',status:'requires-active-agent-verification'}]);assert.equal(componentEnvironment(name,{}).PORTABLE_SKILL_UPDATE_CHECK,'0');
});
test('suite copies include component-owned runtime and survive source and sibling removal; edited copies refuse',async()=>{
 const old=process.env.TAOBAO_AI_OPS_STATE_DIR,root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-creator-isolation-'));
 try{
  const records=componentRecords(),original=records[name],clone=path.join(root,'component');await fs.cp(original.root,clone,{recursive:true});
  const record=await inspectComponent(name,clone);process.env.TAOBAO_AI_OPS_STATE_DIR=path.join(root,'state');await fs.mkdir(process.env.TAOBAO_AI_OPS_STATE_DIR);await fs.writeFile(path.join(process.env.TAOBAO_AI_OPS_STATE_DIR,'components.json'),JSON.stringify({components:{[name]:record,[explainer]:records[explainer]}}));
  const a=path.join(root,'a'),b=path.join(root,'b');await install({name,targetDir:a,mode:'copy'});await install({name,targetDir:b,mode:'copy'});
  assert.equal((await status(b,nodeFor(name))).state,'current');assert.equal((await install({name,targetDir:b,mode:'copy'})).skills[0].action,'unchanged');
  const entry=path.join(b,name,'.runtime/bin/portable-skill-creator.mjs');assert.notEqual((await fs.stat(entry)).ino,(await fs.stat(path.join(a,name,'.runtime/bin/portable-skill-creator.mjs'))).ino);
  await fs.appendFile(path.join(b,name,'SKILL.md'),'\nlocal edits');await assert.rejects(install({name,targetDir:b,mode:'copy'}),e=>e.code==='LOCAL_CHANGES');
  await fs.rm(clone,{recursive:true});await fs.rm(a,{recursive:true});
  const r=spawnSync(process.execPath,[entry,'version','--json'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).version,original.version);
  const asset=path.join(b,name,'assets/node-ledger/ledger.py');await fs.access(asset);
 }finally{if(old===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=old;await fs.rm(root,{recursive:true,force:true});}
});
test('scope upgrade backs up the previous installer journal and restores it on rollback',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-creator-scope-'));
 try{
  await install({name,targetDir:root,mode:'copy'});
  const dest=path.join(await fs.realpath(root),name),operationFile=dest+'.operation.json';
  const operation=JSON.parse(await fs.readFile(operationFile,'utf8'));
  operation.package='@petercjl/'+name;operation.version='0.2.1';
  await fs.writeFile(operationFile,JSON.stringify(operation));
  const receiptFile=path.join(dest,'.suite-install.json');
  const receipt=JSON.parse(await fs.readFile(receiptFile,'utf8'));receipt.version=operation.version;
  await fs.writeFile(receiptFile,JSON.stringify(receipt));
  await assert.rejects(install({name,targetDir:root,mode:'copy'},{failAfter:1}),e=>e.code==='TEST_INJECTED_FAILURE');
  assert.deepEqual(JSON.parse(await fs.readFile(operationFile,'utf8')),operation);
  assert.equal(JSON.parse(await fs.readFile(receiptFile,'utf8')).version,operation.version);
  const result=await install({name,targetDir:root,mode:'copy'});
  const updated=result.skills.find(item=>item.skill===name);
  assert.equal(updated.state,'current');
  assert.deepEqual(JSON.parse(await fs.readFile(updated.backup+'.operation.json','utf8')),operation);
  assert.equal(JSON.parse(await fs.readFile(operationFile,'utf8')).package,creatorPackage);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('creator preflight rejects absent, old, mismatched and failed component runtime',async()=>{
 const old=process.env.TAOBAO_AI_OPS_STATE_DIR,root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-creator-negative-'));
 try{process.env.TAOBAO_AI_OPS_STATE_DIR=root;assert.equal((await doctor(name)).ok,false);
 const skill=path.join(root,'skill');await fs.mkdir(skill);await fs.writeFile(path.join(skill,'SKILL.md'),'fixture');const entry=path.join(root,'cli.mjs');
 const records={[name]:{package:creatorPackage,version:'0.2.2',root,entry,sources:{[name]:skill}}};
 const write=()=>fs.writeFile(path.join(root,'components.json'),JSON.stringify({components:records}));await write();
 const emitRuntime=()=>fs.writeFile(entry,`console.log(JSON.stringify({ok:true,package:${JSON.stringify(records[name].package)},version:${JSON.stringify(records[name].version)},python:{version:[3,12]}}))`);
 await emitRuntime();assert.equal((await doctor(name)).ok,true);
 records[name].version='0.2.1';await write();await emitRuntime();assert.equal((await doctor(name)).ok,false);
 records[name].version='0.2.2';records[name].package='@petercjl/'+name;await write();await emitRuntime();
 assert.equal((await doctor(name)).checks.at(-1).code,'COMPONENT_IDENTITY_MISMATCH');
 const migration=await checkComponents(async url=>{
  assert.equal(url,`https://registry.npmjs.org/${encodeURIComponent(creatorPackage)}`);
  return {ok:true,json:async()=>({'dist-tags':{latest:'0.2.2'}})};
 },new Set([name]));
 assert.equal(migration.components[0].updateAvailable,true);
 records[name].package=creatorPackage;await write();await fs.writeFile(entry,'process.exitCode=1');assert.equal((await doctor(name)).ok,false);
 }finally{if(old===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=old;await fs.rm(root,{recursive:true,force:true});}
});

test('host-owned collection also materializes the creator runtime through its actual installer',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'collection-creator-')),previous=MANIFEST.components,npm=process.env.npm_execpath,record=componentRecords()[name];
 try{
  MANIFEST.components={[name]:previous[name]};process.env.npm_execpath='fixture-npm-cli.js';
  const result=await collectionPrepare({directory:path.join(root,'candidate'),yes:true},{registry:async()=>({ok:true,json:async()=>({name:record.package,version:record.version})}),run:async(_command,_args,_timeout,cwd)=>{
   const dest=path.join(cwd,'node_modules',...record.package.split('/'));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.cp(record.root,dest,{recursive:true});return '';
  }});
  const skill=result.skills.find(s=>s.name===name);assert.ok(skill);assert.equal(JSON.parse(await fs.readFile(path.join(skill.directory,'.collection-runtime.json'))).version,record.version);
  const entry=path.join(skill.directory,'.runtime/bin/portable-skill-creator.mjs');await fs.rm(path.join(root,'candidate/runtime'),{recursive:true});
  const run=spawnSync(process.execPath,[entry,'version','--json'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).version,record.version);
 }finally{MANIFEST.components=previous;if(npm===undefined)delete process.env.npm_execpath;else process.env.npm_execpath=npm;await fs.rm(root,{recursive:true,force:true});}
});
