(() => {
  const root = document.querySelector('[data-interest-curve]');
  if (!root) return;

  const maxPoints = 18;
  let points = [];
  let lastText = '';
  let running = false;
  let lastUpdate = 0;

  root.innerHTML = `
    <header class="interest-head">
      <div><span>观众兴趣度</span><small>原型估算</small></div>
      <strong data-interest-value>--</strong>
    </header>
    <p class="interest-summary" data-interest-summary id="interestSummary">开始说话后，根据开场、具体度、重复和口癖生成趋势。</p>
    <svg class="interest-chart" viewBox="0 0 320 96" role="img" aria-labelledby="interestChartTitle interestSummary" preserveAspectRatio="none">
      <title id="interestChartTitle">本轮观众兴趣度趋势</title>
      <path class="interest-baseline" d="M0 48 H320"></path>
      <polyline data-interest-line points="" vector-effect="non-scaling-stroke"></polyline>
      <circle data-interest-point cx="0" cy="48" r="3" hidden></circle>
    </svg>
    <div class="interest-scale" aria-hidden="true"><span>继续看</span><span>可能划走</span></div>
    <details class="interest-details"><summary>查看估算记录与边界</summary><p>这不是眼动、真实用户或大模型结论，只是前端依据逐字稿信号计算的训练提示。</p><table><caption>最近的兴趣度估算</caption><thead><tr><th scope="col">片段</th><th scope="col">估算</th><th scope="col">主要信号</th></tr></thead><tbody data-interest-table></tbody></table></details>`;

  const valueNode = root.querySelector('[data-interest-value]');
  const summaryNode = root.querySelector('[data-interest-summary]');
  const line = root.querySelector('[data-interest-line]');
  const point = root.querySelector('[data-interest-point]');
  const table = root.querySelector('[data-interest-table]');

  function count(text, words) {
    return words.reduce((sum, word) => sum + (text.split(word).length - 1), 0);
  }

  function estimate(text) {
    const compact = text.replace(/\s+/g, '').slice(-180);
    const opening = compact.slice(0, 42);
    const fillers = count(compact, ['嗯', '啊', '然后', '就是', '那个', '其实', '怎么说呢', '对吧']);
    const vague = count(compact, ['很多', '比较', '可能', '感觉', '东西', '方面', '有点']);
    const repeats = [...compact.matchAll(/(.{2,5})\1+/g)].length;
    const concrete = (compact.match(/\d+|第一|第二|三个|例如|比如|适合|不适合|因为|结果/g) || []).length;
    const hasQuestion = /[？?]/.test(opening);
    const directOpening = /^(你|如果|为什么|今天|先说|结论|一个|别|不要|我用|这条)/.test(opening);
    let score = 52 + Math.min(18, concrete * 3) + (hasQuestion ? 5 : 0) + (directOpening ? 7 : 0);
    score -= Math.min(24, fillers * 4 + vague * 3 + repeats * 5);
    if (compact.length > 70 && !/[。！？?]/.test(compact.slice(-65))) score -= 7;
    score = Math.max(12, Math.min(92, Math.round(score)));
    const signals = [];
    if (directOpening) signals.push('开场直接');
    if (concrete) signals.push('有具体信息');
    if (fillers) signals.push(`口癖 ${fillers}`);
    if (vague) signals.push(`模糊 ${vague}`);
    if (repeats) signals.push(`重复 ${repeats}`);
    if (!signals.length) signals.push('等待更多有效信息');
    return { score, signal: signals.join(' · '), excerpt: compact.slice(-24) || '尚无逐字稿' };
  }

  function render() {
    if (!points.length) {
      valueNode.textContent = '--';
      line.setAttribute('points', '');
      point.hidden = true;
      table.innerHTML = '<tr><td colspan="3">尚无训练数据</td></tr>';
      return;
    }
    const width = 320;
    const height = 96;
    const coords = points.map((item, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
      const y = height - (item.score / 100) * height;
      return { x, y };
    });
    line.setAttribute('points', coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
    const latest = points[points.length - 1];
    const latestCoord = coords[coords.length - 1];
    point.hidden = false;
    point.setAttribute('cx', latestCoord.x.toFixed(1));
    point.setAttribute('cy', latestCoord.y.toFixed(1));
    valueNode.textContent = String(latest.score);
    summaryNode.textContent = `${latest.score >= 68 ? '继续看的信号较强' : latest.score >= 46 ? '兴趣仍在摇摆' : '出现划走风险'}：${latest.signal}。`;
    table.innerHTML = points.slice(-6).reverse().map((item, index) => `<tr><td>${points.length - index}</td><td>${item.score}</td><td>${item.signal}</td></tr>`).join('');
  }

  function update(text, final = false) {
    if (!running || !text.trim() || text === lastText) return;
    const now = Date.now();
    if (!final && now - lastUpdate < 850) return;
    lastUpdate = now;
    lastText = text;
    points.push(estimate(text));
    points = points.slice(-maxPoints);
    render();
  }

  document.addEventListener('creator:session-state', event => {
    running = Boolean(event.detail?.running);
    if (running) {
      points = [];
      lastText = '';
      summaryNode.textContent = '正在等待第一句有效内容…';
      render();
    }
  });
  document.addEventListener('creator:transcript-change', event => update(event.detail?.text || '', Boolean(event.detail?.final)));
  render();
})();
