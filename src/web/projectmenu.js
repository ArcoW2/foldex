'use strict';
// Projects in a window (docs/plans/15-PLAN-projects.md 3.6, as LexPen's): the window's project at the left of the bottom
// bar; a click there (or the action projects.menu) opens the Projects menu (menu.js): Manage projects, New project,
// Rename this project, then every project, each with the panes of its window by name as a tree (roots, their children
// indented). The host keeps the projects (AppHost, ProjectStore); a name is asked in a small dialog of the page
// (askText). Loaded after menu.js, before app.js.

let project = { id: null, name: '', display: '' };
let projectMenuAt = null;   // where the menu asked for opens: { x, y }; null: at the bottom bar

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

function projectMenuItems(list) {
  const mine = list.find(p => p.mine);
  const projectItem = p => {
    const open = () => projectCommand('open', { project: p.id });
    return {
      label: p.display + (p.mine ? '  (this window)' : ''), checked: p.open,
      items: [
        { label: p.open ? 'Show project' : 'Open project', run: open, enabled: !p.mine },
        ...(p.panes.length ? ['-'] : []),
        // Its window's panes: a root, then its children a step in, with tree lines; a click opens (or shows) the
        // project with the focus on that pane.
        ...p.panes.map((pane, i, all) => ({
          label: pane.name, indent: pane.depth, guides: treeGuides(all.map(x => x.depth))[i],
          run: () => projectCommand('open', { project: p.id, pane: pane.id }),
        })),
        '-',
        { label: 'Delete project...', enabled: !p.open, run: async () => {
          if (await askYes(`Delete the project "${p.display}"? Folders and files are not touched.`)) projectCommand('delete', { project: p.id });
        } },
      ],
    };
  };
  // As LexPen's: Manage, New, Rename, then the projects.
  return [
    { label: 'Manage projects...', run: () => post({ op: 'openProjects' }) },
    { label: 'New project...', run: async () => {
      const name = await askText('Name of the new project', '', 'Empty: a number');
      if (name !== null) projectCommand('new', { name });
    } },
    { label: 'Rename this project...', enabled: !!mine, run: renameProject },
    '-',
    ...list.map(projectItem),
  ];
}

async function renameProject() {
  const name = await askText('Name of this window\'s project', project.name, `Empty: Project ${project.id}`);
  if (name !== null) projectCommand('rename', { name });
}

// The list came: the menu opens (at the bottom bar, above the project's name).
function projectListCame(list) {
  const r = document.getElementById('project').getBoundingClientRect();
  const at = projectMenuAt ?? { x: r.left, y: r.top };
  openMenu(at.x, at.y, projectMenuItems(list));
  // From the bottom bar it opens upward: moved up by its own height, kept inside the window.
  if (!projectMenuAt) {
    const el = document.querySelector('.menu');
    if (el) el.style.top = `${Math.max(0, r.top - el.offsetHeight - 2)}px`;
  }
  document.querySelector('.menu')?.focus();
}

// ---------- A small dialog of the page: a text, or yes / no ----------

// A text, or null for Cancel / Esc.
function askText(title, value = '', placeholder = '') {
  return ask(title, { value, placeholder });
}

// True for OK. `lines`: shown under the question (the folders of a delete, plan 06 3.5).
async function askYes(title, lines = []) {
  return (await ask(title, null, lines)) !== null;
}

function ask(title, input, lines = []) {
  const dialog = document.createElement('dialog');
  dialog.className = 'ask';
  const form = document.createElement('form');
  form.method = 'dialog';
  const label = Object.assign(document.createElement('label'), { textContent: title });
  form.append(label);
  for (const line of lines) form.append(Object.assign(document.createElement('div'), { className: 'ask-line', textContent: line }));
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
