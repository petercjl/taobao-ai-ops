import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {componentRecords,PACKAGE,MANIFEST,closure} from '../src/core.mjs';
import {checkComponents,installComponents,inspectComponent} from '../src/components.mjs';

async function fixture(fn){
 const originals=componentRecords(),env=process.env.TAOBAO_AI_OPS_STATE_DIR;
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ops-components-'));process.env.TAOBAO_AI_OPS_STATE_DIR=root;
 const records=structuredClone(originals);
 for(const r of Object.values(records))r.development=true;
 records.tbcli.development=false;
 await fs.writeFile(path.join(root,'components.json'),JSON.stringify({components:records}));
 try{await fn(root,records);}finally{if(env===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=env;}
}
const check=()=>Promise.resolve({ok:true,components:[{id:'tbcli',package:'@petercjl/tbcli',current:'0.10.4',available:'0.10.5',updateAvailable:true}]});
function fakeNpm(args){
 const generation=args[args.indexOf('--prefix')+1];
 const root=path.join(generation,'node_modules','@petercjl','tbcli');
 return fs.mkdir(root,{recursive:true}).then(async()=>{
  await fs.mkdir(path.join(root,'skill','tbcli'),{recursive:true});
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:'@petercjl/tbcli',version:'0.10.5',bin:{tbcli:'cli.mjs'}}));
  await fs.writeFile(path.join(root,'skill','tbcli','SKILL.md'),'---\nname: tbcli\ndescription: fixture\n---\n新版');
  await fs.writeFile(path.join(root,'cli.mjs'),"import path from 'node:path';import{fileURLToPath}from'node:url';console.log(JSON.stringify({source:path.join(path.dirname(fileURLToPath(import.meta.url)),'skill','tbcli')}));");
 });
}
test('component upgrades while shell version remains unchanged, and Skill follows new package',async()=>fixture(async(root)=>{
 const target=path.join(root,'agent');
 const r=await installComponents({yes:true,targetDir:target,mode:'copy'},{check,npm:fakeNpm});
 assert.equal(r.suiteVersion,PACKAGE.version);assert.equal(componentRecords().tbcli.version,'0.10.5');
 assert.match(await fs.readFile(path.join(target,'tbcli','SKILL.md'),'utf8'),/新版/);
 assert.equal(r.skills.skills.find(s=>s.skill==='tbcli').version,'0.10.5');
}));
test('failed Skill migration restores component selection and all earlier Skill changes',async()=>fixture(async(root,old)=>{
 const target=path.join(root,'agent');await fs.mkdir(path.join(target,'tbcli'),{recursive:true});await fs.writeFile(path.join(target,'tbcli','user.md'),'保留');
 await assert.rejects(installComponents({yes:true,targetDir:target,mode:'copy'},{check,npm:fakeNpm}),e=>e.code==='UNMANAGED_TARGET');
 assert.deepEqual(componentRecords(),old);assert.equal(await fs.readFile(path.join(target,'tbcli','user.md'),'utf8'),'保留');
 await assert.rejects(fs.stat(path.join(target,'taobao-ai-operations')));
}));
test('registry failure leaves current components unchanged and never invokes npm',async()=>fixture(async(root,old)=>{
 const r=await checkComponents(async()=>{throw Error('offline');});assert.equal(r.ok,false);
 let called=false;await assert.rejects(installComponents({yes:true,targetDir:path.join(root,'agent')},{check:async()=>r,npm:()=>{called=true;}}),e=>e.code==='REGISTRY_UNAVAILABLE');
 assert.equal(called,false);assert.deepEqual(componentRecords(),old);
}));
test('npm failure retains prior component versions',async()=>fixture(async(root,old)=>{
 await assert.rejects(installComponents({yes:true,targetDir:path.join(root,'agent')},{check,npm:()=>{throw Error('install failed');}}));
 assert.deepEqual(componentRecords(),old);
}));
test('component update requires explicit authorization',async()=>{
 await assert.rejects(installComponents({agent:'codex'}),e=>e.code==='AUTHORIZATION_REQUIRED');
});

test('project-management is independently selectable and included in the suite profile',()=>{
 assert.deepEqual(closure({node:'project-management'}).map(n=>n.skill),['project-management']);
 assert.ok(closure().some(n=>n.component==='procli'));
 assert.equal(MANIFEST.tools.procli.package,MANIFEST.components.procli.package);
});

test('component source discovery accepts procli envelopes and refuses bad sources',async()=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'ops-procli-')));
 const skill=path.join(root,'skill','project-management');await fs.mkdir(skill,{recursive:true});
 await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:'@petercjl/procli',version:'0.7.0',bin:{procli:'cli.mjs'}}));
 await fs.writeFile(path.join(skill,'SKILL.md'),'---\nname: project-management\ndescription: fixture\n---\n');
 const emit=async result=>fs.writeFile(path.join(root,'cli.mjs'),`console.log(${JSON.stringify(JSON.stringify(result))});`);
 await emit({ok:true,data:{skill:'project-management',source:skill}});
 assert.equal((await inspectComponent('procli',root)).sources['project-management'],skill);
 await emit({ok:false,error:{code:'AUTH_REQUIRED'}});
 await assert.rejects(inspectComponent('procli',root),e=>e.code==='COMPONENT_SOURCE_FAILED');
 await emit({ok:true,data:{skill:'other-skill',source:skill}});
 await assert.rejects(inspectComponent('procli',root),e=>e.code==='SKILL_IDENTITY_MISMATCH');
 await emit({ok:true,data:{skill:'project-management',source:path.join(os.tmpdir(),'outside')}});
 await assert.rejects(inspectComponent('procli',root),e=>e.code==='INVALID_COMPONENT_SOURCE');
});
