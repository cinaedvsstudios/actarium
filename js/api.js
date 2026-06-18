import { CONFIG } from './config.js';
import { state, setState, setSync, showToast, readLocalTasks, saveLocalTasks } from './state.js';
import { parseCsv, rowsToObjects, normaliseTask, normaliseReminder, normaliseSchedule, normaliseRoutine, normaliseAppFeed, normaliseApp } from './sheetParser.js';
import { todayIso, addDays } from './dateUtils.js';

export async function initialise() {
  setSync('loading', 'Loading data…');
  const localTasks = readLocalTasks();

  try {
    if (CONFIG.apiBaseUrl) {
      const data = await apiGet('bootstrap');
      const remoteTasks = (data.tasks || []).map(normaliseTask);
      const remoteReminders = (data.reminders || []).map(normaliseReminder);
      const routineRows = (data.routine || []).map(normaliseRoutine);
      const routineSchedule = routineToSchedule(routineRows);
      const fallbackSchedule = (data.schedule || []).map(normaliseSchedule);
      const viaticumEvents = (data.viaticumEvents || []).map(normaliseViaticumEvent);
      const appFeed = (data.appFeed || []).map(normaliseAppFeed);
      const feedWithViaticum = ensureViaticumFeed(appFeed, viaticumEvents);
      setState({
        tasks: mergeTasks(remoteTasks, localTasks),
        reminders: remoteReminders,
        routine: routineRows,
        schedule: routineSchedule.length ? routineSchedule : fallbackSchedule.length ? fallbackSchedule : demoSchedule(),
        appFeed: feedWithViaticum.length ? feedWithViaticum : demoAppFeed(),
        viaticumEvents,
        apps: data.apps?.length ? filterActiveApps(data.apps.map(normaliseApp)) : demoApps()
      });
      setSync('saved', 'Live Sheet connection');
      return;
    }

    const [remoteTasks, remoteReminders, routineRows, schedule, appFeed, apps] = await Promise.all([
      fetchSheetTab(CONFIG.sheetTabs.tasks).then(rows => rows.map(normaliseTask)),
      fetchSheetTab(CONFIG.sheetTabs.reminders).then(rows => rows.map(normaliseReminder)).catch(() => []),
      fetchSheetTab(CONFIG.sheetTabs.routine).then(rows => rows.map(normaliseRoutine)).catch(() => []),
      fetchSheetTab(CONFIG.sheetTabs.schedule).then(rows => rows.map(normaliseSchedule)).catch(() => []),
      fetchSheetTab(CONFIG.sheetTabs.appFeed).then(rows => rows.map(normaliseAppFeed)),
      fetchSheetTab(CONFIG.sheetTabs.apps).then(rows => rows.map(normaliseApp))
    ]);
    const routineSchedule = routineToSchedule(routineRows);

    setState({
      tasks: mergeTasks(remoteTasks, localTasks),
      reminders: remoteReminders,
      routine: routineRows,
      schedule: routineSchedule.length ? routineSchedule : schedule.length ? schedule : demoSchedule(),
      appFeed: appFeed.length ? appFeed : demoAppFeed(),
      viaticumEvents: [],
      apps: apps.length ? filterActiveApps(apps) : demoApps()
    });
    setSync('saved', 'Read-only Sheet connection');
  } catch (error) {
    console.warn('Actarium load failed:', error);
    setState({
      tasks: localTasks.length ? localTasks : demoTasks(),
      reminders: demoReminders(),
      routine: [],
      schedule: demoSchedule(),
      appFeed: demoAppFeed(),
      viaticumEvents: [],
      apps: demoApps()
    });
    setSync('error', 'Using local/demo data. Deploy Apps Script for live sync.');
  }
}

export async function saveTask(task) {
  const cleanTask = cleanTaskPayload(task);
  const nextTasks = upsertTask(state.tasks, cleanTask);
  setState({ tasks: nextTasks });
  saveLocalTasks(getLocalOnlyTasks(nextTasks));

  if (!CONFIG.apiBaseUrl) {
    showToast('Task saved locally', 'success');
    return;
  }

  try {
    const result = await apiPost('saveTask', { task: cleanTask });
    if (result.task) {
      setState({ tasks: upsertTask(state.tasks, normaliseTask(result.task)) });
      saveLocalTasks(getLocalOnlyTasks(state.tasks));
    }
    showToast('Task saved to Sheet', 'success');
  } catch (error) {
    console.warn('Save failed:', error);
    showToast('Saved locally — Sheet sync failed', 'error');
  }
}

export function markTaskDone(id, done = true) {
  updateTaskStatus(id, done ? 'Done' : 'Not started', done ? new Date().toISOString() : '');
}

export function markTasksDone(ids) {
  const selected = new Set(ids.map(String));
  if (!selected.size) return;
  const completedAt = new Date().toISOString();
  const nextTasks = state.tasks.map(task => selected.has(String(task.id))
    ? { ...task, status: 'Done', completedAt, updatedAt: completedAt }
    : task);
  setState({ tasks: nextTasks });
  saveLocalTasks(getLocalOnlyTasks(nextTasks));
  if (CONFIG.apiBaseUrl) apiPost('markTasksDone', { ids: [...selected], completedAt }).catch(error => console.warn('Bulk done failed:', error));
  showToast(`${selected.size} task${selected.size === 1 ? '' : 's'} marked done`, 'success');
}

export function deleteTask(id) {
  const archivedAt = new Date().toISOString();
  updateTaskStatus(id, 'Deleted', archivedAt, 'Deleted from Actarium');
}

export function cancelTask(id) {
  const archivedAt = new Date().toISOString();
  updateTaskStatus(id, 'Cancelled', archivedAt, 'Cancelled in Actarium');
}

function updateTaskStatus(id, status, completedAt = '', completionNote = '') {
  const nextTasks = state.tasks.map(task => String(task.id) === String(id)
    ? { ...task, status, completedAt, completionNote: completionNote || task.completionNote || '', updatedAt: new Date().toISOString() }
    : task);
  setState({ tasks: nextTasks });
  saveLocalTasks(getLocalOnlyTasks(nextTasks));
  if (CONFIG.apiBaseUrl) apiPost('updateTaskStatus', { id, status, completedAt, completionNote }).catch(error => console.warn('Status update failed:', error));
  showToast(status === 'Done' ? 'Marked done' : `Marked ${status.toLowerCase()}`, 'success');
}

async function apiGet(action, params = {}) {
  const url = endpoint(action, params);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
  const data = await response.json();
  if (data.success === false) throw new Error(data.error || 'Backend request failed');
  return data;
}

async function apiPost(action, payload = {}) {
  const response = await fetch(endpoint(action), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload })
  });
  if (!response.ok) throw new Error(`Backend HTTP ${response.status}`);
  const data = await response.json();
  if (data.success === false) throw new Error(data.error || 'Backend request failed');
  return data;
}

function endpoint(action, params = {}) {
  const url = new URL(CONFIG.apiBaseUrl);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url.toString();
}

async function fetchSheetTab(tabName) {
  if (!CONFIG.googleSheetId || !tabName) return [];
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CONFIG.googleSheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Sheet tab ${tabName} returned HTTP ${response.status}`);
  const text = await response.text();
  if (/^\s*</.test(text)) throw new Error(`Sheet tab ${tabName} did not return CSV`);
  return rowsToObjects(parseCsv(text));
}

function cleanTaskPayload(task) {
  return {
    ...task,
    title: String(task.title || '').trim() || 'Untitled task',
    taskType: task.taskType || 'Personal',
    updatedAt: new Date().toISOString()
  };
}

function mergeTasks(remoteTasks, localTasks) {
  const map = new Map();
  remoteTasks.forEach(task => map.set(String(task.id), task));
  localTasks.forEach(task => map.set(String(task.id), { ...task, isLocal: true }));
  return [...map.values()].sort((a, b) => String(a.startDate || a.dueDate).localeCompare(String(b.startDate || b.dueDate)) || priorityRank(b.priority) - priorityRank(a.priority));
}

function upsertTask(tasks, task) {
  const exists = tasks.some(item => String(item.id) === String(task.id));
  if (exists) return tasks.map(item => String(item.id) === String(task.id) ? { ...item, ...task, isLocal: item.isLocal || String(task.id).startsWith('local-') } : item);
  return [{ ...task, isLocal: !CONFIG.apiBaseUrl || String(task.id).startsWith('local-') }, ...tasks];
}

function getLocalOnlyTasks(tasks) {
  return tasks.filter(task => task.isLocal || String(task.id).startsWith('local-'));
}

function priorityRank(priority = '') {
  const value = String(priority).toLowerCase();
  if (value.includes('urgent')) return 4;
  if (value.includes('high')) return 3;
  if (value.includes('normal')) return 2;
  if (value.includes('low')) return 1;
  return 0;
}

function routineToSchedule(routineRows = []) {
  const dayKeys = [
    ['Mon', 'monday'], ['Tue', 'tuesday'], ['Wed', 'wednesday'], ['Thu', 'thursday'], ['Fri', 'friday'], ['Sat', 'saturday'], ['Sun', 'sunday']
  ];
  const items = [];
  routineRows.forEach(row => {
    dayKeys.forEach(([day, key]) => {
      const title = String(row[key] || '').trim();
      if (!title) return;
      items.push({
        id: `${row.id}-${day}`,
        title,
        type: 'Routine',
        days: day,
        startTime: '',
        endTime: '',
        project: row.label || 'Routine',
        status: 'Active',
        emoji: row.emoji || (title.toLowerCase().includes('weekend') ? '🌙' : '💼'),
        details: `${row.label || 'Routine'} · ${day}`,
        link: '',
        startDate: '',
        endDate: '',
        priority: 'Normal'
      });
    });
  });
  return items;
}

function filterActiveApps(apps) {
  return apps
    .filter(app => String(app.status || '').toLowerCase() !== 'inactive')
    .sort((a, b) => Number(a.sortOrder || 999) - Number(b.sortOrder || 999) || String(a.label).localeCompare(String(b.label)));
}

function ensureViaticumFeed(appFeed, events = []) {
  const hasViaticum = appFeed.some(item => String(item.sourceApp || '').toLowerCase().includes('viaticum'));
  if (!events.length) return appFeed;
  if (hasViaticum) {
    return appFeed.map(item => String(item.sourceApp || '').toLowerCase().includes('viaticum')
      ? { ...item, payload: JSON.stringify({ events }) }
      : item);
  }
  return [...appFeed, normaliseAppFeed({
    id: 'F-VIATICUM-LIVE', source_app: 'Viaticum', type: 'calendar', title: 'Viaticum live schedule', date: todayIso(), severity: 'info', action_text: 'Info:\nLive Viaticum schedule.', deep_link: CONFIG.sourceApps.viaticum.url, payload_json: JSON.stringify({ events })
  })];
}

function normaliseViaticumEvent(event) {
  return {
    date: event.date || event.realDate || '',
    status: event.status || '',
    statusEmoji: event.statusEmoji || event.status_emoji || '🤔',
    location: event.location || '',
    locationEmoji: event.locationEmoji || event.location_emoji || '📍',
    event: event.event || event.title || '',
    eventEmoji: event.eventEmoji || event.event_emoji || '🎒',
    schedule: event.schedule || '',
    details: event.details || '',
    links: event.links || '',
    tripName: event.tripName || event.tripname || ''
  };
}


function demoReminders() {
  return [normaliseReminder({
    id: 'RMD-DEMO-1',
    title: 'Check Actarium after deployment',
    project: 'Apps',
    source: 'Actarium',
    status: 'Not started',
    priority: 'Normal',
    date: todayIso(),
    recurrence: 'None',
    notes: 'Starter reminder.'
  })];
}

function demoApps() {
  return [
    { id: 'APP-001', label: 'Actarium', emoji: '📋', url: 'https://cinaedvsstudios.github.io/actarium/', status: 'Active', sortOrder: 1, accent: 'teal', group: 'My apps', notes: 'Weekly control panel' },
    { id: 'APP-002', label: 'ChrisFit', emoji: '⚖️', url: CONFIG.sourceApps.fitness.url, status: 'Active', sortOrder: 2, accent: 'fitness', group: 'My apps', notes: 'Fitness, food, burn, deficit, weight' },
    { id: 'APP-003', label: 'Viaticum', emoji: '🎒', url: CONFIG.sourceApps.viaticum.url, status: 'Active', sortOrder: 3, accent: 'viaticum', group: 'My apps', notes: 'Travel calendar and schedules' }
  ];
}

function demoTasks() {
  const today = todayIso();
  return [
    { id: 'local-demo-1', title: 'Connect Actarium to the Sheet backend', project: 'Apps', source: 'Actarium', taskType: 'Personal', status: 'Not started', priority: 'High', dueDate: today, startDate: today, endDate: today, durationType: 'Single day', recurrence: 'None', repeatUntil: '', energy: 'Medium', link: CONFIG.sourceApps.fitness.url, notes: 'This is local demo data until the Apps Script endpoint is deployed.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: '', completionNote: '', isLocal: true },
    { id: 'local-demo-2', title: 'Review weekend plans', project: 'Travel', source: 'Viaticum', taskType: 'Personal', status: 'Done', priority: 'Normal', dueDate: today, startDate: today, endDate: today, durationType: 'Single day', recurrence: 'None', repeatUntil: '', energy: 'Low', link: CONFIG.sourceApps.viaticum.url, notes: 'Details:\nCheck travel cards and booking status.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: new Date().toISOString(), completionNote: '', isLocal: true }
  ];
}

function demoSchedule() {
  return routineToSchedule([
    { id: 'R-demo-1', label: 'Day context', emoji: '💼', monday: 'Work day', tuesday: 'Work day', wednesday: 'Work day', thursday: 'Work day', friday: 'Work day', saturday: 'Weekend', sunday: 'Weekend' }
  ]);
}

function demoAppFeed() {
  const today = todayIso();
  return [
    { id: 'F-demo-1', sourceApp: 'ChrisFit', type: 'summary', title: 'Fitness check', date: today, severity: 'info', actionText: 'Info:\nOpen ChrisFit and check burn/intake for today.', deepLink: CONFIG.sourceApps.fitness.url, payload: '', sections: [] },
    { id: 'F-demo-2', sourceApp: 'Viaticum', type: 'summary', title: 'Travel check', date: today, severity: 'info', actionText: 'Info:\nReview upcoming plans.', deepLink: CONFIG.sourceApps.viaticum.url, payload: '', sections: [] }
  ].map(normaliseAppFeed);
}
