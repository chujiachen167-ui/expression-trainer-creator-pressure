(() => {
  if (document.body.dataset.environment === 'production') return;

  const storageKey = 'expression-trainer.creator-qa.v1';
  const panelPositionKey = 'expression-trainer.creator-qa.panel-position.v1';
  const defaults = {
    flags: { v1: true, v2: true, v3: true, camera: true, audience: true, pressure: true, transcript: true, metrics: true, feedback: true },
    theme: {
      bg: '#07080c', panel: '#0f1118', panelRaised: '#151823', control: '#0c0e13',
      border: '#252938', borderStrong: '#4c5268', text: '#f5f7ff', muted: '#8d93a7',
      accent: '#ff2f92', info: '#42e8d6', success: '#65e49b', warning: '#ffc85a', danger: '#ff5a70',
      studioBg: '#08090b', studioPanel: '#0d0f12', studioPanelRaised: '#121419', studioControl: '#090b0e',
      studioText: '#f5f5f4', studioMuted: '#6d727c', studioLine: '#202329', studioLineStrong: '#30343c', palette: 'read-ink',
      font: 'Inter, Microsoft YaHei, PingFang SC, system-ui, sans-serif', fontSize: 16
    },
    layout: { canvasWidth: 1440, leftWidth: 250, rightWidth: 290, roomHeight: 520 },
    elements: {
      header: { x: 0, y: 0, width: 0, height: 0 }, left: { x: 0, y: 0, width: 0, height: 0 },
      stage: { x: 0, y: 0, width: 0, height: 0 }, right: { x: 0, y: 0, width: 0, height: 0 },
      room: { x: 0, y: 0, width: 0, height: 0 }, camera: { x: 0, y: 0, width: 0, height: 0 },
      prompt: { x: 0, y: 0, width: 0, height: 0 }, transcript: { x: 0, y: 0, width: 0, height: 0 }, controls: { x: 0, y: 0, width: 0, height: 0 }
    },
    components: {
      logo: window.CreatorLogoConfig.defaults,
      logoBackground: window.CreatorLogoConfig.backgroundDefaults,
      productShell: window.CreatorProductShell?.defaults || { enabled: true, headerEnabled: true, accountEnabled: true, footerEnabled: true, footerBackground: '#111015', footerText: '#f4f1f5', footerMuted: '#9d98a3' },
      driftWall: {
        columns: 5, tileWidth: 200, tileHeight: 132, gap: 18, radius: 14,
        tilt: 16, turn: -14, roll: 0, perspective: 1200, depth: 120,
        speed: 42, direction: 'up', variance: 0.45, parallax: 0.6,
        pauseOnHover: false, lift: 64, fade: 0.6, dim: 0.55,
        grayscale: false, overlayColor: '#060010'
      },
      scrollExpand: {
        enabled: true, duration: 480, startRadius: 24, endRadius: 0,
        overlayScrim: 0.32, contentDelay: 0.48, easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        backgroundHandoff: true, handoffDuration: 340, handoffContentDelay: 0.16, handoffOffset: 24, handoffDirection: 'random'
      },
      warpText: {
        enabled: true, color: '#a9a3b3', warpStrength: 0.08, warpScale: 1.7,
        speed: 0.55, pointerInfluence: 0.42, pointerStrength: 0.38, refraction: 0.018, ripple: true
      },
      trueFocus: {
        enabled: true, blurAmount: 3, animationDuration: 420, pauseBetweenAnimations: 1600,
        borderColor: '#ff2f92', glowColor: '#ff2f92'
      },
      transcriptCover: window.CreatorMarqueeConfig.defaults
    },
    copy: {}, fineTune: {}, extraCopy: {}
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const merge = (base, incoming) => {
    const result = clone(base);
    Object.entries(incoming || {}).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value) && result[key]) result[key] = merge(result[key], value);
      else result[key] = value;
    });
    return result;
  };
  const migrateConfig = incoming => {
    const config = clone(incoming || {});
    if (config.components?.transcriptCover) config.components.transcriptCover = window.CreatorMarqueeConfig.migrate(config.components.transcriptCover);
    if (config.components?.logo) config.components.logo = window.CreatorLogoConfig.normalize(config.components.logo);
    if (config.components?.logoBackground) config.components.logoBackground = window.CreatorLogoConfig.normalizeBackground(config.components.logoBackground);
    if (config.components?.productShell && window.CreatorProductShell) config.components.productShell = window.CreatorProductShell.normalize(config.components.productShell);
    return config;
  };
  let projectEnvelope = window.CreatorProjectConfig && typeof window.CreatorProjectConfig === 'object'
    ? clone(window.CreatorProjectConfig)
    : { version: 1, savedAt: null, config: {} };
  let state = merge(defaults, migrateConfig(projectEnvelope.config));
  try { state = merge(state, migrateConfig(JSON.parse(localStorage.getItem(storageKey)))); } catch (_) { /* Keep the project configuration. */ }

  const selectors = {
    header: '.topbar', left: '.side-panel.left', stage: '.stage', right: '.side-panel.right', room: '.room',
    camera: '.video-tile', prompt: '.prompt-banner, .v1-topic-picker', transcript: '.transcript', controls: '.controls'
  };
  const featureSelectors = {
    camera: ['[data-camera-toggle]', '.video-tile', '.camera-target'], audience: ['.audience-tile', '.audience-stack', '.audience-primary-stage'],
    pressure: ['.pressure-group'], transcript: ['.transcript'], metrics: ['.metric-list'], feedback: ['.side-panel.right', '.loading-row', '#eventFeed']
  };
  const featureLabel = { v1: 'V1 镜头基线', v2: 'V2 数字观众', v3: 'V3 实战房间', camera: '摄像头', audience: '数字观众', pressure: '压力事件', transcript: '实时转写', metrics: '表达指标', feedback: '反馈流' };
  const elementLabel = { header: '顶栏', left: '左侧面板', stage: '中心舞台', right: '右侧面板', room: '训练窗口', camera: '镜头窗口', prompt: document.body.dataset.mode === 'v1' ? '选题块' : '任务提示', transcript: '转写区', controls: '控制区' };
  const version = document.body.dataset.mode;
  const pageKey = version || document.body.dataset.pageKey || 'launcher';
  let elementEditor;
  let initialCopyScan = true;
  const copySelector = 'h1, h2, h3, h4, h5, p, span, strong, small, a, button';
  const dynamicCopySelector = '#timer, #fillerMetric, #vagueMetric, #hedgeMetric, #repeatMetric, #speedMetric, #densityMetric, #wordMetric, #liveTranscript, #eventFeed, #reportDensity, #reportFiller, #reportHedge, #reportVague, #reportWords, .avatar-provider-state, .audience-reaction, [data-provider-status], [data-qa-provider-status]';
  if (document.documentElement.dataset.qaTitleDefault == null) document.documentElement.dataset.qaTitleDefault = document.title;

  const getByPath = path => path.split('.').reduce((obj, key) => obj[key], state);
  const setByPath = (path, value) => {
    const keys = path.split('.');
    const final = keys.pop();
    keys.reduce((obj, key) => obj[key], state)[final] = value;
    if (path.startsWith('components.logo.')) state.components.logo = window.CreatorLogoConfig.normalize(state.components.logo);
    if (path.startsWith('components.logoBackground.')) state.components.logoBackground = window.CreatorLogoConfig.normalizeBackground(state.components.logoBackground);
    if (path.startsWith('components.productShell.') && window.CreatorProductShell) state.components.productShell = window.CreatorProductShell.normalize(state.components.productShell);
    if (path.startsWith('theme.') && path !== 'theme.palette') state.theme.palette = 'custom';
    if (path === 'components.transcriptCover.pauseOnHover') state.components.transcriptCover.hoverPauseConfigured = true;
    if (path === 'components.transcriptCover.highlightStyle') state.components.transcriptCover.randomMarksVersion = 1;
  };
  const announceDraftSave = detail => document.dispatchEvent(new CustomEvent('creator:qa-draft-save', { detail }));
  const save = () => {
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(state));
      announceDraftSave({ success: true, savedAt });
      return true;
    } catch (error) {
      announceDraftSave({ success: false, error: error.message });
      return false;
    }
  };
  const makeProjectEnvelope = () => ({ version: 1, savedAt: new Date().toISOString(), config: clone(state) });
  const serializeProjectEnvelope = envelope => {
    const json = JSON.stringify(envelope, null, 2).replace(/</g, '\\u003c');
    return `/** Generated by the Expression Trainer QA control panel. */\nwindow.CreatorProjectConfig = ${json};\n`;
  };
  const download = (content, filename, type) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.hidden = true;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const acceptProjectEnvelope = envelope => {
    projectEnvelope = clone(envelope);
    window.CreatorProjectConfig = clone(envelope);
  };
  async function saveToProject() {
    const envelope = makeProjectEnvelope();
    const content = serializeProjectEnvelope(envelope);
    if (typeof window.api?.saveProjectConfig === 'function') {
      const result = await window.api.saveProjectConfig(content);
      if (!result?.success) throw new Error(result?.error || '桌面端未能写入项目配置');
      acceptProjectEnvelope(envelope);
      return { persisted: true, mode: 'desktop', path: result.path, savedAt: envelope.savedAt };
    }
    if (window.CreatorConfigFiles?.info().supported) {
      const result = await window.CreatorConfigFiles.write('project', content);
      acceptProjectEnvelope(envelope);
      return { ...result, savedAt: envelope.savedAt };
    }
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          id: 'creator-project-js',
          suggestedName: 'creator-project-config.js',
          types: [{ description: 'Expression Trainer 项目配置', accept: { 'text/javascript': ['.js'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(content); await writable.close();
        // A browser-selected location is not proof that the repository file
        // was replaced. Only the desktop bridge can confirm that exact path.
        return { persisted: true, mode: 'picker', path: handle.name, savedAt: envelope.savedAt };
      } catch (error) {
        if (error?.name === 'AbortError') return { canceled: true };
        throw error;
      }
    }
    download(content, 'creator-project-config.js', 'text/javascript;charset=utf-8');
    return { persisted: false, mode: 'download', savedAt: envelope.savedAt };
  }
  const downloadBackup = async () => {
    const envelope = makeProjectEnvelope();
    const content = JSON.stringify(envelope, null, 2);
    if (typeof window.api?.saveProjectBackup === 'function') {
      const result = await window.api.saveProjectBackup(content);
      if (result?.success) return { persisted: true, mode: 'desktop', path: result.path };
      if (!result?.unsupported) throw new Error(result?.error || '桌面端未能写入 JSON 备份');
    }
    if (window.CreatorConfigFiles?.info().supported) return window.CreatorConfigFiles.write('backup', content);
    if (typeof window.showSaveFilePicker === 'function') {
      const handle = await window.showSaveFilePicker({ id: 'creator-project-json', suggestedName: 'creator-pressure-config.json', types: [{ description: '完整参数备份', accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      await writable.write(content); await writable.close();
      return { persisted: true, mode: 'picker', path: handle.name };
    }
    const stamp = envelope.savedAt.replace(/[:.]/g, '-');
    download(content, `creator-pressure-config-${stamp}.json`, 'application/json;charset=utf-8');
    return { persisted: false, mode: 'download' };
  };
  const featureEnabled = name => state.flags[name] !== false;
  const alphaColor = (color, alpha) => {
    const hex = String(color || '').trim().replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return `rgba(255, 47, 146, ${alpha})`;
    const value = Number.parseInt(hex, 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  };
  const palettes = {
    'read-ink': { name: 'Read Ink', note: '黑墨、玫红与青绿基调。', theme: { bg: '#07080c', panel: '#0f1118', panelRaised: '#151823', control: '#0c0e13', border: '#252938', borderStrong: '#4c5268', text: '#f5f7ff', muted: '#8d93a7', accent: '#ff2f92', info: '#42e8d6', success: '#65e49b', warning: '#ffc85a', danger: '#ff5a70', studioBg: '#08090b', studioPanel: '#0d0f12', studioPanelRaised: '#121419', studioControl: '#090b0e', studioText: '#f5f5f4', studioMuted: '#6d727c', studioLine: '#202329', studioLineStrong: '#30343c' } },
    'slate-cyan': { name: 'Slate Cyan', note: '冷静、清晰，适合诊断与数据感。', theme: { bg: '#111113', panel: '#18191b', panelRaised: '#212225', control: '#161618', border: '#363a3f', borderStrong: '#4c5157', text: '#edeef0', muted: '#b0b4ba', accent: '#00a2c7', info: '#00a2c7', success: '#30a46c', warning: '#ffc53d', danger: '#e5484d', studioBg: '#111113', studioPanel: '#18191b', studioPanelRaised: '#212225', studioControl: '#161618', studioText: '#edeef0', studioMuted: '#b0b4ba', studioLine: '#363a3f', studioLineStrong: '#4c5157' } },
    'mauve-ruby': { name: 'Mauve Ruby', note: '编辑感更强，但不走霓虹路线。', theme: { bg: '#121113', panel: '#1a191b', panelRaised: '#232225', control: '#151415', border: '#3c393f', borderStrong: '#514e53', text: '#eeedef', muted: '#b9b4ba', accent: '#e54666', info: '#12a594', success: '#30a46c', warning: '#ffc53d', danger: '#e54666', studioBg: '#121113', studioPanel: '#1a191b', studioPanelRaised: '#232225', studioControl: '#151415', studioText: '#eeedef', studioMuted: '#b9b4ba', studioLine: '#3c393f', studioLineStrong: '#514e53' } },
    'sand-amber': { name: 'Sand Amber', note: '偏暖的创作工作台，强调更柔和。', theme: { bg: '#111110', panel: '#1b1b18', panelRaised: '#242421', control: '#171714', border: '#3b3a37', borderStrong: '#515049', text: '#eeeeec', muted: '#b5b5b2', accent: '#ffb224', info: '#3ba5e9', success: '#46a758', warning: '#ffb224', danger: '#e54d2e', studioBg: '#111110', studioPanel: '#1b1b18', studioPanelRaised: '#242421', studioControl: '#171714', studioText: '#eeeeec', studioMuted: '#b5b5b2', studioLine: '#3b3a37', studioLineStrong: '#515049' } },
    'olive-lime': { name: 'Olive Lime', note: '更安静的专注模式，适合长时间练习。', theme: { bg: '#111210', panel: '#181917', panelRaised: '#212220', control: '#151613', border: '#353934', borderStrong: '#4c514b', text: '#eff0ee', muted: '#b4b9b3', accent: '#46a758', info: '#3e9b9d', success: '#46a758', warning: '#ffc53d', danger: '#e5484d', studioBg: '#111210', studioPanel: '#181917', studioPanelRaised: '#212220', studioControl: '#151613', studioText: '#eff0ee', studioMuted: '#b4b9b3', studioLine: '#353934', studioLineStrong: '#4c514b' } }
  };

  function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--color-canvas', state.theme.bg); root.style.setProperty('--color-surface', state.theme.panel);
    root.style.setProperty('--color-surface-raised', state.theme.panelRaised); root.style.setProperty('--color-border', state.theme.border);
    root.style.setProperty('--color-border-strong', state.theme.borderStrong); root.style.setProperty('--color-text', state.theme.text);
    root.style.setProperty('--color-text-muted', state.theme.muted); root.style.setProperty('--color-brand', state.theme.accent);
    root.style.setProperty('--color-action', state.theme.info); root.style.setProperty('--color-success', state.theme.success);
    root.style.setProperty('--color-warning', state.theme.warning); root.style.setProperty('--color-danger', state.theme.danger);
    root.style.setProperty('--color-brand-soft', alphaColor(state.theme.accent, 0.14));
    root.style.setProperty('--bg', state.theme.bg); root.style.setProperty('--panel', state.theme.panel);
    root.style.setProperty('--panel-2', state.theme.panelRaised); root.style.setProperty('--control-bg', state.theme.control);
    root.style.setProperty('--line', state.theme.border); root.style.setProperty('--line-strong', state.theme.borderStrong);
    root.style.setProperty('--text', state.theme.text); root.style.setProperty('--muted', state.theme.muted); root.style.setProperty('--pink', state.theme.accent);
    root.style.setProperty('--cyan', state.theme.info); root.style.setProperty('--green', state.theme.success); root.style.setProperty('--yellow', state.theme.warning); root.style.setProperty('--red', state.theme.danger);
    root.style.setProperty('--pink-soft', alphaColor(state.theme.accent, 0.14)); root.style.setProperty('--pink-medium', alphaColor(state.theme.accent, 0.34));
    document.body.style.setProperty('--studio-bg', state.theme.studioBg); document.body.style.setProperty('--studio-panel', state.theme.studioPanel); document.body.style.setProperty('--studio-panel-raised', state.theme.studioPanelRaised); document.body.style.setProperty('--studio-control', state.theme.studioControl);
    document.body.style.setProperty('--studio-text', state.theme.studioText); document.body.style.setProperty('--studio-muted', state.theme.studioMuted); document.body.style.setProperty('--studio-line', state.theme.studioLine); document.body.style.setProperty('--studio-line-strong', state.theme.studioLineStrong);
    root.style.setProperty('--qa-font-size', `${state.theme.fontSize}px`); root.style.setProperty('--qa-canvas-width', `${state.layout.canvasWidth}px`);
    root.style.setProperty('--qa-left-width', `${state.layout.leftWidth}px`); root.style.setProperty('--qa-right-width', `${state.layout.rightWidth}px`);
    root.style.setProperty('--qa-room-height', `${state.layout.roomHeight}px`); document.body.style.fontFamily = state.theme.font;
  }

  function applyFeatures() {
    Object.entries(featureSelectors).forEach(([name, list]) => list.forEach(selector => document.querySelectorAll(selector).forEach(node => { node.hidden = !featureEnabled(name); })));
    document.querySelectorAll('[data-version]').forEach(node => { node.hidden = !featureEnabled(node.dataset.version); });
    if (version) document.body.classList.toggle('version-disabled', !featureEnabled(version));
    document.dispatchEvent(new CustomEvent('creator:features-change', { detail: clone(state.flags) }));
  }

  function applyElements() {
    Object.entries(selectors).forEach(([name, selector]) => document.querySelectorAll(selector).forEach(node => {
      const value = state.elements[name];
      node.style.setProperty('--qa-x', `${value.x}px`); node.style.setProperty('--qa-y', `${value.y}px`);
      node.style.setProperty('--qa-width', value.width ? `${value.width}px` : ''); node.style.setProperty('--qa-height', value.height ? `${value.height}px` : '');
    }));
  }

  function collectCopyTargets() {
    let legacyIndex = 0;
    const items = [...document.querySelectorAll(copySelector)].filter(node => {
      if (node.closest('.qa-panel, .qa-trigger, [data-qa-copy-ignore]')) return false;
      if (node.matches(dynamicCopySelector) || node.closest(dynamicCopySelector)) return false;
      return node.textContent.trim() && !node.querySelector(copySelector);
    }).map(node => {
      // Newly added static labels must not shift historical copy keys. The
      // recommendation badge previously moved every saved card/footer edit.
      const index = node.hasAttribute('data-qa-copy-added') ? null : legacyIndex++;
      // Freeze legacy keys before runtime modules insert extra controls. Added
      // copy uses a stable selector so it cannot renumber founder-edited text.
      const key = node.dataset.qaCopyKey || (initialCopyScan && index !== null ? `${pageKey}.${node.tagName.toLowerCase()}.${index}` : `${pageKey}.additional.${window.CreatorElementEditor.selectorFor(node)}`);
      node.dataset.qaCopyKey = key;
      if (node.dataset.qaCopyDefault == null) node.dataset.qaCopyDefault = node.textContent.trim();
      return { key, node, label: node.dataset.qaCopyLabel || node.textContent.trim().slice(0, 36), defaultText: node.dataset.qaCopyDefault };
    });
    initialCopyScan = false;
    return items;
  }

  function applyCopy() {
    const titleKey = `${pageKey}.document-title`;
    document.title = state.copy[titleKey] ?? document.documentElement.dataset.qaTitleDefault;
    collectCopyTargets().forEach(({ key, node, defaultText }) => {
      if (!window.CreatorElementEditor.copyFields(node).some(field => field.type === 'text')) return;
      if (node.matches('[data-camera-toggle], [data-session-toggle], [data-copy-transcript]') && node.textContent.trim() !== defaultText && node.textContent.trim() !== state.copy[key]) return;
      const value = state.copy[key] ?? defaultText;
      if (node.textContent !== value) node.textContent = value;
      node.style.whiteSpace = value.includes('\n') ? 'pre-line' : '';
    });
    document.dispatchEvent(new CustomEvent('creator:copy-change', { detail: { pageKey } }));
  }

  function applyComponents() {
    document.dispatchEvent(new CustomEvent('creator:component-settings-change', { detail: clone(state.components) }));
  }

  function apply() { applyTheme(); applyFeatures(); applyElements(); applyCopy(); applyComponents(); elementEditor?.refresh(); }

  const numberField = (label, path, min, max, step = 1) => `<label class="qa-field"><span>${label}</span><input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}"><output data-output="${path}"></output></label>`;
  const colorField = (label, path) => `<label class="qa-color"><span>${label}</span><input type="color" data-path="${path}"></label>`;
  const toggleField = (label, path) => `<label class="qa-switch qa-component-switch"><span>${label}</span><input type="checkbox" data-path="${path}"><i></i></label>`;

  function refreshInputs(panel) {
    panel.querySelectorAll('[data-path]').forEach(input => {
      let value = getByPath(input.dataset.path);
      if (state.components.transcriptCover.followTheme && /^components\.transcriptCover\.(rawColor|cleanColor|emphasisColor)$/.test(input.dataset.path)) value = state.theme.text;
      if (input.dataset.path === 'components.logo.color' && state.components.logo.followTheme) value = state.theme[state.components.logo.themeColor];
      if (input.dataset.path === 'components.logoBackground.color' && state.components.logoBackground.followTheme) value = state.theme[state.components.logoBackground.themeColor];
      if (input.type === 'checkbox') input.checked = Boolean(value); else input.value = value;
      const output = panel.querySelector(`[data-output="${input.dataset.path}"]`); if (output) output.value = value;
    });
    panel.querySelectorAll('[data-flag]').forEach(input => { input.checked = featureEnabled(input.dataset.flag); });
  }

  function addPanel() {
    const trigger = document.createElement('button');
    trigger.className = 'qa-trigger'; trigger.type = 'button'; trigger.textContent = '调控板'; trigger.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('aside');
    panel.className = 'qa-panel'; panel.hidden = true;
    panel.innerHTML = `<div class="qa-panel-head" data-qa-drag-handle title="按住此处拖动调控板"><div><strong>人工验收调控板</strong><small>UI、文案与每个视觉组件分开管理</small></div><span class="qa-drag-hint" aria-hidden="true">拖动</span><button type="button" class="qa-close" aria-label="关闭调控板">×</button></div>
      <div class="qa-tabs" role="tablist" aria-label="调控板页面">
        <button type="button" class="qa-tab active" data-qa-tab="ui" role="tab" aria-selected="true">UI 参数</button>
        <button type="button" class="qa-tab" data-qa-tab="palette" role="tab" aria-selected="false">色彩方案</button>
        <button type="button" class="qa-tab" data-qa-tab="copy" role="tab" aria-selected="false">文案</button>
        <button type="button" class="qa-tab" data-qa-tab="components" role="tab" aria-selected="false">Drift Wall</button>
        <button type="button" class="qa-tab" data-qa-tab="scroll-expand" role="tab" aria-selected="false">页面过渡</button>
        <button type="button" class="qa-tab" data-qa-tab="vertical-marquee" role="tab" aria-selected="false">Vertical Marquee</button>
        <button type="button" class="qa-tab" data-qa-tab="text-effects" role="tab" aria-selected="false">文字动效</button>
        <button type="button" class="qa-tab" data-qa-tab="logo" role="tab" aria-selected="false">Logo</button>
      </div>
      <div class="qa-scroll">
        <div class="qa-page" data-qa-page="palette" hidden>
          <section><h2>Radix Colors · 色彩方案</h2><p class="qa-hint">切换会替换整套全局与 V3 Studio Token；再到 UI 参数微调任一颜色后，当前状态会标记为“自定义”。</p><div class="qa-palette-list" data-qa-palette-list></div></section>
        </div>
        <div class="qa-page active" data-qa-page="ui">
          <section data-qa-fine-ui></section>
          <section><h2>版本与能力开关</h2><p class="qa-hint">关闭版本会从总览隐藏；关闭能力会同步停止其 UI 与训练行为。</p><div class="qa-switches">${Object.entries(featureLabel).map(([key, label]) => `<label class="qa-switch"><span>${label}</span><input type="checkbox" data-flag="${key}"><i></i></label>`).join('')}</div></section>
          <section><h2>全局视觉</h2><div class="qa-colors">${colorField('页面背景', 'theme.bg')}${colorField('基础面板', 'theme.panel')}${colorField('抬升面板', 'theme.panelRaised')}${colorField('输入与控件', 'theme.control')}${colorField('常规边框', 'theme.border')}${colorField('悬停边框', 'theme.borderStrong')}</div></section>
          <section><h2>商品化外壳</h2><p class="qa-hint">管理起始页顶部导航、本地账户入口和深色页脚。账户只是本地预览，不模拟注册、订阅或云同步。</p><div class="qa-switches qa-component-switches">${toggleField('启用商品化外壳', 'components.productShell.enabled')}${toggleField('显示顶部导航', 'components.productShell.headerEnabled')}${toggleField('显示本地账户入口', 'components.productShell.accountEnabled')}${toggleField('显示产品原则与页脚', 'components.productShell.footerEnabled')}</div><div class="qa-colors">${colorField('页脚背景', 'components.productShell.footerBackground')}${colorField('页脚主文字', 'components.productShell.footerText')}${colorField('页脚次级文字', 'components.productShell.footerMuted')}</div><p class="qa-hint">所有新增标题、栏目和说明文字都在“文案”页中编辑。</p></section>
          <section><h2>文字与状态色</h2><div class="qa-colors">${colorField('主文字', 'theme.text')}${colorField('次级文字', 'theme.muted')}${colorField('品牌强调', 'theme.accent')}${colorField('信息提示', 'theme.info')}${colorField('成功状态', 'theme.success')}${colorField('警告状态', 'theme.warning')}${colorField('错误状态', 'theme.danger')}</div></section>
          <section><h2>V3 Studio 色板</h2><p class="qa-hint">只作用于 V3 实战房间，覆盖主要表面、控件、文字和边界层级。</p><div class="qa-colors">${colorField('Studio 背景', 'theme.studioBg')}${colorField('Studio 基础面板', 'theme.studioPanel')}${colorField('Studio 抬升面板', 'theme.studioPanelRaised')}${colorField('Studio 输入控件', 'theme.studioControl')}${colorField('Studio 正文', 'theme.studioText')}${colorField('Studio 次级文字', 'theme.studioMuted')}${colorField('Studio 边界', 'theme.studioLine')}${colorField('Studio 强边界', 'theme.studioLineStrong')}</div><label class="qa-select"><span>字体</span><select data-path="theme.font"><option value="Inter, Microsoft YaHei, PingFang SC, system-ui, sans-serif">现代无衬线</option><option value="Microsoft YaHei, PingFang SC, sans-serif">中文优先</option><option value="Georgia, STFangsong, serif">衬线</option><option value="ui-monospace, Consolas, monospace">等宽</option></select></label>${numberField('全局字号', 'theme.fontSize', 12, 24)}</section>
          <section><h2>主布局尺寸</h2>${numberField('画布最大宽度', 'layout.canvasWidth', 960, 1920, 10)}${numberField('左栏宽度', 'layout.leftWidth', 160, 420, 5)}${numberField('右栏宽度', 'layout.rightWidth', 180, 460, 5)}${numberField('训练窗口高度', 'layout.roomHeight', 320, 900, 10)}</section>
          <section><h2>元素坐标与尺寸</h2><label class="qa-select"><span>选择元素</span><select id="qaElement">${Object.entries(elementLabel).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label><div id="qaElementFields"></div></section>
          <section class="qa-avatar-section"><h2>数字人 Provider（开发者）</h2><p class="qa-hint">普通用户不会看到这些字段。这里只配置本地或服务器上的数字人服务。</p><label class="qa-select"><span>来源</span><select id="qaAvatarProvider"><option value="mock">浏览器演示</option><option value="live">LiveTalking · WebRTC</option></select></label><label class="qa-provider-field"><span>服务地址</span><input id="qaAvatarServer" spellcheck="false"></label><label class="qa-provider-field"><span>Avatar IDs</span><input id="qaAvatarId" spellcheck="false" placeholder="avatar_a, avatar_b, avatar_c"></label><button type="button" class="qa-provider-save" data-qa-provider-save>保存数字人配置</button><p class="qa-provider-status" data-qa-provider-status>等待数字人模块加载…</p></section>
          <section><h2>配置操作</h2><div class="qa-actions"><button type="button" data-qa-copy>复制 JSON</button><button type="button" data-qa-reset>恢复默认</button></div><textarea class="qa-json" readonly aria-label="当前调控配置"></textarea></section>
        </div>
        <div class="qa-page" data-qa-page="copy" hidden>
          <section data-qa-fine-copy></section>
          <section class="qa-copy-section"><h2>本页文案库</h2><p class="qa-hint">输入时自动保存浏览器草稿，普通刷新不会丢。完成验收后，再把整套配置写入项目。</p><label class="qa-copy-field"><span>浏览器标签标题</span><input data-copy-document-title></label><div class="qa-copy-list" data-copy-list></div></section>
          <section><h2>恢复项目版本</h2><p class="qa-hint">保存入口已统一到调控板底部，保存范围包含所有分页，不仅是文案。</p>
            <button type="button" class="qa-project-restore" data-qa-restore-project>放弃浏览器草稿，恢复项目版本</button>
          </section>
        </div>
        <div class="qa-page" data-qa-page="components" hidden>
          <section><h2>React Bits · Drift Wall</h2><p class="qa-hint">只管理数字观众默认预览使用的 Drift Wall 参数；它是一个独立的背景组件。</p>
            ${numberField('列数', 'components.driftWall.columns', 2, 8)}${numberField('卡片宽度', 'components.driftWall.tileWidth', 100, 360, 4)}${numberField('卡片高度', 'components.driftWall.tileHeight', 80, 260, 4)}${numberField('间距', 'components.driftWall.gap', 4, 40)}${numberField('圆角', 'components.driftWall.radius', 0, 32)}
            ${numberField('倾斜', 'components.driftWall.tilt', -35, 35)}${numberField('转向', 'components.driftWall.turn', -35, 35)}${numberField('滚转', 'components.driftWall.roll', -15, 15)}${numberField('透视', 'components.driftWall.perspective', 600, 2000, 20)}${numberField('纵深', 'components.driftWall.depth', 0, 300, 5)}
            ${numberField('速度', 'components.driftWall.speed', 0, 100)}<label class="qa-select"><span>方向</span><select data-path="components.driftWall.direction"><option value="up">向上</option><option value="down">向下</option></select></label>${numberField('速度差异', 'components.driftWall.variance', 0, 1, 0.05)}${numberField('视差', 'components.driftWall.parallax', 0, 1, 0.05)}${numberField('悬浮抬升', 'components.driftWall.lift', 0, 140, 2)}${numberField('边缘淡出', 'components.driftWall.fade', 0, 1, 0.05)}${numberField('暗度', 'components.driftWall.dim', 0.1, 1, 0.05)}
            <div class="qa-switches qa-component-switches">${toggleField('悬停暂停', 'components.driftWall.pauseOnHover')}${toggleField('灰度图像', 'components.driftWall.grayscale')}</div><div class="qa-colors">${colorField('遮罩颜色', 'components.driftWall.overlayColor')}</div>
          </section>
        </div>
        <div class="qa-page" data-qa-page="scroll-expand" hidden>
          <section><h2>React Bits · Scroll Expand</h2><p class="qa-hint">页面过渡由 Scroll Expand 入口展开与 Codrops 背景接力共同构成；用于从总览进入训练层，而不是 Drift Wall 的附属设置。</p>
            <div class="qa-switches qa-component-switches">${toggleField('启用过渡', 'components.scrollExpand.enabled')}</div>
            ${numberField('过渡时长', 'components.scrollExpand.duration', 250, 1400, 10)}${numberField('起始圆角', 'components.scrollExpand.startRadius', 0, 48)}${numberField('结束圆角', 'components.scrollExpand.endRadius', 0, 48)}${numberField('遮罩暗度', 'components.scrollExpand.overlayScrim', 0, 0.85, 0.05)}${numberField('内容显现节点', 'components.scrollExpand.contentDelay', 0.2, 0.9, 0.05)}
            <label class="qa-select"><span>运动曲线</span><select data-path="components.scrollExpand.easing"><option value="cubic-bezier(0.22, 1, 0.36, 1)">柔和展开</option><option value="cubic-bezier(0.16, 1, 0.3, 1)">更有推进感</option><option value="ease-in-out">平稳</option></select></label>
          </section>
          <section><h2>Codrops · 背景接力</h2><p class="qa-hint">入口卡片扩展到全屏后，保留为旧背景；目标页从其下方被裁切揭出。顶栏先落位，训练工作台随后接管。</p>
            <div class="qa-switches qa-component-switches">${toggleField('启用背景接力', 'components.scrollExpand.backgroundHandoff')}</div>
            <label class="qa-select"><span>揭示方向</span><select data-path="components.scrollExpand.handoffDirection"><option value="random">每次随机</option><option value="up">从上方揭示</option><option value="down">从下方揭示</option><option value="left">从左侧揭示</option><option value="right">从右侧揭示</option></select></label>${numberField('接力时长', 'components.scrollExpand.handoffDuration', 260, 1400, 10)}${numberField('工作台延迟', 'components.scrollExpand.handoffContentDelay', 0, 0.7, 0.05)}${numberField('工作台位移', 'components.scrollExpand.handoffOffset', 0, 96, 2)}
          </section>
        </div>
        <div class="qa-page" data-qa-page="vertical-marquee" hidden>
          <section><h2>Magic UI · Vertical Marquee</h2><p class="qa-hint">起始页右上角的纵向表达流。只有句子，没有卡片底色或说明标签。这里修改会实时预览，并自动保存到浏览器。</p>
            <label class="qa-select"><span>播放模式</span><select data-path="components.transcriptCover.playbackMode"><option value="autoplay">自动循环播放</option><option value="system">跟随系统动态偏好</option><option value="static">静态阅读（手动滚动）</option></select></label>
            <div class="qa-switches qa-component-switches">${toggleField('启用表达流', 'components.transcriptCover.enabled')}${toggleField('向下滚动', 'components.transcriptCover.reverse')}${toggleField('鼠标移入暂停', 'components.transcriptCover.pauseOnHover')}</div>
            ${numberField('一组循环时长（毫秒）', 'components.transcriptCover.scrollDuration', 12000, 120000, 1000)}
            ${numberField('重复组数', 'components.transcriptCover.repeat', 2, 6)}
            ${numberField('句组间距（px）', 'components.transcriptCover.gap', 12, 96, 2)}
            <p class="qa-hint">默认自动向上循环，不需要滚轮触发；鼠标移入文字区域暂停、移开继续。时长越短越快。“自动循环播放”是本组件的主动播放选择，不受系统减少动态效果影响；如需遵循系统偏好，选择“跟随系统”。重复组数对应官方 repeat，不是句子数量。</p>
          </section>
          <section><h2>文字与问题词标记</h2>
            <div class="qa-switches qa-component-switches">${toggleField('字色跟随全局主题', 'components.transcriptCover.followTheme')}</div>
            <div class="qa-colors">${colorField('普通句字色', 'components.transcriptCover.rawColor')}${colorField('优化句字色', 'components.transcriptCover.cleanColor')}${colorField('问题词下划线', 'components.transcriptCover.issueColor')}${colorField('问题词高亮色', 'components.transcriptCover.highlightColor')}${colorField('优化关键词字色', 'components.transcriptCover.emphasisColor')}</div>
            <p class="qa-hint">手动调整字色会切换为独立配色；下划线与虚线框共用问题词色，高亮底色单独调节。随机模式对每处标记独立抽取，可能连续出现同一种。</p>
            <label class="qa-select"><span>问题词样式</span><select data-path="components.transcriptCover.highlightStyle"><option value="random">随机三类</option><option value="underline">细下划线</option><option value="highlight">Highlight</option><option value="box">虚线框</option><option value="both">下划线 + Highlight</option></select></label>
            ${numberField('高亮底色透明度', 'components.transcriptCover.highlightOpacity', 0, 0.5, 0.01)}
            ${numberField('普通句字号', 'components.transcriptCover.rawFontSize', 14, 24)}
            ${numberField('优化句字号', 'components.transcriptCover.cleanFontSize', 18, 36)}
            ${numberField('优化句字重', 'components.transcriptCover.cleanWeight', 600, 900, 50)}
          </section>
          <section><h2>阅读区域</h2>
            ${numberField('区域高度（px）', 'components.transcriptCover.height', 260, 640, 10)}
            ${numberField('上下渐隐范围（%）', 'components.transcriptCover.fadeSize', 0, 24)}
            ${numberField('边缘文字不透明度', 'components.transcriptCover.edgeOpacity', 0, 1, 0.05)}
            <p class="qa-hint">渐隐仅改变文字透明度，不绘制背景，也不模糊文字。</p>
          </section>
          <section><h2>悬停液化换句</h2><div class="qa-switches qa-component-switches">${toggleField('启用 Gooey 换句', 'components.transcriptCover.gooeySwapEnabled')}</div>
            ${numberField('换句过渡时长（毫秒）', 'components.transcriptCover.hoverSwapDuration', 220, 1200, 20)}${numberField('液化模糊强度', 'components.transcriptCover.gooeyBlur', 0, 14, 0.5)}${colorField('液化高光颜色', 'components.transcriptCover.gooeyColor')}
            <p class="qa-hint">正常显示口播原句；鼠标悬停或键盘聚焦句组时，原句隐去并显现优化句。三类问题词标记只作用于原句。</p>
          </section>
          <section><h2>滚动句子</h2><p class="qa-hint">编辑格式为每组两行：第一行普通句，第二行优化句；组间空一行。页面会在同一个位置悬停换句，不会同时显示两行。用 [[双括号]] 标出问题词或优化关键词。最多 20 组，每行 220 字。内容是可编辑示例，不是实时 AI 生成。</p>
            <label class="qa-copy-field"><span>句子内容</span><textarea data-path="components.transcriptCover.examples" rows="8" maxlength="9200" spellcheck="false"></textarea></label>
            <p class="qa-hint" data-marquee-example-status role="status"></p>
            <p class="qa-hint">使用底部“保存全部参数到项目”，会将这里的句子与其他分页的参数一起保存。</p>
          </section>
        </div>
        <div class="qa-page" data-qa-page="logo" hidden>
          <section><h2>Read Yourself · Logo</h2><p class="qa-hint">上方管理标题小标志，下方管理背景大图。两套参数独立，可同时显示，也可只保留一种；点击区域标题展开或收起。</p></section>
          <details class="qa-logo-group" data-qa-logo-group="small"><summary>01 · 小 Logo · 标题上方</summary><p class="qa-hint">保留你已经调好的小 Logo 参数。</p><div class="qa-logo-controls">
            <div class="qa-switches">${toggleField('显示 Logo', 'components.logo.enabled')}${toggleField('颜色跟随主题', 'components.logo.followTheme')}</div>
            <label class="qa-select"><span>跟随哪个主题色</span><select data-path="components.logo.themeColor"><option value="text">主题文字色</option><option value="accent">主题强调色</option><option value="info">主题交互色</option></select></label>
            <div class="qa-colors">${colorField('Logo 独立颜色', 'components.logo.color')}</div>
            <p class="qa-hint">手动选色会切换为独立颜色；重新开启“颜色跟随主题”即可恢复联动。白色镂空会透出页面背景。</p>
            ${numberField('不透明度（0–1）', 'components.logo.opacity', 0, 1, 0.05)}
            ${numberField('宽度（px）', 'components.logo.width', 40, 320, 2)}
            <p class="qa-hint">高度等比变化，窄屏自动限制宽度。0 不透明度保留位置；关闭“显示 Logo”则收起空位。</p>
            <label class="qa-select"><span>水平对齐</span><select data-path="components.logo.align"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
            ${numberField('与主标题间距', 'components.logo.gap', 0, 80, 2)}${numberField('X 偏移（px）', 'components.logo.x', -160, 160, 2)}${numberField('Y 偏移（px）', 'components.logo.y', -160, 160, 2)}
            <p class="qa-hint">偏移不会推开其他内容，较大偏移可能造成重叠。</p>
            <div class="qa-actions"><button type="button" data-qa-logo-reset>恢复 Logo 默认参数</button></div>
          </div></details>
          <details class="qa-logo-group" data-qa-logo-group="background" open><summary>02 · 背景大 Logo · 左侧背景层</summary><p class="qa-hint">只在左侧衬托标题；动效跟随整个起始页的鼠标，不改变小 Logo。</p><div class="qa-logo-controls">
            <label class="qa-select"><span>切换跟随动效</span><select data-path="components.logoBackground.motionMode"><option value="camera">动效 1 · 瞳孔相机在眼眶内跟随</option><option value="lens">动效 2 · 镜头内圈跟随鼠标</option><option value="combined">动效 3 · 相机与镜头同时跟随</option><option value="off">关闭跟随 · 保留随机眨眼</option></select></label>
            <p class="qa-hint" data-logo-motion-description></p>
            ${numberField('跟随柔和度（ms）', 'components.logoBackground.motionResponse', 60, 500, 10)}
            <div data-logo-motion-options="camera">${numberField('相机水平位移幅度', 'components.logoBackground.cameraTravel', 0, 80, 1)}${numberField('纵向位移比例', 'components.logoBackground.cameraVerticalRatio', 0, 1, 0.01)}${numberField('移动时相机缩放', 'components.logoBackground.cameraScale', 0.72, 1, 0.01)}</div>
            <div data-logo-motion-options="lens">${numberField('镜头位移幅度', 'components.logoBackground.lensTravel', 0, 18, 1)}</div>
            <p class="qa-hint">相机始终正对用户，只在眼眶内移动；纵向空间较窄，因此会依据缩放值自动限制，避免碰到上下眼睑。柔和度越高，跟随越缓。</p>
            <div class="qa-switches">${toggleField('启用随机眨眼', 'components.logoBackground.blinkEnabled')}</div>
            ${numberField('最短等待（秒）', 'components.logoBackground.blinkMinDelay', 1.5, 30, 0.5)}${numberField('最长等待（秒）', 'components.logoBackground.blinkMaxDelay', 2, 45, 0.5)}${numberField('眨眼时长（ms）', 'components.logoBackground.blinkDuration', 100, 600, 10)}${numberField('闭合程度', 'components.logoBackground.blinkDepth', 0.35, 1, 0.05)}
            <div class="qa-actions"><button type="button" data-qa-logo-blink-preview>立即预览眨眼</button></div>
            <p class="qa-hint">随机计时从每次眨眼结束后重新开始；“立即预览”不改变开关状态。系统开启“减少动态效果”时，跟随与眨眼都会保持静态。</p>
            <div class="qa-actions"><button type="button" data-qa-logo-motion-reset>仅恢复动效参数</button></div>
            <div class="qa-switches">${toggleField('显示背景大 Logo', 'components.logoBackground.enabled')}${toggleField('背景颜色跟随主题', 'components.logoBackground.followTheme')}</div>
            <label class="qa-select"><span>背景跟随哪个主题色</span><select data-path="components.logoBackground.themeColor"><option value="text">主题文字色</option><option value="accent">主题强调色</option><option value="info">主题交互色</option></select></label>
            <div class="qa-colors">${colorField('背景 Logo 独立颜色', 'components.logoBackground.color')}</div>
            <p class="qa-hint">手动选色会解除背景的主题联动，不改变小 Logo。</p>
            ${numberField('背景不透明度', 'components.logoBackground.opacity', 0, 1, 0.01)}
            ${numberField('宽度（左区 %）', 'components.logoBackground.width', 40, 200, 1)}
            ${numberField('X 位置（%）', 'components.logoBackground.x', -100, 100, 1)}
            ${numberField('Y 位置（%）', 'components.logoBackground.y', -100, 100, 1)}
            <p class="qa-hint">大小等比缩放；X/Y 相对于左侧背景区，0 是左／上边缘。超出的部分会裁切，不会撑大页面。若移出视野，可用下面的按钮恢复。</p>
            <div class="qa-actions"><button type="button" data-qa-background-logo-reset>恢复背景 Logo 默认参数</button></div>
            <p class="qa-hint">两套 Logo 参数、跟随方式与眨眼参数都会随底部“保存全部参数到项目”一起保存。不调用摄像头，也不会记录鼠标轨迹。</p>
          </div></details>
        </div>
        <div class="qa-page" data-qa-page="text-effects" hidden>
          <section><h2>React Bits · True Focus</h2><p class="qa-hint">只作用于首页 Read Yourself 主标题。编辑文字仍在“文案”页；这里控制焦点框和自动聚焦节奏。</p>
            <div class="qa-switches qa-component-switches">${toggleField('启用主标题动效', 'components.trueFocus.enabled')}</div>
            ${numberField('失焦模糊', 'components.trueFocus.blurAmount', 0, 10, 0.5)}${numberField('聚焦移动时长（毫秒）', 'components.trueFocus.animationDuration', 120, 900, 20)}${numberField('两次聚焦停留（毫秒）', 'components.trueFocus.pauseBetweenAnimations', 400, 5000, 100)}
            <div class="qa-colors">${colorField('焦点框颜色', 'components.trueFocus.borderColor')}${colorField('焦点光晕颜色', 'components.trueFocus.glowColor')}</div>
          </section>
          <section><h2>React Bits · Warp Text</h2><p class="qa-hint">只作用于首页副标题。使用原生 WebGL2 绘制视觉层，底层保留可编辑、可读的语义文本；设备不支持 WebGL2 时自动回退为普通文字。</p>
            <div class="qa-switches qa-component-switches">${toggleField('启用副标题动效', 'components.warpText.enabled')}${toggleField('指针波纹', 'components.warpText.ripple')}</div>
            <div class="qa-colors">${colorField('副标题颜色', 'components.warpText.color')}</div>
            ${numberField('环境扭曲', 'components.warpText.warpStrength', 0, 0.3, 0.01)}${numberField('噪声尺度', 'components.warpText.warpScale', 0.5, 4, 0.1)}${numberField('自动流动速度', 'components.warpText.speed', 0, 2, 0.05)}${numberField('指针影响范围', 'components.warpText.pointerInfluence', 0.1, 1, 0.05)}${numberField('指针扭曲强度', 'components.warpText.pointerStrength', 0, 1, 0.05)}${numberField('RGB 折射', 'components.warpText.refraction', 0, 0.08, 0.002)}
          </section>
        </div>
      </div>
      <footer class="qa-global-save" aria-label="全部参数保存">
        <details class="qa-save-location"><summary>保存位置 <span data-qa-location-name>尚未绑定项目文件夹</span></summary><p data-qa-location-paths>JS → 项目根目录 / creator-project-config.js<br>JSON → 项目根目录 / docs / creator-pressure-config.json</p><p data-qa-location-note>首次选择项目根文件夹，此后直接覆盖对应文件。JSON 只备份；页面读取 JS。保存不会自动提交 GitHub。</p><button type="button" data-qa-bind-directory>选择项目文件夹</button></details>
        <div class="qa-save-state" role="status" aria-live="polite"><i aria-hidden="true"></i><div><strong data-qa-save-status>已载入当前配置</strong><small data-qa-project-status></small></div></div>
        <div class="qa-actions qa-save-actions"><button type="button" class="qa-primary-action" data-qa-save-project>保存全部参数到项目</button><button type="button" data-qa-backup>导出全部参数 JSON</button></div>
        <p class="qa-save-scope">包含所有分页（含 Logo），以及此地址下已编辑的起始页、V1／V2／V3 文案与元素样式。图片保存引用，不打包外部图片。账号密钥、录音与设备连接配置不导出。</p>
      </footer>`;
    document.body.append(trigger, panel);

    // Keep the control panel out of the document flow: only its title bar is
    // a drag handle, so switches, sliders and text fields remain safe to use.
    const panelMargin = 12;
    const panelBounds = () => {
      const width = panel.offsetWidth || Math.min(390, Math.max(280, window.innerWidth - 28));
      const height = panel.offsetHeight || Math.min(760, Math.max(280, window.innerHeight - 96));
      return {
        maxLeft: Math.max(panelMargin, window.innerWidth - width - panelMargin),
        maxTop: Math.max(panelMargin, window.innerHeight - height - panelMargin)
      };
    };
    const clampPanelPosition = (left, top) => {
      const bounds = panelBounds();
      return {
        left: Math.round(Math.min(bounds.maxLeft, Math.max(panelMargin, Number(left) || panelMargin))),
        top: Math.round(Math.min(bounds.maxTop, Math.max(panelMargin, Number(top) || panelMargin)))
      };
    };
    const setPanelPosition = (left, top, persist = false) => {
      const position = clampPanelPosition(left, top);
      panel.style.left = `${position.left}px`;
      panel.style.top = `${position.top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      if (persist) {
        try { localStorage.setItem(panelPositionKey, JSON.stringify(position)); } catch (_) { /* Browser draft persistence is best-effort. */ }
      }
      return position;
    };
    const restorePanelPosition = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(panelPositionKey));
        if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) setPanelPosition(saved.left, saved.top);
      } catch (_) { /* The default CSS position remains available. */ }
    };
    restorePanelPosition();
    let drag = null;
    const dragHandle = panel.querySelector('[data-qa-drag-handle]');
    dragHandle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button, input, select, textarea, a, label')) return;
      const rect = panel.getBoundingClientRect();
      drag = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
      dragHandle.setPointerCapture?.(event.pointerId);
      panel.classList.add('is-dragging');
      event.preventDefault();
    });
    window.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      setPanelPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
    });
    const finishDrag = event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const position = setPanelPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY, true);
      dragHandle.releasePointerCapture?.(event.pointerId);
      drag = null;
      panel.classList.remove('is-dragging');
      panel.dataset.qaPosition = `${position.left},${position.top}`;
    };
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    window.addEventListener('resize', () => {
      const left = Number.parseFloat(panel.style.left);
      const top = Number.parseFloat(panel.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) setPanelPosition(left, top, true);
    });

    const titleKey = `${pageKey}.document-title`;
    const refreshJson = () => { panel.querySelector('.qa-json').value = JSON.stringify(state, null, 2); };
    const refreshPalettes = () => panel.querySelectorAll('[data-qa-palette]').forEach(button => button.classList.toggle('active', button.dataset.qaPalette === state.theme.palette));
    const sync = () => { apply(); save(); refreshInputs(panel); refreshJson(); refreshMarqueeEditor(); refreshPalettes(); refreshLogoMotion(); };
    const refreshLogoMotion = () => {
      const mode = state.components.logoBackground.motionMode;
      panel.querySelectorAll('[data-logo-motion-options]').forEach(node => { node.hidden = mode === 'off' || mode !== 'combined' && node.dataset.logoMotionOptions !== mode; });
      panel.querySelector('[data-path="components.logoBackground.motionResponse"]').disabled = mode === 'off';
      panel.querySelector('[data-logo-motion-description]').textContent = (version ? '请到起始页预览；这里的修改也会保存。' : '') + ({ camera: '动效 1：外轮廓固定，相机保持正面并在眼眶内追随鼠标。', lens: '动效 2：外轮廓、相机外壳和镜头外圈固定，只有内圈移动。', combined: '动效 3：相机在眼眶内移动，同时镜头内圈继续朝鼠标偏移。', off: '关闭鼠标跟随；若随机眨眼已开启，上下唇仍会按间隔闭合。' })[mode];
    };
    const refreshMarqueeEditor = () => {
      const pairs = window.CreatorMarqueeConfig.parseExamples(state.components.transcriptCover.examples);
      panel.querySelector('[data-marquee-example-status]').textContent = pairs
        ? `${pairs.length} 组句子 · 已更新预览`
        : '请保持每组两行、组间空行；当前保留上一份有效预览。';
    };
    const saveStatus = panel.querySelector('[data-qa-save-status]');
    const projectStatus = panel.querySelector('[data-qa-project-status]');
    const setSaveStatus = (message, status = 'draft') => {
      saveStatus.textContent = message;
      panel.querySelector('.qa-save-state').dataset.state = status;
    };
    const bindButton = panel.querySelector('[data-qa-bind-directory]');
    const refreshLocation = () => {
      const info = window.CreatorConfigFiles?.info();
      const desktop = typeof window.api?.saveProjectConfig === 'function';
      panel.querySelector('[data-qa-location-name]').textContent = desktop ? '桌面开发版 · 当前项目' : info?.name || '尚未绑定项目文件夹';
      bindButton.hidden = desktop || !info?.supported;
      bindButton.textContent = info?.name ? '更换项目文件夹' : '选择项目文件夹';
      panel.querySelector('[data-qa-location-note]').textContent = desktop
        ? '桌面开发版直接写入当前项目。JSON 只备份；页面读取 JS。保存不会自动提交 GitHub。'
        : !info?.supported ? '此浏览器不支持绑定目录，将使用另存为或下载。请手动替换根目录 JS；JSON 不参与页面加载。'
        : info.name ? `${info.remembered ? '已记住目录；浏览器可能要求重新授权。' : '仅本次页面记住目录；浏览器未能持久保存授权位置。'}再次保存会覆盖对应文件。JSON 只备份；页面读取 JS。`
        : '首次选择项目根文件夹，此后直接覆盖对应文件。JSON 只备份；页面读取 JS。保存不会自动提交 GitHub。';
    };
    document.addEventListener('creator:save-location-change', refreshLocation);
    refreshLocation();
    window.CreatorConfigFiles?.ready.then(refreshLocation);
    let savingFile = false;
    const fileAction = async action => {
      if (savingFile) return;
      savingFile = true;
      const buttons = panel.querySelectorAll('[data-qa-bind-directory], [data-qa-save-project], [data-qa-backup]');
      buttons.forEach(button => { button.disabled = true; });
      try { await action(); }
      finally { savingFile = false; buttons.forEach(button => { button.disabled = false; }); refreshLocation(); }
    };
    bindButton.addEventListener('click', () => fileAction(async () => {
      try {
        await window.CreatorConfigFiles.bind();
        setSaveStatus('已绑定目录，尚未写入文件；点击保存或导出即可', 'draft');
      } catch (error) { setSaveStatus(error.name === 'AbortError' ? '已取消选择，原目录与草稿保留' : error.message, error.name === 'AbortError' ? 'draft' : 'error'); }
    }));
    const updateProjectStatus = () => {
      const changed = JSON.stringify(state) !== JSON.stringify(merge(defaults, migrateConfig(projectEnvelope.config)));
      projectStatus.textContent = !projectEnvelope.savedAt ? '当前项目文件尚未保存配置 · 未同步 GitHub'
        : `${changed ? '有修改尚未写入项目' : '与已载入项目配置一致'} · 项目版本 ${new Date(projectEnvelope.savedAt).toLocaleString('zh-CN')}`;
    };
    const renderElementFields = () => {
      const key = panel.querySelector('#qaElement').value;
      panel.querySelector('#qaElementFields').innerHTML = numberField('X 位置', `elements.${key}.x`, -600, 600) + numberField('Y 位置', `elements.${key}.y`, -600, 600) + numberField('宽度（0 为自动）', `elements.${key}.width`, 0, 1600, 10) + numberField('高度（0 为自动）', `elements.${key}.height`, 0, 1000, 10);
      refreshInputs(panel);
    };
    const renderCopyFields = () => {
      const list = panel.querySelector('[data-copy-list]');
      const items = collectCopyTargets().filter(({ node }) => window.CreatorElementEditor.copyFields(node).some(field => field.type === 'text'));
      const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
      list.innerHTML = items.map(({ key, label }) => `<label class="qa-copy-field"><span>${escapeHtml(label)}</span><textarea data-copy-key="${escapeHtml(key)}" rows="2"></textarea></label>`).join('');
      list.querySelectorAll('[data-copy-key]').forEach(field => {
        const target = items.find(item => item.key === field.dataset.copyKey);
        field.value = state.copy[field.dataset.copyKey] ?? target.defaultText;
      });
      panel.querySelector('[data-copy-document-title]').value = state.copy[titleKey] ?? document.documentElement.dataset.qaTitleDefault;
    };
    const showPage = name => {
      panel.querySelectorAll('[data-qa-page]').forEach(page => { const active = page.dataset.qaPage === name; page.hidden = !active; page.classList.toggle('active', active); });
      panel.querySelectorAll('[data-qa-tab]').forEach(tab => { const active = tab.dataset.qaTab === name; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
      panel.querySelector('.qa-scroll').scrollTop = 0;
      if (name === 'copy') renderCopyFields();
      if (name === 'ui' || name === 'copy') { elementEditor?.refresh(); elementEditor?.rescan(); }
    };
    const refreshAvatarProvider = () => {
      const provider = window.CreatorAvatarProvider;
      const status = panel.querySelector('[data-qa-provider-status]');
      if (!provider) { status.textContent = '数字人模块尚未加载'; return; }
      const config = provider.loadConfig();
      panel.querySelector('#qaAvatarProvider').value = config.provider; panel.querySelector('#qaAvatarServer').value = config.serverUrl; panel.querySelector('#qaAvatarId').value = config.avatarId;
      status.textContent = config.provider === 'live' ? '已配置 LiveTalking，应用模板时连接。' : '当前使用浏览器演示，无需后端。';
    };
    const saveAvatarProvider = () => {
      const provider = window.CreatorAvatarProvider;
      const status = panel.querySelector('[data-qa-provider-status]');
      if (!provider) { status.textContent = '数字人模块尚未加载'; return; }
      provider.saveConfig({ provider: panel.querySelector('#qaAvatarProvider').value, serverUrl: panel.querySelector('#qaAvatarServer').value.trim() || provider.defaults.serverUrl, avatarId: panel.querySelector('#qaAvatarId').value.trim() });
      status.textContent = '已保存。下一次应用模板时会重新连接数字人。';
      document.dispatchEvent(new CustomEvent('creator:avatar-config-change'));
    };

    window.addEventListener('creator:avatar-provider-ready', refreshAvatarProvider);
    document.addEventListener('creator:qa-draft-save', event => {
      if (event.detail?.success) setSaveStatus(`浏览器草稿已自动保存 · ${new Date(event.detail.savedAt).toLocaleTimeString('zh-CN')}`, 'draft');
      else setSaveStatus(`浏览器草稿保存失败：${event.detail?.error || '未知错误'}`, 'error');
      updateProjectStatus();
    });
    panel.querySelector('[data-qa-provider-save]').addEventListener('click', saveAvatarProvider);
    panel.querySelector('[data-qa-palette-list]').innerHTML = Object.entries(palettes).map(([id, palette]) => `<button type="button" class="qa-palette" data-qa-palette="${id}" aria-label="应用 ${palette.name} 色彩方案"><span class="qa-palette-swatches" aria-hidden="true"><i style="background:${palette.theme.bg}"></i><i style="background:${palette.theme.panelRaised}"></i><i style="background:${palette.theme.accent}"></i><i style="background:${palette.theme.info}"></i></span><strong>${palette.name}</strong><small>${palette.note}</small></button>`).join('');
    panel.querySelector('[data-qa-palette-list]').addEventListener('click', event => {
      const button = event.target.closest('[data-qa-palette]'); if (!button) return;
      state.theme = { ...state.theme, ...clone(palettes[button.dataset.qaPalette].theme), palette: button.dataset.qaPalette };
      sync();
    });
    panel.querySelectorAll('[data-qa-tab]').forEach(tab => tab.addEventListener('click', () => showPage(tab.dataset.qaTab)));
    trigger.addEventListener('click', () => { panel.hidden = !panel.hidden; trigger.setAttribute('aria-expanded', String(!panel.hidden)); });
    panel.querySelector('.qa-close').addEventListener('click', () => trigger.click());
    panel.addEventListener('input', event => {
      const target = event.target;
      if (target.dataset.copyKey) { state.copy[target.dataset.copyKey] = target.value; applyCopy(); save(); refreshJson(); return; }
      if (target.matches('[data-copy-document-title]')) { state.copy[titleKey] = target.value; applyCopy(); save(); refreshJson(); return; }
      if (!target.dataset.path) return;
      const previous = getByPath(target.dataset.path);
      const value = target.type === 'checkbox' ? target.checked : typeof previous === 'number' ? Number(target.value) : target.value;
      const logoKey = target.dataset.path.split('.')[1];
      if (['logo', 'logoBackground'].includes(logoKey) && (target.dataset.path.endsWith('.color') || (target.dataset.path.endsWith('.followTheme') && !value))) {
        const logo = state.components[logoKey];
        if (logo.followTheme) logo.color = state.theme[logo.themeColor];
        logo.followTheme = false;
      }
      const marqueeColor = ['rawColor', 'cleanColor', 'emphasisColor'].some(key => target.dataset.path === `components.transcriptCover.${key}`);
      if (state.components.transcriptCover.followTheme && (marqueeColor || (target.dataset.path === 'components.transcriptCover.followTheme' && !value))) {
        for (const key of ['rawColor', 'cleanColor', 'emphasisColor']) state.components.transcriptCover[key] = state.theme.text;
        state.components.transcriptCover.followTheme = false;
      }
      setByPath(target.dataset.path, value); sync();
    });
    panel.addEventListener('change', event => {
      const target = event.target;
      if (target.dataset.flag) { state.flags[target.dataset.flag] = target.checked; sync(); }
      if (target.id === 'qaElement') renderElementFields();
    });
    panel.querySelector('[data-qa-copy]').addEventListener('click', async () => {
      const content = JSON.stringify(state, null, 2);
      try { await navigator.clipboard.writeText(content); } catch (_) { panel.querySelector('.qa-json').select(); document.execCommand('copy'); }
      panel.querySelector('[data-qa-copy]').textContent = '已复制'; setTimeout(() => { panel.querySelector('[data-qa-copy]').textContent = '复制 JSON'; }, 1300);
    });
    panel.querySelector('[data-qa-reset]').addEventListener('click', () => { state = clone(defaults); sync(); renderElementFields(); renderCopyFields(); });
    panel.querySelector('[data-qa-save-project]').addEventListener('click', event => fileAction(async () => {
      const button = event.currentTarget;
      button.disabled = true; button.textContent = '正在保存…';
      try {
        const result = await saveToProject();
        if (result?.canceled) setSaveStatus('已取消，没有改动项目文件', 'draft');
        else if (result.persisted) {
          const projectSaved = ['desktop', 'directory'].includes(result.mode);
          setSaveStatus(projectSaved ? `全部参数已写入${result.mode === 'directory' ? '绑定' : '当前'}项目 · 尚未提交 GitHub` : '全部参数已保存到所选文件；请确认已替换项目根目录同名文件', projectSaved ? 'project' : 'warning');
          updateProjectStatus();
        } else setSaveStatus('已下载项目配置；请把它放到项目根目录并覆盖同名文件', 'warning');
      } catch (error) { setSaveStatus(error.name === 'AbortError' ? '已取消，没有改动项目文件' : `写入项目失败：${error.message}。浏览器草稿仍保留。`, error.name === 'AbortError' ? 'draft' : 'error'); }
      finally { button.disabled = false; button.textContent = '保存全部参数到项目'; }
    }));
    panel.querySelector('[data-qa-backup]').addEventListener('click', () => fileAction(async () => {
      try {
        const result = await downloadBackup();
        setSaveStatus(result.persisted ? `JSON 备份已保存：${result.path}。未更新页面配置 JS。` : '已发起全部参数 JSON 下载 · 尚未写入项目或提交 GitHub', result.persisted ? 'draft' : 'warning');
      } catch (error) { setSaveStatus(error.name === 'AbortError' ? '已取消导出，浏览器草稿保留' : `导出失败：${error.message}。浏览器草稿未被删除，请重试。`, error.name === 'AbortError' ? 'draft' : 'error'); }
    }));
    panel.querySelector('[data-qa-restore-project]').addEventListener('click', () => {
      if (!window.confirm('确定放弃当前浏览器草稿，恢复为项目文件里的配置吗？')) return;
      state = merge(defaults, migrateConfig(projectEnvelope.config));
      sync(); renderElementFields(); renderCopyFields();
      setSaveStatus('已恢复项目版本，并同步为当前浏览器草稿', 'project');
    });

    panel.querySelector('[data-qa-logo-reset]').addEventListener('click', () => { state.components.logo = clone(window.CreatorLogoConfig.defaults); sync(); });
    panel.querySelector('[data-qa-background-logo-reset]').addEventListener('click', () => { state.components.logoBackground = clone(window.CreatorLogoConfig.backgroundDefaults); sync(); });
    panel.querySelector('[data-qa-logo-motion-reset]').addEventListener('click', () => {
      for (const key of ['motionMode', 'motionResponse', 'cameraTravel', 'cameraVerticalRatio', 'cameraScale', 'lensTravel', 'blinkEnabled', 'blinkMinDelay', 'blinkMaxDelay', 'blinkDuration', 'blinkDepth']) state.components.logoBackground[key] = window.CreatorLogoConfig.backgroundDefaults[key];
      sync();
    });
    panel.querySelector('[data-qa-logo-blink-preview]').addEventListener('click', () => document.dispatchEvent(new CustomEvent('creator:logo-blink-preview')));
    window.CreatorQAControls.updateMarquee = patch => { Object.assign(state.components.transcriptCover, patch); sync(); };
    elementEditor = window.CreatorElementEditor.mount(panel, {
      read: () => ({ styles: clone(state.fineTune[pageKey] || {}), copy: clone(state.extraCopy[pageKey] || {}) }),
      commit: (kind, config) => { state[kind === 'styles' ? 'fineTune' : 'extraCopy'][pageKey] = config; save(); refreshJson(); }
    });
    window.CreatorQAControls.inspectElements = () => elementEditor.inventory();
    renderElementFields(); renderCopyFields(); refreshJson(); refreshAvatarProvider(); refreshInputs(panel); refreshMarqueeEditor(); refreshPalettes(); refreshLogoMotion(); updateProjectStatus();
  }

  window.CreatorQAControls = { featureEnabled, getState: () => clone(state), refreshCopyLibrary: applyCopy, reset: () => { state = clone(defaults); apply(); save(); } };
  apply();
  addPanel();
})();
