const editor = document.getElementById('editor');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const saveBtn = document.getElementById('save');
const panel = document.getElementById('githubPanel');
const tokenInput = document.getElementById('tokenInput');
const rememberToken = document.getElementById('rememberToken');
const tokenState = document.getElementById('tokenState');

// The live site is this GitHub repo, published by GitHub Pages from gh-pages.
// Saving "for the whole site" = committing the same document to both branches,
// at both the root path and the protocol's well-known path.
const GH = {
  owner: 'Jcosgrove99',
  repo: 'poppy-website-poc',
  branches: ['main', 'gh-pages'],
  paths: ['poppy.json', '.well-known/poppy.json'],
  api: 'https://api.github.com',
};
const TOKEN_KEY = 'poppy_gh_token';

let savedText = '';

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = 'status ' + kind;
}

function validate() {
  try {
    JSON.parse(editor.value);
    errorEl.textContent = '';
    saveBtn.disabled = false;
    return true;
  } catch (err) {
    errorEl.textContent = 'Invalid JSON: ' + err.message;
    saveBtn.disabled = true;
    return false;
  }
}

function markDirty() {
  if (editor.value !== savedText) setStatus('Unsaved changes');
  else setStatus('Saved', 'ok');
  validate();
}

async function load() {
  setStatus('Loading…');
  try {
    const res = await fetch('poppy.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    editor.value = await res.text();
    savedText = editor.value;
    setStatus('Loaded poppy.json', 'ok');
    validate();
  } catch (err) {
    setStatus('Could not load poppy.json', 'bad');
    errorEl.textContent = String(err);
  }
}

function download() {
  const blob = new Blob([editor.value], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'poppy.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- token handling (browser only, sent only to api.github.com) ----------
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
}
function storeToken(token, remember) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}
function refreshTokenState() {
  const has = !!getToken();
  tokenState.textContent = has
    ? 'A GitHub token is connected in this browser — Save commits to the repo.'
    : 'No token connected in this browser yet.';
  if (has) tokenInput.value = '';
}

// ---------- save path 1: local dev server (server.js) ----------
async function saveToServer(pretty) {
  const res = await fetch('poppy.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: pretty,
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return !!(data && data.ok);
}

// ---------- save path 2: commit to GitHub (public site) ----------
async function ghFetch(token, path, options = {}) {
  const res = await fetch(GH.api + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try {
      const body = await res.json();
      if (body.message) msg += ' — ' + body.message;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

async function commitToBranch(token, branch, pretty) {
  const base = `/repos/${GH.owner}/${GH.repo}`;
  const ref = await ghFetch(token, `${base}/git/ref/heads/${branch}`);
  const headSha = ref.object.sha;
  const headCommit = await ghFetch(token, `${base}/git/commits/${headSha}`);
  const tree = await ghFetch(token, `${base}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: headCommit.tree.sha,
      tree: GH.paths.map((p) => ({ path: p, mode: '100644', type: 'blob', content: pretty })),
    }),
  });
  const commit = await ghFetch(token, `${base}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: 'Update poppy.json via web editor',
      tree: tree.sha,
      parents: [headSha],
    }),
  });
  await ghFetch(token, `${base}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
  return commit.sha;
}

async function saveToGitHub(pretty) {
  const token = getToken();
  if (!token) {
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setStatus('To save for the whole site, connect a GitHub token below', '');
    return false;
  }
  for (const branch of GH.branches) {
    setStatus(`Committing to ${branch}…`);
    await commitToBranch(token, branch, pretty);
  }
  return true;
}

// ---------- save ----------
async function save() {
  if (!validate()) return;
  const pretty = JSON.stringify(JSON.parse(editor.value), null, 2) + '\n';
  setStatus('Saving…');
  saveBtn.disabled = true;
  try {
    if (await saveToServer(pretty)) {
      editor.value = pretty;
      savedText = pretty;
      setStatus('Saved ✓ — the whole local site now serves this poppy.json', 'ok');
      return;
    }
  } catch { /* not running under server.js — fall through to GitHub save */ }
  try {
    if (await saveToGitHub(pretty)) {
      editor.value = pretty;
      savedText = pretty;
      setStatus('Saved to GitHub ✓ — Pages rebuilds in ~1 min, then everyone sees this version', 'ok');
    }
  } catch (err) {
    panel.hidden = false;
    setStatus('GitHub save failed', 'bad');
    errorEl.textContent =
      'GitHub said: ' + err.message +
      '. Check the token has Contents: Read and write on ' + GH.owner + '/' + GH.repo + '.';
  } finally {
    saveBtn.disabled = false;
    validate();
  }
}

editor.addEventListener('input', markDirty);
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    editor.setRangeText('  ', editor.selectionStart, editor.selectionEnd, 'end');
    markDirty();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    save();
  }
});

document.getElementById('format').addEventListener('click', () => {
  if (!validate()) return;
  editor.value = JSON.stringify(JSON.parse(editor.value), null, 2) + '\n';
  markDirty();
});
document.getElementById('reload').addEventListener('click', load);
document.getElementById('download').addEventListener('click', download);
saveBtn.addEventListener('click', save);
document.getElementById('connectToken').addEventListener('click', () => {
  const token = tokenInput.value.trim();
  if (token) storeToken(token, rememberToken.checked);
  refreshTokenState();
  if (getToken()) save();
});
document.getElementById('clearToken').addEventListener('click', () => {
  storeToken('', false);
  refreshTokenState();
  setStatus('Token forgotten in this browser', '');
});

refreshTokenState();
load();
