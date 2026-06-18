import * as api from './api.js';
import { CONFIG } from './config.js';
import { state, setActiveView, toggleTheme, setModal, showToast } from './state.js';
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
      <div class="brand-row compact-brand-row">
        <div class="brand-lockup">
          <div class="logo-mark">✦</div>
          <div class="brand-title">
            <div class="brand-name-line">
              <span class="brand-name">${CONFIG.appName}</span>
              <span class="version-pill">${CONFIG.version}</span>
            </div>
          </div>
        </div>
        <div class="top-actions">
          <button type="button" class="pill-button quick-add-button selected-pulse" title="Create a task">➕ Add</button>
          <button type="button" class="icon-button theme-button" title="Toggle light/dark mode">${state.theme === 'light' ? '🌙' : '☀️'}</button>
        </div>
      </div>
      <div class="top-content-row">
        <div class="top-day-card">
          <div>
            <p class="eyebrow">${escapeHtml(activeEyebrow())}</p>
            <h1>${escapeHtml(activeTitle())}</h1>
            <div class="date-line">${escapeHtml(activeDateLine())}</div>
          </div>
          <div class="top-schedule" aria-label="Schedule summary"></div>
        </div>
        <nav class="nav-row" aria-label="Actarium views"></nav>
      </div>
    </div>
  `;

  top.querySelector('.theme-button').addEventListener('click', toggleTheme);
  top.querySelector('.quick-add-button').addEventListener('click', () => setModal({ type: 'task-form', taskId: null }));
  top.querySelector('.top-schedule').append(createTopScheduleChips(currentSchedule));

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
    button.addEventListener('click', () => setActiveView(view));
    nav.append(button);
  });

  return top;
}

function createView() {
  if (state.activeView === 'week') return createWeekView();
  if (state.activeView === 'month') return createMonthView();
  if (state.activeView === 'tasks') return createTasksView();
  return createTodayView();
}

function createTodayView() {
  const date = state.selectedDate;
  const todaySchedule = state.schedule.filter(item => scheduleMatchesDate(item, date));
  const todayTasks = state.tasks.filter(task => taskMatchesDate(task, date) && !isOlderOpenTask(task, date));
  const outstanding = getOutstandingTasks(date);
  const todayFeed = state.appFeed.filter(item => item.date === date || !item.date);

  const view = document.createElement('section');
  view.className = 'view-content today-view simplified-view';

  const left = document.createElement('div');
  left.className = 'view-column app-column';
  left.append(createScheduleSection('🗓️ Schedule', '', todaySchedule), createAppCards(todayFeed));

  const right = document.createElement('div');
  right.className = 'view-column task-column';
  if (outstanding.length) {
    right.append(createTaskSection('🚨 Outstanding', '', sortTasksOldestFirst(outstanding), selectionOptions('outstanding')));
  }
  right.append(createTaskSection('✅ Today tasks', '', sortTasksOldestFirst(todayTasks), selectionOptions('normal')));

  view.append(left, right);
  return view;
}

function createWeekView() {
  const start = startOfWeek(state.selectedDate);
  const end = endOfWeek(state.selectedDate);
  const weekTasks = state.tasks.filter(task => overlapsPeriod(task, start, end) && !isOlderOpenTask(task, toISODate(start)));
  const outstanding = getOutstandingTasks(toISODate(start));
  const weekSchedule = getWeekDates(start).flatMap(date => state.schedule
    .filter(item => scheduleMatchesDate(item, date))
    .map(item => ({ ...item, title: `${formatShort(date)} · ${item.title}` })));

  const view = document.createElement('section');
  view.className = 'view-content simplified-view';

  const left = document.createElement('div');
  left.className = 'view-column app-column';
  left.append(createScheduleSection('🗓️ Schedule', '', weekSchedule.slice(0, 10)), createAppCards(state.appFeed));

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
  left.append(createScheduleSection('🗓️ Schedule', '', state.schedule.filter(item => String(item.status || '').toLowerCase() !== 'inactive').slice(0, 10)), createAppCards(state.appFeed));

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
  const done = state.tasks.filter(isDone);

  if (outstanding.length) view.append(createTaskSection('🚨 Outstanding', '', sortTasksOldestFirst(outstanding), selectionOptions('outstanding')));
  view.append(createTaskSection('✅ Open tasks', '', sortTasksOldestFirst(open), selectionOptions('normal')));
  if (done.length) view.append(createTaskSection('☑️ Done', '', sortTasksOldestFirst(done), selectionOptions('done')));
  return view;
}

function selectionOptions(variant = 'normal') {
  return {
    variant,
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
    return getWeekDates(start).flatMap(date => state.schedule.filter(item => scheduleMatchesDate(item, date))).slice(0, 4);
  }
  if (state.activeView === 'month') {
    return state.schedule.filter(item => String(item.status || '').toLowerCase() !== 'inactive').slice(0, 4);
  }
  return state.schedule.filter(item => scheduleMatchesDate(item, state.selectedDate)).slice(0, 4);
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
