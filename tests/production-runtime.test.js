const assert = require('node:assert/strict');
const { makePage } = require('./qa-dom-helper');

const project = {
  theme: {
    bg: '#f3eded', panel: '#8ce1e1', panelRaised: '#151823', control: '#0c0e13',
    border: '#252938', borderStrong: '#4c5268', text: '#8690df', muted: '#000000',
    accent: '#ff2f92', info: '#42e8d6', success: '#65e49b', warning: '#ffc85a', danger: '#ff5a70'
  },
  copy: { 'launcher.document-title': '线上预览' }
};

const production = makePage('index.html', {
  production: true,
  draft: { theme: { bg: '#111111' }, copy: { 'launcher.document-title': '浏览器草稿' } },
  project
});
const { window } = production;
assert(!window.document.querySelector('.qa-panel'), 'production must not mount the QA panel');
assert(!window.document.querySelector('.qa-trigger'));
assert.equal(window.document.documentElement.style.getPropertyValue('--color-canvas'), '#f3eded');
assert.equal(window.document.title, '线上预览');
assert.equal(window.CreatorQAControls.featureEnabled('camera'), true);
window.close();

for (const page of ['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html', 'contact.html']) {
  const view = makePage(page, { production: true, project });
  assert(!view.window.document.querySelector('.qa-panel'), `${page} must hide the QA panel`);
  assert.equal(view.window.document.documentElement.style.getPropertyValue('--color-canvas'), '#f3eded', `${page} must apply the shipped theme`);
  view.window.close();
}

console.log('Production runtime: shipped theme and copy apply, local drafts are ignored, QA panel stays off.');
