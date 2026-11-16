import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT} from '../src/core.mjs';
import {collectionManifestSchema} from '../scripts/legacy-collection-contract.mjs';

const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'sealwork.collection.json'),'utf8'));
test('published collection metadata is accepted by strict legacy sealwork v1 consumer',()=>{
 assert.deepEqual(collectionManifestSchema.parse(manifest),manifest);
 assert(manifest.platforms.includes('win32'));
 assert.deepEqual(manifest.autoUpdate,{channel:'latest',compatibility:'semver'});
});
test('legacy consumer reproduces the extension rejection and protects future releases',()=>{
 const broken={...manifest,componentChannels:{contract:1,default:'latest',supported:['latest','next'],selection:'per-component',option:'--component-channels'}};
 const result=collectionManifestSchema.safeParse(broken);
 assert.equal(result.success,false);
 assert(result.error.issues.some(i=>i.code==='unrecognized_keys'&&i.keys.includes('componentChannels')&&i.path.length===0));
});
test('actual CLI continues advertising per-component stable and next channel selection',()=>{
 const entry=path.join(ROOT,'bin/taobao-ai-ops.mjs');
 const cap=JSON.parse(execFileSync(process.execPath,[entry,'capabilities','--json'],{encoding:'utf8',env:{...process.env,TAOBAO_AI_OPS_AUTO_UPDATE:'0'}}));
 assert.deepEqual(cap.collectionContract.componentChannels.supported,['latest','next']);
 assert.equal(cap.collectionContract.componentChannels.option,'--component-channels');
 assert.equal(cap.collectionContract.componentChannels.default,'latest');
});
