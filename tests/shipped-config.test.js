const assert = require('node:assert/strict');
const { read, makePage } = require('./qa-dom-helper');
const source = read('creator-project-config.js');
const match = source.match(/window\.CreatorProjectConfig\s*=\s*([\s\S]*);\s*$/);
assert(match, 'project config must contain the expected data assignment');
const envelope = JSON.parse(match[1]);
assert.equal(envelope.version, 1);
assert(envelope.savedAt, 'the shipped project must include a saved configuration');
const settings = envelope.config;
for (const page of ['index.html', 'v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
  const dom = makePage(page, { project: settings });
  const { document } = dom.window;
  const state = JSON.parse(JSON.stringify(dom.window.CreatorQAControls.getState()));
  assert.deepEqual(state.theme, settings.theme, `${page}: shared theme must load without a local draft`);
  for (const [name, parameters] of Object.entries(settings.components)) {
    assert.deepEqual(state.components[name], parameters, `${page}: saved ${name} parameters must survive loading`);
  }
  assert.deepEqual(state.components.logo, JSON.parse(JSON.stringify(dom.window.CreatorLogoConfig.normalize(settings.components.logo))), `${page}: absent Logo settings acquire safe defaults`);
  assert.deepEqual(state.components.logoBackground, JSON.parse(JSON.stringify(dom.window.CreatorLogoConfig.normalizeBackground(settings.components.logoBackground))), `${page}: absent background Logo settings acquire safe defaults`);
  assert.deepEqual(state.copy, settings.copy);
  assert.deepEqual(state.fineTune, settings.fineTune);
  if (page === 'index.html') {
    for (const [key, value] of Object.entries(settings.copy).filter(([key]) => key.startsWith('launcher.'))) {
      if (key === 'launcher.document-title') { assert.equal(document.title, value); continue; }
      const node = [...document.querySelectorAll('[data-qa-copy-key]')].find(node => node.dataset.qaCopyKey === key);
      assert(node, `saved copy ${key} must still address a real element`);
      assert.equal(node.textContent, value, `saved copy ${key} must render verbatim`);
    }
    assert.equal(document.querySelector('.version-status').textContent, '推荐起点', 'new badge must not steal a historical card copy key');
    const badgeKey = document.querySelector('.version-status').dataset.qaCopyKey;
    assert(badgeKey.startsWith('launcher.additional.'), 'new static copy remains separately editable');
  }
  assert.equal(dom.qaErrors.length, 0);
  dom.window.close();
}
console.log('Shipped config: all four pages load the complete saved settings without drafts; every saved homepage text resolves and renders verbatim.');
