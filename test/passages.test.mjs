import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcePassages,resolvePassages,passageSources } from '../lib/passages.mjs';
import { auditGuide } from '../lib/evidence.mjs';
import { sectionSchema,schemaErrors } from '../lib/schema.mjs';
import { source,fixtureGuide,input } from './fixtures.mjs';

test('passages preserve every character, remain stable and invalidate stale source IDs',()=>{
  const dense={...source,content:'## OAuth\n\n'+('Text with [links](https://example.com/) and **formatting**.\n'.repeat(80))};
  const passages=sourcePassages(dense);
  assert.equal(passages.map(p=>p.text).join(''),dense.content);
  assert.deepEqual(sourcePassages(dense),passages);
  for(const p of passages)assert.equal(dense.content.slice(p.start,p.end),p.text);
  const stale={claims:[{evidence:[{passageId:passages[0].id}]}]};
  assert.throws(()=>resolvePassages(stale,[{...dense,content:dense.content+' changed'}]),/unknown passage/);
});

test('code attaches exact quotations and rejects fabricated passage IDs or altered quotations',()=>{
  const g=fixtureGuide(),p=sourcePassages(source)[0];
  for(const claim of g.claims)claim.evidence=claim.evidence.map(()=>({passageId:p.id}));
  const resolved=resolvePassages(g,[source]);
  assert.equal(resolved.claims[1].evidence[0].quote,source.content);
  assert.deepEqual(auditGuide(resolved,[source],input).errors,[]);
  resolved.claims[1].evidence[0].quote='Register an OAuth application in the developer dashboard.';
  assert.ok(auditGuide(resolved,[source],input).errors.some(e=>e.includes('passage does not match')));
  g.claims[1].evidence[0].passageId='invented';assert.throws(()=>resolvePassages(g,[source]),/unknown passage/);
});

test('section contracts reject writes to other sections and model-authored quotation text',()=>{
  assert.ok(schemaErrors({unknowns:[],steps:[]},sectionSchema(['unknowns'])).some(e=>e.includes('not allowed')));
  const claims=fixtureGuide().claims;
  assert.ok(schemaErrors({claims},sectionSchema(['claims'])).some(e=>e.includes('passageId')));
});

test('short model aliases resolve to the same immutable canonical source passage',()=>{
  const exposed=passageSources([source]);assert.equal(exposed[0].passages[0].id,'p1');
  assert.equal(exposed[0].passages[0].text,source.content);
  const resolved=resolvePassages({claims:[{evidence:[{passageId:'p1'}]}]},[source]);
  assert.equal(resolved.claims[0].evidence[0].passageId,sourcePassages(source)[0].id);
  assert.equal(resolved.claims[0].evidence[0].quote,source.content);
});

test('dynamic schemas restrict passage and claim references to the actual saved evidence',()=>{
  const p=sourcePassages(source)[0];
  const claims=sectionSchema(['claims'],{passageIds:[p.id]});
  assert.deepEqual(claims.properties.claims.items.properties.evidence.items.properties.passageId.enum,[p.id]);
  assert.equal(claims.properties.claims.items.properties.text.enum,undefined);
  assert.equal(claims.properties.claims.items.properties.id.enum,undefined);
  const setup=sectionSchema(['steps'],{claimIds:['c2','c3']});
  const steps=fixtureGuide().steps;steps[0].claimIds=['fabricated'];
  assert.ok(schemaErrors({steps},setup).some(e=>e.includes('must be one of')));
  assert.equal(sectionSchema(['steps']).properties.steps.items.properties.claimIds.items.enum,undefined);
  const bounded=sectionSchema(['steps'],{destinations:['https://example.com/register']});
  steps[0].claimIds=['c2'];steps[0].destination='https://example.com/invented';
  assert.ok(schemaErrors({steps},bounded).some(e=>e.includes('destination')));
  steps[0].destination='';assert.deepEqual(schemaErrors({steps},bounded),[]);
});
