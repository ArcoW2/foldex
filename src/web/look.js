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
}
