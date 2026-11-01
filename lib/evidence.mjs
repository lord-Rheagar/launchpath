import { publicUrl } from './security.mjs';
import { schemaErrors } from './schema.mjs';
import { extractMarkdownLinks } from './web.mjs';
import { sourcePassages } from './passages.mjs';

// HTML syntax highlighting and Markdown renderers differ in whitespace around
// commas/colons. Preserve every word, number and punctuation mark while ignoring
// these layout-only differences, just as we already ignore line wrapping.
export const normalizeText = text => String(text).normalize('NFKC').replace(/^#{1,6}[ \t]+/gm,'').replace(/\s+/g, ' ').replace(/\s*([,:])\s*/g,'$1').trim().toLowerCase();

function containsQuote(content, quote) {
  const normalized=normalizeText(quote);
  if(normalized.length<20)return false;
  if(normalizeText(content).includes(normalized))return true;
  // Documentation is often saved as Markdown while the model quotes the visible
  // sentence. Remove only HTTP(S) link wrappers from the SOURCE. Keep the quote
  // unchanged so an invented link destination cannot pass by sharing its label.
  const visibleSource=content.replace(/\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)/g,'$1');
  if(normalizeText(visibleSource).includes(normalized))return true;
  const plainSource=visibleSource.replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g,'$2').replace(/`([^`\n]+)`/g,'$1');
  return normalizeText(plainSource).includes(normalized);
}

// Dense scope tables and field/value lists can contain meaningful excerpts shorter
// than 20 characters. Expand only exact existing excerpts with adjacent real text;
// never synthesize a quotation or repair a paraphrase by guessing.
export function expandShortQuotes(guide,sources) {
  const result=structuredClone(guide);let expanded=0;
  if(!Array.isArray(result?.claims))return result;
  for(const claim of result.claims)for(const item of Array.isArray(claim?.evidence)?claim.evidence:[]) {
    if(typeof item?.quote!=='string'||!item.quote.trim()||normalizeText(item.quote).length>=20)continue;
    const content=sources.find(s=>s.id===item.sourceId)?.content;
    if(typeof content!=='string')continue;
    const anchor=item.quote.replace(/^#{1,6}[ \t]+/,'');
    const index=content.indexOf(anchor);if(index<0)continue;
    const begin=Math.max(0,index-160);
    const end=content.indexOf('\n\n',index+anchor.length);
    item.quote=content.slice(begin,end>=0?Math.min(end,index+anchor.length+240):index+anchor.length+240).trim();expanded++;
  }
  return result;
}

// These checks establish reference integrity and quote existence, not factual entailment.
export function auditGuide(guide, sources, input) {
  const errors = schemaErrors(guide);
  if (errors.length) return { errors, warnings: [] };
  const warnings = [];
  const ids = new Set(); const sourceMap = new Map(sources.map(s => [s.id,s]));
  const passages = new Map(sources.flatMap(sourcePassages).map(p=>[p.id,p]));
  for (const claim of guide.claims) {
    if (!/^[a-z][a-z0-9_-]{0,50}$/i.test(claim.id) || ids.has(claim.id)) errors.push(`Duplicate or invalid claim ID: ${claim.id}`);
    ids.add(claim.id);
    if (!claim.text.trim()) errors.push(`Claim ${claim.id} has no text.`);
    if (['documented','conflicting'].includes(claim.status) && !claim.evidence.length) errors.push(`Claim ${claim.id} needs source evidence.`);
    if (claim.status === 'inferred' && !claim.assumptions.length) errors.push(`Inference ${claim.id} needs explicit assumptions.`);
    if(claim.status==='documented'&&claim.evidence.length&&claim.evidence.every(e=>sourceMap.get(e.sourceId)?.role==='composio')&&!/\bcomposio\b/i.test(claim.text))errors.push(`Claim ${claim.id} relies only on Composio evidence and must explicitly limit its statement to Composio; it cannot establish universal provider policy.`);
    for (const item of claim.evidence) {
      const source = sourceMap.get(item.sourceId);
      if (item.passageId) {
        const passage=passages.get(item.passageId);
        if (!passage || passage.sourceId!==item.sourceId || passage.text!==item.quote) errors.push(`Claim ${claim.id} passage does not match its saved source text.`);
      }
      if (!source) errors.push(`Claim ${claim.id} cites an unknown source ${item.sourceId}.`);
      else if (claim.status === 'documented' && !['provider','composio'].includes(source.role)) errors.push(`Claim ${claim.id} needs an established official provider or Composio source, not an unclassified page.`);
      else if (!containsQuote(source.content,item.quote)) errors.push(`Claim ${claim.id} quote is absent from source ${item.sourceId}. Use a verbatim passage of at least 20 characters.`);
    }
  }
  const checkRefs = (item, label) => {
    if (!item.claimIds.length) errors.push(`${label} needs a claim reference (use an explicit unknown/inference when needed).`);
    for (const id of item.claimIds) if (!ids.has(id)) errors.push(`${label} references missing claim ${id}.`);
    const composioOnly=item.claimIds.some(id=>{const c=guide.claims.find(c=>c.id===id);return c?.status==='documented'&&c.evidence.length&&c.evidence.every(e=>sourceMap.get(e.sourceId)?.role==='composio');});
    const text=Object.entries(item).filter(([key])=>key!=='claimIds').map(([,value])=>typeof value==='string'?value:'').join(' ');
    if(composioOnly&&!label.startsWith('composio.')&&!/\bcomposio\b/i.test(text))errors.push(`${label} uses Composio-only evidence and must explicitly scope that guidance to Composio instead of implying universal provider behavior.`);
  };
  Object.entries(guide.summary).forEach(([k,v]) => checkRefs(v, `summary.${k}`));
  checkRefs(guide.composio.recommendation, 'composio.recommendation');
  ['prerequisites','permissions','steps','milestones','blockers'].forEach(key => guide[key].forEach((v,i) => checkRefs(v, `${key}[${i}]`)));
  for (const [key,value] of Object.entries(guide.effort)) {
    checkRefs(value, `effort.${key}`);
    if (value.kind === 'observed') errors.push('Active research has no authenticated timing observations; use planning_estimate, provider_published, or unknown.');
    if (value.kind === 'provider_published' && !value.claimIds.some(id => guide.claims.find(c => c.id === id)?.status === 'documented')) errors.push(`${key} published timing requires a documented claim.`);
  }
  for (const value of [guide.provider.website, ...guide.steps.map(s => s.destination)].filter(Boolean)) {
    try { publicUrl(value); } catch { errors.push('Guide contains a non-public or invalid destination URL.'); }
  }
  const stepIds = new Set(guide.steps.map(s => s.id));
  if (stepIds.size !== guide.steps.length) errors.push('Step IDs must be unique.');
  const visited = new Set();
  for (const step of guide.steps) {
    if (!/^[a-z][a-z0-9_-]{0,50}$/i.test(step.id) || !step.title.trim() || !step.action.trim() || !step.expectedOutput.trim() || !step.owner.trim() || !step.fallback.trim()) errors.push(`Step ${step.id} needs a valid ID, action, expected output, owner, and fallback.`);
    for (const dependency of step.dependsOn) if (!visited.has(dependency)) errors.push(`Step ${step.id} dependency ${dependency} must be a preceding step.`);
    visited.add(step.id);
    const sameDocument = (a,b) => {try{return !!a && !!b && publicUrl(a).href === publicUrl(b).href;}catch{return false;}};
    if (step.destination && !sources.some(s => sameDocument(s.url,step.destination) || sameDocument(s.requestedUrl,step.destination) || [...(s.links||[]),...extractMarkdownLinks(s.content,s.url)].some(l => sameDocument(l.url,step.destination)))) errors.push(`Step ${step.id} destination was not retrieved or discovered in a retrieved page.`);
  }
  if (guide.provider.oauthStatus === 'supported' && !guide.steps.length) errors.push('Supported OAuth requires setup steps.');
  if (!guide.milestones.length) errors.push('Include registration, test, and launch milestones, using explicit unknowns where unresolved.');
  if (guide.composio.toolkitStatus === 'supported' || guide.composio.managedOAuth !== 'unverified') {
    if (!guide.composio.recommendation.claimIds.some(id => guide.claims.find(c => c.id === id)?.evidence.some(e => {
      const source = sourceMap.get(e.sourceId);
      return source && /(^|\.)composio\.dev$/.test(new URL(source.url).hostname);
    }))) errors.push('Composio support assertions require Composio-source evidence.');
  }
  if (input.audience !== 'general' && !input.capability && !guide.unknowns.some(v => /scope|capabilit|permission/i.test(v))) errors.push('Missing capability must remain an explicit scope-dependent unknown.');
  const unknown = guide.claims.filter(c => ['unknown','conflicting'].includes(c.status));
  if (unknown.length && !guide.unknowns.length) errors.push('Unresolved claims must be visible in unknowns.');
  warnings.push('Generated draft. Source passages were checked for existence; human review is still needed to confirm that each passage supports its claim.');
  if (!sources.some(s => s.role === 'provider')) warnings.push('Official provider source ownership has not been established.');
  if (unknown.length) warnings.push(`${unknown.length} claims are unknown or conflicting.`);
  return { errors, warnings };
}

export function safePartial(input, sources, reason) {
  const unknown = { id: 'c1', text: reason, status: 'unknown', evidence: [], assumptions: [] };
  const s = text => ({ text, claimIds: ['c1'] });
  return {
    provider: { name: input.provider, website: input.website || '', oauthStatus: 'unverified', appType: input.appType || 'Not established' },
    composio: { toolkitStatus: 'unverified', managedOAuth: 'unverified', recommendation: s('Check toolkit and managed OAuth availability before registering a custom app.') },
    summary: { testReadiness: s('Not established from the available evidence.'), launchReadiness: s('Launch requirements remain unresolved.'), nextAction: s(input.website ? 'Review the retrieved official sources and resolve the missing requirements below.' : 'Confirm the provider website, then retry research.') },
    assumptions: ['No authenticated registration, consent, or API connection was performed.'],
    effort: { activeWork: { ...s('Not measured.'), kind: 'unknown' }, externalWait: { ...s('Not established.'), kind: 'unknown' } },
    prerequisites: [], permissions: [], steps: [], milestones: [{ name: 'Research follow-up', successCondition: 'Establish the applicable setup, test, and launch paths.', limits: reason, claimIds: ['c1'] }], blockers: [],
    handoff: { agent: ['Research public documentation.'], developer: [input.audience === 'general' ? 'Verify the provider registration and approval requirements in the saved official sources.' : 'Confirm provider identity and required capability.'], administratorOrProvider: ['Decide applicable permissions and approval requests.'] },
    claims: [unknown], unknowns: [reason, ...(input.audience !== 'general' && !input.capability ? ['Required capability and scopes were not specified.'] : []), 'Composio toolkit and managed OAuth availability require verification.'],
  };
}
