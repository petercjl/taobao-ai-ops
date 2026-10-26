import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {MANIFEST,ROOT,closure,componentRecords,source,nodeFor} from '../src/core.mjs';
import {inspectComponent,checkComponents} from '../src/components.mjs';
import {doctor,componentEnvironment} from '../src/runtime.mjs';
import {collectionPrepare} from '../src/subscription.mjs';
const name='dmp-product-report';
test('report is an independent selectable application with tbcli dependency closure',async()=>{
 assert.deepEqual(closure({node:name}).map(n=>n.skill),['tbcli',name]);assert.ok(closure().some(n=>n.id===name));assert.ok(nodeFor('operations').requires_skills.includes(name));
 assert.equal(MANIFEST.components[name].package,'@petercjl/'+name);assert.equal(MANIFEST.tools[name].component,name);
 const record=componentRecords()[name];assert.ok(record);const inspected=await inspectComponent(name,record.root);assert.equal(inspected.sources[name],source(nodeFor(name)));await assert.rejects(fs.stat(path.join(ROOT,'skills',name)));
 const result=await doctor(name);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.service_access,'not-probed');assert.equal(result.checks.find(c=>c.id==='dmp-report-capabilities').value.tbcliItemSummary,1);
});
test('report uses the registered tbcli instead of another global/configured entry and stays on installed versions',async()=>{
 const records=componentRecords();assert.equal(componentEnvironment(name,{DMP_REPORT_TBCLI_ENTRY:'unrelated-global'}).DMP_REPORT_TBCLI_ENTRY,records.tbcli.entry);
 const c=await checkComponents(async()=>({ok:true,json:async()=>({'dist-tags':{latest:'0.1.3'}})}));assert.ok(c.components.some(c=>c.id===name));assert.notEqual(MANIFEST.components[name].automatic_update,true);
 assert.throws(()=>componentEnvironment(name,{},{}),e=>e.code==='COMPONENT_NOT_INSTALLED');assert.equal(componentEnvironment('other',{}).DMP_REPORT_TBCLI_ENTRY,undefined);
});
test('missing, old or contract-incompatible report dependencies fail preflight without global fallback',async()=>{
 const prev=process.env.TAOBAO_AI_OPS_STATE_DIR,dir=await fs.mkdtemp(path.join(os.tmpdir(),'ops-dmp-negative-'));
 try{
  process.env.TAOBAO_AI_OPS_STATE_DIR=dir;const skill=path.join(dir,'skill');await fs.mkdir(skill);await fs.writeFile(path.join(skill,'SKILL.md'),'fixture');
  const entry=path.join(dir,'app.mjs');await fs.writeFile(entry,`const version=process.argv.includes('version');console.log(JSON.stringify(version?{package:'@petercjl/dmp-product-report',version:'0.1.2'}:{ok:true,tbcliSnapshot:1,tbcliItemSummary:1,selected:process.env.DMP_REPORT_TBCLI_ENTRY}));`);
  const records={[name]:{package:'@petercjl/'+name,version:'0.1.2',root:dir,entry,sources:{[name]:skill}}};
  const save=()=>fs.writeFile(path.join(dir,'components.json'),JSON.stringify({components:records}));await save();
  let result=await doctor(name);assert.equal(result.ok,false);assert.ok(result.checks.some(c=>c.code==='COMPONENT_NOT_INSTALLED'));
  records.tbcli={version:'0.11.2',entry:path.join(dir,'managed-tbcli.mjs')};await save();result=await doctor(name);assert.equal(result.ok,false);assert.equal(result.checks.find(c=>c.id==='dmp-report-tbcli').ok,false);
  records.tbcli.version='0.11.3';await save();result=await doctor(name);assert.equal(result.ok,true);assert.equal(result.checks.find(c=>c.id==='dmp-report-capabilities').value.selected,records.tbcli.entry);
  await fs.writeFile(entry,`console.log(JSON.stringify(process.argv.includes('version')?{package:'@petercjl/dmp-product-report',version:'0.1.2'}:{ok:true,tbcliSnapshot:1,tbcliItemSummary:null}));`);assert.equal((await doctor(name)).ok,false);
 }finally{if(prev===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=prev;await fs.rm(dir,{recursive:true,force:true});}
});
test('host-owned report Skill receipt binds the tbcli in the same collection generation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ops-dmp-receipt-')),original=MANIFEST.components,npm=process.env.npm_execpath;
 try{
  MANIFEST.components={tbcli:{package:'@petercjl/tbcli',bin:'tbcli',skills:['tbcli']},[name]:{package:'@petercjl/'+name,bin:name,skills:[name]}};process.env.npm_execpath='fixture-npm-cli.js';
  const candidate=await collectionPrepare({directory:path.join(dir,'candidate'),yes:true},{registry:async url=>({ok:true,json:async()=>({name:decodeURIComponent(url.split('/').at(-2)),version:'1.0.0'})}),run:async(command,args)=>{
   const prefix=args[args.indexOf('--prefix')+1];
   for(const [id,component] of Object.entries(MANIFEST.components)){
    const root=path.join(prefix,'node_modules',...component.package.split('/')),skill=path.join(root,'skill',id);await fs.mkdir(skill,{recursive:true});
    await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:component.package,version:'1.0.0',type:'module',bin:{[id]:'cli.mjs'}}));await fs.writeFile(path.join(skill,'SKILL.md'),`---\nname: ${id}\ndescription: fixture\n---\n`);
    await fs.writeFile(path.join(root,'cli.mjs'),`import path from 'node:path';import{fileURLToPath}from'node:url';console.log(JSON.stringify({skill:'${id}',source:path.join(path.dirname(fileURLToPath(import.meta.url)),'skill','${id}')}));`);
   }
   return '';
  }});
  const report=candidate.skills.find(s=>s.name===name),receipt=JSON.parse(await fs.readFile(path.join(report.directory,'.collection-runtime.json'),'utf8'));
  const expected=candidate.skills.find(s=>s.name==='tbcli').runtimeEntry;assert.equal(receipt.environment.DMP_REPORT_TBCLI_ENTRY,expected);assert.equal(receipt.environment.TAOBAO_AI_OPS_STATE_DIR,candidate.environment.TAOBAO_AI_OPS_STATE_DIR);assert.ok(expected.startsWith(path.join(dir,'candidate')));await fs.access(expected);
 }finally{MANIFEST.components=original;if(npm===undefined)delete process.env.npm_execpath;else process.env.npm_execpath=npm;await fs.rm(dir,{recursive:true,force:true});}
});
