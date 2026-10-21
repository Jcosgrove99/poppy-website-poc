#!/usr/bin/env node
// poppy-check.mjs — a minimal Personal Agent Protocol (Poppy) Draft 0.2 checker.
// Usage:
//   node tools/poppy-check.mjs <domain>            e.g. example.com
//   node tools/poppy-check.mjs <full-url-to-poppy.json>
//   node tools/poppy-check.mjs --file poppy.json [--host jcosgrove99.github.io]
//
// Implements the checks a consuming agent performs, per the spec summary in
// ~/workspace/research_notes/personal-agent-protocol-poppy-json-20261020-2331/report.md :
//  §3.1 document shape: protocol_version, organization{name,domain}, at least
//       one of agent/apis/web, auth required if any interface carries sign-in,
//       core scopes are poppy:read/poppy:write (others must be in custom_scopes),
//       apis types are only openapi|mcp, agent protocol type is only poppy,
//       every URL must be HTTPS.
//  §3.2 issuer cross-check: fetch {issuer}/.well-known/oauth-authorization-server,
//       issuer must match character-for-character, poppy_domains must list the
//       document's domain, token_endpoint must be present.
// Exit code 0 = no FAILs (WARNs allowed), 1 = at least one FAIL, 2 = fetch/parse error.

const args = process.argv.slice(2);
let file = null, hostOverride = null, target = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file') file = args[++i];
  else if (args[i] === '--host') hostOverride = args[++i];
  else target = args[i];
}
if (!file && !target) { console.error('usage: poppy-check.mjs <domain|url> | --file <path> [--host <host>]'); process.exit(2); }

const results = [];
const check = (level, name, detail) => results.push({ level, name, detail });

async function getJson(url) {
  const res = await fetch(url, { redirect: 'follow', headers: { accept: 'application/json' } });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, url: res.url, json, text };
}

let doc, servingHost, docUrl = null;
try {
  if (file) {
    const fs = await import('node:fs');
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    servingHost = hostOverride || doc?.organization?.domain || null;
    check('INFO', 'source', `local file ${file}` + (servingHost ? `, host assumed ${servingHost}` : ''));
  } else {
    docUrl = target.startsWith('http') ? target : `https://${target}/.well-known/poppy.json`;
    const r = await getJson(docUrl);
    servingHost = new URL(r.url).host;
    if (r.status === 404) { check('FAIL', 'discovery', `${docUrl} returned 404 — no poppy.json published`); report(); }
    if (r.status !== 200) { check('FAIL', 'discovery', `${docUrl} returned HTTP ${r.status}`); report(); }
    if (!r.json) { check('FAIL', 'discovery', `${docUrl} did not return valid JSON`); report(); }
    check('PASS', 'discovery', `${docUrl} returned 200 JSON`);
    doc = r.json;
  }
} catch (e) { console.error(`fetch/parse error: ${e.message}`); process.exit(2); }

// §3.1 shape
if (doc.protocol_version === '0.2') check('PASS', 'protocol_version', '"0.2" — supported');
else if (!doc.protocol_version) check('FAIL', 'protocol_version', 'missing (required)');
else check('FAIL', 'protocol_version', `"${doc.protocol_version}" — this checker supports Draft 0.2 only; pre-1.0 agents must refuse unsupported versions`);

const org = doc.organization || {};
if (org.name) check('PASS', 'organization.name', `"${org.name}"`);
else check('FAIL', 'organization.name', 'missing (required)');
if (!org.domain) check('FAIL', 'organization.domain', 'missing (required)');
else if (servingHost && org.domain !== servingHost) check('FAIL', 'organization.domain', `"${org.domain}" does not match serving host "${servingHost}"`);
else check('PASS', 'organization.domain', `"${org.domain}" matches serving host`);

const has = k => doc[k] !== undefined;
if (has('agent') || has('apis') || has('web')) check('PASS', 'interfaces', `present: ${['agent','apis','web'].filter(has).join(', ')}`);
else check('FAIL', 'interfaces', 'none of agent / apis / web present — at least one is required');

const urls = [];
const collect = (v, p) => { if (typeof v === 'string' && /^https?:\/\//.test(v)) urls.push([p, v]); else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => collect(x, `${p}.${k}`)); };
['auth','agent','apis','web','feedback','extensions'].filter(has).forEach(k => collect(doc[k], k));
const badUrls = urls.filter(([, u]) => !u.startsWith('https://'));
if (badUrls.length) check('FAIL', 'https-only', `non-HTTPS URL(s): ${badUrls.map(([p, u]) => `${p}=${u}`).join('; ')}`);
else if (urls.length) check('PASS', 'https-only', `all ${urls.length} URL(s) are HTTPS`);

// scopes
const CORE = ['poppy:read', 'poppy:write'];
const custom = Object.keys(doc.auth?.custom_scopes || {});
const scopeSets = [];
if (doc.auth?.direct?.scopes) scopeSets.push(['auth.direct', doc.auth.direct.scopes]);
if (doc.auth?.device?.scopes) scopeSets.push(['auth.device', doc.auth.device.scopes]);
if (doc.auth?.mediated?.scopes) scopeSets.push(['auth.mediated', doc.auth.mediated.scopes]);
for (const [where, scopes] of scopeSets) {
  const unknown = scopes.filter(s => !CORE.includes(s) && !custom.includes(s));
  if (unknown.length) check('FAIL', 'scopes', `${where} uses undeclared scope(s): ${unknown.join(', ')} (declare them in auth.custom_scopes)`);
  else check('PASS', 'scopes', `${where}: [${scopes.join(', ')}] all core or declared custom`);
}

// apis / agent types
if (Array.isArray(doc.apis)) for (const [i, a] of doc.apis.entries())
  check(['openapi','mcp'].includes(a.type) ? 'PASS' : 'FAIL', 'apis', `apis[${i}].type="${a.type}"${['openapi','mcp'].includes(a.type) ? '' : ' — only openapi|mcp are defined'}`);
if (doc.agent?.protocols) for (const [i, p] of doc.agent.protocols.entries())
  check(p.type === 'poppy' ? 'PASS' : 'FAIL', 'agent', `agent.protocols[${i}].type="${p.type}"${p.type === 'poppy' ? '' : ' — only poppy is defined'}`);

// auth conditional requirement: sign-in surface = auth itself, or mediated endpoint present
if (!has('auth') && !has('web')) check('WARN', 'auth', 'no auth block — fine only for a website-only document with no sign-in surface');
else if (!has('auth')) check('PASS', 'auth', 'absent, and no sign-in surface declared — allowed for website-only profile');
else if (!doc.auth.issuer) check('FAIL', 'auth.issuer', 'auth present but issuer missing');
else check('PASS', 'auth.issuer', doc.auth.issuer);

// placeholder detection (not a spec rule — practical warning for this POC)
const placeholders = urls.filter(([, u]) => /(^|\.)example\.com/.test(new URL(u).host));
if (placeholders.length) check('WARN', 'placeholders', `${placeholders.length} URL(s) point at example.com: ${[...new Set(placeholders.map(([,u])=>new URL(u).host))].join(', ')} — placeholder values; a real §3.2 check will fail until replaced`);

// §3.2 issuer cross-check
if (doc.auth?.issuer) {
  const metaUrl = `${doc.auth.issuer.replace(/\/$/, '')}/.well-known/oauth-authorization-server`;
  try {
    const m = await getJson(metaUrl);
    if (m.status !== 200 || !m.json) check('FAIL', 'issuer-metadata', `${metaUrl} returned HTTP ${m.status} — issuer cross-check cannot complete`);
    else {
      if (m.json.issuer === doc.auth.issuer) check('PASS', 'issuer-match', 'metadata issuer matches poppy.json issuer exactly');
      else check('FAIL', 'issuer-match', `metadata issuer "${m.json.issuer}" != poppy.json issuer "${doc.auth.issuer}"`);
      const domains = m.json.poppy_domains || [];
      if (org.domain && domains.includes(org.domain)) check('PASS', 'poppy_domains', `metadata poppy_domains includes "${org.domain}"`);
      else check('FAIL', 'poppy_domains', `metadata poppy_domains ${JSON.stringify(domains)} does not include "${org.domain}"`);
      if (m.json.token_endpoint) check('PASS', 'token_endpoint', m.json.token_endpoint);
      else check('FAIL', 'token_endpoint', 'missing from issuer metadata');
    }
  } catch (e) { check('FAIL', 'issuer-metadata', `${metaUrl} unreachable (${e.cause?.code || e.message}) — issuer cross-check cannot complete`); }
} else {
  check('INFO', 'issuer-metadata', 'no auth.issuer — §3.2 cross-check skipped');
}

report();
function report() {
  for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.name}: ${r.detail}`);
  const fails = results.filter(r => r.level === 'FAIL').length;
  const warns = results.filter(r => r.level === 'WARN').length;
  console.log(`\nResult: ${fails} FAIL, ${warns} WARN, ${results.filter(r => r.level === 'PASS').length} PASS`);
  process.exit(fails ? 1 : 0);
}
