const APP_ROOT = document.getElementById('app');
const CHRISFIT_URL = 'https://cinaedvsstudios.github.io/chrisfit/';
const CHRISFIT_SHEET_ID = '1rizJJ7oC2VbZPKYuMnlYD5WhhmEvLPcJM1OY_jD0bVM';
const TARGETS = {
  dailyFood: 1500,
  dailyBurn: 2500,
  dailyDeficit: -500,
  weeklyFood: 10500,
  weeklyBurn: 17500,
  weeklyDeficit: -3500
};

let summary = null;
let loading = false;

async function loadChrisFitSummary() {
  if (loading) return;
  loading = true;

  try {
    const [entries, weights] = await Promise.all([
      readSheetRows('entries'),
      readSheetRows('weights')
    ]);
    summary = summariseChrisFit(entries, weights);
    renderChrisFitCards();
  } catch (error) {
    console.warn('ChrisFit card update failed:', error);
    summary = emptySummary();
    renderChrisFitCards();
  } finally {
    loading = false;
  }
}

async function readSheetRows(sheetName) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${CHRISFIT_SHEET_ID}/gviz/tq`);
  url.searchParams.set('tqx', 'out:csv');
  url.searchParams.set('sheet', sheetName);

  const response = await fetch(url.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`ChrisFit ${sheetName} returned HTTP ${response.status}`);
  return parseCsv(await response.text());
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some(cell => cell !== '')) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows.shift().map(cell => String(cell || '').trim().toLowerCase());
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function summariseChrisFit(entryRows, weightRows) {
  const today = berlinIsoDate();
  const weekStart = mondayIsoDate(today);
  const entries = entryRows
    .map(row => ({
      date: String(row.date || '').trim(),
      name: String(row.name || '').trim(),
      calories: Number(String(row.calories || '').replace(',', '.'))
    }))
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.calories));

  const daily = totalsForRange(entries, today, today);
  const weekly = totalsForRange(entries, weekStart, today);
  const weight = latestWeight(weightRows, today);

  return { daily, weekly, weight, targets: TARGETS };
}

function totalsForRange(entries, start, end) {
  const days = new Map();
  entries.filter(entry => entry.date >= start && entry.date <= end).forEach(entry => {
    const bucket = days.get(entry.date) || [];
    bucket.push(entry);
    days.set(entry.date, bucket);
  });

  let food = 0;
  let burn = 0;

  days.forEach(dayEntries => {
    const dailyBurnEntries = dayEntries.filter(entry => /daily\s*burn/i.test(entry.name));
    const burnEntries = dailyBurnEntries.length
      ? dailyBurnEntries
      : dayEntries.filter(entry => entry.calories < 0 || isBurnEntry(entry));

    burn += burnEntries.reduce((sum, entry) => sum + Math.abs(entry.calories), 0);
    food += dayEntries
      .filter(entry => !burnEntries.includes(entry) && entry.calories > 0)
      .reduce((sum, entry) => sum + entry.calories, 0);
  });

  return {
    food: Math.round(food),
    burn: Math.round(burn),
    deficit: Math.round(food - burn),
    hasData: days.size > 0
  };
}

function isBurnEntry(entry) {
  return /\b(bmr|burn|fitbit|exercise|workout|activity)\b/i.test(entry.name);
}

function latestWeight(rows, today) {
  const candidates = rows
    .map((row, index) => ({
      date: String(row.date || '').trim(),
      value: Number(String(row.value || '').replace(',', '.')),
      index
    }))
    .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && row.date <= today && Number.isFinite(row.value))
    .sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index);

  if (!candidates.length) return { valueKg: null, recordedDate: '' };
  return { valueKg: candidates[0].value, recordedDate: candidates[0].date };
}

function emptySummary() {
  return {
    daily: { food: 0, burn: 0, deficit: 0, hasData: false },
    weekly: { food: 0, burn: 0, deficit: 0, hasData: false },
    weight: { valueKg: null, recordedDate: '' },
    targets: TARGETS
  };
}

function renderChrisFitCards() {
  if (!APP_ROOT || !summary) return;

  APP_ROOT.querySelectorAll('.actarium-card.is-chrisfit').forEach(card => {
    card.classList.remove('actarium-not-syncing');
    card.dataset.chrisfitRendered = 'true';
    card.replaceChildren(
      createHeader(),
      createSummaryGrid(summary),
      createWeightPanel(summary.weight)
    );
  });
}

function createHeader() {
  const header = element('div', 'actarium-card-head chrisfit-card-head');
  const heading = element('h2');
  heading.textContent = 'ChrisFit';
  const open = document.createElement('a');
  open.className = 'actarium-open-link';
  open.href = CHRISFIT_URL;
  open.target = '_blank';
  open.rel = 'noreferrer';
  open.textContent = 'Open';
  header.append(heading, open);
  return header;
}

function createSummaryGrid(data) {
  const grid = element('div', 'chrisfit-summary-grid');
  grid.append(
    createSummaryPanel('Daily Summary', data.daily, {
      food: data.targets.dailyFood,
      burn: data.targets.dailyBurn,
      deficit: data.targets.dailyDeficit
    }),
    createSummaryPanel('Weekly Summary', data.weekly, {
      food: data.targets.weeklyFood,
      burn: data.targets.weeklyBurn,
      deficit: data.targets.weeklyDeficit
    })
  );
  return grid;
}

function createSummaryPanel(title, values, targets) {
  const panel = element('section', 'chrisfit-summary-panel');
  panel.append(textElement('h3', title));
  panel.append(
    createMetricRow('🥦', 'Food', values.food, targets.food),
    createMetricRow('🔥', 'Burn', values.burn, targets.burn),
    createMetricRow('📉', 'Deficit', values.deficit, targets.deficit, values.deficit <= targets.deficit ? 'is-good' : 'is-bad')
  );
  return panel;
}

function createMetricRow(emoji, label, value, target, tone = '') {
  const row = element('div', 'chrisfit-metric-row');
  const name = element('span');
  name.textContent = `${emoji} ${label}`;
  const metric = textElement('strong', `${formatNumber(value)} / ${formatNumber(target)}`, tone);
  row.append(name, metric);
  return row;
}

function createWeightPanel(weight) {
  const panel = element('section', 'chrisfit-weight-panel');
  const content = element('div', 'chrisfit-weight-copy');
  content.append(textElement('h3', '⚖️ Weight'));
  content.append(textElement('strong', weight.valueKg === null ? '— kg' : `${formatWeight(weight.valueKg)} kg`, 'chrisfit-weight-value'));
  content.append(textElement('p', weight.recordedDate ? `Recorded ${formatDate(weight.recordedDate)}` : 'No weight recorded yet.', 'chrisfit-weight-meta'));

  const add = document.createElement('a');
  add.className = 'chrisfit-weight-add';
  add.href = CHRISFIT_URL;
  add.target = '_blank';
  add.rel = 'noreferrer';
  add.textContent = '⚖️ Add';

  panel.append(content, add);
  return panel;
}

function berlinIsoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function mondayIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function formatDate(isoDate) {
  const [year, month, day] = String(isoDate || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatWeight(value) {
  return Number(value).toFixed(1).replace(/\.0$/, '');
}

function element(tag, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function textElement(tag, value, className = '') {
  const node = element(tag, className);
  node.textContent = value;
  return node;
}

const observer = new MutationObserver(() => renderChrisFitCards());
if (APP_ROOT) observer.observe(APP_ROOT, { childList: true, subtree: true });
loadChrisFitSummary();
