import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {componentRecord, closure} from '../src/core.mjs';
import {inspectComponent} from '../src/components.mjs';
import {install} from '../src/skill-manager.mjs';

test('the suite resolves and physically installs both published application Skills', async t => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(),'suite-application-skills-'));
 t.after(() => fs.rm(root,{recursive:true,force:true}));
 for(const name of ['product-asset-set','product-scene-replacement']){
  const record=componentRecord(name);
  assert.equal((await inspectComponent(name,record.root)).entry,null);
  assert.ok(closure({profile:'research'}).some(node=>node.skill===name));
  await install({name,targetDir:root,mode:'copy'});
  const script=path.join(root,name,'scripts','asset-guide.mjs');
  assert.equal((await fs.lstat(script)).isSymbolicLink(),false);
  assert.equal(await fs.readFile(script,'utf8'),await fs.readFile(path.join(record.sources[name],'scripts','asset-guide.mjs'),'utf8'));
 }
 assert.ok(closure({name:'product-scene-replacement'}).some(node=>node.skill==='sealseek-media'));
});
