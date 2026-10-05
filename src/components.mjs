import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {MANIFEST,PACKAGE,stateRoot,componentRecords,fail,stat} from './core.mjs';
import {install} from './skill-manager.mjs';
import {npm} from './update.mjs';

const config=id=>{const c=MANIFEST.components[id];if(!c)throw fail('UNKNOWN_COMPONENT',id);return c;};
export async function inspectComponent(id,root){
 root=await fs.realpath(root);
 const c=config(id),p=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 if(p.name!==c.package)throw fail('COMPONENT_IDENTITY_MISMATCH',`${id}: ${p.name}`);
 const entry=path.resolve(root,p.bin?.[c.bin]||'');
 if(!p.bin?.[c.bin]||!entry.startsWith(path.resolve(root)+path.sep))throw fail('INVALID_COMPONENT_ENTRY',id);
 const sources={};
 for(const skill of c.skills){
  const r=spawnSync(process.execPath,[entry,'skill','source','--json'],{encoding:'utf8',timeout:30000,env:{...process.env,TBCLI_UPDATE_CHECK:'0',SYCMCLI_DISABLE_AUTO_UPDATE:'1'}});
  if(r.status!==0)throw fail('COMPONENT_SOURCE_FAILED',r.stderr||id);
  const result=JSON.parse(r.stdout);const s=result.source||(result.skills||[]).find(s=>s.skill===skill)?.source;
  if(!s||!path.resolve(s).startsWith(path.resolve(root)+path.sep))throw fail('INVALID_COMPONENT_SOURCE',skill);
  const text=await fs.readFile(path.join(s,'SKILL.md'),'utf8');
  if(!new RegExp(`^name: ${skill}\\s*$`,'m').test(text))throw fail('SKILL_IDENTITY_MISMATCH',skill);
  sources[skill]=s;
 }
 return {package:p.name,version:p.version,root:path.resolve(root),entry,sources};
}
async function save(records){
 await fs.mkdir(stateRoot(),{recursive:true});const file=path.join(stateRoot(),'components.json'),tmp=file+'.'+randomUUID()+'.pending';
 await fs.writeFile(tmp,JSON.stringify({schema_version:1,components:records},null,2),{flag:'wx',mode:0o600});await fs.rename(tmp,file);
}
async function locked(fn){
 await fs.mkdir(stateRoot(),{recursive:true});const lock=path.join(stateRoot(),'components.lock');
 try{await fs.mkdir(lock);}catch(e){if(e.code==='EEXIST')throw fail('UPDATE_BUSY','Another component operation is running');throw e;}
 try{return await fn();}finally{await fs.rmdir(lock);}
}
export async function registerComponent(opts){
 if(!opts.yes)throw fail('AUTHORIZATION_REQUIRED','Development registration requires --yes');
 return locked(async()=>{const old=componentRecords(),record=await inspectComponent(opts.name,path.resolve(opts.path));
  const backup=path.join(stateRoot(),'component-backups',randomUUID());await fs.mkdir(backup,{recursive:true});await fs.writeFile(path.join(backup,'components.json'),JSON.stringify(old),{flag:'wx'});
  const development=opts.mode!=='npm';await save({...old,[opts.name]:{...record,development}});return {ok:true,component:opts.name,...record,development,backup};});
}
export async function checkComponents(registry=fetch){
 const installed=componentRecords(),components=[];
 for(const [id,c] of Object.entries(MANIFEST.components)){
  if(installed[id]?.development){components.push({id,package:c.package,current:installed[id].version,updateAvailable:false,development:true,updateOwner:'git'});continue;}
  try{const r=await registry(`https://registry.npmjs.org/${encodeURIComponent(c.package)}`,{signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error(`Registry HTTP ${r.status}`);const data=await r.json(),latest=data['dist-tags']?.latest;
   if(!latest||latest.includes('-'))throw Error('No stable latest version');
   components.push({id,package:c.package,current:installed[id]?.version||null,available:latest,updateAvailable:installed[id]?.version!==latest,development:Boolean(installed[id]?.development)});
  }catch(e){components.push({id,package:c.package,current:installed[id]?.version||null,ok:false,code:'REGISTRY_UNAVAILABLE',message:e.message,offline:'keep-current'});}
 }
 return {ok:components.every(c=>c.ok!==false),components};
}
export async function installComponents(opts,services={}){
 if(!opts.yes)throw fail('AUTHORIZATION_REQUIRED','Component installation/update requires --yes');
 if(!opts.agent&&!opts.targetDir)throw fail('USAGE','Specify Agent or target directory');
 return locked(async()=>{
  const old=componentRecords(),check=await (services.check||checkComponents)();if(!check.ok)throw fail('REGISTRY_UNAVAILABLE','No changes made; one or more component checks failed',check);
  const updates=check.components.filter(c=>c.updateAvailable&&!c.development);
  if(updates.length===0)return {ok:true,action:'unchanged',check,skills:await install(opts)};
  const generation=path.join(stateRoot(),'component-generations',randomUUID());await fs.mkdir(generation,{recursive:true});
  await fs.writeFile(path.join(generation,'previous-components.json'),JSON.stringify(old),{flag:'wx'});
  const next={...old};
  try{
   await (services.npm||npm)(['install','--prefix',generation,'--no-audit','--no-fund','--ignore-scripts',...updates.map(c=>`${c.package}@${c.available}`)]);
   for(const c of updates){const r=await inspectComponent(c.id,path.join(generation,'node_modules',...c.package.split('/')));if(r.version!==c.available)throw fail('COMPONENT_VERSION_MISMATCH',c.id);next[c.id]=r;}
   await save(next);
   // The Skill manager backs up changed targets and rolls all Skill changes back on failure.
   const skills=await install(opts);return {ok:true,action:'updated',suiteVersion:PACKAGE.version,components:updates,skills,backup:path.join(generation,'previous-components.json')};
  }catch(e){await save(old);throw e;}
 });
}
