import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {PACKAGE,source,nodeVersion,closure,json,stat,fileHashes,digest,fail,stateRoot} from './core.mjs';

const OWNER='.taobao-ai-ops-managed.json';
export function targetRoot(opts){
 if(opts.targetDir&&opts.agent)throw fail('USAGE','Choose --agent or --target-dir');
 if(opts.targetDir)return path.resolve(opts.targetDir);
 if(opts.agent==='codex')return path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'skills');
 if(opts.agent==='workbuddy')return process.env.WORKBUDDY_SKILLS_DIR||path.join(process.env.WORKBUDDY_HOME||path.join(os.homedir(),'.workbuddy'),'skills');
 if(opts.agent==='agents')return process.env.AGENT_SKILLS_DIR||path.join(os.homedir(),'.agents','skills');
 if(opts.agent==='sealseek'){
  if(process.env.SEALSEEK_SKILLS_DIR)return path.resolve(process.env.SEALSEEK_SKILLS_DIR);
  const home=process.env.SEALSEEK_HOME||path.join(os.homedir(),'.sealseek');
  const choices=[path.join(home,'workspaces','default','skills'),path.join(home,'workspace','skills')].filter(p=>{try{return osExists(p);}catch{return false;}});
  if(choices.length!==1)throw fail('TARGET_UNRESOLVED','Set SEALSEEK_SKILLS_DIR or --target-dir to the active SealSeek Skill root');
  return choices[0];
 }
 throw fail('UNKNOWN_AGENT','Choose codex, agents, sealseek, workbuddy or --target-dir');
}
import {existsSync as osExists} from 'node:fs';
async function owners(root){const p=path.join(root,OWNER);if(!await stat(p))return {package:PACKAGE.name,skills:{}};const value=await json(p);if(value.package!==PACKAGE.name)throw fail('OWNERSHIP_CONFLICT','Suite ownership file belongs to another package');return value;}
export async function status(root,n){
 const dest=path.join(root,n.skill),files=await fileHashes(source(n));const base={skill:n.skill,node:n.id,source:source(n),destination:dest,sourceDigest:digest(files),version:nodeVersion(n)};
 const s=await stat(dest);if(!s)return {...base,state:'absent',managed:false};
 const own=(await owners(root)).skills[n.skill];
 if(s.isSymbolicLink()){
  const link=path.resolve(root,await fs.readlink(dest));const resolved=await fs.realpath(dest).catch(()=>null);
  const current=resolved===await fs.realpath(source(n));
  const managed=current||(own&&own.source===link);
  return {...base,mode:'link',managed:Boolean(managed),state:current?'current':managed?'stale':resolved?'foreign-link':'broken-link'};
 }
 const meta=await json(path.join(dest,'.suite-install.json')).catch(()=>null);
 if(meta?.package!==PACKAGE.name||meta.skill!==n.skill)return {...base,mode:'copy',state:'unmanaged',managed:false};
 const actual=await fileHashes(dest);
 const same=JSON.stringify(actual)===JSON.stringify(meta.files);
 return {...base,mode:'copy',managed:true,state:!same?'modified':meta.sourceDigest===base.sourceDigest?'current':'stale'};
}
async function makeCopy(dest,n){
 const files=await fileHashes(source(n));await fs.mkdir(dest,{recursive:true});
 for(const relative of Object.keys(files)){const d=path.join(dest,relative);await fs.mkdir(path.dirname(d),{recursive:true});await fs.copyFile(path.join(source(n),relative),d);}
 await fs.writeFile(path.join(dest,'.suite-install.json'),JSON.stringify({package:PACKAGE.name,skill:n.skill,version:nodeVersion(n),sourceDigest:digest(files),files}),{flag:'wx'});
 await fs.writeFile(path.join(dest,'.install-meta.json'),JSON.stringify({title:n.skill,description:`Taobao AI operations: ${n.id}`}),{flag:'wx'});
}
async function restore(backup,dest,inPlace){
 if(inPlace){for(const e of await fs.readdir(dest))await fs.rm(path.join(dest,e),{recursive:true,force:true});await fs.cp(backup,dest,{recursive:true});}
 else{if(await stat(dest))await fs.rm(dest,{recursive:true,force:true});await fs.rename(backup,dest);}
}
export async function install(opts,options={}){
 const root=targetRoot(opts),nodes=closure(opts);await fs.mkdir(root,{recursive:true});
 const lock=path.join(root,'.taobao-ai-ops-lock');try{await fs.mkdir(lock);}catch(e){if(e.code==='EEXIST')throw fail('INSTALL_BUSY','Another suite install holds the target lock');throw e;}
 const old=await owners(root).catch(async e=>{await fs.rmdir(lock);throw e;});const changed=[];const results=[];
 let transaction;
 try{
  const before=await Promise.all(nodes.map(n=>status(root,n)));
  for(const item of before){if(item.state==='modified')throw fail('LOCAL_CHANGES',`Preserve local edits before updating ${item.skill}`);if(!['absent','current','stale'].includes(item.state)&&!opts.adopt)throw fail('UNMANAGED_TARGET',`Use an explicit backed-up migration for ${item.skill} (${item.state})`);}
  transaction=path.join(stateRoot(),'skill-backups',randomUUID());await fs.mkdir(transaction,{recursive:true});
  for(let i=0;i<nodes.length;i++){
   const n=nodes[i],item=before[i];
   if(item.state==='current'){results.push({...item,action:'unchanged'});continue;}
   const dest=item.destination,backup=path.join(transaction,n.skill);let inPlace=false;
   if(await stat(dest)){
    if(options.forceInPlace&&item.mode==='copy')inPlace=true;
    else try{await fs.rename(dest,backup);}catch(e){if(!['EPERM','EBUSY','EACCES'].includes(e.code)||(await stat(dest)).isSymbolicLink())throw e;inPlace=true;}
    if(inPlace)await fs.cp(dest,backup,{recursive:true,errorOnExist:true,force:false});
   }
   const record={dest,backup:await stat(backup)?backup:null,inPlace};changed.push(record);
   const mode=item.mode==='copy'&&item.managed?'copy':(opts.mode||'auto')==='auto'?(process.platform==='win32'?'copy':'link'):opts.mode;
   if(!['link','copy'].includes(mode))throw fail('USAGE','Mode must be auto, link or copy');
   if(inPlace){for(const e of await fs.readdir(dest))await fs.rm(path.join(dest,e),{recursive:true,force:true});}
   if(mode==='link')await fs.symlink(source(n),dest,process.platform==='win32'?'junction':'dir');else await makeCopy(dest,n);
   if(mode==='copy'&&record.backup){const ui=path.join(record.backup,'.install-meta.json');if(await stat(ui))await fs.copyFile(ui,path.join(dest,'.install-meta.json'));}
   const after=await status(root,n);if(after.state!=='current')throw fail('INSTALL_VERIFY_FAILED',`Skill verification failed: ${n.skill}`);
   old.skills[n.skill]={source:source(n),version:nodeVersion(n),digest:after.sourceDigest,mode,backup:record.backup};
   results.push({...after,action:item.state==='absent'?'installed':item.managed?'updated':'adopted',backup:record.backup,strategy:inPlace?'in-place':'rename'});
   if(options.failAfter===changed.length)throw fail('TEST_INJECTED_FAILURE','Injected migration failure');
  }
  const ownerPath=path.join(root,OWNER);if(await stat(ownerPath))await fs.copyFile(ownerPath,path.join(transaction,'previous-owner.json'));
  await fs.writeFile(path.join(transaction,'transaction.json'),JSON.stringify({package:PACKAGE.name,root,results},null,2),{flag:'wx'});
  const pending=path.join(root,`${OWNER}.${randomUUID()}.pending`);await fs.writeFile(pending,JSON.stringify(old,null,2),{flag:'wx'});await fs.rename(pending,ownerPath);
  const registry=path.join(stateRoot(),'skill-targets');await fs.mkdir(registry,{recursive:true});
  const registration=path.join(registry,createHash('sha256').update(root).digest('hex')+'.json');
  if(!await stat(registration))await fs.writeFile(registration,JSON.stringify({root}),{flag:'wx'});
  return {ok:true,package:PACKAGE.name,version:PACKAGE.version,targetRoot:root,transaction,skills:results};
 }catch(e){for(const item of changed.reverse()){if(item.backup)await restore(item.backup,item.dest,item.inPlace);else if(await stat(item.dest))await fs.rm(item.dest,{recursive:true,force:true});}throw e;}
 finally{await fs.rmdir(lock);}
}
