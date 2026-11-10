// The page of a Foldex window. It asks the host ({ op, ... }) and is told ({ event, ... }); see MainForm.cs.
'use strict';

const host = window.chrome.webview;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let settings = {};

function post(msg) {
  host.postMessage(msg);
}

// Light or dark: as Windows is (followWindows), else the theme setting.
function applyTheme() {
  const dark = settings.followWindows ? darkQuery.matches : settings.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function fillList(id, items) {
  const list = document.getElementById(id);
  list.replaceChildren(...items.map(text => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
}

const events = {
  hello(m) {
    settings = m.settings.values;
    applyTheme();
    document.getElementById('version').textContent = `Version ${m.version}` + (m.commit ? ` (${m.commit})` : '');
    fillList('paths', m.paths);
    fillList('problems', m.settings.problems);
  },
  open(m) {
    fillList('paths', m.paths);
  },
};

host.addEventListener('message', e => events[e.data.event]?.(e.data));
darkQuery.addEventListener('change', applyTheme);
post({ op: 'ready' });
