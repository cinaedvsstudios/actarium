import { CONFIG } from './config.js';
import { state, setState, setSync, showToast, readLocalTasks, saveLocalTasks } from './state.js';
import { parseCsv, rowsToObjects, normaliseTask, normaliseSchedule, normaliseAppFeed } from './sheetParser.js';
import { todayIso, addDays } from './dateUtils.js';

export async function initialise() {
  setSync('loading', 'Loading Sheet data…');
  const localTasks = readLocalTasks();

  try {
    const [remoteTasks, schedule, appFeed] = await Promise.all([
      fetchSheetTab(CONFIG.sheetTabs.tasks).then(rows => rows.map(normaliseTask)),
      fetchSheetTab(CONFIG.sheetTabs.schedule).then(rows => rows.map(normaliseSchedule)),
      fetchSheetTab(CONFIG.sheetTabs.appFeed).then(rows => rows.map(normaliseAppFeed))
    ]);

    setState({
      tasks: mergeTasks(remoteTasks, localTasks),
      schedule: schedule.length ? schedule : demoSchedule(),
      appFeed: appFeed.length ? appFeed : demoAppFeed()
    });
    setSync('saved', '');
  } catch (error) {
    console.warn('Actarium Sheet load failed:', error);
    setState({
      tasks: localTasks.length ? localTasks : demoTasks(),
      schedule: demoSchedule(),
      appFeed: demoAppFeed()
    });
    setSync('error', 'Using local/demo data. Publish the Sheet or add Apps Script to sync live.');
  }
}

export function saveTask(task) {
  const cleanTask = {
    ...task,
    title: String(task.title || '').trim() || 'Untitled task',
    updatedAt: new Date().toISOString()
  };
  const nextTasks = upsertTask(state.tasks, cleanTask);
  setState({ tasks: nextTasks });
  saveLocalTasks(getLocalOnlyTasks(nextTasks));
  showToast('Task saved locally', 'success');
}

export function markTaskDone(id, done = true) {
  const nextTasks = state.tasks.map(task => {
    if (String(task.id) !== String(id)) return task;
    return {
      ...task,
      status: done ? 'Done' : 'Not started',
      completedAt: done ? new Date().toISOString() : '',
      updatedAt: new Date().toISOString()
    };
  });
  setState({ tasks: nextTasks });
  saveLocalTasks(getLocalOnlyTasks(nextTasks));
  showToast(done ? 'Marked done' : 'Marked open', 'success');
}

export function markTasksDone(ids) {
  const selected = new Set(ids.map(String));
  if (!selected.size) return;
  const nextTasks = state.tasks.map(task => selected.has(String(task.id))
    ? { ...task, status: 'Done', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    : task);
  setState({ tasks: nextTasks });
  saveLocalTasks(getLocalOnlyTasks(nextTasks));
  showToast(`${selected.size} task${selected.size === 1 ? '' : 's'} marked done`, 'success');
}

export function deleteTask(id) {
  const nextTasks = state.tasks.filter(task => String(task.id) !== String(id));
  setState({ tasks: nextTasks });
  saveLocalTasks(getLocalOnlyTasks(nextTasks));
  showToast('Task deleted locally', 'success');
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

function mergeTasks(remoteTasks, localTasks) {
  const map = new Map();
  remoteTasks.forEach(task => map.set(String(task.id), task));
  localTasks.forEach(task => map.set(String(task.id), { ...task, isLocal: true }));
  return [...map.values()].sort((a, b) => String(a.startDate || a.dueDate).localeCompare(String(b.startDate || b.dueDate)) || priorityRank(b.priority) - priorityRank(a.priority));
}

function upsertTask(tasks, task) {
  const exists = tasks.some(item => String(item.id) === String(task.id));
  if (exists) return tasks.map(item => String(item.id) === String(task.id) ? { ...task, isLocal: true } : item);
  return [{ ...task, isLocal: true }, ...tasks];
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

function demoTasks() {
  const today = todayIso();
  return [
    {
      id: 'local-demo-1', title: 'Connect Actarium to the Sheet backend', area: 'Apps', source: 'Actarium', status: 'Not started', priority: 'High', dueDate: today, startDate: today, endDate: today, durationType: 'Single day', recurrence: 'None', repeatUntil: '', energy: 'Medium', link: CONFIG.sourceApps.fitness.url, notes: 'This is local demo data until the Sheet is published or an Apps Script endpoint is added.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: '', completionNote: '', isLocal: true
    },
    {
      id: 'local-demo-2', title: 'Review weekend plans', area: 'Travel', source: 'Viaticum', status: 'Not started', priority: 'Normal', dueDate: toIsoPlus(3), startDate: toIsoPlus(2), endDate: toIsoPlus(3), durationType: 'Date range', recurrence: 'None', repeatUntil: '', energy: 'Low', link: CONFIG.sourceApps.viaticum.url, notes: 'Details:\nCheck travel cards and booking status.\nPaid:\nHotel deposit if needed.\nMaps:\nOpen saved places.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: '', completionNote: '', isLocal: true
    }
  ];
}

function demoSchedule() {
  return [
    { id: 'S-demo-1', title: 'Work day', type: 'Weekly', days: 'Mon,Tue,Wed,Thu,Fri', startTime: '', endTime: '', area: 'Routine', status: 'Active', emoji: '💼', details: 'Recurring weekday context. This is not a task list.', link: '', startDate: '', endDate: '', priority: 'Normal' },
    { id: 'S-demo-2', title: 'Weekend', type: 'Weekly', days: 'Sat,Sun', startTime: '', endTime: '', area: 'Routine', status: 'Active', emoji: '🌙', details: 'Recurring weekend context. This is not a task list.', link: '', startDate: '', endDate: '', priority: 'Normal' }
  ];
}

function demoAppFeed() {
  const today = todayIso();
  return [
    { id: 'F-demo-1', sourceApp: 'ChrisFit', type: 'summary', title: 'Fitness check', date: today, severity: 'info', actionText: 'Info:\nOpen ChrisFit and check burn/intake for today.\nAction:\nLog anything missing.', deepLink: CONFIG.sourceApps.fitness.url, payload: '', sections: [] },
    { id: 'F-demo-2', sourceApp: 'Viaticum', type: 'summary', title: 'Travel check', date: today, severity: 'info', actionText: 'Info:\nReview upcoming plans and paid/unpaid notes.\nMaps:\nOpen saved places if travelling soon.\nPaid:\nCheck bookings.', deepLink: CONFIG.sourceApps.viaticum.url, payload: '', sections: [] }
  ].map(normaliseAppFeed);
}

function toIsoPlus(days) {
  return addDays(new Date(), days).toISOString().slice(0, 10);
}
