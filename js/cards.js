import { CONFIG } from './config.js';
import { state, setModal } from './state.js';
import { parseSectionText } from './sheetParser.js';
import { formatLongDate, formatDayName, formatShortDayName, toISODate, daysOverlap, isBetween, parseDate } from './dateUtils.js';

export function createDateCard(date, scheduleItems = []) {
  const card = el('section', 'card date-card');
  const dayName = formatDayName(date);
  card.innerHTML = `
    <div>
      <p class="eyebrow">Today</p>
      <h1>${escapeHtml(dayName)}</h1>
      <div class="date-line">${escapeHtml(formatLongDate(date))}</div>
    </div>
  `;

  const info = el('div', 'day-info-grid');
  if (!scheduleItems.length) {
    info.append(empty('No repeat schedule items for this day yet.'));
  } else {
    scheduleItems.slice(0, 4).forEach(item => {
      const chip = el('div', 'schedule-chip');
      chip.innerHTML = `<span>${escapeHtml(item.emoji || '🗓️')}</span><span>${escapeHtml(timeRange(item))}${escapeHtml(item.title)}</span>`;
      if (item.details) chip.title = item.details;
      info.append(chip);
    });
  }
  card.append(info);
  return card;
}

export function createAppCards(feedItems = []) {
  const wrap = el('section', 'card');
  wrap.append(sectionTitle('🧩 App cards', 'Fitness and Viaticum checks for this period.'));
  const list = el('div', 'card-list app-card-grid');

  const fitness = findAppItem(feedItems, 'ChrisFit') || fallbackAppItem(CONFIG.sourceApps.fitness, 'Open ChrisFit and check today\'s burn/intake.');
  const viaticum = findAppItem(feedItems, 'Viaticum') || fallbackAppItem(CONFIG.sourceApps.viaticum, 'Open Viaticum and check travel plans, paid items, maps, and links.');
  list.append(createAppCard(fitness), createAppCard(viaticum));
  wrap.append(list);
  return wrap;
}

export function createAppCard(item) {
  const card = el('article', 'card app-card');
  const sections = item.sections?.length ? item.sections : parseSectionText(item.actionText || item.payload || item.notes || '');
  const header = el('div', 'app-card-header');
  header.innerHTML = `
    <div class="app-card-title">
      <h3>${escapeHtml(sourceEmoji(item.sourceApp))} ${escapeHtml(item.title || item.sourceApp)}</h3>
      <p>${escapeHtml(item.sourceApp || 'Actarium')} · ${escapeHtml(item.date || '')}</p>
    </div>
    <span class="status-pill teal">${escapeHtml(item.severity || 'info')}</span>
  `;
  card.append(header);

  if (sections.length) {
    sections.slice(0, 4).forEach(section => card.append(createInfoSection(section.label, section.body)));
  } else {
    card.append(createInfoSection('Info', item.actionText || 'No app summary yet.'));
  }

  if (item.deepLink) {
    const actions = el('div', 'form-actions');
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
  const wrap = el('section', 'card');
  wrap.append(sectionTitle(title, subtitle));
  const list = el('div', 'card-list task-list');

  if (!tasks.length) {
    list.append(empty('No tasks here.'));
  } else {
    tasks.forEach(task => list.append(createTaskRow(task, options)));
  }

  wrap.append(list);
  return wrap;
}

export function createTaskRow(task, options = {}) {
  const row = el('article', `task-row ${isDone(task) ? 'is-done' : ''}`);
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
      <span class="status-pill ${isDone(task) ? 'done' : 'purple'}">${escapeHtml(task.status || 'Open')}</span>
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
  const wrap = el('section', 'card');
  wrap.append(sectionTitle(title, subtitle));
  const list = el('div', 'card-list');
  if (!items.length) list.append(empty('No schedule items.'));
  items.forEach(item => {
    const row = el('article', 'task-row');
    row.innerHTML = `
      <div class="logo-mark" style="width:38px;height:38px;border-radius:14px;box-shadow:none;">${escapeHtml(item.emoji || '🗓️')}</div>
      <div class="task-title">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(timeRange(item) || 'Any time')}${escapeHtml(item.area || 'General')}</p>
        ${item.details ? `<div class="task-meta"><span class="status-pill teal">${escapeHtml(item.details)}</span></div>` : ''}
      </div>
      ${item.link ? '<a class="icon-button" target="_blank" rel="noopener noreferrer" href="' + escapeAttribute(item.link) + '">🔗</a>' : '<span></span>'}
    `;
    list.append(row);
  });
  wrap.append(list);
  return wrap;
}

export function createPeriodCard(date, tasks, scheduleItems) {
  const card = el('article', 'card period-card');
  const openTasks = tasks.filter(task => !isDone(task));
  card.innerHTML = `
    <h3>${escapeHtml(formatShortDayName(date))}</h3>
    <p class="muted">${escapeHtml(formatLongDate(date))}</p>
    <div class="task-meta">
      <span class="status-pill purple">✅ ${openTasks.length} open</span>
      <span class="status-pill teal">🗓️ ${scheduleItems.length} schedule</span>
    </div>
  `;
  if (openTasks[0]) card.append(createInfoSection('Top task', openTasks[0].title));
  return card;
}

export function createInfoSection(label, body) {
  const section = el('div', 'info-section');
  section.innerHTML = `<strong>${escapeHtml(label || 'Info')}</strong><p>${linkify(escapeHtml(body || '—'))}</p>`;
  return section;
}

export function sectionTitle(title, subtitle) {
  const wrap = el('div', 'section-title');
  wrap.innerHTML = `<div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>`;
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
