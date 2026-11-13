import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,PACKAGE,nodeFor} from '../src/core.mjs';
import {install,status,targetRoot} from '../src/skill-manager.mjs';
const entry=path.join(ROOT,'bin','taobao-ai-ops.mjs');
const invoke=(args,env={})=>{const r=spawnSync(process.execPath,[entry,...args],{encoding:'utf8',env:{...process.env,TAOBAO_AI_OPS_AUTO_UPDATE:'0',...env}});return {...r,data:JSON.parse(r.stdout||r.stderr)};};
test('generic host uses an explicit destination and malformed or duplicate options refuse before writes',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-generic-'));
 try{
  assert.equal(targetRoot({agent:'arbitrary-host',targetDir:root}),root);
  assert.throws(()=>targetRoot({agent:'../bad',targetDir:root}),e=>e.code==='INVALID_AGENT');
  assert.throws(()=>targetRoot({agent:'arbitrary-host'}),e=>e.code==='UNKNOWN_AGENT');
  for(const args of [['skill','install','--owned','--agent','../bad','--target-dir',root],['skill','install','--owned','--target-dir',root,'--target-dir',root]])assert.notEqual(invoke(args).status,0);
  assert.deepEqual(await fs.readdir(root),[]);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned Skill installations survive bootstrap deletion and independently preserve versions and runtime',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-isolation-'));const a=path.join(root,'a'),b=path.join(root,'b'),bootstrap=path.join(root,'bootstrap');
 try{
  const packed=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['pack','--pack-destination',root,'--json'],{cwd:ROOT,encoding:'utf8',shell:process.platform==='win32'});assert.equal(packed.status,0,packed.stderr);
  const tarball=path.join(root,JSON.parse(packed.stdout.slice(packed.stdout.lastIndexOf('\n[')+1))[0].filename);
  const acquisition=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['install','--prefix',bootstrap,'--ignore-scripts','--no-audit','--no-fund',tarball],{encoding:'utf8',shell:process.platform==='win32'});assert.equal(acquisition.status,0,acquisition.stderr);
  const cli=path.join(bootstrap,'node_modules',...PACKAGE.name.split('/'),'bin','taobao-ai-ops.mjs');
  for(const target of [a,b]){const r=spawnSync(process.execPath,[cli,'skill','install','--owned','--agent','arbitrary-host','--target-dir',target,'--json'],{encoding:'utf8',env:{...process.env,TAOBAO_AI_OPS_STATE_DIR:path.join(root,'state')}});assert.equal(r.status,0,r.stderr);}
  const n=nodeFor('operations'),dest=path.join(b,n.skill),runtime=path.join(dest,'.runtime','bin','taobao-ai-ops.mjs');
  assert.equal((await fs.lstat(dest)).isSymbolicLink(),false);
  assert.notEqual((await fs.stat(path.join(a,n.skill,'SKILL.md'))).ino,(await fs.stat(path.join(dest,'SKILL.md'))).ino);
  await fs.rm(bootstrap,{recursive:true,force:true});await fs.rm(a,{recursive:true,force:true});await fs.unlink(tarball);
  const result=spawnSync(process.execPath,[runtime,'version','--json'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).version,PACKAGE.version);
  const nodes=spawnSync(process.execPath,[runtime,'nodes','list'],{encoding:'utf8'});assert.equal(nodes.status,0);assert(JSON.parse(nodes.stdout).some(n=>n.id==='operations'));
  const before=await status(b,n);assert.equal(before.current,true);assert.equal(before.verification.verified,true);
  const same=await install({owned:true,targetDir:b});assert.equal(same.skills[0].action,'unchanged');
  const receipt=path.join(dest,'.suite-install.json'),meta=JSON.parse(await fs.readFile(receipt,'utf8'));meta.version='0.0.0';await fs.writeFile(receipt,JSON.stringify(meta));
  assert.equal((await status(b,n)).current,false);const repair=await install({owned:true,targetDir:b});assert.equal(repair.skills[0].action,'updated');
  await fs.appendFile(path.join(dest,'SKILL.md'),'\nlocal-edits');await assert.rejects(install({owned:true,targetDir:b}),e=>e.code==='LOCAL_CHANGES');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('legacy link requests materialize physical copies with verified historical-mode backup',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-link-'));const n=nodeFor('operations');
 try{
  await fs.symlink(path.join(ROOT,'skills',n.skill),path.join(root,n.skill),process.platform==='win32'?'junction':'dir');
  const result=await install({owned:true,targetDir:root,mode:'link'});
  assert.equal(result.skills[0].mode,'copy');assert.equal((await fs.lstat(path.join(root,n.skill))).isSymbolicLink(),false);
  assert.equal((await fs.lstat(result.skills[0].backup)).isSymbolicLink(),true);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('ordinary-entry detection is cached, concurrent, optional and backs off offline without installation',async()=>{
 const {detectUpdate}=await import('../src/update.mjs');const previous=process.env.TAOBAO_AI_OPS_STATE_DIR,setting=process.env.TAOBAO_AI_OPS_AUTO_UPDATE,root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-detection-'));
 try{
  process.env.TAOBAO_AI_OPS_STATE_DIR=root;delete process.env.TAOBAO_AI_OPS_AUTO_UPDATE;let calls=0;
  const registry=async()=>{calls++;return {ok:true,json:async()=>({name:PACKAGE.name,version:PACKAGE.version})};};
  await Promise.all([detectUpdate(registry,1000),detectUpdate(registry,1000)]);assert.equal(calls,1);
  await detectUpdate(registry,2000);assert.equal(calls,1);
  await detectUpdate(registry,21602000);assert.equal(calls,2);
  process.env.TAOBAO_AI_OPS_AUTO_UPDATE='0';await detectUpdate(registry,50000000);assert.equal(calls,2);
  delete process.env.TAOBAO_AI_OPS_AUTO_UPDATE;
  await detectUpdate(async()=>{calls++;throw Error('offline');},50000000);await detectUpdate(registry,50000001);assert.equal(calls,3);
  const cache=path.join(root,'update-check.json');await fs.writeFile(cache,'user-invalid-cache');await detectUpdate(registry,100000000);assert.equal(await fs.readFile(cache,'utf8'),'user-invalid-cache');
 }finally{if(previous===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=previous;if(setting===undefined)delete process.env.TAOBAO_AI_OPS_AUTO_UPDATE;else process.env.TAOBAO_AI_OPS_AUTO_UPDATE=setting;await fs.rm(root,{recursive:true,force:true});}
});
