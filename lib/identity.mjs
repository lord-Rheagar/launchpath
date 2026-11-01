import { publicUrl } from './security.mjs';

const host = value => new URL(value).hostname.replace(/^www\./,'');
const containsHost = (a,b) => a===b || a.endsWith(`.${b}`);
const sharedHosts=new Set(['github.com','gitlab.com','bitbucket.org','raw.githubusercontent.com','github.io']);
export function sameProviderHost(a,b) {
  try {const x=host(a),y=host(b);return x===y || !sharedHosts.has(x)&&!sharedHosts.has(y)&&(containsHost(x,y)||containsHost(y,x));}catch{return false;}
}

export function authorityMatches(url,authority) {
  try {
    const scope=publicUrl(authority.includes('://')?authority:`https://${authority}`), target=publicUrl(url);
    const a=scope.hostname.replace(/^www\./,''),b=target.hostname.replace(/^www\./,'');
    if(scope.search || sharedHosts.has(a)&&scope.pathname==='/')return false;
    if(!containsHost(b,a))return false;
    const path=scope.pathname.replace(/\/$/,'');
    return !path || target.pathname===path || target.pathname.startsWith(`${path}/`);
  }catch{return false;}
}

export function classifySources(input,research,sources) {
  const authorities=(research?.officialDomains||[]).filter(a=>typeof a==='string'&&sources.some(s=>authorityMatches(s.url,a)||s.requestedUrl&&authorityMatches(s.requestedUrl,a)));
  if(input.website)authorities.push(new URL(input.website).hostname.replace(/^www\./,''));
  for(const source of sources) {
    const redirectedScope=source.requestedUrl&&sourcesRedirectWithinOwner(source.requestedUrl,source.url)&&authorities.some(a=>authorityMatches(source.requestedUrl,a));
    source.role=authorityMatches(source.url,'composio.dev')?'composio':authorities.some(a=>authorityMatches(source.url,a))||redirectedScope?'provider':'unclassified';
  }
  return authorities;
}

function sourcesRedirectWithinOwner(from,to) {
  try {const a=new URL(from),b=new URL(to);if(a.hostname!==b.hostname)return false;
    return !sharedHosts.has(a.hostname)||a.pathname.split('/')[1]===b.pathname.split('/')[1];
  }catch{return false;}
}

// A checkpoint is evidence metadata, not a substitute for reading documents.
export function identityIsGrounded(input,research,sources) {
  if(research.identityStatus!=='resolved'||!sources.some(s=>s.role==='provider'))return false;
  if(!input.website || !research.website)return true;
  if(sameProviderHost(input.website,research.website))return true;
  // Cross-domain moves need a retrieved redirect or link, not a model assertion.
  return sources.some(s=>s.requestedUrl&&sameProviderHost(s.requestedUrl,input.website)&&
    (sameProviderHost(s.url,research.website)||(s.links||[]).some(l=>sameProviderHost(l.url,research.website))));
}
