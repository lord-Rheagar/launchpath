import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from './config.mjs';

export function isPublicAddress(address) {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(ip) === 4) {
    const [a,b,c] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 2))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  // Only global IPv6 unicast; excludes loopback, mapped IPv4, link-local and ULA.
  return isIP(ip) === 6 && /^[23]/.test(ip) && !ip.startsWith('2001:db8:') && !ip.startsWith('2001:0:') && !ip.startsWith('2002:');
}

export function publicUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new AppError('Enter a complete public http(s) website URL.', 'invalid_url', 400); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port)) || !host.includes('.') && !isIP(host) ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      (isIP(host) && !isPublicAddress(host))) {
    throw new AppError('Only public HTTP(S) websites on standard ports are supported.', 'unsafe_url', 400);
  }
  // Credentials and tokens are not research inputs or safe shared-link destinations.
  if ([...url.searchParams.keys()].some(k => /token|secret|password|api.?key|authorization|code_verifier/i.test(k))) {
    throw new AppError('Remove credentials or token parameters from the URL.', 'unsafe_url', 400);
  }
  url.hash = '';
  return url;
}

export async function resolvePublicUrl(value, resolver = lookup) {
  const url = publicUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await resolver(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
    throw new AppError('This website resolves to a private or reserved network address.', 'unsafe_url', 400);
  }
  return { url, address: addresses[0] };
}

export function normalizeInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('Supply a research request.', 'invalid_input', 400);
  const read = (key, max, fallback = '') => {
    const text = value[key] === undefined ? fallback : value[key];
    if (typeof text !== 'string' || text.length > max) throw new AppError(`${key} must be text of at most ${max} characters.`, 'invalid_input', 400);
    if (/\bsk-(?:or-v1-)?[a-z0-9_-]{15,}|(?:client_secret|access_token|api_key)\s*[:=]\s*\S+/i.test(text)) {
      throw new AppError('Remove secrets from the research request. Configure API keys in .env.', 'secret_input', 400);
    }
    return text.trim();
  };
  const provider = read('provider', 100);
  if (!provider) throw new AppError('Enter an app name.', 'invalid_input', 400);
  const audience = read('audience', 30, 'general');
  if (!['general', 'personal', 'internal', 'external'].includes(audience)) throw new AppError('Choose a valid audience.', 'invalid_input', 400);
  let website = read('website', 2048);
  if (website) website = publicUrl(website).href;
  return { provider, website, audience, capability: read('capability', 500), scopes: read('scopes', 1000), appType: read('appType', 100) };
}

export function redact(text, secrets = []) {
  let result = String(text);
  for (const secret of secrets.filter(Boolean)) result = result.split(secret).join('[redacted]');
  return result.replace(/\bsk-(?:or-v1-)?[a-z0-9_-]{10,}/gi, '[redacted]');
}
