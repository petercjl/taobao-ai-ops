import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {promisify} from 'node:util';
import {MANIFEST,PACKAGE} from '../src/core.mjs';
import {collectionCheck,collectionPrepare,compatible,compareVersions} from '../src/subscription.mjs';

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
  const prepare=directory=>collectionPrepare({directory,yes:true},{registry,run:async(command,args,_timeout,cwd)=>{
   const result=spawnSync(command,[...args,tgz],{encoding:'utf8',cwd});assert.equal(result.status,0,result.stderr);return result.stdout;
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

test('explicit contract migration updates only selected components and never permits a downgrade',async()=>{
 const first=await collectionCheck(undefined,registry);const next=async url=>({ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:'2.0.0'})});
 const migrated=await collectionCheck(first,next,['tbcli','dmp-product-report']);assert.deepEqual(migrated.members.filter(m=>m.explicitMigration).map(m=>m.id).sort(),['dmp-product-report','tbcli']);assert.ok(migrated.members.filter(m=>!m.explicitMigration).every(m=>m.blocked&&m.version==='1.0.0'));
 const downgraded=await collectionCheck(migrated,registry,['tbcli','dmp-product-report']);assert.ok(downgraded.members.filter(m=>['tbcli','dmp-product-report'].includes(m.id)).every(m=>m.blocked&&m.version==='2.0.0'));
 await assert.rejects(collectionCheck(first,next,['unknown-component']),e=>e.code==='UNKNOWN_COMPONENT');
});

test('incremental candidate keeps unchanged dependencies through a new registry gateway',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'suite-incremental-'));
 const original=MANIFEST.components,npmEnv=process.env.npm_execpath;
 const servers=[];
 const freshEnv=process.env.SEALWORK_COLLECTION_FRESH_RUNTIME;
 try{
  let npmCli=npmEnv;
  if(!npmCli?.endsWith('npm-cli.js')){
   const found=spawnSync(process.platform==='win32'?'where':'which',[process.platform==='win32'?'npm.cmd':'npm'],{encoding:'utf8'}).stdout.trim().split(/\r?\n/)[0];
   npmCli=process.platform==='win32'?path.join(path.dirname(found),'node_modules','npm','bin','npm-cli.js'):await fs.realpath(found);
  }
  process.env.npm_execpath=npmCli;
  const exec=promisify(execFile);
  const archives=new Map();
  for(const [name,version] of [['first','1.0.0'],['first','1.0.1'],['second','1.0.0'],['added','1.0.0'],['shared','1.0.0']]){
   const fixture=path.join(temp,`${name}-${version}`);
   await fs.mkdir(fixture);
   const pkg={name,version,type:'module',...(name==='shared'?{}:{bin:{[name]:'cli.mjs'},dependencies:{shared:'^1.0.0'}})};
   await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify(pkg));
   if(name!=='shared'){
    await fs.mkdir(path.join(fixture,'skill'));
    await fs.writeFile(path.join(fixture,'skill','SKILL.md'),`---\nname: ${name}-skill\ndescription: fixture\n---\n`);
    await fs.writeFile(path.join(fixture,'cli.mjs'),`import {fileURLToPath} from 'node:url'; console.log(JSON.stringify({source:fileURLToPath(new URL('./skill',import.meta.url))}));`);
   }
   await exec(process.execPath,[npmCli,'pack',fixture,'--pack-destination',temp,'--ignore-scripts']);
   archives.set(`${name}-${version}`,{pkg,bytes:await fs.readFile(path.join(temp,`${name}-${version}.tgz`))});
  }
  async function gateway(){
   const requests=[];
   const server=createServer((req,res)=>{
    requests.push(req.url);
    if(req.url.endsWith('.tgz')){
     const entry=archives.get(req.url.slice(1,-4));
     if(!entry){res.writeHead(404).end();return;}
     res.end(entry.bytes);return;
    }
    const name=req.url.slice(1);
    const versions=Object.fromEntries([...archives.values()].filter(e=>e.pkg.name===name).map(e=>[e.pkg.version,{...e.pkg,dist:{tarball:`${base}${name}-${e.pkg.version}.tgz`}}]));
    if(!Object.keys(versions).length){res.writeHead(404).end();return;}
    res.end(JSON.stringify({name,'dist-tags':{latest:Object.keys(versions).at(-1)},versions}));
   });
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   servers.push(server);
   const base=`http://127.0.0.1:${server.address().port}/`;
   return {base,requests};
  }
  const prepare=(name,source,firstVersion,previous)=>collectionPrepare({directory:path.join(temp,name),yes:true,previous},{
   registry:async url=>({ok:true,json:async()=>{const name=decodeURIComponent(url.split('/').at(-2));return {name,version:name==='first'?firstVersion:'1.0.0'};}}),
   run:async(command,args,_timeout,cwd)=>(await exec(command,[...args,'--registry',source.base,'--cache',path.join(temp,`cache-${name}`)],{cwd})).stdout,
  });
  MANIFEST.components={first:{package:'first',bin:'first',skills:['first-skill']},second:{package:'second',bin:'second',skills:['second-skill']}};
  const originalGateway=await gateway();
  await prepare('original',originalGateway,'1.0.0');
  originalGateway.requests.length=0;
  const previous=path.join(temp,'original','collection.json');
  const nextGateway=await gateway();
  const candidate=await prepare('incremental',nextGateway,'1.0.1',previous);
  assert.deepEqual(candidate.members.map(m=>m.version),['1.0.1','1.0.0']);
  assert.ok(nextGateway.requests.includes('/first-1.0.1.tgz'),nextGateway.requests.join(', '));
  assert.ok(!nextGateway.requests.some(url=>/^\/(second|shared)(?:[/-]|$)/.test(url)),nextGateway.requests.join(', '));
  assert.deepEqual(originalGateway.requests,[]);
  const originalSecond=path.join(temp,'original','runtime','node_modules','second','cli.mjs');
  const nextSecond=path.join(temp,'incremental','runtime','node_modules','second','cli.mjs');
  assert.notEqual((await fs.stat(originalSecond)).ino,(await fs.stat(nextSecond)).ino);
  const unchangedGateway=await gateway();
  await prepare('unchanged',unchangedGateway,'1.0.1',path.join(temp,'incremental','collection.json'));
  assert.deepEqual(unchangedGateway.requests,[]);
  delete MANIFEST.components.first;
  MANIFEST.components.added={package:'added',bin:'added',skills:['added-skill']};
  const changedGateway=await gateway();
  const nextPrevious=path.join(temp,'incremental','collection.json');
  const changed=await prepare('changed',changedGateway,'1.0.1',nextPrevious);
  assert.deepEqual(changed.members.map(m=>m.package),['second','added']);
  assert.ok(changedGateway.requests.includes('/added-1.0.0.tgz'));
  assert.ok(!changedGateway.requests.some(url=>/^\/(first|second|shared)(?:[/-]|$)/.test(url)),changedGateway.requests.join(', '));
  await assert.rejects(fs.stat(path.join(temp,'changed','runtime','node_modules','first')),{code:'ENOENT'});
  process.env.SEALWORK_COLLECTION_FRESH_RUNTIME='1';
  const repairGateway=await gateway();
  await prepare('repair',repairGateway,'1.0.1',path.join(temp,'changed','collection.json'));
  assert.ok(repairGateway.requests.includes('/second-1.0.0.tgz'));
 }finally{
  if(freshEnv===undefined)delete process.env.SEALWORK_COLLECTION_FRESH_RUNTIME;else process.env.SEALWORK_COLLECTION_FRESH_RUNTIME=freshEnv;
  for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  MANIFEST.components=original;
  if(npmEnv===undefined)delete process.env.npm_execpath;else process.env.npm_execpath=npmEnv;
  await fs.rm(temp,{recursive:true,force:true});
 }
});


test('per-component next selection persists and explicit latest return permits only that channel downgrade',async()=>{
 const first=await collectionCheck(undefined,registry),id=Object.keys(MANIFEST.components)[0],other=Object.keys(MANIFEST.components)[1];
 const requested=[];const tagged=async url=>{requested.push(url);return {ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:url.endsWith('/next')?'1.1.0-next.10':'1.0.0'})};};
 const next=await collectionCheck(first,tagged,[],{[id]:'next'});const row=next.members.find(m=>m.id===id);assert.equal(row.version,'1.1.0-next.10');assert.equal(row.channel,'next');assert(row.channelSwitch);assert(next.changed);assert.equal(next.members.find(m=>m.id===other).version,'1.0.0');assert.equal(requested.filter(u=>u.endsWith('/next')).length,1);
 const unchanged=await collectionCheck(next,tagged);assert.equal(unchanged.changed,false);assert.equal(unchanged.members.find(m=>m.id===id).channel,'next');
 const back=await collectionCheck(next,tagged,[],{[id]:'latest'});assert.equal(back.members.find(m=>m.id===id).version,'1.0.0');assert.equal(back.members.find(m=>m.id===id).channel,'latest');assert(back.changed);
 const backward=await collectionCheck(next,async url=>({ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:url.endsWith('/next')?'1.1.0-next.2':'1.0.0'})}));assert(backward.members.find(m=>m.id===id).blocked);assert.equal(backward.changed,false);
 assert.equal(compareVersions('1.1.0-next.10','1.1.0-next.2'),1);assert.equal(compareVersions('1.1.0','1.1.0-next.10'),1);
});
test('unpublished next and invalid channel selection fail without falling back to latest',async()=>{
 const id=Object.keys(MANIFEST.components)[0];let calls=0;await assert.rejects(collectionCheck(undefined,async()=>{calls++;return {ok:false,status:404};},[],{[id]:'next'}),{code:'CHANNEL_UNAVAILABLE'});assert.equal(calls,1);
 for(const value of [{unknown:'next'},{[id]:'beta'},'not-json',[]])await assert.rejects(collectionCheck(undefined,registry,[],value),e=>['UNKNOWN_COMPONENT','INVALID_CHANNEL_SELECTION'].includes(e.code));
 await assert.rejects(collectionCheck(undefined,async url=>({ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:'1.1.0-next.1'})})),{code:'INVALID_REGISTRY_IDENTITY'});
});

test('switching one tool channel retains all other installed versions even when newer releases exist',async()=>{
 const first=await collectionCheck(undefined,registry),id=Object.keys(MANIFEST.components)[0];let calls=0;
 const next=await collectionCheck(first,async url=>{calls++;return {ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:url.endsWith('/next')?'2.0.0-next.0':'2.0.0'})};},[],{[id]:'next'});
 assert.equal(calls,1);assert(next.members.filter(m=>m.id!==id).every(m=>m.version==='1.0.0'&&!m.blocked));assert.equal(next.members.find(m=>m.id===id).version,'2.0.0-next.0');
});
