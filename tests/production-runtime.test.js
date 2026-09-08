const assert = require('node:assert/strict');
const { makePage } = require('./qa-dom-helper');

const project = {
  theme: {
    bg: '#f3eded', panel: '#8ce1e1', panelRaised: '#151823', control: '#0c0e13',
    border: '#252938', borderStrong: '#4c5268', text: '#8690df', muted: '#000000',
    accent: '#ff2f92', info: '#42e8d6', success: '#65e49b', warning: '#ffc85a', danger: '#ff5a70'
  },
  copy: { 'launcher-fusion.document-title': '线上预览' }
};

const production = makePage('index.html', {
  production: true,
  draft: {
    theme: { bg: '#111111' },
    copy: { 'launcher-fusion.document-title': '浏览器草稿' },
    fineTune: { 'launcher-fusion': { 'body > main:nth-of-type(1) > section:nth-of-type(1) > div:nth-of-type(1)': { self: { y: '-80' } } } }
  },
  project
});
const { window } = production;
assert(!window.document.querySelector('.qa-panel'), 'production must not mount the QA panel');
assert(!window.document.querySelector('.qa-trigger'));
assert.equal(window.document.documentElement.style.getPropertyValue('--color-canvas'), '#f3eded');
assert.equal(window.document.title, '线上预览');
const owned = window.document.querySelector('style[data-qa-editor-owned]');
assert(!owned || !owned.textContent.includes('-80px'), 'production preview must ignore local layout drafts');
assert.equal(window.CreatorQAControls.featureEnabled('camera'), true);
window.close();

for (const page of ['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html', 'contact.html']) {
  const view = makePage(page, { production: true, project });
  assert(!view.window.document.querySelector('.qa-panel'), `${page} must hide the QA panel`);
  assert.equal(view.window.document.documentElement.style.getPropertyValue('--color-canvas'), '#f3eded', `${page} must apply the shipped theme`);
  view.window.close();
}

const v1 = makePage('v1-camera-baseline.html', {
  production: true,
  project: {
    ...project,
    fineTune: { v1: { '[id="timer"]': { self: { color: '#00ff55' } } } }
  }
});
assert(!v1.window.document.querySelector('.qa-panel'));
assert.match(v1.window.document.querySelector('style[data-qa-editor-owned]').textContent, /\[id="timer"\] \{color:#00ff55!important\}/);
v1.window.close();

console.log('Production runtime: shipped theme, copy and fine-tune colors apply, local drafts are ignored, QA panel stays off.');
