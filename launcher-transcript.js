(() => {
  const root = document.querySelector('[data-transcript-cover]');
  if (!root || !window.MagicUIMarquee || !window.CreatorMarqueeConfig) return;
  const { defaults, normalize, migrate, parseExamples, segments } = window.CreatorMarqueeConfig;
  const viewport = root.querySelector('[data-transcript-stream]');
  let settings = { ...defaults };
  let marquee;
  let renderedExamples;
  let renderedStyle;
  let filterId = 0;
  const swaps = new Map();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const isStatic = () => settings.playbackMode === 'static' || (settings.playbackMode === 'system' && Boolean(reducedMotion?.matches));

  function readSettings(detail) {
    const state = detail || window.CreatorQAControls?.getState?.() || window.CreatorProjectConfig?.config;
    settings = normalize(migrate(state?.components?.transcriptCover));
    refresh();
  }

  function applyVisualSettings() {
    root.hidden = !settings.enabled;
    document.querySelector('.launcher-hero')?.classList.toggle('without-marquee', !settings.enabled);
    root.dataset.highlightStyle = settings.highlightStyle;
    const style = root.style;
    const themed = settings.followTheme;
    style.setProperty('--transcript-raw-color', themed ? 'var(--text)' : settings.rawColor);
    style.setProperty('--transcript-clean-color', themed ? 'var(--text)' : settings.cleanColor);
    style.setProperty('--transcript-emphasis-color', themed ? 'var(--text)' : settings.emphasisColor);
    style.setProperty('--transcript-issue-color', settings.issueColor);
    style.setProperty('--transcript-highlight-color', settings.highlightColor);
    style.setProperty('--transcript-highlight-opacity', `${settings.highlightOpacity * 100}%`);
    style.setProperty('--transcript-height', `${settings.height}px`);
    style.setProperty('--transcript-fade-size', `${settings.fadeSize}%`);
    style.setProperty('--transcript-edge-opacity', settings.edgeOpacity);
    style.setProperty('--transcript-raw-size', `${settings.rawFontSize}px`);
    style.setProperty('--transcript-clean-size', `${settings.cleanFontSize}px`);
    style.setProperty('--transcript-clean-weight', settings.cleanWeight);
    style.setProperty('--transcript-hover-duration', `${settings.hoverSwapDuration || 620}ms`);
    style.setProperty('--transcript-gooey-blur', `${settings.gooeyBlur}px`);
    style.setProperty('--transcript-gooey-color', settings.gooeyColor || settings.emphasisColor);
    root.dataset.gooeySwap = String(settings.gooeySwapEnabled !== false);
  }

  function randomStyle() {
    if (settings.highlightStyle !== 'random') return settings.highlightStyle;
    // Independent draws, not a text hash or a round-robin. Repetitions are valid.
    return ['underline', 'highlight', 'box'][Math.floor(Math.random() * 3)];
  }

  function styleMarks() {
    viewport.querySelectorAll('.transcript-raw mark').forEach(mark => { mark.dataset.problemStyle = randomStyle(); });
    renderedStyle = settings.highlightStyle;
  }

  function sentence(text, className, markedTag) {
    const line = document.createElement('p');
    line.className = className;
    segments(text).forEach(segment => {
      if (!segment.marked) { line.append(document.createTextNode(segment.text)); return; }
      const mark = document.createElement(markedTag);
      mark.textContent = segment.text;
      line.append(mark);
    });
    return line;
  }

  function renderStream() {
    const pairs = parseExamples(settings.examples);
    // Keep the last valid preview while the editor is halfway through a pair.
    const validExamples = pairs ? settings.examples : renderedExamples || defaults.examples;
    if (validExamples === renderedExamples) return;
    const nodes = parseExamples(validExamples).map(([raw, clean]) => {
      const pair = document.createElement('article');
      pair.className = 'transcript-pair';
      pair.dataset.gooeySwap = 'true';
      pair.tabIndex = 0;
      pair.setAttribute('role', 'button');
      pair.setAttribute('aria-pressed', 'false');
      pair.setAttribute('aria-label', `${raw.replace(/\[\[|\]\]/g, '')} 按回车查看精简表达。`);
      const layers = document.createElement('div');
      layers.className = 'transcript-swap-layers';
      layers.setAttribute('aria-hidden', 'true');
      layers.append(sentence(raw, 'transcript-raw', 'mark'), sentence(clean, 'transcript-clean', 'strong'));
      pair.append(layers);
      return pair;
    });
    resetSwaps();
    marquee?.destroy();
    marquee = window.MagicUIMarquee.mount(viewport, nodes);
    renderedExamples = validExamples;
    renderedStyle = null;
  }

  // Codrops GooeyTextHoverEffect: blur the shared text group in/out while
  // crossfading two layers, then REMOVE the filter at both resting states.
  // Native RAF replaces GSAP; each hovered item owns its filter so nearby
  // transitions cannot change one another. See vendor/codrops/GooeyTextHoverEffect.LICENSE.
  function swapState(pair) {
    if (swaps.has(pair)) return swaps.get(pair);
    const filter = document.getElementById('creator-gooey-text')?.cloneNode(true);
    if (filter) { filter.id = `transcript-goo-${++filterId}`; document.getElementById('creator-gooey-text').parentNode.append(filter); }
    const state = { pair, filter, blur: filter?.querySelector('feGaussianBlur'), layers: pair.querySelector('.transcript-swap-layers'),
      raw: pair.querySelector('.transcript-raw'), clean: pair.querySelector('.transcript-clean'), progress: 0, target: 0, raf: 0, pointer: false, keyboard: false, pinned: false };
    swaps.set(pair, state);
    return state;
  }
  function paintSwap(state) {
    const p = state.progress;
    const mix = p * p * (3 - 2 * p);
    const moving = p > 0 && p < 1;
    const liquid = moving && settings.gooeySwapEnabled && !reducedMotion?.matches && state.filter;
    state.raw.style.opacity = String(1 - mix);
    state.clean.style.opacity = String(mix);
    state.layers.style.filter = liquid ? `url(#${state.filter.id})` : 'none';
    // The upstream demo uses large SVG letters. Body-size Chinese strokes
    // need a smaller radius and gentler alpha threshold to stay readable.
    state.blur?.setAttribute('stdDeviation', String(liquid ? Math.sin(Math.PI * mix) * settings.gooeyBlur / 6 : 0));
    state.layers.style.setProperty('--swap-glint', liquid ? `${Math.sin(Math.PI * mix) * 55}%` : '0%');
    state.pair.dataset.swapState = moving ? 'transition' : p === 1 ? 'clean' : 'raw';
  }
  function reveal(pair, show, instant = false) {
    const state = swapState(pair);
    const target = show ? 1 : 0;
    cancelAnimationFrame(state.raf);
    state.target = target;
    pair.setAttribute('aria-pressed', String(show));
    pair.setAttribute('aria-label', `${(show ? state.clean : state.raw).textContent} ${show ? '按回车返回原表达。' : '按回车查看精简表达。'}`);
    if (instant || reducedMotion?.matches) { state.progress = target; paintSwap(state); return; }
    let last = performance.now();
    const tick = now => {
      const step = Math.min(now - last, 64) / settings.hoverSwapDuration;
      last = now;
      state.progress = target > state.progress ? Math.min(target, state.progress + step) : Math.max(target, state.progress - step);
      paintSwap(state);
      if (state.progress !== target) state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
  }
  function resetSwaps() {
    swaps.forEach(state => { cancelAnimationFrame(state.raf); state.filter?.remove(); });
    swaps.clear();
    delete viewport.dataset.keyboardPause;
  }
  const eventPair = event => event.target.closest?.('.transcript-pair');
  viewport.addEventListener('pointerover', event => {
    const pair = eventPair(event);
    if (!pair || event.pointerType === 'touch' || pair.contains(event.relatedTarget)) return;
    const state = swapState(pair); state.pointer = true; reveal(pair, true);
  });
  viewport.addEventListener('pointerout', event => {
    const pair = eventPair(event);
    if (!pair || event.pointerType === 'touch' || pair.contains(event.relatedTarget)) return;
    const state = swapState(pair); state.pointer = false; reveal(pair, state.keyboard || state.pinned);
  });
  viewport.addEventListener('focusin', event => {
    const pair = eventPair(event);
    if (!pair || !pair.matches(':focus-visible')) return;
    swapState(pair).keyboard = true; viewport.dataset.keyboardPause = 'true'; reveal(pair, true, true);
  });
  viewport.addEventListener('focusout', event => {
    const pair = eventPair(event);
    if (!pair) return;
    const state = swapState(pair); state.keyboard = false; state.pinned = false;
    delete viewport.dataset.keyboardPause; reveal(pair, state.pointer, true);
  });
  viewport.addEventListener('click', event => {
    const pair = eventPair(event);
    if (!pair || event.pointerType === 'mouse') return;
    const state = swapState(pair);
    swaps.forEach(other => { if (other !== state && other.pinned) { other.pinned = false; reveal(other.pair, other.pointer || other.keyboard); } });
    state.pinned = !state.pinned; reveal(pair, state.pinned, event.detail === 0);
  });
  viewport.addEventListener('keydown', event => {
    const pair = eventPair(event);
    if (!pair) return;
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); reveal(pair, swapState(pair).target === 0, true); }
    if (event.key === 'Escape') { swapState(pair).pinned = false; reveal(pair, false, true); }
  });

  function refresh() {
    applyVisualSettings();
    renderStream();
    const staticMode = isStatic();
    const paused = staticMode;
    if (root.dataset.static === 'true' && !staticMode) {
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
    }
    root.dataset.static = String(staticMode);
    const previousRepeat = viewport.childElementCount;
    marquee.update({ vertical: true, reverse: settings.reverse, pauseOnHover: settings.pauseOnHover,
      playbackMode: settings.playbackMode,
      repeat: settings.repeat, duration: settings.scrollDuration, gap: settings.gap, paused: paused || !settings.enabled });
    if (previousRepeat !== viewport.childElementCount) { resetSwaps(); renderedStyle = null; }
    if (renderedStyle !== settings.highlightStyle) styleMarks();
    swaps.forEach(state => reveal(state.pair, state.target === 1, true));
    viewport.setAttribute('aria-label', staticMode ? '表达精简示例。静态阅读，可使用滚动条。' : settings.pauseOnHover ? '表达精简示例。自动循环；鼠标移入暂停，移开继续。' : '表达精简示例。自动循环。');
  }
  document.addEventListener('creator:component-settings-change', event => {
    readSettings({ components: event.detail });
  });
  reducedMotion?.addEventListener?.('change', refresh);
  readSettings();
})();
