const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { packageWeb } = require('../scripts/package-web');
const { root } = require('./qa-dom-helper');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-live2d-web-'));
try {
  packageWeb({ rootDir: root, outDir });
  assert.equal(fs.existsSync(path.join(outDir, 'live2d-local-import.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'live2d-local-validator.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'live2d-local-runtime.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'live2d-local-import.css')), true);
  const page = fs.readFileSync(path.join(outDir, 'v2-ai-audience.html'), 'utf8');
  const v3Page = fs.readFileSync(path.join(outDir, 'v3-creator-studio.html'), 'utf8');
  assert.match(page, /<body data-environment="production"/);
  assert.match(page, /live2d-local-runtime\.js/);
  assert.doesNotMatch(v3Page, /live2d-local-(?:import|runtime|validator)/, 'V3 must not expose a dead local Live2D entry before it has a compatible audience stage');
  const runtime = fs.readFileSync(path.join(outDir, 'live2d-local-runtime.js'), 'utf8');
  const importer = fs.readFileSync(path.join(outDir, 'live2d-local-import.js'), 'utf8');
  const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.match(importer, /正式网站不提供本地模型上传/);
  assert.match(importer, /只在本机使用/);
  assert.match(runtime, /local-runtime\/live2dcubismcore\.min\.js/);
  assert.match(runtime, /local-runtime\/live2d-framework-bridge\.js/);
  assert.doesNotMatch(runtime, /[A-Za-z]:\\Users\\|[A-Za-z]:\\Vibe /);
  assert.match(mainSource, /live2dFolderCache\.set\(record\.id, record\)/, 'main process should grant access by opaque record id');
  assert.match(mainSource, /folderPath: _privateFolderPath/, 'absolute folder path must be stripped before the record reaches the page');
  assert.doesNotMatch(mainSource, /live2dFolderCache\.get\(root\) \|\| validateModelFolder/, 'renderer must not authorize an arbitrary path by requesting it');
  assert.equal(fs.existsSync(path.join(outDir, 'models')), false, 'model binaries must stay out of the web package');
  assert.equal(fs.existsSync(path.join(outDir, 'local-runtime')), false, 'Cubism Core directory must stay out of the web package');
  assert.equal(fs.existsSync(path.join(outDir, 'live2dcubismcore.min.js')), false, 'Cubism Core must stay out of the web package');
  assert.equal(fs.existsSync(path.join(outDir, 'live2d-framework-bridge.js')), false, 'local official-framework bridge must stay out of the web package');
  console.log('Local Live2D package boundary: guarded browser asset shipped, model binaries excluded, production stamp preserved.');
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
