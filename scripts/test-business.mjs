import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from '../src/core.mjs';
import {resolvePython} from '../src/runtime.mjs';
const python=resolvePython(['pandas','numpy','openpyxl','PIL','jieba']);if(!python)throw Error('A Python with requirements.txt imports is required');
const commands=[
 [python.command,[...python.prefix,'-m','unittest','discover','-s',path.join(ROOT,'skills/yuce-category-opportunity-report/tests'),'-q']],
 [process.execPath,[path.join(ROOT,'skills/yuce-category-opportunity-report/tests/test_navigation.cjs')]],
 [process.execPath,[path.join(ROOT,'skills/yuce-category-opportunity-report/tests/test_chart_views.cjs')]],
 [python.command,[...python.prefix,'-m','unittest','discover','-s',path.join(ROOT,'test/product'),'-q']],
];
for(const [bin,args] of commands){const r=spawnSync(bin,args,{stdio:'inherit',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});if(r.status!==0)process.exit(r.status||1);}
