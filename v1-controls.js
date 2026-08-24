(() => {
  if (document.body.dataset.mode !== 'v1') return;

  const storageKey = 'expression-trainer.v1-controls';
  const defaults = {
    language: 'zh',
    rules: {
      goal: '请用 60 秒解释：为什么观众应该关注你的账号？',
      customRules: '',
      styleReference: '',
      customWords: ''
    },
    llm: { provider: 'openai', model: 'gpt-4o-mini', baseUrl: '' }
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return {
        ...clone(defaults), ...saved,
        rules: { ...clone(defaults.rules), ...(saved.rules || {}) },
        llm: { ...clone(defaults.llm), ...(saved.llm || {}) }
      };
    } catch (_) { return clone(defaults); }
  }
  let state = load();
  const languageMap = {
    zh: { label: '中文模式', sttLang: 'zh-CN', hint: '普通话识别' },
    mixed: { label: '中英文混合模式', sttLang: 'zh-CN', hint: '以中文引擎识别；英文识别能力取决于浏览器' },
    en: { label: '英文模式', sttLang: 'en-US', hint: 'English (US) recognition' }
  };
  const modelOptions = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    ollama: ['qwen2.5:7b', 'llama3.1:8b', 'mistral:7b'],
    custom: ['自定义模型名']
  };

  function save() {
    // API key deliberately never enters this persisted state.
    localStorage.setItem(storageKey, JSON.stringify(state));
  }
  function dispatch(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail })); }
  function close(panel) { panel.hidden = true; document.body.classList.remove('report-open'); }
  function open(panel) { panel.hidden = false; document.body.classList.add('report-open'); }

  const tools = document.createElement('section');
  tools.className = 'v1-training-tools';
  tools.innerHTML = `
    <div class="v1-tools-title"><span class="section-kicker">TRAINING CONTROL</span><h3>训练控制</h3></div>
    <div class="language-switch" role="group" aria-label="语音识别语言">
      <button type="button" data-language="zh">中文</button>
      <button type="button" data-language="mixed">中英混合</button>
      <button type="button" data-language="en">English</button>
    </div>
    <p class="language-status" data-language-status></p>
    <div class="v1-tool-actions">
      <button type="button" data-rules-open><span aria-hidden="true">◎</span><span>训练规则</span></button>
      <button type="button" data-llm-open><span aria-hidden="true">⚙</span><span>模型配置</span></button>
    </div>`;
  document.querySelector('.diagnostic-panel .metric-list')?.after(tools);

  const rulesPanel = document.createElement('section');
  rulesPanel.className = 'report-panel v1-settings-panel';
  rulesPanel.id = 'trainingRulesPanel';
  rulesPanel.hidden = true;
  rulesPanel.innerHTML = `
    <div class="report-backdrop" data-rules-close></div>
    <form class="report-dialog v1-settings-dialog" data-rules-form>
      <div class="report-head"><div><span class="section-kicker">TRAINING RULES</span><h2>训练规则</h2></div><button type="button" data-rules-close aria-label="关闭训练规则">×</button></div>
      <p class="report-lead">规则只服务于镜头表达训练；不会把产品变成泛化沟通工具。</p>
      <label class="settings-field"><span>本轮训练题</span><textarea data-rule-goal rows="3"></textarea></label>
      <label class="settings-field"><span>额外口癖词 <small>用逗号分隔，会进入本地实时统计</small></span><input data-rule-words placeholder="例如：咱就是说，家人们"></label>
      <label class="settings-field"><span>训练规则 <small>为后续大模型复盘预留</small></span><textarea data-rule-custom rows="3" placeholder="例如：前 10 秒必须先说结论；每个观点补一个例子。"></textarea></label>
      <label class="settings-field"><span>表达风格参考 <small>为后续大模型复盘预留</small></span><textarea data-rule-style rows="3" placeholder="例如：短视频口播，直接、具体、有节奏。"></textarea></label>
      <p class="settings-note">当前版本会立刻使用“训练题”和“额外口癖词”；其余两项会随着大模型接入生效。</p>
      <div class="report-actions"><button type="button" class="ghost-btn" data-rules-close>取消</button><button type="submit" class="primary-btn">保存训练规则</button></div>
    </form>`;

  const llmPanel = document.createElement('section');
  llmPanel.className = 'report-panel v1-settings-panel';
  llmPanel.id = 'modelConfigPanel';
  llmPanel.hidden = true;
  llmPanel.innerHTML = `
    <div class="report-backdrop" data-llm-close></div>
    <form class="report-dialog v1-settings-dialog" data-llm-form>
      <div class="report-head"><div><span class="section-kicker">MODEL CONFIGURATION</span><h2>大模型配置</h2></div><button type="button" data-llm-close aria-label="关闭模型配置">×</button></div>
      <p class="report-lead">沿用原项目的供应商选择逻辑，为 AI 复盘接入做准备。</p>
      <label class="settings-field"><span>AI 服务商</span><select data-llm-provider><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="ollama">Ollama</option><option value="custom">兼容 OpenAI 的自定义服务</option></select></label>
      <label class="settings-field"><span>模型</span><select data-llm-model></select></label>
      <label class="settings-field" data-base-url-field><span>服务地址 <small>Ollama / 自定义服务需要</small></span><input data-llm-base-url placeholder="http://127.0.0.1:11434"></label>
      <label class="settings-field"><span>API Key <small>只在当前输入框保留，不写入浏览器</small></span><input type="password" autocomplete="off" data-llm-api-key placeholder="接入后再填写"></label>
      <p class="settings-note">当前原型仍用本地词库实时诊断：保存配置不会上传密钥、不会调用模型，也不会伪造“连接成功”。</p>
      <div class="report-actions"><button type="button" class="ghost-btn" data-llm-close>取消</button><button type="submit" class="primary-btn">保存接入预设</button></div>
    </form>`;
  document.body.append(rulesPanel, llmPanel);

  function renderLanguages() {
    tools.querySelectorAll('[data-language]').forEach(button => button.classList.toggle('active', button.dataset.language === state.language));
    tools.querySelector('[data-language-status]').textContent = `${languageMap[state.language].label} · ${languageMap[state.language].hint}`;
  }
  function renderRules() {
    rulesPanel.querySelector('[data-rule-goal]').value = state.rules.goal;
    rulesPanel.querySelector('[data-rule-words]').value = state.rules.customWords;
    rulesPanel.querySelector('[data-rule-custom]').value = state.rules.customRules;
    rulesPanel.querySelector('[data-rule-style]').value = state.rules.styleReference;
  }
  function renderModels() {
    const provider = llmPanel.querySelector('[data-llm-provider]');
    const model = llmPanel.querySelector('[data-llm-model]');
    provider.value = state.llm.provider;
    model.innerHTML = modelOptions[state.llm.provider].map(name => `<option value="${name}">${name}</option>`).join('');
    if (modelOptions[state.llm.provider].includes(state.llm.model)) model.value = state.llm.model;
    llmPanel.querySelector('[data-llm-base-url]').value = state.llm.baseUrl;
    llmPanel.querySelector('[data-base-url-field]').hidden = !['ollama', 'custom'].includes(state.llm.provider);
  }

  tools.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    const previous = state.language;
    state.language = button.dataset.language;
    save(); renderLanguages();
    if (previous !== state.language) dispatch('creator:v1-language-change', { ...languageMap[state.language], mode: state.language });
  }));
  tools.querySelector('[data-rules-open]').addEventListener('click', () => { renderRules(); open(rulesPanel); });
  tools.querySelector('[data-llm-open]').addEventListener('click', () => {
    if (window.api?.openSettings) window.api.openSettings();
    else { renderModels(); open(llmPanel); }
  });
  rulesPanel.querySelectorAll('[data-rules-close]').forEach(button => button.addEventListener('click', () => close(rulesPanel)));
  llmPanel.querySelectorAll('[data-llm-close]').forEach(button => button.addEventListener('click', () => close(llmPanel)));
  rulesPanel.querySelector('[data-rules-form]').addEventListener('submit', async event => {
    event.preventDefault();
    state.rules = {
      goal: rulesPanel.querySelector('[data-rule-goal]').value.trim() || defaults.rules.goal,
      customWords: rulesPanel.querySelector('[data-rule-words]').value.trim(),
      customRules: rulesPanel.querySelector('[data-rule-custom]').value.trim(),
      styleReference: rulesPanel.querySelector('[data-rule-style]').value.trim()
    };
    save();
    if (window.api?.saveCustomPrompt) {
      await window.api.saveCustomPrompt({
        goals: state.rules.goal,
        customRules: state.rules.customRules,
        styleRef: state.rules.styleReference,
        customWords: state.rules.customWords
      });
    }
    dispatch('creator:v1-rules-change', clone(state.rules)); close(rulesPanel);
  });
  llmPanel.querySelector('[data-llm-provider]').addEventListener('change', event => {
    state.llm.provider = event.target.value;
    state.llm.model = modelOptions[state.llm.provider][0];
    renderModels();
  });
  llmPanel.querySelector('[data-llm-form]').addEventListener('submit', event => {
    event.preventDefault();
    state.llm.model = llmPanel.querySelector('[data-llm-model]').value;
    state.llm.baseUrl = llmPanel.querySelector('[data-llm-base-url]').value.trim();
    save(); dispatch('creator:v1-llm-config-change', clone(state.llm)); close(llmPanel);
  });

  renderLanguages();
  window.CreatorV1Controls = {
    getLanguage: () => ({ ...languageMap[state.language], mode: state.language }),
    getRules: () => clone(state.rules),
    getModelConfig: () => clone(state.llm)
  };
  function applyDesktopPrompt(saved) {
    if (!saved) return;
    state.rules = {
      goal: saved.goals || state.rules.goal,
      customRules: saved.customRules || '',
      styleReference: saved.styleRef || '',
      customWords: saved.customWords || ''
    };
    save(); renderRules();
    dispatch('creator:v1-rules-change', clone(state.rules));
  }
  if (window.api?.getCustomPrompt) {
    window.api.getCustomPrompt().then(applyDesktopPrompt).catch(() => {});
  }
  window.api?.onCustomPromptUpdated?.(applyDesktopPrompt);
  window.CreatorQAControls?.refreshCopyLibrary?.();
})();
