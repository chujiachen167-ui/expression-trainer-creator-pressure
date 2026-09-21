/**
 * Replaceable V2 judge. This file is the rules implementation, not a semantic model.
 */
(function attachV2RuleJudge(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CreatorV2RuleJudge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const VERSION = 'rules-v1.2.0';
  const KIND = 'rules';
  const latinCharacter = /[A-Za-z0-9']/;

  const audiencePriorities = {
    fastScroller: ['opening', 'density', 'relevance'],
    beginner: ['jargon', 'example', 'structure'],
    skeptic: ['evidence', 'specificity', 'tradeoff']
  };

  const zh = {
    vague: ['很多', '比较', '可能', '感觉', '东西', '方面', '有点', '某种'],
    jargon: ['赋能', '闭环', '抓手', '底层逻辑', '赛道', '方法论', '颗粒度'],
    fillersCluster: ['那个', '就是', '然后', '怎么说呢'],
    isolatedNotPenalty: ['其实', '我觉得', '嗯', '啊', '吧', '呢', '对吧'],
    narrative: ['有一次', '那天', '先讲', '故事', '想象', '假如你', '我先说一个'],
    value: ['结论', '核心', '关键', '直接说', '值得', '不值得', '先说'],
    example: ['比如', '例如', '我曾经', '具体来说', '有一次'],
    evidenceCue: ['测试', '对比', '研究', '数据', '实验'],
    notEvidence: ['因为', '所以'],
    tradeoff: ['但是', '代价', '风险', '不适合', '限制', '前提', '边界'],
    claim: ['一定', '所有人', '绝对', '保证', '最好', '必须'],
    relevance: ['适合', '你', '观众', '用户', '人群', '新手', '宝妈', '打工人'],
    hook: ['停一下', '先别划', '你有没有', '你知道吗', '为什么', '千万别', '真相是', '揭秘', '避雷', '踩坑', '亲测', '很多人不知道', '测完才发现'],
    search: ['教程', '测评', '避雷', '平价', '真实', '亲测', '分享', '清单', '对比', '好物'],
    grammarRepeat: ['对对对', '是是是', '对对', '就是就是']
  };

  const en = {
    vague: ['a lot', 'lots of', 'things', 'stuff', 'something', 'kind of', 'sort of', 'maybe', 'very', 'really'],
    jargon: ['synergy', 'leverage', 'paradigm', 'ecosystem', 'north star', 'bandwidth', 'unlock value'],
    fillersCluster: ['you know', 'i mean', 'kind of', 'sort of'],
    isolatedNotPenalty: ['actually', 'basically', 'well', 'so', 'it', 'if', 'like'],
    narrative: ['once', 'one day', 'imagine', 'picture this', 'let me tell', 'story'],
    value: ['the point', 'in short', 'worth', 'not worth', 'upshot', 'bottom line'],
    example: ['for example', 'for instance', 'one time', 'i tried', 'specifically'],
    evidenceCue: ['test', 'tested', 'study', 'studies', 'data', 'compared', 'measurement'],
    notEvidence: ['because', 'so'],
    tradeoff: ['but', 'tradeoff', 'trade-off', 'risk', 'not for', 'limit', 'unless'],
    claim: ['always', 'never', 'everyone', 'guarantee', 'must', 'best'],
    relevance: ['you', 'your', 'if you', 'people who', 'audience', 'beginner', 'if you\'re'],
    hook: ['stop scrolling', 'wait', 'did you know', 'nobody tells you', 'the truth is', "here's the thing", 'why you', 'most people', 'this is why', 'wait for it'],
    search: ['tutorial', 'review', 'vs', 'compared', 'honest', 'tried', 'checklist', 'beginner'],
    grammarRepeat: []
  };

  const PLATFORM_PROFILES = [
    { key: 'douyin', labels: ['抖音', 'tiktok', 'douyin'], family: 'short', openingWindowMs: 3000, cooldownMs: 5000 },
    { key: 'kuaishou', labels: ['快手', 'kuaishou'], family: 'short', openingWindowMs: 3000, cooldownMs: 5000 },
    { key: 'instagram', labels: ['instagram', 'reels', 'ins'], family: 'short', openingWindowMs: 3000, cooldownMs: 5000 },
    { key: 'xiaohongshu', labels: ['小红书', 'rednote', 'xiaohongshu'], family: 'search', openingWindowMs: 5000, cooldownMs: 7000 },
    { key: 'weixin', labels: ['视频号', 'weixin', 'wechat'], family: 'short', openingWindowMs: 4000, cooldownMs: 6000 },
    { key: 'bilibili', labels: ['b站', 'bilibili', '哔哩'], family: 'long', openingWindowMs: 12000, cooldownMs: 10000 },
    { key: 'youtube', labels: ['youtube', 'yt'], family: 'long', openingWindowMs: 15000, cooldownMs: 10000 }
  ];
  const GENERIC_PLATFORM = { key: 'generic', labels: [], family: 'generic', openingWindowMs: 8000, cooldownMs: 12000 };

  function resolvePlatforms(label) {
    const raw = String(label || '');
    if (!raw.trim()) return [GENERIC_PLATFORM];
    const lower = raw.toLowerCase();
    const hits = PLATFORM_PROFILES.filter(profile => profile.labels.some(item => lower.includes(item.toLowerCase())));
    return hits.length ? hits : [GENERIC_PLATFORM];
  }

  function primaryPlatform(label) {
    const all = resolvePlatforms(label);
    return all.find(item => item.family === 'short') || all.find(item => item.family === 'search') || all[0];
  }

  function isLatinTerm(word) {
    return /[A-Za-z]/.test(word);
  }

  function termMatchesAt(text, index, word) {
    const candidate = text.slice(index, index + word.length);
    if (candidate.toLocaleLowerCase('en-US') !== word.toLocaleLowerCase('en-US')) return false;
    if (!isLatinTerm(word)) return true;
    const before = text[index - 1] || '';
    const after = text[index + word.length] || '';
    return !latinCharacter.test(before) && !latinCharacter.test(after);
  }

  function findMatches(text, terms) {
    const input = String(text || '');
    const hits = [];
    terms.forEach(term => {
      const needle = String(term);
      if (!needle) return;
      if (isLatinTerm(needle)) {
        const lower = input;
        for (let i = 0; i <= lower.length - needle.length; i += 1) {
          if (termMatchesAt(lower, i, needle)) {
            hits.push({ term: needle, index: i, excerpt: input.slice(Math.max(0, i - 8), i + needle.length + 12) });
            i += needle.length - 1;
          }
        }
      } else {
        let from = 0;
        while (from < input.length) {
          const index = input.indexOf(needle, from);
          if (index < 0) break;
          hits.push({ term: needle, index, excerpt: input.slice(Math.max(0, index - 4), index + needle.length + 8) });
          from = index + needle.length;
        }
      }
    });
    return hits;
  }

  function countExpressionUnits(text) {
    const input = String(text || '');
    const han = input.match(/[\u3400-\u9fff]/g)?.length || 0;
    const latinWords = input.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.length || 0;
    const numbers = input.match(/\b\d+(?:\.\d+)?\b/g)?.length || 0;
    return han + latinWords + numbers;
  }

  function looksLikeClaim(text) {
    return findMatches(text, zh.claim).length > 0 || findMatches(text, en.claim).length > 0;
  }

  function hasNarrativeOpening(text) {
    return findMatches(text, zh.narrative).length > 0 || findMatches(text, en.narrative).length > 0;
  }

  function hasValueOpening(text) {
    return findMatches(text, zh.value).length > 0
      || findMatches(text, en.value).length > 0
      || findMatches(text, zh.hook).length > 0
      || findMatches(text, en.hook).length > 0
      || /[?？]/.test(String(text || ''));
  }

  function copyFor(locale) {
    const enUS = locale === 'en-US';
    return {
      insufficient: enUS
        ? 'Not enough information / no clear change yet.'
        : '信息不足 / 暂无明确变化。',
      insufficientOpening: enUS
        ? 'Opening cannot be timed precisely from this input, so this is only the opening passage—not a first-three-seconds verdict.'
        : '当前输入没有可靠开场时间，只能标为开场片段，不能给出“前三秒”结论。',
      pasteTime: enUS
        ? 'Pasted text has no real speech time, so no exact-second judgment is produced.'
        : '粘贴全文没有真实发言时间，因此不生成精确到秒的判断。',
      noScore: enUS
        ? 'No simulated score without accepted speech.'
        : '没有被接受的发言，不生成模拟分数。',
      openingMissing: enUS
        ? 'A fast scroller still has no reason to stay. State the value in the opening passage—without treating a story hook as a failure.'
        : '快速浏览者还没听到继续看的理由。请在开场片段说出价值；叙事开头本身不算失败。',
      openingOk: enUS
        ? 'The opening passage already states a usable point. Keep going with one concrete detail.'
        : '开场片段已经给出可继续看的点。下一句补一个具体细节即可。',
      densityOk: enUS
        ? 'This passage adds a concrete new detail instead of repeating the setup.'
        : '这段补充了具体的新信息，没有继续重复铺垫。',
      relevanceOk: enUS
        ? 'The speaker now names who this is for or when it matters.'
        : '这段已经点明适用对象或使用情境，观众知道内容与谁有关。',
      narrativeOk: enUS
        ? 'A narrative opening is allowed. After the hook, land one concrete stake so a fast scroller still has a reason to stay.'
        : '允许叙事或悬念开头。钩子之后请落下一个具体利害，快速浏览者才有停留理由。',
      vague: (term) => enUS
        ? `"${term}" is too broad here. Replace it with a number, a condition, or a checkable result.`
        : `“${term}”在这里太宽。请换成数量、条件或可核对的结果。`,
      jargon: (term) => enUS
        ? `"${term}" is still abstract for a beginner. Swap it for an action or result a new viewer can picture.`
        : `“${term}”对零基础观众仍然抽象。请换成普通人看得见的动作或结果。`,
      example: enUS
        ? 'The claim is still general. Add one example you can retell, not just the word “for example”.'
        : '主张还停留在概括。请补一个能复述的例子，而不是只出现“比如”。',
      exampleOk: enUS
        ? 'A concrete example makes the idea easier for a beginner to follow.'
        : '这段补上了具体例子，零基础观众更容易跟上。',
      evidence: enUS
        ? 'A strong claim is missing a checkable basis. “Because” or a number alone does not prove the content.'
        : '这里有较强主张，但缺少可核对依据。“因为”或数字本身不能证明内容质量。',
      evidenceOk: enUS
        ? 'The speaker now supplies a checkable test, comparison, study, or data point.'
        : '这段补上了可核对的测试、对比、研究或数据依据。',
      tradeoff: enUS
        ? 'A skeptic still only heard the upside. Who is it not for, and what is the cost or limit?'
        : '怀疑型观众目前只听到好处。它不适合谁，代价或限制是什么？',
      tradeoffOk: enUS
        ? 'The speaker now states a cost, limitation, prerequisite, or who this is not for.'
        : '这段主动说明了代价、限制、前提或不适用对象。',
      specificityOk: enUS
        ? 'The broad claim is now anchored to a number or a checkable result.'
        : '这段已经把宽泛主张落到数字或可核对结果上。',
      density: enUS
        ? 'The latest passage repeats setup more than it adds information. Cut the runway and add one new fact.'
        : '这段主要在重复铺垫，新信息很少。请删掉跑道，补一条新事实。',
      relevance: enUS
        ? 'A fast scroller cannot tell who this is for. Name the situation or person in one clause.'
        : '快速浏览者还听不出这和谁有关。请用一句话点明适用情境或对象。',
      filler: enUS
        ? 'Clustered fillers are crowding this passage. Pause instead of stacking them—isolated particles are not marked unprofessional.'
        : '这里口癖成串，挤占了信息。用停顿代替堆叠；孤立语气词不会被判不专业。',
      lowConf: enUS
        ? 'Low-confidence keyword hint. Recheck the original sentence before changing your delivery.'
        : '这是低把握的关键词提示，请对照原句复核，不作为强扣分。',
      relative: enUS
        ? 'Relative simulated interest aligned to public creator-education heuristics for the selected platforms. Not YouTube/TikTok/Douyin backend retention or recommendation score.'
        : '这是按所选平台公开创作者教育对齐的相对模拟兴趣，不是抖音/快手/小红书/YouTube/B站后台完播率或推荐分。',
      judgeLabel: enUS
        ? 'Rule judge (copy-level heuristics, not a semantic model or platform API)'
        : '规则判断器（文案层启发式，不是语义模型，也不是平台接口）',
      hookOk: enUS
        ? 'The opening uses a public short-video hook pattern (question, curiosity gap, or stop-scroll cue). This trains the first-seconds stay, not a predicted view count.'
        : '开场用了公开短视频钩子写法（提问、好奇缺口或停划提示）。这是在练前几秒停留，不是预测播放量。',
      searchOk: enUS
        ? 'This passage names a searchable, concrete topic a discovery-feed viewer can match. It is not a ranking guarantee.'
        : '这段点出了发现页观众可以对上的具体检索主题。这不是排名保证。'
    };
  }

  function lastSameType(previousEvents, type) {
    for (let i = (previousEvents || []).length - 1; i >= 0; i -= 1) {
      if (previousEvents[i].type === type) return previousEvents[i];
    }
    return null;
  }

  function inCooldown(previousEvents, type, segment, cooldownMs) {
    const previous = lastSameType(previousEvents, type);
    if (!previous) return false;
    const prevT = previous.endMs ?? previous.startMs;
    const nextT = segment.endMs ?? segment.startMs;
    if (prevT == null || nextT == null) return previous.segmentId !== segment.segmentId;
    return nextT - prevT < cooldownMs;
  }

  function detect(segment, round) {
    const text = String(segment.text || '');
    const units = countExpressionUnits(text);
    const vagueHits = [...findMatches(text, zh.vague), ...findMatches(text, en.vague)];
    const jargonHits = [...findMatches(text, zh.jargon), ...findMatches(text, en.jargon)];
    const exampleHits = [...findMatches(text, zh.example), ...findMatches(text, en.example)];
    const evidenceHits = [...findMatches(text, zh.evidenceCue), ...findMatches(text, en.evidenceCue)];
    const tradeoffHits = [...findMatches(text, zh.tradeoff), ...findMatches(text, en.tradeoff)];
    const fillerHits = [...findMatches(text, zh.fillersCluster), ...findMatches(text, en.fillersCluster)];
    const isolatedHits = [...findMatches(text, zh.isolatedNotPenalty), ...findMatches(text, en.isolatedNotPenalty)];
    const grammarHits = findMatches(text, zh.grammarRepeat);
    const becauseHits = [...findMatches(text, zh.notEvidence), ...findMatches(text, en.notEvidence)];
    const hasDigit = /\d/.test(text);
    const finals = (round.segments || []).filter(item => item.status === 'final');
    const isOpening = finals.length <= 1;
    const previousFinals = finals.filter(item => item.segmentId !== segment.segmentId);
    const repeatedSetup = previousFinals.some(item => {
      const a = String(item.text || '').replace(/\s+/g, '').slice(0, 12);
      const b = text.replace(/\s+/g, '').slice(0, 12);
      return a.length >= 8 && a === b;
    });
    return {
      text,
      units,
      vagueHits,
      jargonHits,
      exampleHits,
      evidenceHits,
      tradeoffHits,
      fillerHits,
      isolatedHits,
      grammarHits,
      becauseHits,
      hasDigit,
      isOpening,
      hasNarrative: hasNarrativeOpening(text),
      hasValue: hasValueOpening(text),
      claim: looksLikeClaim(text),
      repeatedSetup,
      relevanceHits: [...findMatches(text, zh.relevance), ...findMatches(text, en.relevance)],
      hookHits: [...findMatches(text, zh.hook), ...findMatches(text, en.hook)],
      searchHits: [...findMatches(text, zh.search), ...findMatches(text, en.search)]
    };
  }

  function evidenceFrom(hit, reason) {
    if (!hit) return { excerpt: '', match: '', reason };
    return { excerpt: hit.excerpt || hit.term, match: hit.term, reason };
  }

  function makeEvent(type, fields) {
    return { type, ...fields };
  }

  function judge({ round, segment, previousEvents = [], locale = 'zh-CN' } = {}) {
    const copy = copyFor(locale);
    const frozen = round?.frozen || {};
    const judgeConfig = frozen.judge || {};
    const platform = primaryPlatform(frozen.platform);
    const configuredCooldown = Number(judgeConfig.cooldownMs);
    const configuredOpening = Number(judgeConfig.openingWindowMs);
    const cooldownMs = platform.family === 'generic'
      ? (Number.isFinite(configuredCooldown) ? configuredCooldown : 12000)
      : (platform.family === 'long'
        ? Math.max(Number.isFinite(configuredCooldown) ? configuredCooldown : 12000, platform.cooldownMs)
        : Math.min(Number.isFinite(configuredCooldown) ? configuredCooldown : 12000, platform.cooldownMs));
    const openingWindowMs = platform.family === 'generic'
      ? (Number.isFinite(configuredOpening) ? configuredOpening : 8000)
      : (platform.family === 'long'
        ? Math.max(Number.isFinite(configuredOpening) ? configuredOpening : 8000, platform.openingWindowMs)
        : Math.min(Number.isFinite(configuredOpening) ? configuredOpening : 8000, platform.openingWindowMs));
    const audienceId = frozen.audienceId || 'fastScroller';
    const audienceName = frozen.audienceName || audienceId;
    const priorities = audiencePriorities[audienceId] || audiencePriorities.fastScroller;
    const text = String(segment?.text || '').trim();

    if (!round || !segment || segment.status !== 'final') {
      return { events: [], hasScore: false, score: null };
    }
    if (!text) {
      return { events: [], hasScore: false, score: null, note: copy.noScore };
    }

    const signals = detect(segment, round);
    const candidates = [];

    if (signals.isOpening) {
      const precision = segment.timePrecision || 'unknown';
      if (precision === 'none' || segment.source === 'paste') {
        candidates.push(makeEvent('opening-insufficient', {
          confidence: 'insufficient',
          scoreDelta: 0,
          explanation: copy.pasteTime,
          suggestion: copy.insufficientOpening,
          evidence: { excerpt: text.slice(0, 48), match: '', reason: 'no-real-time' },
          timePrecision: 'none'
        }));
      } else if (audienceId === 'fastScroller' && !signals.hasValue && !signals.hasNarrative && signals.units >= 8) {
        candidates.push(makeEvent('opening', {
          confidence: precision === 'segment' || precision === 'word' ? 'high' : 'low',
          scoreDelta: precision === 'estimated' ? (judgeConfig.lowConfidenceDelta || -2) : (judgeConfig.highConfidenceDelta || -8),
          explanation: copy.openingMissing,
          suggestion: copy.openingMissing,
          evidence: { excerpt: text.slice(0, 48), match: '', reason: 'opening-without-stake' },
          timePrecision: precision === 'word' || precision === 'segment' ? precision : 'estimated'
        }));
      } else if (signals.hasNarrative && !signals.hasValue && audienceId === 'fastScroller') {
        candidates.push(makeEvent('opening', {
          confidence: 'low',
          scoreDelta: 0,
          explanation: copy.narrativeOk,
          suggestion: copy.narrativeOk,
          evidence: evidenceFrom((findMatches(text, zh.narrative)[0] || findMatches(text, en.narrative)[0]), 'narrative-opening-allowed'),
          timePrecision: precision === 'none' ? 'estimated' : precision
        }));
      } else if (signals.hasValue && audienceId === 'fastScroller') {
        const hookHit = signals.hookHits[0];
        const valueHit = findMatches(text, zh.value)[0] || findMatches(text, en.value)[0];
        candidates.push(makeEvent('opening', {
          confidence: 'high',
          scoreDelta: judgeConfig.supportDelta || 4,
          explanation: hookHit ? copy.hookOk : copy.openingOk,
          suggestion: hookHit ? copy.hookOk : copy.openingOk,
          evidence: evidenceFrom(hookHit || valueHit, hookHit ? 'opening-hook' : 'opening-has-value'),
          timePrecision: precision
        }));
      }
      if (precision !== 'word' && precision !== 'segment') {
        candidates.forEach(item => {
          if (item.type === 'opening' || item.type === 'opening-insufficient') {
            item.explanation = `${item.explanation} ${copy.insufficientOpening}`;
          }
        });
      } else if (segment.startMs != null && segment.startMs > openingWindowMs && audienceId === 'fastScroller') {
        /* Timed opening still binds to the first voiced segment, not wall-clock emptiness. */
      }
    }

    if (signals.vagueHits.length && (signals.claim || signals.units >= 10) && priorities.includes('specificity')) {
      const hit = signals.vagueHits[0];
      candidates.push(makeEvent('specificity', {
        confidence: signals.vagueHits.length > 1 ? 'high' : 'low',
        scoreDelta: signals.vagueHits.length > 1 ? (judgeConfig.highConfidenceDelta || -8) : (judgeConfig.lowConfidenceDelta || -2),
        explanation: copy.vague(hit.term),
        suggestion: copy.vague(hit.term),
        evidence: evidenceFrom(hit, 'vague-in-claim')
      }));
    }

    if (audienceId === 'skeptic' && !signals.vagueHits.length && (signals.hasDigit || signals.evidenceHits.length)) {
      candidates.push(makeEvent('specificity-support', {
        confidence: signals.evidenceHits.length ? 'high' : 'low',
        scoreDelta: judgeConfig.supportDelta || 4,
        explanation: copy.specificityOk,
        suggestion: copy.specificityOk,
        evidence: evidenceFrom(signals.evidenceHits[0] || { term: text.match(/\d+(?:\.\d+)?/)?.[0] || '', excerpt: text.slice(0, 48) }, 'specific-result')
      }));
    }

    if (signals.jargonHits.length && (audienceId === 'beginner' || priorities.includes('jargon'))) {
      const hit = signals.jargonHits[0];
      candidates.push(makeEvent('jargon', {
        confidence: 'high',
        scoreDelta: judgeConfig.highConfidenceDelta || -8,
        explanation: copy.jargon(hit.term),
        suggestion: copy.jargon(hit.term),
        evidence: evidenceFrom(hit, 'jargon-for-beginner')
      }));
    }

    if (audienceId === 'beginner' && signals.units >= 18 && !signals.exampleHits.length && (signals.claim || signals.jargonHits.length)) {
      candidates.push(makeEvent('example', {
        confidence: 'low',
        scoreDelta: judgeConfig.lowConfidenceDelta || -2,
        explanation: copy.example,
        suggestion: copy.example,
        evidence: { excerpt: text.slice(0, 48), match: '', reason: 'claim-without-example' }
      }));
    }

    if (audienceId === 'beginner' && signals.exampleHits.length) {
      candidates.push(makeEvent('example-support', {
        confidence: 'high',
        scoreDelta: judgeConfig.supportDelta || 4,
        explanation: copy.exampleOk,
        suggestion: copy.exampleOk,
        evidence: evidenceFrom(signals.exampleHits[0], 'concrete-example')
      }));
    }

    if (audienceId === 'skeptic' && signals.claim && !signals.evidenceHits.length) {
      candidates.push(makeEvent('evidence', {
        confidence: 'high',
        scoreDelta: judgeConfig.highConfidenceDelta || -8,
        explanation: copy.evidence,
        suggestion: copy.evidence,
        evidence: {
          excerpt: text.slice(0, 48),
          match: (findMatches(text, zh.claim)[0] || findMatches(text, en.claim)[0] || {}).term || '',
          reason: 'claim-without-checkable-basis'
        }
      }));
    }

    if (audienceId === 'skeptic' && signals.evidenceHits.length) {
      candidates.push(makeEvent('evidence-support', {
        confidence: 'high',
        scoreDelta: judgeConfig.supportDelta || 4,
        explanation: copy.evidenceOk,
        suggestion: copy.evidenceOk,
        evidence: evidenceFrom(signals.evidenceHits[0], 'checkable-basis-present')
      }));
    }

    if (audienceId === 'skeptic' && signals.units >= 16 && signals.claim && !signals.tradeoffHits.length && priorities.includes('tradeoff')) {
      candidates.push(makeEvent('tradeoff', {
        confidence: 'low',
        scoreDelta: judgeConfig.lowConfidenceDelta || -2,
        explanation: copy.tradeoff,
        suggestion: copy.tradeoff,
        evidence: { excerpt: text.slice(0, 48), match: '', reason: 'upside-without-limit' }
      }));
    }

    if (audienceId === 'skeptic' && signals.tradeoffHits.length) {
      candidates.push(makeEvent('tradeoff-support', {
        confidence: 'high',
        scoreDelta: judgeConfig.supportDelta || 4,
        explanation: copy.tradeoffOk,
        suggestion: copy.tradeoffOk,
        evidence: evidenceFrom(signals.tradeoffHits[0], 'tradeoff-present')
      }));
    }

    if (audienceId === 'fastScroller' && signals.units >= 8 && !signals.relevanceHits.length && (round.events || []).length >= 1) {
      candidates.push(makeEvent('relevance', {
        confidence: 'low',
        scoreDelta: judgeConfig.lowConfidenceDelta || -2,
        explanation: copy.relevance,
        suggestion: copy.relevance,
        evidence: { excerpt: text.slice(0, 48), match: '', reason: 'no-audience-address' }
      }));
    }

    if ((platform.key === 'xiaohongshu' || platform.family === 'search') && signals.searchHits.length && !signals.isOpening) {
      candidates.push(makeEvent('search-support', {
        confidence: 'high',
        scoreDelta: judgeConfig.supportDelta || 4,
        explanation: copy.searchOk,
        suggestion: copy.searchOk,
        evidence: evidenceFrom(signals.searchHits[0], 'searchable-topic')
      }));
    }

    if (audienceId === 'fastScroller' && !signals.isOpening && signals.relevanceHits.length) {
      candidates.push(makeEvent('relevance-support', {
        confidence: 'high',
        scoreDelta: judgeConfig.supportDelta || 4,
        explanation: copy.relevanceOk,
        suggestion: copy.relevanceOk,
        evidence: evidenceFrom(signals.relevanceHits[0], 'audience-relevance-present')
      }));
    }

    if (audienceId === 'fastScroller' && !signals.isOpening && !signals.repeatedSetup && (signals.hasDigit || signals.exampleHits.length || signals.evidenceHits.length)) {
      candidates.push(makeEvent('density-support', {
        confidence: 'high',
        scoreDelta: judgeConfig.supportDelta || 4,
        explanation: copy.densityOk,
        suggestion: copy.densityOk,
        evidence: evidenceFrom(signals.exampleHits[0] || signals.evidenceHits[0] || { term: text.match(/\d+(?:\.\d+)?/)?.[0] || '', excerpt: text.slice(0, 48) }, 'new-concrete-detail')
      }));
    }

    if (signals.repeatedSetup && !signals.grammarHits.length) {
      candidates.push(makeEvent('repeat-padding', {
        confidence: 'high',
        scoreDelta: judgeConfig.highConfidenceDelta || -8,
        explanation: copy.density,
        suggestion: copy.density,
        evidence: { excerpt: text.slice(0, 24), match: text.slice(0, 12), reason: 'same-setup-repeated' }
      }));
    }

    if (signals.fillerHits.length >= 3) {
      candidates.push(makeEvent('filler-cluster', {
        confidence: 'low',
        scoreDelta: judgeConfig.lowConfidenceDelta || -2,
        explanation: copy.filler,
        suggestion: copy.filler,
        evidence: evidenceFrom(signals.fillerHits[0], 'clustered-fillers')
      }));
    }

    // Isolated 其实 / 我觉得 / it / if never become their own penalty events.
    void signals.isolatedHits;
    void signals.becauseHits;
    void signals.hasDigit;

    const ranked = [];
    const baseType = type => String(type || '').replace(/-support$/, '');
    priorities.forEach(key => {
      const mapped = key === 'density' ? 'repeat-padding' : key;
      const found = candidates.find(item => item.type === mapped || baseType(item.type) === key || (key === 'density' && item.type === 'density-support'));
      if (found) ranked.push(found);
    });
    candidates.forEach(item => {
      if (!ranked.includes(item)) ranked.push(item);
    });
    if (platform.family === 'search') {
      const searchEvent = candidates.find(item => item.type === 'search-support');
      if (searchEvent) {
        ranked.splice(ranked.indexOf(searchEvent), 1);
        ranked.unshift(searchEvent);
      }
    }

    const chosen = ranked.find(item => !inCooldown(previousEvents, item.type, segment, cooldownMs));
    if (!chosen) {
      return {
        events: [],
        hasScore: Boolean(round.hasScore),
        score: round.score,
        note: copy.insufficient,
        version: VERSION,
        kind: KIND,
        label: copy.judgeLabel,
        disclaimer: copy.relative,
        platform: platform.key,
        platformFamily: platform.family
      };
    }

    if (chosen.confidence === 'low') {
      chosen.explanation = `${chosen.explanation} ${copy.lowConf}`;
    }

    return {
      events: [{
        ...chosen,
        audienceId,
        audienceName,
        startMs: segment.startMs,
        endMs: segment.endMs,
        timePrecision: chosen.timePrecision || segment.timePrecision
      }],
      hasScore: true,
      version: VERSION,
      kind: KIND,
      label: copy.judgeLabel,
      disclaimer: copy.relative,
      platform: platform.key,
      platformFamily: platform.family
    };
  }

  function describe() {
    return {
      version: VERSION,
      kind: KIND,
      label: 'Rule judge (not a semantic model)',
      scale: { min: 12, max: 92, initial: 50 },
      notes: [
        'Deterministic for a frozen input, config, and version.',
        'Scores are relative simulated interest aligned to public creator-education heuristics, never a retention probability or platform ranking.',
        'Keyword hits are local copy evidence, not proof of quality, personality, popularity, or traffic.',
        'Platform labels only change heuristic weights. This file does not call Douyin, Kuaishou, Xiaohongshu, YouTube, Instagram, or Bilibili APIs.',
        'Future model judges must keep the same event fields and must not pretend this rules file already understands meaning.'
      ]
    };
  }

  return { VERSION, KIND, audiencePriorities, PLATFORM_PROFILES, primaryPlatform, findMatches, judge, describe, create: () => ({ version: VERSION, kind: KIND, describe, judge }) };
});
