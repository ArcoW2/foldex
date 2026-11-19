'use strict';
// The preview's find bar (docs/plans/20-PLAN-extended-search.md 3.5), after LexPen's (its web/find.js), the find row
// only: a preview is read-only. Ctrl+F opens it (its text selected), Enter / F3 the next match, Shift+Enter / Shift+F3
// the previous one, Esc closes it (a second Esc closes an F3 window, previewpane.js); Aa match case, W whole words,
// .* a regular expression. It searches the text Foldex's own preview shows (text, code, markdown, HTML, CSV, hex, a
// zip's listing, the properties) and a PDF (pdf.js's text of every page; the match lit in the page's text layer). F3 on
// a file of a scrap searched for a text opens it searching that (`find` with the show: the scrap's expression).
// The keys are taken before pane.js passes them to the window (a listener in the capture phase).

const PvFindBlocks = 'p,li,h1,h2,h3,h4,h5,h6,td,th,pre,blockquote,dt,dd,tr,div,section,figcaption,summary';
const PvFindLimit = 100000;   // matches counted and lit (chosen, not measured)
const pvFind = { el: null, input: null, count: null, case: false, word: false, regex: false, given: null, at: null };

function pvFindBar() {
  if (pvFind.el) return pvFind;
  const el = Object.assign(document.createElement('div'), { className: 'pv-find', hidden: true });
  el.innerHTML = '<input class="pv-find-input" type="text" spellcheck="false" title="Enter / F3: next; Shift+Enter / Shift+F3: previous; Esc: close">'
    + '<span class="pv-find-count"></span>'
    + '<button data-find="case" class="pv-find-opt" title="Match case">Aa</button>'
    + '<button data-find="word" class="pv-find-opt" title="Whole word only">W</button>'
    + '<button data-find="regex" class="pv-find-opt" title="Regular expression">.*</button>'
    + '<button data-find="prev" title="Previous (Shift+F3)">&#8593;</button>'
    + '<button data-find="next" title="Next (F3)">&#8595;</button>'
    + '<button data-find="close" title="Close (Esc)">&#10005;</button>';
  document.querySelector('.preview-page').append(el);
  Object.assign(pvFind, { el, input: el.querySelector('.pv-find-input'), count: el.querySelector('.pv-find-count') });
  pvFind.input.addEventListener('input', () => pvFindRun(1, true));
  pvFind.input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    pvFindRun(e.shiftKey ? -1 : 1);
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const what = b.dataset.find;
    if (what === 'close') return pvFindClose();
    if (what === 'next' || what === 'prev') return pvFindRun(what === 'next' ? 1 : -1);
    pvFind[what] = !pvFind[what];
    pvFind.given = null;   // the scrap's expression no longer: the bar's own options
    pvFindOptions();
    pvFindRun(1, true);
  });
  return pvFind;
}

function pvFindOptions() {
  for (const b of pvFind.el.querySelectorAll('.pv-find-opt')) b.classList.toggle('on', pvFind[b.dataset.find]);
}

// What the preview shows can be searched: Foldex's own preview, but not a picture, a video or a sound (nor Windows'
// preview, which is a window over the page: `shown` is then not an own preview).
function pvSearchable() { return !!shown && !['image', 'video', 'audio'].includes(shown.kind); }

function pvFindOpen() {
  if (!pvSearchable()) return toWindow({ kind: 'status', text: 'This preview cannot be searched.', warn: true });
  pvFindBar();
  pvFind.el.hidden = false;
  pvFind.input.focus();
  pvFind.input.select();
  if (pvFind.input.value) pvFindRun(1, true);
}

function pvFindClose() {
  if (!pvFind.el) return;
  pvFind.el.hidden = true;
  pvFind.at = null;
  CSS.highlights.delete('pv-find');
  CSS.highlights.delete('pv-find-cur');
  document.querySelector('.pv-content')?.focus?.();
}

// Something else shown (previewpane.js): with `f` (F3 from a scrap) the bar opens on it; else an open bar searches the
// new content, or closes when it cannot be searched.
function pvFindShown(f) {
  CSS.highlights.delete('pv-find');
  CSS.highlights.delete('pv-find-cur');
  if (f) return pvFindStart(f);
  if (!pvFind.el || pvFind.el.hidden) return;
  if (!pvSearchable()) return pvFindClose();
  pvFindStart({ text: pvFind.input.value, ...(pvFind.given ?? {}), case: pvFind.case, word: pvFind.word, regex: pvFind.regex });
}

// Opened by F3 from a scrap (the window's page): the scrap's text, its expression and options.
function pvFindStart(f) {
  pvFindBar();
  Object.assign(pvFind, { case: !!f.case, word: !!f.word, regex: !!f.regex, given: f.pattern ? f : null, at: null });
  pvFind.input.value = f.text ?? '';
  pvFindOptions();
  pvFind.el.hidden = false;
  pvFind.input.focus();
  pvFind.input.select();
  // A PDF is read by pdf.js after the show: searched once it is there.
  const go = (tries = 0) => {
    if (shown?.kind === 'pdf' && !pdfShown?.doc) return tries < 100 && setTimeout(() => go(tries + 1), 100);
    pvFindRun(1, true);
  };
  go();
}

// The expression of the bar: the scrap's while its text is unchanged, else built from the bar's text and options.
function pvFindRegex() {
  const text = pvFind.input?.value ?? '';
  if (!text) return null;
  const source = pvFind.given && pvFind.given.text === text ? pvFind.given.pattern
    : (body => pvFind.word ? `\\b(?:${body})\\b` : body)(pvFind.regex ? text : text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  try { return new RegExp(source, pvFind.case ? 'gm' : 'gim'); }
  catch { return null; }
}

// The text of the content shown, as one string, and where each text node starts in it; into shadow roots (markdown and
// HTML are drawn in one), a line break between blocks and at a <br> (a PDF's text layer has them).
function pvFindIndex(root) {
  const nodes = [];
  let text = '', lastBlock = null;
  const walk = at => {
    const walker = document.createTreeWalker(at, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeType === 1 && n.matches('script, style, link, .katex-mathml, canvas') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let n; (n = walker.nextNode());) {
      if (n.nodeType === 1) {
        if (n.shadowRoot) walk(n.shadowRoot);
        if (n.tagName === 'BR' && text) text += '\n';
        continue;
      }
      const block = n.parentElement.closest(PvFindBlocks);
      if (text && block !== lastBlock && !text.endsWith('\n')) text += '\n';
      nodes.push({ node: n, start: text.length });
      text += n.data;
      lastBlock = block;
    }
  };
  if (root) walk(root);
  return { text, nodes };
}

function pvMatches(text, regex) {
  const found = [];
  for (const m of text.matchAll(regex)) {
    if (m[0].length) found.push([m.index, m.index + m[0].length]);
    if (found.length >= PvFindLimit) break;
  }
  return found;
}

function pvRange(index, s, e) {
  const at = i => {
    let lo = 0, hi = index.nodes.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (index.nodes[mid].start <= i) lo = mid; else hi = mid - 1; }
    const n = index.nodes[lo];
    return [n.node, Math.max(0, Math.min(i - n.start, n.node.data.length))];
  };
  const range = new Range();
  range.setStart(...at(s));
  range.setEnd(...at(e));
  return range;
}

function pvShowCount(total, current) {
  const n = total >= PvFindLimit ? `${PvFindLimit}+` : total;
  pvFind.count.textContent = !total ? 'No matches' : current == null ? `${n} found` : `${current + 1} of ${n}`;
  pvFind.count.classList.toggle('none', !total);
}

// To the next (dir 1) or previous (-1) match, round past the end; `fresh`: the text or options changed, so from the
// top (the first match).
async function pvFindRun(dir, fresh = false) {
  if (!pvFind.el || pvFind.el.hidden) return pvFindOpen();
  const regex = pvFindRegex();
  CSS.highlights.delete('pv-find');
  CSS.highlights.delete('pv-find-cur');
  if (!regex) {
    pvFind.count.textContent = pvFind.input.value ? 'No regular expression' : '';
    return;
  }
  if (fresh) pvFind.at = null;
  if (shown?.kind === 'pdf') return pvFindPdf(regex, dir);
  const index = pvFindIndex(document.querySelector('.pv-content'));
  const matches = pvMatches(index.text, regex);
  if (!matches.length) return pvShowCount(0);
  const i = pvNext(matches.map(m => m[0]), dir);
  pvFind.at = matches[i][0];
  CSS.highlights.set('pv-find', new Highlight(...matches.map(([s, e]) => pvRange(index, s, e))));
  pvLight(pvRange(index, ...matches[i]));
  pvShowCount(matches.length, i);
}

// The match to go to among their starts: after (or before) the current one, round past the end.
function pvNext(starts, dir) {
  if (pvFind.at == null) return dir > 0 ? 0 : starts.length - 1;
  const i = dir > 0 ? starts.findIndex(s => s > pvFind.at) : starts.findLastIndex(s => s < pvFind.at);
  return i >= 0 ? i : dir > 0 ? 0 : starts.length - 1;
}

function pvLight(range) {
  CSS.highlights.set('pv-find-cur', new Highlight(range));
  const box = range.startContainer.parentElement;
  box?.scrollIntoView({ block: 'center', inline: 'nearest' });
}

// ---------- A PDF: pdf.js's text of every page, the match lit in its page's text layer ----------

async function pvPdfTexts(pdf) {
  if (pdf.texts) return pdf.texts;
  const texts = [];
  for (let n = 1; n <= pdf.doc.numPages; n++) {
    const content = await (await pdf.doc.getPage(n)).getTextContent();
    texts.push(content.items.filter(x => 'str' in x).map(x => x.str + (x.hasEOL ? '\n' : '')).join(''));
  }
  return (pdf.texts = texts);
}

async function pvFindPdf(regex, dir) {
  const pdf = pdfShown;
  if (!pdf?.doc) return;
  const texts = await pvPdfTexts(pdf);
  if (pdfShown !== pdf) return;
  // Every match as [page, its number on that page, a place over all pages to order them].
  const all = [];
  let base = 0;
  texts.forEach((t, p) => {
    pvMatches(t, regex).forEach(([s], k) => all.push([p, k, base + s]));
    base += t.length + 1;
  });
  if (!all.length) return pvShowCount(0);
  const i = pvNext(all.map(m => m[2]), dir);
  pvFind.at = all[i][2];
  pvShowCount(all.length, i);
  const [p, k] = all[i];
  const page = pdf.pages[p];
  page.el.scrollIntoView({ block: 'center' });
  await pdfDraw(page);
  const layer = page.el.querySelector('.pv-textlayer');
  if (!layer || pdfShown !== pdf || pvFind.at !== all[i][2]) return;
  const index = pvFindIndex(layer), here = pvMatches(index.text, regex);
  CSS.highlights.set('pv-find', new Highlight(...here.map(([s, e]) => pvRange(index, s, e))));
  const m = here[Math.min(k, here.length - 1)];
  if (m) pvLight(pvRange(index, ...m));
}

// The keys, before pane.js passes them to the window.
addEventListener('keydown', e => {
  const plain = !e.altKey && !e.metaKey;
  if (plain && e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'f') pvFindOpen();
  else if (plain && !e.ctrlKey && e.key === 'F3') {
    if (pvFind.el && !pvFind.el.hidden && pvFind.input.value) pvFindRun(e.shiftKey ? -1 : 1);
    else pvFindOpen();
  } else if (e.key === 'Escape' && pvFind.el && !pvFind.el.hidden && !document.querySelector('.menu')) pvFindClose();
  else return;
  e.preventDefault();
  e.stopPropagation();
}, true);
