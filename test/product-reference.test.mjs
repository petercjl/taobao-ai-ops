import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {MANIFEST,ROOT,closure,componentRecords,nodeFor,source} from '../src/core.mjs';
import {inspectComponent,checkComponents} from '../src/components.mjs';
import {install,status} from '../src/skill-manager.mjs';
import {doctor,componentEnvironment} from '../src/runtime.mjs';
import {collectionPrepare} from '../src/subscription.mjs';

const name='product-reference-replacement';
const command=(entry,args,env={})=>{
 const r=spawnSync(process.execPath,[entry,...args],{encoding:'utf8',timeout:90000,env:{...process.env,PRODUCT_REFERENCE_REPLACEMENT_UPDATE_CHECK:'0',...env}});
 assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
};
async function fixture(fn){
 const previous=process.env.TAOBAO_AI_OPS_STATE_DIR,original=componentRecords();
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-product-reference-'));
 try{
  const npmRoot=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['root','-g'],{encoding:'utf8',shell:process.platform==='win32'}).stdout.trim();
  const packageRoot=original[name]?.root||path.join(npmRoot,'@petercjl',name);
  const product=await inspectComponent(name,packageRoot);
  const mediaRoot=original['sealseek-media']?.root||path.join(npmRoot,'@petercjl/sealseek-media-cli');
  const media=await inspectComponent('sealseek-media',mediaRoot);
  process.env.TAOBAO_AI_OPS_STATE_DIR=path.join(root,'state');await fs.mkdir(process.env.TAOBAO_AI_OPS_STATE_DIR);
  const records={[name]:product,'sealseek-media':media};
  const save=()=>fs.writeFile(path.join(process.env.TAOBAO_AI_OPS_STATE_DIR,'components.json'),JSON.stringify({components:records}));await save();
  await fn({root,product,media,records,save});
 }finally{if(previous===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=previous;await fs.rm(root,{recursive:true,force:true});}
}

test('product assets and replacement are independently selectable with the registered media dependency',()=>{
 assert.deepEqual(closure({name}).map(n=>n.skill),['sealseek-media',name]);
 assert.ok(closure().some(n=>n.id===name));assert.ok(nodeFor('operations').requires_skills.includes(name));
 assert.equal(MANIFEST.components[name].skill_installation,'component-managed');
 assert.equal(MANIFEST.tools[name].component,name);
 assert.equal(componentEnvironment(name,{}).PRODUCT_REFERENCE_REPLACEMENT_UPDATE_CHECK,'0');
});

test('exact source, real versions and local preflight use independent owning components',()=>fixture(async({product})=>{
 assert.equal(source(nodeFor(name)),product.sources[name]);await assert.rejects(fs.stat(path.join(ROOT,'skills',name)));
 const r=await doctor(name);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.service_access,'not-probed');
 assert.ok(r.native_requirements.every(n=>n.status==='requires-active-agent-verification'));
 const checks=await checkComponents(async()=>({ok:true,json:async()=>({'dist-tags':{latest:'0.3.7'}})}));
 assert.equal(checks.components.find(c=>c.id===name).available,'0.3.7');
}));

test('missing, old or failed product runtime and missing selected media fail preflight',()=>fixture(async({root,records,save})=>{
 const good=records[name];delete records[name];await save();assert.equal((await doctor(name)).ok,false);
 records[name]={...good,version:'0.3.5'};await save();assert.equal((await doctor(name)).ok,false);
 records[name]=good;delete records['sealseek-media'];await save();
 assert.equal((await doctor(name)).checks.find(c=>c.id==='product-reference-media').ok,false);
 const entry=path.join(root,'failed.mjs');await fs.writeFile(entry,'console.log(JSON.stringify({ok:false,local_ready:false}));process.exitCode=1;');
 records[name]={...good,entry};await save();assert.equal((await doctor(name)).ok,false);
}));

test('public CLI installs only the selected node closure without fetching unrelated components',()=>fixture(async({root,product})=>{
 const entry=path.join(ROOT,'bin/taobao-ai-ops.mjs'),destination=path.join(root,'cli-host');
 const first=command(entry,['skill','install','--name',name,'--target-dir',destination,'--mode','copy','--json']);
 assert.deepEqual(first.skills.map(s=>s.skill),['sealseek-media',name]);
 const again=command(entry,['skill','update','--name',name,'--target-dir',destination,'--mode','copy','--json']);
 assert.ok(again.skills.every(s=>s.action==='unchanged'));
 const resolved=command(entry,['skill','source','--name',name,'--json']);assert.equal(resolved.source,product.sources[name]);
 assert.equal(command(entry,['component','run',name,'version','--json']).version,product.version);
}));

test('component installer creates physical independent runtimes; repeat, edits and source deletion are safe',()=>fixture(async({root,product,records,save})=>{
 const clone=path.join(root,'bootstrap');await fs.cp(product.root,clone,{recursive:true});
 records[name]=await inspectComponent(name,clone);await save();
 const a=path.join(root,'host-a'),b=path.join(root,'host-b');
 // The suite enforces complete physical copies even if the caller historically requested links.
 await install({name,targetDir:a,mode:'link'});await install({name,targetDir:b,mode:'copy'});
 assert.equal((await status(b,nodeFor(name))).state,'current');
 assert.ok((await install({name,targetDir:b,mode:'copy'})).skills.every(s=>s.action==='unchanged'));
 const target=path.join(b,name),entry=path.join(target,'.runtime/bin/product-reference-replacement.mjs');
 const sibling=path.join(a,name,'.runtime/bin/product-reference-replacement.mjs');
 assert.equal((await fs.lstat(target)).isSymbolicLink(),false);assert.notEqual((await fs.stat(entry)).ino,(await fs.stat(sibling)).ino);
 const receipt=JSON.parse(await fs.readFile(path.join(target,'.product-reference-install.json'),'utf8'));
 assert.equal(receipt.version,product.version);assert.equal(receipt.runtime_version,product.version);
 await assert.rejects(fs.lstat(path.join(target,'.runtime/node_modules/@petercjl/taobao-ai-ops')),e=>e.code==='ENOENT');
 await fs.appendFile(path.join(target,'SKILL.md'),'\nUser-owned local change.');
 await assert.rejects(install({name,targetDir:b}),e=>e.code==='LOCAL_CHANGES');
 await fs.rm(clone,{recursive:true});await fs.rm(a,{recursive:true});
 assert.equal(command(entry,['version','--json']).version,product.version);
 // Execute a real local business operation using target-owned sharp and assets.
 const sharp=createRequire(path.join(target,'.runtime/package.json'))('sharp');
 const input=path.join(root,'product.png');await sharp({create:{width:160,height:90,channels:3,background:'#e8bb53'}}).png().toFile(input);
 const review=path.join(root,'external-review.json');await fs.writeFile(review,JSON.stringify({inspected:true,asset_id:'fixture',variant:'synthetic',coverage:['synthetic local smoke'],provided_for_use:true,approval_evidence:'Authorized synthetic test fixture; not a real product or business approval.'}));
 const imported=command(entry,['asset','import','--image',input,'--record',path.join(root,'asset.json'),'--review',review,'--json']);
 assert.equal(imported.ok,true);await fs.access(path.join(root,'asset.json'));
}));

test('host collection points product Skill at its own runtime after bootstrap runtime removal',()=>fixture(async({root,product})=>{
 const previous=MANIFEST.components,npm=process.env.npm_execpath;
 try{
  MANIFEST.components={[name]:previous[name]};process.env.npm_execpath='fixture-npm-cli.js';
  const result=await collectionPrepare({directory:path.join(root,'candidate'),yes:true},{registry:async()=>({ok:true,json:async()=>({name:product.package,version:product.version})}),run:async(command,args)=>{
   const prefix=args[args.indexOf('--prefix')+1],dest=path.join(prefix,'node_modules',...product.package.split('/'));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.cp(product.root,dest,{recursive:true});return '';
  }});
  const skill=result.skills.find(s=>s.name===name),receipt=JSON.parse(await fs.readFile(path.join(skill.directory,'.collection-runtime.json'),'utf8'));
  assert.equal(receipt.runtimeEntry,path.join(skill.directory,'.runtime/bin/product-reference-replacement.mjs'));
  assert.equal(receipt.version,product.version);await fs.rm(path.join(root,'candidate/runtime'),{recursive:true});
  assert.equal(command(receipt.runtimeEntry,['version','--json']).version,product.version);
 }finally{MANIFEST.components=previous;if(npm===undefined)delete process.env.npm_execpath;else process.env.npm_execpath=npm;}
}));
