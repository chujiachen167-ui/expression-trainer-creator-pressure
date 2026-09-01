/** Honest commercial shell for the local launcher: navigation, account menu and footer. */
(() => {
  const defaults = Object.freeze({
    enabled: true,
    headerEnabled: true,
    accountEnabled: true,
    footerEnabled: true,
    footerBackground: '#111015',
    footerText: '#f4f1f5',
    footerMuted: '#9d98a3'
  });
  const isHex = value => /^#[\da-f]{6}$/i.test(value || '');
  function normalize(incoming) {
    const source = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
    const value = { ...defaults };
    for (const key of ['enabled', 'headerEnabled', 'accountEnabled', 'footerEnabled']) {
      if (typeof source[key] === 'boolean') value[key] = source[key];
    }
    for (const key of ['footerBackground', 'footerText', 'footerMuted']) if (isHex(source[key])) value[key] = source[key];
    return value;
  }
  window.CreatorProductShell = { defaults, normalize };

  const header = document.querySelector('[data-product-shell="header"]');
  const footerParts = [...document.querySelectorAll('[data-product-shell="footer"]')];
  const account = document.querySelector('[data-product-account]');
  const trigger = document.querySelector('[data-account-trigger]');
  const panel = document.querySelector('[data-account-panel]');
  if (!header || !trigger || !panel) return;

  function apply(incoming) {
    const value = normalize(incoming);
    header.hidden = !value.enabled || !value.headerEnabled;
    account.hidden = !value.enabled || !value.headerEnabled || !value.accountEnabled;
    footerParts.forEach(node => { node.hidden = !value.enabled || !value.footerEnabled; });
    document.documentElement.style.setProperty('--product-footer-bg', value.footerBackground);
    document.documentElement.style.setProperty('--product-footer-text', value.footerText);
    document.documentElement.style.setProperty('--product-footer-muted', value.footerMuted);
    if (account.hidden) closeAccount(false);
  }
  function closeAccount(returnFocus = false) {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }
  function openAccount() {
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  }
  function openSettings(tabName) {
    const qaTrigger = document.querySelector('.qa-trigger');
    const tab = document.querySelector(`[data-qa-tab="${tabName}"]`);
    if (!qaTrigger || !tab) {
      const note = panel.querySelector('[data-account-note]');
      if (note) note.textContent = '设置中心仅在本地开发预览中开放。';
      return;
    }
    if (qaTrigger.getAttribute('aria-expanded') !== 'true') qaTrigger.click();
    tab.click();
    closeAccount(false);
  }

  trigger.addEventListener('click', () => panel.hidden ? openAccount() : closeAccount(false));
  panel.querySelectorAll('[data-open-product-settings]').forEach(button => {
    button.addEventListener('click', () => openSettings(button.dataset.openProductSettings));
  });
  document.addEventListener('pointerdown', event => {
    if (!account.contains(event.target)) closeAccount(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closeAccount(true);
  });
  document.addEventListener('creator:component-settings-change', event => apply(event.detail?.productShell));
  apply(window.CreatorProjectConfig?.config?.components?.productShell);
})();
