import { CONFIG } from './config.js';
import { todayIso, addDays, startOfWeekIso } from './dateUtils.js';
import { normaliseTask, normaliseLink, normaliseIdea, normaliseFeedItem } from './sheetParser.js';

export async function loadInitialData() {
  const local = readLocalData();
  if (hasLocalData(local)) return local;

  if (CONFIG.apiBaseUrl) {
    try {
      return await loadFromApi();
    } catch (error) {
      console.warn('Actarium API load failed; using starter data.', error);
    }
  }

  return starterData();
}

export function saveLocalData(data) {
  localStorage.setItem(CONFIG.storageKeys.tasks, JSON.stringify(data.tasks || []));
  localStorage.setItem(CONFIG.storageKeys.links, JSON.stringify(data.links || []));
  localStorage.setItem(CONFIG.storageKeys.ideas, JSON.stringify(data.ideas || []));
  localStorage.setItem(CONFIG.storageKeys.appFeed, JSON.stringify(data.appFeed || []));
}

export function readLocalData() {
  return {
    tasks: readJson(CONFIG.storageKeys.tasks),
    links: readJson(CONFIG.storageKeys.links),
    ideas: readJson(CONFIG.storageKeys.ideas),
    appFeed: readJson(CONFIG.storageKeys.appFeed)
  };
}

export async function loadFromApi() {
  const response = await fetch(`${CONFIG.apiBaseUrl}?action=dashboard`);
  if (!response.ok) throw new Error(`Actarium API HTTP ${response.status}`);
  const payload = await response.json();
  return {
    tasks: (payload.tasks || []).map(normaliseTask),
    links: (payload.links || []).map(normaliseLink),
    ideas: (payload.ideas || []).map(normaliseIdea),
    appFeed: (payload.appFeed || []).map(normaliseFeedItem)
  };
}

export function persistCurrentState(state) {
  saveLocalData({
    tasks: state.tasks,
    links: state.links,
    ideas: state.ideas,
    appFeed: state.appFeed
  });
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (_) {
    return [];
  }
}

function hasLocalData(data) {
  return ['tasks', 'links', 'ideas', 'appFeed'].some((key) => Array.isArray(data[key]) && data[key].length > 0);
}

function starterData() {
  const today = todayIso();
  const weekStart = startOfWeekIso(today);
  return {
    tasks: [
      normaliseTask({
        id: 'T-0001',
        title: 'Wire Actarium app to the Google Sheet backend',
        area: 'Apps',
        source: 'Actarium',
        status: 'Not started',
        priority: 'High',
        due_date: addDays(today, 7),
        energy: 'Medium',
        link: CONFIG.sheetUrl,
        notes: 'Next step: Apps Script endpoint for real read/write sync.'
      }),
      normaliseTask({
        id: 'T-0002',
        title: 'Check this week for anything that needs attention',
        area: 'Weekly control',
        source: 'Actarium',
        status: 'Not started',
        priority: 'Medium',
        due_date: today,
        energy: 'Low',
        notes: 'Starter workflow card.'
      })
    ],
    links: [
      normaliseLink({
        id: 'L-0001',
        title: 'Actarium live app',
        url: CONFIG.urls.actarium,
        category: 'Apps',
        why_saved: 'Project homepage',
        status: 'To review',
        review_by: addDays(today, 14)
      }),
      normaliseLink({
        id: 'L-0002',
        title: 'Viaticum source app',
        url: CONFIG.urls.viaticum,
        category: 'Apps',
        why_saved: 'Travel logic reference',
        status: 'Reference'
      })
    ],
    ideas: [
      normaliseIdea({
        id: 'I-0001',
        idea: 'Use Actarium as the weekly command centre above ChrisFit and Viaticum',
        category: 'Apps',
        project: 'Actarium',
        status: 'Active',
        next_action: 'Keep cards consistent across mobile and desktop',
        month: today.slice(0, 7)
      })
    ],
    appFeed: [
      normaliseFeedItem({
        id: 'F-0001',
        source_app: 'Viaticum',
        type: 'travel',
        title: 'Viaticum-style card sections',
        date: weekStart,
        severity: 'info',
        action_text: 'Details:\nUse labelled sections like Info, Maps, Codes, Paid, Unpaid, Schedule, Links.\nMaps:\nOpen map links as action buttons.\nPaid:\nShow paid items as positive/checkable context.\nUnpaid:\nShow unpaid items as tasks or warnings.',
        deep_link: CONFIG.urls.viaticum
      }),
      normaliseFeedItem({
        id: 'F-0002',
        source_app: 'ChrisFit',
        type: 'fitness',
        title: 'ChrisFit weekly summary placeholder',
        date: today,
        severity: 'info',
        action_text: 'Info:\nLater this can pull burn/intake summaries into the week view.',
        deep_link: CONFIG.urls.chrisfit
      })
    ]
  };
}
