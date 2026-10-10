import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {closure,MANIFEST} from '../src/core.mjs';
import {targetRoot} from '../src/skill-manager.mjs';
test('sourcing apps retain independent identities and exact dependency closure',()=>{
 assert.deepEqual(closure({node:'sourcing-tools'}).map(n=>n.skill),['1688cli']);
 assert.deepEqual(new Set(closure({node:'product-sourcing'}).map(n=>n.skill)),new Set(['1688-product-sourcing','1688cli','compact-commerce-ui']));
 assert.deepEqual(new Set(closure({node:'opportunity-sourcing'}).map(n=>n.skill)),new Set(['1688-opportunity-sourcing-research','1688cli']));
 for(const name of ['1688cli','1688-product-sourcing','1688-opportunity-sourcing-research'])assert.equal(MANIFEST.components[name].package,'@petercjl/'+name);
});
test('WorkBuddy resolves explicit configured Skill root',()=>{
 const old=process.env.WORKBUDDY_SKILLS_DIR;process.env.WORKBUDDY_SKILLS_DIR=path.resolve('workbuddy-fixture');
 try{assert.equal(targetRoot({agent:'workbuddy'}),path.resolve('workbuddy-fixture'));}finally{if(old===undefined)delete process.env.WORKBUDDY_SKILLS_DIR;else process.env.WORKBUDDY_SKILLS_DIR=old;}
});
