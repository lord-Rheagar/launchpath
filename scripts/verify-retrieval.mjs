// Public-page smoke test only. No model calls or paid extraction.
import { writeFile } from 'node:fs/promises';
import { fetchPublicPage } from '../lib/web.mjs';
import { documentQuality } from '../lib/documents.mjs';

const cases=[
  ['Calendly','https://developer.calendly.com/docs/authentication/creating-an-oauth-app'],
  ['Mailchimp','https://mailchimp.com/developer/marketing/build/start-developing/set-up-an-oauth-app'],
  ['Deel','https://developer.deel.com/api/oauth.mdx'],
  ['Bexio','http://docs.bexio.com/'],
];
const results=await Promise.all(cases.map(async([provider,url])=>{
  try{const page=await fetchPublicPage(url,{signal:AbortSignal.timeout(45000)});return {provider,requestedUrl:url,url:page.url,characters:page.content.length,truncated:page.truncated,quality:documentQuality(page),retrieval:page.retrieval};}
  catch(error){return {provider,requestedUrl:url,error:error.code||error.name};}
}));
await writeFile(`test-results/retrieval-smoke-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.error||!r.quality.usable))process.exitCode=1;
