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
  applyHeadText(6);
  applyFonts(settings);
}

// Pane themes (docs/plans/executed/13-PLAN-pane-themes.md 3.2, 3.3): per branch place N, from the theme's base colour
// (--branch-N) and the colours it sets itself (--branch-N-bg, ...), the variables app.js drawHeads puts on a pane:
// --branch-N the base colour at its intensity (rings, marks, and the colour the mixes start from); --branch-N-bg,
// -bg-side, -select, -hover the inside; --branch-N-accent the focused row's outline. And --head-mix, 0 to 1, by which
// app.css multiplies each head's and tab's share of the branch colour. No DOM: the tests run it.
// The inside: at mix m each colour takes 1 - (1 - m)^weight of the branch colour, so 0 is the window's colour, 100 the
// branch colour, and in between selection and hover take more of it than the background.
const PaneWeights = { 'bg': 1, 'bg-side': 1, 'select': 5, 'hover': 2 };
const mixed = (colour, p, other) => p <= 0 ? other : p >= 100 ? colour : `color-mix(in srgb, ${colour} ${p}%, ${other})`;
const between = (v, min, max, otherwise) => Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : otherwise;
const tenth = v => Math.round(v * 10) / 10;

function paneThemeVars(settings, themeVars) {
  const intensity = between(settings.paneThemeIntensity, 0, 200, 100);
  const headMix = between(settings.paneHeadMix, 0, 100, 100);
  const mix = between(settings.paneThemeMix, 0, 100, 8);
  const vars = { '--head-mix': String(headMix / 100) };
  for (let n = 0; themeVars[`--branch-${n}`]; n++) {
    const base = themeVars[`--branch-${n}`];
    vars[`--branch-${n}`] = intensity <= 100 ? mixed(base, intensity, 'var(--bg)') : mixed(base, 200 - intensity, 'var(--fg)');
    for (const [name, weight] of Object.entries(PaneWeights)) {
      // A colour the theme sets is the pane theme's own: used as it is, except at 0 (no difference to the window).
      const own = themeVars[`--branch-${n}-${name}`];
      const share = tenth(100 * (1 - (1 - mix / 100) ** weight));
      vars[`--branch-${n}-${name}`] = mix === 0 ? `var(--${name})` : own ?? mixed(`var(--branch-${n})`, share, `var(--${name})`);
    }
    vars[`--branch-${n}-accent`] = mix === 0 ? 'var(--accent)' : `var(--branch-${n})`;
  }
  return vars;
}

// The text on an active head or tab (--branch-N-text): the window's text or background colour, whichever stands out
// more from that head's colour as drawn, so a faint branch colour on a dark theme gets light text, not dark.
function applyHeadText(count) {
  const root = document.documentElement;
  const probe = document.createElement('div');
  probe.style.display = 'none';
  root.appendChild(probe);
  const rgb = css => {
    probe.style.color = '';
    probe.style.color = css;
    const nums = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    // "color(srgb r g b)" in 0..1, "rgb(r, g, b)" in 0..255.
    return getComputedStyle(probe).color.startsWith('color(') ? nums.slice(0, 3) : nums.slice(0, 3).map(v => v / 255);
  };
  const lum = ([r, g, b]) => [r, g, b].map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  const fg = lum(rgb('var(--fg)')), bg = lum(rgb('var(--bg)'));
  for (let n = 0; n < count; n++) {
    const head = lum(rgb(`color-mix(in srgb, var(--branch-${n}) calc(100% * var(--head-mix)), var(--bg-bar))`));
    root.style.setProperty(`--branch-${n}-text`, contrast(head, fg) >= contrast(head, bg) ? 'var(--fg)' : 'var(--bg)');
  }
  probe.remove();
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
