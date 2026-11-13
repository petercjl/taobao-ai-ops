import {verifyPublication} from './verify-npm-publication.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.ACTIONS_ID_TOKEN_REQUEST_URL)throw Error('OIDC_ENVIRONMENT_REQUIRED');
const version=get('--release'),tag=get('--tag'),runId=get('--validated-run');
if(!/^\d+\.\d+\.\d+$/.test(version)||tag!=='latest'||!/^\d+$/.test(runId))throw Error('EXACT_STABLE_RELEASE_REQUIRED');
const invoke=(command,argv,options={})=>exec(command,argv,{maxBuffer:16*1024*1024,...options});
const repo=process.env.GITHUB_REPOSITORY;
const run=JSON.parse((await invoke('gh',['api','repos/'+repo+'/actions/runs/'+runId])).stdout);
if(run.conclusion!=='success'||run.path!=='.github/workflows/publish-npm.yml')throw Error('VALIDATED_RELEASE_REQUIRED');
const ref='v'+version,commit=(await invoke('git',['rev-parse',ref])).stdout.trim();
const changes=(await invoke('git',['diff','--name-only',run.head_sha,commit])).stdout.trim().split('\n').filter(Boolean);
if(changes.some(p=>!['package.json','package-lock.json'].includes(p)))throw Error('VALIDATED_SOURCE_MISMATCH');
const before=JSON.parse((await invoke('git',['show',run.head_sha+':package.json'])).stdout),after=JSON.parse((await invoke('git',['show',ref+':package.json'])).stdout);
if(after.version!==version)throw Error('TAG_VERSION_MISMATCH');
before.version=after.version;if(JSON.stringify(before)!==JSON.stringify(after))throw Error('PACKAGE_CONTRACT_CHANGED');
const registry='https://registry.npmjs.org/'+encodeURIComponent(after.name);
async function observe(){const r=await fetch(registry+'?verify='+Date.now(),{signal:AbortSignal.timeout(15000),headers:{'cache-control':'no-cache'}});if(!r.ok)throw Error('REGISTRY_UNAVAILABLE');return r.json();}
const current=await observe();if(current.versions?.[version]){if(current['dist-tags']?.[tag]!==version)throw Error('EXISTING_VERSION_TAG_MISMATCH');console.log(JSON.stringify({...await verifyPublication({name:after.name,version,tag}),action:'already-public'}));process.exit(0);}
const work=await fs.mkdtemp(path.join(os.tmpdir(),'npm-publication-recovery-'));
try{
 const archive=path.join(work,'source.tar');await invoke('git',['archive','--format=tar','--output',archive,ref]);
 const source=path.join(work,'source');await fs.mkdir(source);await invoke('tar',['-xf',archive,'-C',source]);
 const npmCli=process.env.npm_execpath;
 // Resolve the workflow's pinned npm executable rather than an inherited npx entry.
 const npm=(await invoke('which',['npm'])).stdout.trim();
 const packed=await invoke(npm,['pack','--json','--pack-destination',work],{cwd:source});console.log(packed.stderr);
 const info=JSON.parse(packed.stdout.slice(packed.stdout.lastIndexOf('\n[')+1))[0];
 console.log(JSON.stringify({phase:'verified-tag-pack',package:after.name,version,sourceCommit:commit,validatedRun:runId,integrity:info.integrity}));
 const env={...process.env,NODE_AUTH_TOKEN:'',npm_config_dry_run:'false'};
 // OIDC publication only: no version bump, tag replacement, write token or local publish.
 const result=await invoke(npm,['publish',path.join(work,info.filename),'--tag',tag,'--access','public','--provenance','--dry-run=false'],{cwd:source,env});console.log(result.stdout);console.log(result.stderr);
 const verified=await verifyPublication({name:after.name,version,tag});
 if(verified.integrity!==info.integrity)throw Error('PUBLIC_ARTIFACT_IDENTITY_MISMATCH');
 console.log(JSON.stringify({...verified,sourceCommit:commit,validatedRun:runId}));
}finally{await fs.rm(work,{recursive:true,force:true});}
