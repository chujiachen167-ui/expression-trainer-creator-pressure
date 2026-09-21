const assert = require('node:assert/strict');
const { makePage, read } = require('./qa-dom-helper');

const page = makePage('index.html');
const { window } = page;
const animations = [];
window.Element.prototype.animate = function (keyframes, options) {
  animations.push({ node: this, keyframes, options });
  return { finished: new Promise(() => {}), cancel() {} };
};
window.requestAnimationFrame = callback => { callback(); return 1; };
window.eval(read('launcher-scroll-expand.js'));
window.CreatorQAControls = { getState: () => ({ components: { scrollExpand: { duration: 1400, handoffDuration: 1400 } } }) };

const card = window.document.querySelector('.version-card[data-version]');
assert(card, 'launcher must expose a version card');
card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
assert(window.document.querySelector('.scroll-expand-transition'), 'launch creates the departure overlay');
assert(window.document.documentElement.classList.contains('is-page-transitioning'));
assert.equal(window.document.querySelectorAll('.scroll-expand-transition').length, 1, 'one click creates one transition layer');
assert.equal(window.document.querySelector('.scroll-expand-transition h2'), null, 'transition layer has no duplicate card heading');
assert.equal(window.document.querySelector('.scroll-expand-transition__label')?.textContent, '镜头表达训练', 'transition layer shows one selected mode label');
assert.equal(window.document.querySelector('.scroll-expand-transition__card'), null, 'text-bearing card is never cloned for scaling');
assert.equal(card.style.transform, '', 'source card is not transformed');
assert.equal(window.getComputedStyle(card.querySelector('h2')).visibility, 'hidden', 'source title is hidden before the transition label can overlap it');
assert.equal(window.document.querySelectorAll('.version-card h2').length, 3, 'launcher keeps one title per source card');
assert(animations.some(({ node }) => node === card.querySelector('h2')), 'source heading fades instead of being copied');
assert(animations.every(({ keyframes }) => !JSON.stringify(keyframes).includes('scale(')), 'no transition animation scales text');
assert(animations.every(({ keyframes }) => !JSON.stringify(keyframes).includes('transform')), 'transition animations do not transform text-bearing nodes');
assert.equal(animations.find(({ node }) => node.className === 'scroll-expand-transition__frame')?.options.duration, 500, 'full transition is capped at 500ms');
assert.equal(animations.find(({ node }) => node === card.querySelector('h2'))?.options.duration, 300, 'source feedback is capped at 300ms');

card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
assert.equal(window.document.querySelectorAll('.scroll-expand-transition').length, 1, 'rapid repeat click does not add another transition');

window.dispatchEvent(new window.Event('pagehide'));
assert.equal(window.document.querySelector('.scroll-expand-transition'), null, 'cached departure must not retain a top-layer overlay');
assert.equal(window.document.documentElement.classList.contains('is-page-transitioning'), false, 'cached departure must release launcher pointer blocking');

window.sessionStorage.setItem('expression-trainer.scroll-expand.entry', JSON.stringify({ mode: 'v2', at: Date.now() }));
const restored = new window.Event('pageshow');
Object.defineProperty(restored, 'persisted', { value: true });
window.dispatchEvent(restored);
assert.equal(window.sessionStorage.getItem('expression-trainer.scroll-expand.entry'), null, 'restored launcher discards a stale target-page handoff');

card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
assert.equal(window.document.querySelectorAll('.scroll-expand-transition').length, 1, 'cleanup releases the launcher for a later click');
window.dispatchEvent(new window.Event('pagehide'));
assert.equal(window.document.querySelector('.scroll-expand-transition'), null, 'second departure is also cleared on pagehide');
page.window.close();

const arrivalPage = makePage('v2-ai-audience.html');
const arrivalWindow = arrivalPage.window;
let arrivalTimeout;
let arrivalTimerCleared = false;
arrivalWindow.setTimeout = (callback, delay) => { arrivalTimeout = { callback, delay }; return 17; };
arrivalWindow.clearTimeout = id => { arrivalTimerCleared = id === 17; };
arrivalWindow.requestAnimationFrame = callback => { callback(); return 1; };
arrivalWindow.sessionStorage.setItem('expression-trainer.scroll-expand.entry', JSON.stringify({ mode: 'v2', direction: 'left', at: Date.now() }));
arrivalWindow.document.documentElement.classList.add('scroll-expand-entry-pending');
arrivalWindow.document.documentElement.dataset.scrollExpandMode = 'v2';
arrivalWindow.document.documentElement.dataset.scrollExpandDirection = 'left';
arrivalWindow.eval(read('launcher-scroll-expand.js'));
assert(arrivalWindow.document.documentElement.classList.contains('scroll-expand-entry-pending'), 'target page installs the arrival cover');
arrivalWindow.dispatchEvent(new arrivalWindow.Event('pagehide'));
assert.equal(arrivalTimerCleared, true, 'target page clears the arrival timer on pagehide');
assert.equal(arrivalWindow.document.documentElement.classList.contains('scroll-expand-entry-pending'), false, 'target page clears the arrival cover on pagehide');
arrivalWindow.document.documentElement.classList.add('scroll-expand-entry-pending');
const targetRestored = new arrivalWindow.Event('pageshow');
Object.defineProperty(targetRestored, 'persisted', { value: true });
arrivalWindow.dispatchEvent(targetRestored);
assert.equal(arrivalWindow.document.documentElement.classList.contains('scroll-expand-entry-pending'), false, 'bfcache target restore clears the arrival cover');
assert.equal(typeof arrivalTimeout.callback, 'function', 'arrival cleanup test captured the scheduled cleanup');
arrivalPage.window.close();
console.log('Scroll expand lifecycle: pagehide and bfcache restore clear the stuck launcher overlay.');
