import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {MANIFEST,PACKAGE} from '../src/core.mjs';
import {collectionCheck,collectionPrepare,compatible} from '../src/subscription.mjs';

const registry=async url=>({ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:'1.0.0'})});
test('member releases are checked without changing the shell; newly registered members are selected',async()=>{
 const first=await collectionCheck(undefined,registry);assert.equal(first.changed,true);
 assert.equal((await collectionCheck(first,registry)).changed,false);
 const update=await collectionCheck(first,async url=>({ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:'1.0.1'})}));
 assert.equal(update.version,first.version);assert.equal(update.changed,true);assert.ok(update.members.every(m=>m.version==='1.0.1'));
 const withoutLast={...first,members:first.members.slice(0,-1)};assert.equal((await collectionCheck(withoutLast,registry)).changed,true);
});
test('compatibility, downgrade and offline boundaries retain the selection',async()=>{
 assert.equal(compatible('0.4.1','0.4.2'),true);assert.equal(compatible('0.4.1','0.5.0'),false);assert.equal(compatible('1.1.0','1.0.0'),false);
 const first=await collectionCheck(undefined,registry);
 const blocked=await collectionCheck(first,async url=>({ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:'2.0.0'})}));
 assert.equal(blocked.changed,false);assert.ok(blocked.members.every(m=>m.blocked&&m.version==='1.0.0'));
 await assert.rejects(collectionCheck(first,async()=>{throw Error('offline');}),/offline/);
});
test('real npm candidate owns complete multi-Skill resources and survives bootstrap deletion',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'suite-subscription-'));
 const original=MANIFEST.components, npmEnv=process.env.npm_execpath;
 try{
  const fixture=path.join(temp,'fixture');await fs.mkdir(fixture);
  await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({name:'@suite-test/member',version:'1.0.0',type:'module',bin:{member:'cli.mjs'}}));
  for(const name of ['member-one','member-two']){await fs.mkdir(path.join(fixture,'skills',name),{recursive:true});await fs.writeFile(path.join(fixture,'skills',name,'SKILL.md'),`---\nname: ${name}\ndescription: test\n---\nRead resources relative to this Skill.\n`);await fs.writeFile(path.join(fixture,'skills',name,'asset.txt'),'owned');}
  await fs.writeFile(path.join(fixture,'capabilities.json'),JSON.stringify({discoveryContract:{skillCollection:{enumeration:{argv:['skill','source','--all','--json'],itemsField:'sources'}}}}));
  await fs.writeFile(path.join(fixture,'cli.mjs'),`import path from 'node:path';import{fileURLToPath}from'node:url';const root=path.dirname(fileURLToPath(import.meta.url));if(process.argv.includes('version'))console.log('1.0.0');else console.log(JSON.stringify({sources:['member-one','member-two'].map(skill=>({skill,source:path.join(root,'skills',skill)}))}));`);
  let npmCli=process.env.npm_execpath;
  if(!npmCli?.endsWith('npm-cli.js')){const found=spawnSync(process.platform==='win32'?'where':'which',[process.platform==='win32'?'npm.cmd':'npm'],{encoding:'utf8'}).stdout.trim().split(/\r?\n/)[0];npmCli=process.platform==='win32'?path.join(path.dirname(found),'node_modules','npm','bin','npm-cli.js'):await fs.realpath(found);}
  const packed=spawnSync(process.execPath,[npmCli,'pack',fixture,'--pack-destination',temp,'--ignore-scripts','--dry-run=false','--json'],{encoding:'utf8',env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^npm_config_(dry_run|json|if_present)$/i.test(key)))});assert.equal(packed.status,0,packed.stderr);const archives=(await fs.readdir(temp)).filter(name=>name.endsWith('.tgz'));assert.equal(archives.length,1,packed.stdout);const tgz=path.join(temp,archives[0]);
  MANIFEST.components={fixture:{package:'@suite-test/member',bin:'member',skills:['member-one']}};
  process.env.npm_execpath=npmCli;
  const prepare=directory=>collectionPrepare({directory,yes:true},{registry,run:async(command,args)=>{
   const result=spawnSync(command,[...args.slice(0,-1),tgz],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout;
  }});
  const discarded=await prepare(path.join(temp,'discarded-host'));
  const candidate=await prepare(path.join(temp,'candidate'));
  assert.equal(candidate.skills.length,3);assert.equal(candidate.package,PACKAGE.name);
  const second=candidate.skills.find(s=>s.name==='member-two');assert.equal(await fs.readFile(path.join(second.directory,'asset.txt'),'utf8'),'owned');
  const discardedSkill=discarded.skills.find(s=>s.name==='member-two');
  assert.notEqual((await fs.stat(discardedSkill.runtimeEntry)).ino,(await fs.stat(second.runtimeEntry)).ino);
  for(const skill of candidate.skills){assert.equal((await fs.lstat(skill.directory)).isSymbolicLink(),false);const receipt=JSON.parse(await fs.readFile(path.join(skill.directory,'.collection-runtime.json'),'utf8'));assert.equal(receipt.version,skill.version);}
  const shell=candidate.skills.find(s=>s.name==='taobao-ai-operations');
  assert.equal(spawnSync(process.execPath,[shell.runtimeEntry,'version'],{encoding:'utf8',env:{...process.env,...candidate.environment}}).stdout.trim(),PACKAGE.version);
  await fs.rm(path.join(temp,'discarded-host'),{recursive:true});
  await fs.rm(fixture,{recursive:true});await fs.rm(tgz);
  const version=spawnSync(process.execPath,[second.runtimeEntry,'version'],{encoding:'utf8'});assert.equal(version.stdout.trim(),'1.0.0');
  await assert.rejects(collectionPrepare({directory:path.join(temp,'candidate'),yes:true}),e=>e.code==='TARGET_EXISTS');
  await assert.rejects(collectionPrepare({directory:path.join(temp,'failed'),yes:true},{registry,run:async()=>{throw Error('npm failed');}}),/npm failed/);await assert.rejects(fs.stat(path.join(temp,'failed')));
 }finally{MANIFEST.components=original;if(npmEnv===undefined)delete process.env.npm_execpath;else process.env.npm_execpath=npmEnv;await fs.rm(temp,{recursive:true,force:true});}
});
