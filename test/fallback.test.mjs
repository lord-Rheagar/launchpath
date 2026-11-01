import test from 'node:test';
import assert from 'node:assert/strict';
import { createAI } from '../lib/ai.mjs';
import { getConfig } from '../lib/config.mjs';
import { reviewSchema } from '../lib/schema.mjs';
const config=()=>getConfig({OPENROUTER_API_KEY:'test'});
const ok=()=>new Response(JSON.stringify({model:'backup-actual',usage:{prompt_tokens:10,completion_tokens:2},choices:[{finish_reason:'stop',message:{content:'{"findings":[]}'}}]}));

test('temporary failures retry then switch once; subsequent calls stay on backup',async()=>{
  const c=config(),models=[],events=[],usage=[],waits=[];
  const ai=createAI(c,{wait:async ms=>waits.push(ms),onRecovery:e=>events.push(e),onUsage:(u,m)=>usage.push(m.model),fetchImpl:async(_url,options)=>{const body=JSON.parse(options.body);models.push(body.model);return body.model===c.model?new Response('',{status:503}):ok();}});
  await ai.chat([],{schema:reviewSchema});await ai.chat([],{schema:reviewSchema});
  assert.deepEqual(models,[c.model,c.model,c.fallbackModel,c.fallbackModel]);assert.equal(waits.length,1);
  assert.deepEqual(events.map(e=>e.type),['retry','fallback']);assert.deepEqual(usage,['backup-actual','backup-actual']);
});

test('successful primary calls never invoke the backup',async()=>{
  const models=[];const ai=createAI(config(),{fetchImpl:async(_url,o)=>{models.push(JSON.parse(o.body).model);return ok();}});
  await ai.chat([]);assert.deepEqual(models,[config().model]);
});

test('timeouts switch immediately without repeating the slow primary',async()=>{
  const models=[];const ai=createAI(config(),{fetchImpl:async(_url,o)=>{const model=JSON.parse(o.body).model;models.push(model);if(models.length===1)throw new DOMException('Timeout','TimeoutError');return ok();}});
  await ai.chat([]);assert.deepEqual(models,[config().model,config().fallbackModel]);
});

test('invalid schema output and truncation trigger backup without weakening the schema',async()=>{
  for(const broken of [{finish_reason:'stop',message:{content:'{"wrong":true}'}},{finish_reason:'length',message:{content:'{'}}]){
    const bodies=[];const ai=createAI(config(),{fetchImpl:async(_url,o)=>{bodies.push(JSON.parse(o.body));return bodies.length===1?new Response(JSON.stringify({choices:[broken]})):ok();}});
    await ai.chat([],{schema:reviewSchema});assert.equal(bodies.length,2);assert.deepEqual(bodies[0].response_format,bodies[1].response_format);
    assert.equal(bodies[1].provider.require_parameters,true);
  }
});

test('auth, credits, forbidden and invalid requests never retry or switch models',async()=>{
  for(const status of [400,401,402,403]){let calls=0;const ai=createAI(config(),{fetchImpl:async()=>{calls++;return new Response('private body',{status});}});await assert.rejects(()=>ai.chat([]));assert.equal(calls,1);}
});

test('overall cancellation interrupts backoff and prevents fallback',async()=>{
  const controller=new AbortController();let calls=0;
  const ai=createAI(config(),{fetchImpl:async()=>{calls++;return new Response('',{status:429});},wait:async()=>{controller.abort(new Error('Cancelled'));throw controller.signal.reason;}});
  await assert.rejects(()=>ai.chat([],{signal:controller.signal}),/Cancelled/);assert.equal(calls,1);
});

test('Retry-After is respected and long waits switch to backup without retrying too early',async()=>{
  for(const seconds of ['2','60']){const waits=[],models=[];const ai=createAI(config(),{wait:async ms=>waits.push(ms),fetchImpl:async(_url,o)=>{models.push(JSON.parse(o.body).model);return models.length===1?new Response('',{status:429,headers:{'retry-after':seconds}}):ok();}});
    await ai.chat([]);if(seconds==='2'){assert.equal(waits[0],2000);assert.equal(models[1],config().model);}else{assert.equal(waits.length,0);assert.equal(models[1],config().fallbackModel);}
  }
});

test('request and fallback budgets stop repeated paid requests across calls',async()=>{
  let calls=0;const ai=createAI({...config(),maxModelRequests:3,maxFallbackRequests:1},{wait:async()=>{},fetchImpl:async(_url,o)=>{calls++;return JSON.parse(o.body).model===config().model?new Response('',{status:503}):ok();}});
  await ai.chat([]);await assert.rejects(()=>ai.chat([]),e=>e.code==='model_budget');assert.equal(calls,3);
});

test('backup failure is bounded and disabling fallback makes only primary attempts',async()=>{
  for(const fallbackModel of [config().fallbackModel,'']){let calls=0;const ai=createAI({...config(),fallbackModel},{wait:async()=>{},fetchImpl:async()=>{calls++;return new Response('',{status:503});}});await assert.rejects(()=>ai.chat([]));assert.equal(calls,fallbackModel?4:2);}
});
