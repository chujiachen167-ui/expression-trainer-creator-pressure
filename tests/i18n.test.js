const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { read } = require('./qa-dom-helper');

function makeLocalizedPage(page) {
  const dom = new JSDOM(read(page), {
    url: `https://qa.invalid/${page}`,
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.eval(read('locales/zh-CN.js'));
  window.eval(read('locales/en-US.js'));
  window.eval(read('i18n.js'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return dom;
}

const launcher = makeLocalizedPage('index.html');
const { window } = launcher;
const originalChinese = '启用电脑摄像头，训练直视镜头、开场速度、口头禅和表达密度。';
assert.equal(window.CreatorI18n.getLocale(), 'en-US', 'non-Chinese browser defaults to English');
assert.equal(window.document.documentElement.lang, 'en-US');
assert.equal(window.document.querySelector('[data-i18n="launcher.v1.title"]').textContent, 'Camera Baseline');
assert.equal(window.document.querySelector('[data-locale-select]').value, 'en-US');

window.CreatorI18n.setLocale('zh-CN');
assert.equal(window.document.documentElement.lang, 'zh-CN');
assert.equal(window.document.querySelector('[data-i18n="launcher.v1.body"]').textContent, originalChinese,
  'switching back restores the founder-authored Chinese source');
assert.equal(window.document.title, 'Expression Trainer · Creator Pressure');
assert.equal(window.localStorage.getItem('read-yourself.interface-locale.v1'), 'zh-CN');
for (const select of window.document.querySelectorAll('[data-locale-select]')) assert.equal(select.value, 'zh-CN');
launcher.window.close();

const v1 = makeLocalizedPage('v1-camera-baseline.html');
assert.equal(v1.window.document.querySelector('[data-i18n="v1.title"]').textContent, 'Real-time Expression Diagnosis');
assert.equal(v1.window.document.querySelector('[data-i18n="v1.devices"]').textContent, 'Devices and recording');
assert.equal(v1.window.document.body.dataset.mode, 'v1', 'interface locale leaves the training mode untouched');
assert.match(read('v1-controls.js'), /language:\s*'mixed'/, 'diagnostic mixed-language mode remains a separate V1 control');
v1.window.close();

for (const page of ['index.html', 'contact.html', 'v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
  const html = read(page);
  assert.match(html, /data-locale-select/, `${page} exposes an interface-language selector`);
  assert.doesNotMatch(html, /🇨🇳|🇺🇸|国旗/, `${page} does not encode locale as a flag`);
}

console.log('Interface localization: persisted zh/en switching, Chinese restoration, and diagnostic-language separation passed.');
