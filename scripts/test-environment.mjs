import fs from 'node:fs/promises';
import path from 'node:path';

// Tests use their own package set, never the operator's mutable component registry.
export async function verifyTestComponents(state,components){
 const file=path.join(state,'components.json');
 let records;try{records=JSON.parse(await fs.readFile(file,'utf8')).components;}catch{throw Error('TEST_COMPONENTS_MISSING: prepare the isolated test component environment');}
 for(const [id,contract] of Object.entries(components)){
  const r=records?.[id];if(!r)throw Error('TEST_COMPONENTS_MISSING: '+id);
  const actual=JSON.parse(await fs.readFile(path.join(r.root,'package.json'),'utf8'));
  if(r.package!==contract.package||actual.name!==r.package||actual.version!==r.version)throw Error('TEST_COMPONENT_VERSION_DRIFT: '+id);
  if(contract.kind==='application-skill'){
   const {readSources}=await import('../src/subscription.mjs');
   const sources=await readSources(null,r.root,contract);
   if(r.entry!==null||sources.some(({name,source})=>r.sources?.[name]!==source))throw Error('TEST_COMPONENT_ENTRY_MISMATCH: '+id);
   continue;
  }
  const entry=await fs.realpath(r.entry),root=await fs.realpath(r.root),relative=path.relative(root,entry);
  const bin=typeof actual.bin==='string'?actual.bin:actual.bin?.[contract.bin];
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||!bin||entry!==await fs.realpath(path.resolve(root,bin)))throw Error('TEST_COMPONENT_ENTRY_MISMATCH: '+id);
 }
 return records;
}
