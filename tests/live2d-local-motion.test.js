const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makePage } = require('./qa-dom-helper');

function encode(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}

function installRaf(window) {
  const callbacks = new Map();
  let nextId = 1;
  window.requestAnimationFrame = cb => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = id => { callbacks.delete(id); };
  return {
    pending: () => callbacks.size,
    flush(stamp = 16) {
      const queued = [...callbacks.entries()];
      callbacks.clear();
      queued.forEach(([, cb]) => cb(stamp));
    }
  };
}

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
  const { window } = page;
  const raf = installRaf(window);
  const runtime = window.CreatorLive2DRuntime;

  const linearMotion = {
    Meta: { Duration: 2, Loop: true, Fps: 30 },
    Curves: [{ Target: 'Parameter', Id: 'ParamAngleY', Segments: [0, 0, 0, 1, 10, 0, 2, 0] }]
  };
  assert.equal(runtime.evaluateMotion(linearMotion, 0).values.ParamAngleY, 0);
  assert.equal(runtime.evaluateMotion(linearMotion, 1).values.ParamAngleY, 10);
  assert.equal(runtime.evaluateMotion(linearMotion, 0.5).values.ParamAngleY, 5);
  assert.equal(runtime.evaluateMotion(linearMotion, 2).values.ParamAngleY, 0, 'looping idle wraps to the start');
  const first = runtime.evaluateMotion(linearMotion, 0.25);
  const second = runtime.evaluateMotion(linearMotion, 0.8);
  assert.notEqual(first.values.ParamAngleY, second.values.ParamAngleY, 'time advancement must change motion parameters');

  const hiyoriMotions = {
    Idle: [{ file: 'motions/Hiyori_m01.motion3.json', json: linearMotion }],
    TapBody: [{ file: 'motions/Hiyori_m04.motion3.json', json: { Meta: { Duration: 1, Loop: false }, Curves: [{ Target: 'Parameter', Id: 'ParamBodyAngleZ', Segments: [0, 0, 0, 1, 12] }] } }]
  };
  const hiyoriPath = path.join(__dirname, '../local-runtime/Resources/Hiyori/Hiyori.model3.json');
  const hiyoriManifest = fs.existsSync(hiyoriPath)
    ? JSON.parse(fs.readFileSync(hiyoriPath, 'utf8'))
    : { FileReferences: { Motions: { Idle: [], TapBody: [] } }, Groups: [{ Name: 'EyeBlink', Ids: ['ParamEyeLOpen', 'ParamEyeROpen'] }, { Name: 'LipSync', Ids: ['ParamMouthOpenY'] }] };
  const mapped = runtime.mapFourStates(hiyoriManifest, {}, hiyoriMotions);
  assert.equal(mapped.listen.motionGroup, 'Idle');
  assert.equal(mapped.confused.motionGroup, 'TapBody');
  assert.equal(mapped.interest.fallback, true);
  assert.equal(mapped.drop.fallback, true);
  assert.deepEqual(runtime.mapGroups(hiyoriManifest).EyeBlink.slice(0, 2), ['ParamEyeLOpen', 'ParamEyeROpen']);
  assert.equal(runtime.mapGroups(hiyoriManifest).LipSync.includes('ParamMouthOpenY'), true);

  const director = runtime.createLive2DDirector({
    manifest: hiyoriManifest,
    motions: hiyoriMotions,
    mapping: mapped,
    groups: runtime.mapGroups(hiyoriManifest)
  });
  const idleA = director.tick(0);
  const idleB = director.tick(0.4);
  assert.equal(idleA.state, 'listen');
  assert.notEqual(idleA.values.ParamAngleY, idleB.values.ParamAngleY, 'idle motion must change between frames');
  assert.equal(idleB.lipSyncDriven, false, 'B mode must not drive LipSync as speech');

  const confused = director.setExpression('confused');
  const confusedSnap = director.tick(0);
  const interest = director.setExpression('interest');
  const interestSnap = director.tick(0);
  const drop = director.setExpression('drop');
  const dropSnap = director.tick(0);
  assert.equal(confused.interrupted, false);
  assert.equal(interest.interrupted, true, 'a new reaction must interrupt the previous one');
  assert.equal(drop.motionFile, null);
  assert.equal(confusedSnap.motionFile, 'motions/Hiyori_m04.motion3.json');
  assert.notEqual(confusedSnap.fingerprint, interestSnap.fingerprint);
  assert.notEqual(interestSnap.fingerprint, dropSnap.fingerprint);
  assert.notEqual(dropSnap.fingerprint, confusedSnap.fingerprint);
  director.setExpression('listen');
  assert.equal(director.tick(0).state, 'listen');

  const reduced = runtime.createLive2DDirector({
    manifest: hiyoriManifest,
    motions: hiyoriMotions,
    mapping: mapped,
    groups: runtime.mapGroups(hiyoriManifest)
  }, { reducedMotion: true });
  const reducedIdleA = reduced.tick(0.3);
  const reducedIdleB = reduced.tick(0.3);
  assert.equal(reducedIdleA.values.ParamAngleY, undefined, 'reduced motion must not loop idle travel');
  assert.equal(reducedIdleB.values.ParamAngleY, undefined);
  reduced.setExpression('drop');
  const reducedDrop = reduced.tick(0);
  assert.equal(reducedDrop.state, 'drop');
  assert.equal(reducedDrop.values.ParamEyeLOpen, runtime.STANDARD_REACTION.drop.ParamEyeLOpen, 'reduced motion still shows a readable reaction');

  window.Image = class {
    set src(value) { queueMicrotask(() => this.onload && this.onload()); }
  };
  window.URL.createObjectURL = () => 'blob:test';
  window.URL.revokeObjectURL = () => {};
  const files = {
    'hero.model3.json': encode({
      Version: 3,
      FileReferences: {
        Moc: 'hero.moc3',
        Textures: ['hero.png'],
        Physics: 'hero.physics3.json',
        Pose: 'hero.pose3.json',
        Motions: { Idle: [{ File: 'idle.motion3.json' }] }
      },
      Groups: [{ Name: 'EyeBlink', Ids: ['ParamEyeLOpen'] }, { Name: 'LipSync', Ids: ['ParamMouthOpenY'] }]
    }),
    'hero.moc3': new Uint8Array([1, 2, 3]),
    'hero.png': new Uint8Array([137, 80, 78, 71]),
    'hero.physics3.json': encode({ Version: 3, Meta: { PhysicsSettingCount: 0 } }),
    'hero.pose3.json': encode({ Type: 'Live2D Pose' }),
    'idle.motion3.json': encode(linearMotion)
  };
  const assets = await runtime.loadModelAssets({ modelFile: 'hero.model3.json' }, async (_record, relative) => {
    if (!files[relative]) throw new Error(`missing ${relative}`);
    return { bytes: files[relative], mime: 'application/octet-stream' };
  });
  assert.equal(Boolean(assets.physicsJson), true);
  assert.equal(Boolean(assets.poseBytes), true);
  assert.equal(assets.motions.Idle[0].file, 'idle.motion3.json');
  assert.equal(assets.groups.EyeBlink[0], 'ParamEyeLOpen');
  assert.equal(assets.mapping.listen.motionGroup, 'Idle');

  const tile = window.document.createElement('div');
  tile.className = 'audience-tile';
  tile.innerHTML = '<div class="avatar">测</div>';
  window.document.body.append(tile);
  const stage = window.CreatorAudienceStage.mount(tile);
  assert.equal(stage.dataset.presentation, 'bloub');

  let hidden = false;
  Object.defineProperty(window.document, 'hidden', { configurable: true, get: () => hidden });
  const draws = [];
  const ready = runtime.createAdapter({ id: 'motion-ready', modelFile: 'hero.model3.json' }, {
    detectWebGL: () => true,
    loadCore: async () => ({ Moc: { fromArrayBuffer() { return {}; } }, Model: { fromMoc() { return { drawables: { count: 0 } }; } } }),
    loadFramework: async () => ({ createPresenter() {}, renderer: 'official-cubism-web-framework' }),
    loadAssets: async () => assets,
    createPresenter: (_canvas, _core, loaded, options) => ({
      setExpression: state => {
        options.director.setExpression(state);
        draws.push({ type: 'expression', state, snapshot: options.director.tick(0) });
        return true;
      },
      tick: dt => {
        const snapshot = options.director.tick(dt);
        draws.push({ type: 'tick', dt, snapshot });
        return snapshot;
      },
      destroy() {},
      renderer: 'official-cubism-web-framework'
    })
  });
  window.CreatorAudienceStage.attachAdapter(stage, ready);
  await ready.ready;
  assert.equal(ready.status, 'ready');
  assert.equal(stage.dataset.presentation, 'adapter');
  assert.equal(ready.loopStats().running, true);
  assert.equal(raf.pending(), 1, 'ready presenter must own a single RAF callback');
  ready.loopStats();
  const startsAtReady = ready.loopStats().starts;
  ready._loop.start();
  assert.equal(ready.loopStats().starts, startsAtReady, 'start must be idempotent');
  assert.equal(raf.pending(), 1);
  raf.flush(16);
  raf.flush(32);
  const moved = draws.filter(item => item.type === 'tick');
  assert.ok(moved.length >= 2, 'RAF must advance more than one animation frame');
  assert.notEqual(moved[0].snapshot.values.ParamAngleY, moved[1].snapshot.values.ParamAngleY);

  const timers = [];
  const realSetTimeout = window.setTimeout;
  const realClear = window.clearTimeout;
  window.setTimeout = (fn, ms) => {
    timers.push({ fn, ms });
    return timers.length;
  };
  window.clearTimeout = id => { if (id) timers[id - 1] = null; };

  assert.equal(window.CreatorAudienceStage.applyEvent(tile, { confidence: 'low', scoreDelta: -2, type: 'specificity' }), 'confused');
  assert.equal(stage.dataset.expression, 'confused');
  const confusedDraw = draws.at(-1).snapshot;
  assert.equal(window.CreatorAudienceStage.applyEvent(tile, { confidence: 'high', scoreDelta: -8, type: 'jargon' }), 'drop');
  assert.equal(stage.dataset.expression, 'drop');
  const dropDraw = draws.at(-1).snapshot;
  assert.notEqual(confusedDraw.fingerprint, dropDraw.fingerprint);
  assert.equal(timers.filter(Boolean).length, 1, 'a new event must replace the previous hold timer');
  timers.filter(Boolean).at(-1).fn();
  assert.equal(stage.dataset.expression, 'listen', 'hold expiry must return to listen');

  hidden = true;
  window.document.dispatchEvent(new window.Event('visibilitychange'));
  assert.equal(ready.loopStats().running, false, 'hidden pages must release the RAF loop');
  assert.equal(raf.pending(), 0);
  hidden = false;
  window.document.dispatchEvent(new window.Event('visibilitychange'));
  assert.equal(ready.loopStats().running, true, 'visible pages must resume a single loop');
  assert.equal(raf.pending(), 1);

  window.CreatorAudienceStage.detachAdapter(stage);
  assert.equal(ready.loopStats().running, false);
  assert.equal(ready.loopStats().id, 0, 'destroy must cancel the presenter animation frame id');
  assert.equal(stage.dataset.presentation, 'bloub');
  assert.equal(stage.querySelector('.v2-audience-pixel'), null);
  assert.equal(stage.querySelectorAll('.v2-audience-bloub').length, 1, 'fallback must restore one bloub, not a double character');

  const missingPhysics = runtime.createLive2DDirector({
    mapping: runtime.mapFourStates({ FileReferences: {} }, {}, {}),
    motions: {},
    groups: { EyeBlink: ['ParamEyeLOpen'], LipSync: ['ParamMouthOpenY'] }
  });
  missingPhysics.setExpression('interest');
  const fallbackInterest = missingPhysics.tick(0.016);
  assert.equal(fallbackInterest.state, 'interest');
  assert.equal(fallbackInterest.physicsJson, false);
  assert.ok(fallbackInterest.values.ParamMouthForm > 0, 'missing motion still uses a readable standard reaction');
  assert.equal(Object.hasOwn(fallbackInterest.values, 'ParamMouthOpenY'), false, 'missing LipSync source must not fake speech');

  window.setTimeout = realSetTimeout;
  window.clearTimeout = realClear;
  page.window.close();
  console.log('Local Live2D motion: time advancement, interruptible reactions, lifecycle, reduced motion, and capability fallback passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
