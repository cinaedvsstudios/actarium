(() => {
  const leadingEmoji = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s+/u;
  const defaults = {
    'Pack for Cologne': '🧳',
    'CNR Tickets Relocation': '🎟️',
    'Use Vidu credits before reset': '🎬',
    'Amazon Prime Day Buy stuff': '🛍️',
    'Get Vodka for Cologne': '🍾',
    'Check Meshy Subscription': '🤖'
  };

  function labelledInput(label) {
    return [...document.querySelectorAll('.actarium-modal .actarium-field')].find(field => field.querySelector('span')?.textContent.trim() === label)?.querySelector('input,textarea,select') || null;
  }

  function decodeEditor() {
    const title = labelledInput('Title');
    const emoji = labelledInput('Custom emoji');
    if (!title || !emoji || title.dataset.emojiDecoded) return;
    const found = String(title.value || '').match(leadingEmoji);
    if (found) {
      emoji.value = found[1];
      title.value = title.value.replace(leadingEmoji, '');
    } else if (!emoji.value && defaults[title.value]) {
      emoji.value = defaults[title.value];
    }
    title.dataset.emojiDecoded = 'true';
  }

  function encodeBeforeSave(event) {
    const save = event.target.closest('.actarium-form-actions .primary');
    if (!save) return;
    const title = labelledInput('Title');
    const emoji = labelledInput('Custom emoji');
    if (!title || !emoji || !emoji.value.trim()) return;
    if (!leadingEmoji.test(title.value)) title.value = `${emoji.value.trim()} ${title.value}`.trim();
  }

  function fixButtons() {
    document.querySelectorAll('.actarium-item-content').forEach(button => {
      button.style.appearance = 'none';
      button.style.border = '0';
      button.style.background = 'transparent';
      button.style.padding = '0';
      button.style.color = 'inherit';
      button.style.font = 'inherit';
    });
  }

  function refresh() {
    decodeEditor();
    fixButtons();
  }

  document.addEventListener('click', encodeBeforeSave, true);
  new MutationObserver(refresh).observe(document.documentElement, { childList: true, subtree: true });
  refresh();
})();
