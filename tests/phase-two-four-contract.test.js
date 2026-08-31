const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const launcher = read('index.html');
const controls = read('control-panel.js');
const app = read('app.js');
const styles = read('shared.css');
const selector = read('avatar-selector.js');
const curve = read('interest-curve.js');

assert.match(launcher, /data-transcript-cover/, 'launcher should expose the dynamic transcript cover');
assert.match(launcher, /launcher-transcript\.js/, 'launcher should load the transcript-cover behavior');
assert.match(controls, /data-qa-tab="vertical-marquee"/, 'Magic UI Marquee should have its own named QA page');
assert.match(controls, /components\.transcriptCover\.scrollDuration/, 'transcript stream timing should be adjustable');
assert.match(controls, /components\.transcriptCover\.rawColor/, 'transcript stream colors should be adjustable');
assert.match(controls, /\[data-qa-copy-ignore\]/, 'decorative and runtime copy should not destabilize saved founder copy keys');
const transcript = read('launcher-transcript.js');
assert.match(transcript, /MagicUIMarquee\.mount/, 'transcript stream should use the attributed Magic UI adapter');
assert.doesNotMatch(transcript, /<span>原句|<span>精炼/, 'sentence labels must not return');
assert.doesNotMatch(launcher, /LIVE EDIT|正在整理表达|transcript-cover-foot/, 'remove decorative metadata and fake live status');
assert.doesNotMatch(styles, /\.transcript-cover::before/, 'remove the tinted pseudo-background, not just the border');
assert.doesNotMatch(transcript, /blur/, 'transcript stream should not blur copy during playback');

for (const page of ['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
  const html = read(page);
  assert.match(html, /data-stt-state="idle"/, `${page} should expose a semantic STT lifecycle state`);
  assert.match(html, /data-stt-retry/, `${page} should expose an explicit user-triggered retry path`);
}

assert.match(app, /permission-denied/, 'STT should distinguish permission denial from generic failure');
assert.match(app, /creator:stt-state/, 'STT lifecycle should be observable by shared UI');
assert.match(app, /creator:transcript-change/, 'transcript updates should feed passive training signals');
assert.doesNotMatch(app.slice(app.indexOf('instance.onend = () => {', app.indexOf('function setupRecognition')), app.indexOf('instance.onerror = event => {', app.indexOf('function setupRecognition'))), /instance\.start\(/, 'browser STT must never auto-restart and reprompt');

assert.match(selector, /createElement\('dialog'\)/, 'audience casting should use a focused native dialog');
assert.match(selector, /aria-pressed/, 'audience role selection should expose selected state beyond color');
assert.match(selector, /expression-trainer\.audience-selection\.v1/, 'audience role choices should persist locally');
assert.match(app, /data-audience-choose/, 'creator setup should expose a user-facing audience selector');

assert.match(curve, /原型估算/, 'interest curve must state that it is an estimate');
assert.match(curve, /不是眼动、真实用户或大模型结论/, 'interest curve must not impersonate real audience evidence');
assert.match(curve, /<table>/, 'interest curve should provide an accessible tabular fallback');
assert.match(styles, /--mode-accent:/, 'V1 V2 V3 should share a mode-aware visual token');

console.log('Phase 2-4 launcher, lifecycle, audience, and data-signal contracts passed.');
