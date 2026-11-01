import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createAgent} from './agent.mjs';

function alive(pid){try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}}
export async function claimRun(store,id){
  store.filename('run',id); // Validate before constructing a lock path.
  const path=join(store.directory,`job-${id}.lock`),owner={pid:process.pid,token:randomUUID()};
  try{await mkdir(path);}catch(error){
    if(error.code!=='EEXIST')throw error;
    let prior;try{prior=JSON.parse(await readFile(join(path,'owner.json'),'utf8'));}catch{return null;}
    if(!Number.isInteger(prior.pid)||alive(prior.pid))return null;
    // A fixed, nonempty quarantine destination prevents two stale-lock
    // reclaimers from renaming a newly acquired lock after racing each other.
    try{await rename(path,`${path}.stale-${prior.token}`);await mkdir(path);}catch{return null;}
  }
  await writeFile(join(path,'owner.json'),JSON.stringify(owner),{flag:'wx'});
  return async()=>{
    const current=JSON.parse(await readFile(join(path,'owner.json'),'utf8'));
    if(current.token!==owner.token)throw new Error('Job ownership changed');
    // Rename to its own nonempty tombstone; never unlink another owner's lock.
    await rename(path,`${path}.released-${owner.token}`);
  };
}

export function startWorker(config,store,dependencies={}){
  let stopped=false,timer;const tasks=new Set(),agents=new Map();
  async function tick(){
    try{
      for(const snapshot of await store.list('run')){
        if(stopped||tasks.size>=2)break;
        if(!['queued','running'].includes(snapshot.status)||agents.has(snapshot.id))continue;
        if(snapshot.executionPid&&snapshot.executionPid!==process.pid&&alive(snapshot.executionPid))continue;
        const release=await claimRun(store,snapshot.id);if(!release)continue;
        const run=await store.get('run',snapshot.id);
        if(!['queued','running'].includes(run.status)){await release();continue;}
        const agent=createAgent(config,store,dependencies);agents.set(run.id,agent);
        const task=(async()=>{
          try{
            run.workerAttempts=(run.workerAttempts||0)+1;run.executionPid=process.pid;
            if(run.workerAttempts>5){run.status='failed';run.error='Recovery limit reached; saved evidence is preserved.';await store.save('run',run);return;}
            await store.save('run',run);
            const saved=run.outputGuideId&&await store.get('guide',run.outputGuideId);
            if(saved){run.guideId=saved.id;run.status=saved.status==='partial'?'partial':'completed';await store.save('run',run);return;}
            await agent.restart(run);
          }catch(error){console.error('Background job interrupted; saved checkpoints will be retried.');}
          finally{agents.delete(run.id);await release();}
        })();tasks.add(task);task.finally(()=>tasks.delete(task)).catch(()=>{});
      }
    }catch{console.error('Background queue temporarily unavailable; retrying.');}
    finally{if(!stopped){timer=setTimeout(tick,1000);timer.unref();}}
  }
  tick();
  return {async close(){stopped=true;clearTimeout(timer);for(const [id,agent]of agents)agent.cancel(id,Object.assign(new Error('Worker shutdown'),{code:'worker_shutdown'}));await Promise.allSettled([...tasks]);}};
}
