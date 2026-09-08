/** A composition + existing brand motion. Migration never deletes old drafts. */
(() => {
  if (!document.body.classList.contains('home-fusion')) return;
  const layoutKeys = ['x', 'y', 'width', 'height', 'min-width', 'max-width'];
  function stripLayoutFineTune(page) {
    if (!page || typeof page !== 'object') return;
    for (const [selector, parts] of Object.entries(page)) {
      if (!parts || typeof parts !== 'object' || Array.isArray(parts)) continue; // keep non-style draft flags
      for (const [part, values] of Object.entries(parts)) {
        if (!values || typeof values !== 'object') continue;
        layoutKeys.forEach(key => { delete values[key]; });
        if (!Object.keys(values).length) delete parts[part];
      }
      if (!Object.keys(parts).length) delete page[selector];
    }
  }
  const migrate = incoming => {
    const result = JSON.parse(JSON.stringify(incoming || {}));
    result.components ||= {};
    result.copy ||= {};
    if (result.copy['launcher.document-title'] && !result.copy['launcher-fusion.document-title']) {
      result.copy['launcher-fusion.document-title'] = result.copy['launcher.document-title'];
    }
    const c = result.components;
    if (c.homeFusion?.visualVersion !== 5) {
      c.homeFusion = { ...c.homeFusion, visualVersion: 5 };
      c.logoBackground = { ...c.logoBackground, width: 100, x: 0, y: 0, opacity: .12 };
      c.transcriptCover = { ...c.transcriptCover, displayMode: 'stream', height: 480, gap: 26,
        swapTrigger: 'blink', pauseOnHover: false, hoverPauseConfigured: true };
      stripLayoutFineTune(result.fineTune?.launcher);
      stripLayoutFineTune(result.fineTune?.['launcher-fusion']);
    }
    if (c.homeFusion?.version === 1) return result;
    c.homeFusion = { version: 1, visualVersion: 5 };
    c.warpText = { ...c.warpText, enabled: false };
    c.trueFocus = { ...c.trueFocus, layout: 'stacked' };
    c.logo = { ...c.logo, width: 36, gap: 0, x: 0, y: 0, align: 'left' };
    c.transcriptCover = { ...c.transcriptCover, displayMode: 'stream', height: 480, x: 0, y: 0,
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
