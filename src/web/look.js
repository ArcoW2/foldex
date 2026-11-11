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
  // The base colours from app.css while there is no theme yet, so a pane's variables are always there.
  const themeVars = { ...theme?.vars };
  for (let n = 0; n < 6; n++)
    themeVars[`--branch-${n}`] ??= getComputedStyle(root).getPropertyValue(`--branch-${n}`).trim();
  const vars = { ...themeVars, ...paneThemeVars(settings, themeVars) };
  lookVars = Object.keys(vars);
  for (const name of lookVars) root.style.setProperty(name, vars[name]);
  applyFonts(settings);
}

// Pane themes (docs/plans/executed/13-PLAN-pane-themes.md 3.2, 3.3): per branch place N, from the theme's base colour
// (--branch-N) and the colours it sets itself (--branch-N-bg, ...), the variables app.js drawHeads puts on a pane:
// --branch-N the base colour at its intensity; --branch-N-bg, -bg-side, -select, -hover the inside, set or calculated;
// --branch-N-accent the focused row's outline. No DOM: the tests run it.
const PaneShares = { 'bg': 8, 'bg-side': 8, 'select': 35, 'hover': 14 };   // % of the base colour at mix 0
const mixed = (colour, p, other) => p <= 0 ? other : p >= 100 ? colour : `color-mix(in srgb, ${colour} ${p}%, ${other})`;
const between = (v, min, max, otherwise) => Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : otherwise;

function paneThemeVars(settings, themeVars) {
  const follow = settings.paneThemeFollowsBranch !== false;
  const mix = between(settings.paneThemeMix, -100, 100, 0);
  const intensity = between(settings.paneThemeIntensity, 0, 200, 100);
  // Mix -100 the window's colour, 0 the share as tuned, +100 halfway from it to the base colour.
  const share = s => Math.round((mix < 0 ? s * (100 + mix) / 100 : s + (100 - s) * mix / 200) * 10) / 10;
  const vars = {};
  for (let n = 0; themeVars[`--branch-${n}`]; n++) {
    const base = themeVars[`--branch-${n}`];
    vars[`--branch-${n}`] = intensity <= 100 ? mixed(base, intensity, 'var(--bg)') : mixed(base, 200 - intensity, 'var(--fg)');
    for (const name of Object.keys(PaneShares)) {
      const own = themeVars[`--branch-${n}-${name}`];
      vars[`--branch-${n}-${name}`] = !follow ? `var(--${name})` : own ?? mixed(base, share(PaneShares[name]), `var(--${name})`);
    }
    vars[`--branch-${n}-accent`] = follow ? `var(--branch-${n})` : 'var(--accent)';
  }
  return vars;
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

// The panes' backgrounds (paneBgFocused, paneBgBranch, paneBgOther), in %: 100 the theme's, toward 0 mixed with black, toward 200
// with white. app.css mixes each pane's own background (--pane-base) with --pane-to by --pane-keep.
const percent = v => Number.isFinite(v) ? Math.min(200, Math.max(0, v)) : 100;

function applyPaneBackgrounds(settings) {
  const root = document.documentElement.style;
  for (const [name, which] of [['paneBgFocused', 'focused'], ['paneBgBranch', 'branch'], ['paneBgOther', 'other']]) {
    const p = percent(settings[name]);
    root.setProperty(`--pane-to-${which}`, p < 100 ? 'black' : 'white');
    root.setProperty(`--pane-keep-${which}`, `${p < 100 ? p : 200 - p}%`);
  }
}
