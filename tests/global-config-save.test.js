const assert = require('node:assert/strict');
const vm = require('node:vm');
const { makePage, input } = require('./qa-dom-helper');
const tick = () => new Promise(resolve => setImmediate(resolve));
const parseProject = source => {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return JSON.parse(JSON.stringify(context.window.CreatorProjectConfig));
};

async function run() {
  const dom = makePage('index.html', { draft: {
    copy: { 'v1.document-title': '镜头练习', 'v2.document-title': '受众练习', 'v3.document-title': '实战练习' },
    fineTune: { v1: { '#liveTranscript': { color: '#abcdef' } }, v2: {}, v3: {} },
    extraCopy: { launcher: {}, v1: {}, v2: {}, v3: { '#practice': { text: '我的实战任务' } } }
  } });
  const { window } = dom;
  const doc = window.document;
  const footer = doc.querySelector('.qa-global-save');
  const save = doc.querySelector('[data-qa-save-project]');
  assert(footer.contains(save));
  assert(!save.closest('[data-qa-page]'), 'global save must not belong to a single tab');
  doc.querySelector('.qa-trigger').click();
  for (const tab of doc.querySelectorAll('[data-qa-tab]')) {
    tab.click();
    assert(!save.closest('[hidden]'), `save available from ${tab.textContent}`);
  }
  assert.equal(doc.querySelectorAll('[data-qa-save-project]').length, 1);
  doc.querySelector('[data-qa-tab="palette"]').click();
  doc.querySelector('[data-qa-palette="sand-amber"]').click();
  input(window, 'layout.leftWidth', 305);
  input(window, 'components.driftWall.columns', 7);
  input(window, 'components.scrollExpand.duration', 700);
  input(window, 'components.transcriptCover.cleanColor', '#123456');
  input(window, 'components.warpText.speed', 1.3);
  input(window, 'components.trueFocus.blurAmount', 4);
  input(window, 'components.logo.width', 180);
  input(window, 'components.logo.opacity', 0.65);
  input(window, 'components.logo.color', '#abcdef');
  input(window, 'components.logoBackground.width', 145);
  input(window, 'components.logoBackground.opacity', 0.11);
  input(window, 'components.logoBackground.x', -20);
  doc.querySelector('[data-qa-tab="copy"]').click();
  const title = doc.querySelector('[data-copy-key="launcher.h1.1"]');
  title.value = 'Read My Own Words';
  title.dispatchEvent(new window.Event('input', { bubbles: true }));
  const expected = JSON.parse(JSON.stringify(window.CreatorQAControls.getState()));
  let written;
  window.api = { saveProjectConfig: async content => { written = content; return { success: true, path: 'test-project/creator-project-config.js' }; } };
  save.click(); await tick();
  const envelope = parseProject(written);
  assert.deepEqual(envelope.config, expected, 'one project file must contain the whole state, including all page-specific editing layers');
  assert(envelope.savedAt);
  assert.match(doc.querySelector('[data-qa-save-status]').textContent, /尚未提交 GitHub/);
  assert.match(doc.querySelector('[data-qa-project-status]').textContent, /一致/);

  let blob;
  window.URL.createObjectURL = value => { blob = value; return 'blob:test-export'; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  doc.querySelector('[data-qa-backup]').click();
  await tick();
  const text = await new Promise((resolve, reject) => {
    const reader = new window.FileReader();
    reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(blob);
  });
  assert.deepEqual(JSON.parse(text).config, expected, 'JSON backup and project save must include exactly the same parameters');
  window.URL.createObjectURL = () => { throw new Error('test download failure'); };
  doc.querySelector('[data-qa-backup]').click();
  await tick();
  assert.match(doc.querySelector('[data-qa-save-status]').textContent, /导出失败/);
  assert.deepEqual(JSON.parse(JSON.stringify(window.CreatorQAControls.getState())), expected, 'failed export must preserve the entire draft');

  input(window, 'components.warpText.speed', 1.5);
  assert.match(doc.querySelector('[data-qa-project-status]').textContent, /尚未写入项目/);
  delete window.api;
  window.showSaveFilePicker = async () => ({ name: 'creator-project-config.js', createWritable: async () => ({ write: async () => {}, close: async () => {} }) });
  save.click(); await tick();
  assert.match(doc.querySelector('[data-qa-save-status]').textContent, /所选文件/);
  assert.match(doc.querySelector('[data-qa-project-status]').textContent, /尚未写入项目/, 'an arbitrary saved file is not verified repository persistence');
  window.showSaveFilePicker = async () => { throw new window.DOMException('Canceled', 'AbortError'); };
  save.click(); await tick();
  assert.match(doc.querySelector('[data-qa-save-status]').textContent, /已取消/);

  // Run both buttons through the actual directory adapter, not just an IPC stub.
  const files = new Map([
    ['package.json', '{"name":"expression-trainer-creator-pressure"}'],
    ['index.html', '<script src="creator-project-config.js"></script>']
  ]);
  let pickerCalls = 0;
  const fileHandle = filename => ({
    getFile: async () => ({ text: async () => files.get(filename) }),
    createWritable: async () => ({ write: async content => files.set(filename, content), close: async () => {} })
  });
  window.showDirectoryPicker = async () => {
    pickerCalls++;
    return {
      name: 'test-project', queryPermission: async () => 'granted',
      getFileHandle: async filename => fileHandle(filename),
      getDirectoryHandle: async name => ({ getFileHandle: async filename => fileHandle(`${name}/${filename}`) })
    };
  };
  save.click(); await tick();
  const current = JSON.parse(JSON.stringify(window.CreatorQAControls.getState()));
  assert.deepEqual(parseProject(files.get('creator-project-config.js')).config, current);
  assert.match(doc.querySelector('[data-qa-save-status]').textContent, /绑定项目/);
  assert.match(doc.querySelector('[data-qa-project-status]').textContent, /一致/);
  doc.querySelector('[data-qa-backup]').click(); await tick();
  assert.deepEqual(JSON.parse(files.get('docs/creator-pressure-config.json')).config, current);
  assert.equal(pickerCalls, 1, 'both buttons share the one selected root folder');
  assert.match(doc.querySelector('[data-qa-save-status]').textContent, /未更新页面配置 JS/);

  let backupWritten;
  window.api = { saveProjectBackup: async content => { backupWritten = content; return { success: true, path: 'test-project/docs/creator-pressure-config.json' }; } };
  doc.querySelector('[data-qa-backup]').click(); await tick();
  assert.deepEqual(JSON.parse(backupWritten).config, current, 'desktop backup includes the exact same full configuration');

  // A fresh page with no local draft must reproduce the serialized project.
  const fresh = makePage('index.html', { project: envelope.config });
  assert.deepEqual(JSON.parse(JSON.stringify(fresh.window.CreatorQAControls.getState())), expected);
  assert.equal(fresh.window.document.querySelector('#launcherTitle').textContent, 'Read My Own Words');
  fresh.window.close(); dom.window.close();
  console.log('Global save: all-tab access including Logo, full-state project/JSON export, cross-page data retention, fresh-page restoration, dirty state and honest picker/cancel status passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
