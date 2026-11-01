import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCoverage,coverageGaps,coverageLinks,coverageQuestions,coverageQuery,coverageResults } from '../lib/coverage.mjs';
import { passageCatalog } from '../lib/passages.mjs';
import { input,source,fixtureGuide,fixtureAI } from './fixtures.mjs';
import { auditGuide } from '../lib/evidence.mjs';

const answers=changes=>coverageQuestions.map(q=>({id:q.id,status:'unknown',reason:'No evidence.',passageIds:[],...changes[q.id]}));
const model=items=>({chat:async()=>({content:JSON.stringify({items})})});

test('coverage references resolve to immutable passages and do not invent missing answers',async()=>{
  const result=await assessCoverage(model(answers({registration:{status:'supported',passageIds:['p1']}})),input,[source]);
  assert.equal(result.completed,true);assert.equal(result.items[1].status,'supported');assert.equal(result.items[1].evidence[0].passageId,passageCatalog([source])[0].id);assert.equal(coverageGaps(result).length,7);
});

test('missing, duplicate, invented and wrong-authority answers remain unknown',async()=>{
  const rows=answers({authentication:{status:'not_applicable',passageIds:[]},registration:{status:'supported',passageIds:['invented']},permissions:{status:'conflicting',passageIds:['p1']},composio:{status:'supported',passageIds:['p1']}});
  rows.push({...rows[3],status:'supported',passageIds:['p1']});rows.splice(rows.findIndex(row=>row.id==='approval'),1);
  const result=await assessCoverage(model(rows),input,[source]);assert.ok(result.items.every(i=>i.status==='unknown'));
});

test('third-party content cannot establish official requirements or not-applicable status',async()=>{
  let calls=0;const result=await assessCoverage({chat:async()=>{calls++;}},input,[{...source,role:'unclassified'}]);assert.equal(calls,0);assert.equal(result.completed,false);assert.equal(coverageGaps(result).length,8);
});

test('unavailable coverage review preserves unanswered questions without blocking drafting',async()=>{
  const result=await assessCoverage({chat:async()=>{throw new Error('Unavailable');}},input,[source]);assert.equal(result.completed,false);assert.equal(coverageGaps(result).length,8);
});

test('coverage link selection follows relevant discovered official links and skips attempted URLs',()=>{
  const sources=[{...source,links:[{url:'https://example.com/docs/review',title:'App approval'},{url:'https://other.example/docs/review',title:'Approval'},{url:'https://example.com/pricing',title:'Pricing'}]}];
  assert.deepEqual(coverageLinks(sources,{officialDomains:['example.com']},input,'approval').map(l=>l.url),['https://example.com/docs/review']);
  assert.equal(coverageLinks(sources,{officialDomains:['example.com']},input,'approval',new Set(['https://example.com/docs/review'])).length,0);
});

test('model search coverage summaries never enter the factual writing context',async()=>{
  const {writingPrompt}=await import('../lib/prompts.mjs');
  const prompt=writingPrompt(input,{coverage:['UNSUPPORTED_SEARCH_FACT']},[source],[],{items:[{question:'Approval wait?',status:'unknown',reason:'UNVALIDATED_REASON'}]});
  assert.ok(!prompt.includes('UNSUPPORTED_SEARCH_FACT'));assert.ok(!prompt.includes('UNVALIDATED_REASON'));assert.ok(prompt.includes('Approval wait?'));
});

test('targeted searches stay on official scopes and first-test reads prioritize access tokens',()=>{
  assert.match(coverageQuery(input,'approval',{officialDomains:['developer.example.com']}),/^site:developer.example.com/);
  assert.match(coverageQuery(input,'composio'),/^site:docs.composio.dev/);
  const results=coverageResults([{url:'https://unrelated.example/guide'},{url:'https://example.com/docs/approval'}],{officialDomains:['example.com']},input,'approval');assert.equal(results.length,1);assert.equal(results[0].url,'https://example.com/docs/approval');
  const sources=[{...source,links:[{title:'Revoke OAuth token',url:'https://example.com/revoke'},{title:'Get an access token',url:'https://example.com/token'}]}];assert.equal(coverageLinks(sources,{officialDomains:['example.com']},input,'testing')[0].url,'https://example.com/token');
});

test('writers receive official passages without renumbering aliases around unclassified sources',async()=>{
  const {writingPrompt}=await import('../lib/prompts.mjs');const {requestSections}=await import('../lib/generation.mjs');
  const sources=[{...source,id:'lead',role:'unclassified',content:'THIRD_PARTY_POLICY_LEAD '.repeat(6)},{...source,id:'s2'}];
  const prompt=writingPrompt(input,{},sources,[]);assert.ok(prompt.includes('THIRD_PARTY_POLICY_LEAD'));assert.ok(prompt.includes('unclassified'));assert.ok(prompt.includes('"id":"p2"'));
  let allowed;await requestSections({ai:{chat:async(_messages,options)=>{allowed=options.schema.properties.claims.items.properties.evidence.items.properties.passageId.enum;return {content:JSON.stringify({claims:[]})};}},keys:['claims'],guide:{},prompt,sources,signal:new AbortController().signal});assert.deepEqual(allowed,['p1','p2']);
});

test('Composio-only evidence must carry its integration context rather than become universal provider policy',()=>{
  const guide=fixtureGuide(),composio={...source,id:'s2',role:'composio',url:'https://docs.composio.dev/toolkits/example',content:'This integration requests its configured permissions as one bundle.'};
  guide.claims.push({id:'consent',status:'documented',text:'Users cannot choose individual permissions.',evidence:[{sourceId:'s2',quote:composio.content}],assumptions:[]});
  assert.ok(auditGuide(guide,[source,composio],input).errors.some(e=>e.includes('universal provider policy')));
  guide.claims.at(-1).text='Composio documents bundled permissions for this integration.';
  assert.deepEqual(auditGuide(guide,[source,composio],input).errors,[]);
  guide.permissions[0].claimIds.push('consent');
  assert.ok(auditGuide(guide,[source,composio],input).errors.some(e=>e.startsWith('permissions[0] uses Composio-only')));
  guide.permissions[0].consequence='For Composio, this permission is bundled; check the provider route separately.';
  assert.deepEqual(auditGuide(guide,[source,composio],input).errors,[]);
});

test('large legacy repairs survive a provider output limit by requesting small section groups',async()=>{
  const {repairInvalidSections}=await import('../lib/generation.mjs');const ai=fixtureAI(),original=ai.chat,guide=fixtureGuide();let saved;
  ai.chat=async(messages,options)=>{if(Object.keys(options.schema.properties).length>4)throw Object.assign(new Error('Output limit'),{code:'incomplete_output'});return original(messages,options);};
  const repaired=await repairInvalidSections({ai,keys:Object.keys(guide),guide,prompt:'Repair the saved guide.',sources:[source],issues:['Multiple invalid sections'],signal:new AbortController().signal,onProgress:async candidate=>{saved=structuredClone(candidate);}});
  assert.deepEqual(auditGuide(repaired,[source],input).errors,[]);assert.deepEqual(saved,repaired);assert.equal(repaired.steps.length,1);
});

test('a later repair failure retains an earlier completed section checkpoint',async()=>{
  const {repairInvalidSections}=await import('../lib/generation.mjs');const ai=fixtureAI(),original=ai.chat,guide=fixtureGuide();let saved;
  guide.summary.nextAction.text='OLD SUMMARY';
  ai.chat=async(messages,options)=>{if(options.schema.properties.steps)throw new Error('Later section unavailable');return original(messages,options);};
  await assert.rejects(()=>repairInvalidSections({ai,keys:['summary','steps'],guide,prompt:'Repair',sources:[source],issues:[],signal:new AbortController().signal,onProgress:async candidate=>{saved=structuredClone(candidate);}}),/Later section/);
  assert.notEqual(saved.summary.nextAction.text,'OLD SUMMARY');assert.deepEqual(saved.steps,guide.steps);
});
