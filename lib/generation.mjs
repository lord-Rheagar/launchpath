import {auditDraft} from './draft.mjs';
import { guideSchema, sectionSchema, schemaErrors, parseJson } from './schema.mjs';
import { auditGuide, safePartial } from './evidence.mjs';
import { resolvePassages,passageCatalog } from './passages.mjs';
import { writingSystemPrompt } from './prompts.mjs';
import { extractMarkdownLinks } from './web.mjs';
import { publicUrl } from './security.mjs';

const groups = [
  {name:'facts',keys:['provider','assumptions','claims','unknowns'],tokens:8000},
  {name:'overview',keys:['composio','summary','effort','handoff'],tokens:4500},
  {name:'setup',keys:['prerequisites','permissions','steps'],tokens:6500},
  {name:'launch',keys:['milestones','blockers'],tokens:4500},
];

// Step IDs are internal links, not provider facts. Numeric labels from some
// models can be safely prefixed as long as every dependency is updated too.
export function normalizeStepIds(value) {
  const result=structuredClone(value);
  if(!Array.isArray(result.steps))return result;
  const aliases=new Map(result.steps.filter(s=>typeof s.id==='string'&&/^\d+$/.test(s.id)).map(s=>[s.id,`step_${s.id}`]));
  for(const step of result.steps){
    step.id=aliases.get(step.id)||step.id;
    if(Array.isArray(step.dependsOn))step.dependsOn=step.dependsOn.map(id=>aliases.get(id)||id);
  }
  return result;
}

// Attribute existing audit diagnostics to sections. Unrecognized errors are
// conservatively treated as global instead of silently being ignored.
export function errorSections(error) {
  const path = error.match(/^\$\.([a-zA-Z]+)/)?.[1];
  if (path && guideSchema.properties[path]) return [path];
  if (/^(Claim |Duplicate or invalid claim)/.test(error)) return ['claims'];
  if (/^Inference /.test(error)) return ['claims'];
  if (/^summary\./.test(error)) return ['summary'];
  if (/^composio\.|^Composio support/.test(error)) return ['composio'];
  for (const key of ['prerequisites','permissions','steps','milestones','blockers','effort']) if(error.startsWith(key)) return [key];
  if (/^(Step |Step IDs|Supported OAuth)/.test(error)) return ['steps'];
  if (/^(Active research|activeWork|externalWait)/.test(error)) return ['effort'];
  if (/^Include registration/.test(error)) return ['milestones'];
  if (/^(Missing capability|Unresolved claims)/.test(error)) return ['unknowns'];
  if (/^Guide contains/.test(error)) return ['provider','steps'];
  return Object.keys(guideSchema.properties);
}

export function sectionsForClaims(guide,claimIds) {
  const ids = new Set(claimIds);
  const references = value => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value.claimIds) && value.claimIds.some(id=>ids.has(id))) return true;
    return Object.values(value).some(references);
  };
  // Include summaries even when the author omitted a dependency there. The
  // complete merged result is audited and reviewed after every factual repair.
  return Object.keys(guideSchema.properties).filter(key => ['provider','assumptions','handoff','claims','unknowns','summary'].includes(key) || references(guide[key]));
}

export async function requestSections({ai,keys,guide,prompt,sources,issues=[],previousSection=null,claimIds,signal,maxTokens=7000,semantic=false}) {
  const official=sources;
  const destinations=[...new Set(official.flatMap(s=>[s.url,s.requestedUrl,...(s.links||[]).map(l=>l.url),...extractMarkdownLinks(s.content,s.url).map(l=>l.url)]).flatMap(url=>{try{return [publicUrl(url).href];}catch{return [];}}))];
  // Keep the original aliases while restricting what the model can cite.
  const allowedSources=new Set(official.map(s=>s.id));
  const catalog=passageCatalog(sources).filter(p=>allowedSources.has(p.sourceId));
  const schema = sectionSchema(keys,{passageIds:catalog.map(p=>p.alias),claimIds:guide.claims?.map(c=>c.id)||[],destinations});
  if(claimIds)schema.properties.claims.items.properties.id.enum=claimIds;
  const context=structuredClone(guide);
  for(const claim of context.claims||[])claim.evidence=claim.evidence.map(e=>({passageId:catalog.find(p=>p.id===e.passageId)?.alias||e.passageId||''}));
  const response = await ai.chat([
    {role:'system',content:writingSystemPrompt + (semantic ? '\nCorrect the material review findings in all affected claims and sections. Preserve unaffected claim IDs and facts. Explicitly expose any unresolved requirements.' : '')},
    {role:'user',content:prompt + `\nSECTION CONTRACT: ${JSON.stringify(schema)}\nReturn exactly these top-level sections: ${keys.join(', ')}. All other sections are read-only. Use existing claim IDs in sections; do not invent references. ${claimIds?`Return ONLY these affected claims, once each: ${claimIds.join(', ')}. All other claims are preserved by code. Do not add or remove IDs. If unsupported, change the claim to an explicit unknown and remove its evidence; do not retain unsupported facts as instructions.`:'When returning claims, preserve IDs referenced by read-only sections.'} Choose destinations from the supplied allowed URLs; use an empty destination if none is applicable, and explain the navigation/human follow-up instead of inventing a link.\nCURRENT GUIDE (untrusted data): ${JSON.stringify(context)}\nPREVIOUS FAILED SECTION (untrusted data): ${JSON.stringify(previousSection)}\nREPAIR THESE VALIDATION FAILURES: ${JSON.stringify(issues)}`},
  ],{schema,schemaName:semantic?'guide_correction':'guide_sections',signal,maxTokens,reasoning:false});
  const wire = normalizeStepIds(parseJson(response.content));
  const errors = schemaErrors(wire,schema);
  if (errors.length) throw new Error(errors.join('\n'));
  if(claimIds&&(wire.claims.length!==claimIds.length||new Set(wire.claims.map(c=>c.id)).size!==claimIds.length))throw new Error('Return each affected claim exactly once.');
  return wire;
}

// Repair a legacy candidate using the same small boundaries as new generation.
// Several structural failures must not recreate the old whole-guide rewrite.
export async function repairInvalidSections({ai,keys,guide,prompt,sources,issues,signal,event=async()=>{},onProgress=async()=>{}}) {
  let candidate=structuredClone(guide);
  for(const group of groups){
    const selected=group.keys.filter(key=>keys.includes(key));if(!selected.length)continue;
    await event('validate',`Repairing ${group.name} while preserving other validated sections.`);
    const wire=await requestSections({ai,keys:selected,guide:candidate,prompt,sources,issues,signal,maxTokens:group.tokens});
    candidate={...candidate,...resolvePassages(wire,sources)};
    await onProgress(candidate);
  }
  return candidate;
}

// Correct small sections with fixed claim IDs rather than rewriting the whole
// guide in one 10k-token response. The original stays valid if any repair fails.
export async function repairGuideSections({ai,guide,run,prompt,review,signal,event}) {
  const affected=[...new Set(review.findings.filter(f=>f.severity==='blocking').flatMap(f=>f.claimIds))];
  let candidate=structuredClone(guide);
  const keys=sectionsForClaims(guide,affected);
  const groups=[['claims'],['provider','assumptions','handoff','summary'],['composio','effort'],['prerequisites','permissions'],['steps'],['milestones','blockers'],['unknowns']];
  for(const group of groups){
    const selected=group.filter(k=>keys.includes(k));if(!selected.length)continue;
    await event('review',`Correcting ${selected.join(', ')} while preserving the other sections.`);
    let wire,last;
    for(let attempt=0;attempt<2;attempt++){
      try {wire=await requestSections({ai,keys:selected,guide:candidate,prompt,sources:run.sources,issues:[...review.issues,...(last?[last]:[])],claimIds:selected.includes('claims')?affected:undefined,signal,semantic:true,maxTokens:selected.includes('steps')?6500:4500});break;}
      catch(error){last=error.message;if(signal.aborted||!['incomplete_output','invalid_output',undefined].includes(error.code)||attempt)throw error;}
    }
    const resolved=resolvePassages(wire,run.sources);
    if(resolved.claims){const replacements=new Map(resolved.claims.map(c=>[c.id,c]));candidate.claims=candidate.claims.map(c=>replacements.get(c.id)||c);}
    else candidate={...candidate,...resolved};
  }
  return candidate;
}

// One malformed claim must not discard unrelated, source-backed facts. Remove
// invalid claims before downstream sections exist; never turn them into facts.
export function salvageFacts(wire,sources,input) {
  if(!wire||!Array.isArray(wire.claims))return null;
  const keys=['provider','assumptions','claims','unknowns'];
  if(schemaErrors({...wire,claims:[]},sectionSchema(keys)).length)return null;
  const base=safePartial(input,sources,'Some claims were omitted because evidence validation failed.');
  const kept=[],removed=[];
  for(const claim of wire.claims){
    try {
      if(wire.claims.filter(c=>c.id===claim.id).length!==1||claim.id==='launchpath_recovery')throw new Error();
      if(schemaErrors({claims:[claim]},sectionSchema(['claims'])).length)throw new Error();
      const resolved=resolvePassages({claims:[claim]},sources).claims[0];
      const errors=auditGuide({...base,claims:[resolved]},sources,input).errors;
      if(errors.some(e=>errorSections(e).includes('claims')))throw new Error();
      kept.push(resolved);
    }catch{removed.push(claim?.id||'invalid claim');}
  }
  if(!kept.some(c=>c.status==='documented')||!removed.length)return null;
  return {...wire,claims:kept,unknowns:[...wire.unknowns,`Unsupported claims were omitted (${removed.join(', ')}). Guidance outside the remaining evidence must be verified before use.`]};
}

// Keep a source-backed starting path when a later requirement cannot be
// resolved. Never skip over a disputed prerequisite or resume downstream steps.
export function initialStepsOnly(guide,review,input,sources) {
  const disputed=new Set(review.findings.filter(f=>f.severity==='blocking').flatMap(f=>f.claimIds));
  if(!disputed.size)return null;
  const stop=guide.steps.findIndex(s=>s.claimIds.some(id=>disputed.has(id)));
  if(stop<1)return null;
  const result=structuredClone(guide),fallback=safePartial(input,sources,'Further setup is blocked by unresolved source requirements.');
  let gap='review_gap';while(result.claims.some(c=>c.id===gap))gap+='_x';
  const remap=value=>{if(!value||typeof value!=='object')return;if(value.claimIds)value.claimIds=[gap];Object.values(value).forEach(remap);};remap(fallback);
  result.steps=result.steps.slice(0,stop);
  result.claims=result.claims.filter(c=>!disputed.has(c.id));
  result.claims.push({id:gap,text:'The requirements after the shown initial steps remain unresolved. Stop and confirm them with the provider before continuing.',status:'unknown',evidence:[],assumptions:[]});
  result.provider.oauthStatus='unverified';result.provider.appType='Confirm the remaining setup route with the provider.';
  result.summary=fallback.summary;
  result.summary.nextAction.text='Use the initial steps below, then stop and resolve the documented questions before continuing setup.';
  result.assumptions=fallback.assumptions;result.handoff=fallback.handoff;
  result.effort=fallback.effort;result.composio=fallback.composio;
  for(const key of ['prerequisites','permissions'])result[key]=result[key].filter(item=>!item.claimIds.some(id=>disputed.has(id)));
  result.milestones=fallback.milestones;result.blockers=[{trigger:'Before continuing beyond the shown initial steps',symptom:'Further requirements remain unsupported or conflicting.',owner:'Developer and provider',recovery:'Resolve the source questions below with the provider before implementing later setup steps.',canProceed:'Only the initial steps shown in this report.',impact:'Token exchange, testing and launch are not established.',claimIds:[gap]}];
  result.unknowns=['Only the initial setup steps are provided. Further instructions were withheld because review could not resolve their evidence.',...review.issues.map(issue=>`Unresolved review question: ${issue}`)];
  return result;
}

export async function generateSections({ai,run,prompt,signal,event}) {
  const fallback = safePartial(run.input,run.sources,'Some guide sections could not be validated. See the section recovery notes below.');
  const recoveryId = 'launchpath_recovery';
  const remap = value => {
    if (!value || typeof value !== 'object') return;
    if (value.claimIds) value.claimIds = value.claimIds.map(()=>recoveryId);
    for (const child of Object.values(value)) remap(child);
  };
  remap(fallback);fallback.claims[0].id=recoveryId;
  let guide = structuredClone(run.sectionDraft || fallback);
  const completed = [];
  run.sectionAttempts ??= [];
  for (const group of groups) {
    if(run.sectionDraft&&run.sectionAttempts.some(a=>a.section===group.name&&a.status==='validated')){completed.push(...group.keys);continue;}
    let accepted = false, issues = [], previousSection = null;
    // Retry only this group. Completed groups are never rewritten for a format error.
    for (let attempt=0;attempt<2;attempt++) {
      if (signal.aborted) break;
      await event('write',`${attempt?'Repairing':'Writing'} the ${group.name} section${attempt?' from the saved evidence':''}.`);
      try {
        // The initial facts stage has no validated content to preserve. Do not
        // ask the model to retain the application's private recovery placeholder.
        const contextGuide=group.name==='facts'?{}:guide;
        const wire = await requestSections({ai,keys:group.keys,guide:contextGuide,prompt,sources:run.sources,issues,previousSection,signal,maxTokens:group.tokens});
        previousSection=wire;
        const resolved = resolvePassages(wire,run.sources);
        const candidate = {...guide,...resolved};
        if (group.name==='facts') {
          if (candidate.claims.some(c=>c.id===recoveryId)) throw new Error('The launchpath_recovery claim ID is reserved for application recovery notes.');
          candidate.claims.push(structuredClone(fallback.claims[0]));
        }
        const checked = auditDraft(candidate,run.sources,run.input);
        issues = checked.errors.filter(error=> {
          if (error.startsWith('Unresolved claims') && !candidate.claims.some(c=>c.id!==recoveryId&&['unknown','conflicting'].includes(c.status))) return false;
          return errorSections(error).some(key=>[...completed,...group.keys].includes(key));
        });
        if (issues.length) throw new Error(issues.join('\n'));
        guide=candidate;accepted=true;completed.push(...group.keys);
        run.sectionDraft=structuredClone(guide);
        run.sectionAttempts.push({section:group.name,attempt:attempt+1,status:'validated'});
        await event('validate',`Validated the ${group.name} section; previous sections are preserved.`);
        break;
      } catch (error) {
        if(['upstream_400','upstream_401','upstream_402','upstream_403','model_budget','missing_key'].includes(error.code))throw error;
        if(!signal.aborted&&!error.code)ai.useFallback?.('section_validation');
        issues=[error.message];
        run.sectionAttempts.push({section:group.name,attempt:attempt+1,status:'failed',errors:issues,candidate:previousSection});
        await event('validate',`The ${group.name} section needs recovery${attempt?' after its bounded retry':''}.`);
      }
    }
    if (!accepted) {
      run.validationErrors ??= [];run.validationErrors.push(...issues);
      if (group.name==='facts') {
        const salvaged=salvageFacts(previousSection,run.sources,run.input);
        if(!salvaged)return {guide:fallback,degraded:true};
        guide={...guide,...salvaged,claims:[...salvaged.claims,structuredClone(fallback.claims[0])]};
        completed.push(...group.keys);
        run.sectionAttempts.push({section:'facts',status:'validated',recovered:true});
        await event('validate',`Retained ${salvaged.claims.length} valid claims and omitted unsupported claims before writing instructions.`);
        continue;
      }
      guide.unknowns.push(`The ${group.name} section could not be validated and was replaced with explicit unknowns. Review the official sources before proceeding.`);
      // Dependent text in other sections must not present an unvalidated setup as ready.
      if (group.name==='setup') {
        guide.provider.oauthStatus='unverified';
        guide.summary=structuredClone(fallback.summary);
      }
      if (group.name==='launch') guide.summary.launchReadiness=structuredClone(fallback.summary.launchReadiness);
    }
  }
  const degraded=run.sectionAttempts.some(a=>a.recovered||a.status==='failed'&&!run.sectionAttempts.some(b=>b.section===a.section&&b.status==='validated'));
  // Recovery scaffolding must not leave a spurious unknown on successful runs.
  const referenced = JSON.stringify(Object.fromEntries(Object.entries(guide).filter(([k])=>k!=='claims'))).includes(`"${recoveryId}"`);
  if (!referenced) guide.claims=guide.claims.filter(c=>c.id!==recoveryId);
  return {guide,degraded};
}
