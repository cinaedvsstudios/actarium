const SECTION_LABELS = ['Info', 'Maps', 'Codes', 'Paid', 'Unpaid', 'Schedule', 'Links', 'Details'];

export function parseViaticumSections(text = '') {
  const sections = {};
  let current = 'Details';
  String(text || '').split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const match = line.match(/^([A-Za-z ]+):\s*(.*)$/);
    if (match && SECTION_LABELS.includes(match[1].trim())) {
      current = match[1].trim();
      sections[current] = sections[current] || [];
      if (match[2]) sections[current].push(match[2]);
      return;
    }
    if (line.trim()) {
      sections[current] = sections[current] || [];
      sections[current].push(line);
    }
  });

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, value.join('\n').trim()])
  );
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((value) => String(value).trim() !== ''));
}

export function rowsToObjects(rows) {
  const [headers = [], ...body] = rows;
  return body.map((row) => Object.fromEntries(
    headers.map((header, index) => [String(header).trim(), row[index] ?? ''])
  ));
}

export function normaliseTask(row = {}) {
  return {
    id: row.id || cryptoId('T'),
    title: row.title || 'Untitled task',
    area: row.area || 'General',
    source: row.source || 'Actarium',
    status: row.status || 'Not started',
    priority: row.priority || 'Medium',
    dueDate: row.due_date || row.dueDate || '',
    energy: row.energy || 'Medium',
    link: row.link || '',
    notes: row.notes || ''
  };
}

export function normaliseLink(row = {}) {
  return {
    id: row.id || cryptoId('L'),
    title: row.title || row.url || 'Saved link',
    url: row.url || '',
    category: row.category || 'General',
    whySaved: row.why_saved || row.whySaved || '',
    status: row.status || 'To review',
    reviewBy: row.review_by || row.reviewBy || ''
  };
}

export function normaliseIdea(row = {}) {
  return {
    id: row.id || cryptoId('I'),
    idea: row.idea || 'Untitled idea',
    category: row.category || 'General',
    project: row.project || 'Actarium',
    status: row.status || 'Active',
    nextAction: row.next_action || row.nextAction || '',
    month: row.month || ''
  };
}

export function normaliseFeedItem(row = {}) {
  const sections = parseViaticumSections(`${row.action_text || ''}\n${row.payload_json || ''}`);
  return {
    id: row.id || cryptoId('F'),
    sourceApp: row.source_app || row.sourceApp || 'Actarium',
    type: row.type || 'note',
    title: row.title || 'Feed item',
    date: row.date || '',
    severity: row.severity || 'info',
    actionText: row.action_text || row.actionText || '',
    deepLink: row.deep_link || row.deepLink || '',
    sections
  };
}

function cryptoId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
