import {spawnSync} from 'node:child_process';
import {doctor} from '../src/runtime.mjs';
import {componentRecord} from '../src/core.mjs';
const d=await doctor();
// CI has no private 1688 provider or credentials. Verify installed contracts, while local doctor reports service readiness separately.
for(const child of d.children)if(!child.checks.filter(c=>c.id!=='1688-component-runtime').every(c=>c.ok))throw Error('Research dependency smoke failed: '+child.node);
for(const id of ['1688cli','1688-product-sourcing','1688-opportunity-sourcing-research']){
 const r=spawnSync(process.execPath,[componentRecord(id).entry,'capabilities','--json'],{encoding:'utf8'});
 if(r.status!==0)throw Error('1688 component contract unavailable: '+id);
 const c=JSON.parse(r.stdout);if(c.package!=='@petercjl/'+id||!c.capabilities.length)throw Error('Wrong 1688 component contract');
 if(id==='1688cli'&&c.contracts?.products!=='1688-products@1')throw Error('Unsupported product contract');
}
for(const [id,script] of [['category-research','build_report.py'],['product-research','render_report.py']]){
 const record=componentRecord(id);
 const r=spawnSync(process.execPath,[record.entry,'script',script,'--help'],{stdio:'inherit'});
 if(r.status!==0)throw Error('Independent component smoke failed: '+id);
}
console.log('Independent component CLI smoke passed; full method tests belong to each component repository.');
