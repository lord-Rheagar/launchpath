import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const arg = (name, fallback) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const label = arg('label', 'browser batch');
const input = JSON.parse(await readFile(resolve(root, 'test-results/oauth-apps-input.json'), 'utf8'));
const logPath = resolve(root, arg('log', 'test-results/launchpath-browser-check.jsonl'));
const logText = await readFile(logPath, 'utf8');
const results = logText.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).filter(Boolean);
const byKey = new Map(results.map(row => [`${row.provider}\n${row.website}`, row]));
if (byKey.size !== input.length) throw new Error(`Expected one distinct result for each of ${input.length} inputs; found ${byKey.size}.`);

const ordered = [];
for (const app of input) {
  const result = byKey.get(`${app.provider}\n${app.website}`);
  if (!result) throw new Error(`Missing result for ${app.provider}.`);
  const guideId = result.guideUrl?.match(/\/g\/([a-f0-9-]{36})$/)?.[1] ?? null;
  let guideStatus = null;
  let steps = 0;
  if (guideId) {
    const guide = JSON.parse(await readFile(resolve(root, `data/guide-${guideId}.json`), 'utf8'));
    guideStatus = guide.status;
    steps = guide.content.steps.length;
    result.guideStatus = guideStatus;
    result.canonicalGuideUrl = `http://127.0.0.1:3000/g/${guideId}`;
  }
  ordered.push({ ...result, guideId, guideStatus, steps, resultType:guideId?(steps?'walkthrough':'evidence_only'):'no_guide' });
}

const counts = { completed: 0, partial: 0, evidenceOnly:0, failed: 0, needsInput: 0, other: 0 };
for (const row of ordered) {
  if(row.guideId && !row.steps)counts.evidenceOnly++;
  else if (row.status === 'report_generated' && row.guideStatus === 'draft') counts.completed++;
  else if (row.status === 'report_generated' && row.guideStatus === 'partial' && row.steps) counts.partial++;
  else if (row.status === 'failed') counts.failed++;
  else if (row.status === 'needs_input') counts.needsInput++;
  else counts.other++;
}

// Preserve the original browser observations; enrichment is a separate artifact.
const enrichedPath = resolve(root, arg('enriched', 'test-results/launchpath-browser-check.enriched.jsonl'));
await writeFile(enrichedPath, `${ordered.map(row => JSON.stringify(row)).join('\n')}\n`, 'utf8');
const lines = [
  '# Launchpath browser workflow check',
  '',
  `Run date: 31 October 2026. Pass: ${label}. Inputs came from Oauth apps.xlsx (49 apps). The browser runner filled and submitted Launchpath’s form, then recorded the on-page run status and progress events.`,
  '',
  `- Full draft walkthroughs: ${counts.completed}`,
  `- Walkthroughs with unresolved questions: ${counts.partial}`,
  `- Evidence-only results (no setup steps): ${counts.evidenceOnly}`,
  `- Failed before a report: ${counts.failed}`,
  `- Needs input: ${counts.needsInput}`,
  `- Other or unclassified: ${counts.other}`,
  '',
  'This summary covers one browser batch pass. The original JSONL preserves run IDs, UI events, and errors; the enriched JSONL adds saved guide status and step counts. A saved guide link alone does not mean a walkthrough was generated. Guide status `draft` means a full generated draft; `completed` is a run status, not a guide status. Report links use port 3000 because the local servers share the same `data` directory.',
  '',
  '| # | App | Outcome | Run | Report | UI message |',
  '|---:|---|---|---|---|---|',
];
for (const [index, row] of ordered.entries()) {
  const outcome = row.status === 'report_generated'
    ? row.resultType==='evidence_only'?'Evidence only — no walkthrough':`Walkthrough (${row.steps} steps; ${row.guideStatus ?? 'status unavailable'})`
    : row.status === 'needs_input' ? 'Needs input' : row.status;
  const report = row.canonicalGuideUrl ? `[Open guide](${row.canonicalGuideUrl})` : '—';
  const message = (row.error ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  lines.push(`| ${index + 1} | ${row.provider} | ${outcome} | ${row.runId ?? '—'} | ${report} | ${message || '—'} |`);
}
const summaryPath = resolve(root, arg('summary', 'test-results/launchpath-browser-check.md'));
await writeFile(summaryPath, `${lines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ inputs: input.length, results: ordered.length, counts, summaryPath, enrichedPath }, null, 2));
