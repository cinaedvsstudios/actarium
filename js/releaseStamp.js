(() => {
  const RELEASE = 'v3.15.1';
  const apply = () => {
    document.querySelectorAll('.actarium-version').forEach(node => {
      node.textContent = RELEASE;
      node.dataset.release = RELEASE;
      node.title = `Actarium release ${RELEASE}`;
    });
    document.documentElement.dataset.actariumRelease = RELEASE;
  };

  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();
