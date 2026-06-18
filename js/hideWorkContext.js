(() => {
  const style = document.createElement('style');
  style.textContent = `
    .actarium-date-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
    .actarium-date-row .day-date{margin:0!important}
    .actarium-date-row .context-pill{margin:0!important;min-height:28px;padding:0 10px;font-size:.76rem}
    @media(max-width:900px){.actarium-date-row{gap:7px}.actarium-date-row .context-pill{min-height:26px;padding:0 9px;font-size:.72rem}}
  `;
  document.head.append(style);

  function placeLiveRoutineContext() {
    document.querySelectorAll('.context-pill').forEach(pill => {
      const text = String(pill.textContent || '').trim();
      if (/^(?:💼\s*)?Work day$/i.test(text)) {
        pill.remove();
        return;
      }

      const date = document.querySelector('.day-date');
      if (!date) return;
      let row = date.closest('.actarium-date-row');
      if (!row) {
        row = document.createElement('div');
        row.className = 'actarium-date-row';
        date.before(row);
        row.append(date);
      }
      if (pill.parentElement !== row) row.append(pill);
    });
  }

  new MutationObserver(placeLiveRoutineContext).observe(document.documentElement, { childList: true, subtree: true });
  placeLiveRoutineContext();
})();
