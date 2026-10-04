import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,MANIFEST,PACKAGE,nodeFor,source,closure} from '../src/core.mjs';
const seen=new Set();const skills=new Set();
for(const n of MANIFEST.nodes){
 if(!/^[a-z][a-z0-9-]+$/.test(n.id)||seen.has(n.id)||skills.has(n.skill))throw Error('Duplicate or invalid suite identity');seen.add(n.id);skills.add(n.skill);
 const text=await fs.readFile(path.join(source(n),'SKILL.md'),'utf8');if(!text.includes(`name: ${n.skill}\n`))throw Error('Skill name mismatch '+n.skill);
 const cap=JSON.parse(await fs.readFile(path.join(source(n),'capabilities.json'),'utf8'));if(cap.skill!==n.skill)throw Error('Capability mismatch '+n.skill);
 for(const agent of ['codex','sealseek']){const a=JSON.parse(await fs.readFile(path.join(source(n),'adapters',agent+'.json'),'utf8'));if(a.platform!==agent)throw Error('Adapter mismatch');}
 for(const dep of n.requires_skills)nodeFor(dep);
 for(const s of n.scripts){if(!/^[a-z][a-z0-9_]*\.(py|mjs)$/.test(s))throw Error('Unsafe script name');await fs.access(path.join(source(n),'scripts',s));}
}
for(const profile of Object.keys(MANIFEST.profiles))closure({profile});
for(const [id,t] of Object.entries(MANIFEST.tools)){if(t.package&&PACKAGE.dependencies[t.package]!==t.version)throw Error('Tool pin differs: '+id);}
console.log(JSON.stringify({ok:true,package:PACKAGE.name,skills:skills.size,nodes:seen.size,note:'Suite structure; runtime and native Agent checks are separate.'}));
