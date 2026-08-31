const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const styles = read('shared.css');
[
  '--color-canvas:', '--color-surface:', '--color-border:', '--color-text:',
  '--color-brand:', '--color-action:', '--color-warning:', '--color-danger:',
  '--space-1:', '--radius-lg:', '--motion-standard:', '--ease-out-ui:'
].forEach(token => assert.ok(styles.includes(token), `shared design token ${token} must exist`));

const launcher = read('index.html');
assert.match(launcher, /class="version-card featured" data-version="v1"/,
  'V1 must be the recommended starting layer');
assert.match(launcher, /class="version-card" data-version="v2"/,
  'V2 must remain available without competing with the beginner starting layer');
assert.doesNotMatch(launcher, /class="version-card featured" data-version="v2"/,
  'V2 must not contradict the V1 beginner recommendation');
assert.match(launcher, /class="version-status"[^>]*>推荐起点</,
  'the recommendation must be communicated with text, not color alone');

const controls = read('control-panel.js');
assert.match(controls, /setProperty\('--color-canvas', state\.theme\.bg\)/,
  'QA color changes must update the semantic canvas token');
assert.match(controls, /setProperty\('--color-brand', state\.theme\.accent\)/,
  'QA color changes must update the semantic brand token');
assert.match(controls, /panelPositionKey = 'expression-trainer\.creator-qa\.panel-position\.v1'/,
  'QA panel position must be persisted independently from the editable project configuration');
assert.match(controls, /data-qa-drag-handle/,
  'QA panel must expose a dedicated title-bar drag handle');
assert.match(controls, /window\.addEventListener\('pointermove'/,
  'QA panel drag behavior must follow pointer movement');
assert.match(controls, /window\.addEventListener\('resize'/,
  'QA panel position must remain within the viewport after a resize');

console.log('Design foundation and launcher hierarchy contract tests passed.');
