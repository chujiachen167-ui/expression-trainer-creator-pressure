(() => {
  const STORAGE_KEY = 'read-yourself.interface-locale.v1';
  const SUPPORTED = ['zh-CN', 'en-US'];
  const catalogs = window.CreatorLocaleCatalogs || {};
  const sources = new WeakMap();
  const translatedNodes = new WeakSet();
  const sourceTitle = document.title;
  let locale = resolveInitialLocale();
  let applying = false;

  function resolveInitialLocale() {
    let saved = '';
    try { saved = localStorage.getItem(STORAGE_KEY) || ''; } catch (_) { /* Ignore blocked storage. */ }
    if (SUPPORTED.includes(saved)) return saved;
    return /^zh\b/i.test(navigator.language || '') ? 'zh-CN' : 'en-US';
  }

  function interpolate(value, variables = {}) {
    return String(value).replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
  }

  function t(key, variables, fallback = '') {
    const value = catalogs[locale]?.[key] ?? catalogs['zh-CN']?.[key] ?? fallback ?? key;
    return interpolate(value, variables);
  }

  function keyFor(node) { return node.dataset.i18n || node.dataset.qaCopyKey || ''; }

  function rememberSource(node) {
    if (!sources.has(node)) sources.set(node, node.innerHTML);
    return sources.get(node);
  }

  function applyNode(node) {
    const key = keyFor(node);
    if (!key) return;
    const source = rememberSource(node);
    const translated = catalogs[locale]?.[key];
    if (locale === 'zh-CN') {
      if (translatedNodes.has(node)) node.innerHTML = source;
    } else if (typeof translated === 'string') {
      translatedNodes.add(node);
      node.textContent = translated;
    }
  }

  function applyAttributes(node) {
    const specification = node.dataset.i18nAttr;
    if (!specification) return;
    for (const pair of specification.split(';')) {
      const [attribute, key] = pair.split(':').map(value => value?.trim());
      if (!attribute || !key) continue;
      const sourceKey = `i18nSource${attribute.replace(/(^|-)(\w)/g, (_, _dash, letter) => letter.toUpperCase())}`;
      if (!(sourceKey in node.dataset)) node.dataset[sourceKey] = node.getAttribute(attribute) || '';
      const value = locale === 'zh-CN' ? node.dataset[sourceKey] : catalogs[locale]?.[key];
      if (typeof value === 'string') node.setAttribute(attribute, value);
    }
  }

  function apply(root = document) {
    applying = true;
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
    root.querySelectorAll('[data-i18n], [data-qa-copy-key]').forEach(applyNode);
    root.querySelectorAll('[data-i18n-attr]').forEach(applyAttributes);
    document.querySelectorAll('[data-locale-select]').forEach(select => { select.value = locale; });
    const titleKey = document.body?.dataset.i18nTitle;
    if (titleKey) document.title = locale === 'zh-CN' ? sourceTitle : (catalogs[locale]?.[titleKey] || sourceTitle);
    applying = false;
    document.dispatchEvent(new CustomEvent('creator:locale-change', { detail: { locale } }));
  }

  function setLocale(nextLocale) {
    if (!SUPPORTED.includes(nextLocale) || nextLocale === locale) return false;
    locale = nextLocale;
    try { localStorage.setItem(STORAGE_KEY, locale); } catch (_) { /* Preference remains in memory. */ }
    apply();
    return true;
  }

  function bindSelectors() {
    document.querySelectorAll('[data-locale-select]').forEach(select => {
      select.value = locale;
      select.addEventListener('change', () => setLocale(select.value));
    });
  }

  window.CreatorI18n = {
    t,
    apply,
    setLocale,
    getLocale: () => locale,
    supported: [...SUPPORTED],
    isApplying: () => applying
  };

  document.addEventListener('DOMContentLoaded', () => {
    bindSelectors();
    apply();
  }, { once: true });
})();
