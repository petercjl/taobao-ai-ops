import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pythonEnvironment,resolvePython} from '../src/runtime.mjs';
test('suite Python uses UTF-8 for files and nested subprocess pipes',()=>{
 const py=resolvePython([]);assert.ok(py);
 const code='import sys, tempfile, pathlib, subprocess; assert sys.flags.utf8_mode == 1; t=tempfile.TemporaryDirectory(); p=pathlib.Path(t.name)/"encoding.txt"; p.write_text("砂锅研究"); assert p.read_bytes() == "砂锅研究".encode("utf-8"); assert subprocess.check_output([sys.executable,"-c","print(\\\"砂锅研究\\\")"],text=True).strip() == "砂锅研究"; t.cleanup(); print("砂锅研究")';
 const r=spawnSync(py.command,[...py.prefix,'-c',code],{encoding:'utf8',env:pythonEnvironment({ ...process.env,PYTHONUTF8:'0',PYTHONIOENCODING:'ascii'})});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'砂锅研究');
});
