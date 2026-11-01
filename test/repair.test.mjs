import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGuideReplacements } from '../lib/schema.mjs';
import { fixtureGuide,fixtureAI,source,input } from './fixtures.mjs';
import { normalizeStepIds,repairGuideSections,salvageFacts,initialStepsOnly } from '../lib/generation.mjs';
import { auditGuide } from '../lib/evidence.mjs';

test('numeric step labels normalize consistently without changing actions or accepting collisions',()=>{
  const original={steps:[{id:'1',action:'Register',dependsOn:[]},{id:'2',action:'Test',dependsOn:['1']}]};
  const normalized=normalizeStepIds(original);
  assert.deepEqual(normalized.steps.map(s=>s.id),['step_1','step_2']);assert.deepEqual(normalized.steps[1].dependsOn,['step_1']);
  assert.equal(original.steps[0].id,'1');assert.equal(normalized.steps[0].action,original.steps[0].action);
  const collision=normalizeStepIds({steps:[{id:'1'},{id:'step_1'}]});assert.equal(new Set(collision.steps.map(s=>s.id)).size,1);
});
test('targeted model repair updates existing fields without mutating the original',()=>{const original=fixtureGuide();const repaired=applyGuideReplacements(original,{replacements:[{path:'/claims/1/status',value:'inferred'},{path:'/claims/1/assumptions',value:['A planning recommendation.']}]});assert.equal(original.claims[1].status,'documented');assert.equal(repaired.claims[1].status,'inferred');assert.equal(repaired.claims[1].assumptions.length,1);});
test('model repair cannot write prototypes, array lengths or new fields',()=>{for(const path of ['/__proto__/polluted','/claims/length','/claims/0/constructor','/unrecognized','/claims/-1/status'])assert.throws(()=>applyGuideReplacements(fixtureGuide(),{replacements:[{path,value:'x'}]}));assert.equal({}.polluted,undefined);});
test('repair accepts stable item IDs and bounded schema-checked array additions',()=>{const repaired=applyGuideReplacements(fixtureGuide(),{replacements:[{path:'/guide/claims/c2/status',value:'inferred'},{path:'/unknowns/-',value:'Confirm the exact account policy.'}]});assert.equal(repaired.claims[1].status,'inferred');assert.equal(repaired.unknowns.at(-1),'Confirm the exact account policy.');});
test('unique contract aliases resolve to their actual containing section',()=>{const repaired=applyGuideReplacements(fixtureGuide(),{replacements:[{path:'/recommendation/text',value:'Verify the selected auth method.'},{path:'/nextAction/text',value:'Confirm the provider website.'}]});assert.equal(repaired.composio.recommendation.text,'Verify the selected auth method.');assert.equal(repaired.summary.nextAction.text,'Confirm the provider website.');});

test('factual repairs send only affected claims and small sections while preserving other claims',async()=>{
  const ai=fixtureAI(),guide=fixtureGuide(),original=structuredClone(guide);
  const repaired=await repairGuideSections({ai,guide,run:{sources:[source]},prompt:'Use retrieved passages.',review:{issues:['Confirm registration wording.'],findings:[{severity:'blocking',claimIds:['c2']}]},signal:new AbortController().signal,event:async()=>{}});
  const calls=ai.calls.filter(c=>c.kind==='chat');
  assert.equal(calls.length,5);assert.ok(calls.every(c=>Object.keys(c.options.schema.properties).length<=4));
  assert.deepEqual(calls[0].options.schema.properties.claims.items.properties.id.enum,['c2']);
  assert.deepEqual(repaired.claims.find(c=>c.id==='c3'),original.claims.find(c=>c.id==='c3'));
  assert.deepEqual(guide,original);
});

test('isolated invalid foundation claims are removed rather than fabricated or promoted',()=>{
  const guide=fixtureGuide();for(const c of guide.claims)c.evidence=c.evidence.map(()=>({passageId:'p1'}));
  guide.claims[2].evidence=[{passageId:'invented'}];
  const wire=Object.fromEntries(['provider','assumptions','claims','unknowns'].map(k=>[k,guide[k]]));
  const repaired=salvageFacts(wire,[source],input);
  assert.ok(repaired.claims.some(c=>c.id==='c2'&&c.status==='documented'));
  assert.ok(!repaired.claims.some(c=>c.id==='c3'));
  assert.ok(repaired.unknowns.some(s=>s.includes('c3')));
});

test('a later disputed requirement keeps only the valid initial steps and never skips ahead',()=>{
  const guide=fixtureGuide();guide.steps.push({...guide.steps[0],id:'step2',claimIds:['c3'],dependsOn:['step1']},{...guide.steps[0],id:'step3',dependsOn:[]});
  const review={issues:['Scope requirements conflict.'],findings:[{severity:'blocking',claimIds:['c3']}]};
  const limited=initialStepsOnly(guide,review,input,[source]);
  assert.deepEqual(limited.steps.map(s=>s.id),['step1']);assert.ok(!limited.claims.some(c=>c.id==='c3'));
  assert.equal(limited.provider.oauthStatus,'unverified');assert.match(limited.unknowns[0],/Further instructions were withheld/);
  assert.deepEqual(auditGuide(limited,[source],input).errors,[]);
  assert.equal(initialStepsOnly(guide,{...review,findings:[{severity:'blocking',claimIds:['c2']}]},input,[source]),null);
});
