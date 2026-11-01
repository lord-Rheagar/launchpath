import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {Store} from '../lib/store.mjs';
import {claimRun,startWorker} from '../lib/jobs.mjs';
import {fixtureAI} from './fixtures.mjs';
import {getConfig} from '../lib/config.mjs';

async function setup(t){const directory=await mkdtemp(join(tmpdir(),'launchpath-jobs-'));t.after(()=>rm(directory,{recursive:true,force:true}));const store=new Store(directory);await store.init();return store;}
test('a live owner excludes a second worker and releasing allows a new claim',async t=>{
  const store=await setup(t);const release=await claimRun(store,'exclusive');assert.equal(await claimRun(store,'exclusive'),null);await release();assert.ok(await claimRun(store,'exclusive'));
});
test('a real process crash resumes the same run and skips its completed facts stage',async t=>{
  const store=await setup(t),url=path=>pathToFileURL(join(process.cwd(),path)).href;
  const code=`import {Store} from ${JSON.stringify(url('lib/store.mjs'))};import {createAgent} from ${JSON.stringify(url('lib/agent.mjs'))};import {getConfig} from ${JSON.stringify(url('lib/config.mjs'))};import {fixtureAI,input,source} from ${JSON.stringify(url('test/fixtures.mjs'))};const store=new Store(${JSON.stringify(store.directory)});await store.init();const save=store.save.bind(store);store.save=async(kind,value)=>{await save(kind,value);if(value.events?.at(-1)?.message.startsWith('Validated the facts section'))process.exit(23);};const {claimRun}=await import(${JSON.stringify(url('lib/jobs.mjs'))});const agent=createAgent({...getConfig({}),timeoutMs:10000},store,{enqueue:true,ai:fixtureAI(),fetchPage:async url=>({...source,url})});const {run}=await agent.start(input);await claimRun(store,run.id);await agent.restart(run);`;
  const crashed=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:20000});assert.equal(crashed.status,23,crashed.stderr);
  const [prior]=await store.list('run');assert.equal(prior.status,'running');assert.ok(prior.sectionDraft);
  const ai=fixtureAI(),worker=startWorker({...getConfig({}),timeoutMs:10000},store,{ai});t.after(()=>worker.close());
  let resumed;for(let i=0;i<100;i++){resumed=await store.get('run',prior.id);if(resumed.guideId)break;await new Promise(resolve=>setTimeout(resolve,50));}
  await worker.close();
  assert.ok(resumed.guideId);assert.equal(resumed.id,prior.id);assert.equal(ai.writes,3);assert.equal((await store.list('guide')).length,1);
});
