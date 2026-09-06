/* Isolated design studies. No production settings, recording, AI calls or storage. */
(() => {
  'use strict';
  const direction = document.body.dataset.direction;
  let lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
  let sampleIndex = 0;
  let step = 0;
  let held = false;
  const copy = {
    zh: {
      nav: '训练方式', about: '关于项目', language: '切换为英文', switch: '切换方案',
      eyebrow: '面向自媒体新手的镜头表达训练',
      promise: '在发布之前，<br>先听懂自己。',
      description: '训练直视镜头的能力、减少无效表达、增加表达密度。',
      cta: '从 V1 开始练习', secondary: '了解训练方式',
      hint: '先面对镜头，再面对观众。',
      demo: '表达示例 · 非实时诊断', hover: '悬停或点击句子，看看另一种表达',
      next: '换一句', reveal: '切换句子的表达版本',
      steps: ['一句表达', '看见问题', '换种说法'],
      studio: '表达练习台', sample: '预置示例',
      noMic: '这段演示不使用麦克风，也不调用 AI。',
      lineNote: '点击「看见问题」，看看这句话可以从哪里调整。',
      finalNote: '少一些铺垫，保留你的观点。现在，试着自己再讲一次。',
      chapters: '选择今天要承受的压力', chaptersSub: '不必一步到位。从你现在的状态开始。',
      recommended: '推荐起点', enter: '前往训练',
      cards: [
        ['镜头表达训练', '训练直视镜头的能力、减少无效表达、增加表达密度。'],
        ['数字观众模拟', '加入面对面的数字观众，让深层问题在可控压力下暴露。'],
        ['终级实战演练', '为专业人士打造的严苛自媒体口播训练，你还可以变得更好，准备好了吗？']
      ],
      boundary: '数字观众与兴趣度评估仍在完善中；这里展示的是训练方向，不是已验证的观众反应。',
      footer: '面向自媒体新手的镜头表达训练原型。',
      contact: '联系与反馈', repo: '开源项目', license: '许可证',
      preview: '独立首页提案 · 尚未替换正式页面', back: '回到方案对照',
      brandFooter: '保留你的个性。练清楚你的表达。',
      samples: [
        { before: ['我想说的意思', '其实就是说', '，拍之前得先想清楚要讲给谁听。'], after: '开拍前，先想清楚你在讲给谁听。', note: '「我想说的意思」「其实就是说」都在为观点做铺垫，可以直接从观点开始。' },
        { before: ['我们', '首先第一步', '，要把这条视频里', '最主要的那个', '观点给找出来。'], after: '第一步，找到这条视频的核心观点。', note: '「首先」和「第一步」重复；把「最主要的那个观点」收束为「核心观点」。' },
        { before: ['关于这个问题的话', '，我的建议是先用手机拍，', '暂时先', '别急着买相机。'], after: '我的建议是：先用手机拍，别急着买相机。', note: '去掉泛泛的开场与重复的时间修饰，不改变「先用手机拍」这条建议。' }
      ]
    },
    en: {
      nav: 'The practice', about: 'About', language: 'Switch to Chinese', switch: 'Other direction',
      eyebrow: 'ON-CAMERA PRACTICE FOR NEW CREATORS',
      promise: 'Before you publish,<br>hear yourself clearly.',
      description: 'Train eye contact, reduce unnecessary words, and make your ideas clearer.',
      cta: 'Start with V1', secondary: 'Explore the practice', hint: 'Face the camera. Then face an audience.',
      demo: 'Illustrative example · Not live analysis', hover: 'Hover or tap the sentence to see a different take',
      next: 'Next example', reveal: 'Switch between sentence versions',
      steps: ['A first take', 'Find the friction', 'A clearer take'],
      studio: 'The expression studio', sample: 'Sample session',
      noMic: 'This demo uses no microphone and makes no AI calls.',
      lineNote: 'Select “Find the friction” to explore what could change.',
      finalNote: 'Less preamble. The same idea. Now try saying it in your own voice.',
      chapters: 'Choose your level of pressure', chaptersSub: 'Start where you are. Build from there.',
      recommended: 'START HERE', enter: 'Open training',
      cards: [
        ['Camera practice', 'Train eye contact, reduce unnecessary words, and make your ideas clearer.'],
        ['Audience simulation', 'Practice with digital viewers to surface deeper issues under controlled pressure.'],
        ['Creator practice studio', 'A demanding on-camera practice space for creators. You can get better. Ready?']
      ],
      boundary: 'Digital audiences and interest assessment are still being developed. These are training directions, not validated audience reactions.',
      footer: 'An on-camera expression training prototype for new creators.',
      contact: 'Contact & feedback', repo: 'Source code', license: 'License',
      preview: 'Independent homepage proposal · Not the live homepage', back: 'Compare directions',
      brandFooter: 'Keep your personality. Make your point.',
      samples: [
        { before: ['What I mean is', ', ', 'basically', ', before filming you need to think about who you are talking to.'], after: 'Before you film, decide who you are talking to.', note: '“What I mean is” and “basically” delay the point here. Start with the advice itself.' },
        { before: ['The ', 'first initial step', ' is to find ', 'the most main', ' point in this video.'], after: 'First, find the core idea of this video.', note: '“First” and “initial” repeat the same idea. “Core idea” is a clearer way to name the main point.' },
        { before: ['With regard to this question', ', I suggest using your phone ', 'for the time being', ' instead of rushing to buy a camera.'], after: 'Start with your phone. Don’t rush to buy a camera.', note: 'Remove the broad preamble while keeping the same advice: start with the phone you have.' }
      ]
    }
  };
  const links = ['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html'];
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function mark(id, className = '') {
    return `<svg class="brand-mark ${className}" viewBox="60 270 1140 720" aria-hidden="true" focusable="false">
      <defs><filter id="ink-${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -0.2126 -0.7152 -0.0722 0 1"/><feComponentTransfer><feFuncA type="linear" slope="1.2" intercept="-0.1"/></feComponentTransfer></filter>
      <mask id="mask-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254" style="mask-type:alpha"><image href="../../../assets/brand/read-yourself-concentric.png" width="1254" height="1254" filter="url(#ink-${id})"/></mask></defs>
      <rect width="1254" height="1254" fill="currentColor" mask="url(#mask-${id})"/></svg>`;
  }
  function actions(c) {
    return `<div class="hero-actions"><a class="primary" href="../../../${links[0]}">${c.cta}<span aria-hidden="true">↗</span></a><a class="text-link" href="#practice">${c.secondary}<span aria-hidden="true">↓</span></a></div>`;
  }
  function render() {
    const c = copy[lang];
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = `Read Yourself — ${lang === 'zh' ? '首页方案' : 'Homepage direction'} ${direction.toUpperCase()}`;
    document.querySelector('#app').innerHTML = `
      <a class="skip" href="#main">${lang === 'zh' ? '跳到正文' : 'Skip to content'}</a>
      <header class="site-header"><a class="wordmark" href="index.html" aria-label="Read Yourself · ${c.back}">${mark('header')}<span>Read Yourself<span class="wordmark-dot">.</span></span></a>
        <nav aria-label="${lang === 'zh' ? '主导航' : 'Main navigation'}"><a href="#practice">${c.nav}</a><a href="#about">${c.about}</a></nav>
        <div class="header-tools"><button class="language" type="button" aria-label="${c.language}">${lang === 'zh' ? '<b>中</b><span>/</span>EN' : '中<span>/</span><b>EN</b>'}</button><a class="compare-link" href="option-${direction === 'a' ? 'b' : 'a'}.html?lang=${lang}" aria-label="${c.switch}">${direction.toUpperCase()} <span aria-hidden="true">⇄</span></a></div>
      </header>
      <main id="main">
      ${direction === 'a' ? `
        <section class="hero hero-a" aria-labelledby="hero-title">
          <div class="a-copy"><p class="eyebrow">EXPRESSION TRAINER / CREATOR PRESSURE</p>
            <h1 id="hero-title">Read<span class="title-second">Yourself<span class="title-period">.</span></span></h1>
            <p class="brand-question" lang="en">When your ideas become content,<br>would you read it yourself?</p>
            <div class="a-purpose"><p class="purpose">${c.eyebrow}</p><p class="description">${c.description}</p></div>
            ${actions(c)}
          </div>
          <div class="brand-stage"><div class="stage-caption"><span>READ / SPEAK / REPEAT</span><span aria-hidden="true">↙</span></div>
            <div class="hero-emblem">${mark('hero')}</div>
            <div class="sentence-study"><p class="micro">${c.demo}</p><button class="sentence-button" type="button" aria-label="${c.reveal}" aria-pressed="false"><span id="a-sentence"></span></button><div class="sentence-tools"><span>${c.hover}</span><button class="next-sample" type="button">${c.next} <span aria-hidden="true">↗</span></button></div></div>
          </div>
        </section>` : `
        <section class="hero hero-b" aria-labelledby="hero-title">
          <div class="b-copy"><p class="eyebrow">${c.eyebrow}</p><h1 id="hero-title">${c.promise}</h1><p class="description">${c.description}</p>${actions(c)}<p class="quiet-note">${c.hint}</p><p class="brand-question" lang="en">When your ideas become content,<br>would you read it yourself?</p></div>
          <section class="practice-demo" aria-label="${c.studio}"><div class="demo-top"><span>${c.studio}</span><span class="micro">${c.sample}</span></div>
            <div class="demo-steps" role="group" aria-label="${c.studio}">${c.steps.map((label, i) => `<button data-step="${i}" type="button" aria-pressed="${i === step}"><span class="step-num">0${i + 1}</span>${label}</button>`).join('')}</div>
            <div class="demo-sheet"><div class="sheet-meta"><span id="take-label"></span>${mark('sheet')}</div><div class="demo-sentence" id="demo-sentence" aria-live="polite"></div><div class="feedback-note" id="feedback-note"></div></div>
            <div class="demo-bottom"><span class="micro">${c.demo}</span><button class="next-sample" type="button">${c.next} <span aria-hidden="true">↗</span></button></div><p class="demo-disclaimer">${c.noMic}</p>
          </section>
        </section>`}
        <section class="practice-section" id="practice" aria-labelledby="practice-title"><div class="section-heading"><p class="eyebrow">THE PRACTICE</p><div><h2 id="practice-title">${c.chapters}</h2><p>${c.chaptersSub}</p></div><span class="section-index" aria-hidden="true">01—03</span></div>
          <div class="chapter-list">${c.cards.map((card, i) => `<a href="../../../${links[i]}" class="chapter chapter-${i + 1}"><div class="chapter-id"><span>V${i + 1}</span>${i === 0 ? `<small>${c.recommended}</small>` : ''}</div><div class="chapter-copy"><h3>${card[0]}</h3><p>${card[1]}</p></div><span class="chapter-enter">${c.enter} <span aria-hidden="true">↗</span></span></a>`).join('')}</div><p class="boundary">${c.boundary}</p>
        </section>
      </main>
      <footer id="about"><div class="footer-main"><div><p class="eyebrow">READ YOURSELF</p><h2>${c.brandFooter}</h2><p>${c.footer}</p></div><div class="footer-links"><a href="../../../contact.html">${c.contact} ↗</a><a href="https://github.com/chujiachen167-ui/expression-trainer-creator-pressure" target="_blank" rel="noopener noreferrer">${c.repo} ↗</a><a href="../../../LICENSE">${c.license} ↗</a></div></div><div class="footer-bottom"><span>${c.preview}</span><a href="index.html">${c.back} ↗</a></div></footer>`;
    document.querySelector('.language').addEventListener('click', () => {
      lang = lang === 'zh' ? 'en' : 'zh';
      const url = new URL(location.href); url.searchParams.set('lang', lang);
      try { history.replaceState(null, '', url); } catch { /* file preview may restrict history */ }
      render(); document.querySelector('.language').focus({ preventScroll: true });
    });
    document.querySelectorAll('.next-sample').forEach(button => button.addEventListener('click', () => {
      sampleIndex = (sampleIndex + 1) % c.samples.length; step = 0; held = false; updateDemo();
    }));
    document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => { step = Number(button.dataset.step); updateDemo(); }));
    if (direction === 'a') {
      const sentence = document.querySelector('.sentence-button');
      sentence.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') showSentence(true); });
      sentence.addEventListener('pointerleave', () => showSentence(held));
      sentence.addEventListener('click', () => { held = !held; showSentence(held); });
      sentence.addEventListener('focus', () => showSentence(true));
      sentence.addEventListener('blur', () => showSentence(held));
    }
    updateDemo();
  }
  function phraseMarkup(sample, highlighted) {
    // Authored sample annotations, deliberately not presented as a running detector.
    const indices = lang === 'zh' ? [[0, 1], [1, 3], [0, 2]][sampleIndex] : [[0, 2], [1, 3], [0, 2]][sampleIndex];
    return sample.before.map((phrase, index) => highlighted && indices.includes(index) ? `<mark class="mark-${(sampleIndex + index) % 3}">${escape(phrase)}</mark>` : escape(phrase)).join('');
  }
  function showSentence(revised) {
    const button = document.querySelector('.sentence-button');
    const sample = copy[lang].samples[sampleIndex];
    button.classList.toggle('is-revised', revised);
    button.setAttribute('aria-pressed', String(revised));
    document.querySelector('#a-sentence').innerHTML = revised ? escape(sample.after) : phraseMarkup(sample, true);
  }
  function updateDemo() {
    if (direction === 'a') { showSentence(held); return; }
    const c = copy[lang]; const sample = c.samples[sampleIndex];
    document.querySelectorAll('[data-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.step) === step)));
    document.querySelector('#take-label').textContent = `${String(sampleIndex + 1).padStart(2, '0')} / ${c.steps[step]}`;
    const sentence = document.querySelector('#demo-sentence');
    sentence.innerHTML = step === 2 ? escape(sample.after) : phraseMarkup(sample, step === 1);
    sentence.classList.toggle('is-revised', step === 2);
    document.querySelector('#feedback-note').textContent = step === 0 ? c.lineNote : step === 1 ? sample.note : c.finalNote;
    document.querySelector('.practice-demo').dataset.step = String(step);
  }
  render();
})();
