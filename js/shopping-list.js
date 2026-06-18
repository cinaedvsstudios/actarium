(() => {
  const RELEASE = 'v3.16.0';
  const formats = new Map();
  const leadingEmoji = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s+/u;
  const nativeFetch = window.fetch.bind(window);

  function field(label) {
    return [...document.querySelectorAll('.actarium-modal .actarium-field')].find(node => node.querySelector('span')?.textContent.trim() === label) || null;
  }

  function input(label) {
    return field(label)?.querySelector('input,textarea,select') || null;
  }

  function isShopping(value) {
    return String(value || '').trim().toLowerCase() === 'shopping list';
  }

  function cleanTitle(value) {
    return String(value || '').replace(leadingEmoji, '').trim();
  }

  function cacheBootstrap(data) {
    (data?.tasks || []).forEach(task => {
      if (!isShopping(task.project)) return;
      const key = `${cleanTitle(task.title)}\u0000${String(task.notes || '')}`;
      formats.set(key, task.shopping_list_format || task.shoppingListFormat || '');
    });
  }

  function formatFor(title, notes) {
    return formats.get(`${cleanTitle(title)}\u0000${String(notes || '')}`) || '';
  }

  function parseFormat(raw, fallbackText) {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data && typeof data.text === 'string' && Array.isArray(data.ranges)) return data;
    } catch (_) {}
    return { version: 1, text: String(fallbackText || ''), ranges: [] };
  }

  function appendText(parent, text, struck) {
    const parts = String(text || '').split('\n');
    parts.forEach((part, index) => {
      if (part) {
        const node = document.createElement(struck ? 'span' : 'span');
        if (struck) node.className = 'shopping-struck';
        node.textContent = part;
        parent.append(node);
      }
      if (index < parts.length - 1) parent.append(document.createElement('br'));
    });
  }

  function setEditorValue(editor, model) {
    editor.replaceChildren();
    const text = String(model.text || '');
    const ranges = [...(model.ranges || [])]
      .filter(range => Number.isInteger(range.start) && Number.isInteger(range.end) && range.end > range.start)
      .sort((a, b) => a.start - b.start);
    let index = 0;
    ranges.forEach(range => {
      const start = Math.max(index, Math.min(text.length, range.start));
      const end = Math.max(start, Math.min(text.length, range.end));
      appendText(editor, text.slice(index, start), false);
      appendText(editor, text.slice(start, end), true);
      index = end;
    });
    appendText(editor, text.slice(index), false);
    if (!text) editor.textContent = '• ';
  }

  function strikeNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    return node.matches('s,strike,.shopping-struck') || String(node.style.textDecoration || '').includes('line-through');
  }

  function serialiseEditor(editor) {
    let text = '';
    const ranges = [];
    const append = (value, struck) => {
      const start = text.length;
      text += value;
      if (struck && value) ranges.push({ start, end: text.length, strike: true });
    };
    const walk = (node, struck) => {
      if (node.nodeType === Node.TEXT_NODE) {
        append(node.nodeValue || '', struck);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.tagName === 'BR') {
        append('\n', false);
        return;
      }
      const block = /^(DIV|P|LI)$/.test(node.tagName);
      if (block && text && !text.endsWith('\n')) append('\n', false);
      [...node.childNodes].forEach(child => walk(child, struck || strikeNode(node)));
      if (block && !text.endsWith('\n')) append('\n', false);
    };
    [...editor.childNodes].forEach(node => walk(node, false));
    text = text.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
    return normaliseBullets({ version: 1, text, ranges });
  }

  function normaliseBullets(model) {
    const text = String(model.text || '');
    const map = Array(text.length + 1).fill(0);
    let output = '';
    let old = 0;
    text.split('\n').forEach((line, lineIndex, lines) => {
      const lineStart = old;
      const needsBullet = line.trim() && !line.trimStart().startsWith('• ');
      if (needsBullet) output += '• ';
      for (let i = 0; i < line.length; i += 1) {
        map[lineStart + i] = output.length;
        output += line[i];
      }
      map[lineStart + line.length] = output.length;
      old += line.length;
      if (lineIndex < lines.length - 1) {
        map[old] = output.length;
        output += '\n';
        old += 1;
      }
    });
    map[text.length] = output.length;
    const ranges = (model.ranges || []).map(range => ({
      start: map[Math.max(0, Math.min(text.length, range.start))],
      end: map[Math.max(0, Math.min(text.length, range.end))],
      strike: true
    })).filter(range => range.end > range.start);
    return { version: 1, text: output, ranges };
  }

  function showShoppingEditor(modal) {
    const project = input('Project');
    const notesField = field('Notes');
    const notes = notesField?.querySelector('textarea');
    const title = input('Title');
    if (!project || !notesField || !notes || !title) return;

    const shopping = isShopping(project.value);
    const fields = modal.querySelector('.actarium-form-grid');
    fields?.classList.toggle('actarium-shopping-mode', shopping);
    ['Custom emoji', 'End date', 'Priority', 'Task type', 'Repeat', 'Repeat until', 'Link'].forEach(label => field(label)?.classList.toggle('actarium-shopping-hidden', shopping));

    if (!shopping) {
      notesField.querySelector('.actarium-shopping-toolbar')?.remove();
      notesField.querySelector('.actarium-shopping-editor')?.remove();
      notes.style.display = '';
      return;
    }

    const emoji = input('Custom emoji');
    const end = input('End date');
    const priority = input('Priority');
    const taskType = input('Task type');
    const repeat = input('Repeat');
    const repeatUntil = input('Repeat until');
    const link = input('Link');
    const start = input('Start date') || input('Reminder date');
    if (emoji) emoji.value = '🛒';
    if (end && start) end.value = start.value;
    if (priority) priority.value = 'Normal';
    if (taskType) taskType.value = 'Personal';
    if (repeat) repeat.value = 'None';
    if (repeatUntil) repeatUntil.value = '';
    if (link) link.value = '';

    let editor = notesField.querySelector('.actarium-shopping-editor');
    if (!editor) {
      notes.style.display = 'none';
      const toolbar = document.createElement('div');
      toolbar.className = 'actarium-shopping-toolbar';
      const strike = document.createElement('button');
      strike.type = 'button';
      strike.textContent = 'S̶ Strike selected';
      strike.addEventListener('mousedown', event => event.preventDefault());
      strike.addEventListener('click', () => {
        editor.focus();
        document.execCommand('strikeThrough', false, null);
      });
      toolbar.append(strike);
      editor = document.createElement('div');
      editor.className = 'actarium-shopping-editor';
      editor.contentEditable = 'true';
      editor.setAttribute('role', 'textbox');
      editor.setAttribute('aria-label', 'Shopping items');
      const model = parseFormat(formatFor(title.value, notes.value), notes.value);
      setEditorValue(editor, model);
      notesField.append(toolbar, editor);
      editor.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          document.execCommand('insertText', false, '\n• ');
        }
      });
    }
  }

  function decorateShoppingCards() {
    document.querySelectorAll('.actarium-item').forEach(row => {
      const left = row.querySelector('.actarium-item-left');
      const title = row.querySelector('.actarium-item-title');
      const content = row.querySelector('.actarium-item-content');
      if (!left || !title || !content || !String(left.textContent || '').startsWith('Shopping List ·')) return;
      if (content.querySelector('.actarium-shopping-preview')) return;
      const matching = [...formats.keys()].find(key => key.startsWith(`${cleanTitle(title.textContent)}\u0000`));
      if (!matching) return;
      const raw = formats.get(matching);
      const model = parseFormat(raw, matching.split('\u0000')[1]);
      const preview = document.createElement('div');
      preview.className = 'actarium-shopping-preview';
      const text = model.text || '';
      const ranges = (model.ranges || []).sort((a, b) => a.start - b.start);
      let index = 0;
      ranges.forEach(range => {
        appendText(preview, text.slice(index, range.start), false);
        appendText(preview, text.slice(range.start, range.end), true);
        index = range.end;
      });
      appendText(preview, text.slice(index), false);
      content.append(preview);
    });
  }

  function setVersion() {
    document.querySelectorAll('.actarium-version').forEach(node => {
      if (node.textContent !== RELEASE) node.textContent = RELEASE;
    });
  }

  window.fetch = async (resource, options = {}) => {
    let next = options;
    try {
      if (typeof options.body === 'string') {
        const data = JSON.parse(options.body);
        if (data.action === 'saveTask' && data.task && isShopping(data.task.project)) {
          const editor = document.querySelector('.actarium-shopping-editor');
          if (editor) {
            const model = serialiseEditor(editor);
            data.task.notes = model.text;
            data.task.emoji = '🛒';
            data.task.priority = 'Normal';
            data.task.recurrence = 'None';
            data.task.repeatUntil = '';
            data.task.link = '';
            data.task.end = data.task.start;
            data.task.taskType = 'Personal';
            data.task.shoppingListFormat = JSON.stringify(model);
            next = { ...options, body: JSON.stringify(data) };
          }
        }
      }
    } catch (_) {}

    const response = await nativeFetch(resource, next);
    try {
      const url = typeof resource === 'string' ? resource : resource.url;
      if (url && url.includes('action=bootstrap')) response.clone().json().then(cacheBootstrap).then(() => decorateShoppingCards()).catch(() => {});
    } catch (_) {}
    return response;
  };

  function refresh() {
    document.querySelectorAll('.actarium-modal').forEach(showShoppingEditor);
    decorateShoppingCards();
    setVersion();
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; refresh(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('input', event => {
    if (event.target === input('Project')) refresh();
  });
  refresh();
})();
