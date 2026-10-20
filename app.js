const editor = document.getElementById('editor');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const saveBtn = document.getElementById('save');

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
  if (editor.value !== savedText) {
    setStatus('Unsaved changes', '');
  } else {
    setStatus('Saved', 'ok');
  }
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

async function save() {
  if (!validate()) return;
  const pretty = JSON.stringify(JSON.parse(editor.value), null, 2) + '\n';
  setStatus('Saving…');
  try {
    const res = await fetch('poppy.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: pretty,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    editor.value = pretty;
    savedText = pretty;
    setStatus('Saved to server ✓', 'ok');
  } catch {
    // Static hosting (e.g. GitHub Pages) can't write back — fall back to a download.
    download();
    setStatus('No writable server here — downloaded poppy.json instead', '');
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

load();
