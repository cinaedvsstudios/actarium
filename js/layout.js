import * as api from './api.js';
import { CONFIG } from './config.js';
import { state, setActiveView, toggleTheme, setModal, showToast } from './state.js';
import { addDays, endOfMonth, endOfWeek, formatLongDate, formatMonth, getWeekDates, startOfMonth, startOfWeek, toISODate } from './dateUtils.js';
import { createDateCard, createAppCards, createTaskSection, createScheduleSection, createPeriodCard, taskMatchesDate, scheduleMatchesDate, isDone } from './cards.js';
import { renderModal } from './forms.js';

let selectedTaskIds = new Set();

export function render() {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = '';
  const shell = document.createElement('main');
  shell.className = 'app-shell';
  shell.append(createTopBar(), createView());
  root.append(shell, createBottomActions());

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
  const top = document.createElement('header');
  top.className = 'top-bar';
  top.innerHTML = `
    <div class="brand-row">
      <div class="brand-lockup">
        <div class="logo-mark">📋</div>
        <div class="brand-title">
          <h1>${CONFIG.appName}</h1>
          <p>${state.sync.message || 'Weekly control panel'}</p>
        </div>
      </div>
      <button type="button" class="icon-button theme-button" title="Toggle light/dark mode">${state.theme === 'light' ? '🌙' : '☀️'}</button>
    </div>
    <nav class="nav-row" aria-label="Actarium views"></nav>
  `;

  top.querySelector('.theme-button').addEventListener('click', toggleTheme);
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
  const todayTasks = state.tasks.filter(task => taskMatchesDate(task, date));
  const todayFeed = state.appFeed.filter(item => item.date === date || !item.date);

  const view = document.createElement('section');
  view.className = 'view-content today-view';
  view.append(createDateCard(date, todaySchedule));

  const left = document.createElement('div');
  left.className = 'view-column';
  left.append(createTaskSection('✅ Today tasks', 'Click a task to open details, or tick several and mark them done.', sortTasks(todayTasks), selectionOptions()));

  const right = document.createElement('div');
  right.className = 'view-column';
  right.append(createAppCards(todayFeed), createScheduleSection('🗓️ Today schedule', 'Repeatable things from the Schedule tab.', todaySchedule));
  view.append(left, right);
  return view;
}

function createWeekView() {
  const start = startOfWeek(state.selectedDate);
  const end = endOfWeek(state.selectedDate);
  const weekTasks = state.tasks.filter(task => overlapsPeriod(task, start, end));
  const weekSchedule = getWeekDates(start).flatMap(date => state.schedule.filter(item => scheduleMatchesDate(item, date)).map(item => ({ ...item, title: `${formatShort(date)} · ${item.title}` })));

  const view = document.createElement('section');
  view.className = 'view-content';
  const hero = document.createElement('section');
  hero.className = 'card date-card';
  hero.innerHTML = `<p class="eyebrow">This week</p><h1>Week</h1><div class="date-line">${formatLongDate(start)} → ${formatLongDate(end)}</div>`;
  view.append(hero);

  const left = document.createElement('div');
  left.className = 'view-column';
  left.append(createTaskSection('✅ Week tasks', `${weekTasks.filter(task => !isDone(task)).length} open tasks this week.`, sortTasks(weekTasks), selectionOptions()));

  const right = document.createElement('div');
  right.className = 'view-column';
  right.append(createAppCards(state.appFeed), createScheduleSection('🗓️ Week schedule', 'Repeatable schedule items grouped into this week.', weekSchedule.slice(0, 10)));

  const grid = document.createElement('section');
  grid.className = 'card';
  grid.append(sectionHeader('📆 Week at a glance', 'One simple card per day.'));
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
  const monthTasks = state.tasks.filter(task => overlapsPeriod(task, start, end));
  const sampleDates = Array.from({ length: Math.min(12, end.getDate()) }, (_, index) => addDays(start, index));

  const view = document.createElement('section');
  view.className = 'view-content';
  const hero = document.createElement('section');
  hero.className = 'card date-card';
  hero.innerHTML = `<p class="eyebrow">This month</p><h1>Month</h1><div class="date-line">${formatMonth(start)}</div>`;
  view.append(hero);

  const left = document.createElement('div');
  left.className = 'view-column';
  left.append(createTaskSection('✅ Month tasks', `${monthTasks.filter(task => !isDone(task)).length} open tasks this month.`, sortTasks(monthTasks), selectionOptions()));

  const right = document.createElement('div');
  right.className = 'view-column';
  right.append(createAppCards(state.appFeed), createScheduleSection('🗓️ Month schedule', 'Active repeatable schedule items.', state.schedule.filter(item => String(item.status || '').toLowerCase() !== 'inactive').slice(0, 10)));

  const grid = document.createElement('section');
  grid.className = 'card';
  grid.append(sectionHeader('🌘 Month preview', 'First part of the month shown as simple cards.'));
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
  view.className = 'view-content';
  const hero = document.createElement('section');
  hero.className = 'card date-card';
  const openCount = state.tasks.filter(task => !isDone(task)).length;
  hero.innerHTML = `<p class="eyebrow">Task list</p><h1>Tasks</h1><div class="date-line">${openCount} open · ${state.tasks.length} total</div>`;
  view.append(hero);

  const all = createTaskSection('✅ All tasks', 'Tick one or more, mark done, or click into the full editor.', sortTasks(state.tasks), selectionOptions());
  const actions = document.createElement('div');
  actions.className = 'bulk-actions';
  actions.append(
    button('✅ Mark selected done', 'secondary-button', () => markSelectedDone()),
    button('➕ New task', 'primary-button', () => setModal({ type: 'task-form', taskId: null }))
  );
  all.append(actions);
  view.append(all);
  return view;
}

function createBottomActions() {
  const wrap = document.createElement('div');
  wrap.className = 'bottom-actions';
  const inner = document.createElement('div');
  inner.className = 'bottom-actions-inner';
  inner.append(
    button('➕ New task', 'primary-button selected-pulse', () => setModal({ type: 'task-form', taskId: null })),
    button('✅ Done selected', 'secondary-button', () => markSelectedDone())
  );
  wrap.append(inner);
  return wrap;
}

function selectionOptions() {
  return {
    selectedIds: selectedTaskIds,
    onSelect: (id, selected) => {
      if (selected) selectedTaskIds.add(String(id));
      else selectedTaskIds.delete(String(id));
      render();
    }
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

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const doneDiff = Number(isDone(a)) - Number(isDone(b));
    if (doneDiff) return doneDiff;
    return String(a.startDate || a.dueDate).localeCompare(String(b.startDate || b.dueDate)) || priorityRank(b.priority) - priorityRank(a.priority);
  });
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
  wrap.innerHTML = `<div><h2>${title}</h2><p>${subtitle}</p></div>`;
  return wrap;
}

function formatShort(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}
