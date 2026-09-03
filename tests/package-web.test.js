const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { packageWeb, pages } = require('../scripts/package-web.js');
const { root } = require('./qa-dom-helper');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'et-web-'));
try {
  const dest = packageWeb({ rootDir: root, outDir });
  assert.equal(dest, outDir);
  for (const page of pages) {
    const html = fs.readFileSync(path.join(outDir, page), 'utf8');
    assert.match(html, /<body data-environment="production"/);
    assert.equal(html.includes('data-environment="production"'), true);
  }
  assert.equal(fs.existsSync(path.join(outDir, 'assets/brand/read-yourself-concentric.png')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'assets/contact/wechat-donglai.png')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'vendor/magic-ui/marquee.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'locales/zh-CN.js')), true);
  assert.equal(fs.existsSync(path.join(outDir, '_headers')), true);
  assert.match(fs.readFileSync(path.join(outDir, '_headers'), 'utf8'), /camera=\(self\)/);
  assert.equal(fs.existsSync(path.join(outDir, 'main.js')), false);
  assert.equal(fs.existsSync(path.join(outDir, 'node_modules')), false);
  assert.equal(fs.existsSync(path.join(outDir, 'models')), false);
  assert.equal(fs.existsSync(path.join(outDir, 'desktop')), false);
  assert.equal(fs.existsSync(path.join(outDir, 'package.json')), false);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}

console.log('Web package: production stamp, browser assets only, Electron/models excluded.');
