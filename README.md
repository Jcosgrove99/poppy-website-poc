# Poppy Website POC

A website whose sole purpose is to expose an editable `poppy.json`.

## What it does

- **Exposes** `poppy.json` at `/poppy.json` for anyone (or anything) to read.
- **Edits** it in the browser: the homepage is a JSON editor for that exact file,
  with live validation, formatting, reload, and download.
- **Saves** it back to disk when run with the included server.

## Run it

No dependencies. Needs Node 18+.

```bash
npm start
# -> http://localhost:3000
# -> http://localhost:3000/poppy.json
```

## API

| Method | Path         | What it does                                  |
| ------ | ------------ | --------------------------------------------- |
| GET    | `/poppy.json` | Returns the current `poppy.json`             |
| PUT    | `/poppy.json` | Replaces it — body must be valid JSON        |
| POST   | `/poppy.json` | Same as PUT                                  |

Example:

```bash
curl http://localhost:3000/poppy.json
curl -X PUT http://localhost:3000/poppy.json \
  -H 'Content-Type: application/json' \
  -d '{"name":"Poppy","blooming":false}'
```

## Static hosting note

The site also works as plain static files (`index.html`, `app.js`, `style.css`,
`poppy.json`) — e.g. on GitHub Pages. There, edits can't write back to the
server, so **Save** falls back to downloading the edited `poppy.json`.

## Files

- `poppy.json` — the file. The whole point.
- `index.html` / `app.js` / `style.css` — the editor page.
- `server.js` — zero-dependency Node server that serves the site and accepts writes.
