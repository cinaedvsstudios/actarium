(() => {
  const MONTHS = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };

  function compactIso(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1].slice(-2)}` : value;
  }

  function compactLongDate(value) {
    const match = String(value || '').trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (!match) return value;
    const month = MONTHS[match[2].toLowerCase()];
    if (month === undefined) return value;
    return `${String(match[1]).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${match[3].slice(-2)}`;
  }

  function applyDisplayPreferences() {
    const version = document.querySelector('.version');
    if (version && version.textContent !== 'v3.13') version.textContent = 'v3.13';

    const context = document.querySelector('.context-pill');
    if (context && /\bwork day\b/i.test(context.textContent || '')) context.textContent = '⏳ Loading routine…';

    const headerDate = document.querySelector('.day-date');
    if (headerDate && !headerDate.dataset.compactDate) {
      headerDate.textContent = compactLongDate(headerDate.textContent);
      headerDate.dataset.compactDate = 'true';
    }

    document.querySelectorAll('.task-detail p').forEach(line => {
      if (line.dataset.compactDate) return;
      line.textContent = line.textContent.replace(/\b\d{4}-\d{2}-\d{2}\b/g, compactIso);
      line.dataset.compactDate = 'true';
    });
  }

  new MutationObserver(applyDisplayPreferences).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', applyDisplayPreferences);
  applyDisplayPreferences();
})();
