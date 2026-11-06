import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fail,MANIFEST} from './core.mjs';

// Components own materialization. The suite validates their declared contract
// and uses the returned target-owned entry in its host receipt.
export async function materializeComponentSkill(record,name,destination){
 const component=Object.values(MANIFEST.components).find(c=>c.package===record.package&&c.skills.includes(name));
 if(component?.skill_installation!=='component-managed')throw fail('UNSUPPORTED_COMPONENT_INSTALLER',name);
 destination=path.join(await fs.realpath(path.dirname(destination)),path.basename(destination));
 try{const existing=await fs.readdir(destination);if(existing.length)throw fail('UNMANAGED_TARGET','Component destination must be absent or an empty suite stage');await fs.rmdir(destination);}catch(e){if(e.code!=='ENOENT')throw e;}
 const cwd=record.root??path.resolve(path.dirname(record.entry),'..');
 const identity=JSON.parse(await fs.readFile(path.join(cwd,'package.json'),'utf8'));
 if(identity.name!==record.package||identity.version!==record.version)throw fail('COMPONENT_IDENTITY_MISMATCH',name);
 const manifest=JSON.parse(await fs.readFile(path.join(cwd,'capabilities.json'),'utf8'));
 const contract=manifest.maintenanceContract,commands=manifest.commandContracts;
 if(contract?.schemaVersion!==1)throw fail('MAINTENANCE_CONTRACT_MISSING',name);
 const target=Object.entries(contract.targetOptions??{}).find(([,value])=>value.kind==='skill-directory')?.[0];
 if(!target||!commands?.['skill install']?.options?.[target]||!commands?.['skill status']?.options?.[target])throw fail('UNSUPPORTED_COMPONENT_INSTALLER',name);
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^npm_package_/i.test(key)&&!/^npm_config_(local_prefix|global|workspace|workspaces|include_workspace_root|dry_run)$/i.test(key)&&key!=='INIT_CWD'));
 const invoke=(command,extra=[])=>{
  const selected=manifest.skills.length>1?['--name',name]:[];
  const result=spawnSync(process.execPath,[record.entry,'skill',command,'--agent','suite-managed',target,destination,...selected,...extra,'--json'],{cwd,encoding:'utf8',timeout:60000,env:{...env,AGENT_PACKAGE_UPDATE_CHECK:'0',PORTABLE_SKILL_UPDATE_CHECK:'0'}});
  let data;try{data=JSON.parse(result.stdout);}catch{}
  if(result.status!==0||data?.ok!==true)throw fail('COMPONENT_SKILL_INSTALL_FAILED',name,{child:data??result.stderr});
  return data;
 };
 const owner=commands['skill install'].options['--owner']?['--owner','collection']:[];
 invoke('install',owner);
 const data=invoke('status');
 const field=key=>contract.status[key]?.field?.split('.').reduce((value,part)=>value?.[part],data);
 const edited=field('edited'),verification=field('verification'),recovery=field('recovery');
 if(field('package')!==record.package||field('name')!==name||field('version')!==record.version||field('target')!==destination||field('installed')!==true||field('managed')!==true||field('current')!==true||(Array.isArray(edited)?edited.length>0:edited!==false)||verification?.verified!==true||recovery?.required===true)throw fail('COMPONENT_SKILL_INSTALL_FAILED',name,{child:data});
 if(typeof data.entry!=='string'||!data.entry.startsWith(destination+path.sep))throw fail('INVALID_COMPONENT_ENTRY',name);
 const entry=await fs.realpath(data.entry),relative=path.relative(await fs.realpath(destination),entry);
 if(relative.startsWith('..')||path.isAbsolute(relative)||!(await fs.lstat(data.entry)).isFile())throw fail('INVALID_COMPONENT_ENTRY',name);
 const probe=spawnSync(process.execPath,[entry,'version','--json'],{cwd,encoding:'utf8',timeout:15000,env:{...env,AGENT_PACKAGE_UPDATE_CHECK:'0'}});
 let version;try{version=JSON.parse(probe.stdout);}catch{}
 if(probe.status!==0||version?.package!==record.package||version?.version!==record.version)throw fail('COMPONENT_IDENTITY_MISMATCH',name);
 return {...data,entry};
}
