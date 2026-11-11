'use strict';
// Projects in a window (docs/plans/15-PLAN-projects.md 3.6, as LexPen's): the window's project at the left of the bottom
// bar; a click there (or the action projects.menu) opens the Projects menu (menu.js): every project with its windows,
// New project, Rename this project, Move this window to, Manage projects. The host keeps the projects (AppHost,
// ProjectStore); a name is asked in a small dialog of the page (askText). Loaded after menu.js, before app.js.

let project = { id: null, name: '', display: '' };
let projectMenuAt = null;   // where the menu asked for opens: { x, y }; null: at the bottom bar
let projectMenuOnly = null;   // 'move': only the part to move this window (the action project.moveWindow)

function showProject(p) {
  project = p ?? project;
  const el = document.getElementById('project');
  el.textContent = project.display;
  el.title = `This window's project: ${project.display}. Click for the Projects menu.`;
}

// The menu at the bottom bar (or `at`): the host sends the list first ('projectList').
function projectsMenu(at = null) {
  projectMenuAt = at;
  post({ op: 'projects' });
}

const projectCommand = (kind, args = {}) => post({ op: 'projectCommand', kind, ...args });

// A window line: its number, its folder, this one marked.
const windowLabel = (w, i) => `Window ${i + 1}: ${w.folder ?? '(no folder)'}${w.mine ? '  (this window)' : ''}`;

function projectMenuItems(list, only = null) {
  const mine = list.find(p => p.mine);
  const others = list.filter(p => !p.mine);
  const move = [
    ...others.map(p => ({ label: p.display, run: () => projectCommand('move', { project: p.id }) })),
    ...(others.length ? ['-'] : []),
    { label: 'New project...', run: async () => {
      const name = await askText('Move this window to a new project', '', 'Empty: a number');
      if (name !== null) projectCommand('move', { name });
    } },
  ];
  if (only === 'move') return move;
  const projectItem = p => ({
    label: p.display + (p.mine ? '  (this window)' : ''), checked: p.open,
    items: [
      ...p.windows.map((w, i) => ({ label: windowLabel(w, i), checked: w.open, run: () => projectCommand('window', { key: w.key }) })),
      ...(p.windows.length ? ['-'] : []),
      { label: 'New window in this project', run: () => projectCommand('newWindow', { project: p.id }) },
      { label: 'Open project', run: () => projectCommand('open', { project: p.id }), enabled: !p.mine || p.windows.some(w => !w.open) },
      { label: 'Delete project...', enabled: !p.open, run: async () => {
        if (await askYes(`Delete the project "${p.display}"? Folders and files are not touched.`)) projectCommand('delete', { project: p.id });
      } },
    ],
  });
  return [
    ...list.map(projectItem),
    '-',
    { label: 'New project...', run: async () => {
      const name = await askText('Name of the new project', '', 'Empty: a number');
      if (name !== null) projectCommand('new', { name });
    } },
    { label: 'Rename this project...', enabled: !!mine, run: renameProject },
    { label: 'Move this window to', items: move },
    '-',
    { label: 'Manage projects...', run: () => post({ op: 'openProjects' }) },
  ];
}

async function renameProject() {
  const name = await askText('Name of this window\'s project', project.name, `Empty: Project ${project.id}`);
  if (name !== null) projectCommand('rename', { name });
}

// The list came: the menu opens (at the bottom bar, above the project's name).
function projectListCame(list) {
  const only = projectMenuOnly;
  projectMenuOnly = null;
  const r = document.getElementById('project').getBoundingClientRect();
  const at = projectMenuAt ?? { x: r.left, y: r.top };
  openMenu(at.x, at.y, projectMenuItems(list, only));
  // From the bottom bar it opens upward: moved up by its own height, kept inside the window.
  if (!projectMenuAt) {
    const el = document.querySelector('.menu');
    if (el) el.style.top = `${Math.max(0, r.top - el.offsetHeight - 2)}px`;
  }
  document.querySelector('.menu')?.focus();
}

// Only the part to move this window (the action project.moveWindow).
function moveWindowMenu() {
  projectMenuOnly = 'move';
  projectsMenu();
}

// ---------- A small dialog of the page: a text, or yes / no ----------

// A text, or null for Cancel / Esc.
function askText(title, value = '', placeholder = '') {
  return ask(title, { value, placeholder });
}

// True for OK.
async function askYes(title) {
  return (await ask(title, null)) !== null;
}

function ask(title, input) {
  const dialog = document.createElement('dialog');
  dialog.className = 'ask';
  const form = document.createElement('form');
  form.method = 'dialog';
  const label = Object.assign(document.createElement('label'), { textContent: title });
  form.append(label);
  let box = null;
  if (input) {
    box = Object.assign(document.createElement('input'), { value: input.value, placeholder: input.placeholder, spellcheck: false });
    form.append(box);
  }
  const buttons = document.createElement('div');
  buttons.className = 'ask-buttons';
  buttons.append(Object.assign(document.createElement('button'), { value: 'ok', textContent: 'OK' }),
    Object.assign(document.createElement('button'), { value: 'cancel', textContent: 'Cancel', formNoValidate: true }));
  form.append(buttons);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  if (box) box.select(); else buttons.firstChild.focus();
  return new Promise(resolve => dialog.addEventListener('close', () => {
    resolve(dialog.returnValue === 'ok' ? (box ? box.value.trim() : '') : null);
    dialog.remove();
    activeView()?.body.focus();
  }, { once: true }));
}

document.getElementById('project').addEventListener('mousedown', e => {
  e.preventDefault();
  projectsMenu();
});
