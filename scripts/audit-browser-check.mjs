// Read-only audit of browser batch logs and persisted records. No model calls.
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const inputPath=process.argv[2] || 'test-results/launchpath-browser-check.jsonl';
const outputPath=process.argv[3] || 'test-results/browser-check-audit.json';
const rows=(await readFile(resolve(inputPath),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const output=[];
for(const row of rows) {
  if(!/^[a-f0-9-]{36}$/.test(row.runId))throw new Error('Invalid run ID in browser log.');
  const run=JSON.parse(await readFile(`data/run-${row.runId}.json`,'utf8'));
  if(run.guideId&&!/^[a-f0-9-]{36}$/.test(run.guideId))throw new Error('Invalid guide ID.');
  const guide=run.guideId?JSON.parse(await readFile(`data/guide-${run.guideId}.json`,'utf8')):null;
  let cause='walkthrough_with_unknowns';
  if(run.status==='failed'&&!run.sources.length)cause=run.events.some(e=>e.stage==='read')?'documentation_unavailable':'research_completed_without_page_reads';
  else if(run.status==='needs_input')cause='identity_clarification';
  else if(guide&&!guide.content.steps.length&&run.semanticRepair?.errors?.some(e=>/output limit/.test(e)))cause='oversized_factual_repair';
  else if(run.sectionAttempts?.some(a=>a.errors?.some(e=>e.includes('unclassified'))))cause='official_repository_scope_rejected';
  else if(guide&&!guide.content.steps.length)cause=run.research?.identityStatus==='unresolved'?'checkpoint_not_finalized':'official_documentation_not_retrieved_or_classified';
  output.push({app:row.provider,runId:run.id,status:run.status,cause,sources:run.sources.length,steps:guide?.content.steps.length||0,resultType:guide?.content.steps.length?'walkthrough':guide?'evidence_only':'no_guide',error:run.error||null,reviewCompleted:guide?.review.completed||false,guideId:run.guideId});
}
const counts={total:output.length,failed:output.filter(r=>r.status==='failed').length,needsInput:output.filter(r=>r.status==='needs_input').length,walkthrough:output.filter(r=>r.resultType==='walkthrough').length,evidenceOnly:output.filter(r=>r.resultType==='evidence_only').length};
await writeFile(resolve(outputPath),JSON.stringify({counts,runs:output},null,2));
console.log(JSON.stringify(counts,null,2));
