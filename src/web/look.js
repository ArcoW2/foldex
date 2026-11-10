'use strict';
// The look of a page (docs/plans/07-PLAN-themes.md 3.3): light or dark as Windows is (followWindows), else the theme
// setting; then the theme of that mode (themeLight, themeDark) as CSS variables on the root element. A colour the theme
// does not set comes from the mode's block in app.css. Used by the main page and the settings window.

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let lookVars = [];

// `themes`: { id: { name, description, mine, vars } } from the host (ThemeFile.cs).
function applyLook(settings, themes) {
  const dark = settings.followWindows ? darkQuery.matches : settings.theme === 'dark';
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  const theme = themes?.[dark ? settings.themeDark : settings.themeLight] ?? themes?.[dark ? 'dark' : 'light'];
  for (const name of lookVars) root.style.removeProperty(name);
  lookVars = Object.keys(theme?.vars ?? {});
  for (const name of lookVars) root.style.setProperty(name, theme.vars[name]);
  applyFonts(settings);
}

// The fonts (docs/plans/08-PLAN-fonts.md): the window's (appFont, appSize) and the panes' rows (paneFont, paneSize), in
// points (4 to 36). The row height follows the pane font (paneRowHeight).
const DefaultSize = 10;   // pt, as defaults\settings.json; for a value that is not a size (0 in an old settings.json)
const fontStack = name => name ? `"${name.replace(/["\\]/g, '')}", "Segoe UI", system-ui, sans-serif` : '"Segoe UI", system-ui, sans-serif';
// A size as used: 0 (an old settings.json) the default, anything else held between 4 and 36 (a hand-edited 0.5).
const pointSize = pt => pt ? Math.min(36, Math.max(4, pt)) : DefaultSize;
const sizePx = pt => pointSize(pt) * 96 / 72;
const paneRowHeight = settings => Math.max(16, Math.round(sizePx(settings.paneSize) * 22 / 13));

function applyFonts(settings) {
  const root = document.documentElement.style;
  root.setProperty('--app-font', fontStack(settings.appFont));
  root.setProperty('--app-size', `${sizePx(settings.appSize)}px`);
  root.setProperty('--pane-font', fontStack(settings.paneFont));
  root.setProperty('--pane-size', `${sizePx(settings.paneSize)}px`);
  root.setProperty('--row-height', `${paneRowHeight(settings)}px`);
  applyPaneBackgrounds(settings);
}

// The panes' backgrounds (paneBgFocused, paneBgOther), in %: 100 the theme's, toward 0 mixed with black, toward 200
// with white. app.css mixes each pane's own background (--pane-base) with --pane-to by --pane-keep.
const percent = v => Number.isFinite(v) ? Math.min(200, Math.max(0, v)) : 100;

function applyPaneBackgrounds(settings) {
  const root = document.documentElement.style;
  for (const [name, which] of [['paneBgFocused', 'focused'], ['paneBgOther', 'other']]) {
    const p = percent(settings[name]);
    root.setProperty(`--pane-to-${which}`, p < 100 ? 'black' : 'white');
    root.setProperty(`--pane-keep-${which}`, `${p < 100 ? p : 200 - p}%`);
  }
}
