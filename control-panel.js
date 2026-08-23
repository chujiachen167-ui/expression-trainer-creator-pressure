(() => {
  const storageKey = 'expression-trainer.creator-qa.v1';
  const defaults = {
    flags: { v1: true, v2: true, v3: true, camera: true, audience: true, pressure: true, transcript: true, metrics: true, feedback: true },
    theme: { bg: '#07080c', panel: '#0f1118', text: '#f5f7ff', accent: '#ff2f92', font: 'Inter, Microsoft YaHei, PingFang SC, system-ui, sans-serif', fontSize: 16 },
    layout: { canvasWidth: 1440, leftWidth: 250, rightWidth: 290, roomHeight: 520 },
    elements: {
      header: { x: 0, y: 0, width: 0, height: 0 }, left: { x: 0, y: 0, width: 0, height: 0 },
      stage: { x: 0, y: 0, width: 0, height: 0 }, right: { x: 0, y: 0, width: 0, height: 0 },
      room: { x: 0, y: 0, width: 0, height: 0 }, camera: { x: 0, y: 0, width: 0, height: 0 },
      prompt: { x: 0, y: 0, width: 0, height: 0 }, transcript: { x: 0, y: 0, width: 0, height: 0 }, controls: { x: 0, y: 0, width: 0, height: 0 }
    }
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const merge = (base, incoming) => {
    const result = clone(base);
    for (const [key, value] of Object.entries(incoming || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value) && result[key]) result[key] = merge(result[key], value);
      else result[key] = value;
    }
    return result;
  };
  let state;
  try { state = merge(defaults, JSON.parse(localStorage.getItem(storageKey))); } catch (_) { state = clone(defaults); }

  const selectors = {
    header: '.topbar', left: '.side-panel.left', stage: '.stage', right: '.side-panel.right', room: '.room',
    camera: '.video-tile', prompt: '.prompt-banner', transcript: '.transcript', controls: '.controls'
  };
  const featureSelectors = {
    camera: ['[data-camera-toggle]', '.video-tile', '.camera-target'], audience: ['.audience-tile', '.audience-stack'],
    pressure: ['.pressure-group'], transcript: ['.transcript'], metrics: ['.metric-list'], feedback: ['.side-panel.right', '.loading-row', '#eventFeed']
  };
  const version = document.body.dataset.mode;

  function save() { localStorage.setItem(storageKey, JSON.stringify(state)); }
  function root() { return document.documentElement; }
  function featureEnabled(name) { return state.flags[name] !== false; }
  function applyTheme() {
    root().style.setProperty('--bg', state.theme.bg); root().style.setProperty('--panel', state.theme.panel);
    root().style.setProperty('--text', state.theme.text); root().style.setProperty('--pink', state.theme.accent);
    root().style.setProperty('--qa-font-size', `${state.theme.fontSize}px`); root().style.setProperty('--qa-canvas-width', `${state.layout.canvasWidth}px`);
    root().style.setProperty('--qa-left-width', `${state.layout.leftWidth}px`); root().style.setProperty('--qa-right-width', `${state.layout.rightWidth}px`);
    root().style.setProperty('--qa-room-height', `${state.layout.roomHeight}px`); document.body.style.fontFamily = state.theme.font;
  }
  function applyFeatures() {
    Object.entries(featureSelectors).forEach(([name, list]) => list.forEach(selector => document.querySelectorAll(selector).forEach(node => node.hidden = !featureEnabled(name))));
    document.querySelectorAll('[data-version]').forEach(node => node.hidden = !featureEnabled(node.dataset.version));
    if (version) document.body.classList.toggle('version-disabled', !featureEnabled(version));
    document.dispatchEvent(new CustomEvent('creator:features-change', { detail: clone(state.flags) }));
  }
  function applyElements() {
    Object.entries(selectors).forEach(([name, selector]) => {
      const value = state.elements[name];
      document.querySelectorAll(selector).forEach(node => {
        node.style.setProperty('--qa-x', `${value.x}px`); node.style.setProperty('--qa-y', `${value.y}px`);
        node.style.setProperty('--qa-width', value.width ? `${value.width}px` : ''); node.style.setProperty('--qa-height', value.height ? `${value.height}px` : '');
      });
    });
  }
  function apply() { applyTheme(); applyFeatures(); applyElements(); }

  const featureLabel = { v1: 'V1 镜头基线', v2: 'V2 数字观众', v3: 'V3 实战房间', camera: '摄像头', audience: '数字观众', pressure: '压力事件', transcript: '实时转写', metrics: '表达指标', feedback: '反馈流' };
  const elementLabel = { header: '顶栏', left: '左侧面板', stage: '中心舞台', right: '右侧面板', room: '训练窗口', camera: '镜头窗口', prompt: '任务提示', transcript: '转写区', controls: '控制区' };
  const numberField = (label, path, min, max, step = 1) => `<label class="qa-field"><span>${label}</span><input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}"><output data-output="${path}"></output></label>`;
  const colorField = (label, path) => `<label class="qa-color"><span>${label}</span><input type="color" data-path="${path}"></label>`;

  function getByPath(path) { return path.split('.').reduce((obj, key) => obj[key], state); }
  function setByPath(path, value) {
    const keys = path.split('.'); const final = keys.pop(); const parent = keys.reduce((obj, key) => obj[key], state);
    parent[final] = value;
  }
  function refreshInputs(panel) {
    panel.querySelectorAll('[data-path]').forEach(input => {
      const value = getByPath(input.dataset.path); input.value = value;
      const output = panel.querySelector(`[data-output="${input.dataset.path}"]`); if (output) output.value = value;
    });
    panel.querySelectorAll('[data-flag]').forEach(input => input.checked = featureEnabled(input.dataset.flag));
  }
  function addPanel() {
    const trigger = document.createElement('button'); trigger.className = 'qa-trigger'; trigger.type = 'button'; trigger.textContent = '调控板'; trigger.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('aside'); panel.className = 'qa-panel'; panel.hidden = true;
    panel.innerHTML = `<div class="qa-panel-head"><div><strong>人工验收调控板</strong><small>配置保存在此浏览器</small></div><button type="button" class="qa-close" aria-label="关闭调控板">×</button></div>
      <div class="qa-scroll">
        <section><h2>版本与能力开关</h2><p class="qa-hint">关闭版本会从总览隐藏；关闭能力会同步停止其 UI 与训练行为。</p><div class="qa-switches">${Object.entries(featureLabel).map(([key, label]) => `<label class="qa-switch"><span>${label}</span><input type="checkbox" data-flag="${key}"><i></i></label>`).join('')}</div></section>
        <section><h2>全局视觉</h2><div class="qa-colors">${colorField('背景', 'theme.bg')}${colorField('面板', 'theme.panel')}${colorField('正文', 'theme.text')}${colorField('强调', 'theme.accent')}</div>
          <label class="qa-select"><span>字体</span><select data-path="theme.font"><option value="Inter, Microsoft YaHei, PingFang SC, system-ui, sans-serif">现代无衬线</option><option value="Microsoft YaHei, PingFang SC, sans-serif">中文优先</option><option value="Georgia, STFangsong, serif">衬线</option><option value="ui-monospace, Consolas, monospace">等宽</option></select></label>
          ${numberField('全局字号', 'theme.fontSize', 12, 24)}</section>
        <section><h2>主布局尺寸</h2>${numberField('画布最大宽度', 'layout.canvasWidth', 960, 1920, 10)}${numberField('左栏宽度', 'layout.leftWidth', 160, 420, 5)}${numberField('右栏宽度', 'layout.rightWidth', 180, 460, 5)}${numberField('训练窗口高度', 'layout.roomHeight', 320, 900, 10)}</section>
        <section><h2>元素坐标与尺寸</h2><label class="qa-select"><span>选择元素</span><select id="qaElement">${Object.entries(elementLabel).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label><div id="qaElementFields"></div></section>
        <section><h2>配置操作</h2><div class="qa-actions"><button type="button" data-qa-copy>复制 JSON</button><button type="button" data-qa-reset>恢复默认</button></div><textarea class="qa-json" readonly aria-label="当前调控配置"></textarea></section>
      </div>`;
    document.body.append(trigger, panel);
    const elementFields = panel.querySelector('#qaElementFields');
    const renderElementFields = () => {
      const key = panel.querySelector('#qaElement').value;
      elementFields.innerHTML = numberField('X 位置', `elements.${key}.x`, -600, 600) + numberField('Y 位置', `elements.${key}.y`, -600, 600) + numberField('宽度（0 为自动）', `elements.${key}.width`, 0, 1600, 10) + numberField('高度（0 为自动）', `elements.${key}.height`, 0, 1000, 10);
      refreshInputs(panel);
    };
    const refreshJson = () => { panel.querySelector('.qa-json').value = JSON.stringify(state, null, 2); };
    const sync = () => { apply(); save(); refreshInputs(panel); refreshJson(); };
    trigger.addEventListener('click', () => { panel.hidden = !panel.hidden; trigger.setAttribute('aria-expanded', String(!panel.hidden)); });
    panel.querySelector('.qa-close').addEventListener('click', () => trigger.click());
    panel.addEventListener('input', event => {
      const target = event.target; if (!target.dataset.path) return;
      const previous = getByPath(target.dataset.path); setByPath(target.dataset.path, typeof previous === 'number' ? Number(target.value) : target.value); sync();
    });
    panel.addEventListener('change', event => {
      const target = event.target;
      if (target.dataset.flag) { state.flags[target.dataset.flag] = target.checked; sync(); }
      if (target.id === 'qaElement') renderElementFields();
    });
    panel.querySelector('[data-qa-copy]').addEventListener('click', async () => {
      const content = JSON.stringify(state, null, 2); try { await navigator.clipboard.writeText(content); } catch (_) { panel.querySelector('.qa-json').select(); document.execCommand('copy'); }
      panel.querySelector('[data-qa-copy]').textContent = '已复制'; setTimeout(() => panel.querySelector('[data-qa-copy]').textContent = '复制 JSON', 1300);
    });
    panel.querySelector('[data-qa-reset]').addEventListener('click', () => { state = clone(defaults); sync(); renderElementFields(); });
    renderElementFields(); refreshJson();
  }
  window.CreatorQAControls = { featureEnabled, getState: () => clone(state), reset: () => { state = clone(defaults); apply(); save(); } };
  apply();
  addPanel();
})();
