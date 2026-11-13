import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {materializeComponentSkill} from './component-skill-install.mjs';
import {ROOT,MANIFEST,componentRecord,PACKAGE,source,nodeVersion,closure,json,stat,fileHashes,digest,fail,stateRoot} from './core.mjs';

const OWNER='.taobao-ai-ops-managed.json';
const runtimeItems=['package.json','capabilities.json','suite-manifest.json','sealwork.collection.json','INSTALL.md','UPDATE.md','bin','src','contracts','skills'];
async function runtimeDigest(){const files={};for(const item of runtimeItems){const p=path.join(ROOT,item);if((await fs.stat(p)).isDirectory()){for(const [name,value]of Object.entries(await fileHashes(p)))files[item+'/'+name]=value;}else files[item]=digest({bytes:(await fs.readFile(p)).toString('base64')});}return digest(files);}
const legacyTargets=JSON.parse(await fs.readFile(new URL('../contracts/legacy-host-targets.json',import.meta.url),'utf8'));
export function targetRoot(opts){
 if(opts.agent&&!/^[a-z][a-z0-9-]{0,63}$/.test(opts.agent))throw fail('INVALID_AGENT','Use a valid Agent identifier');
 if(opts.targetDir)return path.resolve(opts.targetDir);
 const adapter=legacyTargets[opts.agent];
 if(!adapter)throw fail('UNKNOWN_AGENT','Resolve the current host Skill parent and pass --target-dir');
 if(adapter.directoryEnv&&process.env[adapter.directoryEnv])return path.resolve(process.env[adapter.directoryEnv]);
 const home=adapter.env&&process.env[adapter.env]||path.join(os.homedir(),adapter.home);
 if(adapter.choices){const choices=adapter.choices.map(p=>path.join(home,p)).filter(osExists);if(choices.length!==1)throw fail('TARGET_UNRESOLVED','Pass the resolved current host Skill parent with --target-dir');return choices[0];}
 return path.join(home,adapter.append);
}
import {existsSync as osExists} from 'node:fs';
async function owners(root){const p=path.join(root,OWNER);if(!await stat(p))return {package:PACKAGE.name,skills:{}};const value=await json(p);if(value.package!==PACKAGE.name)throw fail('OWNERSHIP_CONFLICT','Suite ownership file belongs to another package');return value;}
async function legacyStatus(root,n){
 const dest=path.join(root,n.skill),files=await fileHashes(source(n));const base={skill:n.skill,node:n.id,source:source(n),destination:dest,sourceDigest:digest(files),version:nodeVersion(n)};
 const s=await stat(dest);if(!s)return {...base,state:'absent',managed:false};
 const own=(await owners(root)).skills[n.skill];
 if(s.isSymbolicLink()){
  const link=path.resolve(root,await fs.readlink(dest));const resolved=await fs.realpath(dest).catch(()=>null);
  const current=resolved===await fs.realpath(source(n));
  const managed=current||(own&&own.source===link);
  return {...base,mode:'link',managed:Boolean(managed),state:managed?'stale':resolved?'foreign-link':'broken-link'};
 }
 const meta=await json(path.join(dest,'.suite-install.json')).catch(()=>null);
 if(meta?.package!==PACKAGE.name||meta.skill!==n.skill)return {...base,mode:'copy',state:'unmanaged',managed:false};
 const actual=await fileHashes(dest);
 const same=JSON.stringify(actual)===JSON.stringify(meta.files);
 return {...base,mode:'copy',managed:true,state:!same?'modified':meta.sourceDigest===base.sourceDigest&&meta.version===base.version&&(n.component||meta.runtimeDigest===await runtimeDigest())?'current':'stale'};
}
export async function status(root,n){
 const value=await legacyStatus(root,n);
 const current=value.state==='current',installed=value.state!=='absent',edited=value.state==='modified';
 return {...value,ok:true,package:PACKAGE.name,suiteVersion:PACKAGE.version,installed,current,edited,verification:{verified:current,algorithm:'sha256'},recovery:{required:false},hostDiscovery:'pending',runtimeEntry:!n.component?path.join(value.destination,'.runtime','bin','taobao-ai-ops.mjs'):undefined};
}
async function ownRuntime(dest){
 const target=path.join(dest,'.runtime');await fs.mkdir(target);
 for(const item of runtimeItems)await fs.cp(new URL('../'+item,import.meta.url),path.join(target,item),{recursive:true,errorOnExist:true,force:false});
}
async function makeCopy(dest,n){
 const canonical=await fileHashes(source(n));
 if(MANIFEST.components[n.component]?.skill_installation==='component-managed')await materializeComponentSkill(componentRecord(n.component),n.skill,dest);
 else{await fs.mkdir(dest,{recursive:true});for(const relative of Object.keys(canonical)){const d=path.join(dest,relative);await fs.mkdir(path.dirname(d),{recursive:true});await fs.copyFile(path.join(source(n),relative),d);}}
 if(!n.component)await ownRuntime(dest);
 const files=await fileHashes(dest);
 await fs.writeFile(path.join(dest,'.suite-install.json'),JSON.stringify({package:PACKAGE.name,skill:n.skill,version:nodeVersion(n),sourceDigest:digest(canonical),runtimeDigest:n.component?undefined:await runtimeDigest(),files}),{flag:'wx'});
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
  transaction=path.join(stateRoot(),'skill-backups',randomUUID());await fs.mkdir(transaction,{recursive:true,mode:0o700});
  for(let i=0;i<nodes.length;i++){
   const n=nodes[i],item=before[i];
   if(item.state==='current'){results.push({...item,action:'unchanged'});continue;}
   const dest=item.destination,backup=path.join(transaction,n.skill);let inPlace=false,linkSnapshot=null;
   if(await stat(dest)){
    if(options.forceInPlace&&item.mode==='copy')inPlace=true;
    else try{await (options.rename??fs.rename)(dest,backup);}catch(e){
     const old=await stat(dest);
     if(e.code==='EXDEV'&&old.isSymbolicLink()){
      const raw=await fs.readlink(dest),target=await fs.realpath(dest),kind=process.platform==='win32'?'junction':'dir';
      await fs.symlink(target,backup,kind);
      if(await fs.realpath(backup)!==target)throw fail('BACKUP_VERIFY_FAILED','Link backup differs from original');
      linkSnapshot={raw,target,kind};
      await fs.writeFile(backup+'.link.json',JSON.stringify(linkSnapshot),{flag:'wx',mode:0o600});
      await fs.unlink(dest);
     }else{if(!['EPERM','EBUSY','EACCES','EXDEV'].includes(e.code)||old.isSymbolicLink())throw e;inPlace=true;}
    }
    if(inPlace){await fs.cp(dest,backup,{recursive:true,errorOnExist:true,force:false});if(digest(await fileHashes(dest))!==digest(await fileHashes(backup)))throw fail('BACKUP_VERIFY_FAILED','Backup differs from the current Skill; preserving original target');}
   }
   const record={dest,backup:await stat(backup)?backup:null,inPlace,linkSnapshot};changed.push(record);
   if(opts.mode&&!['auto','copy','link'].includes(opts.mode))throw fail('USAGE','Mode must be auto, copy or legacy link');
   const mode='copy';
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
 }catch(e){for(const item of changed.reverse()){if(item.linkSnapshot){if(await stat(item.dest))await fs.rm(item.dest,{recursive:true,force:true});await fs.symlink(item.linkSnapshot.raw,item.dest,item.linkSnapshot.kind);}else if(item.backup)await restore(item.backup,item.dest,item.inPlace);else if(await stat(item.dest))await fs.rm(item.dest,{recursive:true,force:true});}throw e;}
 finally{await fs.rmdir(lock);}
}
