(() => {
  const root = document.querySelector('[data-transcript-cover]');
  if (!root || !window.MagicUIMarquee || !window.CreatorMarqueeConfig) return;
  const { defaults, normalize, migrate, parseExamples, segments } = window.CreatorMarqueeConfig;
  const viewport = root.querySelector('[data-transcript-stream]');
  let settings = { ...defaults };
  let marquee;
  let renderedExamples;
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
      pair.append(sentence(raw, 'transcript-raw', 'mark'), sentence(clean, 'transcript-clean', 'strong'));
      return pair;
    });
    marquee?.destroy();
    marquee = window.MagicUIMarquee.mount(viewport, nodes);
    renderedExamples = validExamples;
  }

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
    marquee.update({ vertical: true, reverse: settings.reverse, pauseOnHover: settings.pauseOnHover,
      playbackMode: settings.playbackMode,
      repeat: settings.repeat, duration: settings.scrollDuration, gap: settings.gap, paused: paused || !settings.enabled });
    viewport.setAttribute('aria-label', staticMode ? '表达精简示例。静态阅读，可使用滚动条。' : settings.pauseOnHover ? '表达精简示例。自动循环；鼠标移入暂停，移开继续。' : '表达精简示例。自动循环。');
  }
  document.addEventListener('creator:component-settings-change', event => {
    readSettings({ components: event.detail });
  });
  reducedMotion?.addEventListener?.('change', refresh);
  readSettings();
})();
