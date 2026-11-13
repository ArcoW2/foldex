'use strict';
// The look of a page (docs/plans/executed/07-PLAN-themes.md 3.3): light or dark as Windows is (followWindows), else the theme
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
  applyHighlights(settings);
  applyHeadText(6);
  // The tree lines (docs/plans/16-PLAN-tree-look.md 3.1): app.css draws them solid or dotted, or not at all.
  root.dataset.treeLines = ['solid', 'dotted', 'none'].includes(settings.treeLines) ? settings.treeLines : 'dotted';
  // The scrollbars (app.css): the vertical one's width and the horizontal one's height.
  const barSize = (v, fallback) => `${Math.min(30, Math.max(4, Number(v) || fallback))}px`;
  root.style.setProperty('--scrollbar-w', barSize(settings.scrollbarWidth, 12));
  root.style.setProperty('--scrollbar-h', barSize(settings.scrollbarHeight, 12));
  root.dataset.scrollbars = settings.scrollbarsSlim === false ? 'full' : 'slim';
  root.style.setProperty('--tree-line-mix', `${Math.min(100, Math.max(1, Number(settings.treeLinesIntensity) || 55))}%`);
  // Rows with stripes or lines (plan 11 3.5): the text colour mixed in at rowLinesIntensity %.
  root.dataset.rowLines = ['stripes', 'lines'].includes(settings.rowLines) ? settings.rowLines : 'none';
  root.style.setProperty('--row-line-mix', `${Math.min(100, Math.max(1, Number(settings.rowLinesIntensity) || 8))}%`);
  applyFonts(settings);
}

// The look for Foldex's own windows (AskForm.cs, as LexPen's): the window's colours as RGB (worked out by drawing
// them, so a color-mix() comes out as the colour it is), dark or light, and the window font.
function hostLook() {
  const root = document.documentElement, style = getComputedStyle(root);
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const colours = {};
  for (const name of ['--bg', '--fg', '--bg-bar', '--border', '--accent']) {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = style.getPropertyValue(name).trim() || '#000';
    ctx.fillRect(0, 0, 1, 1);
    colours[name] = [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }
  const body = getComputedStyle(document.body);
  return { colours, dark: root.dataset.theme === 'dark', font: body.fontFamily, size: parseFloat(body.fontSize) };
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
  // A colour as drawn: one with transparency (a theme's hover) laid over the background first.
  const rgb = (css, under = null) => {
    probe.style.color = '';
    probe.style.color = css;
    const text = getComputedStyle(probe).color;
    const nums = text.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
    // "color(srgb r g b / a)" in 0..1, "rgb(r, g, b)" and "rgba(r, g, b, a)" in 0..255.
    const colour = text.startsWith('color(') ? nums.slice(0, 3) : nums.slice(0, 3).map(v => v / 255);
    const alpha = nums.length > 3 ? nums[3] : 1;
    if (alpha >= 1) return colour;
    const base = under ?? rgb('var(--bg)');
    return colour.map((c, i) => c * alpha + base[i] * (1 - alpha));
  };
  const lum = ([r, g, b]) => [r, g, b].map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  const fg = lum(rgb('var(--fg)')), bg = lum(rgb('var(--bg)'));
  const text = colour => contrast(colour, fg) >= contrast(colour, bg) ? 'var(--fg)' : 'var(--bg)';
  for (let n = 0; n < count; n++) {
    const head = lum(rgb(`color-mix(in srgb, var(--branch-${n}) calc(100% * var(--head-mix)), var(--bg-bar))`));
    root.style.setProperty(`--branch-${n}-text`, text(head));
    // The highlights as app.css draws them in a pane of this branch (applyHighlights): the text keeps its colour until
    // it no longer stands out (below HighlightContrast), then the background colour where that stands out more.
    for (const kind of Object.keys(Highlights)) {
      const colour = Highlights[kind][3];
      const drawn = lum(rgb(`color-mix(in srgb, var(--branch-${n}-accent) var(--${kind}-up), color-mix(in srgb, var(--branch-${n}-${colour}) var(--${kind}-keep), var(--branch-${n}-bg)))`,
        rgb(`var(--branch-${n}-bg)`)));
      const turn = contrast(drawn, fg) < HighlightContrast && contrast(drawn, bg) > contrast(drawn, fg);
      root.style.setProperty(`--branch-${n}-text-${kind}`, turn ? 'var(--bg)' : 'var(--fg)');
    }
  }
  probe.remove();
}

// The highlights in the panes (focusIntensity, selectIntensity, hoverIntensity), 0 to 200 %: 100 the theme's colour
// (the focused item the selection colour with a little of the accent, the other selected items fainter, hover the
// hover colour), lower toward the pane's background, higher toward the accent colour. app.css mixes them: the accent by
// --X-up into the colour by --X-keep into the pane's background. Where a highlight gets so strong that the text no
// longer stands out from it, the text takes the background colour instead (--branch-N-text-X, as the heads' text).
// Per kind: the setting, the share of its colour at 100 (keep), the share of the accent at 100 (up), the colour.
const HighlightContrast = 2.5;   // the contrast ratio below which a highlight's text turns over (chosen, not measured)
const Highlights = {
  focused: ['focusIntensity', 100, 30, 'select'], selected: ['selectIntensity', 40, 0, 'select'], hover: ['hoverIntensity', 100, 0, 'hover'],
};

function highlightShares(settings) {
  const shares = {};
  for (const [kind, [name, keep, up]] of Object.entries(Highlights)) {
    const p = between(Number(settings[name]), 0, 200, 100);
    shares[kind] = p <= 100 ? { keep: tenth(keep * p / 100), up: tenth(up * p / 100) }
      : { keep, up: tenth(up + (100 - up) * (p - 100) / 100) };
  }
  return shares;
}

function applyHighlights(settings) {
  const root = document.documentElement.style;
  // The text of the columns after the name (sortColumnIntensity for the one the pane is sorted on, otherColumnsIntensity
  // for the rest), 0 to 200 %: 100 the theme's dim text, lower toward the background, higher toward the full text.
  for (const [name, variable, otherwise] of [['otherColumnsIntensity', '--column-text', 100], ['sortColumnIntensity', '--sort-column-text', 150]]) {
    const p = between(Number(settings[name]), 0, 200, otherwise);
    root.setProperty(variable, p <= 100 ? `color-mix(in srgb, var(--fg-dim) ${p}%, var(--bg))` : `color-mix(in srgb, var(--fg) ${p - 100}%, var(--fg-dim))`);
  }
  for (const [kind, { keep, up }] of Object.entries(highlightShares(settings))) {
    root.setProperty(`--${kind}-keep`, `${keep}%`);
    root.setProperty(`--${kind}-up`, `${up}%`);
  }
}

// The fonts (docs/plans/executed/08-PLAN-fonts.md): the window's (appFont, appSize) and the panes' rows (paneFont, paneSize), in
// points (4 to 36). The row height follows the pane font (paneRowHeight).
const DefaultSize = 10;   // pt, as defaults\settings.json; for a value that is not a size (0 in an old settings.json)
const fontStack = name => name ? `"${name.replace(/["\\]/g, '')}", "Segoe UI", system-ui, sans-serif` : '"Segoe UI", system-ui, sans-serif';
// A size as used: 0 (an old settings.json) the default, anything else held between 4 and 36 (a hand-edited 0.5).
const pointSize = pt => pt ? Math.min(36, Math.max(4, pt)) : DefaultSize;
const sizePx = pt => pointSize(pt) * 96 / 72;
// The row height: rowHeight (plan 11 3.5) in % of the pane font, 100 to 300; 170 the 22 px at 13 px of before.
const rowHeightShare = settings => Math.min(300, Math.max(100, Number(settings.rowHeight) || 170)) / 100;
const paneRowHeight = settings => Math.max(16, Math.round(sizePx(settings.paneSize) * rowHeightShare(settings)));

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
