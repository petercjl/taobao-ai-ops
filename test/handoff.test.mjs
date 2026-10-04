import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHandoff,plan} from '../src/workflow.mjs';
import {hash} from '../src/core.mjs';
test('category handoff binds exact evidence, selected path and explicit query',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'taobao-handoff-')),input=path.join(root,'analysis.json'),out=path.join(root,'handoff.json');const data={contract:'yuce-category-opportunity@2.0',category:'测试',months:['2024-09','2026-08'],stats:[{level:3,path:['测试','A','B'],recent:123.456}]};await fs.writeFile(input,JSON.stringify(data));
 await assert.rejects(createHandoff({node:'category-research',input,out,candidate:'测试 > A > B'}),e=>e.code==='HANDOFF_INCOMPLETE');
 const r=await createHandoff({node:'category-research',input,out,candidate:'测试 > A > B',query:'B'});assert.equal(r.handoff.source_hashes[0].sha256,hash(await fs.readFile(input)));assert.equal(r.handoff.payload.selected.recent,123.456);assert.equal(r.handoff.next_requests[0].status,'needs_input');await assert.rejects(createHandoff({node:'category-research',input,out,candidate:'测试 > A > B',query:'B'}),e=>e.code==='OUTPUT_EXISTS');
});
test('node can be planned independently; existing plan is preserved',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'taobao-plan-'));const r=await plan({runDir:root,node:'product-research'});assert.deepEqual(r.nodes.map(n=>n.node_id),['product-research']);assert.equal(r.nodes[0].verified,false);await assert.rejects(plan({runDir:root,node:'category-research'}),e=>e.code==='OUTPUT_EXISTS');
});
