import test from 'node:test';
import assert from 'node:assert/strict';
import { createAI } from '../lib/ai.mjs';
import { getConfig } from '../lib/config.mjs';
import { reviewSchema } from '../lib/schema.mjs';

test('structured calls send a strict schema and require supporting OpenRouter endpoints',async()=>{
  let body;const ai=createAI(getConfig({OPENROUTER_API_KEY:'test'}),{fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"findings":[]}'}}]}));}});
  await ai.chat([],{schema:reviewSchema,schemaName:'guide_review',reasoning:false});
  assert.equal(body.response_format.type,'json_schema');assert.equal(body.response_format.json_schema.strict,true);
  assert.deepEqual(body.response_format.json_schema.schema,reviewSchema);assert.equal(body.provider.require_parameters,true);
});

test('unsupported strict schemas fail explicitly rather than silently downgrading to JSON mode',async()=>{
  let calls=0;const ai=createAI(getConfig({OPENROUTER_API_KEY:'test'}),{fetchImpl:async()=>{calls++;return new Response('{}',{status:400});}});
  await assert.rejects(()=>ai.chat([],{schema:reviewSchema}),/HTTP 400/);assert.equal(calls,1);
});

test('OpenRouter sends configured DeepSeek model and actual web plugin; only annotations become discoveries',async()=>{
  const calls=[];const config=getConfig({OPENROUTER_API_KEY:'private-test-key'});
  const ai=createAI(config,{fetchImpl:async(url,options)=>{calls.push({url,body:JSON.parse(options.body),headers:options.headers});return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'Invented https://evil.example/fake',annotations:[{type:'url_citation',url_citation:{url:'https://example.com/docs',title:'Docs',content:'Extracted excerpt'}}]}}]}));}});
  const results=await ai.search('Example OAuth');assert.equal(calls[0].url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(calls[0].body.model,'deepseek/deepseek-v4.1-flash-1017');assert.equal(calls[0].body.plugins[0].id,'web');assert.equal(results.length,1);assert.equal(results[0].url,'https://example.com/docs');assert.equal(calls[0].headers.Authorization,'Bearer private-test-key');
});
test('direct DeepSeek search/fetch use documented endpoints and response format',async()=>{const calls=[];const ai=createAI(getConfig({DEEPSEEK_API_KEY:'test'}),{fetchImpl:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify(url.endsWith('search')?{results:[{url:'https://example.com',title:'Example',summary:'Summary'}]}:{title:'Example',content:'Retrieved page'}));}});assert.equal((await ai.search('OAuth'))[0].snippet,'Summary');assert.equal((await ai.fetchPage('https://example.com')).content,'Retrieved page');assert.equal(calls[0].url,'https://api.deepseek.com/v1/tools/search');assert.equal(calls[1].url,'https://api.deepseek.com/v1/tools/fetch');});
test('provider auth failure is not retried and never exposes upstream bodies',async()=>{let calls=0;const ai=createAI(getConfig({OPENROUTER_API_KEY:'test'}),{fetchImpl:async()=>{calls++;return new Response('secret upstream body',{status:401});}});await assert.rejects(()=>ai.chat([{role:'user',content:'test'}]),error=>error.message.includes('key was rejected')&&!error.message.includes('secret upstream'));assert.equal(calls,1);});
test('empty, missing, and truncated provider messages are handled explicitly',async()=>{const ai=createAI(getConfig({DEEPSEEK_API_KEY:'test'}),{fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{broken'}}]}))});await assert.rejects(()=>ai.chat([]),/output limit/);});
test('search preserves provider citations when its unused prose is truncated and disables search reasoning',async()=>{let body;const ai=createAI(getConfig({OPENROUTER_API_KEY:'test'}),{fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'',annotations:[{type:'url_citation',url_citation:{url:'https://example.com/oauth',title:'Official docs'}}]}}]}));}});const results=await ai.search('OAuth');assert.equal(body.reasoning.enabled,false);assert.equal(results[0].url,'https://example.com/oauth');});
