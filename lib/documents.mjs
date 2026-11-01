import { setTimeout as delay } from 'node:timers/promises';
import { AppError } from './config.mjs';
import { publicUrl, resolvePublicUrl } from './security.mjs';
import { extractMarkdownLinks } from './web.mjs';

// A retrieved URL is not automatically evidence. Be conservative about access
// screens while allowing real instructions that mention signing in.
export function documentQuality(page) {
  const text=String(page?.content||'').trim(),intro=`${page?.title||''}\n${text.slice(0,500)}`;
  if(text.length<80)return {usable:false,reason:'empty_page'};
  const instructions=/redirect uri|callback url|client_id|client id|authorization code|permission|scope|oauth application|oauth app/i.test(text);
  if(text.length<5000&&(/just a moment|verify (?:that )?you are human|checking your browser|enable javascript and cookies|captcha required/i.test(intro)||/access denied/i.test(intro)&&!instructions))return {usable:false,reason:'access_challenge'};
  const accountInstructions=/\b(?:navigate|configure|click|select|verification email|step \d|prerequisites)\b/i.test(text);
  if(text.length<1200&&/sign in|log in|login|authenticate/i.test(intro)&&!instructions&&!accountInstructions)return {usable:false,reason:'login_required'};
  if(text.length<1200&&/enable javascript|javascript (?:is )?required|loading\.\.\./i.test(intro)&&!instructions)return {usable:false,reason:'browser_required'};
  if(/^\s*[\[{]/.test(text)&&/"(?:props|pageProps|compiledSource|scripts)"\s*:/.test(text))return {usable:false,reason:'unreadable_data'};
  const labels=(page.links||[]).map(l=>l.title).filter(Boolean).join(' ');
  if(text.length<1000&&!instructions&&(page.links||[]).length>8&&labels.length>text.length*.7)return {usable:false,reason:'navigation_only'};
  return {usable:true,reason:'readable_text'};
}

async function boundedJson(response,signal) {
  if(!response.body)throw new AppError('The retrieval service returned no data.','retrieval_invalid');
  const reader=response.body.getReader(),chunks=[];let size=0;
  try {
    while(true){signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000)throw new AppError('The retrieval response exceeded its size limit.','retrieval_too_large');chunks.push(Buffer.from(value));}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {await reader.cancel().catch(()=>{});}
}

// One instance per run: shared paid-request cap, transient retries and cache.
// Search results are discovery only; only /extract raw_content is page evidence.
export function createDocuments(config,{directRead,modelSearch,fetchImpl=fetch,resolver,wait=(ms,signal)=>delay(ms,undefined,{signal}),onEvent=async()=>{}}) {
  let requests=0,disabled=false;
  const reads=new Map();
  const record=async info=>onEvent({...info,at:new Date().toISOString()});
  async function tavily(path,body,signal) {
    if(!config.tavilyApiKey||disabled)throw new AppError('Tavily extraction is not configured or is unavailable.','retrieval_unavailable');
    for(let attempt=0;attempt<2;attempt++){
      signal?.throwIfAborted();
      if(requests >= (config.maxTavilyRequests??6))throw new AppError('The Tavily request budget was reached.','retrieval_budget');
      requests++;
      const timeout=AbortSignal.timeout(config.retrievalTimeoutMs||35000),combined=AbortSignal.any([timeout,...(signal?[signal]:[])]);
      try {
        const response=await fetchImpl(`https://api.tavily.com/${path}`,{method:'POST',redirect:'error',signal:combined,headers:{Authorization:`Bearer ${config.tavilyApiKey}`,'Content-Type':'application/json'},body:JSON.stringify({...body,include_usage:true})});
        if(!response.ok){
          if([401,402,403,432,433].includes(response.status))disabled=true;
          const error=new AppError(`Tavily ${path} returned HTTP ${response.status}.`,`retrieval_${response.status}`);
          const header=response.headers.get('retry-after');
          error.retryAfterMs=header?Math.max(0,Number.isFinite(Number(header))?Number(header)*1000:Date.parse(header)-Date.now()):0;
          await response.body?.cancel();throw error;
        }
        const data=await boundedJson(response,combined);
        await record({service:'tavily',operation:path,status:'completed',request:requests,credits:Number.isFinite(data.usage?.credits)?data.usage.credits:null});
        return data;
      }catch(error){
        if(signal?.aborted)throw signal.reason;
        const code=error instanceof AppError?error.code:timeout.aborted?'retrieval_timeout':'retrieval_network';
        await record({service:'tavily',operation:path,status:'failed',request:requests,code});
        const waitMs=Math.max(400*(attempt+1),error.retryAfterMs||0);
        if(attempt===0&&/^(retrieval_(?:408|429|5\d\d|network))$/.test(code)&&waitMs<=3000){await wait(waitMs,signal);continue;}
        throw new AppError(`Document ${path} failed (${code}).`,code);
      }
    }
  }
  async function extract(url,signal) {
    // The remote service performs the retrieval. Validate the submitted and
    // returned URL; never send local/credential URLs or accept unrelated results.
    const target=(await resolvePublicUrl(url,resolver)).url.href;
    const data=await tavily('extract',{urls:[target],extract_depth:'advanced',format:'markdown',timeout:30},signal);
    const item=(Array.isArray(data.results)?data.results:[]).find(r=>{try{return publicUrl(r.url).href===target;}catch{return false;}});
    if(!item||typeof item.raw_content!=='string')throw new AppError('Tavily returned no matching extracted document.','extraction_failed');
    await resolvePublicUrl(item.url,resolver);
    const content=item.raw_content.slice(0,50000);
    return {url:target,title:content.match(/^#\s+(.+)$/m)?.[1]||target,content,links:extractMarkdownLinks(content,target),truncated:item.raw_content.length>50000,retrieval:'tavily_extract',retrievedAt:new Date().toISOString()};
  }
  async function retrieve(url,signal) {
    let page,last;
    try {
      const readSignal=AbortSignal.any([AbortSignal.timeout(config.retrievalTimeoutMs||35000),...(signal?[signal]:[])]);
      page=await directRead(url,readSignal);page.quality=documentQuality(page);
      await record({service:'direct',operation:'read',url,status:page.quality.usable?'completed':'unusable',code:page.quality.reason});
      if(page.quality.usable||page.quality.reason==='login_required')return page;
    }catch(error){
      if(signal?.aborted||['unsafe_url','invalid_url'].includes(error.code))throw error;
      last=new AppError('Direct document retrieval failed.',error.code||'fetch_failed');
      await record({service:'direct',operation:'read',url,status:'failed',code:last.code});
    }
    if(config.tavilyApiKey&&!disabled){
      try {
        const recovered=await extract(page?.url||url,signal);recovered.quality=documentQuality(recovered);
        await record({service:'tavily',operation:'read',url,status:recovered.quality.usable?'completed':'unusable',code:recovered.quality.reason});
        if(recovered.quality.usable)return {...recovered,requestedUrl:url};
        last=new AppError('The extracted page is not usable documentation.',recovered.quality.reason);
      }catch(error){if(signal?.aborted||['unsafe_url','invalid_url'].includes(error.code))throw error;last=error;}
    }
    if(page)return page;
    throw last||new AppError('No usable document could be retrieved.','empty_page');
  }
  return {
    read(url,signal){signal?.throwIfAborted();const key=publicUrl(url).href;if(!reads.has(key))reads.set(key,retrieve(key,signal));return reads.get(key);},
    async search(query,signal){
      signal?.throwIfAborted();
      if(config.searchProvider!=='model'&&config.tavilyApiKey&&!disabled){
        try {
          const data=await tavily('search',{query,search_depth:'advanced',max_results:5,include_answer:false,include_raw_content:false,auto_parameters:false},signal);
          const results=(Array.isArray(data.results)?data.results:[]).flatMap(r=>{try{return [{url:publicUrl(r.url).href,title:String(r.title||r.url).slice(0,300),snippet:String(r.content||'').slice(0,3000),publishedAt:r.published_date||null}];}catch{return [];}});
          if(results.length)return results;
          await record({service:'tavily',operation:'search_fallback',status:'empty'});
        }catch(error){if(signal?.aborted)throw signal.reason;await record({service:'tavily',operation:'search_fallback',status:'failed',code:error.code});}
      }
      return modelSearch(query,signal);
    },
  };
}
