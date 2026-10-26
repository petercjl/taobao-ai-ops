import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,PACKAGE,MANIFEST,fail,stat,fileHashes} from './core.mjs';

const stable=v=>typeof v==='string'&&/^\d+\.\d+\.\d+$/.test(v);
export function compatible(current,next){
 if(!stable(current)||!stable(next))return false;
 const a=current.split('.').map(Number),b=next.split('.').map(Number);
 return a[0]===b[0]&&(a[0]!==0||a[1]===b[1])&&next.localeCompare(current,undefined,{numeric:true})>=0;
}
export async function collectionCheck(previous,registry=fetch){
 if(previous&&(previous.package!==PACKAGE.name||!Array.isArray(previous.members)||!stable(previous.version)))throw fail('INVALID_PREVIOUS_COLLECTION','Previous receipt must belong to this collection');
 const members=[];
 for(const [id,c] of Object.entries(MANIFEST.components)){
  const response=await registry(`https://registry.npmjs.org/${encodeURIComponent(c.package)}/latest`,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw fail('REGISTRY_UNAVAILABLE',`${c.package}: HTTP ${response.status}; keep current collection`);
  const metadata=await response.json();
  if(metadata.name!==c.package||!stable(metadata.version))throw fail('INVALID_REGISTRY_IDENTITY',c.package);
  const old=previous?.members?.find(m=>m.package===c.package);
  const accepted=!old||compatible(old.version,metadata.version);
  members.push({id,package:c.package,version:accepted?metadata.version:old.version,available:metadata.version,
   bin:c.bin,skills:c.skills,blocked:!accepted});
 }
 const changed=previous?.version!==PACKAGE.version||JSON.stringify(members.map(m=>[m.id,m.package,m.version,m.skills]))!==JSON.stringify(previous?.members?.map(m=>[m.id,m.package,m.version,m.skills]));
 return {ok:true,schemaVersion:1,package:PACKAGE.name,version:PACKAGE.version,changed,members};
}
export const maintenanceEnvironment=()=>({...process.env,AGENT_PACKAGE_UPDATE_CHECK:'0',TAOBAO_AI_OPS_AUTO_UPDATE:'0',TBCLI_UPDATE_CHECK:'0',SYCMCLI_DISABLE_AUTO_UPDATE:'1',SEEDAUDIO_AUTO_UPDATE:'0',SEALSEEK_MEDIA_AUTO_UPDATE:'0',COMPETITOR_CANVAS_AUTO_UPDATE:'0'});
async function run(command,args,timeout=300000){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{env:maintenanceEnvironment(),stdio:['ignore','pipe','pipe'],windowsHide:true});
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
 const argv=collection?.enumeration?.argv||['skill','source','--json'];
 const raw=JSON.parse(await run(process.execPath,[entry,...argv],45000));
 const data=raw.data??raw;if(raw.ok===false)throw fail('COMPONENT_SOURCE_FAILED',member.package);
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
// Creates a whole host-owned candidate. The host alone activates it or deletes it.
// Ordinary business calls never replace this graph underneath an active task.
export async function collectionPrepare(opts,services={}){
 if(!opts.yes||!opts.directory)throw fail('USAGE','collection prepare requires --directory and --yes');
 const directory=path.resolve(opts.directory);
 if(await stat(directory))throw fail('TARGET_EXISTS','Candidate directory must be new');
 const previous=opts.previous?JSON.parse(await fs.readFile(opts.previous,'utf8')):undefined;
 const plan=await collectionCheck(previous,services.registry);
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 try{
  const shell=path.join(directory,'shell'),runtime=path.join(directory,'runtime'),skills=path.join(directory,'skills');
  await fs.cp(ROOT,shell,{recursive:true,filter:p=>!['node_modules','.git','dev','test','.qa-skills'].includes(path.basename(p))});
  await fs.mkdir(runtime);await fs.mkdir(skills);
  const npmCli=process.env.npm_execpath;
  if(!npmCli?.endsWith('npm-cli.js'))throw fail('NPM_UNAVAILABLE','Host must supply its managed npm-cli.js in npm_execpath');
  await (services.run??run)(process.execPath,[npmCli,'install','--prefix',runtime,'--ignore-scripts','--no-audit','--no-fund','--package-lock=true',...plan.members.map(m=>`${m.package}@${m.version}`)],600000);
  const installed=[],records={};
  async function copySkill(name,source,entry,member){
   if(installed.some(s=>s.name===name))throw fail('DUPLICATE_SKILL',name);
   const destination=path.join(skills,name);await fileHashes(source);await fs.cp(source,destination,{recursive:true,dereference:true});
   installed.push({name,package:member.package,version:member.version,source,directory:destination,runtimeEntry:entry});
  }
  for(const member of plan.members){
   const root=path.join(runtime,'node_modules',...member.package.split('/'));
   const identity=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
   if(identity.name!==member.package||identity.version!==member.version)throw fail('COMPONENT_IDENTITY_MISMATCH',member.package);
   const entry=within(root,typeof identity.bin==='string'?identity.bin:identity.bin?.[member.bin]??'');
   await fs.access(entry);
   const sources=await readSources(entry,root,member);
   records[member.id]={package:member.package,version:member.version,root,entry,sources:Object.fromEntries(sources.map(s=>[s.name,s.source]))};
   for(const s of sources)await copySkill(s.name,s.source,entry,member);
  }
  await copySkill('taobao-ai-operations',path.join(shell,'skills','taobao-ai-operations'),path.join(shell,'bin','taobao-ai-ops.mjs'),{package:PACKAGE.name,version:PACKAGE.version});
  const state=path.join(directory,'state');await fs.mkdir(state);
  await fs.writeFile(path.join(state,'components.json'),JSON.stringify({schema_version:1,components:records}),{flag:'wx',mode:0o600});
  const receipt={...plan,skillsDirectory:skills,skills:installed,environment:{TAOBAO_AI_OPS_STATE_DIR:state,TAOBAO_AI_OPS_AUTO_UPDATE:'0',AGENT_PACKAGE_UPDATE_CHECK:'0'}};
  for(const skill of installed)await fs.writeFile(path.join(skill.directory,'.collection-runtime.json'),JSON.stringify({runtimeEntry:skill.runtimeEntry,environment:receipt.environment,package:skill.package,version:skill.version}),{flag:'wx',mode:0o600});
  await fs.writeFile(path.join(directory,'collection.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
  await fs.writeFile(path.join(directory,'integrity.json'),JSON.stringify(await fileHashes(skills)),{flag:'wx',mode:0o600});
  return receipt;
 }catch(error){await fs.rm(directory,{recursive:true,force:true});throw error;}
}
