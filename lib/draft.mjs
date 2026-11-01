import {schemaErrors} from './schema.mjs';
import {auditGuide} from './evidence.mjs';
import {publicUrl} from './security.mjs';

// Preserve readable writing. Unverified citations become explicit unknowns;
// factual and applicability checks annotate the draft instead of vetoing it.
export function auditDraft(guide,sources,input){
  const errors=schemaErrors(guide);if(errors.length)return {errors,warnings:[]};
  const original=auditGuide(guide,sources,input);
  for(const claim of guide.claims){
    if(original.errors.some(error=>error.startsWith(`Claim ${claim.id} `))){
      claim.status='unknown';claim.evidence=[];
      guide.unknowns.push(`Source support was not validated for claim ${claim.id}: ${claim.text}`);
    }
  }
  const ids=new Set(guide.claims.map(c=>c.id));
  const visit=value=>{if(!value||typeof value!=='object')return;
    if(Array.isArray(value.claimIds))for(const id of value.claimIds)if(!ids.has(id)){guide.claims.push({id,text:'Supporting information was not established.',status:'unknown',evidence:[],assumptions:[]});ids.add(id);}
    for(const child of Object.values(value))visit(child);
  };visit(guide);
  for(const step of guide.steps){
    if(step.destination){try{publicUrl(step.destination);}catch{step.destination='';}}
    step.dependsOn=step.dependsOn.filter(id=>guide.steps.slice(0,guide.steps.indexOf(step)).some(s=>s.id===id));
  }
  if(guide.provider.website){try{publicUrl(guide.provider.website);}catch{guide.provider.website='';}}
  return {errors:[],warnings:[...original.warnings,...original.errors.map(e=>`Draft validation note: ${e}`)]};
}
