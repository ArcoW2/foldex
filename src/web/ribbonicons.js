'use strict';
// The ribbon's icons (docs/plans/executed/19-PLAN-ribbon-change-mode.md 3.3; as LexPen's ribbonicons.js): a drawing per
// action, on a 16-unit grid, stroked in the text colour so every theme colours it; small 16 px with lines of 1.4, large
// 32 px with lines of 1.0. A button by its call: the action's name, with its parameter after a space where the parameter
// makes another drawing ("layout.preset dual"). An action that shows a pane or opens a window (RIBBON_PANEL_ACTIONS) is
// a small window with its drawing inside: at 32 px the drawing at 0.66, at 16 px a drawing made for that size. Labels in
// the arrays are the drawings' names, for the overview (the plan's icon sheets). LexPen's drawings where the action
// means the same: Copy, Cut, Paste, Find, Select all, a bookmark, Settings, F1, Projects, Columns.
const RIBBON_ICONS = (() => {
  const page = 'M3.5 1.5h5.5l3 3V9M3.5 1.5v13H8';
  const mag = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/><path d="M${cx + r * 0.72} ${cy + r * 0.72}L${cx + r * 0.72 + 2.6} ${cy + r * 0.72 + 2.6}"/>`;
  const clip = 'M5.5 1.5h5v2.5h-5zM5.5 2.5H3v12h10v-12h-2.5';
  const p = d => `<path d="${d}"/>`;
  const t = (x, y, s, txt, w = 600) => `<text x="${x}" y="${y}" font-size="${s}" font-weight="${w}" fill="currentColor" stroke="none" font-family="Segoe UI">${txt}</text>`;
  const dim = d => `<path d="${d}" opacity=".4"/>`;
  const dot = (x, y) => `<path d="M${x} ${y}h0"/>`;   // a round dot as wide as the line
  // A cogwheel: n teeth between radius ri and ro, a hole of radius rh.
  const gear = (cx, cy, ro, ri, n, rh) => {
    const pts = [];
    for (let i = 0; i < n * 4; i++) {
      const a = (i / (n * 4)) * 2 * Math.PI - Math.PI / 2, r = (i % 4 === 1 || i % 4 === 2) ? ro : ri;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return p('M' + pts.join('L') + 'z') + `<circle cx="${cx}" cy="${cy}" r="${rh}"/>`;
  };
  const cog = gear(8, 8, 6.6, 4.9, 8, 2);
  const plus = (x, y) => p(`M${x} ${y - 2.5}v5M${x - 2.5} ${y}h5`);
  const folder = 'M1.5 13V3h4l1.5 1.5h7V7M1.5 13h13V7';
  const folderOpen = 'M1.5 13V3h4l1.5 1.5h5.5V7M1.5 13h11l2-6h-10z';
  const copy = 'M5.5 5.5h8v9h-8zM10.5 5.5v-4h-8v9h3';
  const bin = (x = 0) => p(`M${2.5 + x} 4h11M${6 + x} 4V2.5h4V4M${4 + x} 4l.8 10.5h6.4L${12 + x} 4M${6.5 + x} 6.5v5.5M${9.5 + x} 6.5v5.5`);
  const bookmark = 'M4 1.5h8v13l-4-3-4 3z';
  const pencil = 'M8.5 14.5l.5-2 4.5-4.5 1.5 1.5-4.5 4.5z';
  const win = '<rect x="1.5" y="2.5" width="13" height="11" rx="1"/>';   // a pane: its frame
  const head = 'M1.5 5.5h13';                                            // a pane's head
  const tray = 'M1.5 9.5l2-5h9l2 5v4h-13zM1.5 9.5h4l1 1.5h3l1-1.5h4';   // a scrap: items gathered
  const eye = 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z';
  const bar = '<rect x="1.5" y="2.5" width="13" height="4" rx="1"/>';   // a bar of the window
  const projects = 'M1.5 3.5h4.5l1.5 1.5h7v8.5h-13zM4 9h8';
  const undo = 'M5.5 3.5L2.5 6.5l3 3M2.5 6.5H10a3.5 3.5 0 0 1 0 7H6';
  const buttons = {
    // Items: the clipboard
    'item.paste': ['Paste', p(clip + 'M6 8h4M6 11h4')],
    'item.copy': ['Copy', p(copy)],
    'item.cut': ['Cut', '<circle cx="4.5" cy="12" r="2"/><circle cx="11.5" cy="12" r="2"/>' + p('M5.7 10.4L12 1.5M10.3 10.4L4 1.5')],
    'item.copyPath': ['Copy path', p(copy + 'M7.8 12.5l1.6-4.5M10.6 12.5l1.6-4.5')],
    'item.copyPathsLine': ['Copy path (one line)', p(copy + 'M7.8 12.5l1.6-4.5M10.6 12.5l1.6-4.5')],
    // Items: organize
    'item.delete': ['Delete', bin()],
    'item.deleteDisk': ['Delete from disk', bin(-1.5) + '<rect x="10.5" y="10.5" width="4.5" height="4" rx=".8"/>' + dot(13.4, 12.5)],
    'item.deletePermanent': ['Delete permanently', bin(-1.5) + p('M11 10l4 4M15 10l-4 4')],
    'folder.new': ['New folder', p('M1.5 13V3h4l1.5 1.5h7V8M1.5 13H9') + plus(12, 12)],
    'file.new': ['New file', p(page) + plus(12, 12.5)],
    'item.rename': ['Rename', '<rect x="1.5" y="4.5" width="13" height="7" rx="1"/>' + p('M4 8h4.5M11 3v10M9.5 3h3M9.5 13h3')],
    // Items: open
    'item.open': ['Open', p(folderOpen)],
    'item.execute': ['Execute', p('M4.5 2.5l8.5 5.5-8.5 5.5z')],
    'item.properties': ['Properties', '<rect x="2.5" y="1.5" width="11" height="13" rx="1"/>' + p('M5 5h6M5 8h6M5 11h3.5')],
    'item.selectAll': ['Select all', '<rect x="1.5" y="1.5" width="13" height="13" rx="1" stroke-dasharray="2 1.7"/>' + p('M4.5 5.5h7M4.5 8h7M4.5 10.5h5')],
    'bookmarks.menu': ['Bookmarks', p(bookmark)],
    'bookmarks.add': ['Add a bookmark', p('M2.5 1.5h7v13l-3.5-2.6-3.5 2.6z') + plus(12.5, 5)],
    'bookmarks.open': ['Open a bookmark', p('M2.5 1.5h7v13l-3.5-2.6-3.5 2.6zM11 8h4M13.5 6l1.5 2-1.5 2')],
    // Find and scraps
    find: ['Find', mag(6.8, 6.8, 4.5)],
    'search.focus': ['Search bar', bar.replace('y="2.5"', 'y="5.5"') + mag(5, 8, 1.5)],
    'pane.filter': ['Filter', p('M2 3h12l-4.5 5.5V13l-3 1.5V8.5z')],
    'filters.list': ['Filters', p('M1.5 3h8.5l-3.2 4V11l-2 1V7z') + p('M11.5 6.5h3M11.5 9.5h3M11.5 12.5h3')],
    'filters.toggle': ['Filter on or off', p('M2 3h12l-4.5 5.5V13l-3 1.5V8.5z') + p('M1.5 14.5l13-13')],
    'filters.apply': ['Filter by a kept set', p('M2 3h12l-4.5 5.5V13l-3 1.5V8.5z')],
    'scrap.new': ['New scrap', p(tray) + p('M8 .5v4M6 2.5h4')],
    'scrap.add': ['Add to scrap', p(tray) + p('M8 .8v5M6 3.8l2 2 2-2')],
    'scrap.clear': ['Clear scrap', p(tray) + p('M5.5 1.5l5 5M10.5 1.5l-5 5')],
    // Go
    'history.back': ['Back', p('M13.5 8h-11M6.5 4l-4 4 4 4')],
    'history.forward': ['Forward', p('M2.5 8h11M9.5 4l4 4-4 4')],
    'folder.up': ['Up', p('M8 13.5v-11M4 6.5l4-4 4 4')],
    refresh: ['Refresh', p('M13 8A5 5 0 1 1 11.5 4.5M11.8 1.5v3h-3')],
    'drives.list': ['Drives', '<rect x="1.5" y="5" width="13" height="6.5" rx="1.2"/>' + p('M3.8 8.25h5') + dot(11.8, 8.25)],
    // Panes
    'pane.newChild right': ['New child pane at the right', win + p('M7 2.5v11') + plus(10.8, 8)],
    'pane.newChild below': ['New child pane below', win + p('M1.5 8h13M8 9v3.6M6.2 10.8h3.6')],
    'pane.newChild': ['New child pane', win + p('M7 2.5v11') + plus(10.8, 8)],
    'pane.newTab': ['New tab', p('M1.5 13.5V4.5h5l1.5-2h5v4M1.5 13.5H8') + plus(12, 11.5)],
    'pane.new': ['New pane', win + p(head) + plus(8, 9.5)],
    'pane.rename': ['Rename pane', win + p(head + 'M7 8v4M5.8 8h2.4M5.8 12h2.4')],
    'pane.close': ['Close pane', win + p(head + 'M6 7.5l4 4M10 7.5l-4 4')],
    'pane.toggle': ['Show or hide a pane', '<rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke-dasharray="2.2 1.6"/>' + p(head)],
    'pane.hidden': ['Hidden panes', '<rect x="4.5" y="1.5" width="10" height="8.5" rx="1" stroke-dasharray="2 1.5"/>' + '<rect x="1.5" y="5.5" width="10" height="9" rx="1"/>' + p('M1.5 8h10')],
    'pane.next': ['Next pane', win + p('M6.5 2.5v11M9 8h4M11.5 6l1.5 2-1.5 2')],
    'pane.previous': ['Previous pane', win + p('M9.5 2.5v11M7 8H3M4.5 6L3 8l1.5 2')],
    'preview.float': ['Preview in a window', '<rect x="1.5" y="5.5" width="9.5" height="9" rx="1"/>' + p('M1.5 7.5h9.5M5 5.5v-4h9.5v9H11')
      + p('M3 11.2s1.3-1.9 3.25-1.9 3.25 1.9 3.25 1.9-1.3 1.9-3.25 1.9S3 11.2 3 11.2z')],
    'pane.detach': ['Detach from parent',p('M6.5 5.5h-2a2.5 2.5 0 0 0 0 5h2M9.5 5.5h2a2.5 2.5 0 0 1 0 5h-2M7 2.5l.8 1.6M9 13.5l-.8-1.6')],
    'pane.pin': ['Pin', p('M6 2h4M7 2v4.5L4.5 9.5h7L9 6.5V2M8 9.5V14')],
    'pane.toParent': ['To the parent pane', win + p('M6.5 2.5v11M13 8H9M10.5 6L9 8l1.5 2')],
    'pane.toChild': ['To the child pane', win + p('M9.5 2.5v11M3 8h4M5.5 6L7 8l-1.5 2')],
    // View
    'view.menu': ['Views', '<rect x="1.5" y="1.5" width="5.5" height="5.5" rx=".8"/><rect x="9" y="1.5" width="5.5" height="5.5" rx=".8"/>' +
      '<rect x="1.5" y="9" width="5.5" height="5.5" rx=".8"/>' + p('M9 10h5.5M9 12h5.5M9 14h3.5')],
    'preview.pane': ['Pane preview', p(eye) + '<circle cx="8" cy="8" r="2"/>'],
    'info.pane': ['Pane info', '<circle cx="8" cy="8" r="6.5"/>' + p('M8 7v4.5') + dot(8, 4.6)],
    'hidden.toggle': ['Hidden items', `<path d="${page}" stroke-dasharray="2 1.6"/>` + p('M6 11.5h3') + dot(12, 12)],
    'columns.fit': ['Fit all columns', win + p('M8 2.5v3M8 10.5v3M4 8h8M5.5 6.5L4 8l1.5 1.5M10.5 6.5L12 8l-1.5 1.5')],
    'folders.size': ['Folder sizes', p(folder) + p('M5 10.5h6M5 8.5h3.5')],
    'columns.fitName': ['Fit columns', win + p('M8 2.5v3M8 10.5v3M4 8h8M5.5 6.5L4 8l1.5 1.5M10.5 6.5L12 8l-1.5 1.5')],
    // Projects and layouts
    'projects.menu': ['Projects', p(projects)],
    'project.new': ['New project', p('M1.5 3.5h4.5l1.5 1.5h7V8M1.5 3.5v10H9M4 9h4') + plus(12, 12)],
    'project.rename': ['Rename project', p('M1.5 3.5h4.5l1.5 1.5h7V7M1.5 3.5v10H7M4 9h4') + p(pencil)],
    // Profiles (docs/plans/executed/41-PLAN-profiles.md 3.5): a person, small at the left where something is added.
    'profiles.menu': ['Profiles', '<circle cx="8" cy="5" r="3"/>' + p('M2.5 14.5c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5')],
    'profile.copy': ['Copy profile', '<circle cx="6" cy="4.5" r="2.5"/>' + p('M1.5 12c0-2.7 2-4.5 4.5-4.5') + p('M8.5 8.5h6v6h-6z')],
    'profile.rename': ['Rename profile', '<circle cx="6" cy="4.5" r="2.5"/>' + p('M1.5 13c0-2.9 2-5 4.5-5') + p(pencil)],
    'profile.password': ['Profile password', p('M4 7.5h8v7H4z') + p('M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5') + dot(8, 11)],
    'profile.close': ['Close profile', '<circle cx="6" cy="4.5" r="2.5"/>' + p('M1.5 13c0-2.9 2-5 4.5-5') + p('M10 9.5l4 4M14 9.5l-4 4')],
    'layout.saveDefault': ['Save layout as default', p('M2.5 2.5h9l2 2v9h-11zM5 2.5v3.5h5.5V2.5M4.5 13.5V9.5h7v4')],
    'layout.resetDefault': ['Reset layout', p(undo)],
    'layout.preset default': ['Default', win + p('M6 2.5v11M6 8h8.5')],
    'layout.preset dual': ['Dual', win + p('M5.5 2.5v11M10 2.5v11')],
    'layout.preset columns': ['Columns', win + p('M4.5 2.5v11M8 2.5v11M11.5 2.5v11')],
    'layout.preset preview': ['Preview', win + p('M5.5 2.5v11M10 2.5v11') + '<circle cx="12.25" cy="8" r="1"/>'],
    // Bars
    'bars.change': ['Change the bars', bar + dim('M2 10h12M2 13h7') + p(pencil)],
    'bars.reset': ['Reset the bars', bar + p('M7.5 9.5L4.5 12l3 2.5M4.5 12h6a2 2 0 0 0 0-4')],
    'bars.add path': ['Add path bar', bar + p('M5 5.5l1.2-2M8 5.5l1.2-2') + plus(8, 11.5)],
    'bars.add drives': ['Add drives bar', bar + p('M4 4.5h3') + dot(11.5, 4.5) + plus(8, 11.5)],
    'bars.add search': ['Add search bar', bar + mag(4.3, 4.5, 1) + plus(8, 11.5)],
    'bars.add': ['Add a bar', bar + plus(8, 11.5)],
    // The ribbon itself
    'ribbon.change': ['Change the ribbon', '<rect x="1.5" y="2.5" width="13" height="6" rx="1"/>' + p('M4.5 2.5v6M8 2.5v6') + p(pencil)],
    'ribbon.customize': ['Customize the ribbon', p('M2 3h7M2 6.5h7M2 10h4') + p(pencil)],
    'ribbon.reset': ['Reset the ribbon', '<rect x="1.5" y="2.5" width="13" height="5" rx="1"/>' + p('M7.5 9.5L4.5 12l3 2.5M4.5 12h6a2 2 0 0 0 0-4')],
    'ribbon.onDemand': ['Ribbon only when wanted', p('M3.5 10l4.5-4.5 4.5 4.5')],
    // Links and ownership (plan 31): two chain links; them over a clipboard; a key over a page; a shield.
    'link.create': ['Create link', p('M6.5 9.5l3-3M7 4.5l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5L7.5 13a2.5 2.5 0 0 1-3.5-3.5L5.5 8')],
    'link.paste': ['Paste link', p(clip) + p('M7 10.5l2-2M7.3 8.3l.7-.7a1.3 1.3 0 0 1 1.8 1.8l-.7.7M8.7 10.7l-.7.7a1.3 1.3 0 0 1-1.8-1.8l.7-.7')],
    'item.takeOwnership': ['Take ownership', p(page) + '<circle cx="11.5" cy="10.5" r="1.8"/>' + p('M11.5 12.3v2.2M11.5 13.5h1.2')],
    'helper.end': ['End administrator rights', p('M8 1.5l5.5 2v4c0 3.5-2.4 6-5.5 7-3.1-1-5.5-3.5-5.5-7v-4zM5.5 6l5 5M10.5 6l-5 5')],
    // Macros (plan 34): LexPen's Play for one run; the list of steps with Play for the menu.
    'macro.run': ['Run a macro', p('M4.5 2.5l8.5 5.5-8.5 5.5z')],
    'macros.menu': ['Macros', p('M2 3.5h8M2 7h8M2 10.5h5M10.5 9.5l4 2.5-4 2.5z')],
    // Foldex
    'theme.toggle': ['Light / dark', p('M13 10.5A5.5 5.5 0 1 1 6 2.8a4.5 4.5 0 0 0 7 7.7z')],
    about: ['About Foldex', '<circle cx="8" cy="8" r="6.5"/>' + t(5.3, 11.3, 9, '?', 700)],
  };
  // The panes and windows: per one the drawing for 32 px (at 0.66 in the frame) and one drawn for 16 px in the frame's
  // inside (x 2.7 to 13.3, y 5.2 to 13.3: a pixel from the frame and the title bar), simpler, its lines not scaled.
  const panels = {
    preview: ['Preview', p(eye) + '<circle cx="8" cy="8" r="2"/>', p('M3.2 9.3s1.9-3 4.8-3 4.8 3 4.8 3-1.9 3-4.8 3-4.8-3-4.8-3z') + '<circle cx="8" cy="9.3" r="1"/>'],
    info: ['Info', '<circle cx="8" cy="8" r="6.5"/>' + p('M8 7v4.5') + dot(8, 4.6), '<circle cx="8" cy="9.25" r="3.4"/>' + p('M8 8.6v2.4') + dot(8, 7.1)],
    log: ['Log', p('M2.5 3h11M2.5 6.3h11M2.5 9.7h8M2.5 13h5'), p('M4 7.2h8M4 9.4h8M4 11.6h5')],
    bm: ['Bookmarks', p(bookmark), p('M4.9 5.8h6.2v7.2L8 10.4 4.9 13z') + '<circle cx="8" cy="9.4" r=".55" fill="currentColor" stroke="none"/>'],
    cols: ['Column sets', '<rect x="1.5" y="2.5" width="13" height="11" rx="1"/>' + p('M1.5 6h13M6 2.5v11M10.5 2.5v11'), p('M3.4 8.2h9.2M6.4 5.8v7M9.6 5.8v7')],
    settings: ['Settings', cog, '<circle cx="8" cy="9.2" r="1.9"/>' + p('M8 5.8v1M8 11.6v1.1M4.6 9.2h1M10.4 9.2h1M5.6 6.8l.7.7M9.7 10.9l.7.7M5.6 11.6l.7-.7M9.7 7.5l.7-.7')],
    // F1 as large as the inside allows, its ink measured (Segoe UI bold: 7% bearing at the left, 71% high): no white
    // of the font's box counted.
    commands: ['All actions and keys', t(0.44, 13.37, 15.12, 'F1', 700), t(2.58, 13.1, 10.85, 'F1', 700)],
    projects: ['Manage projects', p(projects), p('M3.2 6h3l1 1h5.3v5.8H3.2zM5 10.2h6')],
    profiles: ['Manage profiles', '<circle cx="8" cy="5" r="3"/>' + p('M2.5 14.5c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5'),
      '<circle cx="8" cy="7.6" r="1.6"/>' + p('M5 12.8c0-1.9 1.3-3.2 3-3.2s3 1.3 3 3.2')],
    macros: ['Manage macros', p('M2 3.5h8M2 7h8M2 10.5h5M10.5 9.5l4 2.5-4 2.5z'), p('M3.6 6.2h5.6M3.6 9.2h5.6M3.6 12.2h3M9.4 10l3 1.6-3 1.6z')],
    filters: ['Manage filters', p('M2 3h12l-4.5 5.5V13l-3 1.5V8.5z'), p('M3.6 6h8.8l-3.3 3.6v2.6l-2.2 1V9.6z')],
  };
  return { buttons, panels };
})();

// The actions that show a pane or open a window: its icon (plan 14 3.7's list of panes and windows).
const RIBBON_PANEL_ACTIONS = { 'preview.toggle': 'preview', 'info.toggle': 'info', 'log.toggle': 'log', palette: 'commands',
  'settings.open': 'settings', 'projects.manage': 'projects', 'columns.manage': 'cols', 'bookmarks.manage': 'bm', 'filters.manage': 'filters',
  'macros.manage': 'macros', 'profiles.manage': 'profiles' };

function ribbonIconSvg(body, size, panel, small) {
  const px = size === 'large' ? 32 : 16, w = size === 'large' ? 1 : 1.4;
  const frame = '<rect x="1" y="1" width="14" height="14" rx="1.5"/><path d="M1 3.5h14"/>';
  const inner = !panel ? body
    : size !== 'large' && small ? frame + small
    : frame + `<g transform="translate(2.72 3.97) scale(.66)" style="stroke-width: ${(w / 0.66).toFixed(2)}">${body}</g>`;
  return `<svg class="rb-svg" viewBox="0 0 16 16" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// The icon of a call ([action, ...params]) at a size ("large" or "small"); null: none (the button shows a box with its
// label's first letter).
function ribbonIcon(call, size) {
  const [name, ...params] = call, { buttons, panels } = RIBBON_ICONS;
  const panel = RIBBON_PANEL_ACTIONS[name] ? panels[RIBBON_PANEL_ACTIONS[name]] : null;
  if (panel) return ribbonIconSvg(panel[1], size, true, panel[2]);
  const hit = buttons[[name, ...params].join(' ')] ?? buttons[name];
  return hit ? ribbonIconSvg(hit[1], size, false) : null;
}
