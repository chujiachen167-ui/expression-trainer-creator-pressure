const assert = require('node:assert/strict');
const { makePage } = require('./qa-dom-helper');

(async () => {
  const page = makePage('v2-ai-audience.html', {
    extraScripts: [
      'live2d-local-validator.js',
      'live2d-local-runtime.js',
      'vendor/bloub/read-yourself-bloub-core.js',
      'bloub-audience-runtime.js',
      'v2-audience-expression.js',
      'v2-audience-stage.js'
    ]
  });
  page.window.requestAnimationFrame = () => 1;
  page.window.cancelAnimationFrame = () => {};
  const runtime = page.window.CreatorLive2DRuntime;
  const expression = page.window.CreatorAudienceExpression;

  assert.equal(runtime.CORE_SRC, 'local-runtime/live2dcubismcore.min.js');
  assert.equal(runtime.FRAMEWORK_SRC, 'local-runtime/live2d-framework-bridge.js');
  assert.equal(runtime.detectWebGL(), false, 'jsdom has no WebGL');

  const mapped = runtime.mapFourStates({
    FileReferences: {
      Expressions: [
        { Name: 'Idle', File: 'idle.exp3.json' },
        { Name: 'Smile', File: 'smile.exp3.json' },
        { Name: 'Confused', File: 'confused.exp3.json' }
      ]
    }
  }, {
    Idle: { Parameters: [] },
    Smile: { Parameters: [{ Id: 'ParamMouth', Value: 1, Blend: 'Add' }] },
    Confused: { Parameters: [{ Id: 'ParamBrow', Value: -0.4, Blend: 'Add' }] }
  });
  assert.equal(mapped.listen.name, 'Idle');
  assert.equal(mapped.interest.name, 'Smile');
  assert.equal(mapped.confused.name, 'Confused');
  assert.equal(mapped.drop.fallback, true, 'missing drop expression degrades safely');
  assert.equal(mapped.listen.motionGroup, null);

  const tile = page.window.document.createElement('div');
  tile.className = 'audience-tile';
  tile.innerHTML = '<div class="avatar">测</div>';
  page.window.document.body.append(tile);
  const stage = page.window.CreatorAudienceStage.mount(tile);
  assert.ok(stage.querySelector('.v2-audience-face'), 'SVG presenter must exist before adapter boot');

  const missingGl = runtime.createAdapter({ id: 'local-missing-gl', modelFile: 'hero.model3.json' });
  page.window.CreatorAudienceStage.attachAdapter(stage, missingGl);
  await missingGl.ready;
  assert.equal(missingGl.status, 'webgl-unavailable');
  assert.equal(stage.dataset.presentation, 'bloub');
  assert.equal(stage.dataset.adapterStatus, 'webgl-unavailable');
  assert.ok(stage.querySelector('.v2-audience-face'));
  assert.ok(stage.querySelector('.v2-audience-bloub'), 'WebGL failure restores the accepted bloub audience');
  assert.equal(stage.querySelector('.v2-audience-pixel'), null, 'failed boot must not leave a blank canvas');

  page.window.CreatorAudienceStage.detachAdapter(stage);

  const loadFailed = runtime.createAdapter({ id: 'local-load-fail', modelFile: 'hero.model3.json' }, {
    detectWebGL: () => true,
    loadCore: async () => ({ Moc: { fromArrayBuffer() { return {}; } }, Model: { fromMoc() { return { drawables: { count: 0 } }; } } }),
    loadFramework: async () => ({ createPresenter() {} }),
    loadAssets: async () => { throw new Error('模型贴图加载失败。'); }
  });
  page.window.CreatorAudienceStage.attachAdapter(stage, loadFailed);
  await loadFailed.ready;
  assert.equal(loadFailed.status, 'model-load-failed');
  assert.equal(stage.dataset.presentation, 'bloub');
  assert.equal(stage.querySelector('.v2-audience-pixel'), null);

  page.window.CreatorAudienceStage.detachAdapter(stage);

  const missingCore = runtime.createAdapter({ id: 'local-missing-core', modelFile: 'hero.model3.json' }, {
    detectWebGL: () => true,
    loadCore: async () => null,
    loadAssets: async () => ({ mocBytes: new Uint8Array([1]), textures: [{}], mapping: mapped })
  });
  page.window.CreatorAudienceStage.attachAdapter(stage, missingCore);
  await missingCore.ready;
  assert.equal(missingCore.status, 'cubism-core-missing');
  assert.equal(stage.dataset.presentation, 'bloub');

  page.window.CreatorAudienceStage.detachAdapter(stage);

  const missingFramework = runtime.createAdapter({ id: 'local-missing-framework', modelFile: 'hero.model3.json' }, {
    detectWebGL: () => true,
    loadCore: async () => ({ Moc: { fromArrayBuffer() { return {}; } }, Model: { fromMoc() { return {}; } } }),
    loadFramework: async () => null,
    loadAssets: async () => ({ mocBytes: new Uint8Array([1]), textures: [{}], mapping: mapped })
  });
  page.window.CreatorAudienceStage.attachAdapter(stage, missingFramework);
  await missingFramework.ready;
  assert.equal(missingFramework.status, 'cubism-framework-missing');
  assert.equal(stage.dataset.presentation, 'bloub');

  page.window.CreatorAudienceStage.detachAdapter(stage);

  const event = { confidence: 'high', scoreDelta: 4, type: 'opening' };
  assert.equal(expression.expressionFromEvent(event), 'interest');
  const ready = runtime.createAdapter({ id: 'local-ready', name: '测试模型', modelFile: 'hero.model3.json' }, {
    detectWebGL: () => true,
    loadCore: async () => ({ Moc: { fromArrayBuffer() { return {}; } }, Model: { fromMoc() { return { drawables: { count: 0 } }; } } }),
    loadFramework: async () => ({ createPresenter() {}, renderer: 'official-cubism-web-framework' }),
    loadAssets: async () => ({ mocBytes: new Uint8Array([1]), textures: [{}], mapping: mapped }),
    createPresenter: () => ({ setExpression: () => true, destroy() {}, renderer: 'official-cubism-web-framework' })
  });
  page.window.CreatorAudienceStage.attachAdapter(stage, ready);
  await ready.ready;
  assert.equal(ready.status, 'ready');
  assert.equal(ready.renderer, 'official-cubism-web-framework');
  assert.equal(stage.dataset.presentation, 'adapter');
  assert.equal(stage.querySelector('.v2-audience-pixel') instanceof page.window.HTMLCanvasElement, true);
  assert.ok(stage.querySelector('.v2-audience-face'), 'SVG remains in the DOM for instant recovery');
  assert.equal(page.window.CreatorAudienceStage.applyEvent(tile, event), 'interest');
  assert.equal(stage.dataset.expression, 'interest');
  assert.equal(expression.expressionFromEvent(event), 'interest', 'imported avatar must not change judgment mapping');

  page.window.CreatorAudienceStage.setExpression(stage, 'drop');
  assert.equal(stage.dataset.expression, 'drop');
  assert.equal(stage.dataset.presentation, 'adapter');

  const liveCanvas = stage.querySelector('.v2-audience-pixel');
  liveCanvas.dispatchEvent(new page.window.Event('webglcontextlost', { cancelable: true }));
  assert.equal(ready.status, 'webgl-unavailable');
  assert.equal(stage.dataset.presentation, 'bloub', 'context loss must immediately restore bloub');
  assert.equal(stage.querySelector('.v2-audience-pixel'), null, 'lost WebGL canvas must be removed');
  assert.equal(stage.querySelectorAll('.v2-audience-bloub').length, 1);

  page.window.CreatorAudienceStage.detachAdapter(stage);
  assert.equal(stage.dataset.presentation, 'bloub');
  assert.equal(stage.querySelector('.v2-audience-pixel'), null);
  page.window.close();

  console.log('Local Live2D runtime: official-framework gate, recovery, four-state mapping, and judgment isolation passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
