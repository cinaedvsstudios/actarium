(() => {
  const activeEndpoint = String(window.ACTARIUM_API || '');
  const nextFetch = window.fetch.bind(window);

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    return String(input?.href || input?.url || '');
  }

  window.fetch = function routeActariumApi(input, init) {
    const currentUrl = requestUrl(input);
    const isScriptRequest = currentUrl.includes('script.google.com/macros/s/');

    if (activeEndpoint && isScriptRequest && !currentUrl.startsWith(activeEndpoint)) {
      const query = currentUrl.includes('?') ? currentUrl.slice(currentUrl.indexOf('?')) : '';
      return nextFetch(activeEndpoint + query, init);
    }

    return nextFetch(input, init);
  };
})();
