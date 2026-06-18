import { CONFIG } from './config.js';
import { todayIso } from './dateUtils.js';

export const STORAGE_KEYS = {
  tasks: 'actarium.localTasks.v2',
  theme: 'actarium.theme.v2'
};

export const state = {
  activeView: 'today',
  theme: readTheme(),
  selectedDate: todayIso(),
  todayTaskFilter: 'all',
  appMenuOpen: false,
  tasks: [],
  schedule: [],
  routine: [],
  viaticumEvents: [],
  appFeed: [],
  apps: [],
  sync: {
    phase: 'idle',
    message: 'Not loaded'
  },
  modal: null,
  toast: null
};

const subscribers = new Set();

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function notify() {
  subscribers.forEach(callback => callback(state));
}

export function setState(patch) {
  Object.assign(state, patch);
  notify();
}

export function setActiveView(view) {
  state.activeView = view;
  notify();
}

export function setSelectedDate(date) {
  state.selectedDate = date;
  notify();
}

export function setTodayTaskFilter(filter) {
  state.todayTaskFilter = filter === 'work' ? 'work' : 'all';
  notify();
}

export function toggleAppMenu() {
  state.appMenuOpen = !state.appMenuOpen;
  notify();
}

export function closeAppMenu() {
  if (!state.appMenuOpen) return;
  state.appMenuOpen = false;
  notify();
}

export function setSync(phase, message) {
  state.sync = { phase, message };
  notify();
}

export function setModal(modal) {
  state.modal = modal;
  notify();
}

export function closeModal() {
  state.modal = null;
  notify();
}

export function showToast(message, type = 'info', duration = 2400) {
  state.toast = { message, type };
  notify();
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    state.toast = null;
    notify();
  }, duration);
}

export function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  applyTheme();
  notify();
}

export function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
}

export function readLocalTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function saveLocalTasks(tasks) {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}

export function createEmptyTask() {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: '',
    project: 'General',
    source: CONFIG.appName,
    taskType: 'Personal',
    status: 'Not started',
    priority: 'Normal',
    dueDate: todayIso(),
    startDate: todayIso(),
    endDate: todayIso(),
    durationType: 'Single day',
    recurrence: 'None',
    repeatUntil: '',
    energy: 'Medium',
    link: '',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: '',
    completionNote: ''
  };
}

function readTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
