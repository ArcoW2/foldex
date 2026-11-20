'use strict';
// A preview or Info pane's page (preview.html; docs/plans/executed/14-PLAN-floating-panes.md 3.0, 3.5): what its window's page
// sends (`show`): a message; Foldex's own preview (docs/plans/executed/04-PLAN-preview.md 3.1: an image, a GIF moving, a video
// or a sound in the page's own players, a PDF in pdf.js, markdown and HTML rendered, code coloured, CSV as a table, a
// zip's listing, hex, a folder's summary, a file's properties), with the bar above it (3.4); a still of a video or
// sound the player cannot play; or Info's groups of what Windows knows of an item. Windows' own preview, when the file
// has one, is a window the host lays over this page. The libraries are LexPen's (vendor/: markdown-it with its
// plugins and highlight.js in core.js, KaTeX, Mermaid, pdf.js).
// A player that cannot play its file asks the window's page for a still (`still`).

const rows = document.querySelector('.preview-page .rows');
let player = null;   // the video or sound element shown now
let shown = null;    // the own preview shown now (o of own())
let zoom = 1;        // the bar's zoom of the own preview, kept from file to file
let pdfShown = null; // { doc, pages: [{ el, n, done }], observer } of the PDF shown

function message(text) {
  player = null;
  shown = null;
  pdfDone();
  rows.replaceChildren(Object.assign(document.createElement('div'), { className: 'message', textContent: text }));
}

const el = (tag, className, text) => Object.assign(document.createElement(tag), className ? { className } : {}, text != null ? { textContent: text } : {});

function fmtSize(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} bytes`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n, u = -1;
  do { v /= 1024; u++; } while (v >= 1024 && u < units.length - 1);
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`;
}
const fmtDate = ms => ms == null ? '' : shownDate(ms);   // as the date columns (dates.js, the format from the window)

// ---------- The bar above an own preview (3.4) ----------

// What the bar has for a kind: Open in LexPen (when it is installed: o.lexPen) and Copy for text the preview reads, zoom for
// what has a size.
const TEXT_KINDS = new Set(['text', 'code', 'markdown', 'html', 'csv']);
const ZOOM_KINDS = new Set(['text', 'code', 'markdown', 'html', 'csv', 'zip', 'hex', 'pdf', 'image']);

function bar(o) {
  const b = el('div', 'pv-bar');
  const button = (label, title, run) => {
    const x = el('button', 'pv-button', label);
    x.title = title;
    x.addEventListener('click', run);
    b.append(x);
    return x;
  };
  if (TEXT_KINDS.has(o.kind) && o.lexPen) button('Open in LexPen', 'Open this file in LexPen', () => toWindow({ kind: 'openLexPen' }));
  button('Open', 'Open this file with its program, as a double-click does', () => toWindow({ kind: 'openDefault' }));
  if (TEXT_KINDS.has(o.kind)) button('Copy text', 'Copy the text of this file (as far as it is read) to the clipboard', () => toWindow({ kind: 'copy', text: o.text }));
  if (o.cut && TEXT_KINDS.has(o.kind)) button('Show all', `Only the start of this file (${fmtSize(o.size)}) is read; read all of it`, () => toWindow({ kind: 'showAll' }));
  if (o.kind === 'pdf') b.append(el('span', 'pv-page'));
  if (ZOOM_KINDS.has(o.kind)) {
    b.append(el('span', 'pv-gap'));
    button('-', 'Zoom out', () => setZoom(zoom / 1.1));
    const z = button('', 'Zoom: click for 100%', () => setZoom(1));
    z.classList.add('pv-zoom');
    button('+', 'Zoom in', () => setZoom(zoom * 1.1));
  }
  return b;
}

function setZoom(z) {
  zoom = Math.min(5, Math.max(0.25, Math.round(z * 100) / 100));
  const z100 = document.querySelector('.pv-zoom');
  if (z100) z100.textContent = `${Math.round(zoom * 100)}%`;
  const content = document.querySelector('.pv-content');
  if (!content) return;
  if (shown?.kind === 'pdf') return pdfZoom();
  content.style.zoom = shown?.kind === 'image' ? '' : zoom;
  const img = content.querySelector('.own-image');
  // An image: at 100% as large as fits the pane; zoomed, its own size times the zoom, scrolled.
  if (img) {
    img.classList.toggle('pv-zoomed', zoom !== 1);
    img.style.width = zoom === 1 ? '' : `${img.naturalWidth * zoom}px`;
  }
}

// Ctrl+wheel and Ctrl+plus / minus / 0 zoom too.
addEventListener('wheel', e => {
  if (!e.ctrlKey || !shown || !ZOOM_KINDS.has(shown.kind)) return;
  e.preventDefault();
  setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
}, { passive: false });

// ---------- Foldex's own preview ----------

function own(o, remoteImages = true) {
  player = null;
  pdfDone();
  shown = o;
  const kind = o.kind;
  const content = el('div', `pv-content pv-${kind}`);
  const viewer = VIEWERS[kind] ?? (() => el('div', 'message', 'This item cannot be previewed.'));
  const body = viewer(o, content, remoteImages);
  if (body) content.append(body);
  const noBar = kind === 'video' || kind === 'audio';
  rows.replaceChildren(...(noBar ? [] : [bar(o)]), content);
  rows.classList.toggle('pv-with-bar', !noBar);
  setZoom(zoom);
}

const VIEWERS = {
  image(o) {
    const img = el('img', 'own own-image');
    img.src = o.url;
    img.addEventListener('error', () => message('This item cannot be previewed.'));
    img.addEventListener('load', () => setZoom(zoom));
    return img;
  },
  video: o => media(o, 'video'),
  audio: o => media(o, 'audio'),
  text(o) {
    const pre = el('pre', 'own own-text', o.text + (o.cut ? '\n\n[Only the start of the file is shown: Show all reads the rest.]' : ''));
    return pre;
  },
  code(o) {
    const pre = el('pre', 'own own-text own-code');
    // Coloured by highlight.js (LexPen's core.js); a very large text plain, as colouring it would hold the page up.
    if (window.hljs?.getLanguage(o.lang) && o.text.length <= 1024 * 1024)
      pre.innerHTML = hljs.highlight(o.text, { language: o.lang, ignoreIllegals: true }).value;
    else pre.textContent = o.text;
    if (o.cut) pre.append('\n\n[Only the start of the file is shown: Show all reads the rest.]');
    return pre;
  },
  markdown: (o, content, remoteImages) => documentView(o, markdown().render(withFrontMatter(o.text)), remoteImages),
  html: (o, content, remoteImages) => documentView(o, o.text, remoteImages),
  csv: o => csvTable(o),
  zip: o => zipTable(o),
  hex: o => hexView(o),
  pdf: (o, content) => { pdfView(o, content); return null; },
  folder: o => folderSummary(o),
  properties: o => properties(o),
  locked: o => properties(o, `This file cannot be read: ${o.error}`),
  placeholder: o => properties(o, 'This file is in the cloud, not on this PC: previewing it would download it.', true),
};

function media(o, kind) {
  const m = el(kind, `own own-${kind}`);
  m.src = o.url;
  m.addEventListener('error', () => toWindow({ kind: 'still', withPlayer: false }));
  // A video whose sound plays but whose picture the player cannot decode (no error, no width): the still, its
  // player kept under it for the sound.
  if (kind === 'video') m.addEventListener('loadedmetadata', () => { if (!m.videoWidth) toWindow({ kind: 'still', withPlayer: true }); });
  m.controls = true;
  m.preload = 'metadata';
  player = m;
  return m;
}

// ---------- Markdown and HTML (3.3: no scripts, ever; remote images by the setting previewRemoteImages) ----------

let md = null;
// As LexPen's (its app.js): markdown-it with its plugins, highlight.js for fenced code, Mermaid and math marked here and
// drawn once the document is shown.
function markdown() {
  if (md) return md;
  const escape = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  md = markdownit({
    html: true,
    linkify: true,
    highlight(code, lang) {
      if (lang === 'mermaid') return `<pre class="mermaid">${escape(code)}</pre>`;
      if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      return '';
    },
  })
    .use(markdownItAnchor, { slugify: s => s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-') })
    .use(markdownitDeflist)
    .use(markdownitEmoji)
    .use(markdownitFootnote)
    .use(markdownitMark)
    .use(markdownitSub)
    .use(markdownitSup)
    .use(markdownitTaskLists)
    .use(texmath, {
      delimiters: 'dollars',
      engine: { renderToString: (tex, options) => `<span class="tex"${options.displayMode ? ' data-display' : ''}>${escape(tex)}</span>` },
    });
  return md;
}

// YAML front matter shown as a code block instead of a stray <hr> and heading, as LexPen's.
const withFrontMatter = src =>
  src.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/, (_, yaml) => '```yaml\n' + yaml + '\n```\n');

const FILES_URL = 'https://foldex-files.example/file?path=';
// A link or image's address relative to the file's folder: a file on disk at Foldex's own URL (an image shows; the
// host serves only kinds the preview shows). Null for an address that is not a file (a web address, #anchor).
function fileUrl(folder, ref) {
  if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref) && !/^[a-z]:[\\/]/i.test(ref) || ref.startsWith('#') || ref.startsWith('//')) return null;
  let rel = decodeURIComponent(ref.split(/[?#]/)[0]).replace(/\//g, '\\');
  const full = /^[a-z]:\\|^\\\\/i.test(rel) ? rel : `${folder}\\${rel.replace(/^\\+/, '')}`;
  const out = [];
  for (const part of full.split('\\')) {
    if (part === '..') { if (out.length > 1) out.pop(); }
    else if (part !== '.' && (part !== '' || out.length < 2)) out.push(part);
  }
  return FILES_URL + encodeURIComponent(out.join('\\'));
}

const DROP = 'script, iframe, frame, frameset, object, embed, applet, base, meta, link, portal, noscript, template';
const URL_ATTRS = ['src', 'href', 'poster', 'background', 'action', 'formaction', 'xlink:href', 'data'];
const remote = v => /^\s*(https?:)?\/\//i.test(v ?? '') && !String(v).startsWith(FILES_URL);
const CSS_REMOTE = /url\(\s*(['"]?)\s*(https?:)?\/\/[^)]*\)|@import[^;]*;/gi;

// The document made harmless: no scripts (elements, on... attributes, javascript: addresses), no frames, objects or
// links to other pages' styles; images of the file's folder at Foldex's own URL; web images only when remoteImages.
function clean(html, folder, remoteImages) {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  // An HTML file's <head> styles stay (they are its look); the parser put them in head.
  const styles = [...doc.head.querySelectorAll('style')];
  doc.body.prepend(...styles);
  for (const x of doc.body.querySelectorAll(DROP)) x.remove();
  for (const x of doc.body.querySelectorAll('*')) {
    for (const a of [...x.attributes]) {
      const name = a.name.toLowerCase();
      if (name.startsWith('on')) { x.removeAttribute(a.name); continue; }
      if (URL_ATTRS.includes(name) && /^\s*(javascript|vbscript|data:text\/html)/i.test(a.value)) { x.removeAttribute(a.name); continue; }
      if (name === 'style' && !remoteImages) x.setAttribute('style', a.value.replace(CSS_REMOTE, 'none'));
      if (name === 'srcset' && !remoteImages && /(https?:)?\/\//i.test(a.value)) x.removeAttribute(a.name);
    }
    if (x.tagName === 'STYLE' && !remoteImages) x.textContent = x.textContent.replace(CSS_REMOTE, 'none');
    if (x.tagName === 'FORM') x.removeAttribute('action');
    for (const a of ['src', 'poster']) {
      const v = x.getAttribute(a);
      if (v == null) continue;
      const file = fileUrl(folder, v);
      if (file) x.setAttribute(a, file);
      else if (remote(v) && !remoteImages) {
        x.removeAttribute(a);
        x.setAttribute('title', `Not fetched (Settings: Remote images in previews): ${v}`);
        x.classList.add('pv-not-fetched');
      }
    }
  }
  return doc.body;
}

// A rendered document in a shadow root: its own styles (an HTML file's <style>) stay inside it.
function documentView(o, html, remoteImages) {
  const holder = el('div', 'pv-doc-holder');
  const root = holder.attachShadow({ mode: 'open' });
  const css = el('link');
  Object.assign(css, { rel: 'stylesheet', href: 'previewdoc.css' });
  const article = el('article', 'mm-preview');
  article.append(...clean(html, o.folder, remoteImages).childNodes);
  root.append(css, article);
  if (o.cut) article.append(el('p', 'pv-cut', '[Only the start of the file is shown: Show all reads the rest.]'));
  // A link: within the document it scrolls there; any other is not followed here (the preview stays the file's).
  root.addEventListener('click', e => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    if (href.startsWith('#')) root.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
  });
  mathAndDiagrams(root, o);
  return holder;
}

const loaded = {};
function loadScript(src) {
  return loaded[src] ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
}

// Formulas (KaTeX) and diagrams (Mermaid), their scripts loaded the first time, as LexPen's renderMathAndDiagrams.
async function mathAndDiagrams(root, o) {
  const wanted = () => shown === o;
  const formulas = root.querySelectorAll('.tex');
  if (formulas.length) {
    const css = el('link');
    Object.assign(css, { rel: 'stylesheet', href: 'vendor/katex/katex.min.css' });
    root.prepend(css);
    await loadScript('vendor/katex/katex.min.js');
    if (!wanted()) return;
    for (const f of formulas) katex.render(f.textContent, f, { displayMode: f.hasAttribute('data-display'), throwOnError: false });
  }
  const diagrams = root.querySelectorAll('pre.mermaid');
  if (diagrams.length) {
    await loadScript('vendor/mermaid.min.js');
    if (!wanted()) return;
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default' });
    await mermaid.run({ nodes: [...diagrams], suppressErrors: true });
  }
}

// ---------- CSV, zip, hex ----------

const CSV_ROWS = 5000;   // rows drawn at most (the rest: Open in LexPen)

// CSV by RFC 4180 (quotes, doubled quotes, line breaks in quotes); the separator a tab for .tsv, else the one of
// comma, semicolon and bar the first line has most of.
function csvRows(text, tab) {
  const first = text.slice(0, text.indexOf('\n') + 1 || undefined);
  const sep = tab ? '\t' : [',', ';', '|'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const out = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length && out.length <= CSV_ROWS; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); out.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); out.push(row); }
  return out.filter(r => r.length > 1 || r[0] !== '');   // no empty lines (the one after the last line)
}

function table(head, body, note) {
  const box = el('div', 'pv-table-box');
  const t = el('table', 'pv-table');
  const tr = el('tr');
  for (const h of head) tr.append(el('th', null, h));
  t.append(el('thead'), el('tbody'));
  t.tHead.append(tr);
  for (const r of body) {
    const row = el('tr');
    for (const c of r) {
      const td = el('td', null, c instanceof Array ? c[0] : c);
      if (c instanceof Array) td.className = c[1];
      row.append(td);
    }
    t.tBodies[0].append(row);
  }
  box.append(t);
  if (note) box.append(el('div', 'pv-note', note));
  return box;
}

function csvTable(o) {
  const all = csvRows(o.text, o.tab);
  const [head = [], ...body] = all;
  const more = all.length > CSV_ROWS || o.cut;
  return table(head, body.slice(0, CSV_ROWS - 1), more ? 'Only the first rows are shown.' : '');
}

function zipTable(o) {
  const rows = o.entries.map(e => [e.name, [e.name.endsWith('/') ? '' : fmtSize(e.size), 'pv-num'], [e.name.endsWith('/') ? '' : fmtSize(e.packed), 'pv-num'], fmtDate(e.modified)]);
  const more = o.count > o.entries.length ? `Only the first ${o.entries.length} of ${o.count} entries are shown.` : `${o.count} entries.`;
  return table(['Name', 'Size', 'Packed', 'Modified'], rows, more);
}

// Offset, 16 bytes in hex, the same as text (a dot for what is no printable ASCII), as LexPen's hex view.
function hexView(o) {
  const bytes = Uint8Array.from(atob(o.bytes), c => c.charCodeAt(0));
  const lines = [];
  for (let at = 0; at < bytes.length; at += 16) {
    const part = bytes.subarray(at, at + 16);
    const hex = [...part].map(b => b.toString(16).padStart(2, '0')).join(' ').padEnd(47);
    const text = [...part].map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
    lines.push(`${at.toString(16).padStart(8, '0')}  ${hex.slice(0, 23)} ${hex.slice(23)}  ${text}`);
  }
  if (o.cut) lines.push('', `[Only the first ${fmtSize(bytes.length)} of ${fmtSize(o.size)} are shown.]`);
  return el('pre', 'own own-text own-hex', lines.join('\n'));
}

// ---------- PDF (pdf.js, as LexPen's PDF view: its pages drawn as they come into sight) ----------

let pdfjs = null;
async function pdfView(o, content) {
  const box = el('div', 'pv-pdf-pages');
  content.append(box);
  try {
    if (!pdfjs) {
      pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', location.href).href;
    }
    const at = p => new URL(`vendor/pdfjs/${p}/`, location.href).href;
    const task = pdfjs.getDocument({ url: o.url, isEvalSupported: false, disableRange: true, disableStream: true,
      cMapUrl: at('cmaps'), cMapPacked: true, standardFontDataUrl: at('standard_fonts'), wasmUrl: at('wasm'), iccUrl: at('iccs') });
    const doc = await task.promise;
    if (shown !== o) return task.destroy();
    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    const pages = [];
    const observer = new IntersectionObserver(seen => {
      for (const s of seen) if (s.isIntersecting) pdfDraw(pages[+s.target.dataset.n - 1]);
      pdfPageShown();
    }, { root: content, rootMargin: '200px' });
    for (let n = 1; n <= doc.numPages; n++) {
      const page = el('div', 'pv-pdf-page');
      page.dataset.n = n;
      pages.push({ el: page, n, size: first, done: 0 });
      box.append(page);
      observer.observe(page);
    }
    pdfShown = { task, doc, pages, observer, scroller: content };
    content.addEventListener('scroll', pdfPageShown);
    pdfZoom();
  } catch (e) {
    if (shown === o) content.replaceChildren(el('div', 'message', `This PDF cannot be shown: ${e.message ?? e}`));
  }
}

// The pages as wide as the pane at 100% zoom (less its border), their height by their own proportion.
function pdfWidth() { return Math.max(100, (pdfShown?.scroller.clientWidth ?? 0) - 24) * zoom; }
function pdfZoom() {
  if (!pdfShown) return;
  for (const p of pdfShown.pages) {
    p.el.style.width = `${pdfWidth()}px`;
    p.el.style.height = `${pdfWidth() * p.size.height / p.size.width}px`;
    if (p.done && p.done !== pdfWidth()) { p.done = 0; p.el.replaceChildren(); }
  }
  // The pages in sight drawn again at the new size (the observer only tells of a page coming into sight).
  const r = pdfShown.scroller.getBoundingClientRect();
  for (const p of pdfShown.pages) {
    const b = p.el.getBoundingClientRect();
    if (b.bottom > r.top - 200 && b.top < r.bottom + 200) pdfDraw(p);
  }
  pdfPageShown();
}

// A page drawn at the pane's width, with pdf.js's text layer over it (its text, see-through, for the find bar to find
// and light; previewfind.js). Its promise: drawn (the find bar waits for it).
function pdfDraw(p) {
  const pdf = pdfShown;
  if (!pdf || p.done === pdfWidth()) return p.drawing;
  const width = p.done = pdfWidth();
  return (p.drawing = (async () => {
    const page = await pdf.doc.getPage(p.n);
    const plain = page.getViewport({ scale: 1 });
    p.size = plain;
    const viewport = page.getViewport({ scale: width / plain.width * devicePixelRatio });
    const canvas = el('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${width}px`;
    p.el.style.height = `${width * plain.height / plain.width}px`;
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise.catch(() => { });
    const layer = el('div', 'pv-textlayer');
    layer.style.setProperty('--total-scale-factor', String(width / plain.width));
    await new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: layer,
      viewport: page.getViewport({ scale: width / plain.width }) }).render().catch(() => { });
    if (pdfShown === pdf && p.done === width) p.el.replaceChildren(canvas, layer);
  })());
}

// The bar's page: the page a third down the pane, of all.
function pdfPageShown() {
  const label = document.querySelector('.pv-page');
  if (!pdfShown || !label) return;
  const mid = pdfShown.scroller.getBoundingClientRect().top + pdfShown.scroller.clientHeight / 3;
  const at = pdfShown.pages.find(p => p.el.getBoundingClientRect().bottom >= mid) ?? pdfShown.pages.at(-1);
  label.textContent = `Page ${at.n} of ${pdfShown.pages.length}`;
}

function pdfDone() {
  const pdf = pdfShown;
  if (!pdf) return;
  pdfShown = null;
  pdf.observer.disconnect();
  pdf.scroller.removeEventListener('scroll', pdfPageShown);
  pdf.task.destroy();
}

// ---------- A folder's summary; a file's properties ----------

function infoRows(list, pairs) {
  for (const [name, value] of pairs) {
    if (value === '' || value == null) continue;
    const row = el('div', 'info-row');
    row.append(el('span', 'info-name', name), el('span', 'info-value', value));
    list.append(row);
  }
}

function folderSummary(o) {
  const list = el('div', 'info-list');
  list.append(el('div', 'info-group', o.name));
  infoRows(list, [['Folders', String(o.folders)], ['Files', String(o.files)], ['Size of its files', fmtSize(o.size)],
    ['Created', fmtDate(o.created)], ['Modified', fmtDate(o.modified)]]);
  if (!o.all) list.append(el('div', 'pv-note', 'A very large folder: only part of it is counted.'));
  if (o.types.length) {
    list.append(el('hr', 'info-split'), el('div', 'info-group', 'File types'));
    infoRows(list, o.types.map(t => [t.type, `${t.count} (${fmtSize(t.size)})`]));
    if (o.more) list.append(el('div', 'pv-note', 'And other types.'));
  }
  list.append(el('div', 'pv-note', 'Its subfolders are not counted in.'));
  return list;
}

// Properties (3.1, anything else; a locked file with why, a cloud file with Download and preview).
function properties(o, note, download) {
  const list = el('div', 'info-list');
  if (note) list.append(el('div', 'own-note', note));
  if (download) {
    const b = el('button', 'pv-button', 'Download and preview');
    b.addEventListener('click', () => toWindow({ kind: 'download' }));
    list.append(b);
  }
  list.append(el('div', 'info-group', o.name));
  infoRows(list, [['Size', fmtSize(o.size)], ['Created', fmtDate(o.created)], ['Modified', fmtDate(o.modified)],
    ['Accessed', fmtDate(o.accessed)], ['Attributes', o.attributes]]);
  return list;
}

// ---------- A still, Info ----------

// A video or sound the player cannot play: the picture Windows makes of it, said to be a still (with the player kept
// for the sound), else that it cannot be previewed.
function still({ url, withPlayer, media }) {
  const keep = withPlayer ? player : null;
  if (!url && !keep) return message('This item cannot be previewed.');
  shown = null;
  const note = el('div', 'own-note', keep ? 'The picture of this video cannot be played here; a still of it, and its sound.'
    : `This ${media === 'video' ? 'video' : 'sound'} cannot be played here; a still of it.`);
  const img = url ? Object.assign(el('img', 'own own-image'), { src: url }) : null;
  keep?.classList.add('own-sound');
  rows.classList.remove('pv-with-bar');
  rows.replaceChildren(...[note, img, keep].filter(Boolean));
}

// Info: the groups (the image's, the video's and sound's, the other details, the file itself), a line between them.
function info(groups) {
  player = null;
  shown = null;
  pdfDone();
  const list = el('div', 'info-list');
  groups.forEach((g, k) => {
    if (k) list.append(el('hr', 'info-split'));
    list.append(el('div', 'info-group', g.title));
    for (const [name, value] of g.rows) {
      const row = el('div', 'info-row');
      const n = el('span', 'info-name', name);
      n.title = name;
      row.append(n, el('span', 'info-value', typeof value === 'number' ? fmtDate(value) : value));   // a date: as the columns
      list.append(row);
    }
  });
  rows.classList.remove('pv-with-bar');
  rows.replaceChildren(list);
}

// Esc: an F3 preview's window closes (the window's page decides; plan 14 3.5).
addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    toWindow({ kind: 'close' });
  } else if (e.ctrlKey && shown && ZOOM_KINDS.has(shown.kind) && ['+', '=', '-', '0'].includes(e.key)) {
    e.preventDefault();
    setZoom(e.key === '0' ? 1 : zoom * (e.key === '-' ? 1 / 1.1 : 1.1));
  }
});

paneHandlers.show = m => {
  if (m.what !== 'own') rows.classList.remove('pv-with-bar');
  if (m.what === 'own') own(m.own, m.remoteImages !== false);
  else if (m.what === 'still') still(m);
  else if (m.what === 'info') info(m.groups ?? []);
  else message(m.text ?? '');
  pvFindShown(m.what === 'own' ? m.find : null);   // the find bar on what is shown now (previewfind.js)
};
