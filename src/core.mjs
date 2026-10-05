import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const PACKAGE=JSON.parse(await fs.readFile(path.join(ROOT,'package.json'),'utf8'));
export const MANIFEST=JSON.parse(await fs.readFile(path.join(ROOT,'suite-manifest.json'),'utf8'));
export const fail=(code,message,details)=>Object.assign(new Error(message),{code,details});
export const json=p=>fs.readFile(p,'utf8').then(JSON.parse);
export const stat=p=>fs.lstat(p).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
export const hash=data=>createHash('sha256').update(data).digest('hex');
export function nodeFor(id){const n=MANIFEST.nodes.find(n=>n.id===id||n.skill===id);if(!n)throw fail('UNKNOWN_NODE',`Unknown node: ${id}`);return n;}
export function componentRecords(){const file=path.join(stateRoot(),'components.json');return existsSync(file)?JSON.parse(readFileSync(file,'utf8')).components||{}:{};}
export function componentRecord(id){const r=componentRecords()[id];if(!r)throw fail('COMPONENT_NOT_INSTALLED',`Install registered component ${id} with components install`);return r;}
export const source=n=>n.component?componentRecord(n.component).sources[n.skill]||(()=>{throw fail('SKILL_SOURCE_MISSING',n.skill);})():path.join(ROOT,'skills',n.skill);
export const nodeVersion=n=>n.component?componentRecord(n.component).version:PACKAGE.version;
export function stateRoot(){return process.env.TAOBAO_AI_OPS_STATE_DIR||path.join(os.homedir(),'.local','state','taobao-ai-ops');}
export async function fileHashes(root,rel=''){
 const out={};
 for(const e of (await fs.readdir(path.join(root,rel),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  if(['__pycache__','tests','.suite-install.json','.install-meta.json'].includes(e.name)||/\.pyc$/.test(e.name))continue;
  const r=path.join(rel,e.name);
  if(e.isDirectory())Object.assign(out,await fileHashes(root,r));
  else if(e.isFile())out[r.replaceAll(path.sep,'/')]=hash(await fs.readFile(path.join(root,r)));
  else throw fail('UNSAFE_SOURCE',`Unsupported resource type: ${r}`);
 }
 return out;
}
export const digest=files=>hash(JSON.stringify(files));
export function closure(opts={}){
 const selected=opts.name?[nodeFor(opts.name)]:opts.node?[nodeFor(opts.node)]:MANIFEST.profiles[opts.profile||'research']?.map(nodeFor);
 if(!selected)throw fail('UNKNOWN_PROFILE',`Unknown profile: ${opts.profile}`);
 const names=new Set();function visit(n){if(names.has(n.skill))return;names.add(n.skill);for(const dep of n.requires_skills)visit(nodeFor(dep));}selected.forEach(visit);
 return MANIFEST.nodes.filter(n=>names.has(n.skill));
}
