/** V2 presentation migration: retain the founder's split without fixed-width overlap. */
(() => {
  if (document.body.dataset.mode !== 'v2') return;
  function pruneEmptyFineTune(page) {
    if (!page || typeof page !== 'object') return;
    for (const [selector, parts] of Object.entries(page)) {
      if (!parts || typeof parts !== 'object') { delete page[selector]; continue; }
      for (const [part, values] of Object.entries(parts)) {
        if (!values || typeof values !== 'object' || !Object.keys(values).length) delete parts[part];
      }
      if (!Object.keys(parts).length) delete page[selector];
    }
  }
  function migrate(config) {
    config.components ||= {};
    const fine = config.fineTune?.v2;
    const prefix = 'body > main:nth-of-type(1) > section:nth-of-type(1) > div:nth-of-type(2)';
    const audienceKey = `${prefix} > div:nth-of-type(1)`;
    const creatorKey = `${prefix} > div:nth-of-type(2)`;
    if (fine) {
      const audience = Number(fine[audienceKey]?.self?.width);
      const creator = Number(fine[creatorKey]?.self?.width);
      config.components.v2Stage ||= {};
      if (audience > 0 && creator > 0) config.components.v2Stage.audienceShare = Math.max(50, Math.min(75, audience / (audience + creator) * 100));
      for (const [oldKey, nextKey] of [[audienceKey, '[id="v2AudienceStage"]'], [creatorKey, '[id="v2CreatorStage"]']]) {
        if (!fine[oldKey]) continue;
        const entry = JSON.parse(JSON.stringify(fine[oldKey]));
        delete entry.self?.width;
        delete entry.self?.x;
        fine[nextKey] = { ...entry, ...fine[nextKey] };
        delete fine[oldKey];
      }
    }
    if (config.components.v2Focus?.visualVersion !== 3) {
      // Retire superseded V2 sidebar colors and leftover box offsets, never V1 edits.
      const v2 = config.fineTune?.v2 || {};
      for (const pressure of ['low', 'medium', 'high']) delete v2[`button[data-pressure="${pressure}"]`]?.self?.['background-color'];
      delete v2['body > main:nth-of-type(1) > aside:nth-of-type(1) > h2:nth-of-type(2)']?.self?.color;
      for (const parts of Object.values(v2)) {
        if (!parts?.self) continue;
        delete parts.self.x;
        delete parts.self.y;
        delete parts.self.width;
        delete parts.self.height;
        delete parts.self['min-width'];
        delete parts.self['max-width'];
      }
      pruneEmptyFineTune(v2);
      config.components.v2Focus = { ...config.components.v2Focus, visualVersion: 3 };
    }
    return config;
  }
  window.CreatorV2Focus = { migrate };
  if (window.CreatorProjectConfig?.config) migrate(window.CreatorProjectConfig.config);
  function apply(components) {
    const share = Math.max(50, Math.min(75, Number(components?.v2Stage?.audienceShare) || 60));
    document.body.style.setProperty('--v2-audience-share', `${share}fr`);
    document.body.style.setProperty('--v2-creator-share', `${100 - share}fr`);
  }
  apply(window.CreatorProjectConfig?.config?.components);
  document.addEventListener('creator:component-settings-change', event => apply(event.detail));
  const toggle = document.querySelector('.v2-feedback-toggle');
  const content = document.getElementById('v2FeedbackBody');
  function labelToggle() {
    const open = toggle?.getAttribute('aria-expanded') === 'true';
    const fallback = open ? '收起实时反馈' : '展开实时反馈';
    const label = window.CreatorI18n?.t(open ? 'v2.feedback.collapse' : 'v2.feedback.expand', {}, fallback) || fallback;
    toggle?.setAttribute('aria-label', label);
    toggle?.setAttribute('title', label);
  }
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    content.hidden = !open;
    document.body.classList.toggle('v2-feedback-collapsed', !open);
    labelToggle();
  });
  document.addEventListener('creator:locale-change', labelToggle);
  labelToggle();
})();
