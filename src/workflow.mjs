import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ROOT,PACKAGE,MANIFEST,closure,nodeFor,hash,json,stat,fail} from './core.mjs';
export async function plan(opts){
 if(!opts.runDir)throw fail('USAGE','--run-dir is required');
 const root=path.resolve(opts.runDir),dest=path.join(root,'taobao-ai-ops-run.json');
 if(await stat(dest))throw fail('OUTPUT_EXISTS','Run already exists; use workflow status');
 const nodes=closure(opts).filter(n=>n.id!=='operations');
 const inputs=[];for(const p of [].concat(opts.input||[])){inputs.push({path:path.resolve(p),sha256:hash(await fs.readFile(p))});}
 const value={schema_version:1,run_id:randomUUID(),package:PACKAGE.name,package_version:PACKAGE.version,manifest_sha256:hash(await fs.readFile(path.join(ROOT,'suite-manifest.json'))),created_at:new Date().toISOString(),inputs,nodes:nodes.map(n=>({node_id:n.id,method_version:n.method_version,status:'planned',artifacts:[],verified:false})),context:opts.context||null,requirement:'Each node loads its complete Skill and executes its own QA; planning does not execute business work.'};
 await fs.mkdir(root,{recursive:true});await fs.writeFile(dest,JSON.stringify(value,null,2),{flag:'wx'});return {ok:true,ledger:dest,...value};
}
export async function workflowStatus(opts){if(!opts.runDir)throw fail('USAGE','--run-dir is required');return json(path.join(path.resolve(opts.runDir),'taobao-ai-ops-run.json'));}
export async function createHandoff(opts){
 if(!opts.input||!opts.out||!opts.node)throw fail('USAGE','handoff create requires --node --input --out');
 const n=nodeFor(opts.node);const input=path.resolve(opts.input),data=await json(input);
 if(await stat(opts.out))throw fail('OUTPUT_EXISTS',`Output exists: ${opts.out}`);
 if(n.id==='category-research'&&(!opts.candidate||!opts.query))throw fail('HANDOFF_INCOMPLETE','Select a full category path and an explicit search query');
 let selected=null;
 if(n.id==='category-research'){
  if(data.contract!=='yuce-category-opportunity@2.0')throw fail('HANDOFF_CONTRACT','Expected current category analysis contract');
  const paths=data.stats;
  if(!Array.isArray(paths))throw fail('HANDOFF_CONTRACT','Category analysis must expose the stats array');
  selected=paths.find(x=>x.level===3&&Array.isArray(x.path)&&x.path.join(' > ')===opts.candidate);
  if(!selected)throw fail('CANDIDATE_NOT_FOUND','Exact third-level category path is absent from the supplied analysis');
 }
 const value={schema_version:'taobao-ai-ops-handoff@1',run_id:opts.runId||randomUUID(),node_id:n.id,method_version:n.method_version,source_hashes:[{path:input,sha256:hash(await fs.readFile(input))}],scope:{category:data.category||null,candidate_path:opts.candidate||null,search_query:opts.query||null},time_range:data.months||null,evidence_refs:[input],conclusions:[],unknowns:n.id==='category-research'?['Brand competition, white-label access and product profitability require further evidence.']:[],next_requests:n.id==='category-research'?[{node_id:'product-research',query:opts.query,required_input:'Taobao search-result workbook',status:'needs_input'}]:[],artifacts:[{path:input,kind:'analysis'}],payload:{selected,source_contract:data.contract||data.schema_version||null},limitations:'Context evidence is preserved at its original category/sample grain.'};
 await fs.mkdir(path.dirname(path.resolve(opts.out)),{recursive:true});await fs.writeFile(opts.out,JSON.stringify(value,null,2),{flag:'wx'});return {ok:true,path:path.resolve(opts.out),handoff:value};
}
