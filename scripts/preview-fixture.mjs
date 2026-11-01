// Browser verification only. Deliberately separate from the production entry point.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createApp } from '../server.mjs';
import { getConfig } from '../lib/config.mjs';
import { fixtureAI, input, source } from '../test/fixtures.mjs';

const dataDir=resolve('test-results/browser-fixture');await mkdir(dataDir,{recursive:true});
const config={...getConfig({}),host:'127.0.0.1',port:3031,dataDir,provider:'test_fixture',model:'TEST FIXTURE — no live model used',apiKey:''};
const app=await createApp(config,{ai:fixtureAI(),fetchPage:async url=>({...source,url})});
const started=await app.agent.start(input);const run=await started.promise;
app.server.listen(3031,'127.0.0.1',()=>console.log(`TEST FIXTURE ONLY: http://127.0.0.1:3031/g/${run.guideId}`));
