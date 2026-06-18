import * as api from './api.js';
import { CONFIG } from './config.js';
import { state, setActiveView, setTodayTaskFilter, toggleTheme, toggleAppMenu, closeAppMenu, setModal, showToast } from './state.js';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatDayName,
  formatLongDate,
  formatMonth,
  getWeekDates,
  startOfMonth,
  startOfWeek,
  toISODate
} from './dateUtils.js';
import {
  createAppCards,
  createTaskSection,
  createScheduleSection,
  createPeriodCard,
  createTopScheduleChips,
  getViaticumData,
  taskMatchesDate,
  scheduleMatchesDate,
  isDone
} from './cards.js';
import { renderModal } from './forms.js';

let selectedTaskIds = new Set();

export function render() {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = '';
  const shell = document.createElement('main');
  shell.className = 'app-shell';
  shell.append(createTopBar(), createView());
  root.append(shell);

  const modal = renderModal();
  if (modal) root.append(modal);

  if (state.toast) {
    const toast = document.createElement('div');
    toast.className = `toast ${state.toast.type}`;
    toast.textContent = state.toast.message;
    root.append(toast);
  }
}

function createTopBar() {
  const currentSchedule = getScheduleForActiveView();
  const top = document.createElement('header');
  top.className = 'top-bar';
  top.innerHTML = `
    <div class="top-inner">
      <div class="top-menu-row">
        <div class="brand-lockup">
          <div class="logo-mark">✦</div>
          <div class="brand-title">
            <div class="brand-name-line">
              <span class="brand-name">${CONFIG.appName}</span>
              <span class="version-pill">${CONFIG.version}</span>
            </div>
          </div>
        </div>
        <nav class="nav-row" aria-label="Actarium views"></nav>
        <div class="top-actions">
          <button type="button" class="pill-button apps-menu-button" title="Open app links">🧩 Apps</button>
          <button type="button" class="pill-button archive-button" title="Open history and archive">🗄️ Archive</button>
          <button type="button" class="pill-button quick-add-button selected-pulse" title="Create a task">➕ Add</button>
          <button type="button" class="icon-button theme-button" title="Toggle light/dark mode">${state.theme === 'light' ? '🌙' : '☀️'}</button>
          <div class="apps-menu-slot"></div>
        </div>
      </div>
      <div class="top-day-card">
        <div class="top-day-text">
          <p class="eyebrow">${escapeHtml(activeEyebrow())}</p>
          <button type="button" class="date-title-button" title="Pick date">${escapeHtml(activeTitle())}</button>
          <div class="date-line">${escapeHtml(activeDateLine())}</div>
        </div>
        <div class="top-schedule" aria-label="Schedule summary"></div>
      </div>
    </div>
  `;

  top.querySelector('.theme-button').addEventListener('click', toggleTheme);
  top.querySelector('.apps-menu-button').addEventListener('click', toggleAppMenu);
  top.querySelector('.archive-button').addEventListener('click', () => { closeAppMenu(); setModal({ type: 'history' }); });
  top.querySelector('.quick-add-button').addEventListener('click', () => { closeAppMenu(); setModal({ type: 'task-form', taskId: null }); });
  top.querySelector('.date-title-button').addEventListener('click', () => setModal({ type: 'date-picker' }));
  top.querySelector('.top-schedule').append(createTopScheduleChips(currentSchedule));
  top.querySelector('.apps-menu-slot').append(createAppsMenu());

  const nav = top.querySelector('.nav-row');
  [
    ['today', '🌅 Today'],
    ['week', '🗓️ Week'],
    ['month', '🌘 Month'],
    ['tasks', '✅ Tasks']
  ].forEach(([view, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nav-button ${state.activeView === view ? 'active' : ''}`;
    button.textContent = label;
    button.addEventListener('click', () => { closeAppMenu(); setActiveView(view); });
    nav.append(button);
  });

  return top;
}


function createAppsMenu() {
  const menu = document.createElement('div');
  menu.className = `apps-menu ${state.appMenuOpen ? 'is-open' : ''}`;
  menu.setAttribute('aria-hidden', state.appMenuOpen ? 'false' : 'true');
  const apps = state.apps && state.apps.length ? state.apps : [];
  if (!apps.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state compact-empty';
    empty.textContent = 'No app links yet.';
    menu.append(empty);
    return menu;
  }
  apps.forEach(app => {
    const link = document.createElement('a');
    link.className = `app-menu-link app-menu-${escapeClass(app.accent || 'tasks')}`;
    link.href = app.url || '#';
    link.target = app.url ? '_blank' : '_self';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `<span class="app-menu-emoji">${escapeHtml(app.emoji || '🔗')}</span><span><strong>${escapeHtml(app.label || 'App')}</strong>${app.notes ? `<small>${escapeHtml(app.notes)}</small>` : ''}</span>`;
    link.addEventListener('click', closeAppMenu);
    menu.append(link);
  });
  return menu;
}

function escapeClass(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function createView() {
  if (state.activeView === 'week') return createWeekView();
  if (state.activeView === 'month') return createMonthView();
  if (state.activeView === 'tasks') return createTasksView();
  return createTodayView();
}

function createTodayView() {
  const date = state.selectedDate;
  const todaySchedule = contextItemsForDate(date);
  const todayTasksAll = state.tasks.filter(task => taskMatchesDate(task, date) && !isOlderOpenTask(task, date));
  const todayTasks = filterTodayTasks(todayTasksAll);
  const outstanding = getOutstandingTasks(date);
  const todayFeed = state.appFeed.filter(item => item.date === date || !item.date);

  const view = document.createElement('section');
  view.className = 'view-content today-view simplified-view';

  const left = document.createElement('div');
  left.className = 'view-column app-column';
  left.append(createAppCards(todayFeed, 'today', date), createScheduleSection('🧭 Day context', '', todaySchedule));

  const right = document.createElement('div');
  right.className = 'view-column task-column';
  if (outstanding.length) right.append(createTaskSection('🚨 Outstanding', '', sortTasksOldestFirst(outstanding), selectionOptions('outstanding')));
  right.append(createTaskSection('✅ Today tasks', '', sortTasksOldestFirst(todayTasks), selectionOptions('normal', {
    filter: {
      value: state.todayTaskFilter,
      items: [['all', '🌐 All'], ['work', '💼 Work']],
      onChange: setTodayTaskFilter
    }
  })));

  view.append(left, right);
  return view;
}

function createWeekView() {
  const start = startOfWeek(state.selectedDate);
  const end = endOfWeek(state.selectedDate);
  const weekTasks = state.tasks.filter(task => overlapsPeriod(task, start, end) && !isOlderOpenTask(task, toISODate(start)));
  const outstanding = getOutstandingTasks(toISODate(start));
  const weekSchedule = getWeekDates(start).flatMap(date => contextItemsForDate(toISODate(date))
    .map(item => ({ ...item, title: `${formatShort(date)} · ${item.title}` })));

  const view = document.createElement('section');
  view.className = 'view-content simplified-view';

  const left = document.createElement('div');
  left.className = 'view-column app-column';
  left.append(createAppCards(state.appFeed, 'week', state.selectedDate), createScheduleSection('🧭 Week context', '', weekSchedule.slice(0, 10)));

  const right = document.createElement('div');
  right.className = 'view-column task-column';
  if (outstanding.length) right.append(createTaskSection('🚨 Outstanding', '', sortTasksOldestFirst(outstanding), selectionOptions('outstanding')));
  right.append(createTaskSection('✅ Week tasks', '', sortTasksOldestFirst(weekTasks), selectionOptions('normal')));

  const grid = document.createElement('section');
  grid.className = 'card card-accent tasks period-overview';
  grid.append(sectionHeader('📆 Week at a glance', ''));
  const cards = document.createElement('div');
  cards.className = 'card-list week-grid';
  getWeekDates(start).forEach(date => {
    const iso = toISODate(date);
    cards.append(createPeriodCard(date, state.tasks.filter(task => taskMatchesDate(task, iso)), state.schedule.filter(item => scheduleMatchesDate(item, iso))));
  });
  grid.append(cards);
  view.append(left, right, grid);
  return view;
}

function createMonthView() {
  const start = startOfMonth(state.selectedDate);
  const end = endOfMonth(state.selectedDate);
  const monthTasks = state.tasks.filter(task => overlapsPeriod(task, start, end) && !isOlderOpenTask(task, toISODate(start)));
  const outstanding = getOutstandingTasks(toISODate(start));
  const sampleDates = Array.from({ length: Math.min(12, end.getDate()) }, (_, index) => addDays(start, index));

  const view = document.createElement('section');
  view.className = 'view-content simplified-view';

  const left = document.createElement('div');
  left.className = 'view-column app-column';
  left.append(createAppCards(state.appFeed, 'month', state.selectedDate), createScheduleSection('🧭 Month context', '', dedupeContextItems([
    ...state.schedule.filter(item => String(item.status || '').toLowerCase() !== 'inactive'),
    ...tripContextForDate(state.selectedDate)
  ]).slice(0, 10)));

  const right = document.createElement('div');
  right.className = 'view-column task-column';
  if (outstanding.length) right.append(createTaskSection('🚨 Outstanding', '', sortTasksOldestFirst(outstanding), selectionOptions('outstanding')));
  right.append(createTaskSection('✅ Month tasks', '', sortTasksOldestFirst(monthTasks), selectionOptions('normal')));

  const grid = document.createElement('section');
  grid.className = 'card card-accent tasks period-overview';
  grid.append(sectionHeader('🌘 Month preview', ''));
  const cards = document.createElement('div');
  cards.className = 'card-list month-grid';
  sampleDates.forEach(date => {
    const iso = toISODate(date);
    cards.append(createPeriodCard(date, state.tasks.filter(task => taskMatchesDate(task, iso)), state.schedule.filter(item => scheduleMatchesDate(item, iso))));
  });
  grid.append(cards);
  view.append(left, right, grid);
  return view;
}

function createTasksView() {
  const view = document.createElement('section');
  view.className = 'view-content task-list-view';

  const outstanding = getOutstandingTasks(state.selectedDate);
  const open = state.tasks.filter(task => !isDone(task) && !isOlderOpenTask(task, state.selectedDate));
  const workTasks = sortTasksOldestFirst(open.filter(isWorkTask));
  const personalTasks = sortTasksOldestFirst(open.filter(task => !isWorkTask(task)));

  if (outstanding.length) {
    const outstandingSection = createTaskSection('🚨 Outstanding', '', sortTasksOldestFirst(outstanding), selectionOptions('outstanding'));
    outstandingSection.classList.add('wide-section');
    view.append(outstandingSection);
  }
  view.append(
    createTaskSection('🏠 Personal tasks', '', personalTasks, selectionOptions('normal')),
    createTaskSection('💼 Work tasks', '', workTasks, selectionOptions('normal'))
  );
  return view;
}

function selectionOptions(variant = 'normal', extra = {}) {
  return {
    variant,
    ...extra,
    selectedIds: selectedTaskIds,
    onSelect: (id, selected) => {
      if (selected) selectedTaskIds.add(String(id));
      else selectedTaskIds.delete(String(id));
      render();
    },
    actions: [
      button('✅ Done selected', 'secondary-button', () => markSelectedDone()),
      button('➕ New task', 'primary-button', () => setModal({ type: 'task-form', taskId: null }))
    ]
  };
}

function markSelectedDone() {
  if (!selectedTaskIds.size) {
    showToast('Tick one or more tasks first', 'error');
    return;
  }
  api.markTasksDone([...selectedTaskIds]);
  selectedTaskIds = new Set();
}

function sortTasksOldestFirst(tasks) {
  return [...tasks].sort((a, b) => {
    const doneDiff = Number(isDone(a)) - Number(isDone(b));
    if (doneDiff) return doneDiff;
    return taskDate(a).localeCompare(taskDate(b)) || priorityRank(b.priority) - priorityRank(a.priority) || String(a.title).localeCompare(String(b.title));
  });
}

function getOutstandingTasks(beforeDate) {
  return sortTasksOldestFirst(state.tasks.filter(task => isOlderOpenTask(task, beforeDate)));
}

function isOlderOpenTask(task, beforeDate) {
  if (isDone(task)) return false;
  const date = taskDate(task);
  return Boolean(date && date < beforeDate);
}

function taskDate(task) {
  return task.startDate || task.dueDate || task.endDate || '';
}

function overlapsPeriod(task, start, end) {
  const startDate = task.startDate || task.dueDate;
  const endDate = task.endDate || task.dueDate || startDate;
  return startDate <= toISODate(end) && toISODate(start) <= endDate;
}

function priorityRank(priority = '') {
  const value = String(priority).toLowerCase();
  if (value.includes('urgent')) return 4;
  if (value.includes('high')) return 3;
  if (value.includes('normal')) return 2;
  if (value.includes('low')) return 1;
  return 0;
}

function getScheduleForActiveView() {
  if (state.activeView === 'week') {
    const start = startOfWeek(state.selectedDate);
    const routine = getWeekDates(start).flatMap(date => contextItemsForDate(toISODate(date))).slice(0, 3);
    return dedupeContextItems(routine);
  }
  if (state.activeView === 'month') {
    const routine = state.schedule.filter(item => String(item.status || '').toLowerCase() !== 'inactive').slice(0, 2);
    return dedupeContextItems([...routine, ...tripContextForDate(state.selectedDate)]).slice(0, 3);
  }
  return contextItemsForDate(state.selectedDate).slice(0, 3);
}

function contextItemsForDate(date) {
  return dedupeContextItems([
    ...state.schedule.filter(item => scheduleMatchesDate(item, date)),
    ...tripContextForDate(date)
  ]);
}

function tripContextForDate(date) {
  const viaticum = state.appFeed.find(item => String(item.sourceApp || '').toLowerCase().includes('viaticum'));
  if (!viaticum) return [];
  const events = getViaticumData(viaticum, date).events || [];
  const event = events.find(item => item.date === date);
  if (!event) return [];
  const place = String(event.location || '').trim();
  const title = String(event.event || event.title || '').trim();
  const status = String(event.status || '').toLowerCase();
  const away = place && !['berlin', 'home'].includes(place.toLowerCase());
  if (!away && !status.includes('booked')) return [];
  return [{
    id: `viaticum-${date}`,
    title: `Trip in progress${place ? ` · ${place}` : ''}${title ? ` · ${title}` : ''}`,
    type: 'Viaticum',
    days: '',
    startTime: '',
    endTime: '',
    area: 'Travel',
    status: 'Active',
    emoji: '🎒',
    details: 'Pulled from Viaticum for the selected date.',
    link: CONFIG.sourceApps.viaticum.url
  }];
}

function dedupeContextItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.emoji || ''}|${item.title || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterTodayTasks(tasks) {
  if (state.todayTaskFilter !== 'work') return tasks;
  return tasks.filter(isWorkTask);
}

function isWorkTask(task) {
  if (String(task.taskType || '').toLowerCase() === 'work') return true;
  const text = `${task.area || ''} ${task.source || ''} ${task.notes || ''} ${task.title || ''}`.toLowerCase();
  return text.includes('work') || text.includes('zalando') || text.includes('office') || text.includes('nike');
}

function activeEyebrow() {
  if (state.activeView === 'week') return 'This week';
  if (state.activeView === 'month') return 'This month';
  if (state.activeView === 'tasks') return 'Task list';
  return 'Today';
}

function activeTitle() {
  if (state.activeView === 'week') return 'Week';
  if (state.activeView === 'month') return formatMonth(startOfMonth(state.selectedDate));
  if (state.activeView === 'tasks') return 'Tasks';
  return formatDayName(state.selectedDate);
}

function activeDateLine() {
  if (state.activeView === 'week') {
    const start = startOfWeek(state.selectedDate);
    const end = endOfWeek(state.selectedDate);
    return `${formatLongDate(start)} → ${formatLongDate(end)}`;
  }
  if (state.activeView === 'month') return `${formatMonth(startOfMonth(state.selectedDate))}`;
  if (state.activeView === 'tasks') {
    const openCount = state.tasks.filter(task => !isDone(task)).length;
    return `${openCount} open · ${state.tasks.length} total`;
  }
  return formatLongDate(state.selectedDate);
}

function button(text, className, onClick) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = className;
  item.textContent = text;
  item.addEventListener('click', onClick);
  return item;
}

function sectionHeader(title, subtitle) {
  const wrap = document.createElement('div');
  wrap.className = 'section-title';
  wrap.innerHTML = `<div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`;
  return wrap;
}

function formatShort(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
