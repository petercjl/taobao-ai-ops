import test from 'node:test';
import assert from 'node:assert/strict';
import {doctor,resolvePython,pythonCandidates} from '../src/runtime.mjs';
import {nodeFor} from '../src/core.mjs';
test('suite doctor checks independent children and reports native-image limits',async()=>{
 const r=await doctor();assert.equal(r.children.length,nodeFor('operations').requires_skills.length);assert.ok(r.native_requirements.every(n=>n.status==='requires-active-agent-verification'));assert.equal(r.children.find(n=>n.node==='category-research').service_access,'not-required');assert.ok(r.children.find(n=>n.node==='html-report'));
});
test('missing interpreter and imports cannot pass dependency discovery',()=>{
 assert.equal(resolvePython(['openpyxl'],['nonexistent-suite-python']),null);
 assert.equal(resolvePython(['module_that_is_absent_from_suite'],['python3']),null);
});
test('managed runtime discovery includes Agent and suite environments without an override',()=>{
 const candidates=pythonCandidates('darwin','/test-user',{SEALSEEK_HOME:'/test-agent'});assert.ok(candidates.includes('/test-agent/binaries/python/envs/default/bin/python'));assert.ok(candidates.some(p=>p.includes('taobao-ai-ops/.venv')));
 const windows=pythonCandidates('win32','C:/User',{SEALSEEK_HOME:'C:/Agent'});assert.ok(windows.includes('C:\\Agent\\binaries\\python\\envs\\default\\Scripts\\python.exe'));assert.ok(windows.some(p=>p.includes('taobao-ai-ops\\.venv')));
});
test('project doctor verifies the component runtime without claiming service access',async()=>{
 const r=await doctor('project-management');
 assert.equal(r.service_access,'not-probed');
 assert.equal(r.checks.find(c=>c.id==='procli-runtime').ok,true);
 assert.equal(r.checks.find(c=>c.id==='procli-contract').ok,true);
});
