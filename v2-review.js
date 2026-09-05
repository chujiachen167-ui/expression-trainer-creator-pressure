/**
 * V2 round review, same-topic comparison, and JSON export. No media or secrets.
 */
(function attachV2Review(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CreatorV2Review = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function configsComparable(a, b) {
    const fromGlobal = (typeof globalThis !== 'undefined' && globalThis.CreatorV2Session?.configsComparable);
    if (fromGlobal) return fromGlobal(a, b);
    if (typeof require === 'function') {
      try { return require('./v2-session-model.js').configsComparable(a, b); } catch (_) { /* Browser bundle has no require. */ }
    }
    return false;
  }

  function copyFor(locale) {
    const enUS = locale === 'en-US';
    return {
      empty: enUS ? 'This round has no accepted speech, so no simulated score was created.' : '本轮没有被接受的发言，因此不生成模拟分数。',
      failed: enUS ? 'Transcription failed. That failure is not counted as your delivery.' : '转写失败。失败不计入你的表达表现。',
      queue: enUS ? 'Some accepted captions were still finishing. Review is incomplete, not a score drop.' : '仍有已接受字幕在收尾。这是未完成状态，不是兴趣下降。',
      openingMissing: enUS ? 'Not enough information to judge the opening.' : '开场信息不足，暂不判断。',
      incomparable: enUS
        ? 'These two rounds used different topic, audience, pressure, language, or judge version, so they are not compared as improvement.'
        : '两轮的题目、受众、压力、识别语言或判断版本不同，不能当作进步比较。',
      noBetter: enUS
        ? 'A second round is not assumed to be better. Internal scores do not prove skill.'
        : '第二轮不会被默认更好。内部得分不能证明能力提高。',
      nextOpening: enUS ? 'Next round: state one concrete stake in the opening passage.' : '下一轮只练一个动作：在开场片段说出一个具体利害。',
      nextSpecific: enUS ? 'Next round: replace one broad word with a number, condition, or named result.' : '下一轮只练一个动作：把一个笼统词换成数量、条件或具名结果。',
      nextEvidence: enUS ? 'Next round: add one checkable basis for the strongest claim.' : '下一轮只练一个动作：给最强主张补一条可核对依据。',
      nextExample: enUS ? 'Next round: add one retellable example after the concept.' : '下一轮只练一个动作：概念之后补一个能复述的例子。',
      nextJargon: enUS ? 'Next round: swap one jargon term for an action a beginner can see.' : '下一轮只练一个动作：把一个黑话换成新手看得见的动作。',
      nextTradeoff: enUS ? 'Next round: name who it is not for, or one cost.' : '下一轮只练一个动作：说出不适合谁，或一个代价。',
      nextKeep: enUS ? 'Next round: keep the same topic and add one new concrete fact earlier.' : '下一轮保持同一题，把一个新的具体事实说得更早。',
      nextPadding: enUS ? 'Next round: say the setup once, then add a new fact.' : '下一轮把铺垫只说一次，然后补一条新事实。',
      change: enUS ? 'Observed wording change, not a verdict that you improved.' : '这是用词上的可见变化，不是能力提高的判定。',
      relative: enUS ? 'Relative simulated interest only.' : '仅为相对模拟兴趣。'
    };
  }

  function keyEvents(round, limit = 3) {
    const ranked = (round?.events || [])
      .filter(event => event.type !== 'insufficient' && event.confidence !== 'insufficient')
      .slice()
      .sort((a, b) => {
        const conf = { high: 2, low: 1 };
        return (conf[b.confidence] || 0) - (conf[a.confidence] || 0);
      });
    const unique = [];
    ranked.forEach(event => {
      if (unique.length >= limit) return;
      if (unique.some(item => item.type === event.type)) return;
      unique.push(event);
    });
    return unique;
  }

  function openingJudgment(round, locale) {
    const text = copyFor(locale);
    const opening = (round?.events || []).find(event => event.type === 'opening' || event.type === 'opening-insufficient');
    if (!opening) return { status: 'insufficient', explanation: text.openingMissing, event: null };
    return {
      status: opening.type === 'opening-insufficient' || opening.confidence === 'insufficient' ? 'insufficient' : opening.confidence,
      explanation: opening.explanation,
      event: opening
    };
  }

  function nextAction(round, locale) {
    const text = copyFor(locale);
    const first = keyEvents(round, 1)[0];
    const map = {
      opening: text.nextOpening,
      specificity: text.nextSpecific,
      evidence: text.nextEvidence,
      example: text.nextExample,
      jargon: text.nextJargon,
      tradeoff: text.nextTradeoff,
      'repeat-padding': text.nextPadding,
      relevance: text.nextOpening
    };
    if (!first) return text.nextKeep;
    return map[first.type] || text.nextKeep;
  }

  function buildReview(round, locale = 'zh-CN') {
    const text = copyFor(locale);
    if (!round) return { status: 'empty', keyEvents: [], opening: { status: 'insufficient', explanation: text.openingMissing }, nextAction: text.nextKeep, hasScore: false };
    if (round.status === 'failed') {
      return { status: 'failed', keyEvents: [], opening: { status: 'insufficient', explanation: text.failed }, nextAction: text.nextKeep, hasScore: false, note: text.failed };
    }
    if (round.status === 'empty') {
      return { status: 'empty', keyEvents: [], opening: { status: 'insufficient', explanation: text.empty }, nextAction: text.nextKeep, hasScore: false, note: text.empty };
    }
    if (round.status === 'queue-pending') {
      return { status: 'queue-pending', keyEvents: keyEvents(round), opening: openingJudgment(round, locale), nextAction: nextAction(round, locale), hasScore: round.hasScore, note: text.queue };
    }
    return {
      status: round.status,
      keyEvents: keyEvents(round),
      opening: openingJudgment(round, locale),
      nextAction: nextAction(round, locale),
      hasScore: Boolean(round.hasScore),
      score: round.hasScore ? round.score : null,
      scoreLabel: text.relative,
      frozen: round.frozen
    };
  }

  function quoteFor(round, event) {
    if (!event) return '';
    const segment = (round.segments || []).find(item => item.segmentId === event.segmentId);
    return event.evidence?.excerpt || segment?.text || '';
  }

  function compareRounds(previous, current, locale = 'zh-CN') {
    const text = copyFor(locale);
    if (!previous || !current) {
      return { comparable: false, reason: text.incomparable, changes: [], assumedBetter: false };
    }
    const canCompare = configsComparable(previous.frozen, current.frozen);
    if (!canCompare) {
      return { comparable: false, reason: text.incomparable, changes: [], assumedBetter: false };
    }
    const types = new Set([
      ...keyEvents(previous, 6).map(item => item.type),
      ...keyEvents(current, 6).map(item => item.type)
    ]);
    const changes = [];
    types.forEach(type => {
      const before = (previous.events || []).find(item => item.type === type);
      const after = (current.events || []).find(item => item.type === type);
      if (!before && !after) return;
      changes.push({
        type,
        beforeQuote: quoteFor(previous, before),
        afterQuote: quoteFor(current, after),
        note: text.change
      });
    });
    return {
      comparable: true,
      reason: text.noBetter,
      assumedBetter: false,
      changes,
      previousScore: previous.hasScore ? previous.score : null,
      currentScore: current.hasScore ? current.score : null,
      scoreNote: text.relative
    };
  }

  function exportPayload({ rounds = [], locale = 'zh-CN', product = 'Read Yourself' } = {}) {
    const safeRounds = (rounds || []).filter(Boolean).map(round => ({
      sessionId: round.sessionId,
      roundIndex: round.roundIndex,
      status: round.status,
      frozen: round.frozen,
      practiceStartedAt: round.practiceStartedAt,
      firstVoiceAt: round.firstVoiceAt,
      completedAt: round.completedAt,
      hasScore: round.hasScore,
      score: round.hasScore ? round.score : null,
      scoreKind: 'relative-simulated-interest',
      segments: (round.segments || []).map(segment => ({
        segmentId: segment.segmentId,
        revision: segment.revision,
        text: segment.text,
        status: segment.status,
        source: segment.source,
        startMs: segment.startMs,
        endMs: segment.endMs,
        timePrecision: segment.timePrecision
      })),
      events: (round.events || []).map(event => ({
        eventId: event.eventId,
        segmentId: event.segmentId,
        type: event.type,
        startMs: event.startMs,
        endMs: event.endMs,
        timePrecision: event.timePrecision,
        audienceId: event.audienceId,
        confidence: event.confidence,
        explanation: event.explanation,
        suggestion: event.suggestion,
        evidence: event.evidence,
        scoreDelta: event.scoreDelta,
        scoreAfter: event.scoreAfter
      })),
      containsTranscript: true
    }));
    return {
      product,
      kind: 'v2-review',
      locale,
      exportedAt: new Date().toISOString(),
      judge: {
        version: rounds[0]?.frozen?.judgeVersion || 'rules-v1.0.0',
        kind: rounds[0]?.frozen?.judgeKind || 'rules',
        note: locale === 'en-US' ? 'Rule judge, not a semantic model.' : '规则判断器，不是语义模型。'
      },
      containsTranscript: true,
      containsMedia: false,
      containsSecrets: false,
      rounds: safeRounds
    };
  }

  function downloadJson(payload, filename = 'read-yourself-v2-review.json') {
    const json = JSON.stringify(payload, null, 2);
    if (typeof document === 'undefined') return json;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return json;
  }

  return { buildReview, compareRounds, exportPayload, downloadJson, keyEvents };
});
