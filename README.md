# Poppy Website POC

A website whose sole purpose is to expose an editable `poppy.json` that
follows the **Personal Agent Protocol (Poppy), Draft 0.2** —
[specification](https://personalagentprotocol.org/docs/0.2/spec) §3.

**Live site:** https://jcosgrove99.github.io/poppy-website-poc/
**Live document:** https://jcosgrove99.github.io/poppy-website-poc/.well-known/poppy.json

## The document

Per spec §3, a Company MUST publish `poppy.json` at
`https://{domain}/.well-known/poppy.json`. This POC serves the identical
document at two paths, always kept in sync:

- `/.well-known/poppy.json` — the protocol location
- `/poppy.json` — the original root copy, and the file the editor loads

Current document (Draft 0.2, §3.1 field table) — every part of the schema
is present, with an **example value** in each optional part, modeled on the
spec's own §3 example (except `apis`, which points to a real MCP server):

```json
{
  "protocol_version": "0.2",
  "organization": {
    "name": "Poppy Website POC",
    "domain": "jcosgrove99.github.io"
  },
  "auth": {
    "issuer": "https://poppy-guest-issuer-demo.onrender.com",
    "direct": { "scopes": ["poppy:read", "poppy:write", "addresses"] },
    "device": { "scopes": ["poppy:read", "poppy:write"] },
    "mediated": {
      "endpoint": "https://auth.example.com/poppy/sign-in",
      "fields": [
        { "name": "email", "label": "Email", "secret": false },
        { "name": "password", "label": "Password", "secret": true }
      ],
      "scopes": ["poppy:read"]
    },
    "custom_scopes": { "addresses": "Manage saved shipping addresses" }
  },
  "agent": {
    "protocols": [
      {
        "type": "poppy",
        "endpoint": "https://api.example.com/poppy/conversations",
        "resource": "https://api.example.com"
      }
    ]
  },
  "apis": [
    {
      "type": "mcp",
      "url": "https://mcp.ai-platform.t-mobile.com/nexus-duck-prod/mcp",
      "description": "T-Mobile commerce catalog — search devices, plans, accessories, and promotions",
      "resource": "https://mcp.ai-platform.t-mobile.com/nexus-duck-prod/mcp"
    }
  ],
  "web": {
    "browser_session_endpoint": "https://jcosgrove99.github.io/poppy-website-poc/poppy/browser-session"
  },
  "feedback": { "endpoint": "https://api.example.com/poppy/feedback" },
  "extensions": {
    "operations": {
      "version": "1",
      "endpoint": "https://api.example.com/poppy/operations",
      "resource": "https://api.example.com"
    }
  }
}
```

How to read it:

- `protocol_version` and `organization` are the two always-required fields.
  `organization.domain` MUST be the host that serves the document — here
  that is `jcosgrove99.github.io` — so that block is real, not an example.
- Everything else is an **optional** part of the schema, filled with example
  values: `auth` (required once `agent`, `apis`, `feedback`, or
  `web.browser_session_endpoint` is present) with all three sign-in types
  (`direct`, `device`, `mediated`) and a `custom_scopes` entry; `agent` with
  the `poppy` conversation protocol; `apis` (see the exception below);
  `web.browser_session_endpoint`; `feedback`; and the `operations`
  extension. The optional `resource` field is shown on the `agent`, `apis`,
  and extension entries, as §3.1/§4.3 allow.
- **Exception — `apis` is real, not an example.** The single `apis` entry
  points to Jake's actual T-Mobile commerce-catalog MCP server
  (`nexus-duck-prod`, public/no-auth; tools: search devices, plans,
  accessories, promos), verified live. Its `resource` is the MCP server's
  own URL, as §4.3 describes for MCP entries.
- **Exception — `auth.issuer` is real, too.** The issuer is Jake's demo
  Poppy issuer at `https://poppy-guest-issuer-demo.onrender.com`. Its
  RFC 8414 metadata was verified live (Oct 21, 2026): `issuer` matches
  exactly, `poppy_domains` is `["jcosgrove99.github.io"]`, and it publishes
  `token_endpoint` + `revocation_endpoint` with the jwt-bearer grant and
  `private_key_jwt` (ES256/RS256) — so the §3.2 cross-check **passes**
  (`tools/poppy-check.mjs`: 0 FAIL). Two mismatches to know about: the
  metadata has no `authorization_endpoint` or
  `device_authorization_endpoint`, which §3.2 requires *if* `auth.direct`
  / `auth.device` are declared — as a guest issuer it serves signed-out
  (jwt-bearer) sessions, so those two declarations outrun what it can
  serve until it grows those endpoints (or the declarations are trimmed).
  The `mediated` endpoint below is still an example value.
- **The remaining example endpoints are placeholders, not live services**
  (`auth.mediated.endpoint`, `agent`, `feedback`, `extensions` — the
  `example.com` URLs). Replace them with real endpoints as services come
  online; until then the document is best read as: a verifiable issuer +
  a real API, inside a complete template for the rest.
- Project-site caveat: on a custom domain the well-known file sits at the
  domain root; GitHub *project* Pages serve under `/poppy-website-poc/`, so
  here it is `/{repo}/.well-known/poppy.json` on the same host.

## Saving — changes apply to the entire site

Pressing **Save** persists the edited document, it does not just download it:

- **Running locally** (`npm start`): Save does `PUT /poppy.json` to
  `server.js`, which validates the JSON and writes **both** copies
  (`poppy.json` and `.well-known/poppy.json`) to disk.
- **On the public site** (GitHub Pages, static hosting): there is no server
  to write to, so Save commits the document to this repo through the GitHub
  API — one commit per branch to both `main` and `gh-pages` (Pages publishes
  from `gh-pages`), updating both paths together. Pages then rebuilds,
  usually within about a minute, and everyone sees the new version.

GitHub commits require a write credential, so the public editor asks for a
**fine-grained personal access token**:

1. GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
2. Repository access: only `Jcosgrove99/poppy-website-poc`.
3. Permissions: **Contents — Read and write**.
4. Paste it into the site's "Save for the whole site" panel.

The token is stored only in your browser (session storage, or local storage
if you tick "Remember") and is sent only to `api.github.com`. Visitors
without a write token can edit the text in the page, but cannot change the
live site. **Download** still exists for grabbing a copy without saving.

## Run locally

No dependencies. Needs Node 18+.

```bash
npm start
# -> http://localhost:3000
# -> http://localhost:3000/poppy.json
# -> http://localhost:3000/.well-known/poppy.json
```

## API (local server only)

| Method | Path                      | What it does                             |
| ------ | ------------------------- | ---------------------------------------- |
| GET    | `/poppy.json`             | Returns the current `poppy.json`         |
| GET    | `/.well-known/poppy.json` | Returns the same document                |
| PUT    | either path               | Replaces both copies — valid JSON only   |
| POST   | either path               | Same as PUT                              |

## Files

- `poppy.json`, `.well-known/poppy.json` — the document (identical, synced on save).
- `index.html` / `app.js` / `style.css` — the editor page.
- `server.js` — zero-dependency Node server for local running and saving.
- `.nojekyll` — tells GitHub Pages to serve files (including `.well-known`) as-is.
