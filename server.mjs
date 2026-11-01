import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { getConfig, AppError } from './lib/config.mjs';
import { Store } from './lib/store.mjs';
import { startWorker } from './lib/jobs.mjs';
import { createAgent } from './lib/agent.mjs';
import { redact } from './lib/security.mjs';
import { library,getPreparedGuide } from './lib/library.mjs';

const publicRoot=fileURLToPath(new URL('./public/',import.meta.url));
const staticFiles={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/tokens.css':'tokens.css','/base.css':'base.css','/hanken-grotesk.ttf':'hanken-grotesk.ttf'};
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',ttf:'font/ttf'};
const validId=id=>/^[a-f0-9-]{36}$/.test(id);

function publicGuide(record) {
  if(!record)return record;
  return {...record,resultType:record.content.steps.length?'walkthrough':record.guideMode==='source_digest'?'source_guide':'evidence_only',sources:record.sources.map(({content,links,...source})=>source)};
}
function publicRun(run) {
  const {modelCheckpoints,sources,searchResults,research,validationErrors,generationAttempts,draftCandidate,sectionDraft,sectionAttempts,semanticRepair,reviewHistory,pendingRepair,pendingReview,...rest}=run;
  return {...rest,sourceCount:sources.length,sources:sources.map(({content,links,...source})=>source)};
}
async function readBody(req) {
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000)throw new AppError('Research request is too large.','invalid_input',413);}
  try{return JSON.parse(body);}catch{throw new AppError('Send a valid JSON request.','invalid_input',400);}
}
const equal=(a,b)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);};

export async function createApp(config=getConfig(), dependencies={}) {
  const store=dependencies.store || new Store(config.dataDir);await store.init();
  const agent=dependencies.agent || createAgent(config,store,{...dependencies,enqueue:!dependencies.ai});
  const worker=!dependencies.ai?startWorker(config,store,dependencies):null;
  const requests=new Map();
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Cache-Control','no-store');
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try {
      const url=new URL(req.url,'http://localhost');const path=url.pathname;
      if(req.method==='GET'&&path==='/api/config')return json(200,{configured:!!config.apiKey,provider:config.provider,model:config.model,passwordRequired:!!config.password,limits:{searches:config.maxSearches,pages:config.maxPages,timeoutMs:config.timeoutMs}});
      if(req.method==='GET'&&path==='/api/library')return json(200,library.map(({file,...entry})=>entry));
      if(req.method==='GET'&&path.startsWith('/api/library/')){const prepared=await getPreparedGuide(path.split('/').pop());return json(prepared?200:404,prepared||{error:'Guide not found.'});}
      if(req.method==='POST'&&path==='/api/research'){
        if(req.headers.origin && req.headers.origin!==`${req.socket.encrypted?'https':'http'}://${req.headers.host}` && new URL(req.headers.origin).host!==req.headers.host)throw new AppError('Research must be started from this app.','invalid_origin',403);
        if(!req.headers['content-type']?.startsWith('application/json'))throw new AppError('Send application/json.','invalid_input',415);
        if(config.password&&!equal(req.headers['x-research-password']||'',config.password))throw new AppError('Enter the research password. Shared guides can still be read without it.','unauthorized',401);
        const key=req.socket.remoteAddress;const now=Date.now();const prior=requests.get(key)||[];const recent=prior.filter(t=>now-t<3600000);
        if(recent.length>=20)throw new AppError('Research limit reached. Try again in an hour.','rate_limit',429);
        const input=await readBody(req);const started=await agent.start(input);recent.push(now);requests.set(key,recent);
        started.promise.catch(error=>console.error('Research persistence failure:',redact(error.message,[config.apiKey])));
        return json(202,{runId:started.run.id,url:`/r/${started.run.id}`});
      }
      const runMatch=path.match(/^\/api\/runs\/([a-f0-9-]+)$/);
      if(req.method==='GET'&&runMatch&&validId(runMatch[1])){const run=await store.get('run',runMatch[1]);return json(run?200:404,run?publicRun(run):{error:'Research run not found.'});}
      const guideMatch=path.match(/^\/api\/guides\/([a-f0-9-]+)$/);
      if(req.method==='GET'&&guideMatch&&validId(guideMatch[1])){const guide=await store.get('guide',guideMatch[1]);return json(guide?200:404,guide?publicGuide(guide):{error:'Guide not found.'});}
      const pageFile=staticFiles[path] || (/^\/(g|r)\/[a-f0-9-]{36}$/.test(path)||/^\/library\/(github|slack|gmail)$/.test(path)?'index.html':null);
      if(req.method==='GET'&&pageFile){const content=await readFile(`${publicRoot}${pageFile}`);res.writeHead(200,{'Content-Type':mime[pageFile.split('.').pop()]});return res.end(content);}
      return json(404,{error:'Page not found.'});
    }catch(error){return json(error.status||500,{error:redact(error.status?error.message:'The request could not be completed. Check the server configuration and try again.',[config.apiKey]),code:error.code||'server_error'});}
  });
  server.on('close',()=>{worker?.close();for(const controller of agent.active?.values()||[])controller.abort();});
  return {server,agent,store};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const config=getConfig();const {server}=await createApp(config);
  server.listen(config.port,config.host,()=>console.log(`Launchpath: http://${config.host}:${config.port}\nModel: ${config.provider}/${config.model}\nLive research: ${config.apiKey?'configured':'add an API key to .env, then restart'}`));
}
