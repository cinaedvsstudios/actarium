const CONFIG = {
  appName: 'Actarium',
  version: 'v0.1',
  sheetId: '1gJpbr_PZXUoU3smlli7DsJPWUJurqCOZxWb8Ui15YqA',
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1gJpbr_PZXUoU3smlli7DsJPWUJurqCOZxWb8Ui15YqA/edit?usp=drivesdk',
  actariumUrl: 'https://cinaedvsstudios.github.io/actarium/',
  sheets: ['Tasks', 'Links', 'Ideas', 'AppFeed', 'Settings']
};

const STORAGE_KEY = 'actarium.localRecords.v1';
const VIEW_KEY = 'actarium.activeView.v1';

const state = {
  activeView: localStorage.getItem(VIEW_KEY) || 'dashboard',
  loading: true,
  sync: { phase: 'loading', message: 'Loading Sheet…' },
  lastLoaded: null,
  toast: '',
  remote: { Tasks: [], Links: [], Ideas: [], AppFeed: [], Settings: [] },
  local: readLocalRecords(),
  error: ''
};

const fallbackRows = {
  Tasks: [
    {
      id: 'T-0001',
      title: 'Wire Actarium app to this Google Sheet',
      area: 'Apps',
      source: 'Actarium',
      status: 'Not started',
      priority: 'High',
      due_date: addDaysIso(7),
      week_start: getWeekStartIso(addDays(7)),
      energy: 'Medium',
      link: CONFIG.actariumUrl,
      notes: 'Starter task created with the database. This card comes from the fallback starter data if the Google Sheet is not publicly readable yet.'
    }
  ],
  Links: [
    {
      id: 'L-0001',
      title: 'Actarium live app',
      url: CONFIG.actariumUrl,
      category: 'Apps',
      why_saved: 'Project homepage',
      status: 'To review',
      review_by: addDaysIso(14),
      created_at: todayIso()
    }
  ],
  Ideas: [
    {
      id: 'I-0001',
      idea: 'Use Actarium as the weekly command centre above ChrisFit and Viaticum',
      category: 'Apps',
      project: 'Actarium',
      status: 'Active',
      next_action: 'Build dashboard cards and Google Sheet connector',
      month: monthKey(new Date()),
      created_at: todayIso()
    }
  ],
  AppFeed: [
    {
      id: 'F-0001',
      source_app: 'Actarium',
      type: 'system',
      title: 'Database created',
      date: todayIso(),
      severity: 'info',
      action_text: 'Start wiring feed rows from ChrisFit and Viaticum',
      deep_link: CONFIG.actariumUrl,
      payload_json: '{"created_by":"Actarium","schema_version":"0.1"}'
    },
    {
      id: 'F-0002',
      source_app: 'Viaticum',
      type: 'travel-preview',
      title: 'Viaticum-style card example',
      date: addDaysIso(2),
      severity: 'info',
      action_text: 'Use Details, Links, Maps, Codes, Paid and Unpaid sections when travel rows are pushed into AppFeed.',
      deep_link: 'https://cinaedvsstudios.github.io/Viaticum/',
      payload_json: '{"Details":"Info:\\nMaps:\\nCodes:\\nPaid: hotel deposit\\nUnpaid: train ticket","Links":"Train - https://bahn.de\\nHotel - https://maps.google.com"}'
    },
    {
      id: 'F-0003',
      source_app: 'ChrisFit',
      type: 'fitness-check',
      title: 'ChrisFit weekly burn check',
      date: todayIso(),
      severity: 'warning',
      action_text: 'Show burn/intake gaps here once ChrisFit writes weekly summary rows.',
      deep_link: 'https://cinaedvsstudios.github.io/chrisfit/',
      payload_json: '{"target":"weekly deficit","status":"pending connector"}'
    }
  ],
  Settings: [
    { key: 'app_name', value: 'Actarium', notes: 'public app name' },
    { key: 'schema_version', value: '0.1', notes: 'increment when columns change' },
    { key: 'timezone', value: 'Europe/Berlin', notes: 'date grouping' },
    { key: 'week_start', value: 'Monday', notes: 'dashboard week grouping' },
    { key: 'theme_family', value: 'ChrisFit / Viaticum dark card style', notes: 'keep visual consistency' },
    { key: 'chrisfit_url', value: 'https://cinaedvsstudios.github.io/chrisfit/', notes: 'source app' },
    { key: 'viaticum_url', value: 'https://cinaedvsstudios.github.io/Viaticum/', notes: 'source app' },
    { key: 'actarium_url', value: CONFIG.actariumUrl, notes: 'dashboard app' }
  ]
};

const statusMeta = {
  'Not started': ['⭕', 'info'],
  'Pending': ['⌚', 'medium'],
  'Active': ['⚡', 'info'],
  'In progress': ['🔧', 'medium'],
  'To review': ['👀', 'medium'],
  'Done': ['✅', 'low'],
  'Completed': ['✅', 'low'],
  'Canceled': ['☠️', 'high'],
  'Cancelled': ['☠️', 'high'],
  'Booked': ['📅', 'info'],
  'Home': ['🏠', 'low'],
  'Unsure': ['🤔', 'medium'],
  'Paid': ['💵', 'low'],
  'Unpaid': ['🧾', 'high'],
  'info': ['ℹ️', 'info'],
  'warning': ['⚠️', 'medium'],
  'urgent': ['🚨', 'high']
};

const sourceMeta = {
  Actarium: '⚖️',
  Manual: '✍️',
  ChrisFit: '🥦',
  Viaticum: '🎒',
  Apps: '🧩',
  Travel: '🧳',
  Fitness: '🔥',
  Work: '💼',
  Money: '💶',
  Life: '🏠',
  Creative: '✨'
};

function readLocalRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      Tasks: Array.isArray(parsed.Tasks) ? parsed.Tasks : [],
      Links: Array.isArray(parsed.Links) ? parsed.Links : [],
      Ideas: Array.isArray(parsed.Ideas) ? parsed.Ideas : [],
      AppFeed: Array.isArray(parsed.AppFeed) ? parsed.AppFeed : []
    };
  } catch (error) {
    return { Tasks: [], Links: [], Ideas: [], AppFeed: [] };
  }
}

function saveLocalRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.local));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function todayIso() {
  return dateToIso(new Date());
}

function addDays(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function addDaysIso(days) {
  return dateToIso(addDays(days));
}

function dateToIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + Math.floor(value));
    return new Date(excelEpoch.getUTCFullYear(), excelEpoch.getUTCMonth(), excelEpoch.getUTCDate());
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const euro = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (euro) return new Date(Number(euro[3]), Number(euro[2]) - 1, Number(euro[1]));
  const month = raw.match(/^(\d{4})-(\d{2})$/);
  if (month) return new Date(Number(month[1]), Number(month[2]) - 1, 1);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isoFrom(value) {
  const parsed = parseDate(value);
  return parsed ? dateToIso(parsed) : '';
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getWeekStart(dateLike = new Date()) {
  const date = parseDate(dateLike) || new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7;
  if (day !== 1) date.setDate(date.getDate() - day + 1);
  return date;
}

function getWeekStartIso(dateLike = new Date()) {
  return dateToIso(getWeekStart(dateLike));
}

function getWeekEnd(dateLike = new Date()) {
  const date = getWeekStart(dateLike);
  date.setDate(date.getDate() + 6);
  return date;
}

function getMonthEnd(dateLike = new Date()) {
  const date = parseDate(dateLike) || new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isBetweenIso(iso, startDate, endDate) {
  const date = parseDate(iso);
  if (!date) return false;
  const start = new Date(startDate); start.setHours(0, 0, 0, 0);
  const end = new Date(endDate); end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return 'No date';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).format(date);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quote && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quote = !quote;
      }
    } else if (char === ',' && !quote) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quote) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some(value => String(value).trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => String(value).trim() !== '')) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(header => String(header || '').trim());
  return rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&cache=${Date.now()}`;
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok || /^\s*</.test(text)) throw new Error(`${sheetName} is not readable as CSV yet`);
  return rowsToObjects(parseCsv(text));
}

async function loadData() {
  state.loading = true;
  state.sync = { phase: 'loading', message: 'Loading Sheet…' };
  state.error = '';
  render();

  try {
    const entries = await Promise.all(CONFIG.sheets.map(async sheet => [sheet, await fetchSheet(sheet)]));
    state.remote = Object.fromEntries(entries);
    state.sync = { phase: 'ok', message: 'Sheet loaded' };
    state.lastLoaded = new Date();
  } catch (error) {
    state.remote = { ...fallbackRows };
    state.error = error.message;
    state.sync = { phase: 'error', message: 'Using starter/local data' };
  } finally {
    state.loading = false;
    render();
  }
}

function combinedRows(sheet) {
  return [...(state.remote[sheet] || fallbackRows[sheet] || []), ...(state.local[sheet] || [])];
}

function settingsMap() {
  return Object.fromEntries(combinedRows('Settings').map(row => [row.key, row.value]));
}

function isDoneStatus(status) {
  return ['done', 'completed', 'closed', 'archived', 'canceled', 'cancelled'].includes(String(status || '').trim().toLowerCase());
}

function priorityRank(priority) {
  const normalized = String(priority || '').trim().toLowerCase();
  if (normalized === 'urgent') return 0;
  if (normalized === 'high') return 1;
  if (normalized === 'medium') return 2;
  if (normalized === 'low') return 3;
  return 4;
}

function statusPill(status, fallback = 'Pending') {
  const label = status || fallback;
  const [emoji, tone] = statusMeta[label] || statusMeta[String(label).toLowerCase()] || ['•', 'info'];
  return `<span class="pill ${tone}">${emoji} ${escapeHtml(label)}</span>`;
}

function priorityPill(priority) {
  if (!priority) return '';
  const tone = String(priority).toLowerCase();
  const emoji = tone === 'high' || tone === 'urgent' ? '🔥' : tone === 'low' ? '🌿' : '⚖️';
  return `<span class="pill ${escapeHtml(tone)}">${emoji} ${escapeHtml(priority)}</span>`;
}

function sourceEmoji(source) {
  return sourceMeta[source] || sourceMeta[String(source || '').trim()] || '•';
}

function normalizeItems() {
  const tasks = combinedRows('Tasks').map(row => ({
    kind: 'task',
    id: row.id,
    title: row.title || 'Untitled task',
    source: row.source || 'Manual',
    area: row.area || 'Life',
    status: row.status || 'Not started',
    priority: row.priority || '',
    date: isoFrom(row.due_date),
    energy: row.energy || '',
    link: row.link || '',
    action: row.notes || '',
    rawText: [row.notes, row.link].filter(Boolean).join('\n')
  }));

  const links = combinedRows('Links').map(row => ({
    kind: 'link',
    id: row.id,
    title: row.title || row.url || 'Saved link',
    source: 'Actarium',
    area: row.category || 'Links',
    status: row.status || 'To review',
    priority: row.priority || '',
    date: isoFrom(row.review_by),
    link: row.url || '',
    action: row.why_saved || '',
    rawText: [row.why_saved, row.url].filter(Boolean).join('\n')
  }));

  const ideas = combinedRows('Ideas').map(row => ({
    kind: 'idea',
    id: row.id,
    title: row.idea || 'Untitled idea',
    source: row.project || 'Actarium',
    area: row.category || 'Ideas',
    status: row.status || 'Active',
    priority: row.priority || '',
    date: isoFrom(row.month),
    link: row.link || '',
    action: row.next_action || '',
    rawText: [row.next_action, row.link].filter(Boolean).join('\n')
  }));

  const feed = combinedRows('AppFeed').map(row => {
    const payload = parsePayload(row.payload_json);
    const payloadText = payloadToText(payload);
    return {
      kind: 'feed',
      id: row.id,
      title: row.title || 'App feed item',
      source: row.source_app || 'Actarium',
      area: row.type || 'Feed',
      status: row.severity || 'info',
      priority: row.severity === 'urgent' ? 'High' : row.severity === 'warning' ? 'Medium' : '',
      date: isoFrom(row.date),
      link: row.deep_link || '',
      action: row.action_text || '',
      payload,
      rawText: [row.action_text, row.deep_link, payloadText].filter(Boolean).join('\n')
    };
  });

  return [...tasks, ...links, ...ideas, ...feed]
    .filter(item => item.title && !isDoneStatus(item.status))
    .sort((a, b) => {
      const dateCompare = String(a.date || '9999-12-31').localeCompare(String(b.date || '9999-12-31'));
      if (dateCompare !== 0) return dateCompare;
      const priorityCompare = priorityRank(a.priority) - priorityRank(b.priority);
      if (priorityCompare !== 0) return priorityCompare;
      return a.title.localeCompare(b.title);
    });
}

function parsePayload(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return { text: String(value) };
  }
}

function payloadToText(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  return Object.entries(payload)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join('\n');
}

function extractUrls(text) {
  const found = new Map();
  const add = (label, url) => {
    if (!url) return;
    let clean = String(url).trim().replace(/[),.;]+$/, '');
    if (!/^https?:\/\//i.test(clean)) return;
    found.set(clean, label || clean.replace(/^https?:\/\//i, '').split('/')[0]);
  };

  String(text || '').split(/\n+/).forEach(line => {
    const labelled = line.match(/^\s*([^:-]{2,40})\s*[-:]\s*(https?:\/\/\S+)/i);
    if (labelled) add(labelled[1].trim(), labelled[2]);
    const urls = line.match(/https?:\/\/\S+/gi) || [];
    urls.forEach(url => add('', url));
  });

  return [...found.entries()].map(([url, label]) => ({ url, label }));
}

function extractLabelSections(text) {
  const labels = ['Info', 'Maps', 'Codes', 'Paid', 'Unpaid', 'Schedule', 'Links', 'Details'];
  const sections = {};
  let active = '';
  String(text || '').split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*(Info|Maps|Codes|Paid|Unpaid|Schedule|Links|Details)\s*:\s*(.*)$/i);
    if (match) {
      active = labels.find(label => label.toLowerCase() === match[1].toLowerCase());
      sections[active] = sections[active] || [];
      if (match[2]) sections[active].push(match[2]);
      return;
    }
    if (active && line.trim()) sections[active].push(line);
  });
  return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()]));
}

function renderItemCard(item, compact = false) {
  const isUrgent = item.priority === 'High' || item.status === 'urgent' || item.status === 'warning';
  const links = extractUrls([item.link, item.rawText].filter(Boolean).join('\n'));
  const maps = links.filter(link => /maps|goo\.gl\/maps|openstreetmap/i.test(link.url + link.label));
  const sections = extractLabelSections(item.rawText);
  const detailText = buildDetailText(item, sections);
  const openLink = item.link || links[0]?.url || '';
  const cardClass = ['item-card', isUrgent ? 'urgent' : '', isDoneStatus(item.status) ? 'done' : ''].filter(Boolean).join(' ');

  return `
    <article class="${cardClass}">
      <div class="card-topline">
        <span class="source-label">${sourceEmoji(item.source)} ${escapeHtml(item.source)} · ${escapeHtml(item.area || item.kind)}</span>
        ${statusPill(item.status)}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      ${item.action ? `<p class="card-action-text">${escapeHtml(item.action)}</p>` : ''}
      <div class="card-meta">
        <span class="chip">📆 ${escapeHtml(formatDate(item.date))}</span>
        ${priorityPill(item.priority)}
        ${item.energy ? `<span class="chip">🔋 ${escapeHtml(item.energy)}</span>` : ''}
        <span class="chip">${kindEmoji(item.kind)} ${escapeHtml(kindLabel(item.kind))}</span>
      </div>
      <div class="card-actions">
        ${openLink ? `<a class="button-link" href="${escapeHtml(openLink)}" target="_blank" rel="noopener">Open</a>` : ''}
        ${maps.length ? `<a class="button-link ghost" href="${escapeHtml(maps[0].url)}" target="_blank" rel="noopener">Map</a>` : ''}
        ${links.length > 1 ? `<span class="chip">🔗 ${links.length} links</span>` : ''}
        ${sections.Paid ? `<span class="chip low">💵 Paid: ${escapeHtml(sections.Paid)}</span>` : ''}
        ${sections.Unpaid ? `<span class="chip high">🧾 Unpaid: ${escapeHtml(sections.Unpaid)}</span>` : ''}
      </div>
      ${!compact && detailText ? `
        <details class="detail-block">
          <summary>Details / Viaticum-style fields</summary>
          ${detailText}
        </details>` : ''}
    </article>`;
}

function buildDetailText(item, sections) {
  const lines = [];
  Object.entries(sections).forEach(([label, value]) => {
    if (value) lines.push(`<div class="detail-section"><strong>${escapeHtml(label)}</strong><pre>${escapeHtml(value)}</pre></div>`);
  });
  if (!lines.length && item.rawText && item.kind === 'feed') {
    lines.push(`<div class="detail-section"><strong>Payload</strong><pre>${escapeHtml(item.rawText)}</pre></div>`);
  }
  return lines.join('');
}

function kindEmoji(kind) {
  return { task: '✅', link: '🔗', idea: '💡', feed: '📡' }[kind] || '•';
}

function kindLabel(kind) {
  return { task: 'Task', link: 'Link', idea: 'Idea', feed: 'Feed' }[kind] || kind;
}

function dashboardData() {
  const items = normalizeItems();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(today);
  const monthEnd = getMonthEnd(today);
  const todayString = todayIso();

  const tasks = combinedRows('Tasks').filter(row => !isDoneStatus(row.status));
  const links = combinedRows('Links').filter(row => !isDoneStatus(row.status));
  const ideas = combinedRows('Ideas').filter(row => !isDoneStatus(row.status));
  const feed = combinedRows('AppFeed');

  const overdue = items.filter(item => item.date && parseDate(item.date) < today && !isDoneStatus(item.status));
  const todayItems = items.filter(item => item.date === todayString);
  const weekItems = items.filter(item => isBetweenIso(item.date, weekStart, weekEnd));
  const monthItems = items.filter(item => {
    const date = parseDate(item.date);
    return date && date > weekEnd && date <= monthEnd;
  });
  const linkItems = items.filter(item => item.kind === 'link');
  const ideaItems = items.filter(item => item.kind === 'idea');

  return { items, tasks, links, ideas, feed, overdue, todayItems, weekItems, monthItems, linkItems, ideaItems, weekStart, weekEnd, monthEnd };
}

function renderSummary(data) {
  const metrics = [
    ['Today', data.todayItems.length, 'due now'],
    ['This week', data.weekItems.length, `${formatDate(data.weekStart)} – ${formatDate(data.weekEnd)}`],
    ['Overdue', data.overdue.length, 'needs attention'],
    ['Month', data.monthItems.length, 'after this week'],
    ['Inbox', state.local.Tasks.length + state.local.Links.length + state.local.Ideas.length, 'local captures']
  ];
  return `<section class="summary-grid">${metrics.map(([label, value, helper]) => `
    <article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><span>${escapeHtml(helper)}</span></article>
  `).join('')}</section>`;
}

function renderList(title, subtitle, items, options = {}) {
  const limit = options.limit || items.length;
  const compact = Boolean(options.compact);
  const visible = items.slice(0, limit);
  return `
    <section class="card">
      <div class="panel-header">
        <div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>
        ${options.action || ''}
      </div>
      <div class="item-list">
        ${visible.length ? visible.map(item => renderItemCard(item, compact)).join('') : '<div class="empty-state">Nothing here yet.</div>'}
      </div>
    </section>`;
}

function renderDashboard(data) {
  const focus = [...data.overdue, ...data.todayItems]
    .filter((item, index, array) => array.findIndex(other => other.kind === item.kind && other.id === item.id) === index);
  return `
    ${renderSummary(data)}
    <section class="dashboard-grid">
      <div class="column-stack">
        ${renderQuickCapture()}
        ${renderList('Today / needs attention', 'Overdue, due today, or marked as high priority.', focus.length ? focus : data.weekItems.filter(item => item.priority === 'High'), { limit: 8 })}
        ${renderList('This week', 'Everything dated inside the current Monday–Sunday week.', data.weekItems, { limit: 12 })}
      </div>
      <div class="column-stack">
        ${renderList('Rest of month', 'Upcoming after this week but before month end.', data.monthItems, { limit: 8, compact: true })}
        ${renderList('App feed', 'Rows from ChrisFit, Viaticum, Actarium, and future source apps.', data.items.filter(item => item.kind === 'feed'), { limit: 6, compact: true })}
      </div>
    </section>`;
}

function renderQuickCapture() {
  return `
    <section class="card">
      <div class="panel-header">
        <div><h2>Quick capture</h2><p>Add a local task now. Sheet writing comes in the next backend pass.</p></div>
      </div>
      <form id="quickCaptureForm" class="capture-grid">
        <div class="field"><label>Task</label><input name="title" required placeholder="What do I need to look at?" /></div>
        <div class="field"><label>Area</label><select name="area"><option>Apps</option><option>Travel</option><option>Fitness</option><option>Work</option><option>Money</option><option>Life</option><option>Creative</option></select></div>
        <div class="field"><label>Priority</label><select name="priority"><option>Medium</option><option>High</option><option>Low</option></select></div>
        <div class="field"><label>Due</label><input name="due" type="date" value="${todayIso()}" /></div>
        <button type="submit">Add</button>
      </form>
    </section>`;
}

function renderMonth(data) {
  return `${renderSummary(data)}<section class="month-grid">${data.monthItems.map(item => renderItemCard(item)).join('') || '<div class="empty-state">No rest-of-month items yet.</div>'}</section>`;
}

function renderInbox(data) {
  const inbox = [...data.overdue, ...data.todayItems, ...data.items.filter(item => item.kind === 'feed' && ['warning', 'urgent'].includes(String(item.status).toLowerCase()))]
    .filter((item, index, array) => array.findIndex(other => other.kind === item.kind && other.id === item.id) === index);
  return `${renderQuickCapture()}${renderList('Inbox / attention queue', 'This is the “what the fuck do I need to look at” view.', inbox, { limit: 30 })}`;
}

function renderLinks(data) {
  return `${renderList('Saved links', 'Links can carry Viaticum-style labelled sections like Maps, Paid, Unpaid, Codes, and Schedule.', data.linkItems, { limit: 40 })}`;
}

function renderIdeas(data) {
  return `${renderList('Ideas', 'Future things to build, read, plan, or turn into actions.', data.ideaItems, { limit: 40 })}`;
}

function renderSettings(data) {
  const settings = settingsMap();
  const settingRows = Object.entries(settings).map(([key, value]) => `<div class="setting-row"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
  return `
    <section class="settings-grid">
      <article class="card">
        <h2>Data source</h2>
        <p>V1 tries to read the Actarium Google Sheet using Google Sheets CSV output. If the Sheet is not published/readable to the web, the app uses starter plus local data instead.</p>
        <div class="setting-row"><strong>Sheet</strong><a href="${CONFIG.sheetUrl}" target="_blank" rel="noopener">Open Actarium Database</a></div>
        <div class="setting-row"><strong>Status</strong><span>${escapeHtml(state.sync.message)}</span></div>
        ${state.error ? `<div class="setting-row"><strong>Last error</strong><span>${escapeHtml(state.error)}</span></div>` : ''}
        <div class="inline-actions"><button id="reloadData">Reload data</button><button id="clearLocal" class="ghost">Clear local captures</button></div>
      </article>
      <article class="card">
        <h2>Settings tab</h2>
        <p>These values are read from the Sheet when the data source is accessible.</p>
        ${settingRows || '<div class="empty-state">No settings loaded.</div>'}
      </article>
      <article class="card">
        <h2>Viaticum-style logic carried over</h2>
        <p>Cards look for labelled text sections such as Info, Maps, Codes, Paid, Unpaid, Schedule, Links, and Details. This mirrors the Viaticum sheet pattern where rows carry event data while a reference tab controls emojis, templates, image links, and UI meaning.</p>
      </article>
      <article class="card">
        <h2>Next backend pass</h2>
        <p>The proper write setup should be an Apps Script endpoint like ChrisFit uses. That will let Actarium create/update rows in Tasks, Links, Ideas, and AppFeed from the web app instead of only local storage.</p>
      </article>
    </section>`;
}

function renderHero(data) {
  const syncClass = state.sync.phase === 'ok' ? 'sync-ok' : state.sync.phase === 'error' ? 'sync-error' : '';
  return `
    <section class="card hero-card">
      <div class="topbar">
        <div class="brand-lockup">
          <div class="brand-mark">⚖️</div>
          <div>
            <p class="eyebrow">Weekly command centre</p>
            <h1>Actarium</h1>
            <p>Tasks, links, ideas, and app-feed cards for this week and the rest of the month.</p>
            <div class="detail-chips">
              <span class="chip">📆 ${escapeHtml(formatDate(data.weekStart))} – ${escapeHtml(formatDate(data.weekEnd))}</span>
              <span class="chip">🌙 ${escapeHtml(monthKey(new Date()))}</span>
              <span class="chip">${CONFIG.version}</span>
            </div>
          </div>
        </div>
        <div class="hero-actions">
          <span class="sync-pill ${syncClass}"><span class="sync-dot"></span>${escapeHtml(state.sync.message)}</span>
          <button id="refreshButton" class="ghost">Refresh</button>
        </div>
      </div>
    </section>`;
}

function renderNav() {
  const tabs = [
    ['dashboard', '🏛️', 'Dashboard'],
    ['week', '📆', 'Week'],
    ['month', '🌙', 'Month'],
    ['inbox', '📥', 'Inbox'],
    ['links', '🔗', 'Links'],
    ['ideas', '💡', 'Ideas']
  ];
  return `<nav class="nav-tabs" aria-label="Actarium views">${tabs.map(([view, icon, label]) => `
    <button class="nav-tab ${state.activeView === view ? 'active' : ''}" data-view="${view}"><span class="tab-icon">${icon}</span><span>${label}</span></button>
  `).join('')}</nav>`;
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  const data = dashboardData();
  let content = '';
  if (state.activeView === 'dashboard') content = renderDashboard(data);
  if (state.activeView === 'week') content = `${renderSummary(data)}${renderList('Week board', 'A vertical mobile-first version of the week. Desktop keeps the same cards but gives them more space.', data.weekItems, { limit: 40 })}`;
  if (state.activeView === 'month') content = renderMonth(data);
  if (state.activeView === 'inbox') content = renderInbox(data);
  if (state.activeView === 'links') content = renderLinks(data);
  if (state.activeView === 'ideas') content = renderIdeas(data);
  if (state.activeView === 'settings') content = renderSettings(data);

  app.innerHTML = `
    ${renderHero(data)}
    ${renderNav()}
    <main>${content}</main>
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ''}
  `;
  wireEvents();
}

function wireEvents() {
  document.querySelectorAll('[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeView = button.dataset.view;
      localStorage.setItem(VIEW_KEY, state.activeView);
      render();
    });
  });

  document.getElementById('refreshButton')?.addEventListener('click', loadData);
  document.getElementById('reloadData')?.addEventListener('click', loadData);
  document.getElementById('clearLocal')?.addEventListener('click', () => {
    state.local = { Tasks: [], Links: [], Ideas: [], AppFeed: [] };
    saveLocalRecords();
    showToast('Local captures cleared');
    render();
  });

  document.getElementById('quickCaptureForm')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const due = form.get('due') || todayIso();
    const task = {
      id: `LOCAL-${Date.now()}`,
      title: String(form.get('title') || '').trim(),
      area: String(form.get('area') || 'Life'),
      source: 'Manual',
      status: 'Not started',
      priority: String(form.get('priority') || 'Medium'),
      due_date: due,
      week_start: getWeekStartIso(due),
      energy: '',
      link: '',
      notes: 'Local capture. Add it to the Sheet later or wait for the write backend.'
    };
    if (!task.title) return;
    state.local.Tasks.unshift(task);
    saveLocalRecords();
    event.currentTarget.reset();
    showToast('Captured locally');
    render();
  });
}

function showToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = '';
    render();
  }, 1800);
}

loadData();
