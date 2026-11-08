import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {closure, componentRecord, MANIFEST, nodeFor, source} from '../src/core.mjs';
import {inspectComponent} from '../src/components.mjs';
import {materializeComponentSkill} from '../src/component-skill-install.mjs';
import {componentEnvironment, doctor} from '../src/runtime.mjs';

const name = 'product-ad-creative-story';

test('creative story joins the default suite with its exact Taobao evidence dependency', () => {
 assert.deepEqual(closure({node:name}).map(node=>node.skill), ['tbcli',name]);
 assert.ok(closure().some(node=>node.id===name));
 assert.ok(nodeFor('operations').requires_skills.includes(name));
 assert.equal(MANIFEST.components[name].package,'@petercjl/'+name);
 assert.equal(MANIFEST.components[name].skill_installation,'component-managed');
 assert.equal(componentEnvironment(name,{}).PRODUCT_AD_CREATIVE_STORY_AUTO_UPDATE,'0');
});

test('published creative story resolves, probes and materializes an isolated runnable Skill', async t => {
 const record=componentRecord(name);
 const inspected=await inspectComponent(name,record.root);
 assert.equal(inspected.sources[name],source(nodeFor(name)));
 const diagnostics=await doctor(name);
 assert.equal(diagnostics.ok,true,JSON.stringify(diagnostics));
 assert.equal(diagnostics.service_access,'not-probed');
 const temp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'ops-creative-story-')));
 t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const target=path.join(temp,name);
 const installed=await materializeComponentSkill(record,name,target);
 assert.equal(installed.entry,path.join(target,'.runtime',path.relative(record.root,record.entry)));
 const runtime=spawnSync(process.execPath,[installed.entry,'version','--json'],{encoding:'utf8'});
 assert.equal(runtime.status,0,runtime.stderr);
 assert.equal(JSON.parse(runtime.stdout).version,record.version);
 const skill=await fs.readFile(path.join(target,'SKILL.md'),'utf8');
 assert.match(skill,/用户选定方向后才开始写完整故事/);
});
