import { CONFIG } from './config.js';
import { setModal } from './state.js';
import { parseSectionText } from './sheetParser.js';
import {
  addDays,
  endOfMonth,
  formatLongDate,
  formatMonth,
  formatShortDayName,
  getWeekDates,
  isBetween,
  parseDate,
  startOfMonth,
  startOfWeek,
  toISODate,
  daysOverlap
} from './dateUtils.js';

export function createTopScheduleChips(scheduleItems = []) {
  const wrap = el('div', 'top-chip-row');
  if (!scheduleItems.length) return wrap;

  scheduleItems.slice(0, 3).forEach(item => {
    const chip = el('span', 'schedule-chip');
    chip.innerHTML = `<span>${escapeHtml(item.emoji || '🧭')}</span><span>${escapeHtml(contextLabel(item))}</span>`;
    if (item.details) chip.title = item.details;
    wrap.append(chip);
  });
  return wrap;
}

export function createAppCards(feedItems = [], period = 'today', selectedDate = toISODate(new Date())) {
  const wrap = el('section', 'app-card-grid slim-app-card-grid');
  const fitness = findAppItem(feedItems, 'ChrisFit') || fallbackAppItem(CONFIG.sourceApps.fitness, 'Open ChrisFit and check today\'s burn/intake.');
  const viaticum = findAppItem(feedItems, 'Viaticum') || fallbackAppItem(CONFIG.sourceApps.viaticum, 'Review upcoming plans and paid/unpaid notes.');
  wrap.append(createFitnessCard(fitness), createViaticumCard(viaticum, period, selectedDate));
  return wrap;
}

export function createAppCard(item) {
  if (String(item.sourceApp || '').toLowerCase().includes('chrisfit')) return createFitnessCard(item);
  if (String(item.sourceApp || '').toLowerCase().includes('viaticum')) return createViaticumCard(item, 'today', toISODate(new Date()));

  const sourceClass = sourceAccentClass(item.sourceApp);
  const card = el('article', `card app-card card-accent ${sourceClass}`);
  const sections = item.sections?.length ? item.sections : parseSectionText(item.actionText || item.payload || item.notes || '');
  card.append(appCardHeader(sourceEmoji(item.sourceApp), item.sourceApp || item.title || 'App', item.deepLink, sourceClass));

  if (sections.length) sections.slice(0, 3).forEach(section => card.append(createInfoSection(section.label, section.body, sourceClass)));
  else card.append(createInfoSection('Info', item.actionText || 'No app summary yet.', sourceClass));

  return card;
}

function createFitnessCard(item) {
  const metrics = extractFitnessMetrics(item);
  const card = el('article', 'card app-card card-accent fitness fitness-card');
  card.append(appCardHeader(CONFIG.sourceApps.fitness.emoji, 'ChrisFit', item.deepLink || CONFIG.sourceApps.fitness.url, 'fitness'));

  const grid = el('div', 'fitness-summary-grid');
  grid.append(
    createMetricPanel('Daily Summary', [
      ['🥦', 'Food', metrics.dailyFood],
      ['🔥', 'Burn', metrics.dailyBurn],
      ['📉', 'Deficit', metrics.dailyDeficit]
    ]),
    createMetricPanel('Weekly Summary', [
      ['🥦', 'Food', metrics.weeklyFood],
      ['🔥', 'Burn', metrics.weeklyBurn],
      ['📉', 'Deficit', metrics.weeklyDeficit]
    ])
  );
  card.append(grid, createWeightBar(metrics));
  return card;
}

function createViaticumCard(item, period, selectedDate) {
  const card = el('article', 'card app-card card-accent viaticum viaticum-card');
  card.append(appCardHeader(CONFIG.sourceApps.viaticum.emoji, 'Viaticum', item.deepLink || CONFIG.sourceApps.viaticum.url, 'viaticum'));

  const data = getViaticumData(item, selectedDate);
  if (period === 'month') card.append(createViaticumMonth(data.events, selectedDate));
  else if (period === 'week') card.append(createViaticumSchedule(data.events, startOfWeek(selectedDate), addDays(startOfWeek(selectedDate), 6)));
  else card.append(createViaticumDay(data.events, selectedDate));
  return card;
}

function appCardHeader(emoji, title, url, accentClass) {
  const header = el('div', 'app-card-header');
  const titleWrap = el('div', 'app-card-title');
  titleWrap.innerHTML = `<h3>${escapeHtml(emoji)} ${escapeHtml(title)}</h3>`;
  header.append(titleWrap);
  if (url) {
    const link = el('a', `mini-open-link ${accentClass}`);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '🔗 Open';
    header.append(link);
  }
  return header;
}

function createMetricPanel(title, rows) {
  const panel = el('div', 'metric-panel');
  panel.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
  rows.forEach(([emoji, label, value]) => {
    const row = el('div', 'metric-row');
    row.innerHTML = `<span>${escapeHtml(emoji)} ${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    panel.append(row);
  });
  return panel;
}

function createWeightBar(metrics) {
  const panel = el('div', 'weight-bar');
  const bmi = metrics.bmi ? `<span>${escapeHtml(metrics.bmi)}</span>` : '';
  const recorded = metrics.recorded ? `<span>${escapeHtml(metrics.recorded)}</span>` : '';
  panel.innerHTML = `
    <div class="weight-bar-label">⚖️ Weight</div>
    <strong>${escapeHtml(metrics.weight)}</strong>
    <div class="weight-bar-meta">${bmi}${recorded}</div>
  `;
  return panel;
}

function createViaticumDay(events, selectedDate) {
  const event = events.find(item => item.date === selectedDate) || null;
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  const weeklyEvents = events
    .filter(item => item.date >= toISODate(weekStart) && item.date <= toISODate(weekEnd))
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextEvent = weeklyEvents.find(item => item.date >= selectedDate) || weeklyEvents[0] || null;
  const wrap = el('div', 'viaticum-day-card viaticum-day-summary');

  const grid = el('div', 'fitness-summary-grid viaticum-summary-grid');
  grid.append(
    createMiniSummaryPanel('Daily Summary', [
      ['🤔', 'Status', event?.status || 'Unsure'],
      ['🧸', 'Location', event?.location || '—'],
      ['🎒', 'Event', event?.event || event?.title || 'Check Viaticum']
    ]),
    createMiniSummaryPanel('Weekly Summary', [
      ['🗓️', 'Items', String(weeklyEvents.length)],
      ['📍', 'Where', weekPlaces(weeklyEvents) || '—'],
      ['➡️', 'Next', nextEvent ? `${shortDateLabel(nextEvent.date)} · ${nextEvent.event || nextEvent.location || 'Plan'}` : '—']
    ])
  );
  wrap.append(grid);

  const scheduleText = event?.schedule || event?.details || 'Open Viaticum and check schedule, maps, paid/unpaid, and codes.';
  wrap.append(createInfoSection('Schedule', scheduleText, 'viaticum'));
  return wrap;
}

function createMiniSummaryPanel(title, rows) {
  const panel = el('div', 'metric-panel viaticum-mini-panel');
  panel.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
  rows.forEach(([emoji, label, value]) => {
    const row = el('div', 'metric-row');
    row.innerHTML = `<span>${escapeHtml(emoji)} ${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`;
    panel.append(row);
  });
  return panel;
}

function weekPlaces(events) {
  const places = [...new Set(events.map(item => item.location).filter(Boolean))];
  return places.slice(0, 2).join(', ') + (places.length > 2 ? ' +' + (places.length - 2) : '');
}

function shortDateLabel(iso) {
  const date = parseDate(iso);
  if (!date) return iso || '';
  return `${date.getDate()} ${formatShortDayName(date)}`;
}

function createViaticumSchedule(events, startDate, endDate) {
  const startIso = toISODate(startDate);
  const endIso = toISODate(endDate);
  const rows = events.filter(item => item.date >= startIso && item.date <= endIso).sort((a, b) => a.date.localeCompare(b.date));
  const wrap = el('div', 'viaticum-schedule-card');
  wrap.innerHTML = '<div class="viaticum-strip-title">Schedule</div>';
  const table = el('div', 'viaticum-schedule-table');
  table.innerHTML = '<span>Date</span><span>Location</span><span>Event</span>';
  if (!rows.length) {
    const none = el('p', 'empty-state compact-empty');
    none.textContent = 'No Viaticum items for this week.';
    wrap.append(none);
    return wrap;
  }
  rows.forEach(item => {
    table.append(cell(`${String(parseDate(item.date)?.getDate() || '').padStart(2, '0')} ${item.statusEmoji || '🤔'}`));
    table.append(cell(`${item.locationEmoji || '📍'} ${item.location || '—'}`));
    table.append(cell(`${item.eventEmoji || '🎒'} ${item.event || item.title || 'Plan'}`));
  });
  wrap.append(table);
  return wrap;
}

function createViaticumMonth(events, selectedDate) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const selectedIso = toISODate(selectedDate);
  const eventMap = new Map(events.map(item => [item.date, item]));
  const days = [];
  const firstDay = monthStart.getDay() || 7;
  for (let i = 1; i < firstDay; i += 1) days.push(null);
  for (let day = 1; day <= monthEnd.getDate(); day += 1) days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));

  const wrap = el('div', 'viaticum-month-card');
  wrap.innerHTML = `<div class="viaticum-month-title">‹ ${escapeHtml(formatMonth(selectedDate))} ›</div>`;
  const grid = el('div', 'viaticum-calendar-grid');
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => grid.append(cell(day, 'calendar-head')));
  days.forEach(date => {
    const tile = el('div', `calendar-cell ${date ? '' : 'is-empty'} ${date && toISODate(date) === selectedIso ? 'is-selected' : ''}`);
    if (date) {
      const iso = toISODate(date);
      const event = eventMap.get(iso);
      tile.innerHTML = `<strong>${date.getDate()}</strong><span>${event ? (event.eventEmoji || event.statusEmoji || '🎒') : ''}</span>`;
    }
    grid.append(tile);
  });
  wrap.append(grid);
  return wrap;
}

export function getViaticumData(item, selectedDate) {
  const payload = parseJsonMaybe(item.payload);
  if (payload?.events && Array.isArray(payload.events)) return { events: payload.events.map(normaliseViaticumEvent) };
  return { events: demoViaticumEvents(selectedDate) };
}

function normaliseViaticumEvent(event) {
  return {
    date: toISODate(event.date),
    status: event.status || 'Unsure',
    statusEmoji: event.statusEmoji || event.emoji || '🤔',
    location: event.location || '',
    locationEmoji: event.locationEmoji || '📍',
    event: event.event || event.title || '',
    eventEmoji: event.eventEmoji || '🎒',
    schedule: event.schedule || event.details || ''
  };
}

function demoViaticumEvents(selectedDate) {
  const start = startOfMonth(selectedDate);
  return [
    { date: toISODate(new Date(start.getFullYear(), start.getMonth(), 5)), status: 'Plans', statusEmoji: '🤔', location: 'Berlin', locationEmoji: '🧸', event: 'Lab dance', eventEmoji: '🪩', schedule: 'Lab dance check / possible night plan.' },
    { date: toISODate(new Date(start.getFullYear(), start.getMonth(), 6)), status: 'Unsure', statusEmoji: '🤔', location: 'Berlin', locationEmoji: '🧸', event: 'Boyberry', eventEmoji: '🍓', schedule: 'Boyberry on sat maybe.' },
    { date: toISODate(new Date(start.getFullYear(), start.getMonth(), 12)), status: 'Unsure', statusEmoji: '🤔', location: 'Overload, recover', locationEmoji: '🧠', event: 'Unsure', eventEmoji: '' },
    { date: toISODate(new Date(start.getFullYear(), start.getMonth(), 13)), status: 'Booked', statusEmoji: '🛫', location: 'Ibiza', locationEmoji: '🍒', event: 'Ibiza pride', eventEmoji: '🏝️' },
    { date: toISODate(new Date(start.getFullYear(), start.getMonth(), 14)), status: 'Booked', statusEmoji: '🛫', location: 'Ljubljana', locationEmoji: '🐉', event: 'Ljubljana Pride', eventEmoji: '🏳️‍🌈' },
    { date: toISODate(new Date(start.getFullYear(), start.getMonth(), 19)), status: 'Plans', statusEmoji: '🤔', location: 'Berlin', locationEmoji: '🧸', event: 'Lab daddytwink', eventEmoji: '👴🏻' },
    { date: toISODate(selectedDate), status: 'Unsure', statusEmoji: '🤔', location: 'Berlin', locationEmoji: '🧸', event: 'Check Viaticum', eventEmoji: '🎒', schedule: 'Open Viaticum and check schedule, maps, paid/unpaid, and codes.' }
  ].map(normaliseViaticumEvent);
}

function cell(text, className = '') {
  const span = el('span', className);
  span.textContent = text;
  return span;
}

function extractFitnessMetrics(item) {
  const defaults = {
    dailyFood: '0 / 1500',
    dailyBurn: '0 / 2500',
    dailyDeficit: '0 / -500',
    weeklyFood: '— / 10500',
    weeklyBurn: '— / 17500',
    weeklyDeficit: '— / -3500',
    weight: '— kg',
    bmi: '',
    recorded: ''
  };

  const parsed = parseJsonMaybe(item.payload);
  if (!parsed) return defaults;

  return {
    dailyFood: firstValue(parsed.dailyFood, parsed.daily?.food, defaults.dailyFood),
    dailyBurn: firstValue(parsed.dailyBurn, parsed.daily?.burn, defaults.dailyBurn),
    dailyDeficit: firstValue(parsed.dailyDeficit, parsed.daily?.deficit, defaults.dailyDeficit),
    weeklyFood: firstValue(parsed.weeklyFood, parsed.weekly?.food, defaults.weeklyFood),
    weeklyBurn: firstValue(parsed.weeklyBurn, parsed.weekly?.burn, defaults.weeklyBurn),
    weeklyDeficit: firstValue(parsed.weeklyDeficit, parsed.weekly?.deficit, defaults.weeklyDeficit),
    weight: firstValue(parsed.weight, parsed.weightKg ? `${parsed.weightKg} kg` : '', defaults.weight),
    bmi: firstValue(parsed.bmi, parsed.weightBmi, defaults.bmi),
    recorded: firstValue(parsed.recorded, parsed.recordedDate, defaults.recorded)
  };
}

function parseJsonMaybe(value) {
  try {
    const raw = String(value || '').trim();
    if (!raw || !raw.startsWith('{')) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function firstValue(...values) {
  const found = values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
  return found === undefined ? '' : String(found);
}

export function createTaskSection(title, subtitle, tasks, options = {}) {
  const variant = options.variant || 'normal';
  const accent = variant === 'outstanding' ? 'outstanding' : variant === 'reminders' ? 'reminders' : 'tasks';
  const wrap = el('section', `card task-section card-accent ${accent}`);
  wrap.append(sectionTitle(title, subtitle, options.actions, options.filter));
  const list = el('div', 'card-list task-list');

  if (!tasks.length) list.append(empty(variant === 'outstanding' ? 'Nothing outstanding.' : variant === 'reminders' ? 'No reminders here.' : 'No tasks here.'));
  else tasks.forEach(task => list.append(createTaskRow(task, options)));

  wrap.append(list);
  return wrap;
}

export function createTaskRow(task, options = {}) {
  const variant = options.variant || 'normal';
  const row = el('article', `task-row task-row-${variant} ${isDone(task) ? 'is-done' : ''}`);
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-check';
  checkbox.checked = Boolean(options.selectedIds?.has(String(task.id)));
  checkbox.title = 'Select task';
  checkbox.addEventListener('change', event => options.onSelect?.(task.id, event.target.checked));

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'task-open-button';
  openButton.addEventListener('click', () => setModal({ type: 'task-detail', taskId: task.id }));
  openButton.innerHTML = `
    <div class="task-title">
      <h3>${isDone(task) ? '✅ ' : ''}${escapeHtml(taskEmoji(task))} ${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.project || 'General')} · ${escapeHtml(dateSummary(task))}</p>
    </div>
    <div class="task-meta">
      <span class="status-pill ${isDone(task) ? 'done' : variant === 'outstanding' ? 'outstanding' : 'tasks'}">${isDone(task) ? '✅ Done' : escapeHtml(task.status || 'Open')}</span>
      <span class="status-pill ${priorityClass(task.priority)}">${escapeHtml(task.priority || 'Normal')}</span>
      ${task.recurrence && task.recurrence !== 'None' ? `<span class="status-pill teal">🔁 ${escapeHtml(task.recurrence)}</span>` : ''}
    </div>
  `;

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'icon-button';
  more.title = 'Open task';
  more.textContent = '🔎';
  more.addEventListener('click', () => setModal({ type: 'task-detail', taskId: task.id }));

  row.append(checkbox, openButton, more);
  return row;
}

export function createScheduleSection(title, subtitle, items) {
  const wrap = el('section', 'card card-accent schedule');
  wrap.append(sectionTitle(title, subtitle));
  const list = el('div', 'card-list');
  if (!items.length) list.append(empty('No schedule items.'));
  items.forEach(item => {
    const row = el('article', 'task-row task-row-schedule');
    row.innerHTML = `
      <div class="schedule-mark">${escapeHtml(item.emoji || '🗓️')}</div>
      <div class="task-title">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(timeRange(item) || 'Any time')}${escapeHtml(item.project || 'General')}</p>
        ${item.details ? `<div class="task-meta"><span class="status-pill schedule-detail">${escapeHtml(item.details)}</span></div>` : ''}
      </div>
      ${item.link ? '<a class="icon-button" target="_blank" rel="noopener noreferrer" href="' + escapeAttribute(item.link) + '">🔗</a>' : '<span></span>'}
    `;
    list.append(row);
  });
  wrap.append(list);
  return wrap;
}

export function createPeriodCard(date, tasks, scheduleItems) {
  const card = el('article', 'card period-card card-accent tasks');
  const openTasks = tasks.filter(task => !isDone(task));
  card.innerHTML = `
    <h3>${escapeHtml(formatShortDayName(date))}</h3>
    <p class="muted">${escapeHtml(formatLongDate(date))}</p>
    <div class="task-meta">
      <span class="status-pill tasks">✅ ${openTasks.length} open</span>
      <span class="status-pill teal">🗓️ ${scheduleItems.length} schedule</span>
    </div>
  `;
  if (openTasks[0]) card.append(createInfoSection('Top task', openTasks[0].title, 'tasks'));
  return card;
}

export function createInfoSection(label, body, accentClass = '') {
  const section = el('div', `info-section ${accentClass ? `info-${accentClass}` : ''}`);
  section.innerHTML = `<strong>${escapeHtml(label || 'Info')}</strong><p>${linkify(escapeHtml(body || '—'))}</p>`;
  return section;
}

export function sectionTitle(title, subtitle, actions = [], filter = null) {
  const wrap = el('div', 'section-title');
  const text = el('div', 'section-title-text');
  text.innerHTML = `<h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}`;
  wrap.append(text);

  if (filter || actions.length) {
    const actionWrap = el('div', 'section-actions');
    if (filter) actionWrap.append(createFilterToggle(filter));
    actions.forEach(action => actionWrap.append(action));
    wrap.append(actionWrap);
  }
  return wrap;
}

function createFilterToggle(filter) {
  const group = el('div', 'task-filter-toggle');
  (filter.items || []).forEach(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-button ${String(filter.value) === String(value) ? 'is-active' : ''}`;
    button.textContent = label;
    button.addEventListener('click', () => filter.onChange?.(value));
    group.append(button);
  });
  return group;
}

export function empty(message) {
  const item = el('p', 'empty-state');
  item.textContent = message;
  return item;
}

export function taskMatchesDate(task, date) {
  if (task.recurrence && task.recurrence !== 'None') return recurringTaskMatches(task, date);
  return daysOverlap(task.startDate || task.dueDate, task.endDate || task.dueDate, date, date);
}

export function scheduleMatchesDate(item, date) {
  if (!item || String(item.status || '').toLowerCase() === 'inactive') return false;
  if (item.startDate && parseDate(date) < parseDate(item.startDate)) return false;
  if (item.endDate && parseDate(date) > parseDate(item.endDate)) return false;
  const days = String(item.days || '').split(',').map(day => day.trim().slice(0, 3).toLowerCase()).filter(Boolean);
  if (!days.length) return true;
  return days.includes(formatShortDayName(date).toLowerCase());
}

export function isDone(task) {
  return String(task.status || '').toLowerCase() === 'done';
}

export function isArchived(task) {
  const status = String(task.status || '').toLowerCase();
  return status === 'done' || status === 'cancelled' || status === 'canceled' || status === 'deleted' || Boolean(task.completedAt);
}

function recurringTaskMatches(task, date) {
  const target = parseDate(date);
  const start = parseDate(task.startDate || task.dueDate);
  if (!target || !start || target < start) return false;
  if (task.repeatUntil && target > parseDate(task.repeatUntil)) return false;
  const recurrence = String(task.recurrence || '').toLowerCase();
  if (recurrence === 'daily') return true;
  if (recurrence === 'weekly') return target.getDay() === start.getDay();
  if (recurrence === 'monthly') return target.getDate() === start.getDate();
  return isBetween(date, task.startDate || task.dueDate, task.endDate || task.dueDate);
}

function findAppItem(items, sourceName) {
  return items.find(item => String(item.sourceApp || '').toLowerCase().includes(sourceName.toLowerCase()));
}

function fallbackAppItem(app, actionText) {
  return { sourceApp: app.name, title: app.name, date: toISODate(new Date()), severity: 'open', actionText: `Info:\n${actionText}`, deepLink: app.url };
}

function sourceAccentClass(source = '') {
  const value = source.toLowerCase();
  if (value.includes('chrisfit')) return 'fitness';
  if (value.includes('viaticum')) return 'viaticum';
  return 'tasks';
}

function sourceEmoji(source = '') {
  if (source.toLowerCase().includes('chrisfit')) return CONFIG.sourceApps.fitness.emoji;
  if (source.toLowerCase().includes('viaticum')) return CONFIG.sourceApps.viaticum.emoji;
  return '🧩';
}

function taskEmoji(task) {
  if (String(task.taskType || '').toLowerCase() === 'work') return '💼';
  const source = String(task.source || '').toLowerCase();
  const project = String(task.project || '').toLowerCase();
  if (source.includes('viaticum') || project.includes('travel')) return '🎒';
  if (source.includes('chrisfit') || project.includes('fitness')) return '🥦';
  if (project.includes('apps')) return '🛠️';
  return '✅';
}

function dateSummary(task) {
  const start = task.startDate || task.dueDate;
  const end = task.endDate || task.dueDate;
  if (!start) return 'No date';
  if (!end || start === end) return start;
  return `${start} → ${end}`;
}

function contextLabel(item) {
  const title = String(item?.title || '').trim();
  const time = timeRange(item).trim();
  return time ? `${time}${title}` : title;
}

function timeRange(item) {
  if (item.startTime && item.endTime) return `${item.startTime}–${item.endTime} · `;
  if (item.startTime) return `${item.startTime} · `;
  return '';
}

function priorityClass(priority = '') {
  const value = String(priority).toLowerCase();
  if (value.includes('urgent') || value.includes('high')) return 'danger';
  if (value.includes('low')) return 'done';
  return 'warn';
}

function el(tag, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function linkify(value) {
  return String(value).replace(/(https?:\/\/[^\s<]+)/g, '<a target="_blank" rel="noopener noreferrer" href="$1">$1</a>');
}
