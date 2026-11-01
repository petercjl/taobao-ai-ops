import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {verifyTestComponents} from '../scripts/test-environment.mjs';

test('test bootstrap refuses absent members and drifted versions before executing tests',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'suite-test-state-'));
 try{
  const components={app:{package:'@example/app',bin:'app'}};
  await assert.rejects(verifyTestComponents(root,components),/TEST_COMPONENTS_MISSING/);
  const record={package:'@example/app',version:'1.0.0',root,entry:path.join(root,'app.mjs')};
  await fs.writeFile(path.join(root,'components.json'),JSON.stringify({components:{app:record}}));
  await fs.writeFile(path.join(root,'app.mjs'),'');
  const packageFile=path.join(root,'package.json');
  await fs.writeFile(packageFile,JSON.stringify({name:'@example/app',version:'1.1.0',bin:{app:'app.mjs'}}));
  await assert.rejects(verifyTestComponents(root,components),/TEST_COMPONENT_VERSION_DRIFT/);
  await fs.writeFile(packageFile,JSON.stringify({name:'@example/app',version:'1.0.0',bin:{app:'app.mjs'}}));
  assert.equal((await verifyTestComponents(root,components)).app.version,'1.0.0');
  record.entry=path.join(root,'other.mjs');await fs.writeFile(record.entry,'');
  await fs.writeFile(path.join(root,'components.json'),JSON.stringify({components:{app:record}}));
  await assert.rejects(verifyTestComponents(root,components),/TEST_COMPONENT_ENTRY_MISMATCH/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
