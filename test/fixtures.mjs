import { safePartial } from '../lib/evidence.mjs';
import { passageCatalog } from '../lib/passages.mjs';

export const input={provider:'ExampleApp',website:'https://example.com/',audience:'external',capability:'Read selected records',scopes:'records:read',appType:'OAuth app'};
export const source={id:'s1',url:'https://example.com/docs/oauth',title:'OAuth registration',content:'Register an OAuth application in the developer dashboard. Add your authorization callback URL. The records:read scope reads selected records. External users require a published app. A test connection does not establish customer launch readiness.',retrievedAt:'2026-10-30T00:00:00.000Z',retrieval:'test_fixture',role:'provider',links:[{url:'https://example.com/register',title:'Register an app'}]};
export function fixtureGuide(){
  const g=safePartial(input,[source],'Production approval timing has not been established.');
  g.provider={name:'ExampleApp',website:'https://example.com/',oauthStatus:'supported',appType:'OAuth app'};
  g.claims.push({id:'c2',text:'Register an OAuth application in the developer dashboard.',status:'documented',evidence:[{sourceId:'s1',quote:'Register an OAuth application in the developer dashboard.'}],assumptions:[]});
  g.claims.push({id:'c3',text:'Read selected records using records:read.',status:'documented',evidence:[{sourceId:'s1',quote:'The records:read scope reads selected records.'}],assumptions:[]});
  g.prerequisites=[{requirement:'Access to the developer dashboard.',owner:'Developer',claimIds:['c2']}];
  g.permissions=[{permission:'records:read',purpose:'Read selected records.',consequence:'Limited to selected records.',claimIds:['c3']}];
  g.steps=[{id:'step1',title:'Register the OAuth app',action:'Open the developer dashboard and register an OAuth application.',destination:'https://example.com/register',expectedOutput:'The provider displays the app registration.',owner:'Developer',dependsOn:[],claimIds:['c2'],fallback:'Open the official documentation and confirm account access with the administrator.'}];
  return g;
}
export function fixtureAI({badQuote=false,ambiguous=false,reviewIssues=[],reviewAdvisories=[],reviewEditorials=[],reviewIssuesOnce=false,searchError=false,slow=false,truncatedResearchOnce=false,brokenSection='',breakOnce=false}={}){
  let turn=0,writes=0,reviews=0;const calls=[];
  let breaks=0;
  return {calls,get writes(){return writes;},async search(query,signal){calls.push({kind:'search',query});if(searchError)throw new Error('Search unavailable.');if(slow)await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});return [{url:source.url,title:source.title,snippet:'Official OAuth docs.'},{url:'https://example.com/register',title:'Register',snippet:'Sign in to register.'}];},
    async chat(messages,options){calls.push({kind:'chat',messages,options});
      if(options.schemaName==='evidence_coverage'){
        const context=JSON.parse(messages[1].content);
        return {role:'assistant',content:JSON.stringify({items:context.questions.map(q=>({id:q.id,status:['authentication','registration','permissions'].includes(q.id)?'supported':'unknown',passageIds:['authentication','registration','permissions'].includes(q.id)?[context.passages[0].id]:[],reason:'See the retrieved documentation.'}))})};
      }
      if(options.schemaName==='research_checkpoint')return {role:'assistant',content:JSON.stringify({identityStatus:'resolved',providerName:'ExampleApp',website:'https://example.com/',officialDomains:['example.com'],identityBasis:'Official developer documentation.',candidates:[],coverage:['registration'],unansweredQuestions:['Approval timing']})};
      if(options.schemaName==='confirm_review')return {role:'assistant',content:JSON.stringify({decisions:JSON.parse(messages[1].content).findings.map(f=>({id:f.id,decision:'confirmed',reason:'The fixture preserves this material finding.',sourceId:f.sourceIds[0],quote:''}))})};
      if(options.tools){turn++;if(truncatedResearchOnce&&turn===2)throw Object.assign(new Error('The model response exceeded the output limit.'),{code:'incomplete_output'});if(turn===1&&!ambiguous)return {role:'assistant',content:null,tool_calls:[{id:'call1',type:'function',function:{name:'read_page',arguments:JSON.stringify({url:source.url})}},{id:'call2',type:'function',function:{name:'inspect_setup',arguments:JSON.stringify({url:'https://example.com/register'})}}]};
        return {role:'assistant',content:JSON.stringify({identityStatus:ambiguous?'needs_input':'resolved',providerName:'ExampleApp',website:'https://example.com/',officialDomains:['example.com'],identityBasis:'Official developer documentation.',candidates:ambiguous?[{name:'ExampleApp',website:'https://example.com/'}]:[],coverage:['registration'],unansweredQuestions:['Approval timing']})};}
      if(messages[0].content.startsWith('Review OAuth'))return {role:'assistant',content:JSON.stringify({findings:[...(reviewIssuesOnce&&reviews++>0?[]:reviewIssues).map(message=>({severity:'blocking',kind:'factual_error',message,claimIds:['c2'],sourceIds:['s1']})),...reviewAdvisories.map(message=>({severity:'advisory',kind:'suggestion',message,claimIds:['c2'],sourceIds:['s1']})),...reviewEditorials.map(message=>({severity:'blocking',kind:'editorial',message,claimIds:['c2'],sourceIds:['s1']}))]})};
      if(messages[0].content.startsWith('Correct this OAuth')){writes++;return {role:'assistant',content:JSON.stringify({replacements:[{path:'/summary/launchReadiness/text',value:'External launch requirements remain unresolved and need review.'}]})};}
      writes++;const g=fixtureGuide();
      if(options.schema){
        for(const claim of g.claims)claim.evidence=claim.evidence.map(()=>({passageId:passageCatalog([source])[0].alias}));
        const ids=options.schema.properties.claims?.items.properties.id.enum;
        if(ids)g.claims=g.claims.filter(c=>ids.includes(c.id));
        if(badQuote)g.claims[1].evidence[0].passageId='invented_passage';
        const value=Object.fromEntries(Object.keys(options.schema.properties).map(key=>[key,g[key]]));
        if(brokenSection in value&&(!breakOnce||breaks++===0))value[brokenSection]=null;
        return {role:'assistant',content:JSON.stringify(value)};
      }
      if(badQuote)g.claims[1].evidence[0].quote='This invented sentence is not in the retrieved page.';return {role:'assistant',content:JSON.stringify(g)};
    },async fetchPage(url){return {...source,url};},
  };
}
