const assert = require('node:assert/strict');
const { makePage, read } = require('./qa-dom-helper');

const page = makePage('index.html', { reducedMotion: true });
const { window } = page;
window.Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
window.requestAnimationFrame = callback => { callback(); return 1; };
window.eval(read('launcher-scroll-expand.js'));
const card = window.document.querySelector('.version-card[data-version="v2"]');
card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
assert.equal(window.document.querySelector('.scroll-expand-transition'), null, 'reduced motion keeps the transition layer disabled');
assert.equal(window.document.documentElement.classList.contains('is-page-transitioning'), false, 'reduced motion does not lock the launcher');
page.window.close();
console.log('Scroll expand reduced-motion transition: instant navigation path passed.');
