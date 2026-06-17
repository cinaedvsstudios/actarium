import * as api from './api.js';
import { applyTheme, subscribe } from './state.js';
import { render } from './layout.js';

window.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  subscribe(render);
  window.addEventListener('actarium:render', render);
  render();
  await api.initialise();
});
