import { formatDisplayDate, classifyDueDate } from './dateUtils.js';

export function summaryTile(label, value, tone = 'info') {
  return element('div', `summary-tile summary-${tone}`, `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`);
}

export function taskCard(task, onDone) {
  const dueClass = classifyDueDate(task.dueDate);
  const card = element('article', 'item-card');
  card.innerHTML = `
    <div class="item-top">
      <div class="item-title">
        <small>${escapeHtml(task.source)} · ${escapeHtml(task.area)}</small>
        <strong>${escapeHtml(task.title)}</strong>
      </div>
      ${pill(task.priority, priorityTone(task.priority))}
    </div>
    ${task.notes ? `<p>${escapeHtml(task.notes)}</p>` : ''}
    <div class="item-meta">
      ${pill(task.status, statusTone(task.status))}
      ${task.dueDate ? pill(formatDisplayDate(task.dueDate), dueTone(dueClass)) : pill('No due date', 'info')}
      ${task.energy ? pill(`${task.energy} energy`, 'info') : ''}
    </div>
    <div class="item-actions">
      ${task.link ? `<a class="ghost-button" href="${escapeAttribute(task.link)}" target="_blank" rel="noreferrer">Open link</a>` : ''}
      <button class="primary-button" type="button" data-action="done" data-id="${escapeAttribute(task.id)}">Mark done</button>
    </div>
  `;
  card.querySelector('[data-action="done"]')?.addEventListener('click', () => onDone(task.id));
  return card;
}

export function linkCard(link) {
  const card = element('article', 'item-card');
  card.innerHTML = `
    <div class="item-top">
      <div class="item-title">
        <small>${escapeHtml(link.category)}</small>
        <strong>${escapeHtml(link.title)}</strong>
      </div>
      ${pill(link.status, statusTone(link.status))}
    </div>
    ${link.whySaved ? `<p>${escapeHtml(link.whySaved)}</p>` : ''}
    <div class="item-meta">
      ${link.reviewBy ? pill(`Review ${formatDisplayDate(link.reviewBy)}`, 'warning') : pill('Saved link', 'info')}
    </div>
    <div class="item-actions">
      ${link.url ? `<a class="primary-button" href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">Open</a>` : ''}
    </div>
  `;
  return card;
}

export function ideaCard(idea) {
  const card = element('article', 'item-card');
  card.innerHTML = `
    <div class="item-top">
      <div class="item-title">
        <small>${escapeHtml(idea.project)} · ${escapeHtml(idea.category)}</small>
        <strong>${escapeHtml(idea.idea)}</strong>
      </div>
      ${pill(idea.status, statusTone(idea.status))}
    </div>
    ${idea.nextAction ? `<p>${escapeHtml(idea.nextAction)}</p>` : '<p>No next action yet.</p>'}
    <div class="item-meta">
      ${idea.month ? pill(idea.month, 'info') : ''}
    </div>
  `;
  return card;
}

export function feedCard(item) {
  const card = element('article', 'item-card');
  const sections = Object.entries(item.sections || {})
    .map(([label, value]) => sectionBox(label, value))
    .join('');
  card.innerHTML = `
    <div class="item-top">
      <div class="item-title">
        <small>${escapeHtml(item.sourceApp)} · ${escapeHtml(item.type)}</small>
        <strong>${escapeHtml(item.title)}</strong>
      </div>
      ${pill(item.severity, severityTone(item.severity))}
    </div>
    ${item.actionText ? `<p>${escapeHtml(item.actionText.split('\n')[0])}</p>` : ''}
    ${sections}
    <div class="item-meta">
      ${item.date ? pill(formatDisplayDate(item.date), 'info') : ''}
    </div>
    <div class="item-actions">
      ${item.deepLink ? `<a class="ghost-button" href="${escapeAttribute(item.deepLink)}" target="_blank" rel="noreferrer">Open source</a>` : ''}
    </div>
  `;
  return card;
}

export function emptyState(message) {
  return element('div', 'empty-state', escapeHtml(message));
}

export function listCard({ title, subtitle, children, emptyMessage }) {
  const card = element('section', 'card');
  card.innerHTML = `
    <div class="card-heading">
      <div>
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
    </div>
  `;
  const list = element('div', 'list');
  if (!children.length) list.appendChild(emptyState(emptyMessage || 'Nothing here yet.'));
  children.forEach((child) => list.appendChild(child));
  card.appendChild(list);
  return card;
}

export function pill(label, tone = 'info') {
  return `<span class="status-pill pill-${tone}">${escapeHtml(label)}</span>`;
}

function sectionBox(label, value) {
  if (!value) return '';
  return `<div class="section-box"><h4>${escapeHtml(label)}</h4><p>${escapeHtml(value)}</p></div>`;
}

function priorityTone(priority = '') {
  const text = priority.toLowerCase();
  if (text.includes('high')) return 'danger';
  if (text.includes('medium')) return 'warning';
  return 'info';
}

function dueTone(dueClass) {
  if (dueClass === 'overdue') return 'danger';
  if (dueClass === 'today' || dueClass === 'week') return 'warning';
  return 'info';
}

function statusTone(status = '') {
  const text = status.toLowerCase();
  if (text.includes('done') || text.includes('paid') || text.includes('booked')) return 'ok';
  if (text.includes('not') || text.includes('unpaid') || text.includes('overdue')) return 'danger';
  if (text.includes('pending') || text.includes('review')) return 'warning';
  return 'info';
}

function severityTone(severity = '') {
  const text = severity.toLowerCase();
  if (text.includes('error') || text.includes('urgent')) return 'danger';
  if (text.includes('warn')) return 'warning';
  return 'info';
}

function element(tag, className = '', html = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
