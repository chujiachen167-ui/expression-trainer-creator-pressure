const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateModelFolder, validateManifest, readValidatedAsset, joinRelativePath } = require('../live2d-local-validator');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-live2d-'));
const write = (relative, content = 'asset') => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
try {
  write('nested/hero.model3.json', JSON.stringify({ Version: 3, FileReferences: { Moc: 'hero.moc3', Textures: ['textures/hero.png'], Expressions: [{ Name: 'smile', File: 'smile.exp3.json' }] } }));
  write('nested/hero.moc3');
  write('nested/textures/hero.png');
  write('nested/smile.exp3.json');
  const valid = validateModelFolder(root);
  assert.equal(valid.modelFile, 'nested/hero.model3.json');
  assert.deepEqual(valid.references, ['nested/hero.moc3', 'nested/textures/hero.png', 'nested/smile.exp3.json']);
  assert.equal(valid.source, 'local-folder');
  assert.match(valid.id, /^local-[a-f0-9]{24}$/, 'public model id must not reveal the absolute folder path');

  write('nested/evil.js');
  assert.throws(() => validateModelFolder(root), /不允许包含脚本/);
  fs.rmSync(path.join(root, 'nested/evil.js'));

  write('second.model3.json', '{}');
  assert.throws(() => validateModelFolder(root), /只能包含一个/);
  fs.rmSync(path.join(root, 'second.model3.json'));

  assert.throws(() => validateManifest({ FileReferences: { Moc: 'https://example.test/hero.moc3' } }, 'hero.model3.json', ['hero.model3.json']), /相对路径/);
  assert.throws(() => validateManifest({ FileReferences: { Moc: '../escape.moc3' } }, 'hero.model3.json', ['hero.model3.json', 'escape.moc3']), /相对路径/);
  assert.throws(() => validateManifest({ FileReferences: { Moc: 'missing.moc3' } }, 'nested/hero.model3.json', ['nested/hero.model3.json']), /不存在/);
  assert.throws(() => validateModelFolder(path.join(root, 'nested', 'hero.model3.json')), /文件夹/);
  assert.throws(() => validateModelFolder(root, { limits: { maxFileBytes: 1, maxTotalBytes: 250 * 1024 * 1024, maxFileCount: 2048, maxManifestBytes: 1_000_000 } }), /上限/);
  const asset = readValidatedAsset(root, 'nested/hero.moc3');
  assert.equal(asset.mime, 'application/octet-stream');
  assert.throws(() => readValidatedAsset(root, '../secret.moc3'), /相对路径/);
  assert.throws(() => readValidatedAsset(root, 'nested/evil.js'), /只能读取已校验|不允许包含脚本/);
  assert.equal(joinRelativePath('nested', 'textures/hero.png'), 'nested/textures/hero.png');
  console.log('Local Live2D validator: local folder, nested manifest references, forbidden files, single manifest, remote/missing/traversal/oversize references passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
