import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export async function verifyPublication({name,version,tag='latest',registry=fetch,attempts=12,delayMs=10000,log=console.log}){
 const base='https://registry.npmjs.org/'+encodeURIComponent(name);let reason='PUBLIC_VERSION_NOT_VISIBLE';
 for(let attempt=0;attempt<attempts;attempt++){
  const options={signal:AbortSignal.timeout(15000),headers:{'cache-control':'no-cache'}};
  const response=await registry(base+'?verify='+Date.now(),options);
  if(!response.ok)throw Error('REGISTRY_UNAVAILABLE');const state=await response.json(),metadata=state.versions?.[version];
  if(metadata&&state['dist-tags']?.[tag]===version){
   const tarball=new URL(metadata.dist.tarball);if(tarball.protocol!=='https:'||tarball.hostname!=='registry.npmjs.org')throw Error('UNEXPECTED_ARTIFACT_ORIGIN');
   const download=await registry(tarball.href,options);
   if(download.ok){const bytes=await download.arrayBuffer(),integrity='sha512-'+createHash('sha512').update(Buffer.from(bytes)).digest('base64');if(integrity!==metadata.dist.integrity)throw Error('PUBLIC_ARTIFACT_IDENTITY_MISMATCH');return {ok:true,package:name,version,tag,integrity,downloadBytes:bytes.byteLength};}
   reason='PUBLIC_ARTIFACT_UNAVAILABLE';
  }
  log(JSON.stringify({phase:'registry-verification',attempt:attempt+1,code:reason}));
  if(attempt+1<attempts)await new Promise(resolve=>setTimeout(resolve,delayMs));
 }
 throw Error(reason);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
 console.log(JSON.stringify(await verifyPublication({name:pkg.name,version:pkg.version,tag:process.argv[2]||'latest'})));
}
