import { state, subscribe, setData, showToast } from './state.js';
import { loadInitialData, persistCurrentState } from './api.js';
import { renderApp } from './layout.js';

subscribe(renderApp);

window.addEventListener('DOMContentLoaded', async () => {
  renderApp();
  try {
    const data = await loadInitialData();
    setData(data);
    persistCurrentState(state);
  } catch (error) {
    console.error('Actarium failed to initialise:', error);
    setData({ tasks: [], links: [], ideas: [], appFeed: [] });
    showToast('Actarium loaded, but data could not be prepared.');
  }
});

window.addEventListener('storage', () => {
  showToast('Local Actarium data changed in another tab. Refresh to reload.');
});
