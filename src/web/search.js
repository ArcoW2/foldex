'use strict';
// The search bar (a bar of bars.js) and typing in a pane. A pane's search text filters what it shows: in a list the
// files and folders whose name contains it, in a tree its files (its folders stay, they hold the rest). Each pane has
// its own, kept until the text changes (emptied too); the bar shows the active pane's.
// Typing in a pane is a go-to: each key at once takes the pane to the first item starting with what was typed, and the
// bar shows the text. Once typing rests (the setting searchDelay) with more than 3 characters, the text becomes the
// filter and the keyboard goes to the bar; with fewer the text clears a second after the last key. In the bar the text
// is always the filter, each change at once; its X clears it; Esc clears it and goes back to the pane, Enter and Down
// go back to the pane. Ctrl+Shift+F (search.focus) goes to the bar. Without a search bar typing is only the go-to.
// Loaded after bars.js, before app.js.

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

// The pane's search text set (empty: none), and the pane showing what it lets through.
function setSearch(id, text) {
  if (!id) return;
  if ((paneSearch.get(id) ?? '') === text) return;
  if (text) paneSearch.set(id, text);
  else paneSearch.delete(id);
  views.get(id)?.searchChanged?.();
  if (id === activePane) showSearch(text);
}

// The bars show the active pane's text (a box being typed in keeps its own).
function showSearch(text = paneSearch.get(activePane) ?? '') {
  for (const input of searchBoxes()) if (document.activeElement !== input) input.value = text;
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
  view.goToStart?.(typing.text.toLowerCase());
  typing.timer = setTimeout(typingRests, searchDelay());
  // A short text clears a second after the last key; a longer one becomes the filter when typing rests.
  typedClear = setTimeout(() => {
    if (typing?.text.length >= SearchFilterFrom) return;
    typing = null;
    showSearch();
  }, 1000);
  return true;
}

function typingRests() {
  if (!typing) return;
  const { id, text } = typing;
  const box = searchBoxes()[0];
  if (text.length < SearchFilterFrom) return;   // the go-to was all; the text clears (typedClear)
  typing = null;
  if (!box) return;
  clearTimeout(typedClear);
  setSearch(id, text);
  box.value = text;
  box.focus();
  box.setSelectionRange(text.length, text.length);
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
