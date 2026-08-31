const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const projectConfig = fs.readFileSync(path.join(root, 'creator-project-config.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(projectConfig, sandbox);
assert.strictEqual(sandbox.window.CreatorProjectConfig.version, 1, 'project config should expose a versioned envelope');
assert(sandbox.window.CreatorProjectConfig.config, 'project config should expose the persisted control-panel state');

for (const page of ['index.html', 'v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert(html.includes('creator-project-config.js'), `${page} should load the project configuration`);
  assert(html.indexOf('creator-project-config.js') < html.indexOf('control-panel.js'), `${page} should load project config before the control panel`);
}

const controls = fs.readFileSync(path.join(root, 'control-panel.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
assert(controls.includes("localStorage.setItem(storageKey"), 'edits should keep an automatic browser draft');
assert(controls.includes('saveToProject'), 'control panel should provide a project-save action');
assert(controls.includes("theme: {\n      bg:"), 'control panel should keep a versioned color-token palette');
assert(controls.includes("colorField('Studio 背景'"), 'V3 studio colors should be configurable from the control panel');
assert(controls.includes("colorField('Studio 输入控件'"), 'V3 controls should not retain an unconfigurable hard-coded surface');
assert(controls.includes("colorField('Studio 强边界'"), 'V3 borders should be configurable from the control panel');
assert(controls.includes("colorField('错误状态'"), 'semantic state colors should be configurable from the control panel');
assert(controls.includes('showSaveFilePicker'), 'browser preview should use the safe file picker when available');
assert(main.includes("ipcMain.handle('save-project-config'"), 'Electron should write the project config through a scoped IPC handler');
assert(preload.includes('saveProjectConfig'), 'the preload bridge should expose project saving');

console.log('Project configuration persistence contract tests passed.');
