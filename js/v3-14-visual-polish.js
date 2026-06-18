(() => {
  const labels = {
    Today: '🌅 Today', Week: '🗓️ Week', Month: '🌙 Month', Tasks: '✅ Tasks', Apps: '🧩 Apps', Archive: '🗄️ Archive', 'New task': '✨ New task', All: '🌐 All', ChrisFit: '🥦 ChrisFit', Viaticum: '🎒 Viaticum', Open: '↗ Open', Save: '💾 Save', Duplicate: '⧉ Duplicate', 'Mark as done': '✓ Mark as done', Delete: '🗑 Delete', Routines: '🔁 Routines', Schedules: '📅 Schedules', 'Add routine': '➕ Add routine', 'Add schedule': '➕ Add schedule'
  };
  const taskEmoji = {
    'Pack for Cologne': '🧳',
    'CNR Tickets Relocation': '🎟️',
    'Use Vidu credits before reset': '🎬',
    'Amazon Prime Day Buy stuff': '🛍️',
    'Get Vodka for Cologne': '🍾',
    'Check Meshy Subscription': '🤖'
  };

  function decorateButtons() {
    document.querySelectorAll('button').forEach(button => {
      const text = String(button.textContent || '').trim();
      if (labels[text] && !button.dataset.labelPolished) {
        button.textContent = labels[text];
        button.dataset.labelPolished = 'true';
      }
    });
  }

  function decorateCards() {
    document.querySelectorAll('.actarium-card').forEach(card => {
      const heading = String(card.querySelector('h2')?.textContent || '').toLowerCase();
      if (heading.includes('chrisfit')) card.classList.add('is-chrisfit');
      if (heading.includes('viaticum')) card.classList.add('is-viaticum');
      if (heading.startsWith('tasks')) card.classList.add('is-tasks');
      if (heading.startsWith('reminders')) card.classList.add('is-reminders');
    });
  }

  function decorateApps() {
    document.querySelectorAll('.actarium-app-group').forEach(group => {
      const heading = String(group.querySelector('h3')?.textContent || '').toLowerCase();
      if (heading.includes('my apps')) group.classList.add('group-my');
      if (heading.includes('admin')) group.classList.add('group-admin');
      if (heading.includes('creative')) group.classList.add('group-creative');
    });
  }

  function moveSync() {
    const header = document.querySelector('.actarium-header');
    const sync = header?.querySelector('.actarium-sync-pill');
    if (!header || !sync || sync.parentElement.classList.contains('actarium-sync-top')) return;
    const holder = document.createElement('div');
    holder.className = 'actarium-sync-top';
    sync.parentElement?.removeChild(sync);
    holder.append(sync);
    header.append(holder);
  }

  function moveEmojiToTitle() {
    document.querySelectorAll('.actarium-item').forEach(card => {
      const title = card.querySelector('.actarium-item-title');
      const right = card.querySelector('.actarium-item-right');
      if (!title || !right || title.dataset.emojiPlaced) return;
      let chip = right.querySelector('.actarium-emoji-chip');
      if (!chip) {
        const icon = taskEmoji[String(title.textContent || '').trim()];
        if (icon) {
          chip = document.createElement('span');
          chip.className = 'actarium-emoji-chip';
          chip.textContent = icon;
        }
      }
      if (chip) {
        chip.remove();
        title.prepend(document.createTextNode(' '));
        title.prepend(chip);
      }
      title.dataset.emojiPlaced = 'true';
    });
  }

  function refresh() {
    decorateButtons();
    decorateCards();
    decorateApps();
    moveSync();
    moveEmojiToTitle();
  }

  let waiting = false;
  new MutationObserver(() => {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(() => { waiting = false; refresh(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
