/** A composition + existing brand motion. Migration never deletes old drafts. */
(() => {
  if (!document.body.classList.contains('home-fusion')) return;
  const migrate = incoming => {
    const result = JSON.parse(JSON.stringify(incoming || {}));
    result.components ||= {};
    result.copy ||= {};
    if (result.copy['launcher.document-title'] && !result.copy['launcher-fusion.document-title']) {
      result.copy['launcher-fusion.document-title'] = result.copy['launcher.document-title'];
    }
    const c = result.components;
    if (c.homeFusion?.version === 1) return result;
    c.homeFusion = { version: 1 };
    c.warpText = { ...c.warpText, enabled: false };
    c.trueFocus = { ...c.trueFocus, layout: 'stacked' };
    c.logo = { ...c.logo, width: 36, gap: 0, x: 0, y: 0, align: 'left' };
    c.logoBackground = { ...c.logoBackground, opacity: 1, width: 100, x: 0, y: 0 };
    c.transcriptCover = { ...c.transcriptCover, displayMode: 'single', height: 150, x: 0, y: 0,
      cycleMs: c.transcriptCover?.cycleMs || 3000 };
    return result;
  };
  window.CreatorHomeFusion = { migrate };
  if (window.CreatorProjectConfig?.config) window.CreatorProjectConfig.config = migrate(window.CreatorProjectConfig.config);
  const mark = document.querySelector('[data-brand-logo]');
  const slot = document.querySelector('[data-fusion-mark]');
  if (mark && slot) slot.append(mark);
  const localeButtons = [...document.querySelectorAll('[data-fusion-locale]')];
  function syncLocale() {
    const locale = window.CreatorI18n?.getLocale() || 'zh-CN';
    localeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.fusionLocale === locale)));
  }
  localeButtons.forEach(button => button.addEventListener('click', () => window.CreatorI18n?.setLocale(button.dataset.fusionLocale)));
  document.addEventListener('creator:locale-change', syncLocale);
  syncLocale();
})();
