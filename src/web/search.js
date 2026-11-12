'use strict';
// The search bar (a bar of bars.js) and typing in a pane. A pane's search text filters what it shows: in a list the
// files and folders whose name contains it, in a tree its files (its folders stay, they hold the rest). Each pane has
// its own; the bar shows the active pane's, and a list's goes when the list goes to another folder.
// Typing in a pane fills the bar's text; once typing rests (the setting searchDelay): more than 3 characters become the
// filter and the keyboard goes to the bar; fewer: the pane goes to the first item starting with them, and the text
// clears a second later. In the bar the text is always the filter, each change at once; its X clears it; Esc clears it
// and goes back to the pane, Enter and Down go back to the pane. Ctrl+Shift+F (search.focus) goes to the bar. Without
// a search bar typing only goes to the first item starting with what was typed. Loaded after bars.js, before app.js.

const paneSearch = new Map();   // pane id -> its search text
let typing = null;              // typing in a pane: { id, text, timer }
let typedClear = null;          // the timer that clears a short text after its jump
const SearchFilterFrom = 4;     // characters typed before they filter (more than 3)

const searchDelay = () => Math.min(2000, Math.max(100, Number(settings.searchDelay ?? 600) || 600));

// The pane's search test (app.js uses it with its filter).
function searchTest(id) {
  const text = (paneSearch.get(id) ?? '').toLowerCase();
  return text ? x => x.name.toLowerCase().includes(text) : () => true;
}

const searchBoxes = () => [...document.querySelectorAll('.bar-search input')];

// The pane's search text set (empty: none), and the pane showing what it lets through. `all`: every box shows it, the
// one being typed in too (the pane went to another folder).
function setSearch(id, text, all = false) {
  if (!id) return;
  if ((paneSearch.get(id) ?? '') === text) return;
  if (text) paneSearch.set(id, text);
  else paneSearch.delete(id);
  views.get(id)?.searchChanged?.();
  if (id === activePane) showSearch(text, all);
}

// The bars show the active pane's text (a box being typed in keeps its own, unless `all`).
function showSearch(text = paneSearch.get(activePane) ?? '', all = false) {
  for (const input of searchBoxes()) if (all || document.activeElement !== input) input.value = text;
  for (const box of document.querySelectorAll('.bar-search')) box.classList.toggle('has-text', !!text);
}

// A key in a pane (ListView / TreeView key): a character typed is taken here (true).
function typeInPane(view, e) {
  if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1 || (e.key === ' ' && !typing)) return false;
  e.preventDefault();
  clearTimeout(typedClear);
  if (!typing || typing.id !== view.id) typing = { id: view.id, text: '' };
  clearTimeout(typing.timer);
  typing.text += e.key;
  showSearch(typing.text);
  typing.timer = setTimeout(typingRests, searchDelay());
  return true;
}

function typingRests() {
  const { id, text } = typing;
  typing = null;
  const box = searchBoxes()[0];
  if (box && text.length >= SearchFilterFrom) {
    setSearch(id, text);
    box.value = text;
    box.focus();
    box.setSelectionRange(text.length, text.length);
    return;
  }
  views.get(id)?.goToStart?.(text.toLowerCase());
  typedClear = setTimeout(() => { if (document.activeElement !== box) showSearch(); }, 1000);
}

// The search bar's box, with its X.
function searchBox() {
  const wrap = document.createElement('div');
  wrap.className = 'bar-search-box';
  const input = document.createElement('input');
  input.spellcheck = false;
  input.placeholder = 'Filter (Ctrl+Shift+F)';
  input.title = 'Filters the active pane on what you type';
  input.value = paneSearch.get(activePane) ?? '';
  const clear = document.createElement('button');
  clear.className = 'bar-search-clear';
  clear.textContent = 'X';
  clear.title = 'Clear the filter';
  clear.addEventListener('mousedown', e => e.preventDefault());   // the keyboard stays where it is
  clear.addEventListener('click', () => {
    input.value = '';
    setSearch(activePane, '');
  });
  // Focused it is the filter, as is every change.
  input.addEventListener('focus', () => { clearTimeout(typedClear); setSearch(activePane, input.value); });
  input.addEventListener('input', () => setSearch(activePane, input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      input.value = '';
      setSearch(activePane, '');
    } else if (e.key !== 'Enter' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    views.get(activePane)?.body.focus();
  });
  wrap.append(input, clear);
  return wrap;
}

// Ctrl+Shift+F.
function focusSearch() {
  const box = searchBoxes()[0];
  if (!box) return status('No search bar: add one from a bar\'s menu (Add a bar) or View > Bars.', true);
  box.focus();
  box.select();
}
