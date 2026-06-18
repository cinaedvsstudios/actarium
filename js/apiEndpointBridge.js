(() => {
  const LEGACY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwiM61R-bfvWbbkciZBDYorbx9F3hgOXU85f5lyuC78kB1zJe1B4MmmHLw6eVk-XDeS/exec';
  const ACTIVE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzC47dw83euJ_T45zh0LQmtAivEHK7G_V5aHTYLYw2VhnMDAAVK0UFCF3tv5nsWM74q/exec';
  const nextFetch = window.fetch.bind(window);

  window.fetch = function routeActariumApi(input, init) {
    if (typeof input === 'string' && input.startsWith(LEGACY_ENDPOINT)) {
      return nextFetch(ACTIVE_ENDPOINT + input.slice(LEGACY_ENDPOINT.length), init);
    }

    if (input instanceof Request && input.url.startsWith(LEGACY_ENDPOINT)) {
      const rewritten = new Request(ACTIVE_ENDPOINT + input.url.slice(LEGACY_ENDPOINT.length), input);
      return nextFetch(rewritten, init);
    }

    return nextFetch(input, init);
  };
})();
