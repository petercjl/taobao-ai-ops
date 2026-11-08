import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {componentRecord, closure} from '../src/core.mjs';
import {inspectComponent} from '../src/components.mjs';
import {install} from '../src/skill-manager.mjs';

test('the suite resolves and physically installs the published application Skills', async t => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(),'suite-application-skills-'));
 t.after(() => fs.rm(root,{recursive:true,force:true}));
 for(const name of ['product-asset-set','product-scene-replacement']){
  const record=componentRecord(name);
  assert.equal((await inspectComponent(name,record.root)).entry,record.entry);
  assert.ok(closure({profile:'research'}).some(node=>node.skill===name));
  await install({name,targetDir:root,mode:'copy'});
  const script=path.join(root,name,'scripts','asset-guide.mjs');
  assert.equal((await fs.lstat(script)).isSymbolicLink(),false);
  assert.equal(await fs.readFile(script,'utf8'),await fs.readFile(path.join(record.sources[name],'scripts','asset-guide.mjs'),'utf8'));
 }
 assert.ok(closure({name:'product-scene-replacement'}).some(node=>node.skill==='sealseek-media'));
 const seeding=componentRecord('product-seeding-studio');
 assert.equal((await inspectComponent('product-seeding-studio',seeding.root)).entry,seeding.entry);
 assert.ok(closure({profile:'research'}).some(node=>node.skill==='product-seeding-studio'));
 const dependencies=closure({name:'product-seeding-studio'}).map(node=>node.skill);
 for(const name of ['tbcli','xhscli','sealseek-media','product-asset-set'])assert.ok(dependencies.includes(name));
 await install({name:'product-seeding-studio',targetDir:root,mode:'copy'});
 const workflow=path.join(root,'product-seeding-studio','scripts','creative_run.py');
 assert.equal((await fs.lstat(workflow)).isSymbolicLink(),false);
 assert.equal(await fs.readFile(workflow,'utf8'),await fs.readFile(path.join(seeding.sources['product-seeding-studio'],'scripts','creative_run.py'),'utf8'));

});

test('collection graph keeps real managed runtimeEntry paths and rejects failed candidates', async t => {
 const {collectionPrepare}=await import('../src/subscription.mjs');
 const {spawnSync}=await import('node:child_process');
 const parent=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'suite-runtime-entry-')));
 t.after(()=>fs.rm(parent,{recursive:true,force:true}));
 const directory=path.join(parent,'generation');
 const receipt=await collectionPrepare({directory,yes:true});
 for(const skill of receipt.skills){
  assert.equal(typeof skill.runtimeEntry,'string');
  assert.ok(skill.runtimeEntry.startsWith(directory+path.sep));
  assert.ok((await fs.lstat(skill.runtimeEntry)).isFile());
 }
 for(const name of ['product-asset-set','product-scene-replacement','product-seeding-studio']){
  const skill=receipt.skills.find(item=>item.name===name);
  assert.equal(skill.runtimeEntry,path.join(skill.directory,'.runtime/bin',name+'.mjs'));
  const version=spawnSync(process.execPath,[skill.runtimeEntry,'version','--json'],{encoding:'utf8'});
  assert.equal(version.status,0,version.stderr);
  const identity=JSON.parse(version.stdout);
  assert.equal(identity.package,skill.package);
  assert.equal(identity.version,skill.version);
  const marker=JSON.parse(await fs.readFile(path.join(skill.directory,'.collection-runtime.json'),'utf8'));
  assert.equal(marker.runtimeEntry,skill.runtimeEntry);
  assert.equal(marker.version,skill.version);
 }
 const persisted=await fs.readFile(path.join(directory,'collection.json'));
 const failed=path.join(parent,'rejected-generation');
 await assert.rejects(collectionPrepare({directory:failed,yes:true},{
  run:async()=>{throw Error('acquisition failed before activation');},
 }),/acquisition failed/);
 await assert.rejects(fs.lstat(failed),{code:'ENOENT'});
 assert.deepEqual(await fs.readFile(path.join(directory,'collection.json')),persisted);
});
