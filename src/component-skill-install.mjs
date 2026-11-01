import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fail} from './core.mjs';
// Only explicitly registered components delegate complete Skill/runtime materialization.
// The suite owns selection/transaction recovery; the component owns its installation contract.
export async function materializeComponentSkill(record,name,destination){
 const product=name==='product-reference-replacement'&&record.package==='@petercjl/product-reference-replacement';
 if(!product&&(name!=='portable-skill-creator'||record.package!=='@petercjl/portable-skill-creator'))throw fail('UNSUPPORTED_COMPONENT_INSTALLER',name);
 destination=path.join(await fs.realpath(path.dirname(destination)),path.basename(destination));
 try{const existing=await fs.readdir(destination);if(existing.length)throw fail('UNMANAGED_TARGET','Component destination must be absent or an empty suite stage');await fs.rmdir(destination);}catch(e){if(e.code!=='ENOENT')throw e;}
 // npm must resolve package context from the owning component, not its caller.
 const cwd=record.root??path.resolve(path.dirname(record.entry),'..');
 const identity=JSON.parse(await fs.readFile(path.join(cwd,'package.json'),'utf8'));
 if(identity.name!==record.package||identity.version!==record.version)throw fail('COMPONENT_IDENTITY_MISMATCH',name);
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^npm_package_/i.test(key)&&!/^npm_config_(local_prefix|global|workspace|workspaces|include_workspace_root|dry_run)$/i.test(key)&&key!=='INIT_CWD'));
 const result=spawnSync(process.execPath,[record.entry,'skill','install','--agent','suite-managed',product?'--target-directory':'--target',destination,'--json'],{cwd,encoding:'utf8',timeout:60000,env:{...env,PORTABLE_SKILL_UPDATE_CHECK:'0',PRODUCT_REFERENCE_REPLACEMENT_UPDATE_CHECK:'0',npm_config_install_links:'true'}});
 let data;try{data=JSON.parse(result.stdout);}catch{}
 if(product){
  if(result.status!==0||data?.ok!==true||path.resolve(data.target??'')!==destination||data.up_to_date!==true||data.runtime_verified!==true)throw fail('COMPONENT_SKILL_INSTALL_FAILED',name,{child:data??result.stderr});
  const status=spawnSync(process.execPath,[record.entry,'skill','status','--agent','suite-managed','--target-directory',destination,'--json'],{encoding:'utf8',timeout:60000});
  let verified;try{verified=JSON.parse(status.stdout);}catch{}
  if(status.status!==0||verified?.ok!==true||verified.package!==record.package||verified.name!==name||verified.version!==record.version||verified.managed!==true||verified.up_to_date!==true||verified.edited?.length||verified.verification?.verified!==true)throw fail('COMPONENT_SKILL_INSTALL_FAILED',name,{child:verified??status.stderr});
  const runtimeEntry=path.join(destination,'.runtime','bin','product-reference-replacement.mjs');await fs.access(runtimeEntry);
  return {...verified,runtimeEntry};
 }
 if(result.status!==0||data?.ok!==true||data.package!==record.package||data.name!==name||data.version!==record.version||data.current!==true||data.verification?.verified!==true)throw fail('COMPONENT_SKILL_INSTALL_FAILED',name,{child:data??result.stderr});
 await fs.access(path.join(destination,'.runtime','bin','portable-skill-creator.mjs'));
 return data;
}
