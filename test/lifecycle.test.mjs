import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {install,status,targetRoot} from '../src/skill-manager.mjs';
import {nodeFor,closure,source} from '../src/core.mjs';
import {pythonCandidates,runScript} from '../src/runtime.mjs';
const temp=()=>fs.mkdtemp(path.join(os.tmpdir(),'taobao-suite-test-'));

test('profile closure installs all independently discoverable canonical Skills',async()=>{
 const root=await temp();const r=await install({targetDir:root,mode:'copy'});assert.equal(r.skills.length,closure().length);
 for(const n of closure())assert.equal((await status(root,n)).state,'current');
 const repeated=await install({targetDir:root,mode:'copy'});assert.ok(repeated.skills.every(s=>s.action==='unchanged'));
});
test('preflight refuses unmanaged targets without partial migration',async()=>{
 const root=await temp();const dest=path.join(root,nodeFor('product-research').skill);await fs.mkdir(dest);await fs.writeFile(path.join(dest,'user-note.md'),'保留');
 await assert.rejects(install({targetDir:root,mode:'copy'}),e=>e.code==='UNMANAGED_TARGET');assert.equal((await status(root,nodeFor('operations'))).state,'absent');assert.equal(await fs.readFile(path.join(dest,'user-note.md'),'utf8'),'保留');
});
test('adoption backs up user-owned Skill, preserving non-ASCII bytes and UI metadata',async()=>{
 const root=await temp();const n=nodeFor('category-research'),dest=path.join(root,n.skill);await fs.mkdir(dest);await fs.writeFile(path.join(dest,'SKILL.md'),'旧内容：砂锅');await fs.writeFile(path.join(dest,'.install-meta.json'),'自定义标题');
 const r=await install({targetDir:root,node:n.id,mode:'copy',adopt:true});assert.equal(await fs.readFile(path.join(r.skills[0].backup,'SKILL.md'),'utf8'),'旧内容：砂锅');assert.equal(await fs.readFile(path.join(dest,'.install-meta.json'),'utf8'),'自定义标题');
 const bytes=await fs.readFile(path.join(dest,'SKILL.md'));assert.deepEqual(bytes,await fs.readFile(path.join(source(n),'SKILL.md')));
});
test('edited managed copies refuse updates; unrelated Skill targets survive',async()=>{
 const root=await temp(),n=nodeFor('category-research');await install({targetDir:root,node:n.id,mode:'copy'});await fs.appendFile(path.join(root,n.skill,'SKILL.md'),'\n用户改动');assert.equal((await status(root,n)).state,'modified');await assert.rejects(install({targetDir:root,node:n.id}),e=>e.code==='LOCAL_CHANGES');
});
test('locked-directory in-place update preserves UI metadata and verifies new digest',async()=>{
 const root=await temp(),n=nodeFor('category-research');await install({targetDir:root,node:n.id,mode:'copy'});const meta=path.join(root,n.skill,'.suite-install.json');const value=JSON.parse(await fs.readFile(meta,'utf8'));value.sourceDigest='previous-source';await fs.writeFile(meta,JSON.stringify(value));await fs.writeFile(path.join(root,n.skill,'.install-meta.json'),'custom-ui');
 const r=await install({targetDir:root,node:n.id},{forceInPlace:true});assert.equal(r.skills[0].strategy,'in-place');assert.equal(r.skills[0].state,'current');assert.equal(await fs.readFile(path.join(root,n.skill,'.install-meta.json'),'utf8'),'custom-ui');
});
test('failed multi-Skill adoption restores all originals',async()=>{
 const root=await temp();for(const n of closure()){await fs.mkdir(path.join(root,n.skill));await fs.writeFile(path.join(root,n.skill,'SKILL.md'),`original-${n.id}`);}
 await assert.rejects(install({targetDir:root,adopt:true,mode:'copy'},{failAfter:2}));for(const n of closure())assert.equal(await fs.readFile(path.join(root,n.skill,'SKILL.md'),'utf8'),`original-${n.id}`);
});
test('unknown targets and path traversal cannot select arbitrary scripts',()=>{
 assert.throws(()=>targetRoot({agent:'unknown'}),e=>e.code==='UNKNOWN_AGENT');assert.throws(()=>runScript('product-research','../../evil.py',[]),e=>e.code==='SCRIPT_NOT_ALLOWED');
 const windows=pythonCandidates('win32','C:/User',{SEALSEEK_HOME:'C:/Agent'});assert.ok(windows.some(p=>p.includes('binaries')&&p.endsWith('python.exe')));
});
