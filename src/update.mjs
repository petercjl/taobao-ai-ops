import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {existsSync,realpathSync} from 'node:fs';
import {ROOT,PACKAGE,fail,stateRoot} from './core.mjs';
export async function checkUpdate(tag='latest'){
 if(!['latest','next'].includes(tag))throw fail('USAGE','Tag must be latest or next');
 try{const r=await fetch(`https://registry.npmjs.org/${encodeURIComponent(PACKAGE.name)}`,{signal:AbortSignal.timeout(15000)});if(r.status===404)return {ok:true,published:false,current:PACKAGE.version,updateAvailable:false,tag};if(!r.ok)throw Error(`Registry HTTP ${r.status}`);const p=await r.json();const version=p['dist-tags']?.[tag];return {ok:true,published:true,current:PACKAGE.version,available:version,updateAvailable:Boolean(version&&version!==PACKAGE.version),tag};}
 catch(e){return {ok:false,code:'REGISTRY_UNAVAILABLE',current:PACKAGE.version,updateAvailable:false,message:e.message,offline:'keep-current'};}
}
export function npm(args){
 let cli=process.env.npm_execpath;
 if(!cli||!cli.endsWith('npm-cli.js')){
  const found=spawnSync(process.platform==='win32'?'where':'which',[process.platform==='win32'?'npm.cmd':'npm'],{encoding:'utf8',timeout:10000});
  const launcher=found.stdout?.trim().split(/\r?\n/)[0];
  cli=launcher?(process.platform==='win32'?path.join(path.dirname(launcher),'node_modules','npm','bin','npm-cli.js'):realpathSync(launcher)):null;
 }
 if(!cli||!existsSync(cli))throw fail('NPM_UNAVAILABLE','Cannot resolve npm-cli.js for the active runtime');
 const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:180000});if(r.status!==0)throw fail('UPDATE_FAILED',r.error?.message||r.stderr||'npm failed');return r.stdout;
}
export async function installUpdate(opts){
 if(!opts.yes)throw fail('AUTHORIZATION_REQUIRED','Use --yes for the requested package update');
 if(!opts.agent&&!opts.targetDir)throw fail('USAGE','Specify --agent or --target-dir before updating');
 const nodeModules=path.dirname(path.dirname(ROOT.slice(0,-1)));
 if(path.basename(nodeModules)!=='node_modules'||(process.platform!=='win32'&&path.basename(path.dirname(nodeModules))!=='lib'))throw fail('SOURCE_CHECKOUT','This source or local test install updates through its owner, not global npm');
 const check=await checkUpdate(opts.tag||'latest');if(!check.ok)throw fail(check.code,check.message);if(!check.updateAvailable)return {...check,components:await (await import('./components.mjs')).installComponents(opts)};
 // Persist the installed version as a local archive for recovery, including unpublished prerequisites.
 const backup=await fs.mkdtemp(path.join(await fs.mkdir(path.join(stateRoot(),'package-backups'),{recursive:true}).then(()=>path.join(stateRoot(),'package-backups')),'update-'));
 const packed=JSON.parse(npm(['pack',ROOT,'--ignore-scripts','--pack-destination',backup,'--json']))[0];
 const prefix=process.platform==='win32'?path.dirname(nodeModules):path.dirname(path.dirname(nodeModules));
 try{
  npm(['install','--global','--prefix',prefix,'--ignore-scripts',`${PACKAGE.name}@${check.available}`]);
  const fresh=path.join(nodeModules,...PACKAGE.name.split('/'),'bin','taobao-ai-ops.mjs');
  const args=['components','install','--yes','--json'];if(opts.targetDir)args.push('--target-dir',opts.targetDir);else if(opts.agent)args.push('--agent',opts.agent);else throw fail('USAGE','Specify the Agent or custom target for managed Skill synchronization');
  const r=spawnSync(process.execPath,[fresh,...args],{encoding:'utf8',timeout:300000});if(r.status!==0)throw fail('SKILL_SYNC_FAILED',r.stderr||r.error?.message||'Skill synchronization failed');
  const v=spawnSync(process.execPath,[fresh,'version'],{encoding:'utf8',timeout:10000});if(v.stdout.trim()!==check.available)throw fail('UPDATE_VERIFY_FAILED','Installed version differs from registry selection');
  return {ok:true,from:PACKAGE.version,to:check.available,backup:path.join(backup,packed.filename),skills:JSON.parse(r.stdout)};
 }catch(e){npm(['install','--global','--prefix',prefix,'--ignore-scripts',path.join(backup,packed.filename)]);const restored=path.join(nodeModules,...PACKAGE.name.split('/'),'bin','taobao-ai-ops.mjs');const args=['skill','update','--json',...(opts.targetDir?['--target-dir',opts.targetDir]:['--agent',opts.agent])];const synced=spawnSync(process.execPath,[restored,...args],{encoding:'utf8',timeout:60000});if(synced.status!==0)throw fail('ROLLBACK_SYNC_REQUIRED','Old package restored; managed Skill recovery needs attention',{original_error:e.message,backup:path.join(backup,packed.filename)});throw e;}
}
