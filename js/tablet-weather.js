(() => {
  const root = document.getElementById('app');
  const TABLET_KEY = 'actarium.tabletView';
  const WEATHER_KEY = 'actarium.weatherVisible';
  const TIME_KEY = 'actarium.timeVisible';
  const WEATHER_CACHE_KEY = 'actarium.berlinWeather';
  const CACHE_MS = 20 * 60 * 1000;
  let queued = false;
  let weatherRequest = null;

  function tabletView() {
    return localStorage.getItem(TABLET_KEY) === 'true';
  }

  function weatherVisible() {
    return localStorage.getItem(WEATHER_KEY) !== 'false';
  }

  function timeVisible() {
    return localStorage.getItem(TIME_KEY) !== 'false';
  }

  function compactDevice() {
    return tabletView() || window.matchMedia('(max-width: 900px)').matches;
  }

  function applyTabletView() {
    document.documentElement.classList.toggle('actarium-tablet-view', tabletView());
    window.dispatchEvent(new Event('actarium-display-change'));
  }

  function getHeader() {
    return root?.querySelector('.actarium-header') || null;
  }

  function tabletStatus(header) {
    let status = header.querySelector('.actarium-tablet-status');
    if (!status) {
      status = document.createElement('div');
      status.className = 'actarium-tablet-status';
      header.append(status);
    }
    return status;
  }

  function weatherChip(header) {
    let chip = header.querySelector('.actarium-weather-chip');
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'actarium-weather-chip is-loading';
      chip.setAttribute('aria-label', 'Current Berlin temperature');
      chip.textContent = '…';
    }
    return chip;
  }

  function readCachedWeather() {
    try {
      const parsed = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || '');
      if (parsed && Number.isFinite(parsed.temperature) && Number.isFinite(parsed.savedAt)) return parsed;
    } catch (_) {
      // Ignore bad old cache data.
    }
    return null;
  }

  function setWeather(chip, temperature, stale = false) {
    chip.classList.remove('is-loading');
    chip.textContent = `${Math.round(temperature)}°`;
    chip.title = `${Math.round(temperature)}°C in Berlin${stale ? ' (last saved value)' : ''}`;
  }

  async function fetchWeather(chip) {
    const cached = readCachedWeather();
    if (cached) setWeather(chip, cached.temperature, Date.now() - cached.savedAt > CACHE_MS);
    if (cached && Date.now() - cached.savedAt < CACHE_MS) return;
    if (weatherRequest) return weatherRequest;
    weatherRequest = (async () => {
      try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=52.5200&longitude=13.4050&current=temperature_2m&temperature_unit=celsius';
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
        const payload = await response.json();
        const temperature = Number(payload?.current?.temperature_2m);
        if (!Number.isFinite(temperature)) throw new Error('No temperature in weather response');
        const record = { temperature, savedAt: Date.now() };
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(record));
        const freshChip = getHeader()?.querySelector('.actarium-weather-chip');
        if (freshChip) setWeather(freshChip, temperature);
      } catch (_) {
        if (!cached) {
          chip.classList.remove('is-loading');
          chip.textContent = '—';
          chip.title = 'Berlin temperature unavailable';
        }
      } finally {
        weatherRequest = null;
      }
    })();
    return weatherRequest;
  }

  function renderWeather() {
    const header = getHeader();
    if (!header) return;
    const shouldShow = weatherVisible() && compactDevice();
    const existing = header.querySelector('.actarium-weather-chip');
    if (!shouldShow) {
      existing?.remove();
      return;
    }
    const chip = weatherChip(header);
    if (tabletView()) {
      const status = tabletStatus(header);
      const time = header.querySelector('.actarium-time-display');
      if (time && time.parentElement !== status) status.prepend(time);
      if (chip.parentElement !== status) status.append(chip);
    } else {
      const time = header.querySelector('.actarium-time-display');
      const target = time?.parentElement || header.querySelector('.actarium-date-line') || header.querySelector('.actarium-day-block');
      if (target && chip.parentElement !== target) {
        if (time && time.parentElement === target) time.insertAdjacentElement('afterend', chip);
        else target.append(chip);
      }
    }
    fetchWeather(chip);
  }

  function settingToggle(labelText, checked, handler) {
    const label = document.createElement('label');
    label.className = 'actarium-device-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => handler(input.checked));
    const text = document.createElement('span');
    text.textContent = labelText;
    label.append(input, text);
    return label;
  }

  function addDisplaySettings() {
    const modal = [...document.querySelectorAll('.actarium-modal')].find(node => node.querySelector('.actarium-modal-head h2')?.textContent.trim() === 'Settings');
    if (!modal || modal.querySelector('.actarium-device-settings')) return;
    const body = modal.querySelector('.actarium-modal-body');
    if (!body) return;
    const section = document.createElement('section');
    section.className = 'actarium-device-settings';
    const heading = document.createElement('h3');
    heading.textContent = 'Tablet & mobile display';
    const note = document.createElement('p');
    note.textContent = 'Tablet view uses a compact desktop-style header on a portrait tablet. It keeps the time and optional Berlin temperature together at the top right of the day title.';
    section.append(
      heading,
      note,
      settingToggle('Tablet view', tabletView(), enabled => {
        localStorage.setItem(TABLET_KEY, String(enabled));
        applyTabletView();
        renderWeather();
      }),
      settingToggle('Show time', timeVisible(), enabled => {
        localStorage.setItem(TIME_KEY, String(enabled));
        window.dispatchEvent(new Event('actarium-display-change'));
        renderWeather();
      }),
      settingToggle('Show Berlin temperature', weatherVisible(), enabled => {
        localStorage.setItem(WEATHER_KEY, String(enabled));
        renderWeather();
      })
    );
    const clockSection = body.querySelector('.actarium-time-settings');
    if (clockSection) clockSection.insertAdjacentElement('afterend', section);
    else body.prepend(section);
  }

  function renderAll() {
    applyTabletView();
    renderWeather();
    addDisplaySettings();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      renderAll();
    });
  }

  const observer = new MutationObserver(schedule);
  if (root) observer.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('actarium-display-change', schedule);
  document.addEventListener('DOMContentLoaded', renderAll);
  renderAll();
})();