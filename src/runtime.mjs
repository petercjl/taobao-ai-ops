import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {ROOT,MANIFEST,PACKAGE,nodeFor,source,fail} from './core.mjs';
const require=createRequire(import.meta.url);
export function pythonCandidates(platform=process.platform,home=os.homedir(),env=process.env){
 const agent=env.SEALSEEK_HOME||path.join(home,'.sealseek');
 const bins=platform==='win32'?['Scripts','python.exe']:['bin','python'];
 return [...new Set([env.TAOBAO_AI_OPS_PYTHON,env.TAOBAO_SEARCH_PYTHON,path.join(agent,'binaries','python','envs','default',...bins),path.join(home,'.local','share','taobao-ai-ops','.venv',...bins),path.join(home,'.local','share','taobao-search-product-form','.venv',...bins),...(platform==='win32'?['py','python','python3']:['python3','python'])].filter(Boolean))];
}
export function resolvePython(imports,candidates=pythonCandidates()){
 for(const command of candidates){const prefix=command==='py'?['-3']:[];const result=spawnSync(command,[...prefix,'-c',imports.length?`import ${imports.join(',')}`:'import sys'],{encoding:'utf8',timeout:15000});if(result.status===0)return {command,prefix};}
 return null;
}
export function toolEntry(id){
 const tool=MANIFEST.tools[id];if(!tool)throw fail('UNKNOWN_TOOL',`Unknown tool ${id}`);
 if(tool.external)return {command:process.env[tool.executable_env]||id,args:[],external:true};
 let packageRoot;
 try{packageRoot=path.dirname(require.resolve(`${tool.package}/package.json`));}
 catch{let dir=path.dirname(require.resolve(tool.package));while(dir!==path.dirname(dir)){const p=path.join(dir,'package.json');if(fs.existsSync(p)&&JSON.parse(fs.readFileSync(p,'utf8')).name===tool.package){packageRoot=dir;break;}dir=path.dirname(dir);}}
 if(!packageRoot)throw fail('CAPABILITY_UNAVAILABLE',`Cannot resolve ${tool.package}`);
 const entry=path.join(packageRoot,tool.entry);
 if(!fs.existsSync(entry))throw fail('CAPABILITY_UNAVAILABLE',`Missing ${id} entry`,{entry});
 return {command:process.execPath,args:[entry],version:JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8')).version};
}
export function runScript(id,name,args){
 const n=nodeFor(id);if(!n.scripts.includes(name))throw fail('SCRIPT_NOT_ALLOWED',`Script ${name} is not exposed by ${n.id}`);
 const runtime=name.endsWith('.py')?resolvePython(n.python_imports):{command:process.execPath,prefix:[]};
 if(!runtime)throw fail('RUNTIME_UNAVAILABLE',`Python imports required: ${n.python_imports.join(', ')}`);
 const r=spawnSync(runtime.command,[...runtime.prefix,path.join(source(n),'scripts',name),...args],{stdio:'inherit',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 if(r.error)throw fail('EXECUTION_FAILED',r.error.message);process.exitCode=r.status??1;
}
export async function doctor(id,mode='excel'){
 const n=nodeFor(id||'operations'),checks=[];
 checks.push({id:'node',ok:Number(process.versions.node.split('.')[0])>=20,value:process.version});
 checks.push({id:'skill',ok:fs.existsSync(path.join(source(n),'SKILL.md'))});
 if(n.id==='operations'){
  const children=await Promise.all(n.requires_skills.map(skill=>doctor(skill,mode)));
  return {ok:checks.every(c=>c.ok)&&children.every(c=>c.ok),package:PACKAGE.name,version:PACKAGE.version,node:n.id,checks,children,native_requirements:children.flatMap(c=>c.native_requirements)};
 }
 if(n.python_imports.length){const python=resolvePython(n.python_imports);checks.push({id:'python',ok:Boolean(python),value:python,required_imports:n.python_imports});}
 if(n.id==='category-research')checks.push({id:'report-runtime',ok:['assets/report-template.html','assets/chart-views.js'].every(p=>fs.existsSync(path.join(source(n),p)))});
 if(n.id==='product-research'){
  checks.push({id:'exceljs',ok:Boolean(await import('@excel.js/exceljs').catch(()=>null))});
  checks.push({id:'report-runtime',ok:['report_runtime/renderer.py','report_runtime/validator.py','report_runtime/templates/workbench.html'].every(p=>fs.existsSync(path.join(source(n),p)))});
 }
 if(!['excel','nas'].includes(mode))throw fail('USAGE','Doctor mode must be excel or nas');
 if(mode==='nas'&&n.id==='category-research')for(const id of ['tbcli','yccli']){try{const tool=toolEntry(id);const r=spawnSync(tool.command,[...tool.args,'--version'],{encoding:'utf8',timeout:15000,env:{...process.env,TBCLI_UPDATE_CHECK:'0'}});checks.push({id,ok:r.status===0,value:r.stdout?.trim()});}catch(e){checks.push({id,ok:false,message:e.message});}}
 return {ok:checks.every(c=>c.ok),package:PACKAGE.name,version:PACKAGE.version,node:n.id,mode,checks,native_requirements:n.native_requirements.map(id=>({id,status:'requires-active-agent-verification'})),service_access:mode==='nas'?'not-probed':'not-required'};
}
