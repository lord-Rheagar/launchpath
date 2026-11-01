import test from 'node:test';
import assert from 'node:assert/strict';
import { authorityMatches,classifySources,identityIsGrounded,sameProviderHost } from '../lib/identity.mjs';

test('hosted repository authorities are scoped to owners and paths',()=>{
  assert.equal(authorityMatches('https://github.com/basecamp/api?tab=readme','github.com/basecamp'),true);
  assert.equal(authorityMatches('https://github.com/basecamp/api/wiki/auth','https://github.com/basecamp/api'),true);
  for(const [url,scope] of [['https://github.com/other/api','github.com/basecamp'],['https://github.com/basecamp-evil/api','github.com/basecamp'],['https://github.com/other/api','github.com'],['https://evil.com/basecamp','github.com/basecamp']])assert.equal(authorityMatches(url,scope),false);
});

test('www and parent/subdomain identity equivalents pass without accepting unrelated domains',()=>{
  assert.equal(sameProviderHost('https://docs.granola.ai/oauth','https://www.granola.ai/mcp'),true);
  assert.equal(sameProviderHost('https://asana.com','https://www.asana.com'),true);
  assert.equal(sameProviderHost('https://github.com/basecamp','https://other.github.com'),false);
  assert.equal(sameProviderHost('https://asana.com','https://asana.com.evil.com'),false);
});

test('a supplied provider website establishes first-party source scope even with empty model domains',()=>{
  const input={website:'https://www.facebook.com/'},research={identityStatus:'resolved',website:'https://facebook.com/',officialDomains:[]};
  const sources=[{url:'https://developers.facebook.com/docs/oauth'},{url:'https://docs.composio.dev/toolkits/facebook'},{url:'https://facebook.com.evil.com/docs'}];
  classifySources(input,research,sources);assert.deepEqual(sources.map(s=>s.role),['provider','composio','unclassified']);
  assert.equal(identityIsGrounded(input,research,sources),true);
});

test('cross-domain identity moves require retrieved redirect/link evidence',()=>{
  const input={website:'https://example.com/'},research={identityStatus:'resolved',website:'https://other.com/',officialDomains:['other.com']};
  const sources=[{url:'https://other.com/docs',role:'provider'}];
  assert.equal(identityIsGrounded(input,research,sources),false);
  sources.push({requestedUrl:input.website,url:'https://other.com/',role:'provider'});
  assert.equal(identityIsGrounded(input,research,sources),true);
});

test('renamed repositories retain scoped authority through a retrieved same-owner redirect',()=>{
  const sources=[{requestedUrl:'https://github.com/basecamp/bc3-api/blob/master/auth.md',url:'https://github.com/basecamp/bc-api/blob/master/auth.md'},{requestedUrl:'https://github.com/basecamp/bc3-api',url:'https://github.com/unrelated/bc-api'}];
  classifySources({}, {officialDomains:['github.com/basecamp/bc3-api']},sources);
  assert.deepEqual(sources.map(s=>s.role),['provider','unclassified']);
});
