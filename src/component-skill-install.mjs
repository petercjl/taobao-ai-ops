import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fail} from './core.mjs';
// Only explicitly registered components delegate complete Skill/runtime materialization.
// The suite owns selection/transaction recovery; the component owns its installation contract.
export async function materializeComponentSkill(record,name,destination){
 if(name!=='portable-skill-creator'||record.package!=='@petercjl/portable-skill-creator')throw fail('UNSUPPORTED_COMPONENT_INSTALLER',name);
 destination=path.join(await fs.realpath(path.dirname(destination)),path.basename(destination));
 try{const existing=await fs.readdir(destination);if(existing.length)throw fail('UNMANAGED_TARGET','Component destination must be absent or an empty suite stage');await fs.rmdir(destination);}catch(e){if(e.code!=='ENOENT')throw e;}
 const result=spawnSync(process.execPath,[record.entry,'skill','install','--agent','suite-managed','--target',destination,'--json'],{encoding:'utf8',timeout:60000,env:{...process.env,PORTABLE_SKILL_UPDATE_CHECK:'0'}});
 let data;try{data=JSON.parse(result.stdout);}catch{}
 if(result.status!==0||data?.ok!==true||data.package!==record.package||data.name!==name||data.version!==record.version||data.current!==true||data.verification?.verified!==true)throw fail('COMPONENT_SKILL_INSTALL_FAILED',name,{child:data??result.stderr});
 await fs.access(path.join(destination,'.runtime','bin','portable-skill-creator.mjs'));
 return data;
}
