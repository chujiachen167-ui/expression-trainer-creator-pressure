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
  const promptText = document.querySelector('#sessionPrompt');
  const loadingRow = document.querySelector('.loading-row');
  const eventFeed = document.querySelector('#eventFeed');
  const openBriefButton = document.querySelector('[data-open-brief]');
  const reportPanel = document.querySelector('#sessionReport');

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

  function featureEnabled(name) {
    return window.CreatorQAControls ? window.CreatorQAControls.featureEnabled(name) : true;
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
      <div class="audience-config-actions"><button type="button" data-audience-apply>应用模板</button><button type="button" data-audience-preview>试听反应</button></div>
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
    section.querySelector('[data-audience-preview]').addEventListener('click', () => fireAudienceReaction(true));
    updateSummary();
  }

  function audienceCard(profile) {
    return `<div class="audience-tile" data-profile-id="${profile.id}"><div class="audience-copy"><div class="avatar">${profile.glyph}</div><div class="audience-name">${profile.name}</div><div class="audience-role">${profile.role}</div><div class="audience-reaction">${profile.motivation}</div><div class="avatar-provider-state">等待连接</div></div></div>`;
  }

  function renderAudienceProfiles() {
    if (mode === 'v2') {
      const oldTile = document.querySelector('.duo-room > .audience-tile');
      if (oldTile && currentProfiles[0]) oldTile.outerHTML = audienceCard(currentProfiles[0]);
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
    currentProfiles = engine.getProfiles(currentTemplate, mode === 'v2' ? 1 : 3);
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

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function countTerms(text, terms) {
    return terms.reduce((sum, term) => sum + (text.split(term).length - 1), 0);
  }

  function updateMetrics() {
    if (!featureEnabled('metrics')) return;
    const clean = transcript.replace(/[，。！？、；：\s]/g, '');
    const fillerCount = countTerms(clean, fillerWords);
    const vagueCount = countTerms(clean, vagueWords);
    const repeatedCount = [...clean.matchAll(/(.{2,4})\1+/g)].length;
    const elapsedMinutes = Math.max((Date.now() - startedAt) / 60000, 0.1);
    const speed = sessionRunning ? Math.round(clean.length / elapsedMinutes) : 0;
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

  function renderTranscript() {
    if (!featureEnabled('transcript')) return;
    if (!transcript && !interim) {
      transcriptBox.innerHTML = '<span class="placeholder">开始后，实时转写会出现在这里。系统不会把数字人提示混进你的正文。</span>';
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
  }

  async function toggleCamera() {
    if (!featureEnabled('camera')) return;
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
    if (!stream) return;
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    videoTile.classList.remove('camera-on');
    cameraButton?.classList.remove('active');
    if (cameraButton) cameraButton.innerHTML = '<span class="control-indicator"></span>开启摄像头';
  }

  function setupRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return null;
    const instance = new Recognition();
    instance.lang = 'zh-CN';
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = event => {
      interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) transcript += piece;
        else interim += piece;
      }
      renderTranscript();
      updateMetrics();
    };
    instance.onend = () => {
      if (sessionRunning) {
        try { instance.start(); } catch (_) { /* browser is already restarting */ }
      }
    };
    instance.onerror = event => {
      if (event.error !== 'no-speech') addEvent('系统', `语音识别暂不可用：${event.error}`, true);
    };
    return instance;
  }

  function addEvent(who, text, system = false, meta = '') {
    if (!eventFeed || !featureEnabled('feedback')) return;
    const card = document.createElement('div');
    card.className = `event-card${system ? ' system' : ''}`;
    const title = document.createElement('strong');
    title.textContent = who;
    const body = document.createElement('div');
    body.textContent = text;
    card.append(title, body);
    if (meta) {
      const detail = document.createElement('small');
      detail.textContent = meta;
      card.appendChild(detail);
    }
    eventFeed.prepend(card);
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

  function startSession() {
    transcript = '';
    interim = '';
    eventIndex = 0;
    sessionRunning = true;
    startedAt = Date.now();
    startButton.textContent = '结束并生成复盘';
    startButton.classList.add('running');
    statusDot.classList.add('live');
    statusText.textContent = '训练中';
    promptText.textContent = prompts[mode];
    renderTranscript();
    updateMetrics();
    timerHandle = setInterval(() => { timer.textContent = formatTime(Date.now() - startedAt); }, 250);
    if (featureEnabled('transcript') || featureEnabled('metrics')) {
      recognition = recognition || setupRecognition();
      if (recognition) {
        try { recognition.start(); } catch (_) { /* already started */ }
      } else {
        addEvent('系统', '当前浏览器不支持 Web Speech API，仍可体验摄像头和压力流程。建议使用 Chrome 或 Edge。', true);
      }
    }
    if (mode !== 'v1') schedulePressure();
    if (featureEnabled('feedback')) addEvent('训练目标', promptText.textContent, true);
  }

  function stopSession() {
    sessionRunning = false;
    clearInterval(timerHandle);
    clearInterval(pressureHandle);
    if (recognition) {
      try { recognition.stop(); } catch (_) { /* already stopped */ }
    }
    avatarProvider?.interrupt();
    startButton.disabled = true;
    statusText.textContent = '生成复盘';
    loadingRow?.classList.add('visible');
    setTimeout(() => {
      loadingRow?.classList.remove('visible');
      statusDot.classList.remove('live');
      statusText.textContent = '本轮完成';
      startButton.disabled = false;
      startButton.textContent = '再练同一题';
      startButton.classList.remove('running');
      const filler = document.getElementById('fillerMetric')?.textContent || '0';
      const density = document.getElementById('densityMetric')?.textContent || '--';
      const words = document.getElementById('wordMetric')?.textContent || '0';
      if (featureEnabled('feedback')) addEvent('本轮复盘', `口头禅 ${filler} 次，表达净度 ${density}。下一轮只练一个动作：前十秒先说结论。`, true, currentTemplate ? `受众模板：${currentTemplate.name}` : '镜头基线');
      if (reportPanel) {
        reportPanel.querySelector('#reportDensity').textContent = density;
        reportPanel.querySelector('#reportFiller').textContent = filler;
        reportPanel.querySelector('#reportWords').textContent = words;
        reportPanel.hidden = false;
        document.body.classList.add('report-open');
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
      document.querySelectorAll('.scenario-btn').forEach(item => item.classList.toggle('active', item === button));
      prompts.v3 = button.dataset.prompt;
      promptText.textContent = prompts.v3;
      addEvent('场景切换', button.querySelector('[data-scenario-name]')?.textContent.trim() || button.textContent.trim(), true, '目标受众保持不变');
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

  cameraButton?.addEventListener('click', toggleCamera);
  startButton?.addEventListener('click', () => sessionRunning ? stopSession() : startSession());
  reportPanel?.querySelectorAll('[data-report-close]').forEach(button => button.addEventListener('click', () => {
    reportPanel.hidden = true;
    document.body.classList.remove('report-open');
  }));
  reportPanel?.querySelector('[data-report-retry]')?.addEventListener('click', () => {
    reportPanel.hidden = true;
    document.body.classList.remove('report-open');
    if (!sessionRunning) startSession();
  });
  promptText.textContent = prompts[mode];
  renderTranscript();
  mountAudienceSetup();
  if (audienceSetup) applyAudienceConfiguration(true);
  window.addEventListener('beforeunload', () => avatarProvider?.disconnect());
})();
