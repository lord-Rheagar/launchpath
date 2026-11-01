// One content contract for model output, validation, stored versions, and rendering.
const str = { type: 'string' };
const arr = items => ({ type: 'array', items });
const obj = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const enumeration = values => ({ type: 'string', enum: values });
const statement = obj({ text: str, claimIds: arr(str) });
const duration = obj({ text: str, kind: enumeration(['observed','provider_published','planning_estimate','unknown']), claimIds: arr(str) });

export const reviewSchema = obj({ findings: arr(obj({
  severity: enumeration(['blocking','advisory']), kind:enumeration(['factual_error','unsupported_claim','missing_condition','editorial','suggestion']), message: str, claimIds: arr(str), sourceIds: arr(str),
})) });

export const guideSchema = obj({
  provider: obj({ name: str, website: str, oauthStatus: enumeration(['supported','unsupported','unverified']), appType: str }),
  composio: obj({ toolkitStatus: enumeration(['supported','unsupported','unverified']), managedOAuth: enumeration(['available','unavailable','unverified']), recommendation: statement }),
  summary: obj({ testReadiness: statement, launchReadiness: statement, nextAction: statement }),
  assumptions: arr(str),
  effort: obj({ activeWork: duration, externalWait: duration }),
  prerequisites: arr(obj({ requirement: str, owner: str, claimIds: arr(str) })),
  permissions: arr(obj({ permission: str, purpose: str, consequence: str, claimIds: arr(str) })),
  steps: arr(obj({ id: str, title: str, action: str, destination: str, expectedOutput: str, owner: str, dependsOn: arr(str), claimIds: arr(str), fallback: str })),
  milestones: arr(obj({ name: str, successCondition: str, limits: str, claimIds: arr(str) })),
  blockers: arr(obj({ trigger: str, symptom: str, owner: str, recovery: str, canProceed: str, impact: str, claimIds: arr(str) })),
  handoff: obj({ agent: arr(str), developer: arr(str), administratorOrProvider: arr(str) }),
  claims: arr(obj({ id: str, text: str, status: enumeration(['documented','inferred','unknown','conflicting']),
    evidence: arr(obj({ sourceId: str, quote: str })), assumptions: arr(str) })),
  unknowns: arr(str),
});

// Stored guides retain quotations for rendering and backward compatibility. New
// model output selects immutable passages; it never authors quotation strings.
guideSchema.properties.claims.items.properties.evidence.items.properties.passageId = str;
export const generationSchema = structuredClone(guideSchema);
// This public-documentation agent has no observed OAuth setup timing.
generationSchema.properties.effort.properties.activeWork.properties.kind.enum=['provider_published','planning_estimate','unknown'];
generationSchema.properties.claims.items.properties.evidence = arr(obj({ passageId: str }));
export function sectionSchema(keys,{passageIds=[],claimIds=[],destinations}={}) {
  // Expand shared leaf schema objects before adding per-field enums. A structured
  // clone preserves aliases and would accidentally constrain unrelated strings.
  const schema=JSON.parse(JSON.stringify(obj(Object.fromEntries(keys.map(key => [key, generationSchema.properties[key]])))));
  if(keys.includes('claims')&&passageIds.length) schema.properties.claims.items.properties.evidence.items.properties.passageId.enum=passageIds;
  if(keys.includes('steps')&&destinations) schema.properties.steps.items.properties.destination.enum=['',...destinations];
  // Later sections can select only claims already validated in the facts stage.
  const restrict = node => {
    if(node.properties?.claimIds && claimIds.length && !keys.includes('claims')) node.properties.claimIds.items.enum=claimIds;
    if(node.properties)Object.values(node.properties).forEach(restrict);
    if(node.items)restrict(node.items);
  };
  restrict(schema);return schema;
}

export const researchSchema = obj({
  identityStatus: enumeration(['resolved','needs_input','unresolved']), providerName: str, website: str,
  officialDomains: arr(str), identityBasis: str,
  candidates: arr(obj({name:str,website:str})), coverage: arr(str), unansweredQuestions: arr(str),
});

export function schemaErrors(value, schema = guideSchema, path = '$') {
  const errors = [];
  if (schema.type === 'string') {
    if (typeof value !== 'string') errors.push(`${path} must be a string`);
    else if (value.length > 12000) errors.push(`${path} is too long`);
    else if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.length>12?'the supplied allowed values':schema.enum.join(', ')}`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) errors.push(`${path} must be an array`);
    else if (value.length > 100) errors.push(`${path} has too many items`);
    else value.forEach((v,i) => errors.push(...schemaErrors(v, schema.items, `${path}[${i}]`)));
  } else if (!value || typeof value !== 'object' || Array.isArray(value)) errors.push(`${path} must be an object`);
  else {
    for (const key of schema.required) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties,key)) errors.push(`${path}.${key} is not allowed`);
      else errors.push(...schemaErrors(value[key], schema.properties[key], `${path}.${key}`));
    }
  }
  return errors;
}

export function parseJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned empty JSON content.');
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

// Model repairs are data replacements, never executable code or arbitrary paths.
export function applyGuideReplacements(guide, repair) {
  if (!repair || !Array.isArray(repair.replacements) || repair.replacements.length > 100) throw new Error('Repair must contain at most 100 replacements.');
  const result=structuredClone(guide);
  for(const replacement of repair.replacements) {
    if(typeof replacement.path!=='string'||!replacement.path.startsWith('/'))throw new Error('Invalid repair path.');
    const parts=replacement.path.slice(1).split('/').map(p=>p.replace(/~1/g,'/').replace(/~0/g,'~'));
    if(parts[0]==='guide')parts.shift();
    // These labels are unique in the guide contract. Some model providers omit
    // their containing section when returning a correction pointer.
    if(parts[0]==='recommendation')parts.unshift('composio');
    if(['testReadiness','launchReadiness','nextAction'].includes(parts[0]))parts.unshift('summary');
    if(!parts.length)throw new Error('A repair must identify a guide field.');
    let target=result;
    for(let i=0;i<parts.length;i++) {
      let part=parts[i];
      if(['__proto__','constructor','prototype'].includes(part)||!target||typeof target!=='object')throw new Error(`Invalid repair path: ${replacement.path}`);
      if(Array.isArray(target)&&part==='-'&&i===parts.length-1){target.push(structuredClone(replacement.value));continue;}
      if(Array.isArray(target)&&!/^[0-9]+$/.test(part)) {
        const index=target.findIndex(item=>item&&typeof item==='object'&&item.id===part);
        if(index<0)throw new Error(`Repair path does not identify an existing item: ${replacement.path}`);
        part=String(index);
      }
      if(!Object.hasOwn(target,part)||(Array.isArray(target)&&!/^\d+$/.test(part)))throw new Error(`Repair path does not exist: ${replacement.path}`);
      if(i===parts.length-1)target[part]=structuredClone(replacement.value);else target=target[part];
    }
  }
  return result;
}
