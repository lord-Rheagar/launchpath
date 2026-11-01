import { getConfig } from '../lib/config.mjs';
import { Store } from '../lib/store.mjs';
import { createAgent } from '../lib/agent.mjs';

const args=process.argv.slice(2);const flags={};
for(let i=0;i<args.length;i++){if(args[i].startsWith('--'))flags[args[i].slice(2)]=args[++i];else flags.provider=args[i];}
if(!flags.provider&&!flags['from-run']){console.error('Usage: npm run research -- "Notion" [--website https://www.notion.com]\nOr: npm run research -- --from-run RUN_ID (reuse saved evidence; no fresh search)');process.exitCode=1;}
else{
  try{const config=getConfig();const store=new Store(config.dataDir);await store.init();const agent=createAgent(config,store);const{run,promise}=flags['from-run']?await agent.resume(flags['from-run'],{regenerate:flags.regenerate==='true'}):await agent.start(flags);console.log(`Run ${run.id}`);const result=await promise;for(const event of result.events)console.log(`${event.stage}: ${event.message}`);console.log(JSON.stringify({status:result.status,guide:result.guideId?`/g/${result.guideId}`:null,clarification:result.clarification,error:result.error,usage:result.usage},null,2));if(['failed','timed_out'].includes(result.status))process.exitCode=1;}
  catch(error){console.error(error.message);process.exitCode=1;}
}
