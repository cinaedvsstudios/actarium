(() => {
  const apiUrl = String(window.ACTARIUM_API || '');
  const originalFetch = window.fetch.bind(window);
  let bootstrapState = 'loading';
  let observerAttached = false;

  window.ACTARIUM_SYNC_STATE = () => bootstrapState;

  function setBootstrapState(nextState) {
    bootstrapState = nextState;
    document.documentElement.dataset.actariumSync = nextState;
    applySyncIndicators();
  }

  function isBootstrapRequest(input) {
    if (!apiUrl) return false;
    const candidate = input instanceof Request ? input.url : String(input || '');
    if (!candidate.startsWith(apiUrl)) return false;

    try {
      return new URL(candidate).searchParams.get('action') === 'bootstrap';
    } catch (_) {
      return false;
    }
  }

  window.fetch = async function actariumFetch(input, init) {
    const isBootstrap = isBootstrapRequest(input);

    try {
      const response = await originalFetch(input, init);
      if (!isBootstrap) return response;

      if (!response.ok) {
        setBootstrapState('offline');
        return response;
      }

      try {
        const payload = await response.clone().json();
        setBootstrapState(payload && payload.success !== false ? 'live' : 'offline');
      } catch (_) {
        setBootstrapState('offline');
      }

      return response;
    } catch (error) {
      if (isBootstrap) setBootstrapState('offline');
      throw error;
    }
  };

  function applySyncIndicators() {
    if (bootstrapState === 'loading') return;
    const offline = bootstrapState !== 'live';

    document.querySelectorAll('.task-card').forEach(card => {
      card.classList.toggle('not-syncing-card', offline);
    });

    document.querySelectorAll('.mobile-view .viewer-section').forEach(section => {
      const title = section.querySelector('h3')?.textContent?.trim() || '';
      if (/tasks\s*&\s*reminders/i.test(title)) {
        section.classList.toggle('not-syncing-card', offline);
      }
    });
  }

  function attachObserver() {
    if (observerAttached || !document.body) return;
    observerAttached = true;
    new MutationObserver(applySyncIndicators).observe(document.body, { childList: true, subtree: true });
    applySyncIndicators();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachObserver, { once: true });
  } else {
    attachObserver();
  }
})();
