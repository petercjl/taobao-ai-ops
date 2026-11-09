import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {closure, componentRecord, nodeFor, source} from '../src/core.mjs';
import {materializeComponentSkill} from '../src/component-skill-install.mjs';
import {doctor} from '../src/runtime.mjs';

const name = 'xiaohongshu-photo-style';

test('suite exposes the published photo styling Skill with its own runtime and template cards', async t => {
 assert.ok(closure().some(node => node.id === name));
 assert.ok(nodeFor('operations').requires_skills.includes(name));
 const record = componentRecord(name);
 assert.equal(record.package, '@petercjl/' + name);
 const diagnostics = await doctor(name);
 assert.ok(diagnostics.ok, JSON.stringify(diagnostics));
 assert.ok(diagnostics.native_requirements.some(requirement => requirement.id === 'photocraft-own'));

 const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'ops-photo-style-')));
 t.after(() => fs.rm(dir, {recursive: true, force: true}));
 const destination = path.join(dir, name);
 const installed = await materializeComponentSkill(record, name, destination);
 const version = JSON.parse(execFileSync(process.execPath, [installed.entry, 'version', '--json']));
 assert.equal(version.version, record.version);
 const canonical = source(nodeFor(name));
 const cards = await fs.readdir(path.join(destination, 'assets'));
 assert.equal(cards.filter(file => file.endsWith('.png')).length, 12);
 assert.deepEqual(
  await fs.readFile(path.join(destination, 'references', 'lettering-cards.md')),
  await fs.readFile(path.join(canonical, 'references', 'lettering-cards.md')),
 );
});
