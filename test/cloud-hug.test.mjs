import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {MANIFEST,ROOT,closure,componentRecords,source,nodeFor} from '../src/core.mjs';
import {inspectComponent,checkComponents} from '../src/components.mjs';
import {doctor} from '../src/runtime.mjs';
const name='cloud-hug-style-transfer';
test('Cloud Hug is an independent visual-production node in default profile and operations preflight',()=>{
 assert.deepEqual(closure({node:name}).map(n=>n.skill),[name]);
 assert.ok(closure().some(n=>n.id===name));
 assert.ok(nodeFor('operations').requires_skills.includes(name));
 assert.equal(MANIFEST.components[name].package,'@petercjl/'+name);
 assert.equal(MANIFEST.tools[name].component,name);
 assert.deepEqual(nodeFor(name).native_requirements,['media.image.inspect','media.image.edit']);
});
test('Cloud Hug source and real CLI integrity come from owning installed package, not suite assets',async()=>{
 const record=componentRecords()[name];assert.ok(record);
 const inspected=await inspectComponent(name,record.root);assert.equal(inspected.package,'@petercjl/'+name);
 assert.equal(inspected.sources[name],source(nodeFor(name)));
 await assert.rejects(fs.stat(path.join(ROOT,'skills',name)));
 const result=await doctor(name);assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.checks.find(c=>c.id==='cloud-hug-component-integrity').value.integrity.ok,true);
 assert.equal(result.native_requirements.length,2);
 assert.ok(result.native_requirements.every(r=>r.status==='requires-active-agent-verification'));
});
test('explicit component checks include Cloud Hug stable latest without auto-update on business calls',async()=>{
 const checks=await checkComponents(async url=>({ok:true,json:async()=>({'dist-tags':{latest:'0.1.2'}})}));
 const c=checks.components.find(c=>c.id===name);assert.ok(c);
 if(!c.development)assert.equal(c.available,'0.1.2');
 assert.notEqual(MANIFEST.components[name].automatic_update,true);
});
test('Cloud Hug damaged resources or missing doctor entry fail the suite preflight',async()=>{
 const previous=process.env.TAOBAO_AI_OPS_STATE_DIR;
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ops-cloud-hug-'));
 try{
  process.env.TAOBAO_AI_OPS_STATE_DIR=root;
  const skill=path.join(root,'skill');await fs.mkdir(skill);await fs.writeFile(path.join(skill,'SKILL.md'),'fixture');
  const entry=path.join(root,'cli.mjs');
  const r={package:'@petercjl/'+name,version:'0.1.2',root,entry,sources:{[name]:skill}};
  await fs.writeFile(path.join(root,'components.json'),JSON.stringify({components:{[name]:r}}));
  await fs.writeFile(entry,`console.log(JSON.stringify({ok:false,package:'@petercjl/${name}',version:'0.1.2',integrity:{ok:false,problems:['assets/missing.png']}}));process.exitCode=1;`);
  assert.equal((await doctor(name)).ok,false);
  await fs.unlink(entry);assert.equal((await doctor(name)).ok,false);
 }finally{if(previous===undefined)delete process.env.TAOBAO_AI_OPS_STATE_DIR;else process.env.TAOBAO_AI_OPS_STATE_DIR=previous;await fs.rm(root,{recursive:true,force:true});}
});
