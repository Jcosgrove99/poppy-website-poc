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

Current document (Draft 0.2, §3.1 field table):

```json
{
  "protocol_version": "0.2",
  "organization": {
    "name": "Poppy Website POC",
    "domain": "jcosgrove99.github.io"
  },
  "web": {}
}
```

Why it looks like this:

- `protocol_version` and `organization` are the two always-required fields.
- `organization.domain` MUST be the host that serves the document — here that
  is `jcosgrove99.github.io`.
- At least one of `agent`, `apis`, or `web` must be present. This POC is the
  spec's **website-only** profile ("Progressive adoption"): `web` with no
  `browser_session_endpoint`, so `auth` is not required and Personal Agents
  browse the site as ordinary visitors. Add `auth` (with an `issuer` whose
  RFC 8414 metadata lists this domain in `poppy_domains`), `apis`, `agent`,
  or `feedback` from the editor as real endpoints come online — do not publish
  placeholder endpoints that don't exist; the issuer cross-check in §3.2
  would fail and the declarations would be false.
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
