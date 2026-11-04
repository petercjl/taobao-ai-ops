import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,MANIFEST} from '../src/core.mjs';
import {installComponents} from '../src/components.mjs';
import {verifyTestComponents} from './test-environment.mjs';

const selected=process.env.TAOBAO_AI_OPS_TEST_STATE_DIR;
const base=selected?null:await fs.mkdtemp(path.join(os.tmpdir(),'taobao-ai-ops-test-environment-'));
const state=selected?path.resolve(selected):path.join(base,'state');
process.env.TAOBAO_AI_OPS_STATE_DIR=state;
process.env.TAOBAO_AI_OPS_AUTO_UPDATE='0';
try{
 if(base){
  console.log('Preparing independent published components for tests.');
  await installComponents({yes:true,targetDir:path.join(base,'skills'),mode:'copy'});
 }
 await verifyTestComponents(state,MANIFEST.components);
 const files=(await fs.readdir(path.join(ROOT,'test'))).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>path.join(ROOT,'test',f));
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--test',...files],{stdio:'inherit',env:process.env});
  child.once('error',reject);child.once('exit',code=>resolve(code??1));
 });
 process.exitCode=code;
 if(base&&code===0)await fs.rm(base,{recursive:true,force:true});
 else if(base)console.error('Test recovery environment retained: '+base);
}catch(error){console.error(error.message);if(base)console.error('Test recovery environment retained: '+base);process.exitCode=1;}
