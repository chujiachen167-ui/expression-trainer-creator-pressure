const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

assert.match(read('index.html'), /launcher-scroll-expand\.js/);
['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html'].forEach(file => {
  assert.match(read(file), /launcher-scroll-expand\.js/, `${file} must include the arrival transition`);
  assert.match(read(file), /scroll-expand-entry-pending/, `${file} must install the first-paint cover`);
});

const controlPanel = read('control-panel.js');
assert.match(controlPanel, /components\.scrollExpand\.enabled/);
assert.match(controlPanel, /components\.scrollExpand\.backgroundHandoff/);
assert.match(controlPanel, /components\.scrollExpand\.handoffDirection/);
assert.match(controlPanel, /data-qa-tab="scroll-expand"/);

const transition = read('launcher-scroll-expand.js');
assert.match(transition, /scroll-expand-transition/);
assert.match(transition, /prefers-reduced-motion/);
assert.match(transition, /window\.location\.assign/);
assert.match(transition, /backgroundHandoff/);
assert.match(transition, /chooseDirection/);
assert.match(transition, /transitionInFlight/);
assert.match(transition, /event\.detail === 0/);
assert.match(transition, /clearArrivalState\(\)/);
assert.match(transition, /reduceMotion\(\) \|\| stale/);
assert.match(transition, /duration: 480/);
assert.match(transition, /handoffDuration: 340/);

const styles = read('shared.css');
assert.match(styles, /scroll-expand-entry-pending\.scroll-expand-entry-settling(?:\[data-scroll-expand-direction="up"\])? body::before/);
assert.match(styles, /scroll-expand-entry-pending\.scroll-expand-entry-settling \.workspace/);
assert.match(styles, /data-scroll-expand-direction="left"/);
assert.match(styles, /html\.scroll-expand-entry-pending body::before \{ display: none; transition: none; \}/);
assert.match(styles, /html\.is-page-transitioning \.version-card \{ pointer-events: none; \}/);

assert.match(read('THIRD_PARTY_NOTICES.md'), /React Bits · Scroll Expand/);
assert.match(read('THIRD_PARTY_NOTICES.md'), /Codrops · Async Page Transitions/);
console.log('scroll expand integration contract: passed');
