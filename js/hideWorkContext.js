(() => {
  function removeWorkContext() {
    document.querySelectorAll('.context-pill').forEach(pill => {
      if (/\b(work|office|wfh)\b/i.test(pill.textContent || '')) pill.remove();
    });
  }

  new MutationObserver(removeWorkContext).observe(document.documentElement, { childList: true, subtree: true });
  removeWorkContext();
})();
