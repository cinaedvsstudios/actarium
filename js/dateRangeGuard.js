(() => {
  function dateRangeFor(input) {
    const row = input.closest('.form-two');
    if (!row) return null;

    const dates = [...row.querySelectorAll('input[type="date"]')];
    return dates.length >= 2 ? { start: dates[0], end: dates[1] } : null;
  }

  function keepEndOnOrAfterStart(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'date') return;

    const range = dateRangeFor(input);
    if (!range || range.start !== input) return;

    const startDate = range.start.value;
    const endDate = range.end.value;
    if (!startDate || (endDate && endDate >= startDate)) return;

    range.end.value = startDate;
    range.end.dispatchEvent(new Event('input', { bubbles: true }));
    range.end.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener('input', keepEndOnOrAfterStart, true);
  document.addEventListener('change', keepEndOnOrAfterStart, true);
})();
