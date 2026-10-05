import {spawnSync} from 'node:child_process';
import {doctor} from '../src/runtime.mjs';
import {componentRecord} from '../src/core.mjs';
const d=await doctor();if(!d.ok)throw Error('Research dependency smoke failed');
for(const [id,script] of [['category-research','build_report.py'],['product-research','render_report.py']]){
 const record=componentRecord(id);
 const r=spawnSync(process.execPath,[record.entry,'script',script,'--help'],{stdio:'inherit'});
 if(r.status!==0)throw Error('Independent component smoke failed: '+id);
}
console.log('Independent component CLI smoke passed; full method tests belong to each component repository.');
