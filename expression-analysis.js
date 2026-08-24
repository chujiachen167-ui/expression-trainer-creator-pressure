/*
 * Browser-side expression diagnostics adapted from the original project:
 * https://github.com/fxy2311-youyou/expression-trainer
 */
(() => {
  const fillerWords = [
    '嗯', '啊', '呃', '额', '那个', '就是', '然后', '这个', '对吧', '是吧', '你知道', '怎么说呢',
    '反正', '基本上', '总之', '所以说', '就是说', '其实吧', '说实话', '对对对', '是是是', 'emmm', '啧', '哎', '唔'
  ];
  const hedgeWords = [
    '可能', '也许', '大概', '应该', '我觉得', '好像', '似乎', '或许', '不一定', '差不多', '算是',
    '某种程度上', '一般来说', '感觉', '可能吧', '我不确定', '大概率', '不排除', '也有可能'
  ];
  const vagueToPrecise = {
    '开心': ['欣喜', '雀跃', '兴奋'], '难过': ['心酸', '失落', '委屈'], '害怕': ['恐惧', '焦虑', '不安'],
    '生气': ['愤怒', '恼火', '气愤'], '不舒服': ['压抑', '烦躁', '疲惫'], '很好': ['出色', '精彩', '理想'],
    '很多': ['大量', '丰富', '可观'], '很快': ['迅速', '立刻', '即刻'], '很大': ['巨大', '显著', '可观'],
    '很小': ['微小', '细微', '轻微'], '好看': ['精致', '优雅', '惊艳'], '不好': ['糟糕', '拙劣', '不堪'],
    '喜欢': ['热爱', '着迷', '钟爱'], '讨厌': ['厌恶', '反感', '排斥'], '觉得': ['认为', '判断', '意识到'],
    '想': ['期待', '打算', '计划'], '做': ['执行', '落实', '完成'], '看': ['审视', '观察', '注视'],
    '说': ['表达', '阐述', '指出'], '想想': ['反思', '回顾', '复盘'], '重要': ['关键', '核心', '决定性'],
    '有意思': ['引人入胜', '耐人寻味', '发人深省'], '东西': ['成果', '素材', '对象'],
    '问题': ['症结', '隐患', '瓶颈'], '方面': ['维度', '层面', '环节']
  };
  const vagueWords = Object.keys(vagueToPrecise);
  const priority = { filler: 0, hedge: 1, vague: 2 };
  const taggedTerms = [
    ...fillerWords.map(word => ({ word, type: 'filler' })),
    ...hedgeWords.map(word => ({ word, type: 'hedge' })),
    ...vagueWords.map(word => ({ word, type: 'vague' }))
  ].sort((a, b) => b.word.length - a.word.length || priority[a.type] - priority[b.type]);

  const cleanText = text => String(text || '').replace(/[\s，。！？、；：,.!?;:“”‘’（）()《》【】\[\]—…-]/g, '');
  const escapeHtml = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  function customFillerTerms(options = {}) {
    return String(options.customWords || '')
      .split(/[，,、\s]+/)
      .map(word => word.trim())
      .filter(word => word.length >= 1)
      .map(word => ({ word, type: 'filler' }));
  }

  function getTaggedTerms(options = {}) {
    const known = new Set(taggedTerms.map(term => term.word));
    return [...taggedTerms, ...customFillerTerms(options).filter(term => !known.has(term.word))]
      .sort((a, b) => b.word.length - a.word.length || priority[a.type] - priority[b.type]);
  }

  function scanTerms(text, options = {}) {
    const hits = { filler: [], hedge: [], vague: [] };
    const terms = getTaggedTerms(options);
    let index = 0;
    while (index < text.length) {
      const match = terms.find(term => text.startsWith(term.word, index));
      if (match) { hits[match.type].push(match.word); index += match.word.length; }
      else index += 1;
    }
    return hits;
  }

  function repeatedPhrases(text) {
    const compact = cleanText(text);
    const hits = [];
    const adjacent = /(.{2,8}?)\1+/g;
    let match;
    while ((match = adjacent.exec(compact))) hits.push(match[1]);
    const phrases = String(text || '').split(/[，。！？、；：,.!?;:\s]+/).map(item => item.trim()).filter(item => item.length >= 3 && item.length <= 14);
    const seen = new Map();
    phrases.forEach(phrase => seen.set(phrase, (seen.get(phrase) || 0) + 1));
    seen.forEach((count, phrase) => { if (count > 1) hits.push(phrase); });
    return [...new Set(hits)];
  }

  function analyze(text, options = {}) {
    const compact = cleanText(text);
    const hits = scanTerms(compact, options);
    const fillers = hits.filler;
    const hedges = hits.hedge;
    const vague = hits.vague;
    const repeats = repeatedPhrases(text);
    const penalty = fillers.length * 1.25 + hedges.length * 1.25 + vague.length * 0.75 + repeats.length * 1.5;
    const density = compact.length ? Math.max(0, Math.round((1 - penalty / compact.length) * 100)) : 0;
    return { text: String(text || ''), totalChars: compact.length, fillers, hedges, vague, repeats, density };
  }

  function highlight(text, options = {}) {
    const input = String(text || '');
    const terms = getTaggedTerms(options);
    let html = '';
    let index = 0;
    while (index < input.length) {
      const match = terms.find(term => input.startsWith(term.word, index));
      if (match) {
        html += `<mark class="stt-token ${match.type}">${escapeHtml(match.word)}</mark>`;
        index += match.word.length;
      } else {
        html += escapeHtml(input[index]);
        index += 1;
      }
    }
    return html;
  }

  function lines(text) {
    return String(text || '').match(/[^。！？!?]+[。！？!?]?/g)?.map(line => line.trim()).filter(Boolean) || [];
  }

  function suggestions(result) {
    const output = [];
    [...new Set(result.vague)].slice(0, 3).forEach(word => output.push({ type: 'vague', key: `vague-${word}`, title: '精准替换', text: `「${word}」→ ${vagueToPrecise[word].join(' / ')}` }));
    if (result.fillers.length >= 2) output.push({ type: 'filler', key: 'fillers', title: '填充词', text: `${result.fillers.length} 次：${[...new Set(result.fillers)].join('、')}。用停顿代替。` });
    if (result.hedges.length) output.push({ type: 'hedge', key: 'hedges', title: '犹豫表达', text: `${result.hedges.length} 次：${[...new Set(result.hedges)].join('、')}。删掉弱化前缀，直接陈述判断。` });
    if (result.repeats.length) output.push({ type: 'repeat', key: 'repeats', title: '重复表达', text: `检测到「${result.repeats.slice(0, 2).join('」「')}」。保留一次，再补充证据。` });
    return output;
  }

  window.CreatorExpressionAnalysis = { fillerWords, hedgeWords, vagueToPrecise, analyze, highlight, lines, suggestions };
})();
