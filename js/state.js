import { CONFIG } from './config.js';

export const state = {
  activeView: localStorage.getItem(CONFIG.storageKeys.activeView) || 'week',
  loading: true,
  syncMessage: 'Loading…',
  tasks: [],
  links: [],
  ideas: [],
  appFeed: [],
  toast: ''
};

const subscribers = new Set();

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function notify() {
  subscribers.forEach((callback) => callback(state));
}

export function setActiveView(view) {
  state.activeView = view;
  localStorage.setItem(CONFIG.storageKeys.activeView, view);
  notify();
}

export function setData({ tasks = [], links = [], ideas = [], appFeed = [] }) {
  state.tasks = tasks;
  state.links = links;
  state.ideas = ideas;
  state.appFeed = appFeed;
  state.loading = false;
  state.syncMessage = 'Local V1';
  notify();
}

export function addTask(task) {
  state.tasks = [task, ...state.tasks];
  notify();
}

export function addLink(link) {
  state.links = [link, ...state.links];
  notify();
}

export function addIdea(idea) {
  state.ideas = [idea, ...state.ideas];
  notify();
}

export function updateTaskStatus(id, status) {
  state.tasks = state.tasks.map((task) => String(task.id) === String(id) ? { ...task, status } : task);
  notify();
}

export function showToast(message, delay = 2200) {
  state.toast = message;
  notify();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = '';
    notify();
  }, delay);
}
