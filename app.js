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

  function featureEnabled(name) {
    return window.CreatorQAControls ? window.CreatorQAControls.featureEnabled(name) : true;
  }

  const pressureScripts = {
    low: [
      '我在听，继续说。',
      '可以再给一个具体例子吗？'
    ],
    medium: [
      '你的价值点是什么？请直接说结论。',
      '“很多”具体是多少？',
      '如果只保留一句话，你会怎么说？'
    ],
    high: [
      '前十秒还没听到重点，我可能会划走。',
      '停一下。请把刚才那段压缩到二十秒。',
      '这个说法听起来像广告，为什么观众要相信？',
      '请不要继续铺垫，直接给证据。'
    ]
  };

  const creatorEvents = [
    { who: '路人观众', text: '这和我有什么关系？先讲结果。' },
    { who: '老粉', text: '这个说法有点官方，能不能讲得像你自己？' },
    { who: '怀疑型观众', text: '你能给出亲身例子或数据吗？' },
    { who: '系统', text: '临时要求：把剩余内容压缩为三句话。', system: true }
  ];

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
      cameraButton.textContent = '开启摄像头';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      videoTile.classList.add('camera-on');
      cameraButton.classList.add('active');
      cameraButton.textContent = '关闭摄像头';
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
    if (cameraButton) cameraButton.textContent = '开启摄像头';
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

  function addEvent(who, text, system = false) {
    if (!eventFeed || !featureEnabled('feedback')) return;
    const card = document.createElement('div');
    card.className = `event-card${system ? ' system' : ''}`;
    const title = document.createElement('strong');
    title.textContent = who;
    const body = document.createElement('div');
    body.textContent = text;
    card.append(title, body);
    eventFeed.prepend(card);
  }

  function reactAudience(text) {
    const tiles = [...document.querySelectorAll('.audience-tile')];
    if (!tiles.length) return;
    tiles.forEach(tile => tile.classList.remove('attention'));
    const tile = tiles[eventIndex % tiles.length];
    tile.classList.add('attention');
    const reaction = tile.querySelector('.audience-reaction');
    if (reaction) reaction.textContent = text;
    setTimeout(() => tile.classList.remove('attention'), 4500);
  }

  function schedulePressure() {
    if (!featureEnabled('pressure') || !featureEnabled('audience')) return;
    clearInterval(pressureHandle);
    const interval = pressure === 'high' ? 12000 : pressure === 'medium' ? 18000 : 26000;
    pressureHandle = setInterval(() => {
      if (!sessionRunning) return;
      let item;
      if (mode === 'v3') {
        item = creatorEvents[eventIndex % creatorEvents.length];
        addEvent(item.who, item.text, item.system);
        reactAudience(item.text);
      } else {
        const list = pressureScripts[pressure];
        const text = list[eventIndex % list.length];
        addEvent('数字观众', text);
        reactAudience(text);
      }
      eventIndex += 1;
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
      if (featureEnabled('feedback')) addEvent('本轮复盘', `口头禅 ${filler} 次，表达净度 ${density}。下一轮只练一个动作：前十秒先说结论。`, true);
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
      addEvent('场景切换', button.textContent.trim(), true);
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

  cameraButton?.addEventListener('click', toggleCamera);
  startButton?.addEventListener('click', () => sessionRunning ? stopSession() : startSession());
  promptText.textContent = prompts[mode];
  renderTranscript();
})();
