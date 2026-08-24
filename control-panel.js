(() => {
  if (document.body.dataset.environment === 'production') return;

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
    },
    components: {
      driftWall: {
        columns: 5, tileWidth: 200, tileHeight: 132, gap: 18, radius: 14,
        tilt: 16, turn: -14, roll: 0, perspective: 1200, depth: 120,
        speed: 42, direction: 'up', variance: 0.45, parallax: 0.6,
        pauseOnHover: false, lift: 64, fade: 0.6, dim: 0.55,
        grayscale: false, overlayColor: '#060010'
      }
    },
    copy: {}
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
  let state;
  try { state = merge(defaults, JSON.parse(localStorage.getItem(storageKey))); } catch (_) { state = clone(defaults); }

  const selectors = {
    header: '.topbar', left: '.side-panel.left', stage: '.stage', right: '.side-panel.right', room: '.room',
    camera: '.video-tile', prompt: '.prompt-banner', transcript: '.transcript', controls: '.controls'
  };
  const featureSelectors = {
    camera: ['[data-camera-toggle]', '.video-tile', '.camera-target'], audience: ['.audience-tile', '.audience-stack', '.audience-primary-stage'],
    pressure: ['.pressure-group'], transcript: ['.transcript'], metrics: ['.metric-list'], feedback: ['.side-panel.right', '.loading-row', '#eventFeed']
  };
  const featureLabel = { v1: 'V1 镜头基线', v2: 'V2 数字观众', v3: 'V3 实战房间', camera: '摄像头', audience: '数字观众', pressure: '压力事件', transcript: '实时转写', metrics: '表达指标', feedback: '反馈流' };
  const elementLabel = { header: '顶栏', left: '左侧面板', stage: '中心舞台', right: '右侧面板', room: '训练窗口', camera: '镜头窗口', prompt: '任务提示', transcript: '转写区', controls: '控制区' };
  const version = document.body.dataset.mode;
  const pageKey = version || 'launcher';
  const copySelector = 'h1, h2, h3, h4, h5, p, span, strong, small, a, button';
  const dynamicCopySelector = '#timer, #fillerMetric, #vagueMetric, #repeatMetric, #speedMetric, #densityMetric, #wordMetric, #liveTranscript, #eventFeed, .avatar-provider-state, .audience-reaction, [data-provider-status], [data-qa-provider-status]';
  if (document.documentElement.dataset.qaTitleDefault == null) document.documentElement.dataset.qaTitleDefault = document.title;

  const getByPath = path => path.split('.').reduce((obj, key) => obj[key], state);
  const setByPath = (path, value) => {
    const keys = path.split('.');
    const final = keys.pop();
    keys.reduce((obj, key) => obj[key], state)[final] = value;
  };
  const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
  const featureEnabled = name => state.flags[name] !== false;

  function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--bg', state.theme.bg); root.style.setProperty('--panel', state.theme.panel);
    root.style.setProperty('--text', state.theme.text); root.style.setProperty('--pink', state.theme.accent);
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
    return [...document.querySelectorAll(copySelector)].filter(node => {
      if (node.closest('.qa-panel, .qa-trigger')) return false;
      if (node.matches(dynamicCopySelector) || node.closest(dynamicCopySelector)) return false;
      return node.textContent.trim() && !node.querySelector(copySelector);
    }).map((node, index) => {
      const key = `${pageKey}.${node.tagName.toLowerCase()}.${index}`;
      node.dataset.qaCopyKey = key;
      if (node.dataset.qaCopyDefault == null) node.dataset.qaCopyDefault = node.textContent.trim();
      return { key, node, label: node.dataset.qaCopyLabel || node.textContent.trim().slice(0, 36), defaultText: node.dataset.qaCopyDefault };
    });
  }

  function applyCopy() {
    const titleKey = `${pageKey}.document-title`;
    document.title = state.copy[titleKey] ?? document.documentElement.dataset.qaTitleDefault;
    collectCopyTargets().forEach(({ key, node, defaultText }) => {
      const value = state.copy[key] ?? defaultText;
      if (node.textContent !== value) node.textContent = value;
      node.style.whiteSpace = value.includes('\n') ? 'pre-line' : '';
    });
  }

  function applyComponents() {
    document.dispatchEvent(new CustomEvent('creator:component-settings-change', { detail: clone(state.components) }));
  }

  function apply() { applyTheme(); applyFeatures(); applyElements(); applyCopy(); applyComponents(); }

  const numberField = (label, path, min, max, step = 1) => `<label class="qa-field"><span>${label}</span><input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}"><output data-output="${path}"></output></label>`;
  const colorField = (label, path) => `<label class="qa-color"><span>${label}</span><input type="color" data-path="${path}"></label>`;
  const toggleField = (label, path) => `<label class="qa-switch qa-component-switch"><span>${label}</span><input type="checkbox" data-path="${path}"><i></i></label>`;

  function refreshInputs(panel) {
    panel.querySelectorAll('[data-path]').forEach(input => {
      const value = getByPath(input.dataset.path);
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
    panel.innerHTML = `<div class="qa-panel-head"><div><strong>人工验收调控板</strong><small>UI、文字与组件分开管理</small></div><button type="button" class="qa-close" aria-label="关闭调控板">×</button></div>
      <div class="qa-tabs" role="tablist" aria-label="调控板页面">
        <button type="button" class="qa-tab active" data-qa-tab="ui" role="tab" aria-selected="true">UI 参数</button>
        <button type="button" class="qa-tab" data-qa-tab="copy" role="tab" aria-selected="false">文案</button>
        <button type="button" class="qa-tab" data-qa-tab="components" role="tab" aria-selected="false">组件</button>
      </div>
      <div class="qa-scroll">
        <div class="qa-page active" data-qa-page="ui">
          <section><h2>版本与能力开关</h2><p class="qa-hint">关闭版本会从总览隐藏；关闭能力会同步停止其 UI 与训练行为。</p><div class="qa-switches">${Object.entries(featureLabel).map(([key, label]) => `<label class="qa-switch"><span>${label}</span><input type="checkbox" data-flag="${key}"><i></i></label>`).join('')}</div></section>
          <section><h2>全局视觉</h2><div class="qa-colors">${colorField('背景', 'theme.bg')}${colorField('面板', 'theme.panel')}${colorField('正文', 'theme.text')}${colorField('强调', 'theme.accent')}</div><label class="qa-select"><span>字体</span><select data-path="theme.font"><option value="Inter, Microsoft YaHei, PingFang SC, system-ui, sans-serif">现代无衬线</option><option value="Microsoft YaHei, PingFang SC, sans-serif">中文优先</option><option value="Georgia, STFangsong, serif">衬线</option><option value="ui-monospace, Consolas, monospace">等宽</option></select></label>${numberField('全局字号', 'theme.fontSize', 12, 24)}</section>
          <section><h2>主布局尺寸</h2>${numberField('画布最大宽度', 'layout.canvasWidth', 960, 1920, 10)}${numberField('左栏宽度', 'layout.leftWidth', 160, 420, 5)}${numberField('右栏宽度', 'layout.rightWidth', 180, 460, 5)}${numberField('训练窗口高度', 'layout.roomHeight', 320, 900, 10)}</section>
          <section><h2>元素坐标与尺寸</h2><label class="qa-select"><span>选择元素</span><select id="qaElement">${Object.entries(elementLabel).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label><div id="qaElementFields"></div></section>
          <section class="qa-avatar-section"><h2>数字人 Provider（开发者）</h2><p class="qa-hint">普通用户不会看到这些字段。这里只配置本地或服务器上的数字人服务。</p><label class="qa-select"><span>来源</span><select id="qaAvatarProvider"><option value="mock">浏览器演示</option><option value="live">LiveTalking · WebRTC</option></select></label><label class="qa-provider-field"><span>服务地址</span><input id="qaAvatarServer" spellcheck="false"></label><label class="qa-provider-field"><span>Avatar IDs</span><input id="qaAvatarId" spellcheck="false" placeholder="avatar_a, avatar_b, avatar_c"></label><button type="button" class="qa-provider-save" data-qa-provider-save>保存数字人配置</button><p class="qa-provider-status" data-qa-provider-status>等待数字人模块加载…</p></section>
          <section><h2>配置操作</h2><div class="qa-actions"><button type="button" data-qa-copy>复制 JSON</button><button type="button" data-qa-reset>恢复默认</button></div><textarea class="qa-json" readonly aria-label="当前调控配置"></textarea></section>
        </div>
        <div class="qa-page" data-qa-page="copy" hidden>
          <section class="qa-copy-section"><h2>本页文案库</h2><p class="qa-hint">这里只管理文字。修改会立即预览并保存在当前浏览器。</p><label class="qa-copy-field"><span>浏览器标签标题</span><input data-copy-document-title></label><div class="qa-copy-list" data-copy-list></div></section>
        </div>
        <div class="qa-page" data-qa-page="components" hidden>
          <section><h2>React Bits · Drift Wall</h2><p class="qa-hint">沿用官方参数模型。以后接入带有 customized 选项的开源组件，也统一单独放在这一页。</p>
            ${numberField('列数', 'components.driftWall.columns', 2, 8)}${numberField('卡片宽度', 'components.driftWall.tileWidth', 100, 360, 4)}${numberField('卡片高度', 'components.driftWall.tileHeight', 80, 260, 4)}${numberField('间距', 'components.driftWall.gap', 4, 40)}${numberField('圆角', 'components.driftWall.radius', 0, 32)}
            ${numberField('倾斜', 'components.driftWall.tilt', -35, 35)}${numberField('转向', 'components.driftWall.turn', -35, 35)}${numberField('滚转', 'components.driftWall.roll', -15, 15)}${numberField('透视', 'components.driftWall.perspective', 600, 2000, 20)}${numberField('纵深', 'components.driftWall.depth', 0, 300, 5)}
            ${numberField('速度', 'components.driftWall.speed', 0, 100)}<label class="qa-select"><span>方向</span><select data-path="components.driftWall.direction"><option value="up">向上</option><option value="down">向下</option></select></label>${numberField('速度差异', 'components.driftWall.variance', 0, 1, 0.05)}${numberField('视差', 'components.driftWall.parallax', 0, 1, 0.05)}${numberField('悬浮抬升', 'components.driftWall.lift', 0, 140, 2)}${numberField('边缘淡出', 'components.driftWall.fade', 0, 1, 0.05)}${numberField('暗度', 'components.driftWall.dim', 0.1, 1, 0.05)}
            <div class="qa-switches qa-component-switches">${toggleField('悬停暂停', 'components.driftWall.pauseOnHover')}${toggleField('灰度图像', 'components.driftWall.grayscale')}</div><div class="qa-colors">${colorField('遮罩颜色', 'components.driftWall.overlayColor')}</div>
          </section>
        </div>
      </div>`;
    document.body.append(trigger, panel);

    const titleKey = `${pageKey}.document-title`;
    const refreshJson = () => { panel.querySelector('.qa-json').value = JSON.stringify(state, null, 2); };
    const sync = () => { apply(); save(); refreshInputs(panel); refreshJson(); };
    const renderElementFields = () => {
      const key = panel.querySelector('#qaElement').value;
      panel.querySelector('#qaElementFields').innerHTML = numberField('X 位置', `elements.${key}.x`, -600, 600) + numberField('Y 位置', `elements.${key}.y`, -600, 600) + numberField('宽度（0 为自动）', `elements.${key}.width`, 0, 1600, 10) + numberField('高度（0 为自动）', `elements.${key}.height`, 0, 1000, 10);
      refreshInputs(panel);
    };
    const renderCopyFields = () => {
      const list = panel.querySelector('[data-copy-list]');
      const items = collectCopyTargets();
      list.innerHTML = items.map(({ key, label }) => `<label class="qa-copy-field"><span>${label}</span><textarea data-copy-key="${key}" rows="2"></textarea></label>`).join('');
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
    panel.querySelector('[data-qa-provider-save]').addEventListener('click', saveAvatarProvider);
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

    renderElementFields(); renderCopyFields(); refreshJson(); refreshAvatarProvider(); refreshInputs(panel);
  }

  window.CreatorQAControls = { featureEnabled, getState: () => clone(state), refreshCopyLibrary: applyCopy, reset: () => { state = clone(defaults); apply(); save(); } };
  apply();
  addPanel();
})();
