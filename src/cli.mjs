import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {MANIFEST,PACKAGE,nodeFor,source,nodeVersion,fileHashes,digest,fail,componentRecords,componentRecord} from './core.mjs';
import {checkComponents,installComponents,registerComponent} from './components.mjs';
import {targetRoot,status,install} from './skill-manager.mjs';
import {runScript,doctor,toolEntry} from './runtime.mjs';
import {plan,workflowStatus,createHandoff} from './workflow.mjs';
import {checkUpdate,installUpdate} from './update.mjs';
const print=v=>console.log(JSON.stringify(v,null,2));
function options(args){const out={};for(let i=0;i<args.length;i++){const k=args[i];if(['--json','--adopt','--yes'].includes(k))out[k.slice(2)]=true;else if(['--path','--agent','--target-dir','--name','--node','--profile','--mode','--run-dir','--input','--out','--candidate','--query','--tag','--context','--run-id'].includes(k)){if(!args[i+1]||args[i+1].startsWith('--'))throw fail('USAGE',`${k} needs a value`);out[k.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=args[++i];}else throw fail('USAGE',`Unknown option ${k}`);}return out;}
export async function main(argv){
 const [command,action,...rest]=argv;
 if(!command||['help','--help','-h'].includes(command))return console.log(`taobao-ai-ops ${PACKAGE.version}\nversion | nodes list | node show ID | capabilities\ndoctor --node ID [--mode excel|nas]\nskill source [--name NAME] | skill status|install|update --agent AGENT [--profile research] [--adopt]\ncomponents status|check|install [--agent AGENT --yes]\ncomponents register --name ID --path CHECKOUT --yes [--mode npm]\ncomponent run ID [arguments...] | script NODE SCRIPT [arguments...] | tool run TOOL [arguments...]\nworkflow plan|status --run-dir DIR [--node ID] [--input FILE]\nhandoff create --node ID --input FILE --out FILE [--candidate PATH --query QUERY]\nupdate check|install [--tag latest] [--agent AGENT --yes]`);
 if(['version','--version'].includes(command))return console.log(PACKAGE.version);
 if(command==='script')return runScript(action,rest[0],rest.slice(1));
 if(command==='component'&&action==='run'){
  const record=componentRecord(rest[0]);const r=spawnSync(process.execPath,[record.entry,...rest.slice(1)],{stdio:'inherit',env:{...process.env,TBCLI_UPDATE_CHECK:'0',SYCMCLI_DISABLE_AUTO_UPDATE:'1'}});if(r.error)throw fail('EXECUTION_FAILED',r.error.message);process.exitCode=r.status??1;return;
 }
 if(command==='tool'&&action==='run'){
  const entry=toolEntry(rest[0]);const r=spawnSync(entry.command,[...entry.args,...rest.slice(1)],{stdio:'inherit',env:{...process.env,TBCLI_UPDATE_CHECK:'0',SYCMCLI_DISABLE_AUTO_UPDATE:'1'}});if(r.error)throw fail('CAPABILITY_UNAVAILABLE',r.error.message);process.exitCode=r.status??1;return;
 }
 if(command==='nodes'&&action==='list')return print(MANIFEST.nodes);
 if(command==='node'&&action==='show')return print(nodeFor(rest[0]));
 if(command==='capabilities')return print({package:PACKAGE.name,version:PACKAGE.version,...MANIFEST});
 if(command==='doctor'){const opts=options(argv.slice(1));const r=await doctor(opts.node,opts.mode);print(r);if(!r.ok)process.exitCode=1;return;}
 const opts=options(rest);
 if(command==='components'){
  if(action==='status')return print({ok:true,components:componentRecords()});
  if(action==='check')return print(await checkComponents());
  if(action==='install')return print(await installComponents(opts));
  if(action==='register')return print(await registerComponent(opts));
 }
 if(command==='skill'){
  if(action==='source'){const selected=opts.name?[nodeFor(opts.name)]:MANIFEST.nodes;const sources=await Promise.all(selected.map(async n=>({skill:n.skill,node:n.id,source:source(n),sourceDigest:digest(await fileHashes(source(n))),version:nodeVersion(n)})));return print(opts.name?sources[0]:{package:PACKAGE.name,version:PACKAGE.version,skills:sources});}
  if(action==='status'){const root=targetRoot(opts);return print({package:PACKAGE.name,root,skills:await Promise.all(MANIFEST.nodes.map(n=>status(root,n)))});}
  if(['install','update'].includes(action)){const records=componentRecords();return print(Object.keys(MANIFEST.components).every(id=>records[id])?await install(opts):await installComponents({...opts,yes:true}));}
 }
 if(command==='workflow'&&action==='plan')return print(await plan(opts));
 if(command==='workflow'&&action==='status')return print(await workflowStatus(opts));
 if(command==='handoff'&&action==='create')return print(await createHandoff(opts));
 if(command==='update'&&action==='check'){const suite=await checkUpdate(opts.tag),components=await checkComponents();print({ok:suite.ok&&components.ok,suite,components});if(!suite.ok||!components.ok)process.exitCode=1;return;}
 if(command==='update'&&action==='install')return print(await installUpdate(opts));
 throw fail('USAGE','Unknown command; run taobao-ai-ops --help');
}
