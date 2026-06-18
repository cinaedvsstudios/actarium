import { toISODate, parseDate } from './dateUtils.js';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some(value => String(value).trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some(value => String(value).trim() !== '')) rows.push(row);
  return rows;
}

export function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(header => normaliseKey(header));
  return rows.slice(1).map(row => {
    const record = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = cleanValue(row[index]);
    });
    return record;
  });
}

export function parseSectionText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const knownLabels = ['Info', 'Maps', 'Codes', 'Paid', 'Unpaid', 'Schedule', 'Links', 'Details', 'Notes', 'Action'];
  const lines = raw.split(/\r?\n/);
  const sections = [];
  let current = null;

  lines.forEach(line => {
    const match = line.match(/^([A-Za-z ]{2,24}):\s*(.*)$/);
    const label = match ? match[1].trim() : '';
    if (match && knownLabels.some(item => item.toLowerCase() === label.toLowerCase())) {
      current = { label, body: match[2] || '' };
      sections.push(current);
      return;
    }
    if (!current) {
      current = { label: 'Info', body: '' };
      sections.push(current);
    }
    current.body = [current.body, line].filter(Boolean).join('\n');
  });

  return sections
    .map(section => ({ ...section, body: section.body.trim() }))
    .filter(section => section.body || section.label);
}

export function normaliseTask(row, index = 0) {
  const due = firstDate(row.due_date, row.start_date, row.date) || toISODate(new Date());
  const start = firstDate(row.start_date, row.due_date, row.date) || due;
  const end = firstDate(row.end_date, row.due_date, row.date) || due;
  return {
    id: row.id || `T-${String(index + 1).padStart(4, '0')}`,
    title: row.title || 'Untitled task',
    area: row.area || 'General',
    source: row.source || 'Actarium',
    status: row.status || 'Not started',
    priority: row.priority || 'Normal',
    dueDate: due,
    startDate: start,
    endDate: end,
    durationType: row.duration_type || inferDurationType(start, end),
    recurrence: row.recurrence || 'None',
    repeatUntil: firstDate(row.repeat_until) || '',
    energy: row.energy || '',
    link: row.link || '',
    notes: row.notes || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    completedAt: row.completed_at || '',
    completionNote: row.completion_note || ''
  };
}

export function normaliseSchedule(row, index = 0) {
  return {
    id: row.id || `S-${String(index + 1).padStart(4, '0')}`,
    title: row.title || 'Scheduled item',
    type: row.type || 'Daily',
    days: row.days || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    area: row.area || 'General',
    status: row.status || 'Active',
    emoji: row.emoji || '🗓️',
    details: row.details || '',
    link: row.link || '',
    startDate: firstDate(row.start_date) || '',
    endDate: firstDate(row.end_date) || '',
    priority: row.priority || 'Normal'
  };
}


export function normaliseApp(row, index = 0) {
  return {
    id: row.id || `APP-${String(index + 1).padStart(3, '0')}`,
    label: row.label || row.name || 'App',
    emoji: row.emoji || '🔗',
    url: row.url || row.link || '',
    status: row.status || 'Active',
    sortOrder: Number(row.sort_order || row.sortOrder || index + 1),
    accent: row.accent || 'tasks',
    notes: row.notes || ''
  };
}

export function normaliseAppFeed(row, index = 0) {
  const source = row.source_app || row.source || 'Actarium';
  return {
    id: row.id || `F-${String(index + 1).padStart(4, '0')}`,
    sourceApp: source,
    type: row.type || 'info',
    title: row.title || source,
    date: firstDate(row.date) || toISODate(new Date()),
    severity: row.severity || 'info',
    actionText: row.action_text || '',
    deepLink: row.deep_link || '',
    payload: row.payload_json || '',
    sections: parseSectionText(row.action_text || row.payload_json || '')
  };
}

function normaliseKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function cleanValue(value) {
  return String(value ?? '').trim();
}

function firstDate(...values) {
  for (const value of values) {
    const parsed = parseDate(value);
    if (parsed) return toISODate(parsed);
  }
  return '';
}

function inferDurationType(start, end) {
  if (!start || !end || start === end) return 'Single day';
  return 'Date range';
}
