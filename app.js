(() => {
  const mode = document.body.dataset.mode || 'v1';
  const cameraButton = document.querySelector('[data-camera-toggle]');
  const startButton = document.querySelector('[data-session-toggle]');
  const video = document.querySelector('#cameraVideo');
  const videoTile = document.querySelector('.video-tile');
  const transcriptBox = document.querySelector('#liveTranscript');
  const timer = document.querySelector('#timer');
  const statusDot = document.querySelector('.status-dot');
  const statusText = document.querySelector('#statusText');
  const stageStatus = document.querySelector('.stage-status');
  const sttRetryButton = document.querySelector('[data-stt-retry]');
  const promptText = document.querySelector('#sessionPrompt');
  const loadingRow = document.querySelector('.loading-row');
  const eventFeed = document.querySelector('#eventFeed');
  const openBriefButton = document.querySelector('[data-open-brief]');
  const reportPanel = document.querySelector('#sessionReport');
  const pastePanel = document.querySelector('#pasteTranscriptPanel');
  const pasteInput = document.querySelector('#pasteTranscriptInput');

  const fillerWords = ['嗯', '啊', '然后', '就是', '那个', '其实', '怎么说呢', '对吧', '你知道吧'];
  const vagueWords = ['很多', '比较', '可能', '感觉', '东西', '方面', '有点', '某种'];
  const prompts = {
    v1: '请用 60 秒解释：为什么观众应该关注你的账号？',
    v2: '请面对镜头，用 60 秒介绍你的账号能持续提供什么价值。',
    v3: '请用 45 秒完成一段自然的广告植入：先讲用户问题，再引出产品价值。'
  };
  let stream = null;
  let recognition = null;
  let sessionRunning = false;
  let startedAt = 0;
  let timerHandle = null;
  let pressureHandle = null;
  let transcript = '';
  let interim = '';
  let pressure = 'medium';
  let eventIndex = 0;
  let currentTemplate = null;
  let currentProfiles = [];
  let avatarProvider = null;
  let audienceSetup = null;
  let compactBrief = null;
  let desktopRuntime = null;
  let coreAnalysisTimer = null;
  let coreAnalysisVersion = 0;
  let lastAiFeedbackLength = 0;
  let aiFeedbackPending = false;
  let aiConfigurationNoticeShown = false;
  let sttDiagnostics = {
    engine: 'detecting',
    state: 'detecting',
    inputSampleRate: null,
    targetSampleRate: 16000,
    processed: 0,
    queued: 0,
    maxQueueDepth: 0,
    averageProcessMs: 0,
    failed: 0,
    starts: 0,
    lastError: ''
  };
  let lastSTTStatusRender = 0;
  const mediaController = mode === 'v1' && window.CreatorMediaCapture
    ? window.CreatorMediaCapture.create({ video, videoTile, cameraButton })
    : null;

  function featureEnabled(name) {
    return window.CreatorQAControls ? window.CreatorQAControls.featureEnabled(name) : true;
  }

  function v1Rules() {
    return window.CreatorV1Controls?.getRules?.() || {};
  }

  function v1Language() {
    return window.CreatorV1Controls?.getLanguage?.() || { mode: 'mixed', label: '中英混合', sttLang: 'zh-CN' };
  }

  function setStageState(state, message, { retry = false } = {}) {
    if (stageStatus) stageStatus.dataset.sttState = state;
    document.body.dataset.sttState = state;
    statusDot?.classList.toggle('live', state === 'listening');
    if (statusText && message) statusText.textContent = message;
    if (sttRetryButton) sttRetryButton.hidden = !retry;
  }

  function updateSTTDiagnostics(patch = {}, force = false) {
    sttDiagnostics = { ...sttDiagnostics, ...patch };
    window.CreatorSTTDiagnostics = { getStatus: () => ({ ...sttDiagnostics }) };
    document.dispatchEvent(new CustomEvent('creator:stt-state', { detail: { ...sttDiagnostics } }));
    if (['error', 'permission-denied', 'unsupported'].includes(sttDiagnostics.state)) {
      const message = sttDiagnostics.state === 'permission-denied'
        ? '麦克风权限被拒绝'
        : sttDiagnostics.state === 'unsupported' ? '当前环境不支持转写' : '语音识别需要重试';
      setStageState(sttDiagnostics.state, message, { retry: sttDiagnostics.state !== 'unsupported' });
    } else if (sessionRunning) {
      if (['detecting', 'requesting'].includes(sttDiagnostics.state)) setStageState('requesting', '正在准备麦克风');
      if (sttDiagnostics.state === 'running') setStageState('listening', '正在转写');
      if (['ended', 'paused'].includes(sttDiagnostics.state)) setStageState('paused', '转写已暂停', { retry: true });
    }
    const now = Date.now();
    if (!force && now - lastSTTStatusRender < 400) return;
    lastSTTStatusRender = now;
    const node = document.querySelector('[data-stt-status]');
    if (!node) return;
    const stateMap = {
      detecting: 'warning',
      ready: 'ready',
      running: 'ready',
      requesting: 'warning',
      paused: 'warning',
      'permission-denied': 'error',
      stopped: 'warning',
      ended: 'warning',
      error: 'error',
      unsupported: 'error'
    };
    node.dataset.state = stateMap[sttDiagnostics.state] || 'warning';
    if (sttDiagnostics.engine === 'sherpa') {
      const sampleRate = sttDiagnostics.inputSampleRate
        ? (sttDiagnostics.inputSampleRate / 1000) + ' kHz → 16 kHz'
        : '等待麦克风';
      const queue = sttDiagnostics.processed
        ? ' · 帧 ' + sttDiagnostics.processed + ' · 队列 ' + sttDiagnostics.queued + ' · ' + sttDiagnostics.averageProcessMs + ' ms/帧'
        : '';
      node.textContent = '本地 Sherpa · ' + sampleRate + queue + (sttDiagnostics.lastError ? ' · ' + sttDiagnostics.lastError : '');
      return;
    }
    if (sttDiagnostics.engine === 'web-speech') {
      const label = v1Language().label || v1Language().mode;
      const state = sttDiagnostics.state === 'ended' ? '已停止，不会自动重启' : '每轮只启动一次';
      node.textContent = '浏览器 Web Speech · ' + label + ' · ' + state + (sttDiagnostics.lastError ? ' · ' + sttDiagnostics.lastError : '');
      return;
    }
    node.textContent = sttDiagnostics.engine === 'unsupported'
      ? '当前环境不支持语音识别'
      : '正在检测语音识别引擎…';
  }

  async function refreshDesktopRuntime() {
    if (!window.api?.getRuntimeStatus) {
      desktopRuntime = null;
      document.body.classList.remove('desktop-runtime');
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      updateSTTDiagnostics({ engine: Recognition ? 'web-speech' : 'unsupported', state: Recognition ? 'ready' : 'unsupported' }, true);
      return null;
    }
    try { desktopRuntime = await window.api.getRuntimeStatus(); } catch (_) { desktopRuntime = null; }
    document.body.classList.toggle('desktop-runtime', Boolean(desktopRuntime?.desktop));
    updateSTTDiagnostics({
      engine: desktopRuntime?.desktop ? 'sherpa' : 'unsupported',
      state: desktopRuntime?.asr?.ready ? 'ready' : 'error',
      lastError: desktopRuntime?.asr?.ready ? '' : '模型缺失：' + (desktopRuntime?.asr?.missingFiles?.join('、') || '未知')
    }, true);
    return desktopRuntime;
  }

  function mountAudienceSetup() {
    if (mode === 'v1' || !window.CreatorAudienceEngine || !window.CreatorAvatarProvider) return;
    const leftPanel = document.querySelector('.side-panel.left');
    if (!leftPanel) return;
    const briefAnchor = document.querySelector('[data-brief-anchor]');
    const useSheet = mode === 'v3' && briefAnchor;
    const savedTemplate = localStorage.getItem('expression-trainer.audience-template.v1') || 'knowledge-beginner';
    const providerConfig = window.CreatorAvatarProvider.loadConfig();
    const section = document.createElement('section');
    section.className = useSheet ? 'audience-config brief-sheet' : 'audience-config';
    section.hidden = Boolean(useSheet);
    section.innerHTML = `
      <div class="brief-sheet-head"><div><span class="section-kicker">TRAINING SETUP</span><h3>本轮创作简报</h3></div>${useSheet ? '<button type="button" data-brief-close aria-label="关闭训练设置">×</button>' : ''}</div>
      <p>先确定内容讲给谁。模板定义受众关注点，不保存固定台词。</p>
      <label class="brief-field"><span>受众模板</span><select data-audience-template>${window.CreatorAudienceEngine.templates.map(template => `<option value="${template.id}">${template.name}</option>`).join('')}</select></label>
      <div class="brief-summary" data-audience-summary></div>
      <div class="brief-provider-note"><span>数字观众</span><strong data-provider-label>${providerConfig.provider === 'live' ? '系统数字人' : '浏览器演示'}</strong><small>由系统提供，开发者接入配置不属于训练任务。</small></div>
      <div class="audience-config-actions"><button type="button" data-audience-apply>应用模板</button><button type="button" data-audience-choose>选择数字观众</button><button type="button" data-audience-preview>试听反应</button></div>
      <div class="provider-status" data-provider-status>等待应用配置</div>`;
    if (useSheet) {
      compactBrief = document.createElement('div');
      compactBrief.className = 'compact-brief';
      compactBrief.innerHTML = '<span class="compact-brief-tag">知识科普</span><strong data-compact-title>零基础受众</strong><p data-compact-goal>让陌生概念被听懂并愿意关注</p><div><span data-compact-platform>B站 / 视频号</span><button type="button" data-compact-edit>编辑</button></div>';
      briefAnchor.appendChild(compactBrief);
      document.body.appendChild(section);
      const openSheet = () => { section.hidden = false; document.body.classList.add('brief-sheet-open'); };
      const closeSheet = () => { section.hidden = true; document.body.classList.remove('brief-sheet-open'); };
      openBriefButton?.addEventListener('click', openSheet);
      compactBrief.querySelector('[data-compact-edit]').addEventListener('click', openSheet);
      section.querySelector('[data-brief-close]').addEventListener('click', closeSheet);
      section.addEventListener('click', event => { if (event.target === section) closeSheet(); });
      section._closeSheet = closeSheet;
    } else {
      leftPanel.insertBefore(section, leftPanel.firstChild.nextSibling);
    }
    const templateSelect = section.querySelector('[data-audience-template]');
    templateSelect.value = window.CreatorAudienceEngine.getTemplate(savedTemplate).id;
    audienceSetup = section;

    const updateSummary = () => {
      const template = window.CreatorAudienceEngine.getTemplate(templateSelect.value);
      const summary = section.querySelector('[data-audience-summary]');
      summary.innerHTML = `<strong>${template.domain} · ${template.platform}</strong><span>${template.goal}</span>`;
      if (compactBrief) {
        compactBrief.querySelector('.compact-brief-tag').textContent = template.domain;
        compactBrief.querySelector('[data-compact-title]').textContent = template.name.split('·').pop().trim();
        compactBrief.querySelector('[data-compact-goal]').textContent = template.goal;
        compactBrief.querySelector('[data-compact-platform]').textContent = template.platform;
      }
    };
    templateSelect.addEventListener('change', updateSummary);
    section.querySelector('[data-audience-apply]').addEventListener('click', async () => {
      await applyAudienceConfiguration(true);
      section._closeSheet?.();
    });
    section.querySelector('[data-audience-choose]').addEventListener('click', event => {
      window.CreatorAvatarSelector?.open({
        templateId: templateSelect.value,
        max: mode === 'v2' ? 1 : 3,
        trigger: event.currentTarget
      });
    });
    section.querySelector('[data-audience-preview]').addEventListener('click', () => fireAudienceReaction(true));
    updateSummary();
    window.CreatorQAControls?.refreshCopyLibrary?.();
  }

  function audienceCard(profile) {
    return `<div class="audience-tile" data-profile-id="${profile.id}"><div class="audience-copy"><div class="avatar">${profile.glyph}</div><div class="audience-name">${profile.name}</div><div class="audience-role">${profile.role}</div><div class="audience-reaction">${profile.motivation}</div><div class="avatar-provider-state">等待连接</div></div></div>`;
  }

  function renderAudienceProfiles() {
    if (mode === 'v2') {
      const slot = document.querySelector('[data-primary-audience]');
      const preview = document.querySelector('#avatarDriftWall');
      if (slot && currentProfiles[0]) {
        slot.innerHTML = audienceCard(currentProfiles[0]);
        slot.hidden = false;
        if (preview) preview.hidden = true;
        document.querySelector('.audience-preview-caption')?.setAttribute('hidden', '');
        window.CreatorDriftWall?.destroy?.();
      }
    } else if (mode === 'v3') {
      const stack = document.querySelector('.audience-stack');
      if (stack) stack.innerHTML = currentProfiles.map(audienceCard).join('');
    }
  }

  async function applyAudienceConfiguration(connectProvider = true) {
    if (!audienceSetup) return;
    const engine = window.CreatorAudienceEngine;
    const templateId = audienceSetup.querySelector('[data-audience-template]').value;
    currentTemplate = engine.getTemplate(templateId);
    const profileLimit = mode === 'v2' ? 1 : 3;
    const selectedIds = window.CreatorAvatarSelector?.getSelection(currentTemplate.id, profileLimit) || [];
    currentProfiles = selectedIds.map(id => engine.profiles[id]).filter(Boolean);
    if (!currentProfiles.length) currentProfiles = engine.getProfiles(currentTemplate, profileLimit);
    localStorage.setItem('expression-trainer.audience-template.v1', currentTemplate.id);
    prompts[mode] = currentTemplate.prompt;
    if (promptText) promptText.textContent = currentTemplate.prompt;
    document.querySelectorAll('.scenario-btn').forEach(button => button.classList.remove('active'));
    renderAudienceProfiles();

    const config = window.CreatorAvatarProvider.loadConfig();
    const providerLabel = audienceSetup.querySelector('[data-provider-label]');
    if (providerLabel) providerLabel.textContent = config.provider === 'live' ? '系统数字人' : '浏览器演示';
    window.CreatorAvatarProvider.saveConfig(config);
    const status = audienceSetup.querySelector('[data-provider-status]');
    if (!connectProvider) return;
    status.textContent = config.provider === 'live' ? '正在连接 LiveTalking；失败会自动降级为浏览器演示…' : '正在准备浏览器演示…';
    if (avatarProvider) await avatarProvider.disconnect();
    avatarProvider = window.CreatorAvatarProvider.create(config);
    const tiles = [...document.querySelectorAll('.audience-tile')];
    try {
      const result = await avatarProvider.connect(tiles);
      status.textContent = config.provider === 'live'
        ? `LiveTalking 已连接 ${result.connected}/${tiles.length} 个窗口；${result.fallback} 个使用浏览器降级。`
        : `已启用浏览器演示，共 ${tiles.length} 个受众角色。`;
    } catch (error) {
      status.textContent = `连接失败：${error.message}。已保留静态受众界面。`;
    }
    addEvent('创作简报', `${currentTemplate.name}｜${currentTemplate.goal}`, true, `数字形象：${config.provider === 'live' ? 'LiveTalking' : '浏览器演示'}`);
  }

  // V2 owns the topic as deliberately as V1 does. A selected audience
  // template updates both its pressure audience and its prompt; a custom
  // topic keeps the chosen audience but replaces the words the creator sees.
  window.CreatorAudienceControls = {
    getTopic: () => ({ goal: prompts.v2, templateId: audienceSetup?.querySelector('[data-audience-template]')?.value || null, running: sessionRunning }),
    setTopic: async ({ goal, templateId } = {}) => {
      if (mode !== 'v2') return { applied: false, error: '当前页面不是数字观众训练。' };
      if (sessionRunning) return { applied: false, error: '请先结束本轮训练，再更换选题。' };
      if (templateId && audienceSetup) {
        const template = window.CreatorAudienceEngine?.getTemplate(templateId);
        if (!template) return { applied: false, error: '没有找到这个选题模板。' };
        audienceSetup.querySelector('[data-audience-template]').value = template.id;
        await applyAudienceConfiguration(true);
        return { applied: true, goal: prompts.v2, templateId: template.id };
      }
      const nextGoal = typeof goal === 'string' ? goal.trim() : '';
      if (!nextGoal || nextGoal.length > 300) return { applied: false, error: '请填写 1–300 字的选题。' };
      prompts.v2 = nextGoal;
      if (promptText) promptText.textContent = nextGoal;
      return { applied: true, goal: nextGoal, templateId: null };
    }
  };

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function countTerms(text, terms) {
    return terms.reduce((sum, term) => sum + (text.split(term).length - 1), 0);
  }

  function renderDiagnosticFeedback(analysis) {
    if (!eventFeed || !featureEnabled('feedback') || !window.CreatorExpressionAnalysis) return;
    const suggestions = window.CreatorExpressionAnalysis.suggestions(analysis);
    const activeKeys = new Set(suggestions.map(item => `diagnostic-${item.key}`));
    eventFeed.querySelectorAll('[data-event-key^="diagnostic-"]').forEach(card => {
      if (!activeKeys.has(card.dataset.eventKey)) card.remove();
    });
    suggestions.forEach(item => addEvent(item.title, item.text, false, '', { key: `diagnostic-${item.key}`, kind: item.type }));
    const empty = document.querySelector('[data-feedback-empty]');
    if (empty) empty.hidden = suggestions.length > 0;
  }

  function updateMetrics() {
    if (mode === 'v1' && window.CreatorExpressionAnalysis) {
      const currentText = `${transcript}${interim}`;
      const analysis = window.CreatorExpressionAnalysis.analyze(currentText, v1Rules());
      if (featureEnabled('metrics')) {
        setMetric('fillerMetric', analysis.fillers.length);
        setMetric('vagueMetric', analysis.vague.length);
        setMetric('hedgeMetric', analysis.hedges.length);
        setMetric('densityMetric', analysis.totalChars ? `${analysis.density}%` : '--');
      }
      renderDiagnosticFeedback(analysis);
      scheduleCoreAnalysis(currentText, analysis);
      return;
    }
    if (!featureEnabled('metrics')) return;
    const clean = transcript.replace(/[，。！？、；：\s]/g, '');
    const fillerCount = countTerms(clean, fillerWords);
    const vagueCount = countTerms(clean, vagueWords);
    const repeatedCount = [...clean.matchAll(/(.{2,4})\1+/g)].length;
    const elapsedMinutes = Math.max((Date.now() - startedAt) / 60000, 0.1);
    const speed = startedAt ? Math.round(clean.length / elapsedMinutes) : 0;
    const fillerChars = fillerWords.reduce((sum, word) => sum + countTerms(clean, [word]) * word.length, 0);
    const density = clean.length ? Math.max(0, Math.round((1 - fillerChars / clean.length) * 100)) : 0;

    setMetric('fillerMetric', fillerCount);
    setMetric('vagueMetric', vagueCount);
    setMetric('repeatMetric', repeatedCount);
    setMetric('speedMetric', speed ? `${speed} 字/分` : '--');
    setMetric('densityMetric', clean.length ? `${density}%` : '--');
    setMetric('wordMetric', clean.length);
  }

  function setMetric(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function scheduleCoreAnalysis(text, localAnalysis) {
    if (!window.api?.analyzeText || !text.trim()) return;
    clearTimeout(coreAnalysisTimer);
    const version = ++coreAnalysisVersion;
    coreAnalysisTimer = setTimeout(async () => {
      try {
        const core = await window.api.analyzeText(text);
        if (!core || version !== coreAnalysisVersion) return;
        const normalized = {
          text,
          totalChars: core.totalWords,
          fillers: core.fillers.map(item => item.word),
          hedges: core.hedges.map(item => item.word),
          vague: core.vagueWords.map(item => item.word),
          repeats: localAnalysis.repeats,
          density: core.density
        };
        if (featureEnabled('metrics')) {
          setMetric('fillerMetric', normalized.fillers.length);
          setMetric('vagueMetric', normalized.vague.length);
          setMetric('hedgeMetric', normalized.hedges.length);
          setMetric('densityMetric', `${normalized.density}%`);
        }
        renderDiagnosticFeedback(normalized);
      } catch (_) { /* Browser preview keeps the local analyzer as fallback. */ }
    }, 120);
  }

  function renderTranscript() {
    if (!featureEnabled('transcript')) return;
    if (!transcript && !interim) {
      transcriptBox.innerHTML = `<span class="placeholder">${mode === 'v1' ? '开启摄像头并开始说话，实时字幕会叠加在画面上。' : '开始后，实时转写会出现在这里。系统不会把数字人提示混进你的正文。'}</span>`;
      return;
    }
    if (mode === 'v1' && window.CreatorExpressionAnalysis) {
      const finalLines = window.CreatorExpressionAnalysis.lines(transcript).slice(-4);
      transcriptBox.innerHTML = finalLines.map((line, index) => `<div class="stt-line${index < finalLines.length - 1 ? ' old' : ''}">${window.CreatorExpressionAnalysis.highlight(line, v1Rules())}</div>`).join('');
      if (interim) transcriptBox.insertAdjacentHTML('beforeend', `<div class="stt-line interim">${window.CreatorExpressionAnalysis.highlight(interim, v1Rules())}</div>`);
      transcriptBox.scrollTop = transcriptBox.scrollHeight;
      document.dispatchEvent(new CustomEvent('creator:transcript-change', { detail: { text: `${transcript}${interim}`, final: !interim } }));
      return;
    }
    transcriptBox.textContent = transcript;
    if (interim) {
      const span = document.createElement('span');
      span.className = 'interim';
      span.textContent = interim;
      transcriptBox.appendChild(span);
    }
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
    document.dispatchEvent(new CustomEvent('creator:transcript-change', { detail: { text: `${transcript}${interim}`, final: !interim } }));
  }

  async function toggleCamera() {
    if (!featureEnabled('camera')) return;
    if (mediaController) {
      try { await mediaController.toggleCamera(); }
      catch (_) { /* The device panel already explains the recoverable failure. */ }
      return;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
      video.srcObject = null;
      videoTile.classList.remove('camera-on');
      cameraButton.classList.remove('active');
      cameraButton.innerHTML = '<span class="control-indicator"></span>开启摄像头';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      videoTile.classList.add('camera-on');
      cameraButton.classList.add('active');
      cameraButton.innerHTML = '<span class="control-indicator"></span>关闭摄像头';
    } catch (error) {
      addEvent('系统', '摄像头未开启。请检查浏览器权限，或使用 localhost / HTTPS 打开原型。', true);
    }
  }

  function closeCamera() {
    if (mediaController) {
      mediaController.closeCamera();
      return;
    }
    if (!stream) return;
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    videoTile.classList.remove('camera-on');
    cameraButton?.classList.remove('active');
    if (cameraButton) cameraButton.innerHTML = '<span class="control-indicator"></span>开启摄像头';
  }

  function applyRecognitionResult(piece, isFinal) {
    if (isFinal) {
      transcript += piece;
      interim = '';
    } else interim = piece;
    renderTranscript();
    updateMetrics();
    if (isFinal) requestCoreAiFeedback();
  }

  function createElectronRecognition() {
    let audioStream = null;
    let audioContext = null;
    let source = null;
    let processor = null;
    let audioQueue = null;
    const instance = {
      _manualStop: false,
      onend: null,
      onerror: null,
      async start() {
        instance._manualStop = false;
        updateSTTDiagnostics({
          engine: 'sherpa',
          state: 'requesting',
          processed: 0,
          queued: 0,
          maxQueueDepth: 0,
          averageProcessMs: 0,
          failed: 0,
          starts: sttDiagnostics.starts + 1,
          lastError: ''
        }, true);
        const init = await window.api.initASR();
        if (!init.success) {
          updateSTTDiagnostics({ state: 'error', lastError: init.error }, true);
          instance.onerror?.({ error: 'desktop-asr', message: init.error });
          return;
        }
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: mediaController?.getAudioConstraints() || {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          audioContext = new AudioContextClass({ sampleRate: 16000 });
          const inputSampleRate = audioContext.sampleRate;
          source = audioContext.createMediaStreamSource(audioStream);
          // 2048 samples keeps the local subtitle cadence near 128 ms at 16 kHz.
          processor = audioContext.createScriptProcessor(2048, 1, 1);
          audioQueue = window.CreatorSTTAudio.createSerialAudioQueue(
            samples => window.api.feedAudio(samples),
            {
              onResult: result => {
                if (result?.text) applyRecognitionResult(result.text, result.isFinal);
              },
              onError: error => {
                updateSTTDiagnostics({ state: 'error', lastError: error.message }, true);
                instance.onerror?.({ error: 'desktop-asr', message: error.message });
              },
              onStatus: status => updateSTTDiagnostics(status)
            }
          );
          processor.onaudioprocess = event => {
            if (!sessionRunning) return;
            const samples = window.CreatorSTTAudio.resampleTo16k(
              event.inputBuffer.getChannelData(0),
              inputSampleRate
            );
            audioQueue.enqueue(samples);
          };
          source.connect(processor);
          processor.connect(audioContext.destination);
          updateSTTDiagnostics({ engine: 'sherpa', state: 'running', inputSampleRate }, true);
        } catch (error) {
          await window.api.stopASR().catch(() => {});
          audioStream?.getTracks().forEach(track => track.stop());
          audioStream = null;
          if (audioContext) await audioContext.close().catch(() => {});
          audioContext = null;
          const permissionDenied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
          updateSTTDiagnostics({ state: permissionDenied ? 'permission-denied' : 'error', lastError: error.message }, true);
          instance.onerror?.({ error: 'microphone', message: error.message });
        }
      },
      async stop() {
        processor?.disconnect(); source?.disconnect();
        processor = null; source = null;
        audioStream?.getTracks().forEach(track => track.stop());
        audioStream = null;
        audioQueue?.close();
        await audioQueue?.drain();
        if (audioContext) await audioContext.close().catch(() => {});
        audioContext = null;
        const result = await window.api.stopASR().catch(() => ({ finalText: '' }));
        if (result?.finalText) applyRecognitionResult(result.finalText, true);
        updateSTTDiagnostics({ state: 'stopped', queued: 0 }, true);
        audioQueue = null;
        instance.onend?.();
      }
    };
    return instance;
  }

  function setupRecognition() {
    if (window.api?.initASR) {
      const instance = createElectronRecognition();
      instance.onend = () => {};
      instance.onerror = event => addEvent('离线语音识别', event.message || event.error, true, 'Sherpa-ONNX');
      return instance;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return null;
    const instance = new Recognition();
    instance.lang = mode === 'v1' ? v1Language().sttLang : 'zh-CN';
    instance.continuous = true;
    instance.interimResults = true;
    instance._manualStop = false;
    const browserStart = instance.start.bind(instance);
    const browserStop = instance.stop.bind(instance);
    instance.start = () => {
      instance._manualStop = false;
      updateSTTDiagnostics({
        engine: 'web-speech',
        state: 'requesting',
        starts: sttDiagnostics.starts + 1,
        lastError: ''
      }, true);
      try { return browserStart(); }
      catch (error) {
        updateSTTDiagnostics({ state: 'error', lastError: error.message }, true);
        throw error;
      }
    };
    instance.onstart = () => updateSTTDiagnostics({ engine: 'web-speech', state: 'running', lastError: '' }, true);
    instance.stop = () => {
      instance._manualStop = true;
      return browserStop();
    };
    instance.onresult = event => {
      interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) { transcript += piece; requestCoreAiFeedback(); }
        else interim += piece;
      }
      renderTranscript();
      updateMetrics();
    };
    instance.onend = () => {
      if (instance._terminalState) {
        updateSTTDiagnostics({ state: instance._terminalState, lastError: instance._terminalError || sttDiagnostics.lastError }, true);
        instance._terminalState = '';
        instance._terminalError = '';
        return;
      }
      const unexpected = sessionRunning && !instance._manualStop;
      updateSTTDiagnostics({
        state: unexpected ? 'paused' : 'stopped',
        lastError: unexpected ? (sttDiagnostics.lastError || '识别服务提前结束') : sttDiagnostics.lastError
      }, true);
      if (unexpected) {
        addEvent(
          '系统',
          '浏览器语音识别已停止，本轮不会自动重新申请麦克风权限。请结束后重新开始训练。',
          true,
          'Web Speech API',
          { key: 'browser-stt-ended' }
        );
      }
    };
    instance.onerror = event => {
      const ignored = event.error === 'no-speech' || (event.error === 'aborted' && instance._manualStop);
      const permissionDenied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      if (!ignored) {
        instance._terminalState = permissionDenied ? 'permission-denied' : 'error';
        instance._terminalError = event.error;
      }
      updateSTTDiagnostics({
        state: ignored ? 'paused' : permissionDenied ? 'permission-denied' : 'error',
        lastError: ignored ? '' : event.error
      }, true);
      if (!ignored) addEvent('系统', '语音识别暂不可用：' + event.error, true);
    };
    updateSTTDiagnostics({ engine: 'web-speech', state: 'ready', lastError: '' }, true);
    return instance;
  }

  async function requestCoreAiFeedback() {
    if (mode !== 'v1' || !window.api?.getRealtimeFeedback || aiFeedbackPending) return;
    if (transcript.length - lastAiFeedbackLength < 50) return;
    const runtime = await refreshDesktopRuntime();
    if (!runtime?.llmConfigured) {
      if (!aiConfigurationNoticeShown) {
        addEvent('AI 教练', '完整词库与离线转写已启用；配置模型后，每 50 字会追加一次语境反馈。', true, '大模型尚未配置', { key: 'ai-not-configured' });
        aiConfigurationNoticeShown = true;
      }
      return;
    }
    aiFeedbackPending = true;
    lastAiFeedbackLength = transcript.length;
    try {
      const result = await window.api.getRealtimeFeedback(transcript);
      if (result.success && result.feedback?.trim()) addEvent('AI 教练', result.feedback.trim(), false, runtime.provider, { key: `ai-${lastAiFeedbackLength}`, kind: 'ai' });
      else if (result.error) addEvent('AI 教练', result.error, true, '模型调用失败', { key: 'ai-runtime-error' });
    } finally { aiFeedbackPending = false; }
  }

  function addEvent(who, text, system = false, meta = '', options = {}) {
    if (!eventFeed || !featureEnabled('feedback')) return;
    const { key = '', removable = false, kind = '' } = options;
    const existing = key ? eventFeed.querySelector(`[data-event-key="${key}"]`) : null;
    if (existing) {
      existing.querySelector('[data-event-title]').textContent = who;
      existing.querySelector('[data-event-body]').textContent = text;
      const oldMeta = existing.querySelector('[data-event-meta]');
      if (meta && oldMeta) oldMeta.textContent = meta;
      else if (meta) {
        const detail = document.createElement('small');
        detail.dataset.eventMeta = '';
        detail.textContent = meta;
        existing.appendChild(detail);
      } else oldMeta?.remove();
      eventFeed.prepend(existing);
      eventFeed.scrollTop = 0;
      return existing;
    }
    const card = document.createElement('div');
    card.className = `event-card${system ? ' system' : ''}${kind ? ` ${kind}-event` : ''}`;
    if (removable) card.classList.add('removable');
    if (key) card.dataset.eventKey = key;
    const title = document.createElement('strong');
    title.dataset.eventTitle = '';
    title.textContent = who;
    const body = document.createElement('div');
    body.dataset.eventBody = '';
    body.textContent = text;
    card.append(title, body);
    if (meta) {
      const detail = document.createElement('small');
      detail.dataset.eventMeta = '';
      detail.textContent = meta;
      card.appendChild(detail);
    }
    if (removable) {
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'event-dismiss';
      dismiss.setAttribute('aria-label', `删除${who}记录`);
      dismiss.textContent = '×';
      dismiss.addEventListener('click', () => card.remove());
      card.appendChild(dismiss);
    }
    eventFeed.prepend(card);
    eventFeed.scrollTop = 0;
    return card;
  }

  function reactAudience(text, profileId) {
    const tiles = [...document.querySelectorAll('.audience-tile')];
    if (!tiles.length) return;
    tiles.forEach(tile => tile.classList.remove('attention'));
    const tile = tiles.find(item => item.dataset.profileId === profileId) || tiles[eventIndex % tiles.length];
    tile.classList.add('attention');
    const reaction = tile.querySelector('.audience-reaction');
    if (reaction) reaction.textContent = text;
    setTimeout(() => tile.classList.remove('attention'), 4500);
  }

  function fireAudienceReaction(preview = false) {
    if (!featureEnabled('pressure') || !featureEnabled('audience') || !currentTemplate || !currentProfiles.length) return;
    const profileIndex = eventIndex % currentProfiles.length;
    const profile = currentProfiles[profileIndex];
    const elapsedSeconds = sessionRunning ? Math.floor((Date.now() - startedAt) / 1000) : 12;
    const observation = window.CreatorAudienceEngine.observe(`${transcript}${interim}`, elapsedSeconds);
    const reaction = window.CreatorAudienceEngine.nextReaction({
      template: currentTemplate, profile, observation, pressure, eventIndex
    });
    addEvent(reaction.who, reaction.text, false, `${reaction.reason}｜${currentTemplate.name}`);
    reactAudience(reaction.text, reaction.profileId);
    avatarProvider?.speak(profileIndex, reaction.text).catch(error => addEvent('数字形象', `播报失败：${error.message}`, true));
    if (preview && audienceSetup) audienceSetup.querySelector('[data-provider-status]').textContent = `已试听：${reaction.who}根据当前表达信号产生反应。`;
    eventIndex += 1;
  }

  function schedulePressure() {
    if (!featureEnabled('pressure') || !featureEnabled('audience')) return;
    clearInterval(pressureHandle);
    const interval = pressure === 'high' ? 12000 : pressure === 'medium' ? 18000 : 26000;
    pressureHandle = setInterval(() => {
      if (!sessionRunning) return;
      fireAudienceReaction(false);
    }, interval);
  }

  async function startSession() {
    if (mode !== 'v1' && !currentTemplate) {
      addEvent('系统', '请先在左侧选择受众模板并点击“应用模板”。', true);
      audienceSetup?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    promptText.textContent = mode === 'v1' ? (v1Rules().goal || prompts.v1) : prompts[mode];
    if (mediaController?.isRecordingEnabled()) {
      startButton.disabled = true;
      setStageState('requesting', '正在准备本地录制');
      try {
        await mediaController.startSessionRecording({ prompt: promptText.textContent });
      } catch (error) {
        startButton.disabled = false;
        setStageState('idle', '录制未开始');
        addEvent('本地录制', `未能开始录制：${error.message}`, true, '录像不会上传；你可以关闭“同时录制本轮”后继续训练。');
        return;
      }
      startButton.disabled = false;
    }
    transcript = '';
    interim = '';
    lastAiFeedbackLength = 0;
    aiConfigurationNoticeShown = false;
    eventIndex = 0;
    document.querySelectorAll('[data-copy-transcript], [data-clear-transcript], [data-show-report]').forEach(button => { button.hidden = true; });
    if (mode === 'v1' && eventFeed) {
      eventFeed.replaceChildren();
      const empty = document.querySelector('[data-feedback-empty]');
      if (empty) empty.hidden = false;
    }
    sessionRunning = true;
    mediaController?.setSessionRunning(true);
    document.dispatchEvent(new CustomEvent('creator:session-state', { detail: { running: true } }));
    startedAt = Date.now();
    startButton.textContent = '结束并生成复盘';
    startButton.classList.add('running');
    setStageState('requesting', '正在准备麦克风');
    renderTranscript();
    updateMetrics();
    timerHandle = setInterval(() => { timer.textContent = formatTime(Date.now() - startedAt); }, 250);
    if (featureEnabled('transcript') || featureEnabled('metrics')) {
      recognition = recognition || setupRecognition();
      if (recognition) {
        Promise.resolve(recognition.start()).catch(error => addEvent('语音识别', error.message, true));
      } else {
        addEvent('系统', '当前浏览器不支持 Web Speech API，仍可体验摄像头和压力流程。建议使用 Chrome 或 Edge。', true);
      }
    }
    if (mode !== 'v1') schedulePressure();
    if (featureEnabled('feedback') && mode !== 'v1') addEvent('训练目标', promptText.textContent, true);
  }

  function populateReportPanel() {
    if (!reportPanel) return;
    const analysis = mode === 'v1' ? window.CreatorExpressionAnalysis?.analyze(transcript, v1Rules()) : null;
    const filler = document.getElementById('fillerMetric')?.textContent || '0';
    const density = document.getElementById('densityMetric')?.textContent || '--';
    const words = document.getElementById('wordMetric')?.textContent || String(analysis?.totalChars || 0);
    const writeReport = (selector, value) => { const node = reportPanel.querySelector(selector); if (node) node.textContent = value; };
    writeReport('#reportDensity', analysis ? `${analysis.density}%` : density);
    writeReport('#reportFiller', analysis ? analysis.fillers.length : filler);
    writeReport('#reportHedge', analysis?.hedges.length ?? 0);
    writeReport('#reportVague', analysis?.vague.length ?? 0);
    writeReport('#reportWords', words);
    if (!analysis) return;
    const priorities = [
      { count: analysis.fillers.length, action: '把口头禅换成一秒停顿', reason: '填充词会占用观众注意力，却不增加信息。' },
      { count: analysis.hedges.length, action: '删除弱化前缀，直接陈述判断', reason: '“我觉得、可能、应该”会削弱观点的可信度。' },
      { count: analysis.vague.length, action: '把笼统词换成数字、对象或具体结果', reason: '“很多、东西、方面”不能让观众形成清晰画面。' },
      { count: analysis.repeats.length, action: '相同意思只说一次，再补证据', reason: '重复不会加强观点，只会降低单位时间的信息量。' }
    ].sort((a, b) => b.count - a.count);
    const focus = priorities[0].count ? priorities[0] : { action: '保持当前清晰度，缩短开场', reason: '本轮问题词较少，下一轮继续压缩前十秒。' };
    writeReport('#reportFocus', focus.action);
    writeReport('#reportReason', focus.reason);
  }

  function openReport() {
    if (!reportPanel) return;
    populateReportPanel();
    reportPanel.hidden = false;
    document.body.classList.add('report-open');
    generateCoreReport();
  }

  async function generateCoreReport() {
    const container = reportPanel?.querySelector('[data-core-report]');
    if (!container || !window.api?.getFinalReport || !transcript.trim()) return;
    const runtime = await refreshDesktopRuntime();
    if (!runtime?.llmConfigured) {
      container.hidden = false;
      container.textContent = '当前显示本地词库诊断。完成“大模型配置”后，这里会追加原项目的完整 AI 报告。';
      return;
    }
    container.hidden = false;
    container.textContent = '正在调用已配置的大模型生成完整报告…';
    const analysis = window.CreatorExpressionAnalysis?.analyze(transcript, v1Rules());
    const result = await window.api.getFinalReport({
      fullText: transcript,
      stats: {
        duration: startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0,
        totalWords: analysis?.totalChars || transcript.length,
        fillers: analysis?.fillers.length || 0,
        hedges: analysis?.hedges.length || 0,
        vagueWords: analysis?.vague.length || 0
      }
    });
    container.textContent = result.success ? result.report : `完整报告生成失败：${result.error}`;
  }

  function showTranscriptActions() {
    if (mode !== 'v1' || !transcript.trim()) return;
    document.querySelectorAll('[data-copy-transcript], [data-clear-transcript], [data-show-report]').forEach(button => { button.hidden = false; });
  }

  async function stopSession() {
    sessionRunning = false;
    clearInterval(timerHandle);
    clearInterval(pressureHandle);
    if (recognition) {
      try { await Promise.resolve(recognition.stop()); } catch (_) { /* already stopped */ }
    }
    if (mediaController?.isRecording()) {
      try {
        await mediaController.stopSessionRecording({ transcript, prompt: promptText.textContent });
      } catch (error) {
        addEvent('本地录制', `录像收尾失败：${error.message}`, true);
      }
    }
    mediaController?.setSessionRunning(false);
    document.dispatchEvent(new CustomEvent('creator:session-state', { detail: { running: false } }));
    avatarProvider?.interrupt();
    startButton.disabled = true;
    setStageState('processing', '生成复盘');
    loadingRow?.classList.add('visible');
    setTimeout(() => {
      loadingRow?.classList.remove('visible');
      setStageState('complete', '本轮完成');
      startButton.disabled = false;
      startButton.textContent = '再练同一题';
      startButton.classList.remove('running');
      const filler = document.getElementById('fillerMetric')?.textContent || '0';
      const density = document.getElementById('densityMetric')?.textContent || '--';
      if (featureEnabled('feedback')) {
        if (mode === 'v1' && window.CreatorExpressionAnalysis) {
          const analysis = window.CreatorExpressionAnalysis.analyze(transcript, v1Rules());
          const empty = document.querySelector('[data-feedback-empty]');
          if (empty) empty.hidden = true;
          addEvent('本轮诊断', `笼统词 ${analysis.vague.length} 次、填充词 ${analysis.fillers.length} 次、犹豫词 ${analysis.hedges.length} 次、重复表达 ${analysis.repeats.length} 处，表达密度 ${analysis.density}%。`, true, '诊断依据来自本轮逐字稿');
        } else {
          addEvent('本轮复盘', `口头禅 ${filler} 次，表达净度 ${density}。下一轮只练一个动作：前十秒先说结论。`, true, currentTemplate ? `受众模板：${currentTemplate.name}` : '镜头基线');
        }
      }
      if (reportPanel) {
        populateReportPanel();
        if (mode === 'v1') showTranscriptActions(); else openReport();
      }
    }, 1500);
  }

  document.querySelectorAll('.pressure-btn').forEach(button => {
    button.addEventListener('click', () => {
      pressure = button.dataset.pressure;
      document.querySelectorAll('.pressure-btn').forEach(item => item.classList.toggle('active', item === button));
      if (sessionRunning) schedulePressure();
    });
  });

  document.querySelectorAll('.scenario-btn').forEach(button => {
    button.addEventListener('click', () => {
      const isCurrentScenario = button.classList.contains('active') && prompts.v3 === button.dataset.prompt;
      if (isCurrentScenario) return;
      document.querySelectorAll('.scenario-btn').forEach(item => item.classList.toggle('active', item === button));
      prompts.v3 = button.dataset.prompt;
      promptText.textContent = prompts.v3;
      addEvent('场景切换', button.querySelector('[data-scenario-name]')?.textContent.trim() || button.textContent.trim(), true, '目标受众保持不变', { key: 'scene-switch', removable: true, kind: 'scene' });
    });
  });

  document.addEventListener('creator:features-change', event => {
    const flags = event.detail;
    if (!flags.camera) closeCamera();
    if ((!flags.pressure || !flags.audience) && pressureHandle) clearInterval(pressureHandle);
    if (sessionRunning && flags.pressure && flags.audience && mode !== 'v1') schedulePressure();
    if (sessionRunning && !flags.transcript && !flags.metrics && recognition) {
      try { recognition.stop(); } catch (_) { /* already stopped */ }
    }
  });

  document.addEventListener('creator:avatar-config-change', () => {
    if (audienceSetup) applyAudienceConfiguration(true);
  });

  document.addEventListener('creator:audience-selection-change', event => {
    if (!audienceSetup || event.detail?.templateId !== audienceSetup.querySelector('[data-audience-template]')?.value) return;
    applyAudienceConfiguration(true);
  });

  document.addEventListener('creator:v1-rules-change', event => {
    if (mode !== 'v1') return;
    prompts.v1 = event.detail.goal || prompts.v1;
    promptText.textContent = prompts.v1;
    renderTranscript();
    updateMetrics();
    if (event.detail.customRules && eventFeed && !sessionRunning) {
      addEvent('训练规则', event.detail.customRules, true, '已保存，接入大模型后会参与复盘', { key: 'v1-custom-rule' });
    }
  });

  document.addEventListener('creator:v1-language-change', event => {
    if (mode !== 'v1') return;
    if (sessionRunning) {
      statusText.textContent = '请结束本轮后再切换识别语言';
      return;
    }
    if (window.api?.initASR) {
      statusText.textContent = `${event.detail.label}已就绪 · 离线中英双语模型`;
      updateSTTDiagnostics({ engine: 'sherpa', state: 'ready', lastError: '' }, true);
      return;
    }
    if (recognition) {
      recognition._manualStop = true;
      try { recognition.stop(); } catch (_) { /* already stopped */ }
      recognition = null;
    }
    statusText.textContent = `${event.detail.label}已就绪`;
    updateSTTDiagnostics({ engine: 'web-speech', state: 'ready', lastError: '' }, true);
  });

  document.querySelector('[data-paste-open]')?.addEventListener('click', () => {
    if (sessionRunning || !pastePanel) return;
    pastePanel.hidden = false;
    pasteInput?.focus();
  });
  pastePanel?.querySelectorAll('[data-paste-close]').forEach(button => button.addEventListener('click', () => { pastePanel.hidden = true; }));
  pastePanel?.querySelector('[data-paste-analyze]')?.addEventListener('click', () => {
    const value = pasteInput?.value.trim();
    if (!value) { pasteInput?.focus(); return; }
    transcript = value;
    interim = '';
    renderTranscript();
    updateMetrics();
    timer.textContent = '--:--';
    statusText.textContent = '逐字稿已分析';
    pastePanel.hidden = true;
    populateReportPanel();
    showTranscriptActions();
  });
  document.querySelector('[data-show-report]')?.addEventListener('click', openReport);
  document.querySelector('[data-copy-transcript]')?.addEventListener('click', async event => {
    if (!transcript.trim()) return;
    await navigator.clipboard.writeText(transcript);
    const button = event.currentTarget;
    button.textContent = '已复制';
    setTimeout(() => { button.textContent = '复制原文'; }, 1200);
  });
  document.querySelector('[data-clear-transcript]')?.addEventListener('click', () => {
    transcript = '';
    interim = '';
    startedAt = 0;
    timer.textContent = '00:00';
    setStageState('idle', '等待开始');
    eventFeed?.replaceChildren();
    const empty = document.querySelector('[data-feedback-empty]');
    if (empty) empty.hidden = false;
    renderTranscript();
    updateMetrics();
    document.querySelectorAll('[data-copy-transcript], [data-clear-transcript], [data-show-report]').forEach(button => { button.hidden = true; });
  });

  cameraButton?.addEventListener('click', toggleCamera);
  sttRetryButton?.addEventListener('click', () => {
    if (!sessionRunning) return;
    sttRetryButton.disabled = true;
    setStageState('requesting', '正在重新连接');
    try { recognition?.stop?.(); } catch (_) { /* Ignore a stale recognizer. */ }
    recognition = setupRecognition();
    Promise.resolve(recognition?.start?.())
      .catch(error => updateSTTDiagnostics({ state: 'error', lastError: error.message }, true))
      .finally(() => { sttRetryButton.disabled = false; });
  });
  startButton?.addEventListener('click', () => {
    Promise.resolve(sessionRunning ? stopSession() : startSession())
      .catch(error => addEvent('系统', error.message, true));
  });
  reportPanel?.querySelectorAll('[data-report-close]').forEach(button => button.addEventListener('click', () => {
    reportPanel.hidden = true;
    document.body.classList.remove('report-open');
  }));
  reportPanel?.querySelector('[data-report-retry]')?.addEventListener('click', () => {
    reportPanel.hidden = true;
    document.body.classList.remove('report-open');
    if (!sessionRunning) Promise.resolve(startSession()).catch(error => addEvent('系统', error.message, true));
  });
  promptText.textContent = mode === 'v1' ? (v1Rules().goal || prompts.v1) : prompts[mode];
  renderTranscript();
  refreshDesktopRuntime();
  window.api?.onSettingsUpdated?.(() => refreshDesktopRuntime());
  mountAudienceSetup();
  if (audienceSetup && mode !== 'v2') applyAudienceConfiguration(true);
  window.addEventListener('beforeunload', () => {
    avatarProvider?.disconnect();
    mediaController?.dispose();
  });
})();
