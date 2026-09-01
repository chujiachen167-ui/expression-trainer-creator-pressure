const assert = require('node:assert/strict');
const { read, makePage, input } = require('./qa-dom-helper');

const launcher = read('index.html');
const effects = read('launcher-text-effects.js');
const styles = read('shared.css');
const controls = read('control-panel.js');

assert.match(launcher, /data-true-focus/, 'launcher should expose the editable True Focus title target');
assert.match(launcher, /data-warp-text/, 'launcher should expose the editable Warp Text subtitle target');
assert.match(launcher, /creator-gooey-text/, 'launcher should define a local gooey SVG filter');
assert.match(launcher, /launcher-text-effects\.js/, 'launcher should load the native text-effect adapter');
assert.match(effects, /webgl2/, 'Warp Text should progressively use a WebGL2 visual layer');
assert.match(effects, /MutationObserver/, 'title and subtitle copy changes should refresh the visual layer');
assert.match(effects, /creator:locale-change/, 'locale changes should remount the title and subtitle visual layers');
assert.match(styles, /data-problem-style="box"/, 'problem words should support the dashed-box treatment');
assert.match(controls, /data-qa-tab="text-effects"/, 'text effects should have a dedicated QA page');
assert.match(controls, /components\.trueFocus\.blurAmount/, 'True Focus parameters should be editable');
assert.match(controls, /components\.warpText\.pointerStrength/, 'Warp Text parameters should be editable');

const dom = makePage('index.html', {
  extraScripts: ['vendor/magic-ui/marquee.js', 'launcher-transcript.js', 'launcher-text-effects.js']
});
const { window } = dom;
const doc = window.document;
const title = doc.querySelector('[data-true-focus]');
const source = doc.querySelector('[data-true-focus-source]');
assert.equal(source.textContent, 'Read Yourself');
assert.equal(doc.querySelectorAll('.true-focus-word').length, 2, 'True Focus should split the brand title into interactive words');
assert(doc.querySelector('.true-focus-frame'));

doc.querySelector('[data-qa-tab="text-effects"]').click();
assert.equal(doc.querySelector('.qa-page:not([hidden])').dataset.qaPage, 'text-effects');
input(window, 'components.trueFocus.enabled', false);
assert.equal(doc.querySelector('.true-focus-overlay').hidden, true);
assert.equal(title.classList.contains('true-focus-ready'), false);
input(window, 'components.trueFocus.enabled', true);
assert.equal(doc.querySelector('.true-focus-overlay').hidden, false);
input(window, 'components.trueFocus.blurAmount', 7);
assert.equal(doc.querySelector('.true-focus-overlay').style.getPropertyValue('--true-focus-blur'), '7px');

doc.querySelector('[data-qa-tab="copy"]').click();
const titleField = doc.querySelector('[data-copy-key="launcher.h1.1"]');
assert(titleField, 'the original launcher title copy key should remain editable');
titleField.value = 'Read Yourself Now';
titleField.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(source.textContent, 'Read Yourself Now');
assert.equal(doc.querySelectorAll('.true-focus-word').length, 3);

assert(doc.querySelector('.true-focus-overlay').hasAttribute('data-qa-copy-ignore'), 'generated title words must not enter the copy library');

// Exercise the actual delegated handlers against the repeated DOM, using a
// controlled animation clock. This verifies completion/reversal, not pixels.
let frameId = 0;
let clock = window.performance.now();
const frames = new Map();
window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
window.cancelAnimationFrame = id => frames.delete(id);
function advance(count = 60) {
  for (let i = 0; i < count; i++) {
    clock = Math.max(clock + 16, window.performance.now() + 16);
    const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(clock));
  }
}
const pair = doc.querySelectorAll('.magic-marquee-group')[1].querySelector('.transcript-pair');
assert(!pair.closest('.magic-marquee-group').inert, 'visible duplicate groups must accept pointer interaction');
assert.equal(pair.tabIndex, -1, 'duplicates must not add repeated keyboard stops');
const layers = pair.querySelector('.transcript-swap-layers');
const raw = pair.querySelector('.transcript-raw');
const clean = pair.querySelector('.transcript-clean');
pair.dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true }));
advance(12);
assert.equal(pair.dataset.swapState, 'transition');
assert(Number(clean.style.opacity) > 0 && Number(clean.style.opacity) < 1);
assert.notEqual(layers.style.filter, 'none', 'liquid filter should operate during a hover transition');
pair.dispatchEvent(new window.MouseEvent('pointerout', { bubbles: true }));
advance();
assert.equal(pair.dataset.swapState, 'raw', 'leaving mid-animation must reverse completely');
assert.equal(raw.style.opacity, '1');
assert.equal(clean.style.opacity, '0');
assert.equal(layers.style.filter, 'none', 'restored raw text must not retain the filter');
pair.dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true }));
advance();
assert.equal(pair.dataset.swapState, 'clean');
assert.equal(raw.style.opacity, '0');
assert.equal(clean.style.opacity, '1');
assert.equal(layers.style.filter, 'none', 'optimized text must be fully legible after the animation');
assert.equal(pair.getAttribute('aria-pressed'), 'true');
assert(pair.getAttribute('aria-label').includes(clean.textContent));
pair.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
assert.equal(pair.dataset.swapState, 'raw', 'keyboard activation must not wait for the animation');

input(window, 'components.transcriptCover.highlightStyle', 'box');
assert([...doc.querySelectorAll('.transcript-raw mark')].every(node => node.dataset.problemStyle === 'box'));
// Controlled draws prove all three choices are reachable and independent of
// phrase text. Never assert a lucky distribution from genuine random output.
let draw = 0;
window.Math.random = () => [0.01, 0.4, 0.99][draw++ % 3];
input(window, 'components.transcriptCover.highlightStyle', 'random');
assert.deepEqual([...doc.querySelectorAll('.transcript-raw mark')].slice(0, 3).map(node => node.dataset.problemStyle), ['underline', 'highlight', 'box']);
const marksBefore = [...doc.querySelectorAll('.transcript-raw mark')].map(node => node.dataset.problemStyle);
input(window, 'components.transcriptCover.rawColor', '#123456');
assert.deepEqual([...doc.querySelectorAll('.transcript-raw mark')].map(node => node.dataset.problemStyle), marksBefore, 'unrelated color edits must not flicker/randomize the text again');
input(window, 'components.transcriptCover.gooeyBlur', 0);
assert.equal(doc.querySelector('[data-transcript-cover]').style.getPropertyValue('--transcript-gooey-blur'), '0px');
dom.setReducedMotion(true);
pair.dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true }));
assert.equal(clean.style.opacity, '1', 'reduced motion must still reveal the optimized sentence');
assert.equal(layers.style.filter, 'none');
assert(!doc.querySelector('.warp-text-canvas'), 'reduced motion should use readable semantic subtitle text, not duplicate canvas text');

window.close();
console.log('Text effects: repeated-item hover, completed reveal, interrupted reversal, keyboard/reduced-motion fallback, independent marker draws, live style changes and editable title passed. WebGL pixels require browser verification.');
