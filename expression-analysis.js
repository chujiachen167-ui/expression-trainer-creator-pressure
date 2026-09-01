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
  const englishFillerWords = [
    'uh', 'um', 'erm', 'hmm', 'like', 'you know', 'i mean', 'basically', 'actually', 'literally', 'well', 'so', 'and then'
  ];
  const englishHedgeWords = [
    'i think', 'i feel', 'i guess', 'maybe', 'perhaps', 'probably', 'possibly', 'it seems', 'it looks like',
    'kind of', 'sort of', 'somewhat', 'i am not sure', "i'm not sure", 'i do not know', "i don't know"
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
  const englishVagueToPrecise = {
    'things': ['name the object', 'name the behavior', 'name the result'],
    'stuff': ['name the material', 'name the task', 'name the evidence'],
    'something': ['state exactly what it is'],
    'somehow': ['explain the mechanism or next step'],
    'a lot': ['give a number, range, or comparison'],
    'many': ['give a number, group, or proportion'],
    'good': ['name the useful quality or outcome'],
    'bad': ['name the failure, cost, or consequence'],
    'nice': ['name the specific benefit'],
    'interesting': ['state what is surprising or valuable']
  };
  const vagueWords = [...Object.keys(vagueToPrecise), ...Object.keys(englishVagueToPrecise)];
  const priority = { filler: 0, hedge: 1, vague: 2, repeat: 3 };
  const taggedTerms = [
    ...fillerWords.map(word => ({ word, type: 'filler' })),
    ...hedgeWords.map(word => ({ word, type: 'hedge' })),
    ...englishFillerWords.map(word => ({ word, type: 'filler' })),
    ...englishHedgeWords.map(word => ({ word, type: 'hedge' })),
    ...vagueWords.map(word => ({ word, type: 'vague' }))
  ].sort((a, b) => b.word.length - a.word.length || priority[a.type] - priority[b.type]);

  const cleanText = text => String(text || '').replace(/[\s，。！？、；：,.!?;:“”‘’（）()《》【】\[\]—…-]/g, '');
  const escapeHtml = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const latinCharacter = /[A-Za-z0-9']/;
  const isLatinTerm = word => /[A-Za-z]/.test(word);
  function termMatchesAt(text, index, word) {
    const candidate = text.slice(index, index + word.length);
    if (candidate.toLocaleLowerCase('en-US') !== word.toLocaleLowerCase('en-US')) return false;
    if (!isLatinTerm(word)) return true;
    const before = text[index - 1] || '';
    const after = text[index + word.length] || '';
    return !latinCharacter.test(before) && !latinCharacter.test(after);
  }
  function countExpressionUnits(text) {
    const input = String(text || '');
    const han = input.match(/[\u3400-\u9fff]/g)?.length || 0;
    const latinWords = input.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.length || 0;
    const numbers = input.match(/\b\d+(?:\.\d+)?\b/g)?.length || 0;
    return han + latinWords + numbers;
  }
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
      const match = terms.find(term => termMatchesAt(text, index, term.word));
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
    const latinWords = String(text || '').toLocaleLowerCase('en-US').match(/[a-z]+(?:'[a-z]+)?/g) || [];
    const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'if', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'then', 'this', 'to', 'was', 'we', 'with', 'you']);
    for (let index = 1; index < latinWords.length; index += 1) {
      if (latinWords[index] === latinWords[index - 1] && !stopWords.has(latinWords[index])) hits.push(latinWords[index]);
    }
    const selected = [];
    for (let size = 6; size >= 2; size -= 1) {
      const counts = new Map();
      for (let index = 0; index <= latinWords.length - size; index += 1) {
        const words = latinWords.slice(index, index + size);
        if (!words.some(word => !stopWords.has(word))) continue;
        const phrase = words.join(' ');
        counts.set(phrase, (counts.get(phrase) || 0) + 1);
      }
      counts.forEach((count, phrase) => {
        if (count < 2 || phrase.length < 8) return;
        if (selected.some(existing => existing.includes(phrase) || phrase.includes(existing))) return;
        selected.push(phrase);
      });
    }
    hits.push(...selected);
    return [...new Set(hits)];
  }

  function analyze(text, options = {}) {
    const input = String(text || '');
    const hits = scanTerms(input, options);
    const fillers = hits.filler;
    const hedges = hits.hedge;
    const vague = hits.vague;
    const repeats = repeatedPhrases(input);
    const penalty = fillers.length * 1.25 + hedges.length * 1.25 + vague.length * 0.75 + repeats.length * 1.5;
    const totalChars = countExpressionUnits(input);
    const density = totalChars ? Math.max(0, Math.round((1 - penalty / totalChars) * 100)) : 0;
    return { text: input, totalChars, fillers, hedges, vague, repeats, density };
  }

  function highlight(text, options = {}) {
    const input = String(text || '');
    const terms = [
      ...getTaggedTerms(options),
      ...repeatedPhrases(input).map(word => ({ word, type: 'repeat' }))
    ].sort((a, b) => b.word.length - a.word.length || priority[a.type] - priority[b.type]);
    let html = '';
    let index = 0;
    while (index < input.length) {
      const match = terms.find(term => termMatchesAt(input, index, term.word));
      if (match) {
        html += `<mark class="stt-token ${match.type}">${escapeHtml(input.slice(index, index + match.word.length))}</mark>`;
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
    const english = (result.text.match(/[A-Za-z]/g)?.length || 0) > (result.text.match(/[\u3400-\u9fff]/g)?.length || 0);
    [...new Set(result.vague)].slice(0, 3).forEach(word => {
      const replacements = vagueToPrecise[word] || englishVagueToPrecise[word.toLocaleLowerCase('en-US')] || [];
      output.push({
        type: 'vague', key: `vague-${word}`,
        title: english ? 'Make it specific' : '精准替换',
        text: english ? `“${word}” is vague. ${replacements.join(' / ')}` : `「${word}」→ ${replacements.join(' / ')}`
      });
    });
    if (result.fillers.length >= 2) output.push({ type: 'filler', key: 'fillers', title: english ? 'Filler words' : '填充词', text: english ? `${result.fillers.length} fillers: ${[...new Set(result.fillers)].join(', ')}. Replace them with a short pause.` : `${result.fillers.length} 次：${[...new Set(result.fillers)].join('、')}。用停顿代替。` });
    if (result.hedges.length) output.push({ type: 'hedge', key: 'hedges', title: english ? 'Hedging' : '犹豫表达', text: english ? `${result.hedges.length} hedges: ${[...new Set(result.hedges)].join(', ')}. State the judgment directly.` : `${result.hedges.length} 次：${[...new Set(result.hedges)].join('、')}。删掉弱化前缀，直接陈述判断。` });
    if (result.repeats.length) output.push({ type: 'repeat', key: 'repeats', title: english ? 'Repeated expression' : '重复表达', text: english ? `Repeated: “${result.repeats.slice(0, 2).join('”, “')}”. Keep it once, then add evidence.` : `检测到「${result.repeats.slice(0, 2).join('」「')}」。保留一次，再补充证据。` });
    return output;
  }

  window.CreatorExpressionAnalysis = { fillerWords, hedgeWords, englishFillerWords, englishHedgeWords, vagueToPrecise, englishVagueToPrecise, analyze, highlight, lines, suggestions };
})();
