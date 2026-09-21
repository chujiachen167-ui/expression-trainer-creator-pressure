const assert = require('node:assert/strict');
const { makePage } = require('./qa-dom-helper');

const page = makePage('v2-ai-audience.html', {
  extraScripts: [
    'live2d-local-validator.js',
    'vendor/bloub/read-yourself-bloub-core.js',
    'bloub-audience-runtime.js',
    'v2-audience-expression.js',
    'v2-audience-stage.js',
    'live2d-local-import.js'
  ]
});
page.window.requestAnimationFrame = () => 1;
page.window.cancelAnimationFrame = () => {};
page.window.api = {
  pickLocalLive2DAvatar: async () => ({
    success: true,
    record: { id: 'local-test-avatar', name: '本地测试模型', modelFile: 'avatar.model3.json', references: [], fileCount: 1, totalBytes: 12, source: 'local-folder', importedAt: '2026-09-09T00:00:00.000Z' }
  })
};
assert.equal(page.window.CreatorLocalAvatarImport.isLocalEnvironment(), true);
assert.equal(page.window.CreatorLocalAvatarImport.isLocalEnvironment(), true);
page.window.localStorage.setItem(page.window.CreatorLocalAvatarImport.STORAGE_KEY, JSON.stringify([{ id: 'legacy-local', name: '旧模型', folderPath: 'C:\\private\\avatar', source: 'local-folder' }]));
assert.equal(page.window.CreatorLocalAvatarImport.readRecords()[0].folderPath, undefined, 'legacy absolute path must be removed from page storage');
assert.doesNotMatch(page.window.localStorage.getItem(page.window.CreatorLocalAvatarImport.STORAGE_KEY), /private|folderPath/);
page.window.localStorage.clear();
const host = page.window.document.createElement('section');
host.className = 'audience-config';
page.window.document.body.append(host);
page.window.CreatorLocalAvatarImport.mount(host);
assert.match(host.textContent, /只在本机使用/);
assert.match(host.textContent, /只登记在本机/);
assert.match(host.textContent, /兼容表情形象/);
const importButton = host.querySelector('[data-local-avatar-import]');
assert.equal(importButton.tagName, 'BUTTON');
assert.equal(importButton.type, 'button');

const tile = page.window.document.createElement('div');
tile.className = 'audience-tile';
tile.innerHTML = '<div class="avatar">测</div>';
page.window.document.body.append(tile);
const stage = page.window.CreatorAudienceStage.mount(tile);
page.window.CreatorAudienceStage.attachAdapter(stage, page.window.CreatorAudienceStage.createLocalAdapter({ id: 'local-test-avatar' }));
assert.equal(stage.dataset.adapter, 'local-live2d');
page.window.CreatorAudienceStage.setExpression(stage, 'interest');
assert.equal(stage.dataset.presentation, 'bloub');
assert.equal(stage.dataset.adapterStatus, 'cubism-core-missing');
page.window.CreatorAudienceStage.detachAdapter(stage);
assert.equal(stage.dataset.presentation, 'bloub');
page.window.CreatorAudienceStage.attachAdapter(stage, { kind: 'test-adapter', status: 'ready', setExpression: state => state === 'listen', destroy() {} });
page.window.CreatorAudienceStage.setExpression(stage, 'confused');
assert.equal(stage.dataset.presentation, 'bloub', 'missing adapter expression must restore bloub, not a blank canvas');
page.window.close();

const production = makePage('v2-ai-audience.html', {
  production: true,
  extraScripts: ['live2d-local-validator.js', 'live2d-local-import.js']
});
assert.equal(production.window.CreatorLocalAvatarImport.isLocalEnvironment(), false, 'production website must not expose local import');
production.window.CreatorLocalAvatarImport.scan();
const productionPanel = production.window.document.querySelector('.local-avatar-import');
assert(productionPanel, 'production website must explain where local Live2D is available instead of hiding the feature');
assert.match(productionPanel.textContent, /网页版本不读取模型/);
assert.match(productionPanel.textContent, /GitHub 本机版/);
assert.equal(productionPanel.querySelector('[data-local-avatar-import]').disabled, true);
production.window.close();

console.log('Local Live2D import: permanent entry, local-only action gate, registration surface, and adapter fallback passed.');
