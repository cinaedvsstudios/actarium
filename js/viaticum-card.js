const API = window.ACTARIUM_API;
const APP_ROOT = document.getElementById('app');
const VIATICUM_URL = 'https://cinaedvsstudios.github.io/Viaticum/';

let latestData = null;
let refreshInFlight = false;

async function loadViaticumData() {
  if (!API || refreshInFlight) return;
  refreshInFlight = true;

  try {
    const url = new URL(API);
    url.searchParams.set('action', 'bootstrap');
    const response = await fetch(url.href, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new Error(payload.error || 'Viaticum data could not be loaded.');

    latestData = {
      today: payload.viaticum?.today || {},
      events: Array.isArray(payload.viaticumEvents) ? payload.viaticumEvents : []
    };
    renderViaticumCard();
  } catch (error) {
    console.warn('Viaticum card update failed:', error);
  } finally {
    refreshInFlight = false;
  }
}

function renderViaticumCard() {
  if (!latestData) return;

  const card = APP_ROOT?.querySelector('.actarium-card.is-viaticum');
  if (!card || card.dataset.viaticumRendered === 'true') return;

  const today = latestData.today || {};
  const todayDate = cleanText(today.date) || berlinIsoDate();
  const schedule = latestData.events
    .filter(event => event?.date && event.date > todayDate && (event.event || event.location))
    .slice(0, 30);

  card.dataset.viaticumRendered = 'true';
  card.replaceChildren(
    createHeader(),
    createTodayPanel(today, todayDate),
    createSchedulePanel(schedule)
  );
}

function createHeader() {
  const header = element('div', 'actarium-card-head viaticum-card-head');
  header.append(
    textElement('h2', 'Viaticum'),
    linkElement('Open', VIATICUM_URL, 'actarium-open-link')
  );
  return header;
}

function createTodayPanel(today, todayDate) {
  const panel = element('section', 'viaticum-panel viaticum-today-panel');
  panel.append(textElement('h3', 'Today'));

  const grid = element('div', 'viaticum-schedule-grid viaticum-today-grid');
  const location = cleanText(today.location) || '—';
  const event = cleanText(today.event) || cleanText(today.status) || '—';
  const statusEmoji = cleanText(today.statusEmoji);

  grid.append(
    textElement('span', 'Date', 'viaticum-schedule-label'),
    textElement('span', '', 'viaticum-schedule-label'),
    textElement('span', 'Location', 'viaticum-schedule-label'),
    textElement('span', 'Event', 'viaticum-schedule-label'),
    textElement('span', formatShortDate(todayDate), 'viaticum-schedule-date'),
    textElement('span', statusEmoji, 'viaticum-schedule-status'),
    textElement('span', location, 'viaticum-schedule-location'),
    textElement('span', event, 'viaticum-schedule-event')
  );

  panel.append(grid);
  return panel;
}

function createSchedulePanel(events) {
  const panel = element('section', 'viaticum-panel viaticum-schedule-panel');
  panel.append(textElement('h3', 'Schedule'));

  const grid = element('div', 'viaticum-schedule-grid');
  grid.append(
    textElement('span', 'Date', 'viaticum-schedule-label'),
    textElement('span', '', 'viaticum-schedule-label'),
    textElement('span', 'Location', 'viaticum-schedule-label'),
    textElement('span', 'Event', 'viaticum-schedule-label')
  );

  if (!events.length) {
    const empty = textElement('p', 'No scheduled entries in the next 30 days.', 'viaticum-schedule-empty');
    empty.style.gridColumn = '1 / -1';
    grid.append(empty);
  } else {
    events.forEach(event => {
      const statusEmoji = cleanText(event.statusEmoji);
      const date = formatShortDate(event.date);
      const location = cleanText(event.location) || '—';
      const eventText = cleanText(event.event) || '—';

      grid.append(
        textElement('span', date, 'viaticum-schedule-date'),
        textElement('span', statusEmoji, 'viaticum-schedule-status'),
        textElement('span', location, 'viaticum-schedule-location'),
        textElement('span', eventText, 'viaticum-schedule-event')
      );
    });
  }

  panel.append(grid);
  return panel;
}

function formatShortDate(value) {
  const parts = String(value || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return '—';
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    timeZone: 'UTC'
  }).format(date).toUpperCase();
  return `${weekday} ${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}`;
}

function berlinIsoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function linkElement(value, href, className = '') {
  const node = document.createElement('a');
  node.className = className;
  node.href = href;
  node.target = '_blank';
  node.rel = 'noreferrer';
  node.textContent = value;
  return node;
}

const observer = new MutationObserver(() => {
  const card = APP_ROOT?.querySelector('.actarium-card.is-viaticum');
  if (card && card.dataset.viaticumRendered !== 'true') renderViaticumCard();
});

if (APP_ROOT) observer.observe(APP_ROOT, { childList: true, subtree: true });
loadViaticumData();
