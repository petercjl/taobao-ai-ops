import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,MANIFEST,PACKAGE,nodeFor,source,closure} from '../src/core.mjs';
import {skillName} from './skill-identity.mjs';
const seen=new Set();const skills=new Set();
for(const n of MANIFEST.nodes){
 if(!/^[a-z][a-z0-9-]+$/.test(n.id)||seen.has(n.id)||skills.has(n.skill))throw Error('Duplicate or invalid suite identity');seen.add(n.id);skills.add(n.skill);
 for(const dep of n.requires_skills)nodeFor(dep);
 if(n.component){const c=MANIFEST.components[n.component];if(!c||!c.skills.includes(n.skill))throw Error('Unknown component registration');continue;}
 const text=await fs.readFile(path.join(source(n),'SKILL.md'),'utf8');if(skillName(text)!==n.skill)throw Error('Skill name mismatch '+n.skill);
 const cap=JSON.parse(await fs.readFile(path.join(source(n),'capabilities.json'),'utf8'));if(cap.skill!==n.skill)throw Error('Capability mismatch '+n.skill);
 for(const agent of ['codex','sealseek','workbuddy']){const a=JSON.parse(await fs.readFile(path.join(source(n),'adapters',agent+'.json'),'utf8'));if(a.platform!==agent)throw Error('Adapter mismatch');}
 for(const dep of n.requires_skills)nodeFor(dep);
 for(const s of n.scripts){if(!/^[a-z][a-z0-9_]*\.(py|mjs)$/.test(s))throw Error('Unsafe script name');await fs.access(path.join(source(n),'scripts',s));}
}
for(const profile of Object.keys(MANIFEST.profiles))closure({profile});
for(const [id,t] of Object.entries(MANIFEST.tools)){if(t.package&&MANIFEST.components[t.component]?.package!==t.package)throw Error('Unknown component tool: '+id);}
console.log(JSON.stringify({ok:true,package:PACKAGE.name,skills:skills.size,nodes:seen.size,note:'Suite structure; runtime and native Agent checks are separate.'}));
