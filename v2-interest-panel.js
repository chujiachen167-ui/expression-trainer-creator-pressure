(() => {
  const root = document.querySelector('[data-v2-interest-panel]');
  if (!root || document.body.dataset.mode !== 'v2') return;
  const Session = window.CreatorV2Session;
  const Review = window.CreatorV2Review;
  if (!Session || !Review) return;

  const tr = (key, fallback) => window.CreatorI18n?.t(key, {}, fallback) || fallback;
  const appearanceDefaults = {
    lineColor: '#ff2f92',
    eventColor: '#42e8d6',
    fontSize: 12,
    chartHeight: 96,
    hintDensity: 'low'
  };

  function appearance() {
    const fromQa = window.CreatorQAControls?.getState?.().components?.v2Interest;
    return { ...appearanceDefaults, ...(fromQa || {}) };
  }

  root.innerHTML = `
    <header class="v2-interest-head">
      <div>
        <h3 data-i18n="v2.curve.compactTitle">${tr('v2.curve.compactTitle', '模拟兴趣')}</h3>
        <p class="v2-interest-bound" data-i18n="v2.curve.bound">${tr('v2.curve.bound', '训练推断，不是真实观看率、心理测量或平台流量预测。规则判断器，不是语义模型。')}</p>
      </div>
      <strong data-v2-score>--</strong>
    </header>
    <p class="v2-interest-live" data-v2-live></p>
    <svg class="v2-interest-chart" viewBox="0 0 360 150" role="img" aria-describedby="v2ChartSummary" preserveAspectRatio="xMidYMid meet">
      <title data-i18n="v2.curve.title">${tr('v2.curve.title', '模拟观众兴趣趋势')}</title>
      <defs><linearGradient id="v2InterestFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-opacity=".34"/><stop offset="1" stop-opacity="0"/></linearGradient></defs>
      <path class="v2-chart-axis" d="M36 12 V116 H350"></path>
      <path class="v2-chart-grid" d="M36 12 H350 M36 64 H350"></path>
      <text class="v2-chart-label" x="28" y="16" text-anchor="end">100</text>
      <text class="v2-chart-label" x="28" y="68" text-anchor="end">50</text>
      <text class="v2-chart-label" x="28" y="120" text-anchor="end">0</text>
      <g data-v2-time-axis></g>
      <g data-v2-lines></g>
      <g data-v2-marks></g>
    </svg>
    <details class="v2-chart-data"><summary data-i18n="v2.curve.records">${tr('v2.curve.records', '查看时间与数值')}</summary><table><caption data-i18n="v2.curve.title">${tr('v2.curve.title', '模拟观众兴趣趋势')}</caption><thead><tr><th scope="col" data-i18n="v2.curve.axis">${tr('v2.curve.axis', '会话时间')}</th><th scope="col" data-i18n="v2.curve.value">${tr('v2.curve.value', '模拟兴趣（0–100）')}</th></tr></thead><tbody data-v2-table></tbody></table></details>
    <div class="v2-interest-hint" data-v2-hint></div>
    <ul class="v2-event-list" data-v2-events></ul>
    <section class="v2-review" data-v2-review hidden></section>
    <p class="v2-export-note" data-v2-export-note hidden></p>
  `;

  const scoreNode = root.querySelector('[data-v2-score]');
  const liveNode = root.querySelector('[data-v2-live]');
  const hintNode = root.querySelector('[data-v2-hint]');
  const eventList = root.querySelector('[data-v2-events]');
  const reviewNode = root.querySelector('[data-v2-review]');
  const exportNote = root.querySelector('[data-v2-export-note]');
  const lines = root.querySelector('[data-v2-lines]');
  const marks = root.querySelector('[data-v2-marks]');
  const chart = root.querySelector('.v2-interest-chart');
  const timeAxis = root.querySelector('[data-v2-time-axis]');
  const dataTable = root.querySelector('[data-v2-table]');
  const feedbackHost = document.querySelector('[data-v2-feedback-content]');
  const reviewHost = document.querySelector('[data-v2-review-host]');
  const report = document.querySelector('[data-v2-report]');
  const wordReview = document.querySelector('[data-v2-word-review]');
  const chartData = root.querySelector('.v2-chart-data');
  chartData.querySelector('summary').after(root.querySelector('.v2-interest-bound'));
  document.querySelector('[data-v2-chart-context]')?.append(chartData);
  liveNode.id = 'v2ChartSummary';
  feedbackHost?.append(liveNode, hintNode, eventList);
  reviewHost?.append(reviewNode, exportNote);
  let snapshot = null;

  function applyAppearance() {
    const skin = appearance();
    root.style.setProperty('--v2-curve-line', skin.lineColor);
    root.style.setProperty('--v2-curve-event', skin.eventColor);
    root.style.setProperty('--v2-curve-font', `${skin.fontSize}px`);
    root.style.setProperty('--v2-curve-height', `${skin.chartHeight}px`);
    chart.style.height = `${Math.max(96, Math.min(160, skin.chartHeight))}px`;
    root.dataset.hintDensity = skin.hintDensity || 'low';
  }

  function playback() {
    return window.CreatorV2Playback || null;
  }

  function locale() {
    return window.CreatorI18n?.getLocale?.() || 'zh-CN';
  }

  function drawChart(round) {
    lines.replaceChildren();
    marks.replaceChildren();
    const skin = appearance();
    const values = Session.samplePoints(round?.points, 48);
    const maxT = Math.max(30000, Math.ceil(Math.max(0, ...values.map(item => item.t || 0)) / 30000) * 30000);
    const width = Math.max(180, chart.clientWidth || 360);
    const height = Math.max(96, Math.min(160, skin.chartHeight));
    const bottom = height - 22, right = width - 4;
    chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
    chart.querySelector('.v2-chart-axis').setAttribute('d', `M26 8 V${bottom} H${right}`);
    chart.querySelector('.v2-chart-grid').setAttribute('d', `M26 8 H${right} M26 ${(8 + bottom) / 2} H${right}`);
    const xOf = t => 26 + Math.max(0, Math.min(1, t / maxT)) * (right - 26);
    const yOf = score => bottom - Math.max(0, Math.min(100, score)) / 100 * (bottom - 8);
    chart.querySelectorAll(':scope > text').forEach((label, i) => { label.setAttribute('x', '19'); label.setAttribute('y', yOf([100, 50, 0][i]) + 3); });
    timeAxis.innerHTML = [0, maxT / 2, maxT].map(t => `<text class="v2-chart-label" x="${xOf(t)}" y="${height - 4}" text-anchor="${t === 0 ? 'start' : t === maxT ? 'end' : 'middle'}">${Session.formatClock(t, 'exact')}</text>`).join('');
    dataTable.replaceChildren();
    values.forEach(item => {
      const row = document.createElement('tr');
      [Session.formatClock(item.t, 'exact'), String(item.score)].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
      dataTable.append(row);
    });
    if (!round || !round.hasScore) {
      scoreNode.textContent = '--';
      dataTable.innerHTML = `<tr><td colspan="2">${tr('v2.curve.insufficient', '信息不足 / 暂无明确变化。')}</td></tr>`;
      return;
    }
    const pending = (round.points || []).some(point => point.kind === 'pending') && (round.status === 'running' || round.status === 'waiting-final');
    if (!values.length) return;
    let d = '';
    values.forEach((point, index) => {
      d += `${index ? 'L' : 'M'}${xOf(point.t).toFixed(1)} ${yOf(point.score).toFixed(1)} `;
    });
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', `${d.trim()} L${xOf(values[values.length - 1].t).toFixed(1)} ${bottom} L${xOf(values[0].t).toFixed(1)} ${bottom} Z`);
    area.setAttribute('fill', 'url(#v2InterestFill)');
    area.style.color = skin.lineColor;
    chart.querySelector('#v2InterestFill stop:first-child')?.setAttribute('stop-color', skin.lineColor);
    chart.querySelector('#v2InterestFill stop:last-child')?.setAttribute('stop-color', skin.lineColor);
    lines.append(area);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d.trim());
    path.setAttribute('class', 'v2-interest-line');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', skin.lineColor);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    lines.append(path);
    const current = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    current.setAttribute('cx', xOf(values[values.length - 1].t).toFixed(1));
    current.setAttribute('cy', yOf(values[values.length - 1].score).toFixed(1));
    current.setAttribute('r', '3.4');
    current.setAttribute('fill', '#fff');
    current.setAttribute('stroke', skin.lineColor);
    current.setAttribute('stroke-width', '2');
    current.setAttribute('aria-hidden', 'true');
    lines.append(current);
    if (pending) {
      const last = values[values.length - 1];
      const gap = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gap.setAttribute('x1', xOf(last.t).toFixed(1));
      gap.setAttribute('y1', yOf(last.score).toFixed(1));
      gap.setAttribute('x2', xOf(Math.max(last.t, Math.min(maxT, Date.now() - round.practiceStartedAt))).toFixed(1));
      gap.setAttribute('y2', yOf(last.score).toFixed(1));
      gap.setAttribute('class', 'v2-interest-gap');
      gap.setAttribute('stroke-dasharray', '4 4');
      gap.setAttribute('stroke', skin.eventColor);
      lines.append(gap);
    }
    (round.events || []).forEach(event => {
      if (event.startMs == null || event.confidence === 'insufficient') return;
      const button = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const score = event.scoreAfter ?? round.score;
      button.setAttribute('cx', xOf(event.startMs).toFixed(1));
      button.setAttribute('cy', yOf(score).toFixed(1));
      button.setAttribute('r', '4');
      button.setAttribute('class', 'v2-interest-mark');
      button.setAttribute('tabindex', '0');
      button.setAttribute('role', 'button');
      button.setAttribute('data-event-id', event.eventId);
      button.setAttribute('fill', skin.eventColor);
      button.setAttribute('aria-label', `${Session.formatClock(event.startMs, event.timePrecision)} · ${score}/100 · ${event.explanation.slice(0, 80)}`);
      button.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); locate(event); } });
      marks.append(button);
    });
    const latest = values[values.length - 1];
    scoreNode.textContent = String(latest.score);
  }

  function locate(event) {
    if (!event) return;
    window.CreatorV2SessionStore?.selectEvent?.(event.eventId);
    document.dispatchEvent(new CustomEvent('creator:v2-locate-segment', {
      detail: { segmentId: event.segmentId, eventId: event.eventId, excerpt: event.evidence?.match || event.evidence?.excerpt || '' }
    }));
    const rec = playback()?.getRecording?.();
    const round = snapshot?.active || snapshot?.previous;
    const mapped = rec && round ? Session.recordingSeek(event.startMs, rec, round.practiceStartedAt) : { seekable: false };
    if (mapped.seekable) playback().seek(mapped.seconds);
  }

  function eventCard(event, round, options = {}) {
    const item = document.createElement(options.asButton === false ? 'div' : 'button');
    if (options.asButton !== false) {
      item.type = 'button';
    }
    item.className = 'v2-event-item';
    item.dataset.eventId = event.eventId;
    const timeLabel = Session.formatClock(event.startMs, event.timePrecision);
    const rec = playback()?.getRecording?.();
    const mapped = rec && round ? Session.recordingSeek(event.startMs, rec, round.practiceStartedAt) : { seekable: false };
    item.innerHTML = `
      <strong>${event.audienceName || event.audienceId}</strong>
      <span class="v2-event-time">${timeLabel || tr('v2.curve.noTime', '无精确时间')}</span>
      <p>${event.explanation}</p>
      <p class="v2-event-suggest">${event.suggestion}</p>
      ${!options.compact && event.evidence?.excerpt ? `<blockquote>${event.evidence.excerpt}</blockquote>` : ''}
      ${options.compact ? '' : mapped.seekable ? `<span class="v2-seek-ok">${tr('v2.curve.seek', '可跳转录像')}</span>` : `<span class="v2-seek-fallback">${tr('v2.curve.transcriptOnly', '无录像，定位逐字稿')}</span>`}
    `;
    item.addEventListener('click', () => locate(event));
    item.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); locate(event); }
    });
    return item;
  }

  function renderLive(round) {
    const lang = locale();
    if (!round || round.status === 'idle') {
      liveNode.textContent = tr('v2.curve.wait', '开始说话后，会按会话时间记录模拟兴趣，而不是均分点。');
      hintNode.textContent = '';
      eventList.replaceChildren();
      return;
    }
    if (round.status === 'failed') {
      liveNode.textContent = tr('v2.review.failed', '转写失败。失败不计入你的表达表现。');
      hintNode.textContent = '';
      return;
    }
    if (round.status === 'empty') {
      liveNode.textContent = tr('v2.review.empty', '本轮没有被接受的发言，因此不生成模拟分数。');
      hintNode.textContent = '';
      return;
    }
    if (round.status === 'waiting-final' || (round.pendingCount > 0 && round.status === 'running')) {
      liveNode.textContent = tr('v2.curve.pending', '正在等待已接受字幕收尾。等待不会被画成兴趣下降。');
    } else if (!round.hasScore) {
      liveNode.textContent = tr('v2.curve.insufficient', '信息不足 / 暂无明确变化。');
    } else {
      liveNode.textContent = `${tr('v2.curve.relative', '相对模拟兴趣')} ${round.score} · ${tr('v2.curve.notPercent', '不是留存概率')}`;
    }
    const major = [...(round.events || [])].reverse().find(event => event.confidence !== 'insufficient');
    if (round.status === 'running' || round.status === 'waiting-final') {
      hintNode.textContent = major ? '' : tr('v2.curve.insufficient', '信息不足 / 暂无明确变化。');
      eventList.replaceChildren();
      if (major) eventList.append(eventCard(major, round, { compact: true }));
    } else {
      hintNode.textContent = '';
    }
    void lang;
  }

  function renderReview(round, previous) {
    if (report) {
      report.hidden = !round || ['idle', 'running', 'waiting-final'].includes(round.status);
      if (report.hidden) report.open = false;
    }
    if (!round || round.status === 'running' || round.status === 'waiting-final') {
      reviewNode.hidden = true;
      exportNote.hidden = true;
      return;
    }
    const lang = locale();
    const review = Review.buildReview(round, lang);
    if (wordReview && window.CreatorExpressionAnalysis) {
      const text = (round.segments || []).filter(segment => segment.status === 'final').map(segment => segment.text).join('\n');
      const analysis = window.CreatorExpressionAnalysis.analyze(text);
      wordReview.replaceChildren();
      const title = document.createElement('h4');
      title.textContent = tr('v2.report.words', '压力下的表达');
      wordReview.append(title);
      const metrics = document.createElement('div'); metrics.className = 'v2-word-metrics';
      [[tr('v2.report.filler', '填充词'), analysis.fillers.length], [tr('v2.report.vague', '模糊词'), analysis.vague.length], [tr('v2.report.hedge', '犹豫词'), analysis.hedges.length], [tr('v2.report.repeat', '重复表达'), analysis.repeats.length]].forEach(([label, value]) => {
        const cell = document.createElement('div'), name = document.createElement('span'), count = document.createElement('strong');
        name.textContent = label; count.textContent = analysis.scoreable ? String(value) : '--'; cell.append(name, count); metrics.append(cell);
      });
      wordReview.append(metrics);
      if (!analysis.scoreable) { const note = document.createElement('p'); note.textContent = analysis.quality?.message || tr('v2.curve.insufficient', '信息不足 / 暂无明确变化。'); wordReview.append(note); }
      else window.CreatorExpressionAnalysis.suggestions(analysis).forEach(item => { const p = document.createElement('p'); p.textContent = `${item.title}：${item.text}`; wordReview.append(p); });
    }
    const comparison = previous ? Review.compareRounds(previous, round, lang) : null;
    reviewNode.hidden = false;
    const events = (review.keyEvents || []).map(event => {
      const wrap = document.createElement('div');
      wrap.append(eventCard(event, round));
      return wrap.innerHTML;
    }).join('');
    const compareHtml = comparison
      ? comparison.comparable
        ? `<div class="v2-compare"><h4>${tr('v2.review.compare', '同题比较')}</h4><p>${comparison.reason}</p>${(comparison.changes || []).map(change => `<p><strong>${change.type}</strong><br>${tr('v2.review.before', '上一轮')}：${change.beforeQuote || '—'}<br>${tr('v2.review.after', '这一轮')}：${change.afterQuote || '—'}</p>`).join('')}</div>`
        : `<div class="v2-compare"><h4>${tr('v2.review.compare', '同题比较')}</h4><p>${comparison.reason}</p></div>`
      : `<p>${tr('v2.review.needSecond', '再练同一题后，这里会引用前后原句做比较。')}</p>`;
    reviewNode.innerHTML = `
      <h4 data-i18n="v2.review.title">${tr('v2.review.title', '本轮复盘')}</h4>
      <p>${review.note || review.opening.explanation}</p>
      <p><strong>${tr('v2.review.opening', '开场')}</strong> ${review.opening.explanation}</p>
      <div class="v2-review-events">${events || `<p>${tr('v2.curve.insufficient', '信息不足 / 暂无明确变化。')}</p>`}</div>
      <p><strong>${tr('v2.review.next', '下一轮动作')}</strong> ${review.nextAction}</p>
      ${compareHtml}
      <p class="v2-export-preview">${tr('v2.review.exportContains', '导出包含两轮逐字稿、依据与时间精度，不含音视频、密钥或设备信息。')}</p>
      <button type="button" class="ghost-btn" data-v2-export>${tr('v2.review.export', '保存复盘 JSON')}</button>
    `;
    reviewNode.querySelectorAll('[data-event-id]').forEach(node => {
      const event = (round.events || []).find(item => item.eventId === node.dataset.eventId);
      if (event) node.addEventListener('click', () => locate(event));
    });
    reviewNode.querySelector('[data-v2-export]')?.addEventListener('click', () => {
      const payload = Review.exportPayload({ rounds: [previous, round].filter(Boolean), locale: lang });
      Review.downloadJson(payload);
      window.CreatorV2SessionStore?.markSaved?.();
      exportNote.hidden = false;
      exportNote.textContent = tr('v2.review.exported', '复盘 JSON 已保存到本机下载。');
    });
    exportNote.hidden = false;
    exportNote.textContent = snapshot?.unsaved
      ? tr('v2.review.unsaved', '刷新前可先保存复盘 JSON。不会阻断离开。')
      : '';
  }

  function render(next) {
    snapshot = next;
    applyAppearance();
    const round = next?.active;
    drawChart(round);
    renderLive(round);
    if (round && round.status !== 'running' && round.status !== 'waiting-final') {
      eventList.replaceChildren();
      (round.events || []).filter(event => event.confidence !== 'insufficient').slice(-6).forEach(event => eventList.append(eventCard(event, round, { compact: true })));
    }
    renderReview(round, next?.previous);
    window.CreatorQAControls?.refreshCopyLibrary?.();
  }

  document.addEventListener('creator:v2-session-change', event => render(event.detail));
  document.addEventListener('creator:component-settings-change', () => { if (snapshot) render(snapshot); else applyAppearance(); });
  document.addEventListener('creator:locale-change', () => { if (snapshot) render(snapshot); });
  root.addEventListener('click', event => {
    const mark = event.target.closest('[data-event-id]');
    if (!mark || !snapshot?.active) return;
    const found = snapshot.active.events.find(item => item.eventId === mark.dataset.eventId);
    if (found) locate(found);
  });
  applyAppearance();
  drawChart(null);
  if (window.ResizeObserver) new ResizeObserver(() => drawChart(snapshot?.active)).observe(chart);
  liveNode.textContent = tr('v2.curve.wait', '开始说话后，会按会话时间记录模拟兴趣，而不是均分点。');
})();
