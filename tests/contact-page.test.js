const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { read, root, makePage } = require('./qa-dom-helper');

const launcher = read('index.html');
const contact = read('contact.html');
const styles = read('contact-carousel.css');
const shared = read('shared.css');

assert.match(launcher, /href="contact\.html"[^>]*data-qa-copy-key="launcher\.shell\.footer\.feedback"/,
  'launcher feedback link opens the dedicated contact page');
assert.match(contact, /data-page-key="contact"/, 'contact page keeps an independent QA copy namespace');
for (const asset of ['assets/contact/wechat-donglai.png', 'assets/contact/douyin-97521168595.png', 'assets/contact/contact-qr-blue.jpg']) {
  assert.equal(fs.existsSync(path.join(root, asset)), true, `contact asset exists: ${asset}`);
}
assert.match(styles, /\.contact-card-media\s*\{[^}]*aspect-ratio:\s*2\s*\/\s*3/s, 'contact media uses a consistent 2:3 frame');
assert.match(styles, /\.contact-card-media img\s*\{[^}]*object-fit:\s*contain/s, 'contact media remains fully visible and scannable');
assert.doesNotMatch(contact, /联系卡片\s*0?[123]/, 'contact page does not expose numbered card labels');
assert.match(contact, /Telegram 联系入口/, 'third contact image is identified as Telegram');
assert.match(shared, /\.version-card:not\(\.featured\)\s*\{[^}]*background:\s*linear-gradient/s, 'secondary cards use the same gradient treatment as V1');

const dom = makePage('contact.html', { extraScripts: ['contact-carousel.js'] });
const { window } = dom;
const carousel = window.document.querySelector('[data-depth-carousel]');
const slides = [...window.document.querySelectorAll('[data-carousel-slide]')];
assert.equal(slides.length, 3, 'contact carousel renders all three cards');
assert.equal(slides.filter(slide => slide.dataset.position === '0').length, 1, 'carousel has one active card');
assert.equal(window.document.querySelector('[data-carousel-counter]').textContent, '01 / 03');
window.document.querySelector('[data-carousel-next]').click();
assert.equal(window.document.querySelector('[data-carousel-counter]').textContent, '02 / 03');
assert.equal(slides.filter(slide => slide.dataset.position === '0').length, 1, 'next keeps one active card');
carousel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
assert.equal(window.document.querySelector('[data-carousel-counter]').textContent, '01 / 03', 'keyboard navigation returns to the previous card');
assert.equal(window.document.querySelector('.qa-trigger') !== null, true, 'contact page keeps local settings access');
assert.equal(dom.qaErrors.length, 0, `contact page emitted no jsdom errors: ${dom.qaErrors.map(error => error.message).join('; ')}`);
dom.window.close();

console.log('Contact page: dedicated route, unified media frames, gradient cards and depth carousel passed (DOM).');
