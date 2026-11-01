import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../lib/store.mjs';
import { createAgent } from '../lib/agent.mjs';
import { getConfig } from '../lib/config.mjs';
import { fixtureAI,input,source,fixtureGuide } from './fixtures.mjs';
import { auditGuide,expandShortQuotes } from '../lib/evidence.mjs';

test('a primary outage still generates and reviews a guide through the backup with actual model attribution',async t=>{
  const {store}=await setup(t);const config={...getConfig({OPENROUTER_API_KEY:'test'}),timeoutMs:10000};
  const model=fixtureAI();const requested=[];
  const agent=createAgent(config,store,{wait:async()=>{},fetchImpl:async(_url,options)=>{
    const body=JSON.parse(options.body);requested.push(body.model);
    if(body.model===config.model)return new Response('',{status:503});
    const message=await model.chat(body.messages,{schema:body.response_format.json_schema.schema,schemaName:body.response_format.json_schema.name});
    return new Response(JSON.stringify({model:config.fallbackModel,usage:{prompt_tokens:100,completion_tokens:30,cost:0.0001},choices:[{finish_reason:'stop',message}]}));
  }});
  await store.save('run',{id:'fallback-evidence',input,sources:[source],attempts:[],research:{identityStatus:'resolved',website:input.website,officialDomains:['example.com']}});
  const run=await(await agent.resume('fallback-evidence',{regenerate:true})).promise;
  const guide=await store.get('guide',run.guideId);
  assert.equal(guide.content.steps.length,1);assert.equal(guide.review.completed,true);
  assert.equal(requested.filter(m=>m===config.model).length,2);
  assert.deepEqual(guide.modelsUsed,[config.fallbackModel]);assert.equal(guide.model,config.fallbackModel);
  assert.equal(run.usage.models[config.fallbackModel].calls,6);assert.equal(run.recoveryEvents.filter(e=>e.type==='fallback').length,1);
});

async function setup(t,options={}){const dir=await mkdtemp(join(tmpdir(),'launchpath-agent-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=new Store(dir);await store.init();const ai=fixtureAI(options);const config={...getConfig({}),provider:'openrouter',apiKey:'test-only-key',dataDir:dir,timeoutMs:options.timeoutMs||10000};const agent=createAgent(config,store,{ai,fetchPage:async url=>({...source,url,content:url.endsWith('/register')?'Sign in to register an application. This public page does not allow app creation without an authorized account.':source.content})});return {agent,store,ai};}

test('missing coverage directs bounded searches, rechecks new evidence, and remains visible in the guide',async t=>{
  const {store}=await setup(t),ai=fixtureAI(),chat=ai.chat;let checks=0;const searches=[],reads=[];
  ai.search=async query=>{searches.push(query);return [{url:query.includes('token exchange')?'https://example.com/docs/tokens':query.includes('review approval')?'https://example.com/docs/approval':source.url,title:'Official documentation'}];};
  ai.chat=async(messages,options)=>{if(options.schemaName==='evidence_coverage')checks++;return chat(messages,options);};
  const config={...getConfig({}),maxSearches:3,maxPages:4,timeoutMs:10000};
  const agent=createAgent(config,store,{ai,fetchPage:async url=>{reads.push(url);return {...source,url,content:url.endsWith('/register')?'Sign in to register an application. This public page requires an authorized account to continue.':source.content};}});
  const run=await(await agent.start(input)).promise,guide=await store.get('guide',run.guideId);
  assert.equal(checks,2);assert.equal(searches.length,3);assert.ok(searches.some(q=>q.includes('token exchange')));assert.ok(searches.some(q=>q.includes('review approval')));assert.equal(reads.length,4);
  assert.equal(guide.content.steps.length,1);assert.equal(guide.evidenceCoverage.items.length,8);assert.ok(guide.content.unknowns.some(q=>q.startsWith('Evidence gap:')));assert.ok(run.sources.every(s=>s.quality.usable));
});

test('a search outage can recover from the supplied official website',async t=>{
  const {store,ai}=await setup(t,{searchError:true});const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{ai,fetchPage:async url=>({...source,url})});
  const run=await(await agent.start(input)).promise;assert.ok(run.guideId);assert.ok(run.sources.some(s=>s.url===input.website));assert.ok(run.events.some(e=>e.message.includes('Initial search was unavailable')));
});

test('factual review excludes unclassified discovery leads and retains authority labels',async t=>{
  const {store,ai}=await setup(t);const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{ai});
  await store.save('run',{id:'official-review-only',input,sources:[source,{...source,id:'s2',url:'https://unrelated.example/guide',role:'unclassified',content:'UNTRUSTED_POLICY_CLAIM '.repeat(10)}],attempts:[],research:{identityStatus:'resolved',website:input.website,officialDomains:['example.com']},draftCandidate:fixtureGuide()});
  const run=await(await agent.resume('official-review-only')).promise;assert.ok(run.guideId);
  const review=ai.calls.find(c=>c.kind==='chat'&&c.messages[0].content.startsWith('Review OAuth'));
  const context=JSON.parse(review.messages[1].content);assert.equal(context.sources.length,1);assert.equal(context.sources[0].role,'provider');assert.ok(!review.messages[1].content.includes('UNTRUSTED_POLICY_CLAIM'));
});

test('a source-disproved review finding cannot trigger a rewrite of correct instructions',async t=>{
  const {store}=await setup(t);const ai=fixtureAI({reviewIssues:['The registration instruction is wrong.']}),original=ai.chat;
  ai.chat=async(messages,options)=>options.schemaName==='confirm_review'?{content:JSON.stringify({decisions:[{id:'f1',decision:'dismissed',reason:'The original registration instruction agrees with the source.',sourceId:'s1',quote:'Register an OAuth application in the developer dashboard.'}]})}:original(messages,options);
  const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{ai,fetchPage:async url=>({...source,url})});
  const run=await(await agent.start(input)).promise,guide=await store.get('guide',run.guideId);
  assert.equal(guide.content.steps.length,1);assert.deepEqual(guide.review.issues,[]);assert.equal(ai.writes,4);assert.equal(run.semanticRepair,undefined);
});

test('research calls tools, saves real tool outcomes, audits quotes, persists and reopens a scenario-bound guide',async t=>{
  const {agent,store,ai}=await setup(t);const started=await agent.start(input);const run=await started.promise;
  assert.equal(run.status,'partial');assert.equal(run.sources.length,1);assert.equal(run.attempts[0].outcome,'page_retrieved_login_may_be_required');assert.ok(ai.calls.some(c=>c.kind==='search'));
  const guide=await store.get('guide',run.guideId);assert.equal(guide.scenario.capability,input.capability);assert.equal(guide.content.permissions[0].permission,'records:read');assert.equal(guide.validationStatus,'generated_draft');assert.equal(guide.review.completed,true);
  const reopened=new Store(store.directory);assert.deepEqual(await reopened.get('guide',guide.id),guide);assert.ok(run.events.some(e=>e.stage==='saved'));assert.equal(agent.active.size,0);
});
test('invented supporting passages fail validation and never reach a factual guide',async t=>{
  const{agent,store,ai}=await setup(t,{badQuote:true});const{promise}=await agent.start(input);const run=await promise;const guide=await store.get('guide',run.guideId);
  assert.equal(ai.writes,2);assert.equal(guide.status,'partial');assert.equal(guide.content.steps.length,0);assert.ok(run.validationErrors.some(e=>e.includes('passageId')));assert.equal(guide.sources.length,1);assert.equal(guide.guideMode,'source_digest');assert.equal(guide.resultType,'source_guide');assert.equal(guide.sourceDigest[0].excerpt,source.content);
});
test('ambiguous provider produces clarification and no guide',async t=>{const{agent}=await setup(t,{ambiguous:true});const{promise}=await agent.start({...input,website:''});const run=await promise;assert.equal(run.status,'needs_input');assert.equal(run.guideId,null);assert.equal(run.clarification.candidates[0].website,input.website);});
test('search and page retrieval outage produces explicit failure, not a hardcoded provider guide',async t=>{const{store,ai}=await setup(t,{searchError:true});const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{ai,fetchPage:async()=>{throw new Error('Connection unavailable');}});const run=await(await agent.start(input)).promise;assert.equal(run.status,'failed');assert.equal(run.guideId,null);assert.equal(run.errorCode,'no_retrieved_evidence');});
test('overall timeout terminates the same run',async t=>{const{agent}=await setup(t,{slow:true,timeoutMs:30});const{promise}=await agent.start(input);const run=await promise;assert.equal(run.status,'timed_out');assert.equal(agent.active.size,0);});
test('missing key is actionable and never produces a fake success',async t=>{const{store}=await setup(t);const agent=createAgent({...getConfig({}),apiKey:''},store);await assert.rejects(()=>agent.start(input),/API_KEY/);});
test('an app name alone researches setup and approval without treating customization as missing input',async t=>{
  const {agent,store,ai}=await setup(t);const run=await(await agent.start({provider:'ExampleApp'})).promise;
  assert.equal(run.input.audience,'general');assert.equal(run.input.capability,'');assert.equal(run.input.scopes,'');
  assert.ok(run.guideId);assert.equal(run.clarification,undefined);
  const guide=await store.get('guide',run.guideId);
  assert.equal(guide.content.steps.length,1);assert.equal(guide.review.completed,true);
  assert.ok(!guide.content.unknowns.some(v=>/not specified|missing capability/i.test(v)));
  assert.deepEqual(auditGuide(guide.content,run.sources,run.input).errors,[]);
  const systems=ai.calls.filter(c=>c.kind==='chat').map(c=>c.messages[0].content);
  assert.ok(systems.length>=3);
  for(const system of systems){assert.match(system,/setting up an OAuth app and getting it approved/);assert.match(system,/Missing customization is not missing research input/);}
  assert.ok(systems.some(s=>s.startsWith('Review OAuth')));
});
test('a truncated research checkpoint retries concisely without repeating successful tools',async t=>{const{agent,store,ai}=await setup(t,{truncatedResearchOnce:true});const run=await(await agent.start(input)).promise;const guide=await store.get('guide',run.guideId);assert.equal(guide.content.steps.length,1);assert.equal(ai.calls.filter(c=>c.kind==='search'&&c.query.includes('developer documentation registration')).length,1);assert.equal(run.sources.length,1);assert.ok(run.events.some(e=>e.message.includes('checkpoint exceeded')));});
test('factual concerns remain visible while the walkthrough is published',async t=>{const{agent,store}=await setup(t,{reviewIssues:['The cited passage does not establish approval for external customers.']});const{promise}=await agent.start(input);const run=await promise;const guide=await store.get('guide',run.guideId);assert.equal(guide.content.steps.length,1);assert.ok(guide.review.findings.some(q=>q.message.includes('external customers')));assert.equal(guide.review.findings[0].severity,'advisory');assert.equal(guide.review.completed,true);});
test('non-blocking review observations do not withhold a valid walkthrough',async t=>{
  const {agent,store,ai}=await setup(t,{reviewAdvisories:['The guide correctly flags external review as unknown — no error.','No material factual error is established.']});
  const run=await(await agent.start(input)).promise,guide=await store.get('guide',run.guideId);
  assert.equal(guide.content.steps.length,1);assert.equal(guide.review.completed,true);assert.deepEqual(guide.review.issues,[]);
  assert.equal(guide.review.findings.length,2);assert.equal(ai.writes,4);assert.ok(!run.events.some(e=>e.stage==='review'));
});

test('editorial findings cannot veto a source-backed walkthrough even if severity says blocking',async t=>{
  const {agent,store,ai}=await setup(t,{reviewEditorials:['Correct the spelling in step one.']});
  const run=await(await agent.start(input)).promise;const guide=await store.get('guide',run.guideId);
  assert.equal(guide.content.steps.length,1);assert.deepEqual(guide.review.issues,[]);
  assert.equal(guide.review.findings[0].severity,'advisory');assert.equal(ai.writes,4);
});

test('review findings do not trigger another correction or withhold the guide',async t=>{
  const {store}=await setup(t);const ai=fixtureAI({reviewIssues:['The registration claim is unsupported.']}),original=ai.chat;let reviews=0;
  ai.chat=async(messages,options)=>{if(messages[0].content.startsWith('Review OAuth')&&++reviews>1)throw Object.assign(new Error('Unavailable'),{code:'upstream_503'});return original(messages,options);};
  const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{ai,fetchPage:async url=>({...source,url})});
  const run=await(await agent.start(input)).promise,guide=await store.get('guide',run.guideId);
  assert.equal(guide.content.steps.length,1);assert.ok(guide.review.findings.some(s=>s.message.includes('unsupported')));assert.equal(reviews,1);
});
test('redrafting saved evidence preserves scenario and dates without claiming a new search',async t=>{const{agent,store,ai}=await setup(t);const first=await(await agent.start(input)).promise;const searchCount=ai.calls.filter(c=>c.kind==='search').length;const second=await(await agent.resume(first.id)).promise;assert.equal(ai.calls.filter(c=>c.kind==='search').length,searchCount);assert.equal(second.sourceRunId,first.id);assert.equal(second.sources[0].retrievedAt,first.sources[0].retrievedAt);assert.ok(second.events.some(e=>e.stage==='cached_evidence'));const guide=await store.get('guide',second.guideId);assert.equal(guide.scenario.capability,input.capability);assert.equal(guide.sourceRunId,first.id);assert.notEqual(guide.id,first.guideId);});
test('saved valid candidates resume at factual review without another search or draft generation',async t=>{const{agent,store,ai}=await setup(t);await store.save('run',{id:'saved-candidate',input,sources:[source],attempts:[],research:{identityStatus:'resolved',website:input.website,officialDomains:['example.com']},draftCandidate:fixtureGuide()});const run=await(await agent.resume('saved-candidate')).promise;assert.equal(ai.writes,0);assert.equal(ai.calls.filter(c=>c.kind==='search').length,0);const guide=await store.get('guide',run.guideId);assert.equal(guide.review.completed,true);assert.equal(guide.content.steps.length,1);});
test('an unsupported saved citation becomes an unknown without discarding the writing',async t=>{
  const {agent,store,ai}=await setup(t);const candidate=fixtureGuide();candidate.claims[1].evidence[0].quote='An unsupported statement that must be corrected.';
  await store.save('run',{id:'invalid-candidate',input,sources:[source],attempts:[],research:{identityStatus:'resolved',website:input.website,officialDomains:['example.com']},draftCandidate:candidate});
  const run=await(await agent.resume('invalid-candidate')).promise;
  const writer=ai.calls.find(c=>c.kind==='chat'&&c.messages[0].content.startsWith('You write'));
  assert.equal(writer,undefined);assert.equal(run.draftCandidate.claims[1].status,'unknown');
  assert.equal(ai.writes,0);assert.equal((await store.get('guide',run.guideId)).content.steps.length,1);
});
test('review runs once and factual objections cannot trigger expensive repair loops',async t=>{const{agent,store,ai}=await setup(t,{reviewIssues:['Confirm the external launch wording.']});const run=await(await agent.start(input)).promise;const guide=await store.get('guide',run.guideId);assert.equal(ai.writes,4);assert.equal(guide.review.completed,true);assert.deepEqual(guide.review.issues,[]);assert.equal(guide.content.steps.length,1);assert.equal(run.semanticRepair,undefined);assert.equal(guide.review.findings[0].originalSeverity,'blocking');});

test('audit rejects missing references, invented destinations, observed timing, and dependency cycles',()=>{const g=fixtureGuide();g.steps[0].destination='https://example.com/invented';g.steps[0].dependsOn=['step1'];g.summary.nextAction.claimIds=['missing'];g.effort.activeWork.kind='observed';const result=auditGuide(g,[source],input);for(const pattern of [/destination/,/preceding/,/missing claim/,/observed timing|no authenticated timing/])assert.ok(result.errors.some(e=>pattern.test(e)),pattern.toString());});
test('quote matching tolerates code punctuation spacing but rejects changed words or values',()=>{const g=fixtureGuide();const codeSource={...source,content:source.content+' Example response: "code": "test_env_error", "status": 403.'};g.claims.push({id:'code',text:'The example status is 403.',status:'documented',evidence:[{sourceId:'s1',quote:'"code" : "test_env_error" , "status" : 403'}],assumptions:[]});assert.equal(auditGuide(g,[codeSource],input).errors.length,0);g.claims.at(-1).evidence[0].quote='"code" : "test_env_error" , "status" : 200';assert.ok(auditGuide(g,[codeSource],input).errors.some(e=>e.includes('quote is absent')));});
test('source quotations can omit Markdown link destinations without changing their words',()=>{
  const g=fixtureGuide();const linkedSource={...source,content:source.content+"\nIn your organization's settings, navigate to the [**OAuth Apps**](https://supabase.com/dashboard/org/_/apps) tab."};
  const quote="In your organization's settings, navigate to the **OAuth Apps** tab.";
  g.claims.push({id:'linked',text:'Find OAuth Apps in organization settings.',status:'documented',evidence:[{sourceId:'s1',quote}],assumptions:[]});
  assert.deepEqual(auditGuide(g,[linkedSource],input).errors,[]);
  g.claims.at(-1).evidence[0].quote=quote.replaceAll('**','');
  assert.deepEqual(auditGuide(g,[linkedSource],input).errors,[]);
  g.claims.at(-1).evidence[0].quote=quote.replace('organization','project');
  assert.ok(auditGuide(g,[linkedSource],input).errors.some(e=>e.includes('quote is absent')));
  g.claims.at(-1).evidence[0].quote='https://invented.example.com/dashboard';
  assert.ok(auditGuide(g,[linkedSource],input).errors.some(e=>e.includes('quote is absent')));
  g.claims.at(-1).evidence[0].quote='[**OAuth Apps**](https://invented.example.com/dashboard)';
  assert.ok(auditGuide(g,[linkedSource],input).errors.some(e=>e.includes('quote is absent')));
});
test('a short source quote after a long paragraph expands to bounded adjacent context',()=>{
  const g=fixtureGuide();const dense={...source,content:source.content+'\n\n'+('Long public documentation paragraph. '.repeat(500))+' **Tools:** 48 More details.'};
  g.claims.push({id:'bounded',text:'The toolkit has 48 tools.',status:'documented',evidence:[{sourceId:'s1',quote:'**Tools:** 48'}],assumptions:[]});
  const expanded=expandShortQuotes(g,[dense]);assert.ok(expanded.claims.at(-1).evidence[0].quote.length<500);
  assert.deepEqual(auditGuide(expanded,[dense],input).errors,[]);
});
test('a quoted Markdown heading can use a different heading level while preserving its words',()=>{
  const g=fixtureGuide(),headingSource={...source,content:source.content+'\n\n## What the MCP is for\n\nUse this interface to query analytics.'};
  g.claims.push({id:'heading',text:'The source describes the MCP use cases.',status:'documented',evidence:[{sourceId:'s1',quote:'### What the MCP is for'}],assumptions:[]});
  const expanded=expandShortQuotes(g,[headingSource]);assert.ok(expanded.claims.at(-1).evidence[0].quote.includes('## What the MCP is for'));
  assert.deepEqual(auditGuide(expanded,[headingSource],input).errors,[]);
  g.claims.at(-1).evidence[0].quote='### What the OAuth app is for';
  assert.ok(auditGuide(expandShortQuotes(g,[headingSource]),[headingSource],input).errors.some(e=>e.includes('quote is absent')));
});
test('a retrieved redirect origin and section fragment remain valid step destinations',()=>{const g=fixtureGuide();g.steps[0].destination='https://example.com/oauth#registration';const redirected={...source,url:'https://example.com/oauth.md',requestedUrl:'https://example.com/oauth'};assert.deepEqual(auditGuide(g,[redirected],input).errors,[]);g.steps[0].destination='https://example.com/unseen';assert.ok(auditGuide(g,[redirected],input).errors.some(e=>e.includes('destination')));});
test('short exact field quotations gain real source context while invented values remain rejected',()=>{const g=fixtureGuide();const dense={...source,content:source.content+'\n\nToolkit details\n- **Tools:** 48\n- **Auth:** OAuth2\n\nNext section'};g.claims.push({id:'dense',text:'The toolkit has 48 tools.',status:'documented',evidence:[{sourceId:'s1',quote:'**Tools:** 48'}],assumptions:[]});const expanded=expandShortQuotes(g,[dense]);assert.ok(expanded.claims.at(-1).evidence[0].quote.includes('**Auth:** OAuth2'));assert.deepEqual(auditGuide(expanded,[dense],input).errors,[]);g.claims.at(-1).evidence[0].quote='**Tools:** 49';assert.ok(auditGuide(expandShortQuotes(g,[dense]),[dense],input).errors.some(e=>e.includes('quote is absent')));});
test('restart marks in-flight runs interrupted and preserves evidence',async t=>{const{store}=await setup(t);await store.save('run',{id:'interrupted-test',status:'running',sources:[source]});await new Store(store.directory).recover();const run=await store.get('run','interrupted-test');assert.equal(run.status,'interrupted');assert.equal(run.sources[0].content,source.content);});

test('a malformed setup section retries only setup and preserves validated facts and overview',async t=>{
  const {agent,store,ai}=await setup(t,{brokenSection:'steps',breakOnce:true});
  const run=await(await agent.start(input)).promise;const guide=await store.get('guide',run.guideId);
  assert.equal(guide.content.steps.length,1);assert.equal(ai.writes,5);
  assert.deepEqual(run.sectionAttempts.map(a=>a.section),['facts','overview','setup','setup','launch']);
  assert.deepEqual(run.sectionAttempts.filter(a=>a.section==='setup').map(a=>a.status),['failed','validated']);
  const firstWriter=ai.calls.find(c=>c.kind==='chat'&&c.options.schemaName==='guide_sections');
  assert.match(firstWriter.messages[1].content,/CURRENT GUIDE \(untrusted data\): \{\}/);
  assert.deepEqual(auditGuide(guide.content,run.sources,run.input).errors,[]);
});

test('exhausted launch formatting repairs preserve the independently validated setup',async t=>{
  const {agent,store,ai}=await setup(t,{brokenSection:'blockers'});
  const run=await(await agent.start(input)).promise;const guide=await store.get('guide',run.guideId);
  assert.equal(ai.writes,5);assert.equal(run.sectionRecovery,true);assert.equal(guide.content.steps.length,1);
  assert.ok(guide.content.unknowns.some(s=>s.includes('launch section could not be validated')));
  assert.deepEqual(auditGuide(guide.content,run.sources,run.input).errors,[]);
  assert.equal(guide.review.completed,true);
});

test('exhausted setup repair exposes missing instructions and removes readiness claims',async t=>{
  const {agent,store}=await setup(t,{brokenSection:'steps'});
  const run=await(await agent.start(input)).promise;const guide=await store.get('guide',run.guideId);
  assert.equal(guide.content.steps.length,0);assert.equal(guide.content.provider.oauthStatus,'unverified');
  assert.match(guide.content.summary.testReadiness.text,/Not established/);
  assert.ok(guide.content.unknowns.some(s=>s.includes('setup section could not be validated')));
  assert.deepEqual(auditGuide(guide.content,run.sources,run.input).errors,[]);
});

test('regenerating from evidence exercises all sections without changing original guides or rerunning searches',async t=>{
  const {agent,store,ai}=await setup(t);const first=await(await agent.start(input)).promise;
  const original=await store.get('guide',first.guideId);const searchCount=ai.calls.filter(c=>c.kind==='search').length;
  const second=await(await agent.resume(first.id,{regenerate:true})).promise;
  assert.equal(second.sectionAttempts.filter(a=>a.status==='validated').length,4);
  assert.equal(ai.calls.filter(c=>c.kind==='search').length,searchCount);
  assert.deepEqual(await store.get('guide',first.guideId),original);
});

const checkpoint={identityStatus:'resolved',providerName:'ExampleApp',website:input.website,officialDomains:['example.com'],identityBasis:'Retrieved official documentation.',candidates:[],coverage:['Registration'],unansweredQuestions:['Approval timing']};

test('an immediate research checkpoint cannot skip actual retrieval or prematurely end investigation',async t=>{
  const {store}=await setup(t);const ai=fixtureAI(),original=ai.chat;let researchCalls=0,reads=0;
  ai.chat=async(messages,options)=>{if(options.tools){researchCalls++;assert.equal(options.schema,undefined);return {content:JSON.stringify(checkpoint)};}return original(messages,options);};
  const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{ai,fetchPage:async url=>{reads++;return {...source,url};}});
  const run=await(await agent.start(input)).promise;
  assert.equal(researchCalls,2);assert.equal(reads,2);assert.equal(run.sources.length,2);
  assert.equal((await store.get('guide',run.guideId)).content.steps.length,1);
});

test('tool-turn exhaustion forces a separate checkpoint instead of discarding collected provider sources',async t=>{
  const {store}=await setup(t);const ai=fixtureAI(),original=ai.chat;
  ai.chat=async(messages,options)=>options.schemaName==='research_checkpoint'?{content:JSON.stringify(checkpoint)}:original(messages,options);
  const agent=createAgent({...getConfig({}),maxTurns:1,timeoutMs:10000},store,{ai,fetchPage:async url=>({...source,url})});
  const run=await(await agent.start(input)).promise;
  assert.equal(run.research.identityStatus,'resolved');assert.ok(run.events.some(e=>e.stage==='checkpoint'));
  assert.equal((await store.get('guide',run.guideId)).content.steps.length,1);
});

test('a supplied website is reconsidered after a premature needs-input response',async t=>{
  const {store}=await setup(t);const ai=fixtureAI(),original=ai.chat;let turns=0;
  ai.chat=async(messages,options)=>options.tools?{content:JSON.stringify({...checkpoint,identityStatus:++turns===1?'needs_input':'resolved',candidates:[]})}:original(messages,options);
  const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{ai,fetchPage:async url=>({...source,url})});
  const run=await(await agent.start(input)).promise;
  assert.notEqual(run.status,'needs_input');assert.ok(run.guideId);assert.equal(turns,2);
});

test('an omitted official repository scope receives a bounded metadata recovery',async t=>{
  const {store}=await setup(t);const ai=fixtureAI(),original=ai.chat;let recoveries=0;
  ai.search=async()=>[{url:'https://github.com/example/oauth',title:'Official OAuth docs'}];
  ai.chat=async(messages,options)=>{
    if(options.tools)return {content:JSON.stringify(checkpoint)};
    if(options.schemaName==='research_checkpoint'){recoveries++;return {content:JSON.stringify({...checkpoint,officialDomains:['github.com/example/oauth']})};}
    return original(messages,options);
  };
  const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{ai,fetchPage:async url=>({...source,url})});
  const run=await(await agent.start(input)).promise;
  assert.equal(recoveries,1);assert.equal(run.sources[0].role,'provider');assert.ok(run.guideId);
});
