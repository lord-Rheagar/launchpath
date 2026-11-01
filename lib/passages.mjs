import { createHash } from 'node:crypto';

// Slice the saved source, never a rewritten/normalized version. IDs include the
// content hash so stale IDs cannot silently point into a newly fetched page.
export function sourcePassages(source) {
  const content = source.content || '';
  const hash = createHash('sha256').update(content).digest('hex').slice(0,16);
  const passages = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + 900, content.length);
    if (end < content.length) {
      const boundary = content.lastIndexOf('\n', end);
      if (boundary > start + 400) end = boundary + 1;
    }
    // Include adjacent context for short final fragments.
    if (content.length - end < 80) end = content.length;
    const text = content.slice(start,end);
    if (text.trim()) passages.push({id:`${source.id}_${hash}_${start}`,sourceId:source.id,start,end,text});
    start = end;
  }
  return passages;
}

export function passageCatalog(sources) {
  return sources.flatMap(sourcePassages).map((p,index)=>({...p,alias:`p${index+1}`}));
}

export function passageSources(sources) {
  const catalog=passageCatalog(sources);
  return sources.map(source => {const {id,url,requestedUrl,title,role,links,truncated}=source;return {
    id,url,requestedUrl,title,role,links,truncated,
    passages:catalog.filter(p=>p.sourceId===id).map(p=>({id:p.alias,text:p.text})),
  };});
}

export function resolvePassages(value,sources) {
  const result = structuredClone(value);
  const passages = new Map(passageCatalog(sources).flatMap(p=>[[p.id,p],[p.alias,p]]));
  for (const claim of result.claims || []) {
    claim.evidence = claim.evidence.map(item => {
      const passage = passages.get(item.passageId);
      if (!passage) throw new Error(`Claim ${claim.id} references an unknown passage ${item.passageId}.`);
      return {sourceId:passage.sourceId,passageId:passage.id,quote:passage.text};
    });
  }
  return result;
}
