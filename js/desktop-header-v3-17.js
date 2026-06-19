(() => {
  const RELEASE = 'v3.17.0';
  let scheduled = false;

  function setRelease(header) {
    const version = header.querySelector('.actarium-version');
    if (version && version.textContent !== RELEASE) version.textContent = RELEASE;
  }

  function restoreMobile(header) {
    const tools = header.querySelector('.actarium-desktop-tools');
    const actions = header.querySelector(':scope > .actarium-action-row');
    if (!tools || !actions) return;
    const buttons = [...tools.querySelectorAll('[data-header-slot]')]
      .sort((a, b) => Number(a.dataset.headerSlot) - Number(b.dataset.headerSlot));
    buttons.forEach(button => {
      button.removeAttribute('data-header-slot');
      actions.append(button);
    });
    const sync = tools.querySelector('.actarium-sync-top');
    if (sync) header.append(sync);
    tools.remove();
    delete header.dataset.desktopArranged;
  }

  function arrangeDesktop(header) {
    if (window.innerWidth <= 900) {
      restoreMobile(header);
      return;
    }
    if (header.dataset.desktopArranged === 'true') {
      setRelease(header);
      return;
    }

    const main = header.querySelector(':scope > .actarium-head-main');
    const actions = header.querySelector(':scope > .actarium-action-row');
    if (!main || !actions) return;

    const dateLine = main.querySelector('.actarium-date-line');
    const date = dateLine?.querySelector('.actarium-date');
    const routine = dateLine?.querySelector('.actarium-routine-pill');
    if (dateLine && date && routine) dateLine.append(routine, date);

    const allButtons = [...actions.querySelectorAll('button')];
    const utilityButtons = allButtons.slice(0, 2);
    const navigationButtons = allButtons.slice(2);
    const tools = document.createElement('div');
    tools.className = 'actarium-desktop-tools';

    const utilityRow = document.createElement('div');
    utilityRow.className = 'actarium-desktop-utility-row';
    const sync = header.querySelector(':scope > .actarium-sync-top');
    if (sync) utilityRow.append(sync);
    utilityButtons.forEach((button, index) => {
      button.dataset.headerSlot = String(index);
      utilityRow.append(button);
    });

    const nav = document.createElement('nav');
    nav.className = 'actarium-desktop-nav';
    navigationButtons.forEach((button, index) => {
      button.dataset.headerSlot = String(index + 2);
      nav.append(button);
    });

    tools.append(utilityRow, nav);
    main.append(tools);
    header.dataset.desktopArranged = 'true';
    setRelease(header);
  }

  function refresh() {
    document.querySelectorAll('.actarium-header').forEach(arrangeDesktop);
  }

  function queue() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
    });
  }

  new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', queue);
  refresh();
})();
