import { CONFIG } from './config.js';
import { state, setActiveView, updateTaskStatus, showToast } from './state.js';
import { todayIso, startOfWeekIso, endOfWeekIso, endOfMonthIso, isBefore, isBetweenInclusive, addDays, formatDisplayDate } from './dateUtils.js';
import { summaryTile, taskCard, linkCard, ideaCard, feedCard, listCard } from './cards.js';
import { renderQuickForm } from './forms.js';

export function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = '';
  const screen = document.createElement('main');
  screen.className = 'app-screen';
  screen.appendChild(renderHero());
  screen.appendChild(renderMobileNav());
  screen.appendChild(renderDashboard());
  app.appendChild(screen);
  if (state.toast) app.appendChild(renderToast(state.toast));
}

function renderHero() {
  const today = todayIso();
  const weekStart = startOfWeekIso(today);
  const weekEnd = endOfWeekIso(today);
  const monthEnd = endOfMonthIso(today);
  const openTasks = state.tasks.filter((task) => task.status !== 'Done');
  const thisWeek = openTasks.filter((task) => isBetweenInclusive(task.dueDate, weekStart, weekEnd));
  const overdue = openTasks.filter((task) => task.dueDate && isBefore(task.dueDate, today));
  const restMonth = openTasks.filter((task) => isBetweenInclusive(task.dueDate, addDays(weekEnd, 1), monthEnd));

  const hero = document.createElement('section');
  hero.className = 'card hero-card';
  hero.innerHTML = `
    <div class="hero-inner">
      <div class="brand-row">
        <div class="logo-cluster">
          <div class="logo-mark">✦</div>
          <div>
            <p class="eyebrow">${CONFIG.appName}</p>
            <h1>Weekly control panel</h1>
            <p>${formatDisplayDate(today)} · ${CONFIG.version} · ${state.syncMessage}</p>
          </div>
        </div>
        <span class="version-pill">Sheet V1</span>
      </div>
      <div class="summary-grid"></div>
    </div>
  `;
  const grid = hero.querySelector('.summary-grid');
  grid.append(
    summaryTile('Open this week', String(thisWeek.length), thisWeek.length ? 'warning' : 'ok'),
    summaryTile('Overdue', String(overdue.length), overdue.length ? 'danger' : 'ok'),
    summaryTile('Rest of month', String(restMonth.length), 'info'),
    summaryTile('Links + ideas', String(state.links.length + state.ideas.length), 'info')
  );
  return hero;
}

function renderMobileNav() {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  [
    ['week', '📅', 'Week'],
    ['month', '🌘', 'Month'],
    ['inbox', '🗃️', 'Inbox'],
    ['add', '✚', 'Add']
  ].forEach(([view, emoji, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nav-button ${state.activeView === view ? 'active' : ''}`;
    button.innerHTML = `<span>${emoji}</span>${label}`;
    button.addEventListener('click', () => setActiveView(view));
    nav.appendChild(button);
  });
  return nav;
}

function renderDashboard() {
  const wrapper = document.createElement('section');
  wrapper.className = 'dashboard-grid';
  const main = document.createElement('div');
  main.className = 'column';
  const side = document.createElement('div');
  side.className = 'column';

  const today = todayIso();
  const weekStart = startOfWeekIso(today);
  const weekEnd = endOfWeekIso(today);
  const monthEnd = endOfMonthIso(today);
  const openTasks = state.tasks.filter((task) => task.status !== 'Done');
  const tasksThisWeek = openTasks.filter((task) => isBetweenInclusive(task.dueDate, weekStart, weekEnd));
  const tasksRestMonth = openTasks.filter((task) => isBetweenInclusive(task.dueDate, addDays(weekEnd, 1), monthEnd));
  const overdueTasks = openTasks.filter((task) => task.dueDate && isBefore(task.dueDate, today));

  if (state.activeView === 'add') {
    main.appendChild(renderQuickForm());
    side.appendChild(renderSourceCard());
  } else if (state.activeView === 'month') {
    main.appendChild(taskList('Rest of month', `${formatDisplayDate(addDays(weekEnd, 1))} → ${formatDisplayDate(monthEnd)}`, tasksRestMonth));
    side.appendChild(feedList());
    side.appendChild(linkList());
  } else if (state.activeView === 'inbox') {
    main.appendChild(linkList());
    main.appendChild(ideaList());
    side.appendChild(feedList());
  } else {
    main.appendChild(taskList('Needs attention', 'Overdue and this week', [...overdueTasks, ...tasksThisWeek]));
    main.appendChild(feedList());
    side.appendChild(renderQuickForm(true));
    side.appendChild(linkList(3));
    side.appendChild(ideaList(3));
  }

  wrapper.append(main, side);
  return wrapper;
}

function taskList(title, subtitle, tasks) {
  const cards = dedupeById(tasks).map((task) => taskCard(task, (id) => {
    updateTaskStatus(id, 'Done');
    showToast('Task marked done locally.');
  }));
  return listCard({ title, subtitle, children: cards, emptyMessage: 'No open tasks in this section.' });
}

function feedList() {
  return listCard({
    title: 'From your apps',
    subtitle: 'ChrisFit, Viaticum, and future app feed items',
    children: state.appFeed.map(feedCard),
    emptyMessage: 'No app feed items yet.'
  });
}

function linkList(limit = 0) {
  const links = limit ? state.links.slice(0, limit) : state.links;
  return listCard({
    title: 'Saved links',
    subtitle: 'Useful links, maps, docs, and things to review',
    children: links.map(linkCard),
    emptyMessage: 'No saved links yet.'
  });
}

function ideaList(limit = 0) {
  const ideas = limit ? state.ideas.slice(0, limit) : state.ideas;
  return listCard({
    title: 'Ideas',
    subtitle: 'Things to maybe do later, with next actions if known',
    children: ideas.map(ideaCard),
    emptyMessage: 'No ideas captured yet.'
  });
}

function renderSourceCard() {
  const card = document.createElement('section');
  card.className = 'card card-pad';
  card.innerHTML = `
    <p class="eyebrow">Sources</p>
    <h2>Connected app logic</h2>
    <p>V1 uses local starter data. The structure is ready for Actarium Sheet, Viaticum-style labelled sections, ChrisFit summaries, and future Apps Script sync.</p>
    <div class="item-actions">
      <a class="ghost-button" href="${CONFIG.sheetUrl}" target="_blank" rel="noreferrer">Open Sheet</a>
      <a class="ghost-button" href="${CONFIG.urls.viaticum}" target="_blank" rel="noreferrer">Open Viaticum</a>
      <a class="ghost-button" href="${CONFIG.urls.chrisfit}" target="_blank" rel="noreferrer">Open ChrisFit</a>
    </div>
  `;
  return card;
}

function renderToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  return toast;
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
