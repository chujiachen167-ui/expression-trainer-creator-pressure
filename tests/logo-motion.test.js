const assert = require('node:assert/strict');
const { makePage, input, read } = require('./qa-dom-helper');
const plain = value => JSON.parse(JSON.stringify(value));

async function run() {
  const dom = makePage('index.html');
  const w = dom.window, d = w.document;
  const small = d.querySelector('[data-brand-logo]');
  const smallBefore = small.outerHTML;
  const frames = new Map(); let serial = 0, now = 0, intersection;
  w.requestAnimationFrame = fn => { frames.set(++serial, fn); return serial; };
  w.cancelAnimationFrame = id => frames.delete(id);
  w.Image = class { set src(value) { this.url = value; queueMicrotask(() => this.onload()); } };
  w.IntersectionObserver = class { constructor(fn) { intersection = fn; } observe() {} };
  const originalRect = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('data-logo-art')) return { left: 30, top: 20, width: 570, height: 360, right: 600, bottom: 380 };
    return originalRect.call(this);
  };
  w.eval(read('launcher-logo-motion.js'));
  await new Promise(resolve => setImmediate(resolve));
  const root = d.querySelector('[data-brand-background]');
  const camera = d.querySelector('[data-logo-camera]'), lens = d.querySelector('[data-logo-lens]');
  const count = d.querySelectorAll('[data-logo-art]').length;
  w.eval(read('launcher-logo-motion.js'));
  assert.equal(d.querySelectorAll('[data-logo-art]').length, count, 'reinitialization must not duplicate art or handlers');
  function advance(amount = 120) {
    for (let i = 0; i < amount; i++) {
      now += 16.667;
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(fn => fn(now));
    }
  }
  function move(x, y, type = 'mouse', target = d.querySelector('[data-version="v3"]')) {
    const event = new w.MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerType', { value: type });
    target.dispatchEvent(event);
  }
  const cameraPose = () => {
    const translate = camera.style.transform.match(/translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\)/);
    const scale = camera.style.transform.match(/scale\(([\d.]+)\)/);
    return { x: Number(translate?.[1] || 0), y: Number(translate?.[2] || 0), scale: Number(scale?.[1] || 1) };
  };
  const lensOffset = () => [...lens.style.transform.matchAll(/(-?[\d.]+)px/g)].map(match => Number(match[1]));

  assert(root.hasAttribute('data-motion-ready'));
  assert.equal(d.querySelectorAll('[data-logo-outline]').length, 1, 'the approved outer lip silhouette remains one fixed layer');
  assert.equal(d.querySelectorAll('[data-logo-lid]').length, 2, 'blink has two inner-edge morph surfaces');
  assert.equal(d.querySelectorAll('[data-logo-lip]').length, 0, 'whole lip layers are never translated or crossed');
  advance();
  assert.equal(cameraPose().scale, .8, 'camera starts at its configured resting scale before the first pointer input');
  move(1000, 700); advance();
  let pose = cameraPose();
  assert(pose.x > 0 && pose.y > 0, 'pointer on far-right page moves the pupil-camera inside the eye');
  assert.equal(camera.style.transform.includes('rotate'), false, 'camera stays front-facing instead of tilting');
  assert.equal(pose.scale, w.CreatorLogoConfig.backgroundDefaults.cameraScale);
  assert.deepEqual(lensOffset(), [0, 0], 'whole camera mode keeps rings concentric');
  assert.equal(frames.size, 0, 'settled pose stops requesting frames');
  move(0, 0); advance(1);
  assert(frames.size > 0, 'new direction interrupts and resumes immediately');
  advance(); pose = cameraPose();
  assert(pose.x < 0 && pose.y < 0);
  assert.equal(small.outerHTML, smallBefore, 'small Logo never participates');

  input(w, 'components.logoBackground.motionMode', 'lens');
  assert(d.querySelector('[data-logo-motion-options="camera"]').hidden);
  assert(!d.querySelector('[data-logo-motion-options="lens"]').hidden);
  move(1000, 700); advance(); pose = cameraPose();
  assert.equal(pose.x, 0); assert.equal(pose.y, 0); assert.equal(pose.scale, 1, 'camera body returns to original pose in lens mode');
  assert(lensOffset()[0] > 0 && lensOffset()[1] > 0);
  input(w, 'components.logoBackground.lensTravel', 18);
  move(100000, 100000); advance();
  assert(Math.hypot(...lensOffset()) <= 18.002, 'diagonal lens travel is radially bounded');
  input(w, 'components.logoBackground.motionMode', 'combined');
  assert(!d.querySelector('[data-logo-motion-options="camera"]').hidden);
  assert(!d.querySelector('[data-logo-motion-options="lens"]').hidden);
  move(1000, 700); advance(); pose = cameraPose();
  assert(pose.x > 0 && pose.y > 0, 'combined mode moves the full camera');
  assert(lensOffset()[0] > 0 && lensOffset()[1] > 0, 'combined mode also moves the inner lens');
  input(w, 'components.logoBackground.motionMode', 'lens');
  d.documentElement.dispatchEvent(new w.Event('pointerleave')); advance();
  assert.deepEqual(lensOffset(), [0, 0], 'leaving the window smoothly returns to center');
  move(1000, 700, 'touch'); advance(); assert.deepEqual(lensOffset(), [0, 0], 'touch scroll is not tracked');
  move(1000, 700); advance(); w.dispatchEvent(new w.Event('blur')); advance();
  assert.deepEqual(lensOffset(), [0, 0]);

  input(w, 'components.logoBackground.blinkDuration', 100);
  d.querySelector('[data-qa-logo-blink-preview]').click();
  assert(root.hasAttribute('data-blinking'), 'preview button starts a blink immediately');
  assert.equal(root.style.getPropertyValue('--logo-blink-duration'), '100ms');
  advance(4);
  const topClosed = d.querySelector('[data-logo-lid="top"]').getAttribute('d');
  const bottomClosed = d.querySelector('[data-logo-lid="bottom"]').getAttribute('d');
  assert(topClosed.includes('C1020 625.000 915 625.000 800 625.000'), 'upper inner edge flattens onto the shared seam');
  assert(bottomClosed.includes('C1020 625.000 915 625.000 800 625.000'), 'lower inner edge meets the same seam without crossing it');
  assert.equal(d.querySelector('[data-logo-outline]').style.transform, '', 'outer curvature stays fixed throughout the blink');
  advance(8);
  assert(!root.hasAttribute('data-blinking'), 'blink completes and returns to an open eye');

  dom.setReducedMotion(true); move(1000, 700); advance();
  d.querySelector('[data-qa-logo-blink-preview]').click();
  assert(!root.hasAttribute('data-motion-ready'));
  assert(!root.hasAttribute('data-blinking'));
  assert.equal(frames.size, 0);
  assert.equal(root.dataset.motionState, 'reduced');
  dom.setReducedMotion(false);
  intersection([{ isIntersecting: false }]); move(1000, 700); advance();
  d.querySelector('[data-qa-logo-blink-preview]').click();
  assert.equal(frames.size, 0);
  assert(!root.hasAttribute('data-blinking'), 'offscreen logo pauses both tracking and blinking');
  intersection([{ isIntersecting: true }]); move(1000, 700); advance(); assert(lensOffset()[0] > 0);
  w.dispatchEvent(new w.Event('pagehide')); move(1000, 700); advance(); assert.equal(frames.size, 0);
  w.dispatchEvent(new w.Event('pageshow')); move(1000, 700); advance(); assert(lensOffset()[0] > 0);

  input(w, 'components.logoBackground.motionMode', 'off');
  assert(root.hasAttribute('data-motion-ready'), 'blink-only mode keeps the separated art available');
  assert.equal(root.dataset.motionState, 'blink-only');
  move(1000, 700); advance(); assert.equal(frames.size, 0);
  input(w, 'components.logoBackground.blinkEnabled', false);
  assert(!root.hasAttribute('data-motion-ready'), 'disabling both tracking and blink restores the static original');
  input(w, 'components.logoBackground.blinkEnabled', true);
  input(w, 'components.logoBackground.motionMode', 'camera');
  input(w, 'components.logoBackground.cameraTravel', 80);
  input(w, 'components.logoBackground.cameraVerticalRatio', 1);
  input(w, 'components.logoBackground.cameraScale', 0.86);
  move(100000, 100000); advance(); pose = cameraPose();
  assert(Math.abs(pose.x) <= 40.002, 'CSS displacement scales source coordinates to rendered width');
  assert(Math.abs(pose.y) <= (170 - 164 * 0.86) * .5 + .002, 'vertical movement stays inside the lower eyelid');
  input(w, 'components.logoBackground.enabled', false); move(500, 500); advance(); assert.equal(frames.size, 0);
  input(w, 'components.logoBackground.enabled', true);
  input(w, 'components.logoBackground.opacity', 0); move(500, 500); advance(); assert.equal(frames.size, 0);

  const settingsBeforeReset = plain(w.CreatorQAControls.getState());
  d.querySelector('[data-qa-logo-motion-reset]').click();
  const afterReset = plain(w.CreatorQAControls.getState());
  const motionKeys = ['motionMode', 'motionResponse', 'cameraTravel', 'cameraVerticalRatio', 'cameraScale', 'lensTravel', 'blinkEnabled', 'blinkMinDelay', 'blinkMaxDelay', 'blinkDuration', 'blinkDepth'];
  for (const key of motionKeys) {
    assert.equal(afterReset.components.logoBackground[key], w.CreatorLogoConfig.backgroundDefaults[key]);
    afterReset.components.logoBackground[key] = settingsBeforeReset.components.logoBackground[key];
  }
  assert.deepEqual(afterReset, settingsBeforeReset, 'motion reset preserves all colors, layout and small Logo choices');
  const normalized = plain(w.CreatorLogoConfig.normalizeBackground({ motionMode: 'bad', motionResponse: 0, cameraTilt: 20, cameraTravel: 999, cameraVerticalRatio: 9, cameraScale: 0, lensTravel: -1, blinkMinDelay: 12, blinkMaxDelay: 2, blinkDuration: 999, blinkDepth: 0 }));
  assert.equal(normalized.motionMode, 'camera'); assert.equal(normalized.motionResponse, 60);
  assert.equal(normalized.cameraTravel, 80); assert.equal(normalized.cameraVerticalRatio, 1); assert.equal(normalized.cameraScale, .72); assert.equal(normalized.lensTravel, 0);
  assert.equal(normalized.blinkMaxDelay, 12); assert.equal(normalized.blinkDuration, 600); assert.equal(normalized.blinkDepth, .35);
  assert(!('cameraTilt' in normalized), 'obsolete camera tilt is removed during migration');
  assert.equal(w.CreatorLogoConfig.normalizeBackground({ motionMode: 'combined' }).motionMode, 'combined');

  input(w, 'components.logoBackground.motionMode', 'combined');
  input(w, 'components.logoBackground.motionResponse', 240);
  input(w, 'components.logoBackground.lensTravel', 17);
  input(w, 'components.logoBackground.blinkMinDelay', 6);
  let serialized;
  w.api = { saveProjectConfig: async value => { serialized = value; return { success: true }; } };
  d.querySelector('[data-qa-save-project]').click(); await new Promise(resolve => setImmediate(resolve));
  const saved = JSON.parse(serialized.match(/window\.CreatorProjectConfig\s*=\s*([\s\S]*);\s*$/)[1]);
  assert.deepEqual(saved.config, plain(w.CreatorQAControls.getState()));
  const fresh = makePage('index.html', { project: saved.config });
  assert.equal(fresh.window.document.querySelector('[data-path="components.logoBackground.motionMode"]').value, 'combined');
  assert.equal(fresh.window.document.querySelector('[data-path="components.logoBackground.lensTravel"]').value, '17');
  assert.equal(fresh.window.document.querySelector('[data-path="components.logoBackground.blinkMinDelay"]').value, '6');
  fresh.window.close();
  const ids = [...d.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length, 'independent mask/filter IDs');
  assert.equal(dom.qaErrors.length, 0);
  w.close();
  for (const page of ['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
    assert(!read(page).includes('launcher-logo-motion.js'), 'training screens must not install pointer tracking');
  }
  console.log('Logo motion: fixed resting scale, camera/lens/combined modes, fixed outer silhouette with flat-seam inner-edge blink, reduced/offscreen suspension, isolated reset, save/reload and training-page isolation passed (DOM).');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
