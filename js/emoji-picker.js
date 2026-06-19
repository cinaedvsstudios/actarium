(() => {
  const EMOJIS = [
    '😀','😃','😄','😁','😆','😅','😂','🙂','🙃','😉','😊','🥰','😍','😘','😎','🤓','🥳','🤩','😴','🤔','🙄','😬','😭','😡','🤯','😱','🤗','🤝','👍','👎','👏','🙏','💪','👀','🧠','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💖','✨','⭐','🌟','🔥','💥','🌈','☀️','🌙','🌧️','❄️','🌸','🌿','🍀','🌳','🌊','🎂','🍾','🍷','🍺','☕','🧃','🥤','🍕','🍔','🍟','🌮','🍣','🍜','🥗','🍎','🍉','🥦','🛒','🧺','🧳','🎒','✈️','🚆','🚇','🚕','🚗','🚌','🏨','🏖️','🗺️','📍','🎟️','🎫','🎭','🎬','📺','🎮','🎵','🎤','🎧','📸','🖼️','🪩','💃','🕺','🎨','🖌️','✍️','💻','📱','⌚','🖥️','⌨️','🖨️','💾','🔌','🔋','🤖','🧩','🛠️','🔧','⚙️','🧪','🔬','📚','📖','📝','📋','📌','📎','🗂️','📅','⏰','⏳','🔔','✅','☑️','❌','⚠️','🚨','💳','💸','💰','🪙','🏦','🧾','📈','📉','🛍️','🎁','🧴','🪥','🧻','🧼','🧹','🛏️','🏠','🔑','🪴','🐶','🐱','🐴','🦄','🐉','🦋','🐝','🦊','🐺','🪄','🔮','🗡️','🛡️','👑','💎','🧛','🧙','🧝','⚗️'
  ];

  function open(input) {
    if (!input) return;
    document.querySelector('.actarium-emoji-picker-backdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'actarium-emoji-picker-backdrop';
    const panel = document.createElement('section');
    panel.className = 'actarium-emoji-picker';
    const head = document.createElement('div');
    head.className = 'actarium-emoji-picker-head';
    const title = document.createElement('strong');
    title.textContent = 'Choose an emoji';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Filter emoji';
    search.setAttribute('aria-label', 'Filter emoji');
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.addEventListener('click', () => backdrop.remove());
    const grid = document.createElement('div');
    grid.className = 'actarium-emoji-grid';

    const render = () => {
      const query = search.value.trim().toLowerCase();
      const visible = query ? EMOJIS.filter(emoji => emoji.includes(query)) : EMOJIS;
      grid.replaceChildren();
      visible.forEach(emoji => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'actarium-emoji-choice';
        button.textContent = emoji;
        button.setAttribute('aria-label', `Use ${emoji}`);
        button.addEventListener('click', () => {
          input.value = emoji;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          backdrop.remove();
          input.focus();
        });
        grid.append(button);
      });
    };

    search.addEventListener('input', render);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.remove(); });
    head.append(title, search, close);
    panel.append(head, grid);
    backdrop.append(panel);
    document.body.append(backdrop);
    render();
    search.focus();
  }

  window.ActariumEmojiPicker = { open };
})();
