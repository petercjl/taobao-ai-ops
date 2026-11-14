import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {materializeComponentSkill} from './component-skill-install.mjs';
import {componentEnvironment} from './runtime.mjs';
import {ROOT,PACKAGE,MANIFEST,fail,stat,fileHashes} from './core.mjs';

const stable=v=>typeof v==='string'&&/^\d+\.\d+\.\d+$/.test(v);
export function compatible(current,next){
 if(!stable(current)||!stable(next))return false;
 const a=current.split('.').map(Number),b=next.split('.').map(Number);
 return a[0]===b[0]&&(a[0]!==0||a[1]===b[1])&&next.localeCompare(current,undefined,{numeric:true})>=0;
}
const semver=v=>typeof v==='string'&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/.test(v);
export function compareVersions(a,b){
 if(!semver(a)||!semver(b))throw fail('INVALID_VERSION','Expected exact semantic versions');
 const [baseA,preA]=a.split(/-(.*)/s),[baseB,preB]=b.split(/-(.*)/s);
 const x=baseA.split('.'),y=baseB.split('.');for(let i=0;i<3;i++)if(BigInt(x[i])!==BigInt(y[i]))return BigInt(x[i])>BigInt(y[i])?1:-1;
 if(preA===preB)return 0;if(preA===undefined)return 1;if(preB===undefined)return -1;
 const left=preA.split('.'),right=preB.split('.');for(let i=0;i<Math.max(left.length,right.length);i++){if(left[i]===undefined)return -1;if(right[i]===undefined)return 1;if(left[i]===right[i])continue;const n=/^\d+$/.test(left[i]),m=/^\d+$/.test(right[i]);if(n&&m)return BigInt(left[i])>BigInt(right[i])?1:-1;if(n!==m)return n?-1:1;return left[i]>right[i]?1:-1;}return 0;
}
export function componentChannels(value={}){
 let channels=value;if(typeof value==='string'){try{channels=JSON.parse(value);}catch{throw fail('INVALID_CHANNEL_SELECTION','Expected a JSON object of component ids to latest/next');}}
 if(!channels||typeof channels!=='object'||Array.isArray(channels))throw fail('INVALID_CHANNEL_SELECTION','Expected component channel mapping');
 for(const [id,channel] of Object.entries(channels)){if(!Object.hasOwn(MANIFEST.components,id))throw fail('UNKNOWN_COMPONENT',id);if(!['latest','next'].includes(channel))throw fail('INVALID_CHANNEL_SELECTION',id);}
 return channels;
}
export async function collectionCheck(previous,registry=fetch,approved=[],channelSelection={}){
 const requested=componentChannels(channelSelection);
 const selected=new Set(typeof approved==='string'?approved.split(',').map(x=>x.trim()).filter(Boolean):approved);
 for(const id of selected)if(!Object.hasOwn(MANIFEST.components,id))throw fail('UNKNOWN_COMPONENT',id);
 if(previous&&(previous.package!==PACKAGE.name||!Array.isArray(previous.members)||!stable(previous.version)))throw fail('INVALID_PREVIOUS_COLLECTION','Previous receipt must belong to this collection');
 const members=[];
 for(const [id,c] of Object.entries(MANIFEST.components)){
  const old=previous?.members?.find(m=>m.package===c.package);
  const channel=requested[id]??old?.channel??'latest';if(!['latest','next'].includes(channel))throw fail('INVALID_CHANNEL_SELECTION',id);
  const channelSwitch=Boolean(old&&Object.hasOwn(requested,id)&&channel!==(old.channel??'latest'));
  if(old&&Object.keys(requested).length&&!Object.hasOwn(requested,id)){members.push({id,package:c.package,version:old.version,available:old.version,bin:c.bin,skills:c.skills,channel,requestedChannel:channel,blocked:false,explicitMigration:false,channelSwitch:false});continue;}
  const response=await registry(`https://registry.npmjs.org/${encodeURIComponent(c.package)}/${channel}`,{signal:AbortSignal.timeout(15000)});
  if(response.status===404&&channel==='next')throw fail('CHANNEL_UNAVAILABLE',`${c.package} has no next release; keep current collection`);
  if(!response.ok)throw fail('REGISTRY_UNAVAILABLE',`${c.package}: HTTP ${response.status}; keep current collection`);
  const metadata=await response.json();
  if(metadata.name!==c.package||!(channel==='latest'?stable(metadata.version):semver(metadata.version)))throw fail('INVALID_REGISTRY_IDENTITY',c.package);
  const explicitMigration=Boolean(old&&selected.has(id)&&compareVersions(metadata.version,old.version)>=0);
  const compatibleNext=Boolean(old&&channel==='next'&&semver(old.version)&&compareVersions(metadata.version,old.version)>=0&&compatible(old.version.split('-')[0],metadata.version.split('-')[0]));
  const accepted=!old||compatible(old.version,metadata.version)||compatibleNext||explicitMigration||channelSwitch;
  members.push({id,package:c.package,version:accepted?metadata.version:old.version,available:metadata.version,
   bin:c.bin,skills:c.skills,channel:accepted?channel:(old.channel??'latest'),requestedChannel:channel,blocked:!accepted,explicitMigration,channelSwitch});
 }
 const changed=previous?.version!==PACKAGE.version||JSON.stringify(members.map(m=>[m.id,m.package,m.version,m.skills,m.channel??'latest']))!==JSON.stringify(previous?.members?.map(m=>[m.id,m.package,m.version,m.skills,m.channel??'latest']));
 return {ok:true,schemaVersion:1,package:PACKAGE.name,version:PACKAGE.version,changed,members};
}
export const maintenanceEnvironment=()=>({...process.env,AGENT_PACKAGE_UPDATE_CHECK:'0',AIGC_REVIEW_UPDATE_CHECK:'0',TAOBAO_AI_OPS_AUTO_UPDATE:'0',TBCLI_UPDATE_CHECK:'0',SYCMCLI_DISABLE_AUTO_UPDATE:'1',SEEDAUDIO_AUTO_UPDATE:'0',SEALSEEK_MEDIA_AUTO_UPDATE:'0',COMPETITOR_CANVAS_AUTO_UPDATE:'0'});
async function run(command,args,timeout=300000,cwd){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,env:maintenanceEnvironment(),stdio:['ignore','pipe','pipe'],windowsHide:true});
  let output='',error='';
  child.stdout.on('data',b=>{output+=b;if(output.length>8_000_000)child.kill();});
  child.stderr.on('data',b=>{error=(error+b).slice(-4000);});
  const timer=setTimeout(()=>child.kill(),timeout);
  child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(fail('COLLECTION_CHILD_FAILED',`Command exited ${code}`,{entry:command,args:args.slice(0,4),diagnostic:error}));});
 });
}
function within(root,value){const p=path.resolve(root,value),r=path.relative(root,p);if(!r||r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw fail('UNSAFE_COMPONENT_PATH',value);return p;}
export async function readSources(entry,root,member){
 root=await fs.realpath(root);
 let capabilities={};
 try{capabilities=JSON.parse(await fs.readFile(path.join(root,'capabilities.json'),'utf8'));}catch{}
 const collection=capabilities.discoveryContract?.skillCollection;
 if(member.kind==='application-skill'&&(!collection||capabilities.maintenanceContract?.schemaVersion!==1||capabilities.version!==JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version))throw fail('MAINTENANCE_CONTRACT_MISSING',member.package);
 const argv=collection?.enumeration?.argv||['skill','source','--json'];
 const raw=JSON.parse(await run(process.execPath,[entry,...argv],45000));
 const data=raw.data??raw;if(raw.ok===false)throw fail('COMPONENT_SOURCE_FAILED',member.package);
 if(collection?.enumeration?.completeField&&data[collection.enumeration.completeField]!==true)throw fail('INCOMPLETE_COMPONENT_SOURCES',member.package);
 const items=data[collection?.enumeration?.itemsField||'sources']??data.skills??(data.source?[data]:[]);
 const discovered=items.filter(s=>s&&typeof s==='object');
 const result=[];
 for(const item of discovered){
  const name=item.skill??item.name??(discovered.length===1&&member.skills.length===1?member.skills[0]:undefined);
  if(typeof name!=='string'||!/^[a-z0-9][a-z0-9-]{1,99}$/.test(name))throw fail('INVALID_SKILL_IDENTITY',member.package);
  let source;try{source=await fs.realpath(item.source??item.path);within(root,source);}catch{throw fail('INVALID_COMPONENT_SOURCE',name);}
  const real=await fs.realpath(source);within(await fs.realpath(root),real);
  const text=(await fs.readFile(path.join(source,'SKILL.md'),'utf8')).replace(/\r\n?/g,'\n');
  if(!new RegExp(`^name:\\s*${name}\\s*$`,'m').test(text))throw fail('SKILL_IDENTITY_MISMATCH',`${member.package}: ${name}`);
  result.push({name,source});
 }
 for(const name of member.skills)if(!result.some(s=>s.name===name))throw fail('INCOMPLETE_COMPONENT_SOURCES',`${member.package}: ${name}`);
 return result;
}
async function runtimeSeed(previousFile, previous, runtime){
 if(!previousFile||!previous||process.env.SEALWORK_COLLECTION_FRESH_RUNTIME==='1')return;
 const priorRuntime=path.join(path.dirname(path.resolve(previousFile)),'runtime');
 const modules=path.join(priorRuntime,'node_modules');
 const lockFile=path.join(priorRuntime,'package-lock.json');
 const lock=await fs.readFile(lockFile,'utf8').then(JSON.parse).catch(error=>{
  if(error.code!=='ENOENT')throw error;
 });
 if(lock?.lockfileVersion!==3||!lock.packages?.['']?.dependencies||!(await stat(modules))?.isDirectory())return;
 for(const member of previous.members){
  if(lock.packages[`node_modules/${member.package}`]?.version!==member.version)return;
  const installed=await fs.readFile(within(modules,path.join(modules,member.package,'package.json')),'utf8').then(JSON.parse).catch(error=>{
   if(error.code!=='ENOENT')throw error;
  });
  if(installed?.name!==member.package||installed?.version!==member.version)return;
 }
 const candidateModules=path.join(runtime,'node_modules');
 await fs.cp(modules,candidateModules,{recursive:true,verbatimSymlinks:true,mode:constants.COPYFILE_FICLONE});
 // Archive aliases on the previous update's loopback gateway have expired.
 function forgetExpiredGateway(lockfile){
  for(const entry of Object.values(lockfile.packages??{})){
   if(typeof entry.resolved==='string'&&/^http:\/\/127\.0\.0\.1:\d+\//.test(entry.resolved))delete entry.resolved;
  }
  return JSON.stringify(lockfile);
 }
 await fs.writeFile(path.join(runtime,'package-lock.json'),forgetExpiredGateway(lock),{flag:'wx',mode:0o600});
 const hidden=path.join(candidateModules,'.package-lock.json');
 if(await stat(hidden)){
  const lockfile=JSON.parse(await fs.readFile(hidden,'utf8'));
  await fs.rm(hidden);
  await fs.writeFile(hidden,forgetExpiredGateway(lockfile),{flag:'wx',mode:0o600});
 }
 return Object.fromEntries(previous.members.map(member=>[member.package,member.version]));
}
// Creates a whole host-owned candidate. The host alone activates it or deletes it.
// Ordinary business calls never replace this graph underneath an active task.
export async function collectionPrepare(opts,services={}){
 if(!opts.yes||!opts.directory)throw fail('USAGE','collection prepare requires --directory and --yes');
 const directory=path.resolve(opts.directory);
 if(await stat(directory))throw fail('TARGET_EXISTS','Candidate directory must be new');
 const previous=opts.previous?JSON.parse(await fs.readFile(opts.previous,'utf8')):undefined;
 const plan=await collectionCheck(previous,services.registry,opts.acceptComponentUpgrades,opts.componentChannels);
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 try{
  const shell=path.join(directory,'shell'),runtime=path.join(directory,'runtime'),skills=path.join(directory,'skills');
  await fs.cp(ROOT,shell,{recursive:true,filter:p=>!['node_modules','.git','dev','test','.qa-skills'].includes(path.basename(p))});
  await fs.mkdir(runtime);await fs.mkdir(skills);
  const npmCli=process.env.npm_execpath;
  if(!npmCli?.endsWith('npm-cli.js'))throw fail('NPM_UNAVAILABLE','Host must supply its managed npm-cli.js in npm_execpath');
  const dependencies=Object.fromEntries(plan.members.map(member=>[member.package,member.version]));
  const seeded=await runtimeSeed(opts.previous,previous,runtime);
  await fs.writeFile(path.join(runtime,'package.json'),JSON.stringify({private:true,dependencies}),{flag:'wx',mode:0o600});
  const changed=Object.keys(seeded??{}).length!==plan.members.length||plan.members.some(member=>seeded?.[member.package]!==member.version);
  if(changed||!seeded)await (services.run??run)(process.execPath,[npmCli,'install','--ignore-scripts','--save-exact','--no-update-notifier','--no-audit','--no-fund','--package-lock=true'],600000,await fs.realpath(runtime));
  const installed=[],records={};
  async function copySkill(name,source,entry,member){
   if(installed.some(s=>s.name===name))throw fail('DUPLICATE_SKILL',name);
   const destination=path.join(skills,name);await fileHashes(source);
   const managed=MANIFEST.components[member.id]?.skill_installation==='component-managed';
   const receipt=managed?await materializeComponentSkill(records[member.id],name,destination):null;
   if(!managed)await fs.cp(source,destination,{recursive:true,dereference:true});
   const runtimeEntry=receipt?.entry??entry;
   if(typeof runtimeEntry!=='string'||!runtimeEntry||!(await fs.lstat(runtimeEntry)).isFile())throw fail('INVALID_COMPONENT_ENTRY',name);
   within(await fs.realpath(directory),await fs.realpath(runtimeEntry));
   installed.push({name,package:member.package,version:member.version,source,directory:destination,runtimeEntry});
  }
  for(const member of plan.members){
   const root=path.join(runtime,'node_modules',...member.package.split('/'));
   const identity=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
   if(identity.name!==member.package||identity.version!==member.version)throw fail('COMPONENT_IDENTITY_MISMATCH',member.package);
   const component=MANIFEST.components[member.id];
   const entry=within(root,typeof identity.bin==='string'?identity.bin:identity.bin?.[member.bin]??'');
   if(!(await fs.lstat(entry)).isFile())throw fail('INVALID_COMPONENT_ENTRY',member.id);
   const sources=await readSources(entry,root,component);
   records[member.id]={package:member.package,version:member.version,root,entry,sources:Object.fromEntries(sources.map(s=>[s.name,s.source]))};
   for(const s of sources)await copySkill(s.name,s.source,entry,member);
  }
  await copySkill('taobao-ai-operations',path.join(shell,'skills','taobao-ai-operations'),path.join(shell,'bin','taobao-ai-ops.mjs'),{package:PACKAGE.name,version:PACKAGE.version});
  const state=path.join(directory,'state');await fs.mkdir(state);
  await fs.writeFile(path.join(state,'components.json'),JSON.stringify({schema_version:1,components:records}),{flag:'wx',mode:0o600});
  const receipt={...plan,skillsDirectory:skills,skills:installed,environment:{TAOBAO_AI_OPS_STATE_DIR:state,TAOBAO_AI_OPS_AUTO_UPDATE:'0',AGENT_PACKAGE_UPDATE_CHECK:'0',AIGC_REVIEW_UPDATE_CHECK:'0'}};
  for(const skill of installed){
   const environment=skill.package===MANIFEST.components['dmp-product-report']?.package?componentEnvironment('dmp-product-report',receipt.environment,records):receipt.environment;
   await fs.writeFile(path.join(skill.directory,'.collection-runtime.json'),JSON.stringify({runtimeEntry:skill.runtimeEntry,environment,package:skill.package,version:skill.version}),{flag:'wx',mode:0o600});
  }
  await fs.writeFile(path.join(directory,'collection.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
  await fs.writeFile(path.join(directory,'integrity.json'),JSON.stringify(await fileHashes(skills)),{flag:'wx',mode:0o600});
  return receipt;
 }catch(error){await fs.rm(directory,{recursive:true,force:true});throw error;}
}
