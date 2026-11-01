import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { isPublicAddress,publicUrl,resolvePublicUrl,normalizeInput,redact } from '../lib/security.mjs';
import { fetchPublicPage,extractPage,extractMarkdownLinks } from '../lib/web.mjs';

test('blocks private, encoded, metadata, reserved, credential and non-web URLs',()=>{for(const url of ['http://127.0.0.1','http://2130706433','http://0x7f000001','http://10.0.0.1','http://169.254.169.254','http://[::1]','http://[::ffff:127.0.0.1]','http://192.168.1.1','http://100.64.0.1','http://localhost','file:///etc/passwd','https://user:secret@example.com','https://example.com:8080','https://example.com?access_token=private'])assert.throws(()=>publicUrl(url),url);assert.equal(isPublicAddress('8.8.8.8'),true);assert.equal(isPublicAddress('2606:4700:4700::1111'),true);});
test('checks every DNS answer and rejects private DNS or mixed records',async()=>{await assert.rejects(()=>resolvePublicUrl('https://example.com',async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}]),/private/);});
test('pins vetted DNS result and rechecks redirect targets',async()=>{
  let requestCount=0;
  function request(url,options,callback){requestCount++;options.lookup('example.com',{},(_err,address)=>assert.equal(address,'8.8.8.8'));const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=302;res.headers={location:'http://127.0.0.1/private'};res.resume=()=>{};callback(res);};return req;}
  await assert.rejects(()=>fetchPublicPage('https://example.com',{resolver:async()=>[{address:'8.8.8.8',family:4}],request}),/public/);assert.equal(requestCount,1);
});
test('extracts text and links, excluding script/style execution and unsafe links',()=>{const p=extractPage('<title>OAuth &amp; Apps</title><script>steal()</script><style>bad</style><h1>Register</h1><p>Add callback URL.</p><a href="/setup">Setup</a><a href="javascript:alert(1)">bad link</a>','text/html','https://example.com/docs');assert.equal(p.title,'OAuth & Apps');assert.ok(!p.content.includes('steal'));assert.equal(p.links.length,1);assert.equal(p.links[0].url,'https://example.com/setup');});
test('rejects invalid scenarios and secrets; redacts keys',()=>{assert.throws(()=>normalizeInput({provider:'x',audience:'everyone'}));assert.throws(()=>normalizeInput({provider:'x',capability:'api_key=private-secret'}));assert.throws(()=>normalizeInput({provider:'x',website:'http://10.0.0.1'}));assert.equal(redact('a secret-value b',['secret-value']),'a [redacted] b');});
test('Markdown fetch results expose safe follow-up links for the direct DeepSeek agent',()=>{const links=extractMarkdownLinks('[Register](/apps/new) [Private](http://127.0.0.1) [Scopes](https://example.com/scopes)','https://example.com/docs');assert.equal(links.length,2);assert.equal(links[0].url,'https://example.com/apps/new');});
test('plain-text Markdown documentation retains its title and discovered destinations',()=>{const page=extractPage('# OAuth setup\n\n[Create app](https://example.com/register)','text/plain','https://example.com/docs');assert.equal(page.title,'OAuth setup');assert.equal(page.links[0].url,'https://example.com/register');});
test('Markdown front matter discovers canonical documentation URLs without accepting unsafe URLs',()=>{const page=extractPage('---\ncanonical_url: "https://example.com/docs"\nmarkdown_url: "http://127.0.0.1/private"\n---\n# OAuth\nPublic documentation.','text/plain','https://example.com/docs.md');assert.equal(page.links.length,1);assert.equal(page.links[0].url,'https://example.com/docs');});

test('article extraction keeps documentation ahead of large navigation and discovers Markdown alternatives',()=>{
  const page=extractPage('<link rel="alternate" type="text/markdown" href="/oauth.md"><nav>'+('Navigation '.repeat(6000))+'</nav><main><h1>OAuth registration</h1><p>Register your application and choose the callback URL.</p></main>','text/html','https://example.com/oauth');
  assert.ok(!page.content.includes('Navigation'));assert.match(page.content,/Register your application/);
  assert.equal(page.links[0].url,'https://example.com/oauth.md');
});

test('Markdown alternatives recheck private redirect destinations before connecting',async()=>{
  let calls=0;function request(url,options,callback){calls++;const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'text/html',link:'<http://127.0.0.1/private>; rel="alternate"; type="text/markdown"'};res.resume=()=>{};callback(res);};return req;}
  await assert.rejects(()=>fetchPublicPage('https://example.com',{resolver:async()=>[{address:'8.8.8.8',family:4}],request}),/public/);assert.equal(calls,1);
});

test('self-advertised Markdown links do not cause a redirect loop or discard page text',async()=>{
  let calls=0;function request(url,options,callback){calls++;const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'text/markdown',link:'<https://example.com/oauth.md>; rel="alternate"; type="text/markdown"'};res.resume=()=>{};callback(res);queueMicrotask(()=>{res.emit('data',Buffer.from('# OAuth documentation\n'+('Register an application and configure its redirect URL. '.repeat(4))));res.emit('end');});};return req;}
  const page=await fetchPublicPage('https://example.com/oauth.md',{resolver:async()=>[{address:'8.8.8.8',family:4}],request});
  assert.equal(calls,1);assert.match(page.content,/Register an application/);
});

test('a failed public HTTP documentation connection retries HTTPS with DNS checks',async()=>{
  const protocols=[];let resolutions=0;
  function request(url,options,callback){protocols.push(url.protocol);const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{
    if(url.protocol==='http:'){queueMicrotask(()=>req.emit('error',Object.assign(new Error('reset'),{code:'ECONNRESET'})));return;}
    const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'text/plain'};callback(res);queueMicrotask(()=>{res.emit('data',Buffer.from('Public OAuth documentation. '.repeat(8)));res.emit('end');});
  };return req;}
  const page=await fetchPublicPage('http://example.com/docs',{resolver:async()=>{resolutions++;return [{address:'8.8.8.8',family:4}];},request});
  assert.deepEqual(protocols,['http:','https:']);assert.equal(resolutions,2);assert.equal(page.url,'https://example.com/docs');
});

test('documentation size remains bounded even when the reader supports larger API pages',async()=>{
  function request(url,options,callback){const req=new EventEmitter();req.setTimeout=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'text/plain'};res.destroy=error=>res.emit('error',error);callback(res);queueMicrotask(()=>res.emit('data',Buffer.alloc(100)));};return req;}
  await assert.rejects(()=>fetchPublicPage('https://example.com',{resolver:async()=>[{address:'8.8.8.8',family:4}],request,maxBytes:50}),e=>e.code==='page_too_large');
});
