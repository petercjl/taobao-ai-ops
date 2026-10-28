import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {ROOT,MANIFEST,PACKAGE,nodeFor,source,componentRecord,componentRecords,fail} from './core.mjs';
export function componentEnvironment(id,env=process.env,records=componentRecords()){
 const media=records['sealseek-media'];
 let reportEntries={};
 if(id==='dmp-product-report'){if(!records.tbcli?.entry)throw fail('COMPONENT_NOT_INSTALLED','DMP report requires the registered tbcli component');reportEntries={DMP_REPORT_TBCLI_ENTRY:records.tbcli.entry,AGENT_PACKAGE_UPDATE_CHECK:'0'};}
 const canvasEntries=id==='competitor-visual-canvas'?Object.fromEntries([['tbcli','TBCLI_ENTRY'],['sealseek-media','SEALSEEK_MEDIA_ENTRY'],['boardmixcli','BOARDMIXCLI_ENTRY']].filter(([key])=>records[key]?.entry).map(([key,variable])=>[variable,records[key].entry])):{};
 return {...env,...canvasEntries,...reportEntries,BOARDMIXCLI_UPDATE_CHECK:'0',TBCLI_UPDATE_CHECK:'0',SYCMCLI_DISABLE_AUTO_UPDATE:'1',SEEDAUDIO_AUTO_UPDATE:'0',SEALSEEK_MEDIA_AUTO_UPDATE:'0',COMPETITOR_CANVAS_AUTO_UPDATE:'0',...(id==='cloud-hug-style-transfer'&&media&&!env.CLOUD_HUG_MEDIA_ROOT?{CLOUD_HUG_MEDIA_ROOT:media.root}:{})};
}
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
 if(n.component==='sealseek-media'){
  const record=componentRecord(n.component);
  const result=spawnSync(process.execPath,[record.entry,'version'],{encoding:'utf8',timeout:15000,env:{...process.env,SEALSEEK_MEDIA_AUTO_UPDATE:'0'}});
  const version=result.stdout?.trim().replace(/^sealseek-media\s+/,'');
  checks.push({id:'sealseek-media-node',ok:Number(process.versions.node.split('.')[0])>=22,value:process.version,minimum:22});
  checks.push({id:'sealseek-media-runtime',ok:result.status===0&&version===record.version,value:version});
  checks.push({id:'sealseek-media-contract',ok:fs.existsSync(path.join(source(n),'capabilities.json'))});
 }
 if(n.component==='cloud-hug-style-transfer'){
  const record=componentRecord(n.component);
  const result=spawnSync(process.execPath,[record.entry,'doctor','--json'],{encoding:'utf8',timeout:30000,env:componentEnvironment(n.component)});
  let detail;try{detail=JSON.parse(result.stdout);}catch{detail={ok:false,code:'COMPONENT_DOCTOR_FAILED'};}
  checks.push({id:'cloud-hug-node',ok:Number(process.versions.node.split('.')[0])>=22,value:process.version,minimum:22});
  checks.push({id:'cloud-hug-component-integrity',ok:result.status===0&&detail.ok===true&&detail.package===MANIFEST.components[n.component].package&&detail.version===record.version&&detail.integrity?.ok===true,value:detail});
 }
 if(n.component==='boardmixcli'){
  const record=componentRecord(n.component);
  const result=spawnSync(process.execPath,[record.entry,'--version'],{encoding:'utf8',timeout:15000,env:componentEnvironment(n.component)});
  let version;try{const data=JSON.parse(result.stdout);version=(data.data??data).version;}catch{}
  checks.push({id:'boardmix-node',ok:Number(process.versions.node.split('.')[0])>=22,value:process.version,minimum:22});
  checks.push({id:'boardmix-runtime',ok:result.status===0&&version===record.version,value:version});
  checks.push({id:'boardmix-contract',ok:fs.existsSync(path.join(record.root,'capabilities.json'))});
 }
 if(n.component==='dmp-product-report'){
  const record=componentRecord(n.component),records=componentRecords();
  const atLeast=(value,min)=>{if(!/^\d+\.\d+\.\d+$/.test(value??''))return false;const a=value.split('.').map(Number),b=min.split('.').map(Number);for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return true;};
  checks.push({id:'dmp-report-version',ok:atLeast(record.version,'0.2.0'),value:record.version,minimum:'0.2.0'});
  checks.push({id:'dmp-report-tbcli',ok:atLeast(records.tbcli?.version,'0.12.0'),value:records.tbcli?.version??null,minimum:'0.12.0'});
  try{
   const environment=componentEnvironment(n.component);
   const versionRun=spawnSync(process.execPath,[record.entry,'version','--json'],{encoding:'utf8',timeout:15000,env:environment});let version;try{version=JSON.parse(versionRun.stdout);}catch{}
   checks.push({id:'dmp-report-runtime',ok:versionRun.status===0&&version?.package===MANIFEST.components[n.component].package&&version?.version===record.version,value:version?.version??null});
   const result=spawnSync(process.execPath,[record.entry,'doctor','--json'],{encoding:'utf8',timeout:90000,env:environment});let detail;try{detail=JSON.parse(result.stdout||result.stderr);}catch{detail={ok:false,code:'COMPONENT_DOCTOR_FAILED'};}
   checks.push({id:'dmp-report-capabilities',ok:result.status===0&&detail.ok===true&&detail.tbcliSnapshot===2&&detail.subjectMode==='target-only'&&detail.tbcliItemSummary===1,value:detail});
  }catch(e){checks.push({id:'dmp-report-dependencies',ok:false,code:e.code??'CAPABILITY_UNAVAILABLE',message:e.message});}
 }
 if(n.component==='competitor-visual-canvas'){
  const record=componentRecord(n.component);
  const result=spawnSync(process.execPath,[record.entry,'doctor','--json'],{encoding:'utf8',timeout:30000,env:componentEnvironment(n.component)});
  let detail;try{detail=JSON.parse(result.stdout||result.stderr);}catch{detail={ok:false};}
  checks.push({id:'competitor-canvas-node',ok:Number(process.versions.node.split('.')[0])>=22,value:process.version,minimum:22});
  checks.push({id:'competitor-canvas-contract',ok:result.status===0&&detail.ok===true,value:detail});
 }
 if(n.id==='category-research')checks.push({id:'report-runtime',ok:['assets/report-template.html','assets/chart-views.js'].every(p=>fs.existsSync(path.join(source(n),p)))});
 if(n.id==='product-research'){
  const componentRequire=createRequire(path.join(componentRecord(n.component).root,'package.json'));
  try{checks.push({id:'exceljs',ok:Boolean(componentRequire.resolve('@excel.js/exceljs'))});}catch(e){checks.push({id:'exceljs',ok:false,message:e.message});}
  checks.push({id:'report-runtime',ok:['report_runtime/renderer.py','report_runtime/validator.py','report_runtime/templates/workbench.html'].every(p=>fs.existsSync(path.join(source(n),p)))});
 }
 if(!['excel','nas'].includes(mode))throw fail('USAGE','Doctor mode must be excel or nas');
 if(mode==='nas'&&n.id==='category-research')for(const id of ['tbcli','yccli']){try{const tool=toolEntry(id);const r=spawnSync(tool.command,[...tool.args,'--version'],{encoding:'utf8',timeout:15000,env:{...process.env,TBCLI_UPDATE_CHECK:'0'}});checks.push({id,ok:r.status===0,value:r.stdout?.trim()});}catch(e){checks.push({id,ok:false,message:e.message});}}
 return {ok:checks.every(c=>c.ok),package:PACKAGE.name,version:PACKAGE.version,node:n.id,mode,checks,native_requirements:n.native_requirements.map(id=>({id,status:'requires-active-agent-verification'})),service_access:mode==='nas'||n.component==='dmp-product-report'||['procli','sealseek-media','boardmixcli','competitor-visual-canvas','cloud-hug-style-transfer'].includes(n.component)||['1688cli','1688-product-sourcing','1688-opportunity-sourcing-research'].includes(n.component)?'not-probed':'not-required'};
}
