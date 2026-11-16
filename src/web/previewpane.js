'use strict';
// A preview or Info pane's page (preview.html; docs/plans/executed/14-PLAN-floating-panes.md 3.0, 3.5): what its window's page
// sends (`show`): a message; Foldex's own preview (plan 04: an image, a GIF moving, a video or a sound in the page's
// own players, text as text); a still of a video or sound the player cannot play; or Info's groups of what Windows
// knows of an item. Windows' own preview, when the file has one, is a window the host lays over this page.
// A player that cannot play its file asks the window's page for a still (`still`).

const rows = document.querySelector('.preview-page .rows');
let player = null;   // the video or sound element shown now

function message(text) {
  player = null;
  rows.replaceChildren(Object.assign(document.createElement('div'), { className: 'message', textContent: text }));
}

// Foldex's own preview.
function own(o) {
  const kind = o.kind;
  const el = document.createElement(kind === 'image' ? 'img' : kind === 'text' ? 'pre' : kind);
  el.className = `own own-${kind}`;
  player = null;
  if (kind === 'text') el.textContent = o.text + (o.cut ? '\n\n[Only the start of the file is shown.]' : '');
  else {
    el.src = o.url;
    el.addEventListener('error', () => kind === 'image' ? message('This item cannot be previewed.') : toWindow({ kind: 'still', withPlayer: false }));
    // A video whose sound plays but whose picture the player cannot decode (no error, no width): the still, its
    // player kept under it for the sound.
    if (kind === 'video') el.addEventListener('loadedmetadata', () => { if (!el.videoWidth) toWindow({ kind: 'still', withPlayer: true }); });
    if (kind !== 'image') {
      el.controls = true;
      el.preload = 'metadata';
      player = el;
    }
  }
  rows.replaceChildren(el);
}

// A video or sound the player cannot play: the picture Windows makes of it, said to be a still (with the player kept
// for the sound), else that it cannot be previewed.
function still({ url, withPlayer, media }) {
  const keep = withPlayer ? player : null;
  if (!url && !keep) return message('This item cannot be previewed.');
  const note = Object.assign(document.createElement('div'), { className: 'own-note',
    textContent: keep ? 'The picture of this video cannot be played here; a still of it, and its sound.'
      : `This ${media === 'video' ? 'video' : 'sound'} cannot be played here; a still of it.` });
  const img = url ? Object.assign(document.createElement('img'), { className: 'own own-image', src: url }) : null;
  keep?.classList.add('own-sound');
  rows.replaceChildren(...[note, img, keep].filter(Boolean));
}

// Info: the groups (the image's, the video's and sound's, the other details, the file itself), a line between them.
function info(groups) {
  player = null;
  const list = Object.assign(document.createElement('div'), { className: 'info-list' });
  groups.forEach((g, k) => {
    if (k) list.append(Object.assign(document.createElement('hr'), { className: 'info-split' }));
    list.append(Object.assign(document.createElement('div'), { className: 'info-group', textContent: g.title }));
    for (const [name, value] of g.rows) {
      const row = Object.assign(document.createElement('div'), { className: 'info-row' });
      row.append(Object.assign(document.createElement('span'), { className: 'info-name', textContent: name, title: name }),
        Object.assign(document.createElement('span'), { className: 'info-value', textContent: value }));
      list.append(row);
    }
  });
  rows.replaceChildren(list);
}

// Esc: an F3 preview's window closes (the window's page decides; plan 14 3.5).
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  toWindow({ kind: 'close' });
});

paneHandlers.show = m => {
  if (m.what === 'own') own(m.own);
  else if (m.what === 'still') still(m);
  else if (m.what === 'info') info(m.groups ?? []);
  else message(m.text ?? '');
};
