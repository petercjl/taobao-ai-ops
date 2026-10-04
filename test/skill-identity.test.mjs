import test from 'node:test';
import assert from 'node:assert/strict';
import {skillName} from '../scripts/skill-identity.mjs';
test('Skill identity uses frontmatter across LF, CRLF and CR checkouts',()=>{
 for(const ending of ['\n','\r\n','\r'])assert.equal(skillName(['---','name: example-skill','description: valid','---','body'].join(ending)),'example-skill');
});
test('body-only, duplicate and unterminated names cannot satisfy identity',()=>{
 assert.equal(skillName('body\nname: example-skill\n'),null);
 assert.equal(skillName('---\nname: first\nname: second\n---\n'),null);
 assert.equal(skillName('---\nname: example-skill\n'),null);
});
