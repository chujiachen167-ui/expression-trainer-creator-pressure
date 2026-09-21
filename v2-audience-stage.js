/** 2D audience presenter. Default is an original SVG rig driven by V2 events.
 *  Local Cubism models share setExpression; Core is proprietary and not bundled.
 *  Missing Core, missing WebGL, or a failed model load restore this SVG layer.
 */
(() => {
  const expression = () => window.CreatorAudienceExpression;
  const DEFAULT_HOLD_MS = 1600;

  function holdMs() {
    const configured = Number(window.CreatorBloubAudienceRuntime?.currentSettings?.().holdMs);
    return Number.isFinite(configured) ? Math.max(400, Math.min(8000, configured)) : DEFAULT_HOLD_MS;
  }

  function knownState(state) {
    if (window.CreatorAudienceExpression?.STATES?.includes(state)) return true;
    return window.CreatorBloubAudienceRuntime?.previewIds?.().includes(state) === true;
  }

  function faceMarkup() {
    return `<svg class="v2-audience-face" viewBox="0 0 160 180" aria-hidden="true" focusable="false">
      <ellipse class="v2-face-head" cx="80" cy="86" rx="46" ry="54"/>
      <path class="v2-face-brow v2-face-brow-l" d="M52 70 q14 -10 28 0"/>
      <path class="v2-face-brow v2-face-brow-r" d="M80 70 q14 -10 28 0"/>
      <ellipse class="v2-face-eye v2-face-eye-l" cx="64" cy="88" rx="6" ry="7"/>
      <ellipse class="v2-face-eye v2-face-eye-r" cx="96" cy="88" rx="6" ry="7"/>
      <path class="v2-face-mouth" d="M66 114 q14 8 28 0"/>
    </svg>`;
  }

  function mount(tile) {
    if (!tile || tile.querySelector('[data-v2-audience-stage]')) return tile.querySelector('[data-v2-audience-stage]');
    const stage = document.createElement('div');
    stage.className = 'v2-audience-stage';
    stage.dataset.v2AudienceStage = '';
    stage.dataset.expression = 'listen';
    stage.innerHTML = `${faceMarkup()}<div class="v2-audience-bloub-host" data-v2-audience-bloub aria-hidden="true"></div><small class="v2-audience-expression-label" data-v2-expression-label></small>`;
    const glyph = tile.querySelector('.avatar');
    if (glyph) glyph.replaceWith(stage);
    else tile.prepend(stage);
    setupBloub(stage);
    setExpression(stage, 'listen');
    return stage;
  }

  function setupBloub(stage, options = {}) {
    if (!stage || !window.CreatorBloubAudienceRuntime?.createAdapter) return;
    if (!options.force && stage._bloubAvatar) return;
    if (options.force) {
      try { stage._bloubAvatar?.destroy?.(); } catch (_) {}
      stage._bloubAvatar = null;
    }
    if (stage._bloubAvatar) return;
    const adapter = window.CreatorBloubAudienceRuntime.createAdapter();
    if (!adapter) return;
    stage._bloubAvatar = adapter;
    try { adapter.attach(stage); } catch (_) { adapter.destroy?.(); stage._bloubAvatar = null; return; }
    stage.dataset.presentation = 'bloub';
    if (!stage._audienceAdapter) stage.dataset.adapterStatus = 'ready';
  }

  function restoreFallback(stage, status) {
    if (!stage) return;
    setupBloub(stage, { force: true });
    stage.dataset.presentation = stage._bloubAvatar ? 'bloub' : 'svg';
    if (status) stage.dataset.adapterStatus = status;
    const current = stage.dataset.expression || 'listen';
    try { stage._bloubAvatar?.setExpression?.(current); } catch (_) {}
    if (stage._bloubAvatar) stage.dataset.bloubState = current;
  }

  function setExpression(stage, state, options = {}) {
    const api = expression();
    const next = knownState(state) ? state : 'listen';
    stage.dataset.expression = next;
    const label = stage.querySelector('[data-v2-expression-label]');
    const previewItem = window.CreatorBloubAudienceRuntime?.previewCatalog?.().flatMap(group => group.items).find(item => item.id === next);
    if (label) {
      const named = api?.STATES?.includes(next) ? api.label(next, window.CreatorI18n?.getLocale?.()) : previewItem?.label;
      label.textContent = named || next;
    }
    const adapterReady = stage._audienceAdapter?.status === 'ready';
    let adapterRendered = false;
    if (adapterReady) {
      try { adapterRendered = stage._audienceAdapter.setExpression?.(next) === true; } catch (_) { adapterRendered = false; }
    }
    if (adapterRendered) {
      try { stage._bloubAvatar?.destroy?.(); } catch (_) {}
      stage._bloubAvatar = null;
      stage.dataset.presentation = 'adapter';
    } else {
      setupBloub(stage, { force: Boolean(stage._audienceAdapter) && !stage._bloubAvatar });
      if (!stage._bloubAvatar) setupBloub(stage);
      try {
        const bloubOk = stage._bloubAvatar?.setExpression?.(next) === true;
        if (bloubOk) stage.dataset.bloubState = next;
      } catch (_) {}
      stage.dataset.presentation = stage._bloubAvatar ? 'bloub' : 'svg';
      if (stage._audienceAdapter) stage.dataset.adapterStatus = stage._audienceAdapter.status || 'svg-fallback';
      else if (!stage._bloubAvatar) stage.dataset.adapterStatus = 'svg-fallback';
    }
    clearTimeout(stage._expressionTimer);
    stage._previewLocked = options.preview === true;
    const hold = options.preview === true ? 0 : holdMs();
    if (!stage._previewLocked && next !== 'listen' && hold > 0) {
      stage._expressionTimer = setTimeout(() => setExpression(stage, 'listen'), hold);
    }
  }

  function applyEvent(tile, event) {
    const stage = tile?.querySelector('[data-v2-audience-stage]') || mount(tile);
    if (!stage) return 'listen';
    const state = expression()?.expressionFromEvent(event) || 'listen';
    setExpression(stage, state);
    return state;
  }

  function preview(state) {
    const tiles = [...document.querySelectorAll('.audience-tile')];
    if (!tiles.length) return false;
    tiles.forEach(tile => {
      const stage = tile.querySelector('[data-v2-audience-stage]') || mount(tile);
      setExpression(stage, state, { preview: true });
    });
    return true;
  }

  function attachAdapter(stage, adapter) {
    if (!stage) return null;
    stage._audienceAdapter?.destroy?.();
    stage._audienceAdapter = adapter || null;
    stage.dataset.adapter = adapter?.kind || 'svg';
    try { adapter?.attach?.(stage); } catch (_) {}
    setExpression(stage, stage.dataset.expression || 'listen');
    return adapter || null;
  }

  function detachAdapter(stage) {
    if (!stage) return;
    stage._audienceAdapter?.destroy?.();
    stage._audienceAdapter = null;
    delete stage.dataset.adapter;
    stage.dataset.adapterStatus = 'svg-fallback';
    setupBloub(stage);
    setExpression(stage, stage.dataset.expression || 'listen');
  }

  /**
   * Local Live2D adapter. Pixel drawing is delegated to CreatorLive2DRuntime
   * when present; otherwise the official SVG presenter stays visible.
   */
  function createLocalAdapter(record) {
    if (window.CreatorLive2DRuntime?.createAdapter) return window.CreatorLive2DRuntime.createAdapter(record);
    return {
      kind: 'local-live2d',
      status: 'cubism-core-missing',
      record,
      ready: Promise.resolve(),
      setExpression() { return false; },
      destroy() {}
    };
  }

  window.CreatorAudienceStage = { mount, setExpression, applyEvent, preview, attachAdapter, detachAdapter, restoreFallback, createLocalAdapter };
})();
