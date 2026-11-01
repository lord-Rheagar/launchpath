import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createDocuments,documentQuality } from '../lib/documents.mjs';
import { extractPage,fetchPublicPage } from '../lib/web.mjs';
import { getConfig } from '../lib/config.mjs';
import { source } from './fixtures.mjs';

const resolver=async()=>[{address:'8.8.8.8',family:4}];
const config={...getConfig({}),tavilyApiKey:'private-fixture-key'};
const json=value=>new Response(JSON.stringify(value));
const failedRead=async()=>{throw Object.assign(new Error('Cannot read page'),{code:'empty_page'});};

test('content checks distinguish login/challenge/navigation shells from sign-in instructions',()=>{
  assert.equal(documentQuality({content:'Sign in to your account. '.repeat(5)}).reason,'login_required');
  assert.equal(documentQuality({title:'Just a moment',content:'Checking your browser before accessing this page. '.repeat(4)}).usable,false);
  assert.equal(documentQuality({content:'Loading... Please enable JavaScript to use this application. '.repeat(3)}).reason,'browser_required');
  assert.equal(documentQuality({content:'Home Products Pricing Support '.repeat(4),links:Array.from({length:12},()=>({title:'Home Products Pricing Support'}))}).reason,'navigation_only');
  assert.equal(documentQuality({...source,content:'Sign in to the dashboard. '+source.content}).usable,true);
  assert.equal(documentQuality({...source,title:'Access denied errors',content:'Access denied can result from incorrect permissions. '+source.content}).usable,true);
  assert.equal(documentQuality({title:'Create a developer account',content:'Sign in to the dashboard. Select Account settings, then click Create developer account. Open the verification email to confirm your account.'}).usable,true);
});

test('serialized page prose is readable without evaluating compiled MDX or scripts',()=>{
  const embedded=extractPage(`<title>Docs</title><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{body:source.content,compiledSource:'globalThis.executed = true;'}}})}</script>`,'text/html',source.url);
  assert.equal(embedded.content,source.content);assert.equal(globalThis.executed,undefined);
  assert.equal(extractPage(JSON.stringify({props:{compiledSource:'malicious()'.repeat(50)}}),'application/json',source.url).content,'');
  assert.equal(extractPage(JSON.stringify({markdown:source.content}),'application/json',source.url).content,source.content);
});

test('a failed advertised Markdown alternate preserves readable original HTML',async()=>{
  const seen=[];function request(url,options,callback){seen.push(url.href);const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{const res=new EventEmitter();res.resume=()=>{};
    res.statusCode=url.pathname.endsWith('.md')?404:200;res.headers={'content-type':'text/html',link:'</oauth.md>; rel="alternate"; type="text/markdown"'};callback(res);
    if(res.statusCode===200)queueMicrotask(()=>{res.emit('data',Buffer.from(`<main>${source.content}</main>`));res.emit('end');});
  };return req;}
  const page=await fetchPublicPage(source.url,{resolver,request});assert.equal(page.url,source.url);assert.equal(page.content,source.content);assert.equal(page.alternativeError,'fetch_failed');assert.equal(seen.length,2);
});

test('readable direct documents are cached without a paid extraction',async()=>{
  let reads=0,paid=0;const docs=createDocuments(config,{directRead:async()=>{reads++;return {...source};},modelSearch:async()=>[],fetchImpl:async()=>{paid++;throw new Error();}});
  const a=await docs.read(source.url),b=await docs.read(source.url+'#registration');assert.equal(a,b);assert.equal(reads,1);assert.equal(paid,0);
});

test('unreadable pages recover through bounded advanced extraction using page text only',async()=>{
  const requests=[],events=[];const docs=createDocuments(config,{directRead:failedRead,modelSearch:async()=>[],resolver,onEvent:async e=>events.push(e),fetchImpl:async(url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return json({results:[{url:source.url,raw_content:'# OAuth\n'+source.content}],answer:'Never use this generated answer as evidence',usage:{credits:2}});}});
  const page=await docs.read(source.url);assert.equal(page.retrieval,'tavily_extract');assert.equal(page.quality.usable,true);assert.ok(!page.content.includes('generated answer'));assert.equal(requests[0].body.extract_depth,'advanced');assert.equal(requests[0].options.redirect,'error');assert.equal(events.find(e=>e.operation==='extract').credits,2);
});

test('HTTP 200 extraction failures or unrelated results never become evidence',async()=>{
  for(const data of [{results:[],failed_results:[{url:source.url,error:'Private upstream text'}]},{results:[{url:'https://other.example/docs',raw_content:source.content}]}]){
    const docs=createDocuments(config,{directRead:failedRead,modelSearch:async()=>[],resolver,fetchImpl:async()=>json(data)});
    await assert.rejects(()=>docs.read(source.url),e=>e.code==='extraction_failed'&&!e.message.includes('Private upstream'));
  }
});

test('remote extraction cannot receive private URLs or private DNS destinations',async()=>{
  let paid=0;const docs=createDocuments(config,{directRead:failedRead,modelSearch:async()=>[],resolver:async()=>[{address:'127.0.0.1',family:4}],fetchImpl:async()=>{paid++;return json({});}});
  assert.throws(()=>docs.read('http://127.0.0.1/'),/public/);
  await assert.rejects(()=>docs.read(source.url),e=>e.code==='unsafe_url');assert.equal(paid,0);
});

test('a missing extraction key preserves the failure without calling paid services',async()=>{
  let called=false;const docs=createDocuments({...config,tavilyApiKey:''},{directRead:failedRead,modelSearch:async()=>[],fetchImpl:async()=>{called=true;}});
  await assert.rejects(()=>docs.read(source.url),e=>e.code==='empty_page');assert.equal(called,false);
});

test('Tavily search returns discoveries and falls back after an unavailable service',async()=>{
  let fallback=0;const docs=createDocuments(config,{directRead:failedRead,modelSearch:async()=>{fallback++;return [{url:source.url}];},wait:async()=>{},fetchImpl:async()=>new Response('secret upstream body',{status:503})});
  assert.equal((await docs.search('OAuth'))[0].url,source.url);assert.equal(fallback,1);
  const good=createDocuments(config,{directRead:failedRead,modelSearch:async()=>{throw new Error('must not call');},fetchImpl:async()=>json({results:[{url:source.url,content:'Search snippet',raw_content:'Not a saved page'},{url:'http://127.0.0.1'}]})});
  const results=await good.search('OAuth');assert.equal(results.length,1);assert.equal(results[0].content,undefined);assert.equal(results[0].snippet,'Search snippet');
});

test('Tavily auth errors disable repeated paid calls and never disclose the key or error body',async()=>{
  const events=[];let calls=0;const docs=createDocuments(config,{directRead:failedRead,modelSearch:async()=>[],onEvent:async e=>events.push(e),fetchImpl:async()=>{calls++;return new Response('private-fixture-key and sensitive upstream data',{status:401});}});
  await docs.search('First');await docs.search('Second');assert.equal(calls,1);assert.ok(!JSON.stringify(events).includes('private-fixture-key'));assert.ok(!JSON.stringify(events).includes('sensitive'));
});

test('request caps include retries and cover search and extraction together',async()=>{
  let calls=0;const docs=createDocuments({...config,maxTavilyRequests:2},{directRead:failedRead,modelSearch:async()=>[],resolver,wait:async()=>{},fetchImpl:async()=>{calls++;return new Response('',{status:503});}});
  await docs.search('OAuth');await assert.rejects(()=>docs.read(source.url),e=>e.code==='retrieval_budget');assert.equal(calls,2);
});

test('long Retry-After falls back without retrying early and abort stops fallback',async()=>{
  let calls=0;const docs=createDocuments(config,{directRead:failedRead,modelSearch:async()=>[],wait:async()=>{throw new Error('must not wait');},fetchImpl:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'60'}});}});
  await docs.search('OAuth');assert.equal(calls,1);
  const controller=new AbortController();controller.abort(new Error('Stop'));await assert.rejects(()=>docs.search('Cancelled',controller.signal),/Stop/);assert.equal(calls,1);
});

test('oversized extraction responses are bounded and do not become sources',async()=>{
  const docs=createDocuments(config,{directRead:failedRead,modelSearch:async()=>[],resolver,fetchImpl:async()=>json({results:[{url:source.url,raw_content:'x'.repeat(2000001)}]})});
  await assert.rejects(()=>docs.read(source.url),e=>e.code==='retrieval_too_large');
});
