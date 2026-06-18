(() => {
  const marker = /^\[\[actarium-emoji:([^\]]*)\]\]\s*/;
  const originalFetch = window.fetch.bind(window);

  function readUrl(input) {
    if (typeof input === 'string') return input;
    return String(input?.href || input?.url || '');
  }

  function encodeItem(item) {
    if (!item || typeof item !== 'object') return item;
    const cleanNotes = String(item.notes || '').replace(marker, '');
    const emoji = String(item.emoji || '').trim();
    return { ...item, notes: emoji ? `[[actarium-emoji:${emoji}]] ${cleanNotes}`.trim() : cleanNotes };
  }

  function decodeItem(item) {
    if (!item || typeof item !== 'object') return item;
    const notes = String(item.notes || '');
    const found = notes.match(marker);
    return found ? { ...item, emoji: item.emoji || found[1], notes: notes.replace(marker, '') } : item;
  }

  function decodePayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const output = { ...payload };
    if (Array.isArray(output.tasks)) output.tasks = output.tasks.map(decodeItem);
    if (Array.isArray(output.reminders)) output.reminders = output.reminders.map(decodeItem);
    return output;
  }

  window.fetch = async function actariumEmojiBridge(input, init = {}) {
    const url = readUrl(input);
    const isActarium = url.includes('script.google.com/macros/s/') || url === String(window.ACTARIUM_API || '');
    let nextInit = init;

    if (isActarium && init?.body) {
      try {
        const body = JSON.parse(init.body);
        if (body.action === 'saveTask' && body.task) body.task = encodeItem(body.task);
        if (body.action === 'saveReminder' && body.reminder) body.reminder = encodeItem(body.reminder);
        nextInit = { ...init, body: JSON.stringify(body) };
      } catch {}
    }

    const response = await originalFetch(input, nextInit);
    if (!isActarium || !url.includes('action=bootstrap')) return response;

    try {
      const payload = decodePayload(await response.clone().json());
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      return response;
    }
  };
})();
