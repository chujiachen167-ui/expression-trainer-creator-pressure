/**
 * V2 session / segment / judgment store.
 * DOM-free. Adapters ingest transcript facts; the judge emits events.
 */
(function attachV2Session(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CreatorV2Session = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const JUDGE_VERSION = 'rules-v1.0.0';
  const JUDGE_KIND = 'rules';
  const SCORE_MIN = 12;
  const SCORE_MAX = 92;
  const SCORE_INITIAL = 50;
  const MAX_COMPARE_ROUNDS = 2;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultJudgeConfig(overrides = {}) {
    const num = (value, fallback) => {
      const next = Number(value);
      return Number.isFinite(next) ? next : fallback;
    };
    return {
      version: overrides.version || JUDGE_VERSION,
      kind: overrides.kind || JUDGE_KIND,
      scaleMin: num(overrides.scaleMin, SCORE_MIN),
      scaleMax: num(overrides.scaleMax, SCORE_MAX),
      initialScore: num(overrides.initialScore, SCORE_INITIAL),
      cooldownMs: num(overrides.cooldownMs, 12000),
      openingWindowMs: num(overrides.openingWindowMs, 8000),
      lowConfidenceDelta: num(overrides.lowConfidenceDelta, -2),
      highConfidenceDelta: num(overrides.highConfidenceDelta, -8),
      supportDelta: num(overrides.supportDelta, 4)
    };
  }

  function freezeConfig(input = {}) {
    const judge = defaultJudgeConfig(input.judge || {});
    return {
      topic: String(input.topic || '').slice(0, 300),
      templateId: input.templateId || null,
      audienceId: input.audienceId || 'fastScroller',
      audienceName: input.audienceName || '',
      pressure: ['low', 'medium', 'high'].includes(input.pressure) ? input.pressure : 'medium',
      recognitionLanguage: input.recognitionLanguage || 'zh-CN',
      uiLocale: input.uiLocale || 'zh-CN',
      judgeVersion: judge.version,
      judgeKind: judge.kind,
      judge
    };
  }

  function configsComparable(a, b) {
    if (!a || !b) return false;
    return a.topic === b.topic
      && a.audienceId === b.audienceId
      && a.pressure === b.pressure
      && a.judgeVersion === b.judgeVersion
      && a.recognitionLanguage === b.recognitionLanguage;
  }

  function recordingSeek(sessionMs, recording = null, practiceStartedAt = 0) {
    if (sessionMs == null || sessionMs < 0) return { seekable: false, reason: 'time-unknown' };
    if (!recording || recording.discarded) return { seekable: false, reason: 'no-recording' };
    if (!recording.canSeek) return { seekable: false, reason: 'player-cannot-seek' };
    const startedAt = Number(recording.startedAt) || 0;
    if (!startedAt || !practiceStartedAt) return { seekable: false, reason: 'time-unknown' };
    const offsetMs = startedAt - practiceStartedAt;
    const seekMs = sessionMs - offsetMs;
    if (seekMs < 0) return { seekable: false, reason: 'before-recording' };
    const durationMs = Number(recording.durationMs);
    if (Number.isFinite(durationMs) && seekMs > durationMs) return { seekable: false, reason: 'after-recording' };
    return { seekable: true, seconds: seekMs / 1000, offsetMs };
  }

  function createClock(nowFn = () => Date.now()) {
    let origin = 0;
    return {
      start(at = nowFn()) { origin = at; return origin; },
      now: nowFn,
      origin() { return origin; },
      sessionMs(wall = nowFn()) { return origin ? Math.max(0, wall - origin) : null; }
    };
  }

  function createStore({ judge, now = () => Date.now() } = {}) {
    let seq = 0;
    const nextId = prefix => {
      seq += 1;
      return `${prefix}-${seq}`;
    };
    const listeners = [];
    const completed = [];
    let active = null;
    let selectedEventId = null;
    let unsaved = false;

    const emit = () => {
      const snap = snapshot();
      listeners.forEach(listener => listener(snap));
    };

    function snapshotRound(round) {
      if (!round) return null;
      return clone({
        sessionId: round.sessionId,
        roundIndex: round.roundIndex,
        status: round.status,
        frozen: round.frozen,
        practiceStartedAt: round.practiceStartedAt,
        firstVoiceAt: round.firstVoiceAt,
        completedAt: round.completedAt,
        pendingCount: round.pendingCount,
        failureReason: round.failureReason,
        queuePending: round.queuePending,
        score: round.score,
        hasScore: round.hasScore,
        segments: round.segments,
        events: round.events,
        points: round.points,
        usedEventIds: [...round.usedEventIds],
        openSegmentId: round.openSegmentId
      });
    }

    function snapshot() {
      return {
        active: snapshotRound(active),
        previous: snapshotRound(completed[completed.length - 1] || null),
        rounds: completed.map(snapshotRound).concat(active ? [snapshotRound(active)] : []),
        selectedEventId,
        unsaved,
        judgeVersion: JUDGE_VERSION,
        judgeKind: JUDGE_KIND
      };
    }

    function startRound(config = {}, times = {}) {
      if (active && (active.status === 'running' || active.status === 'waiting-final')) {
        return { started: false, error: 'round-active' };
      }
      if (active && (active.status === 'complete' || active.status === 'empty' || active.status === 'failed' || active.status === 'queue-pending')) {
        completed.push(active);
        while (completed.length > MAX_COMPARE_ROUNDS) completed.shift();
      }
      const practiceStartedAt = times.practiceStartedAt || now();
      active = {
        sessionId: times.sessionId || nextId('session'),
        roundIndex: (completed[completed.length - 1]?.roundIndex || 0) + 1,
        status: 'running',
        frozen: freezeConfig(config),
        practiceStartedAt,
        firstVoiceAt: null,
        completedAt: null,
        pendingCount: 0,
        failureReason: '',
        queuePending: false,
        score: null,
        hasScore: false,
        segments: [],
        events: [],
        points: [],
        usedEventIds: new Set(),
        openSegmentId: null,
        seenResultIds: new Map(),
        accepting: true
      };
      selectedEventId = null;
      emit();
      return { started: true, sessionId: active.sessionId, frozen: clone(active.frozen) };
    }

    function resolveTimes(payload, round) {
      const arrivedAt = payload.arrivedAt || now();
      const arrivedMs = Math.max(0, arrivedAt - round.practiceStartedAt);
      const audioStart = payload.audioStartedAt != null ? Math.max(0, payload.audioStartedAt - round.practiceStartedAt) : null;
      const audioEnd = payload.audioEndedAt != null ? Math.max(0, payload.audioEndedAt - round.practiceStartedAt) : null;
      const estimatedStart = payload.estimatedStartedAt != null ? Math.max(0, payload.estimatedStartedAt - round.practiceStartedAt) : null;
      const estimatedEnd = payload.estimatedEndedAt != null ? Math.max(0, payload.estimatedEndedAt - round.practiceStartedAt) : null;
      const wordTimings = Array.isArray(payload.wordTimings) && payload.wordTimings.length ? payload.wordTimings : null;
      let precision = 'none';
      let startMs = null;
      let endMs = null;
      if (payload.source === 'paste') {
        precision = 'none';
      } else if (wordTimings) {
        precision = 'word';
        startMs = wordTimings[0].startMs;
        endMs = wordTimings[wordTimings.length - 1].endMs;
      } else if (audioStart != null || audioEnd != null) {
        precision = 'segment';
        startMs = audioStart != null ? audioStart : audioEnd;
        endMs = audioEnd != null ? audioEnd : audioStart;
      } else if (estimatedStart != null || estimatedEnd != null) {
        precision = 'estimated';
        startMs = estimatedStart != null ? estimatedStart : estimatedEnd;
        endMs = estimatedEnd != null ? estimatedEnd : estimatedStart;
      } else {
        precision = 'unknown';
      }
      return {
        arrivedMs,
        audioStartMs: audioStart,
        audioEndMs: audioEnd,
        startMs,
        endMs,
        precision,
        wordTimings
      };
    }

    function appendPoint(round, point) {
      round.points.push(point);
    }

    function ingestTranscript(payload = {}) {
      if (!active || !active.accepting) {
        return { ignored: true, reason: 'stale-round' };
      }
      if (payload.sessionId && payload.sessionId !== active.sessionId) {
        return { ignored: true, reason: 'stale-round' };
      }
      const text = String(payload.text || '');
      const isFinal = Boolean(payload.isFinal);
      const source = payload.source || 'unknown';
      if (active.status === 'failed' && source !== 'replay') {
        return { ignored: true, reason: 'failed-round' };
      }
      if (payload.resultId && active.seenResultIds.has(payload.resultId)) {
        const previous = active.seenResultIds.get(payload.resultId);
        if (previous.status === 'final' && previous.text === text) {
          return { ignored: true, reason: 'duplicate-final' };
        }
        if (previous.status === 'final') {
          return { ignored: true, reason: 'duplicate-final' };
        }
      }

      const times = resolveTimes(payload, active);
      let segment = null;
      if (!isFinal) {
        if (active.openSegmentId) {
          segment = active.segments.find(item => item.segmentId === active.openSegmentId);
          segment.text = text;
          segment.revision += 1;
          segment.arrivedMs = times.arrivedMs;
          if (times.precision !== 'unknown' && times.precision !== 'none') {
            segment.startMs = times.startMs;
            segment.endMs = times.endMs;
            segment.timePrecision = times.precision;
          }
        } else {
          segment = {
            sessionId: active.sessionId,
            segmentId: nextId('seg'),
            revision: 1,
            text,
            status: 'interim',
            source,
            resultId: payload.resultId || null,
            startMs: times.startMs,
            endMs: times.endMs,
            audioStartMs: times.audioStartMs,
            audioEndMs: times.audioEndMs,
            arrivedMs: times.arrivedMs,
            timePrecision: times.precision,
            wordTimings: times.wordTimings
          };
          active.segments.push(segment);
          active.openSegmentId = segment.segmentId;
        }
        if (payload.resultId) active.seenResultIds.set(payload.resultId, { text, status: 'interim', segmentId: segment.segmentId });
        if (text.trim() && !active.firstVoiceAt) active.firstVoiceAt = active.practiceStartedAt + (times.startMs ?? times.arrivedMs);
        appendPoint(active, { t: times.startMs ?? times.arrivedMs, kind: 'pending', score: active.score });
        emit();
        return { ignored: false, segment: clone(segment), events: [] };
      }

      if (active.openSegmentId) {
        segment = active.segments.find(item => item.segmentId === active.openSegmentId);
        segment.text = text;
        segment.revision += 1;
        segment.status = 'final';
        segment.source = source;
        segment.resultId = payload.resultId || segment.resultId;
        segment.arrivedMs = times.arrivedMs;
        if (times.startMs != null) segment.startMs = times.startMs;
        if (times.endMs != null) segment.endMs = times.endMs;
        if (times.audioStartMs != null) segment.audioStartMs = times.audioStartMs;
        if (times.audioEndMs != null) segment.audioEndMs = times.audioEndMs;
        if (times.precision !== 'unknown') segment.timePrecision = times.precision;
        if (times.wordTimings) segment.wordTimings = times.wordTimings;
        active.openSegmentId = null;
      } else {
        segment = {
          sessionId: active.sessionId,
          segmentId: nextId('seg'),
          revision: 1,
          text,
          status: 'final',
          source,
          resultId: payload.resultId || null,
          startMs: times.startMs,
          endMs: times.endMs,
          audioStartMs: times.audioStartMs,
          audioEndMs: times.audioEndMs,
          arrivedMs: times.arrivedMs,
          timePrecision: times.precision,
          wordTimings: times.wordTimings
        };
        active.segments.push(segment);
      }
      if (payload.resultId) active.seenResultIds.set(payload.resultId, { text, status: 'final', segmentId: segment.segmentId });
      if (text.trim() && !active.firstVoiceAt) {
        active.firstVoiceAt = active.practiceStartedAt + (segment.startMs ?? times.arrivedMs);
      }
      if (text.trim() && !active.hasScore) {
        active.score = active.frozen.judge.initialScore;
        active.hasScore = true;
        appendPoint(active, {
          t: segment.startMs != null ? segment.startMs : 0,
          kind: 'value',
          score: active.score,
          eventId: null
        });
      }

      const judged = judge && text.trim()
        ? judge.judge({
          round: snapshotRound(active),
          segment: clone(segment),
          previousEvents: clone(active.events),
          locale: active.frozen.uiLocale,
          recognitionLanguage: active.frozen.recognitionLanguage
        })
        : { events: [], score: active.score, hasScore: active.hasScore };

      const events = Array.isArray(judged?.events) ? judged.events : [];
      events.forEach(event => {
        const eventId = event.eventId || nextId('evt');
        const record = {
          eventId,
          sessionId: active.sessionId,
          segmentId: segment.segmentId,
          startMs: event.startMs ?? segment.startMs,
          endMs: event.endMs ?? segment.endMs,
          timePrecision: event.timePrecision || segment.timePrecision,
          audienceId: event.audienceId || active.frozen.audienceId,
          audienceName: event.audienceName || active.frozen.audienceName,
          type: event.type,
          evidence: event.evidence || { excerpt: text.slice(0, 80), match: '', reason: '' },
          explanation: event.explanation || '',
          suggestion: event.suggestion || '',
          confidence: event.confidence || 'insufficient',
          scoreDelta: Number.isFinite(event.scoreDelta) ? event.scoreDelta : 0,
          scoreAfter: null,
          judgeVersion: active.frozen.judgeVersion,
          judgeKind: active.frozen.judgeKind
        };
        if (record.confidence !== 'insufficient' && text.trim()) {
          if (!active.hasScore) {
            active.score = active.frozen.judge.initialScore;
            active.hasScore = true;
            appendPoint(active, { t: 0, kind: 'value', score: active.score, eventId: null });
          }
          const next = Math.max(
            active.frozen.judge.scaleMin,
            Math.min(active.frozen.judge.scaleMax, active.score + record.scoreDelta)
          );
          active.score = next;
          record.scoreAfter = next;
        } else {
          record.scoreAfter = active.hasScore ? active.score : null;
        }
        active.events.push(record);
        const t = record.startMs != null ? record.startMs : times.arrivedMs;
        if (active.hasScore) {
          appendPoint(active, { t, kind: 'value', score: active.score, eventId: record.eventId });
        }
      });
      if (!events.length && active.hasScore) {
        const t = segment.startMs != null ? segment.startMs : times.arrivedMs;
        appendPoint(active, { t, kind: 'value', score: active.score, eventId: null });
      }
      emit();
      return { ignored: false, segment: clone(segment), events: clone(active.events.slice(-events.length)) };
    }

    function setAdapterStatus(patch = {}) {
      if (!active || !active.accepting) return { ignored: true, reason: 'stale-round' };
      if (patch.sessionId && patch.sessionId !== active.sessionId) return { ignored: true, reason: 'stale-round' };
      if (patch.pendingCount != null) active.pendingCount = Math.max(0, Number(patch.pendingCount) || 0);
      if (patch.failed) {
        active.status = 'failed';
        active.failureReason = patch.failureReason || 'stt-failed';
      }
      emit();
      return { ignored: false };
    }

    function beginStopping() {
      if (!active) return { ignored: true, reason: 'no-round' };
      if (active.status !== 'failed') active.status = 'waiting-final';
      emit();
      return { ignored: false, sessionId: active.sessionId };
    }

    function completeRound(options = {}) {
      if (!active) return { ignored: true, reason: 'no-round' };
      if (options.sessionId && options.sessionId !== active.sessionId) return { ignored: true, reason: 'stale-round' };
      active.accepting = false;
      active.completedAt = options.completedAt || now();
      if (active.status === 'failed') {
        /* Keep failed: transcription failure is not user performance. */
      } else if (options.queuePending || active.pendingCount > 0) {
        active.status = 'queue-pending';
        active.queuePending = true;
      } else if (!active.segments.some(item => item.status === 'final' && String(item.text || '').trim())) {
        active.status = 'empty';
        active.hasScore = false;
        active.score = null;
        active.events = [];
        active.points = [];
      } else {
        active.status = 'complete';
      }
      if (active.openSegmentId) {
        const open = active.segments.find(item => item.segmentId === active.openSegmentId);
        if (open && open.status === 'interim') open.status = 'abandoned-interim';
        active.openSegmentId = null;
      }
      unsaved = Boolean(active.segments.some(item => String(item.text || '').trim()));
      emit();
      return { ignored: false, round: snapshotRound(active) };
    }

    function markEventUsed(eventId) {
      if (!active) return false;
      active.usedEventIds.add(eventId);
      return true;
    }

    function selectEvent(eventId) {
      selectedEventId = eventId || null;
      emit();
      return selectedEventId;
    }

    function markSaved() {
      unsaved = false;
      emit();
    }

    function getActiveRound() { return snapshotRound(active); }
    function getPreviousRound() { return snapshotRound(completed[completed.length - 1] || null); }

    return {
      onChange(listener) { listeners.push(listener); return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      }; },
      startRound,
      ingestTranscript,
      setAdapterStatus,
      beginStopping,
      completeRound,
      markEventUsed,
      selectEvent,
      markSaved,
      getActiveRound,
      getPreviousRound,
      snapshot,
      recordingSeek(sessionMs, recording) {
        const round = active || completed[completed.length - 1];
        return recordingSeek(sessionMs, recording, round?.practiceStartedAt || 0);
      }
    };
  }

  function samplePoints(points, maxPoints = 48) {
    const values = (points || []).filter(point => point.kind === 'value' && Number.isFinite(point.score) && Number.isFinite(point.t));
    if (values.length <= maxPoints) return values.slice();
    const sampled = [];
    const step = (values.length - 1) / (maxPoints - 1);
    for (let i = 0; i < maxPoints; i += 1) {
      sampled.push(values[Math.round(i * step)]);
    }
    return sampled;
  }

  function formatClock(ms, precision) {
    if (ms == null || !Number.isFinite(ms)) return '';
    const total = Math.max(0, Math.round(ms / 1000));
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    const clock = `${minutes}:${seconds}`;
    if (precision === 'estimated' || precision === 'unknown') return `~${clock}`;
    if (precision === 'none') return '';
    return clock;
  }

  return {
    JUDGE_VERSION,
    JUDGE_KIND,
    SCORE_MIN,
    SCORE_MAX,
    SCORE_INITIAL,
    defaultJudgeConfig,
    freezeConfig,
    configsComparable,
    recordingSeek,
    createClock,
    createStore,
    samplePoints,
    formatClock
  };
});
