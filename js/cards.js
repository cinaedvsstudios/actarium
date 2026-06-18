import { CONFIG } from './config.js';
import { setModal } from './state.js';
import { parseSectionText } from './sheetParser.js';
import { formatLongDate, formatShortDayName, toISODate, daysOverlap, isBetween, parseDate } from './dateUtils.js';

export function createTopScheduleChips(scheduleItems = []) {
  const wrap = el('div', 'top-chip-row');
  if (!scheduleItems.length) {
    const chip = el('span', 'schedule-chip quiet-chip');
    chip.textContent = '🗓️ No schedule items';
    wrap.append(chip);
    return wrap;
  }

  scheduleItems.slice(0, 4).forEach(item => {
    const chip = el('span', 'schedule-chip');
    chip.innerHTML = `<span>${escapeHtml(item.emoji || '🗓️')}</span><span>${escapeHtml(timeRange(item))}${escapeHtml(item.title)}</span>`;
    if (item.details) chip.title = item.details;
    wrap.append(chip);
  });
  return wrap;
}

export function createAppCards(feedItems = []) {
  const wrap = el('section', 'app-card-grid slim-app-card-grid');
  const fitness = findAppItem(feedItems, 'ChrisFit') || fallbackAppItem(CONFIG.sourceApps.fitness, 'Open ChrisFit and check today\'s burn/intake.');
  const viaticum = findAppItem(feedItems, 'Viaticum') || fallbackAppItem(CONFIG.sourceApps.viaticum, 'Open Viaticum and check travel plans, paid items, maps, and links.');
  wrap.append(createAppCard(fitness), createAppCard(viaticum));
  return wrap;
}

export function createAppCard(item) {
  const sourceClass = sourceAccentClass(item.sourceApp);
  const card = el('article', `card app-card card-accent ${sourceClass}`);
  const sections = item.sections?.length ? item.sections : parseSectionText(item.actionText || item.payload || item.notes || '');
  const header = el('div', 'app-card-header');
  header.innerHTML = `
    <div class="app-card-title">
      <h3>${escapeHtml(sourceEmoji(item.sourceApp))} ${escapeHtml(item.sourceApp || item.title || 'App')}</h3>
    </div>
    <span class="status-pill ${sourceClass}">${escapeHtml(item.severity || 'info')}</span>
  `;
  card.append(header);

  if (sections.length) {
    sections.slice(0, 3).forEach(section => card.append(createInfoSection(section.label, section.body, sourceClass)));
  } else {
    card.append(createInfoSection('Info', item.actionText || 'No app summary yet.', sourceClass));
  }

  if (item.deepLink) {
    const actions = el('div', 'form-actions compact-actions');
    const link = el('a', 'secondary-button');
    link.href = item.deepLink;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '🔗 Open';
    actions.append(link);
    card.append(actions);
  }

  return card;
}

export function createTaskSection(title, subtitle, tasks, options = {}) {
  const variant = options.variant || 'normal';
  const wrap = el('section', `card task-section card-accent ${variant === 'outstanding' ? 'outstanding' : 'tasks'}`);
  wrap.append(sectionTitle(title, subtitle, options.actions));
  const list = el('div', 'card-list task-list');

  if (!tasks.length) {
    list.append(empty(variant === 'outstanding' ? 'Nothing outstanding.' : 'No tasks here.'));
  } else {
    tasks.forEach(task => list.append(createTaskRow(task, options)));
  }

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
      <h3>${escapeHtml(taskEmoji(task))} ${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.area || 'General')} · ${escapeHtml(dateSummary(task))}</p>
    </div>
    <div class="task-meta">
      <span class="status-pill ${isDone(task) ? 'done' : variant === 'outstanding' ? 'outstanding' : 'tasks'}">${escapeHtml(task.status || 'Open')}</span>
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
        <p>${escapeHtml(timeRange(item) || 'Any time')}${escapeHtml(item.area || 'General')}</p>
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

export function sectionTitle(title, subtitle, actions = []) {
  const wrap = el('div', 'section-title');
  const text = el('div', 'section-title-text');
  text.innerHTML = `<h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}`;
  wrap.append(text);
  if (actions.length) {
    const actionWrap = el('div', 'section-actions');
    actions.forEach(action => actionWrap.append(action));
    wrap.append(actionWrap);
  }
  return wrap;
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
  const source = String(task.source || '').toLowerCase();
  const area = String(task.area || '').toLowerCase();
  if (source.includes('viaticum') || area.includes('travel')) return '🎒';
  if (source.includes('chrisfit') || area.includes('fitness')) return '🥦';
  if (area.includes('apps')) return '🛠️';
  return '✅';
}

function dateSummary(task) {
  const start = task.startDate || task.dueDate;
  const end = task.endDate || task.dueDate;
  if (!start) return 'No date';
  if (!end || start === end) return start;
  return `${start} → ${end}`;
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
