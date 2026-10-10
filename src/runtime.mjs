import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {ROOT,MANIFEST,PACKAGE,nodeFor,source,componentRecord,fail} from './core.mjs';
export function pythonEnvironment(env=process.env){
 return {...env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1'};
}
export function pythonCandidates(platform=process.platform,home=os.homedir(),env=process.env){
 const targetPath=platform==='win32'?path.win32:path.posix;
 const agent=env.SEALSEEK_HOME||targetPath.join(home,'.sealseek');
 const bins=platform==='win32'?['Scripts','python.exe']:['bin','python'];
 return [...new Set([env.TAOBAO_AI_OPS_PYTHON,env.TAOBAO_SEARCH_PYTHON,targetPath.join(agent,'binaries','python','envs','default',...bins),targetPath.join(home,'.local','share','taobao-ai-ops','.venv',...bins),targetPath.join(home,'.local','share','taobao-search-product-form','.venv',...bins),...(platform==='win32'?['py','python','python3']:['python3','python'])].filter(Boolean))];
}
export function resolvePython(imports,candidates=pythonCandidates()){
 for(const command of candidates){const prefix=command==='py'?['-3']:[];const result=spawnSync(command,[...prefix,'-c',imports.length?`import ${imports.join(',')}`:'import sys'],{encoding:'utf8',timeout:15000});if(result.status===0)return {command,prefix};}
 return null;
}
export function toolEntry(id){
 const tool=MANIFEST.tools[id];if(!tool)throw fail('UNKNOWN_TOOL',`Unknown tool ${id}`);
 if(tool.external)return {command:process.env[tool.executable_env]||id,args:[],external:true};
 const managed=componentRecord(tool.component);
 if(!fs.existsSync(managed.entry))throw fail('CAPABILITY_UNAVAILABLE',`Missing ${id} entry`);
 return {command:process.execPath,args:[managed.entry],version:managed.version};
}
export function runScript(id,name,args){
 const n=nodeFor(id);if(!n.component||!/^[a-z][a-z0-9_]*\.(py|mjs)$/.test(name))throw fail('SCRIPT_NOT_ALLOWED',`Invalid component script ${name}`);
 // The independent CLI owns its current allowlist and runtime; new component scripts need no shell release.
 const record=componentRecord(n.component);
 const r=spawnSync(process.execPath,[record.entry,'script',name,...args],{stdio:'inherit',env:pythonEnvironment()});
 if(r.error)throw fail('EXECUTION_FAILED',r.error.message);process.exitCode=r.status??1;
}
export async function doctor(id,mode='excel'){
 const n=nodeFor(id||'operations'),checks=[];
 checks.push({id:'node',ok:Number(process.versions.node.split('.')[0])>=20,value:process.version});
 try{checks.push({id:'skill',ok:fs.existsSync(path.join(source(n),'SKILL.md'))});}catch(e){return {ok:false,node:n.id,checks:[...checks,{id:'component',ok:false,code:e.code,message:e.message}],native_requirements:[]};}
 if(n.id==='operations'){
  const children=await Promise.all(n.requires_skills.map(skill=>doctor(skill,mode)));
  return {ok:checks.every(c=>c.ok)&&children.every(c=>c.ok),package:PACKAGE.name,version:PACKAGE.version,node:n.id,checks,children,native_requirements:children.flatMap(c=>c.native_requirements)};
 }
 if(n.python_imports.length&&n.id!=='html-report'){const python=resolvePython(n.python_imports);checks.push({id:'python',ok:Boolean(python),value:python,required_imports:n.python_imports});}
 if(n.id==='html-report'){
  const record=componentRecord(n.component);
  const result=spawnSync(process.execPath,[record.entry,'doctor','--json'],{encoding:'utf8',timeout:30000,env:pythonEnvironment()});
  let detail;try{detail=JSON.parse(result.stdout||result.stderr);}catch{detail={message:result.stderr||'Unparseable component doctor'};}
  checks.push({id:'html-component-runtime',ok:result.status===0,value:detail});
 }
 if(n.component==='procli'){
  const record=componentRecord(n.component);
  const result=spawnSync(process.execPath,[record.entry,'--version'],{encoding:'utf8',timeout:15000});
  let version;try{const data=JSON.parse(result.stdout);version=(data.data??data).version;}catch{}
  checks.push({id:'procli-runtime',ok:result.status===0&&version===record.version,value:version});
  checks.push({id:'procli-contract',ok:fs.existsSync(path.join(source(n),'capabilities.json'))});
 }
 if(['1688cli','1688-product-sourcing','1688-opportunity-sourcing-research'].includes(n.component)){
  const record=componentRecord(n.component);
  const result=spawnSync(process.execPath,[record.entry,'doctor','--json'],{encoding:'utf8',timeout:90000,env:pythonEnvironment()});
  let detail;try{detail=JSON.parse(result.stdout);}catch{detail={code:'COMPONENT_DOCTOR_FAILED'};}
  checks.push({id:'1688-component-runtime',ok:result.status===0,value:detail});
 }
 if(n.component==='seedaudiocli'){
  const record=componentRecord(n.component);
  const result=spawnSync(process.execPath,[record.entry,'doctor','--json'],{encoding:'utf8',timeout:30000,env:{...pythonEnvironment(),SEEDAUDIO_AUTO_UPDATE:'0'}});
  let detail;try{detail=JSON.parse(result.stdout);}catch{detail={code:'COMPONENT_DOCTOR_FAILED'};}
  checks.push({id:'seedaudio-runtime-and-config',ok:result.status===0,value:detail});
 }
 if(n.id==='category-research')checks.push({id:'report-runtime',ok:['assets/report-template.html','assets/chart-views.js'].every(p=>fs.existsSync(path.join(source(n),p)))});
 if(n.id==='product-research'){
  const componentRequire=createRequire(path.join(componentRecord(n.component).root,'package.json'));
  try{checks.push({id:'exceljs',ok:Boolean(componentRequire.resolve('@excel.js/exceljs'))});}catch(e){checks.push({id:'exceljs',ok:false,message:e.message});}
  checks.push({id:'report-runtime',ok:['report_runtime/renderer.py','report_runtime/validator.py','report_runtime/templates/workbench.html'].every(p=>fs.existsSync(path.join(source(n),p)))});
 }
 if(!['excel','nas'].includes(mode))throw fail('USAGE','Doctor mode must be excel or nas');
 if(mode==='nas'&&n.id==='category-research')for(const id of ['tbcli','yccli']){try{const tool=toolEntry(id);const r=spawnSync(tool.command,[...tool.args,'--version'],{encoding:'utf8',timeout:15000,env:{...process.env,TBCLI_UPDATE_CHECK:'0'}});checks.push({id,ok:r.status===0,value:r.stdout?.trim()});}catch(e){checks.push({id,ok:false,message:e.message});}}
 return {ok:checks.every(c=>c.ok),package:PACKAGE.name,version:PACKAGE.version,node:n.id,mode,checks,native_requirements:n.native_requirements.map(id=>({id,status:'requires-active-agent-verification'})),service_access:mode==='nas'||n.component==='procli'||['1688cli','1688-product-sourcing','1688-opportunity-sourcing-research'].includes(n.component)?'not-probed':'not-required'};
}
