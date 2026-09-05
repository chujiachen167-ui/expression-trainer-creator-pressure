const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { packageWeb } = require('../scripts/package-web.js');
const { makePage, input, read } = require('./qa-dom-helper');
const Session = require('../v2-session-model.js');
const Judge = require('../v2-rule-judge.js');
const Review = require('../v2-review.js');

function store() {
  return Session.createStore({ judge: Judge.create(), now: () => clock });
}
let clock = 1_000_000;
function start(s, extra = {}) {
  clock = extra.practiceStartedAt || 1_000_000;
  return s.startRound({
    topic: extra.topic || '讲清手机和相机差异',
    audienceId: extra.audienceId || 'fastScroller',
    audienceName: extra.audienceName || '快划观众',
    pressure: extra.pressure || 'medium',
    recognitionLanguage: extra.recognitionLanguage || 'zh-CN',
    uiLocale: extra.uiLocale || 'zh-CN',
    judge: extra.judge
  }, { practiceStartedAt: clock, sessionId: extra.sessionId });
}

function finalIngest(s, text, extra = {}) {
  clock = extra.arrivedAt || clock + 200;
  return s.ingestTranscript({
    text,
    isFinal: true,
    source: extra.source || 'web-stt',
    resultId: extra.resultId,
    audioStartedAt: extra.audioStartedAt,
    audioEndedAt: extra.audioEndedAt,
    estimatedStartedAt: extra.estimatedStartedAt,
    estimatedEndedAt: extra.estimatedEndedAt,
    arrivedAt: extra.arrivedAt || clock,
    sessionId: extra.sessionId
  });
}

const empty = store();
start(empty);
empty.beginStopping();
const emptyRound = empty.completeRound().round;
assert.equal(emptyRound.status, 'empty');
assert.equal(emptyRound.hasScore, false);
assert.equal(emptyRound.score, null);

const failed = store();
start(failed, { sessionId: 's-fail' });
failed.setAdapterStatus({ sessionId: 's-fail', failed: true, failureReason: 'stt-failed' });
failed.beginStopping();
const failedRound = failed.completeRound({ sessionId: 's-fail' }).round;
assert.equal(failedRound.status, 'failed');
assert.equal(failedRound.hasScore, false);

const paste = store();
start(paste);
finalIngest(paste, '今天先说结论：入门相机适合拍夜景。', { source: 'paste', resultId: 'paste-1' });
const pasteRound = paste.getActiveRound();
assert.equal(pasteRound.segments[0].timePrecision, 'none');
assert.equal(pasteRound.segments[0].startMs, null);
assert.ok(pasteRound.events.some(event => event.type === 'opening-insufficient' && event.timePrecision === 'none'));
assert.equal(Session.recordingSeek(pasteRound.segments[0].startMs, null, pasteRound.practiceStartedAt).seekable, false);

const dup = store();
start(dup, { sessionId: 's-dup' });
const first = finalIngest(dup, '适合新手的相机更稳。', {
  resultId: 'chunk-1',
  audioStartedAt: clock,
  audioEndedAt: clock + 2000,
  arrivedAt: clock + 2500
});
const again = finalIngest(dup, '适合新手的相机更稳。', {
  resultId: 'chunk-1',
  audioStartedAt: clock,
  audioEndedAt: clock + 2000,
  arrivedAt: clock + 4000
});
assert.equal(again.ignored, true);
assert.equal(again.reason, 'duplicate-final');
assert.equal(dup.getActiveRound().segments.filter(item => item.status === 'final').length, 1);
dup.ingestTranscript({ text: '适合新手的相机更稳', isFinal: false, resultId: 'tmp-1', source: 'web-speech' });
dup.ingestTranscript({ text: '适合新手的相机更稳一点', isFinal: false, resultId: 'tmp-1', source: 'web-speech' });
const afterInterim = dup.getActiveRound();
assert.equal(afterInterim.segments.filter(item => item.status === 'interim').length, 1);
assert.ok(afterInterim.segments.find(item => item.status === 'interim').revision >= 2);
const spokenAgain = finalIngest(dup, '适合新手的相机更稳。', {
  resultId: 'chunk-2',
  audioStartedAt: clock + 5000,
  audioEndedAt: clock + 7000
});
assert.equal(spokenAgain.ignored, false);
assert.equal(dup.getActiveRound().segments.filter(item => item.status === 'final' && item.text.includes('适合新手')).length, 2);

const timed = store();
const origin = 5_000_000;
start(timed, { practiceStartedAt: origin, sessionId: 's-time' });
finalIngest(timed, '第一句价值。', {
  resultId: 't1',
  audioStartedAt: origin + 1000,
  audioEndedAt: origin + 1800,
  arrivedAt: origin + 4000
});
finalIngest(timed, '第二句隔了更久。', {
  resultId: 't2',
  audioStartedAt: origin + 9000,
  audioEndedAt: origin + 9800,
  arrivedAt: origin + 14000
});
const points = timed.getActiveRound().points.filter(item => item.kind === 'value');
assert.equal(timed.getActiveRound().segments[0].startMs, 1000);
assert.equal(timed.getActiveRound().segments[1].startMs, 9000);
assert.ok(points.some(item => item.t === 1000));
assert.ok(points.some(item => item.t === 9000));
assert.notEqual(timed.getActiveRound().segments[0].startMs, 4000, 'network arrival must not become speech time');

const stale = store();
start(stale, { sessionId: 'old' });
stale.beginStopping();
stale.completeRound({ sessionId: 'old' });
start(stale, { sessionId: 'new', practiceStartedAt: clock + 1000 });
const late = stale.ingestTranscript({
  sessionId: 'old',
  text: '迟到的旧轮字幕',
  isFinal: true,
  resultId: 'late',
  audioStartedAt: clock,
  audioEndedAt: clock + 1000,
  arrivedAt: clock + 2000
});
assert.equal(late.ignored, true);
assert.equal(late.reason, 'stale-round');
assert.equal(stale.getActiveRound().sessionId, 'new');
assert.equal((stale.getActiveRound().segments || []).length, 0);

const last = store();
start(last, { sessionId: 'round-1' });
finalIngest(last, '最后一句也要进这一轮。', {
  resultId: 'last',
  audioStartedAt: clock + 200,
  audioEndedAt: clock + 900,
  sessionId: 'round-1'
});
last.beginStopping();
finalIngest(last, '停止后才确认的最后一句。', {
  resultId: 'last-final',
  audioStartedAt: clock + 1000,
  audioEndedAt: clock + 1600,
  sessionId: 'round-1'
});
last.completeRound({ sessionId: 'round-1' });
assert.ok(last.getActiveRound().segments.some(item => item.text.includes('停止后才确认')));
start(last, { sessionId: 'round-2' });
assert.equal(last.getActiveRound().sessionId, 'round-2');
assert.equal(last.getPreviousRound().sessionId, 'round-1');
assert.ok(last.getPreviousRound().segments.some(item => item.text.includes('最后一句')));

const tone = store();
start(tone, { audienceId: 'skeptic', audienceName: '怀疑型观众' });
finalIngest(tone, '其实我觉得这件事可以再看一看，嗯，好。', {
  resultId: 'tone',
  audioStartedAt: clock,
  audioEndedAt: clock + 1500
});
assert.equal((tone.getActiveRound().events || []).some(event => event.type === 'filler-cluster'), false);

const narrative = store();
start(narrative, { audienceId: 'fastScroller', audienceName: '快划观众' });
finalIngest(narrative, '有一次我在夜市拍灯，先讲那个晚上发生了什么。', {
  resultId: 'nar',
  audioStartedAt: clock,
  audioEndedAt: clock + 2000
});
const narrativeEvent = narrative.getActiveRound().events.find(event => event.type === 'opening');
assert.ok(narrativeEvent);
assert.match(narrativeEvent.explanation, /叙事|允许/);

const english = store();
start(english, { audienceId: 'beginner', audienceName: 'Beginner', uiLocale: 'en-US', recognitionLanguage: 'en-US' });
finalIngest(english, 'It if synergy can unlock value for everyone always.', {
  resultId: 'en1',
  audioStartedAt: clock,
  audioEndedAt: clock + 2000
});
const enEvents = english.getActiveRound().events;
assert.equal(enEvents.some(event => /unprofessional|不专业/.test(event.explanation) && /it|if/i.test(event.evidence?.match || '')), false);
assert.ok(enEvents.some(event => event.type === 'jargon' || event.type === 'evidence'));

const beginner = store();
start(beginner, { audienceId: 'beginner', audienceName: '零基础观众' });
finalIngest(beginner, '我们要做底层逻辑和赛道的闭环赋能。', {
  resultId: 'b1',
  audioStartedAt: clock,
  audioEndedAt: clock + 2000
});
assert.ok(beginner.getActiveRound().events.some(event => event.type === 'jargon'));

const skeptic = store();
start(skeptic, { audienceId: 'skeptic', audienceName: '怀疑型观众' });
finalIngest(skeptic, '这个方案一定能保证所有人最好的结果，因为我这么觉得。', {
  resultId: 'sk1',
  audioStartedAt: clock,
  audioEndedAt: clock + 2000
});
assert.ok(skeptic.getActiveRound().events.some(event => event.type === 'evidence'));
assert.notEqual(beginner.getActiveRound().events[0]?.type, skeptic.getActiveRound().events[0]?.type);

const sameA = store();
start(sameA, { topic: '同一题', audienceId: 'fastScroller' });
finalIngest(sameA, '很多方面都比较好。', { resultId: 'c1', audioStartedAt: clock, audioEndedAt: clock + 1200 });
sameA.beginStopping();
sameA.completeRound();
start(sameA, { topic: '同一题', audienceId: 'fastScroller' });
finalIngest(sameA, '夜景能多保留两档亮部，适合拍灯会的人。', { resultId: 'c2', audioStartedAt: clock + 500, audioEndedAt: clock + 1800 });
sameA.beginStopping();
sameA.completeRound();
const compared = Review.compareRounds(sameA.getPreviousRound(), sameA.getActiveRound(), 'zh-CN');
assert.equal(compared.comparable, true);
assert.equal(compared.assumedBetter, false);
assert.ok(compared.changes.length >= 1);

const changed = Review.compareRounds(
  sameA.getPreviousRound(),
  { ...sameA.getActiveRound(), frozen: { ...sameA.getActiveRound().frozen, audienceId: 'skeptic', judgeVersion: 'rules-v1.0.0' } },
  'zh-CN'
);
assert.equal(changed.comparable, false);

const exported = Review.exportPayload({ rounds: [sameA.getPreviousRound(), sameA.getActiveRound()] });
assert.equal(exported.containsTranscript, true);
assert.equal(exported.containsMedia, false);
assert.equal(exported.containsSecrets, false);
assert.ok(exported.rounds[0].segments[0].text);
assert.doesNotMatch(JSON.stringify(exported), /apikey|deviceId|microphone/i);

const withVideo = Session.recordingSeek(2500, { canSeek: true, startedAt: origin + 1000, durationMs: 10000 }, origin);
assert.equal(withVideo.seekable, true);
assert.ok(Math.abs(withVideo.seconds - 1.5) < 0.05);
const noVideo = Session.recordingSeek(2500, null, origin);
assert.equal(noVideo.seekable, false);

const ui = makePage('v2-ai-audience.html', { extraScripts: ['audience-templates.js', 'avatar-provider.js', 'v2-session-model.js', 'v2-rule-judge.js', 'v2-review.js', 'v2-interest-panel.js', 'app.js'] });
const panel = ui.window.document.querySelector('[data-v2-interest-panel]');
assert(panel, 'V2 page mounts the time-based interest panel');
assert.match(panel.textContent, /模拟观众兴趣趋势/);
assert.equal(ui.window.document.querySelector('[data-interest-curve]'), null);
ui.window.document.querySelector('[data-qa-tab="v2-interest"]').click();
assert(ui.window.document.querySelector('[data-path="components.v2Interest.lineColor"]'));
assert(ui.window.document.querySelector('[data-path="components.v2Interest.chartHeight"]'));
input(ui.window, 'components.v2Interest.chartHeight', 120);
const saved = JSON.parse(JSON.stringify(ui.window.CreatorQAControls.getState()));
assert.equal(saved.components.v2Interest.chartHeight, 120);
assert.equal(JSON.stringify(saved).includes('夜景能多保留'), false);
ui.window.CreatorV2Playback = {
  getRecording() { return { canSeek: true, startedAt: 1_000_000, durationMs: 20000 }; },
  seek(seconds) { ui.window.__seek = seconds; }
};
const liveStore = ui.window.CreatorV2SessionStore;
liveStore.startRound({
  topic: '讲清差异', audienceId: 'fastScroller', audienceName: '快划观众', pressure: 'medium',
  uiLocale: 'zh-CN', recognitionLanguage: 'zh-CN'
}, { practiceStartedAt: 1_000_000, sessionId: 'ui-1' });
liveStore.ingestTranscript({
  text: '很多方面都比较好。',
  isFinal: true,
  source: 'replay',
  resultId: 'ui-a',
  audioStartedAt: 1_002_000,
  audioEndedAt: 1_003_000,
  arrivedAt: 1_006_000
});
liveStore.beginStopping();
liveStore.completeRound({ sessionId: 'ui-1' });
const located = ui.window.document.querySelector('.v2-seg.is-located, [data-event-id]');
assert(ui.window.document.querySelector('[data-v2-review]:not([hidden])') || ui.window.document.querySelector('[data-v2-review]'));
const eventButton = ui.window.document.querySelector('.v2-event-item, [data-event-id]');
if (eventButton) eventButton.dispatchEvent(new ui.window.MouseEvent('click', { bubbles: true }));
assert.equal(typeof ui.window.__seek === 'number' || ui.window.document.querySelector('.v2-seg'), true);
void located;
ui.window.close();

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-v2-'));
try {
  packageWeb({ rootDir: path.join(__dirname, '..'), outDir });
  assert.equal(fs.existsSync(path.join(outDir, 'v2-session-model.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'v2-rule-judge.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'v2-review.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'v2-interest-panel.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'dev/v2-replay.html')), false);
  assert.doesNotMatch(fs.readFileSync(path.join(outDir, 'v2-ai-audience.html'), 'utf8'), /v2-replay/);
  assert.match(fs.readFileSync(path.join(outDir, 'v2-ai-audience.html'), 'utf8'), /v2-interest-panel\.js/);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}

assert.match(read('web-stt.js'), /audioStartedAt/);
assert.match(read('web-stt.js'), /arrivedAt: Date\.now\(\)/);
assert.doesNotMatch(read('index.html'), /v2-session-model/);
assert.match(read('dev/v2-replay.html'), /测试数据/);

console.log('V2 judgment: empty/fail/paste timing, idempotency, clocks, isolation, audience differences, review compare, config, package boundary passed.');
