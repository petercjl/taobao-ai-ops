import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,PACKAGE} from '../src/core.mjs';
const exec=promisify(execFile),work=await fs.mkdtemp(path.join(os.tmpdir(),'ops-archived-updater-'));
const npmCli=process.env.npm_execpath;
if(!npmCli)throw Error('Run through npm run test:upgrade so the real npm entry is resolved.');
const npm=async(args,env=process.env)=>exec(process.execPath,[npmCli,...args],{env,timeout:240000,maxBuffer:16*1024*1024});
const run=async(entry,args,env)=>{try{const r=await exec(process.execPath,[entry,...args],{env,timeout:300000,maxBuffer:16*1024*1024});return JSON.parse(r.stdout);}catch(e){throw Error('CLI operation failed: '+args.join(' ')+'\n'+(e.stderr||e.message));}};
let server;
try{
 const source=path.join(work,'source');await fs.mkdir(source);
 for(const item of ['package.json','package-lock.json','capabilities.json','suite-manifest.json','sealwork.collection.json','INSTALL.md','UPDATE.md','README.md','requirements.txt','scripts','bin','src','contracts','skills'])await fs.cp(path.join(ROOT,item),path.join(source,item),{recursive:true});
 // Only candidate selection is controlled; the archived updater and real npm remain unmodified.
 const version=PACKAGE.version==='0.4.17'?'0.4.18':PACKAGE.version;
 const manifest=JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8'));manifest.version=version;await fs.writeFile(path.join(source,'package.json'),JSON.stringify(manifest,null,2));
 const lock=JSON.parse(await fs.readFile(path.join(source,'package-lock.json'),'utf8'));lock.version=version;lock.packages[''].version=version;await fs.writeFile(path.join(source,'package-lock.json'),JSON.stringify(lock,null,2));
 const packed=await npm(['pack',source,'--pack-destination',work,'--json']);const info=JSON.parse(packed.stdout.slice(packed.stdout.lastIndexOf('\n[')+1))[0];const tarball=await fs.readFile(path.join(work,info.filename));
 const prefix=path.join(work,'global');await npm(['install','--global','--prefix',prefix,'--ignore-scripts','--no-audit','--no-fund',PACKAGE.name+'@0.4.17','--registry','https://registry.npmjs.org']);
 const modules=process.platform==='win32'?path.join(prefix,'node_modules'):path.join(prefix,'lib','node_modules');const entry=path.join(modules,...PACKAGE.name.split('/'),'bin','taobao-ai-ops.mjs');
 const oldVersion=JSON.parse((await exec(process.execPath,[entry,'version','--json'])).stdout);assert.equal(oldVersion.version,'0.4.17');
 const originalState=process.env.TAOBAO_AI_OPS_TEST_STATE_DIR||process.env.TAOBAO_AI_OPS_STATE_DIR;
 if(!originalState)throw Error('First install the test components and pass TAOBAO_AI_OPS_TEST_STATE_DIR.');
 const state=path.join(work,'state');await fs.mkdir(state);await fs.copyFile(path.join(originalState,'components.json'),path.join(state,'components.json'));
 const target=path.join(work,'skills'),env={...process.env,TAOBAO_AI_OPS_STATE_DIR:state,TAOBAO_AI_OPS_AUTO_UPDATE:'0'};
 await run(entry,['skill','install','--target-dir',target,'--json'],env);
 const oldBytes=await fs.readFile(path.join(target,'taobao-ai-operations','SKILL.md'));
 let address;
 server=http.createServer((req,res)=>{
  const url=decodeURIComponent(req.url.split('?')[0]);
  if(url.endsWith('.tgz')){res.setHeader('content-type','application/octet-stream');return res.end(tarball);}
  const pkg={...manifest,dist:{tarball:address+'/candidate.tgz',integrity:'sha512-'+createHash('sha512').update(tarball).digest('base64'),shasum:createHash('sha1').update(tarball).digest('hex')}};
  res.setHeader('content-type','application/json');res.end(JSON.stringify({name:PACKAGE.name,'dist-tags':{latest:version},versions:{[version]:pkg}}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));address='http://127.0.0.1:'+server.address().port;
 const preload=path.join(work,'candidate-selection.cjs');
 await fs.writeFile(preload,`const original=globalThis.fetch;globalThis.fetch=async(input,init)=>{const u=String(input);if(u==='https://registry.npmjs.org/'+encodeURIComponent(${JSON.stringify(PACKAGE.name)}))return new Response(JSON.stringify({'dist-tags':{latest:${JSON.stringify(version)}}}),{status:200,headers:{'content-type':'application/json'}});return original(input,init);};`);
 const userconfig=path.join(work,'registry.npmrc');await fs.writeFile(userconfig,'@petercjl:registry='+address+'\nregistry='+address+'\n',{flag:'wx'});
 const upgradeEnv={...env,npm_config_userconfig:userconfig,npm_config_registry:address,NODE_OPTIONS:((process.env.NODE_OPTIONS||'')+' --require '+JSON.stringify(preload)).trim()};
 const result=await run(entry,['update','install','--target-dir',target,'--yes','--json'],upgradeEnv);assert.equal(result.to,version);
 assert.equal(JSON.parse((await exec(process.execPath,[entry,'version','--json'])).stdout).version,version);
 const own=path.join(target,'taobao-ai-operations');assert.equal((await fs.lstat(own)).isSymbolicLink(),false);
 const current=await run(entry,['skill','status','--owned','--target-dir',target,'--json'],env);assert.equal(current.current,true);assert.equal(current.suiteVersion,version);
 const archive=await fs.readFile(result.backup);assert(archive.length>0);const oldRecovery=path.join(work,'old-recovery');await fs.mkdir(oldRecovery);
 await npm(['install','--prefix',oldRecovery,'--ignore-scripts','--no-audit','--no-fund',result.backup]);
 assert.deepEqual(await fs.readFile(path.join(oldRecovery,'node_modules',...PACKAGE.name.split('/'),'skills','taobao-ai-operations','SKILL.md')),oldBytes);
 const same=await run(entry,['skill','update','--owned','--target-dir',target,'--json'],env);assert.equal(same.skills[0].action,'unchanged');
 await fs.appendFile(path.join(own,'SKILL.md'),'\nlocal-edits');
 await assert.rejects(run(entry,['skill','update','--owned','--target-dir',target,'--json'],env),/LOCAL_CHANGES/);
 // Exercise a real published old CLI partial-failure path: package replacement succeeds,
 // the new Skill sync fails on local edits, and the immutable old caller rolls back.
 const editedBytes=await fs.readFile(path.join(own,'SKILL.md'));
 const unrelated=path.join(work,'unrelated.txt');await fs.writeFile(unrelated,'preserve',{flag:'wx'});
 await npm(['install','--global','--prefix',prefix,'--ignore-scripts','--no-audit','--no-fund',PACKAGE.name+'@0.4.17','--registry','https://registry.npmjs.org']);
 await assert.rejects(run(entry,['update','install','--target-dir',target,'--yes','--json'],upgradeEnv),/ROLLBACK_SYNC_REQUIRED/);
 assert.deepEqual(await fs.readFile(path.join(own,'SKILL.md')),editedBytes);
 assert.equal(JSON.parse((await exec(process.execPath,[entry,'version','--json'])).stdout).version,'0.4.17');
 // Explicit recovery preserves the edit snapshot and reuses the already verified candidate.
 const preserved=path.join(work,'user-edit-recovery.md');await fs.writeFile(preserved,editedBytes,{flag:'wx'});
 await fs.writeFile(path.join(own,'SKILL.md'),editedBytes.subarray(0,editedBytes.length-Buffer.byteLength('\nlocal-edits')));
 await npm(['install','--global','--prefix',prefix,'--ignore-scripts','--no-audit','--no-fund',path.join(work,info.filename)]);
 const recovered=await run(entry,['update','recover','--owned','--target-dir',target,'--yes','--json'],env);assert.equal(recovered.ok,true);
 const repeated=await run(entry,['update','recover','--owned','--target-dir',target,'--yes','--json'],env);assert.equal(repeated.skills[0].action,'unchanged');
 assert.deepEqual(await fs.readFile(preserved),editedBytes);assert.equal(await fs.readFile(unrelated,'utf8'),'preserve');
 console.log(JSON.stringify({ok:true,evidence:'real published old CLI with real npm',from:'0.4.17',to:version,historicalMode:process.platform==='win32'?'copy':'link',same_version:'verified-no-op',oldSnapshot:'verified',partialFailure:'rollback-and-edits-preserved',recovery:'candidate-reused-repeat-no-op',localEdits:'preserved',unrelatedTargets:'preserved'}));
}finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 await fs.rm(work,{recursive:true,force:true});
}
