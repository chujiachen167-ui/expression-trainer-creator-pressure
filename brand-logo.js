/** Approved raster and shared Logo settings. Motion is isolated to the homepage. */
(() => {
  const defaults = Object.freeze({ enabled: true, followTheme: true, themeColor: 'text', color: '#8690df', opacity: 1, width: 132, gap: 18, x: 0, y: 0, align: 'left' });
  const backgroundDefaults = Object.freeze({
    enabled: true, followTheme: true, themeColor: 'text', color: '#8690df', opacity: 0.08, width: 118, x: -16, y: -14,
    motionMode: 'camera', motionResponse: 160, cameraTravel: 50, cameraVerticalRatio: 1, cameraScale: 0.8, lensTravel: 18,
    blinkEnabled: true, blinkMinDelay: 4.5, blinkMaxDelay: 9, blinkDuration: 190, blinkDepth: 1
  });
  function normalizeWith(incoming, base, bounds) {
    const source = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
    const value = { ...base };
    for (const key of ['enabled', 'followTheme', 'blinkEnabled']) if (key in base && typeof source[key] === 'boolean') value[key] = source[key];
    for (const [key, min, max] of bounds) {
      if (source[key] !== null && source[key] !== '' && Number.isFinite(Number(source[key]))) value[key] = Math.min(max, Math.max(min, Number(source[key])));
    }
    if (/^#[\da-f]{6}$/i.test(source.color)) value.color = source.color;
    if (['text', 'accent', 'info'].includes(source.themeColor)) value.themeColor = source.themeColor;
    if ('align' in base && ['left', 'center', 'right'].includes(source.align)) value.align = source.align;
    return value;
  }
  const normalize = incoming => normalizeWith(incoming, defaults, [['opacity', 0, 1], ['width', 40, 320], ['gap', 0, 80], ['x', -160, 160], ['y', -160, 160]]);
  const normalizeBackground = incoming => {
    const value = normalizeWith(incoming, backgroundDefaults, [
      ['opacity', 0, 1], ['width', 40, 200], ['x', -100, 100], ['y', -100, 100], ['motionResponse', 60, 500],
      ['cameraTravel', 0, 80], ['cameraVerticalRatio', 0, 1], ['cameraScale', 0.72, 1], ['lensTravel', 0, 18],
      ['blinkMinDelay', 1.5, 30], ['blinkMaxDelay', 2, 45], ['blinkDuration', 100, 600], ['blinkDepth', 0.35, 1]
    ]);
    if (['off', 'camera', 'lens', 'combined'].includes(incoming?.motionMode)) value.motionMode = incoming.motionMode;
    if (value.blinkMaxDelay < value.blinkMinDelay) value.blinkMaxDelay = value.blinkMinDelay;
    return value;
  };
  window.CreatorLogoConfig = { defaults, normalize, backgroundDefaults, normalizeBackground };
  const root = document.querySelector('[data-brand-logo]');
  const background = document.querySelector('[data-brand-background]');
  if (!root) return; // Shared config in V1/V2/V3; the mark itself is launcher-only.
  const token = { text: '--color-text', accent: '--color-brand', info: '--color-action' };
  function apply(incoming) {
    const value = normalize(incoming);
    root.hidden = !value.enabled;
    root.dataset.align = value.align;
    root.style.color = value.followTheme ? `var(${token[value.themeColor]})` : value.color;
    root.style.opacity = String(value.opacity);
    root.style.setProperty('--logo-width', `${value.width}px`);
    root.style.setProperty('--logo-gap', `${value.gap}px`);
    root.style.setProperty('--logo-x', `${value.x}px`);
    root.style.setProperty('--logo-y', `${value.y}px`);
    document.dispatchEvent(new CustomEvent('creator:logo-layout-change'));
  }
  function applyBackground(incoming) {
    if (!background) return;
    const value = normalizeBackground(incoming);
    background.hidden = !value.enabled;
    background.style.color = value.followTheme ? `var(${token[value.themeColor]})` : value.color;
    background.style.opacity = String(value.opacity);
    for (const key of ['width', 'x', 'y']) background.style.setProperty(`--background-logo-${key}`, `${value[key]}%`);
  }
  function applyAll(components) { apply(components?.logo); applyBackground(components?.logoBackground); }
  document.addEventListener('creator:component-settings-change', event => applyAll(event.detail));
  applyAll(window.CreatorProjectConfig?.config?.components);
})();
