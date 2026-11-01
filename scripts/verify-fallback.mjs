// Opt-in live verification: primary failures are simulated locally; only the
// backup is billed. Reuses saved evidence and creates a new immutable guide.
import { getConfig } from '../lib/config.mjs';
import { Store } from '../lib/store.mjs';
import { createAgent } from '../lib/agent.mjs';
const id=process.argv[2];
if(!id)throw new Error('Usage: node --env-file-if-exists=.env scripts/verify-fallback.mjs SAVED_RUN_ID');
const config=getConfig();if(config.provider!=='openrouter'||!config.fallbackModel)throw new Error('An OpenRouter backup must be enabled.');
const store=new Store(config.dataDir);await store.init();let simulatedFailures=0;
const agent=createAgent(config,store,{fetchImpl:async(url,options)=>{
  if(JSON.parse(options.body).model===config.model){simulatedFailures++;return new Response('',{status:503});}
  return fetch(url,options);
}});
const {run,promise}=await agent.resume(id,{regenerate:true});
run.verification='Simulated primary outage; real paid backup generation from saved sources.';
console.log(`Verification run ${run.id}`);
const result=await promise;const guide=await store.get('guide',result.guideId);
console.log(JSON.stringify({simulation:run.verification,simulatedFailures,status:result.status,guideId:result.guideId,steps:guide?.content.steps.length,modelsUsed:guide?.modelsUsed,review:guide?.review,usage:result.usage,recoveryEvents:result.recoveryEvents},null,2));
if(!guide?.content.steps.length)process.exitCode=1;
