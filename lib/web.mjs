import http from 'node:http';
import https from 'node:https';
import { resolvePublicUrl, publicUrl } from './security.mjs';
import { AppError } from './config.mjs';

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, code) => {
    if (code[0] !== '#') return entities[code.toLowerCase()] || match;
    const n = Number.parseInt(code.slice(code[1].toLowerCase() === 'x' ? 2 : 1), code[1].toLowerCase() === 'x' ? 16 : 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
  });
}
export function extractMarkdownLinks(content, baseUrl) {
  const links=[];
  // Agent-facing Markdown commonly declares its human-facing canonical URL in
  // front matter rather than in a Markdown anchor. It is still a discovered link.
  for(const match of content.matchAll(/^(?:canonical_url|markdown_url):\s*["']?(https?:\/\/[^\s"']+)["']?\s*$/gm)) {
    try {const url=publicUrl(new URL(match[1],baseUrl).href).href;links.push({url,title:match[0].startsWith('canonical_url')?'Canonical documentation page':'Markdown documentation page'});} catch { /* Ignore unsafe metadata URLs. */ }
  }
  for(const match of content.matchAll(/\[([^\]\n]{1,180})\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    try { const url=publicUrl(new URL(match[2],baseUrl).href).href;if(!links.some(l=>l.url===url))links.push({url,title:match[1]}); } catch { /* Not a public link. */ }
  }
  return links.slice(0,100);
}
export function extractPage(body, contentType, baseUrl) {
  if (/application\/json/i.test(contentType)) {
    const content=embeddedText(body);
    return {title:baseUrl,content,links:extractMarkdownLinks(content,baseUrl)};
  }
  if (!/html/i.test(contentType)) return { title: body.match(/^#\s+(.+)$/m)?.[1]?.trim() || baseUrl, content: body.trim(), links: extractMarkdownLinks(body,baseUrl) };
  const title = decode(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || baseUrl).replace(/<[^>]*>/g, '').trim();
  const clean = body.replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const links = [];
  for(const tag of clean.matchAll(/<link\b[^>]*>/gi)) {
    const attrs=Object.fromEntries([...tag[0].matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),decode(m[2])]));
    if(/alternate/i.test(attrs.rel||'')&&/text\/(markdown|plain)/i.test(attrs.type||'')) {
      try {links.push({url:publicUrl(new URL(attrs.href,baseUrl).href).href,title:'Markdown documentation alternative'});}catch{}
    }
  }
  for (const match of clean.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = publicUrl(new URL(decode(match[1]), baseUrl).href).href;
      const label = decode(match[2].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
      if (label && !links.some(l => l.url === url)) links.push({ url, title: label.slice(0, 160) });
    } catch { /* Ignore non-public and non-web destinations. */ }
  }
  const article=clean.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  let content = decode((article || clean).replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/section)\b[^>]*>/gi, '\n')
    .replace(/<\/(?:td|th)>/gi, ' | ').replace(/<[^>]*>/g, ' ')).replace(/[\t ]+/g, ' ').replace(/\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  // Read actual serialized prose only. Compiled MDX, scripts and executable
  // expressions are never evaluated or treated as documentation.
  if(content.length<400) {
    const embedded=[...body.matchAll(/<script\b[^>]*(?:type=["']application\/(?:ld\+)?json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>embeddedText(m[1])).sort((a,b)=>b.length-a.length)[0];
    if(embedded?.length>content.length){content=embedded;links.push(...extractMarkdownLinks(embedded,baseUrl));}
  }
  return { title, content, links: links.slice(0, 100) };
}

function embeddedText(raw) {
  if(raw.length>2000000)return '';
  try {
    const candidates=[];let nodes=0;
    const visit=(value,depth=0)=>{
      if(++nodes>5000||depth>12||!value||typeof value!=='object')return;
      for(const [key,item]of Object.entries(value)) {
        if(/^(compiledSource|script|code|javascript)$/i.test(key))continue;
        if(/^(markdown|rawMarkdown|articleBody|body|content)$/i.test(key)&&typeof item==='string'&&item.trim().length>=80&&!/\b(?:function\s*\(|jsx\(|eval\(|dangerouslySetInnerHTML)/.test(item))candidates.push(item.trim());
        else if(typeof item==='object')visit(item,depth+1);
      }
    };visit(JSON.parse(raw));return candidates.sort((a,b)=>b.length-a.length)[0]||'';
  }catch{return '';}
}

export async function fetchPublicPage(value, { signal, resolver, request: requestOverride, maxBytes=10000000 } = {}) {
  let current = value;
  let fallbackPage;
  const visited=new Set();
  for (let redirects = 0; redirects <= 4; redirects++) {
    const { url, address } = await resolvePublicUrl(current, resolver);
    if(visited.has(url.href)){if(fallbackPage)return {...fallbackPage,alternativeError:'alternative_loop'};throw new AppError('Documentation redirect or alternative loop.','fetch_failed');}
    visited.add(url.href);
    let result;
    try {result = await new Promise((resolve, reject) => {
      const request = requestOverride || (url.protocol === 'https:' ? https.request : http.request);
      const req = request(url, {
        method: 'GET', signal, agent: false,
        // Pin the connection to the DNS address checked above, preventing DNS rebinding.
        lookup: (_host, options, callback) => options.all ? callback(null, [address]) : callback(null, address.address, address.family),
        headers: { 'User-Agent': 'LaunchpathResearch/0.1 (+read-only OAuth documentation research)', Accept: 'text/html,text/plain,text/markdown,application/json', 'Accept-Encoding': 'identity' },
      }, res => {
        const status = res.statusCode || 0;
        if ([301,302,303,307,308].includes(status)) { res.resume(); resolve({ redirect: res.headers.location }); return; }
        if (status < 200 || status >= 300) { res.resume(); reject(new AppError(`Page returned HTTP ${status}.`, status === 401 || status === 403 ? 'login_or_access_required' : 'fetch_failed')); return; }
        const alternate=String(res.headers.link || '').split(/,(?=\s*<)/).find(link=>/rel=["']?alternate/i.test(link)&&/type=["']?text\/markdown/i.test(link));
        const markdown=alternate?.match(/<([^>]+)>/)?.[1];
        if(markdown){try{publicUrl(new URL(markdown,url).href);}catch(error){res.resume();reject(error);return;}}
        const type = res.headers['content-type'] || '';
        if (!/text\/(html|plain|markdown)|application\/json/i.test(type)) { res.resume(); reject(new AppError('This page type is not supported. PDF and browser-only pages require manual inspection.', 'unsupported_content')); return; }
        let size = 0; const chunks = [];
        res.on('data', chunk => { size += chunk.length; if (size > maxBytes) res.destroy(new AppError(`Page exceeded the ${maxBytes} byte retrieval limit.`, 'page_too_large')); else chunks.push(chunk); });
        res.on('error', reject);
        res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), type, markdown }));
      });
      req.setTimeout(18000, () => req.destroy(new AppError('Page retrieval timed out.', 'fetch_timeout')));
      req.on('error', reject); req.end();
    });}catch(error){
      if(!signal?.aborted&&url.protocol==='http:'&&['ECONNRESET','ECONNREFUSED','ETIMEDOUT','fetch_timeout'].includes(error.code)){
        const secure=new URL(url);secure.protocol='https:';current=secure.href;continue;
      }
      if(fallbackPage&&!signal?.aborted&&error.code!=='unsafe_url')return {...fallbackPage,alternativeError:error.code||'fetch_failed'};
      throw error;
    }
    if (result.redirect) { current = new URL(result.redirect, url).href; continue; }
    const page = extractPage(result.body, result.type, url.href);
    const saved={ ...page, requestedUrl: publicUrl(value).href, url: url.href, content: page.content.slice(0, 50000), truncated: page.content.length > 50000, retrieval: 'direct_http', retrievedAt: new Date().toISOString() };
    const alternative=result.markdown?{url:publicUrl(new URL(result.markdown,url).href).href}:page.links.find(l=>l.title==='Markdown documentation alternative'&&!visited.has(l.url));
    if(alternative&&!visited.has(alternative.url)){if(page.content.length>=80)fallbackPage=saved;current=alternative.url;continue;}
    if(page.content.length<80&&fallbackPage)return {...fallbackPage,alternativeError:'empty_page'};
    if (page.content.length < 80) throw new AppError('No usable page text was found. The page may require a browser or login.', 'empty_page');
    return saved;
  }
  if(fallbackPage)return {...fallbackPage,alternativeError:'too_many_redirects'};
  throw new AppError('Too many page redirects.', 'fetch_failed');
}
