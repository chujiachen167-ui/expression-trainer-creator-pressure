const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js');
const html = read('v2-ai-audience.html');
const localImport = read('live2d-local-import.js');
const main = read('main.js');
const preload = read('preload.js');
const pkg = JSON.parse(read('package.json'));

assert.doesNotMatch(app, /avatarProvider\?\.speak/, 'B must not call any avatar speech path');
assert.match(app, /预览反应/, 'B must offer a visual reaction preview');
assert.doesNotMatch(app, /试听反应/, 'B must not imply audio preview');
assert.match(html, /data-paste-open/, 'V2 must retain paste analysis');
assert.match(html, /data-optimized-script/, 'V2 must retain optimized scripts');
assert.match(html, /data-show-report/, 'V2 must expose the shared report');
assert.match(html, /class="v2-live2d-settings"/, 'V2 must expose a permanent Live2D section in the normal page flow');
assert.match(html, /data-local-avatar-anchor/, 'the permanent V2 Live2D section must expose an explicit mount anchor');
assert(html.indexOf('v2-live2d-settings') < html.indexOf('data-v2-topic-slot'), 'the Live2D entry must appear before the collapsible topic section');
assert.doesNotMatch(app, /data-local-avatar-anchor/, 'Live2D import must not be buried inside the audience type chooser setup');
assert.match(localImport, /\[data-local-avatar-anchor\]/, 'the importer must mount at the explicit audience-image location');
assert.match(localImport, /它不是 Live2D/, 'the SVG fallback must not masquerade as Live2D');
assert.match(main, /--use-local-live2d-sample/, 'local official-sample authorization must require an explicit development flag');
assert.match(main, /Resources', 'Hiyori'/, 'the authorized development sample must resolve inside ignored local runtime assets');
assert.match(preload, /getLocalLive2DDevSample/, 'the renderer must receive only the validated public sample record');
assert.equal(pkg.scripts['dev:live2d'], 'electron . --use-local-live2d-sample --open-v2');
assert(fs.existsSync(path.join(__dirname, '../docs/research/2026-09-10-v2-remediation-open-source-review.md')));

console.log('V2 remediation: silent B, shared core, visible local import, explicit Hiyori dev path, and research gate passed.');
