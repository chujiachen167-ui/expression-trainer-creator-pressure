const assert = require('node:assert/strict');
const { makePage, input } = require('./qa-dom-helper');

(async () => {
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
assert.match(host.textContent, /默认表情 bloub/);
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

assert.equal(page.window.CreatorLocalAvatarImport.DEV_SAMPLE_PATH, 'local-runtime/Resources');
const described = await page.window.CreatorLocalAvatarImport.describeSession('missing');
assert.match(described.sampleHint, /local-runtime\/Resources/);
assert(host.querySelector('[data-local-avatar-toggle]'));
assert.match(host.querySelector('[data-local-avatar-list]').textContent, /默认表情 bloub/);
page.window.CreatorLocalAvatarImport.upsert({ id: 'keep-me', name: '保留模型', modelFile: 'keep.model3.json', references: [], fileCount: 1, totalBytes: 12, source: 'local-folder', importedAt: '2026-09-22T00:00:00.000Z' });
page.window.CreatorLocalAvatarImport.upsert({ id: 'drop-me', name: '不喜欢的模型', modelFile: 'drop.model3.json', references: [], fileCount: 1, totalBytes: 12, source: 'local-folder', importedAt: '2026-09-22T00:00:00.000Z' });
assert.match(host.querySelector('[data-local-avatar-list]').textContent, /不喜欢的模型/);
assert.equal(page.window.CreatorLocalAvatarImport.removeFromList('drop-me'), true);
assert.doesNotMatch(host.querySelector('[data-local-avatar-list]').textContent, /不喜欢的模型/);
assert.match(host.querySelector('[data-local-avatar-list]').textContent, /保留模型/);
assert.equal(host.querySelector('[data-local-avatar-toggle]').textContent, '默认表情 bloub');
assert.equal(page.window.document.querySelectorAll('[data-qa-tab]').length, 11);
page.window.document.querySelector('[data-qa-tab="live2d-audience"]').click();
assert.equal(page.window.document.querySelector('.qa-page:not([hidden])').dataset.qaPage, 'live2d-audience');
assert(page.window.document.querySelector('[data-path="components.live2dAudience.size"]'));
assert(page.window.document.querySelector('[data-live2d-preview-state="confused"]'));
assert.doesNotMatch(page.window.document.querySelector('[data-qa-page="live2d-audience"]').textContent, /选择本地模型文件夹/);
assert.equal(page.window.document.querySelector('[data-qa-page="live2d-audience"] [data-local-avatar-anchor]'), null);
assert.match(page.window.document.querySelector('[data-qa-page="live2d-audience"]').textContent, /口播诊断词库/);
assert.match(page.window.document.querySelector('[data-qa-page="live2d-audience"]').innerHTML, /data-output-unit="ms"/);
input(page.window, 'components.live2dAudience.size', 70);
input(page.window, 'components.live2dAudience.x', 8);
assert.equal(page.window.document.documentElement.style.getPropertyValue('--v2-live2d-size'), '70%');
assert.equal(page.window.document.documentElement.style.getPropertyValue('--v2-live2d-x'), '8px');
assert.equal(page.window.CreatorQAControls.getState().components.live2dAudience.size, 70);
assert.match(page.window.document.querySelector('[data-qa-page="live2d-audience"] [data-output="components.live2dAudience.size"]').value, /70 %/);
assert.match(page.window.document.querySelector('[data-qa-page="live2d-audience"] [data-output="components.live2dAudience.holdMs"]').value, /ms/);
assert.equal(page.window.document.querySelector('[data-qa-page="live2d-audience"] [data-path="components.bloubAudience.holdMs"]'), null);
input(page.window, 'components.live2dAudience.y', 40);
assert.equal(page.window.document.documentElement.style.getPropertyValue('--v2-live2d-y'), '40px');
assert.notEqual(page.window.document.documentElement.style.getPropertyValue('--v2-bloub-y'), '40px');
input(page.window, 'components.bloubAudience.y', 24);
assert.equal(page.window.document.documentElement.style.getPropertyValue('--v2-bloub-y'), '24px');
assert.equal(page.window.document.documentElement.style.getPropertyValue('--v2-live2d-y'), '40px');
input(page.window, 'components.live2dAudience.holdMs', 2200);
assert.equal(page.window.CreatorQAControls.getState().components.live2dAudience.holdMs, 2200);
assert.notEqual(page.window.CreatorQAControls.getState().components.bloubAudience.holdMs, 2200);
page.window.document.querySelector('[data-live2d-preview-state="drop"]').click();
assert.equal(stage.dataset.expression, 'drop');
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

console.log('Local Live2D import: permanent entry, local-only action gate, registration surface, QA panel, and adapter fallback passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
