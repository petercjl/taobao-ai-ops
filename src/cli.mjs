import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {MANIFEST,PACKAGE,closure,nodeFor,source,nodeVersion,fileHashes,digest,fail,componentRecords,componentRecord} from './core.mjs';
import {checkComponents,installComponents,registerComponent,prepareComponentRun} from './components.mjs';
import {targetRoot,status,install} from './skill-manager.mjs';
import {runScript,doctor,toolEntry,componentEnvironment,assertDependencies} from './runtime.mjs';
import {plan,workflowStatus,createHandoff} from './workflow.mjs';
import {checkUpdate,installUpdate} from './update.mjs';
import {collectionCheck,collectionPrepare} from './subscription.mjs';
import fs from 'node:fs/promises';
const CONTRACT=JSON.parse(await fs.readFile(new URL('../capabilities.json',import.meta.url),'utf8'));
const print=v=>console.log(JSON.stringify(v,null,2));
function options(args){const out={};for(let i=0;i<args.length;i++){const k=args[i];if(['--json','--adopt','--yes','--owned'].includes(k)){if(Object.hasOwn(out,k.slice(2)))throw fail('USAGE','Duplicate option '+k);out[k.slice(2)]=true;}else if(['--component-channels','--accept-component-upgrades','--directory','--previous','--path','--agent','--target-dir','--name','--node','--profile','--mode','--run-dir','--input','--out','--candidate','--query','--tag','--context','--run-id'].includes(k)){if(!args[i+1]||args[i+1].startsWith('--'))throw fail('USAGE',`${k} needs a value`);const key=k.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(Object.hasOwn(out,key))throw fail('USAGE','Duplicate option '+k);out[key]=args[++i];}else throw fail('USAGE',`Unknown option ${k}`);}return out;}
export async function main(argv){
 const [command,action,...rest]=argv;
 if(['--help','help'].includes(command)&&argv.includes('--json'))return print(CONTRACT);
 if(argv.includes('--help')&&command==='skill')return print(CONTRACT.commandContracts['skill '+action]||{});
 if(['component','tool','script'].includes(command)&&!['version','--version','--help','help','capabilities','skill','doctor'].includes(command==='script'?null:rest[1])){await (await import('./update.mjs')).detectUpdate();}
 if(!command||['help','--help','-h'].includes(command))return console.log(`taobao-ai-ops ${PACKAGE.version}\nversion | nodes list | node show ID | capabilities\ncollection check [--previous RECEIPT] --json | collection prepare --directory NEW --yes --json [--previous RECEIPT] [--accept-component-upgrades ID,ID]\ndoctor --node ID [--mode excel|nas]\nskill source [--name NAME] | skill status|install|update --agent AGENT [--profile research] [--adopt]\ncomponents status|check|install [--agent AGENT --yes]\ncomponents register --name ID --path CHECKOUT --yes [--mode npm]\ncomponent run ID [arguments...] | script NODE SCRIPT [arguments...] | tool run TOOL [arguments...]\nworkflow plan|status --run-dir DIR [--node ID] [--input FILE]\nhandoff create --node ID --input FILE --out FILE [--candidate PATH --query QUERY]\nupdate check|install [--tag latest] [--agent AGENT --yes]`);
 if(['version','--version'].includes(command))return action==='--json'?print({ok:true,package:PACKAGE.name,version:PACKAGE.version}):console.log(PACKAGE.version);
 if(command==='script')return runScript(action,rest[0],rest.slice(1));
 if(command==='component'&&action==='run'){
  if(!['version','--version','--help','help','capabilities','skill','doctor'].includes(rest[1]))assertDependencies(rest[0]);
  await prepareComponentRun(rest[0]);
  const record=componentRecord(rest[0]);if(!record.entry)throw fail('INVALID_COMPONENT_ENTRY','Use skill source for this application Skill');const r=spawnSync(process.execPath,[record.entry,...rest.slice(1)],{stdio:'inherit',env:componentEnvironment(rest[0])});if(r.error)throw fail('EXECUTION_FAILED',r.error.message);process.exitCode=r.status??1;return;
 }
 if(command==='tool'&&action==='run'){
  if(!['version','--version','--help','help','capabilities','skill','doctor'].includes(rest[1]))assertDependencies(MANIFEST.tools[rest[0]]?.component);
  await prepareComponentRun(MANIFEST.tools[rest[0]]?.component);
  const entry=toolEntry(rest[0]);const r=spawnSync(entry.command,[...entry.args,...rest.slice(1)],{stdio:'inherit',env:componentEnvironment(MANIFEST.tools[rest[0]]?.component)});if(r.error)throw fail('CAPABILITY_UNAVAILABLE',r.error.message);process.exitCode=r.status??1;return;
 }
 if(command==='nodes'&&action==='list')return print(MANIFEST.nodes);
 if(command==='node'&&action==='show')return print(nodeFor(rest[0]));
 if(command==='capabilities')return print({package:PACKAGE.name,version:PACKAGE.version,...MANIFEST,...CONTRACT,collectionContract:{schemaVersion:1,componentChannels:{option:'--component-channels',format:'JSON object keyed by registered component id',default:'latest',supported:['latest','next'],explicitSwitchMayDowngrade:true},manifest:'sealwork.collection.json',check:['collection','check','--json'],prepare:['collection','prepare','--directory','{newDirectory}','--yes','--json'],previousOption:'--previous',migrationOption:'--accept-component-upgrades',migrationPolicy:'Explicitly approved component IDs may cross compatibility boundaries; unselected incompatible versions stay pinned; downgrades stay blocked',installationMode:'host-owned-generation',hostDiscoveryAuthority:'host'}});
 if(command==='doctor'){const opts=options(argv.slice(1));const r=await doctor(opts.node,opts.mode);print(r);if(!r.ok)process.exitCode=1;return;}
 const opts=options(rest);
 if(command==='collection'){
  if(action==='check')return print(await collectionCheck(opts.previous?JSON.parse(await fs.readFile(opts.previous,'utf8')):undefined,undefined,opts.acceptComponentUpgrades,opts.componentChannels));
  if(action==='prepare')return print(await collectionPrepare(opts));
 }

 if(command==='components'){
  if(action==='status')return print({ok:true,components:componentRecords()});
  if(action==='check')return print(await checkComponents());
  if(action==='install')return print(await installComponents(opts));
  if(action==='register')return print(await registerComponent(opts));
 }
 if(command==='skill'){
  if(action==='source'){const selected=opts.name?[nodeFor(opts.name)]:opts.owned?MANIFEST.nodes.filter(n=>!n.component):MANIFEST.nodes;const sources=await Promise.all(selected.map(async n=>({ok:true,package:PACKAGE.name,suiteVersion:PACKAGE.version,skill:n.skill,node:n.id,source:source(n),sourceDigest:digest(await fileHashes(source(n))),version:nodeVersion(n)})));const own=MANIFEST.nodes.find(n=>!n.component);return print(opts.name?sources[0]:{...CONTRACT,ok:true,complete:true,package:PACKAGE.name,version:PACKAGE.version,suiteVersion:PACKAGE.version,skill:own.skill,source:source(own),sources,skills:sources});}
  if(action==='status'){const root=targetRoot(opts);if(opts.name)return print(await status(root,nodeFor(opts.name)));const nodes=opts.owned?MANIFEST.nodes.filter(n=>!n.component):MANIFEST.nodes;return print({...await status(root,MANIFEST.nodes.find(n=>!n.component)),root,skills:await Promise.all(nodes.map(n=>status(root,n)))});}
  if(['install','update'].includes(action)){const records=componentRecords();return print(closure(opts).filter(n=>n.component).every(n=>records[n.component])?await install(opts):await installComponents({...opts,yes:true}));}
 }
 if(command==='workflow'&&action==='plan')return print(await plan(opts));
 if(command==='workflow'&&action==='status')return print(await workflowStatus(opts));
 if(command==='handoff'&&action==='create')return print(await createHandoff(opts));
 if(command==='update'&&action==='check'){const suite=await checkUpdate(opts.tag),components=await checkComponents();print({ok:suite.ok&&components.ok,suite,components});if(!suite.ok||!components.ok)process.exitCode=1;return;}
 if(command==='update'&&action==='recover'){if(!opts.yes)throw fail('AUTHORIZATION_REQUIRED','Recovery needs --yes');return print(await install(opts));}
 if(command==='update'&&action==='install')return print(await installUpdate(opts));
 throw fail('USAGE','Unknown command; run taobao-ai-ops --help');
}
