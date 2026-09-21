'use strict';

/**
 * Local Live2D model-folder validation shared by Electron and deterministic
 * tests. This module never copies or uploads model bytes.
 */

const LIMITS = Object.freeze({
  maxManifestBytes: 1_000_000,
  maxFileBytes: 50 * 1024 * 1024,
  maxTotalBytes: 250 * 1024 * 1024,
  maxFileCount: 2_048
});

const FORBIDDEN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html', '.htm']);
const MODEL_EXTENSION = '.model3.json';

function fileExtension(value) {
  const match = String(value || '').match(/\.([^.\\/]+)$/);
  return match ? `.${match[1].toLowerCase()}` : '';
}

function joinRelativePath(base, child) {
  const baseParts = String(base || '').split('/').filter(Boolean);
  const childParts = String(child || '').split('/');
  const output = [...baseParts];
  for (const part of childParts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!output.length) return null;
      output.pop();
    } else output.push(part);
  }
  return output.join('/');
}

function cleanRelativePath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim().replaceAll('\\', '/');
  if (/^(?:[a-z][a-z\d+.-]*:|\/|\\|[a-z]:\/)/i.test(raw)) return null;
  const parts = raw.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

function isModelManifest(name) {
  return typeof name === 'string' && name.toLowerCase().endsWith(MODEL_EXTENSION);
}

function modelReferences(manifest) {
  const references = [];
  const files = manifest && typeof manifest === 'object' ? manifest.FileReferences : null;
  if (!files || typeof files !== 'object' || Array.isArray(files)) return references;
  const pathKeys = new Set(['Moc', 'Textures', 'Physics', 'Pose', 'Expressions', 'Motions', 'UserData', 'DisplayInfo', 'File']);
  const visit = (value, key = '') => {
    if (typeof value === 'string') {
      if (!pathKeys.has(key) && key !== '') return;
      const path = cleanRelativePath(value);
      if (path) references.push(path);
      else if (/[/\\]|\.json$|\.(?:moc3|png|jpg|jpeg|webp)$/i.test(value)) references.push(value);
      return;
    }
    if (Array.isArray(value)) return value.forEach(item => visit(item, key));
    if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
  };
  Object.entries(files).forEach(([key, value]) => visit(value, key));
  return [...new Set(references)];
}

function validateManifest(manifest, modelPath, relativeFiles, options = {}) {
  const limits = { ...LIMITS, ...options };
  if (!isModelManifest(modelPath)) throw new Error('模型清单必须是单一 .model3.json 文件。');
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Live2D 模型清单不是有效 JSON 对象。');
  const normalizedModelPath = cleanRelativePath(modelPath);
  if (!normalizedModelPath) throw new Error('模型清单路径必须是文件夹内的相对路径。');
  const paths = new Set([...relativeFiles].map(item => String(item).replaceAll('\\', '/')));
  if (!paths.has(normalizedModelPath)) throw new Error('模型清单文件不存在或路径无效。');
  const references = modelReferences(manifest);
  const invalid = references.find(value => !cleanRelativePath(value));
  if (invalid) throw new Error(`模型引用必须是文件夹内的相对路径：${invalid}`);
  const manifestDirectory = normalizedModelPath.includes('/') ? normalizedModelPath.split('/').slice(0, -1).join('/') : '';
  const resolvedReferences = references.map(value => joinRelativePath(manifestDirectory, cleanRelativePath(value)));
  const escaped = resolvedReferences.find(value => !value);
  if (escaped) throw new Error('模型引用不能穿越模型文件夹边界。');
  const missing = resolvedReferences.find(value => !paths.has(value));
  if (missing) throw new Error(`模型引用文件不存在：${missing}`);
  const forbidden = [...paths].find(file => FORBIDDEN_EXTENSIONS.has(fileExtension(file)));
  if (forbidden) throw new Error(`模型文件夹不允许包含脚本或 HTML：${forbidden}`);
  return {
    modelFile: normalizedModelPath,
    references: resolvedReferences,
    limits: { maxManifestBytes: limits.maxManifestBytes, maxFileBytes: limits.maxFileBytes, maxTotalBytes: limits.maxTotalBytes, maxFileCount: limits.maxFileCount }
  };
}

function listFiles(folderPath, fsImpl, pathImpl, relative = '') {
  const directory = pathImpl.join(folderPath, relative);
  const entries = fsImpl.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = pathImpl.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`模型文件夹不允许包含符号链接：${rel}`);
    if (entry.isDirectory()) files.push(...listFiles(folderPath, fsImpl, pathImpl, rel));
    else if (entry.isFile()) files.push(rel);
    else throw new Error(`模型文件夹包含无法读取的条目：${rel}`);
  }
  return files;
}

function validateModelFolder(folderPath, dependencies = {}) {
  const fsImpl = dependencies.fs || require('node:fs');
  const pathImpl = dependencies.path || require('node:path');
  const limits = { ...LIMITS, ...(dependencies.limits || {}) };
  if (typeof folderPath !== 'string' || !folderPath.trim()) throw new Error('请选择本地 Live2D 模型文件夹，不接受 zip 文件。');
  const root = pathImpl.resolve(folderPath);
  if (!fsImpl.statSync(root).isDirectory()) throw new Error('请选择本地 Live2D 模型文件夹，不接受 zip 文件。');
  const files = listFiles(root, fsImpl, pathImpl);
  if (!files.length) throw new Error('模型文件夹为空。');
  if (files.length > limits.maxFileCount) throw new Error(`模型文件数量超过 ${limits.maxFileCount} 个上限。`);
  let totalBytes = 0;
  const relativeFiles = files.map(file => file.replaceAll('\\', '/'));
  const modelFiles = relativeFiles.filter(isModelManifest);
  if (modelFiles.length !== 1) throw new Error(`模型文件夹必须且只能包含一个 .model3.json（当前 ${modelFiles.length} 个）。`);
  for (const relative of files) {
    const absolute = pathImpl.resolve(root, relative);
    if (pathImpl.dirname(absolute) !== root && !absolute.startsWith(`${root}${pathImpl.sep}`)) throw new Error(`检测到路径穿越：${relative}`);
    const size = fsImpl.statSync(absolute).size;
    if (size > limits.maxFileBytes) throw new Error(`文件超过 ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB 上限：${relative}`);
    totalBytes += size;
    if (totalBytes > limits.maxTotalBytes) throw new Error(`模型文件夹超过 ${Math.round(limits.maxTotalBytes / 1024 / 1024)} MB 总大小上限。`);
    if (FORBIDDEN_EXTENSIONS.has(fileExtension(relative))) throw new Error(`模型文件夹不允许包含脚本或 HTML：${relative}`);
  }
  const manifestAbsolute = pathImpl.join(root, modelFiles[0]);
  if (fsImpl.statSync(manifestAbsolute).size > limits.maxManifestBytes) throw new Error('模型清单超过 1 MB 上限。');
  let manifest;
  try { manifest = JSON.parse(fsImpl.readFileSync(manifestAbsolute, 'utf8')); }
  catch (_) { throw new Error('模型清单不是有效 JSON。'); }
  const validated = validateManifest(manifest, modelFiles[0], relativeFiles, limits);
  const cryptoImpl = dependencies.crypto || require('node:crypto');
  return {
    id: `local-${cryptoImpl.createHash('sha256').update(`${root}\0${modelFiles[0]}`).digest('hex').slice(0, 24)}`,
    name: pathImpl.basename(root),
    folderPath: root,
    modelFile: validated.modelFile,
    references: validated.references,
    fileCount: files.length,
    totalBytes,
    importedAt: new Date().toISOString(),
    source: 'local-folder'
  };
}

function mimeFor(relative) {
  const lower = String(relative || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.json') || lower.endsWith('.model3.json') || lower.endsWith('.exp3.json')) return 'application/json';
  return 'application/octet-stream';
}

function readValidatedAsset(folderPath, relativePath, dependencies = {}) {
  const fsImpl = dependencies.fs || require('node:fs');
  const pathImpl = dependencies.path || require('node:path');
  const record = dependencies.record || validateModelFolder(folderPath, dependencies);
  const cleaned = cleanRelativePath(relativePath);
  if (!cleaned) throw new Error(`模型引用必须是文件夹内的相对路径：${relativePath}`);
  const allowed = new Set([record.modelFile, ...record.references]);
  if (!allowed.has(cleaned)) throw new Error(`只能读取已校验模型清单中的文件：${cleaned}`);
  const root = pathImpl.resolve(record.folderPath || folderPath);
  const absolute = pathImpl.resolve(root, cleaned);
  if (absolute !== root && !absolute.startsWith(`${root}${pathImpl.sep}`)) throw new Error(`检测到路径穿越：${cleaned}`);
  if (FORBIDDEN_EXTENSIONS.has(fileExtension(cleaned))) throw new Error(`模型文件夹不允许包含脚本或 HTML：${cleaned}`);
  const limits = { ...LIMITS, ...(dependencies.limits || {}) };
  const size = fsImpl.statSync(absolute).size;
  if (size > limits.maxFileBytes) throw new Error(`文件超过 ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB 上限：${cleaned}`);
  return { absolute, bytes: fsImpl.readFileSync(absolute), mime: mimeFor(cleaned) };
}

const exported = { LIMITS, FORBIDDEN_EXTENSIONS, cleanRelativePath, fileExtension, joinRelativePath, isModelManifest, modelReferences, validateManifest, validateModelFolder, mimeFor, readValidatedAsset };
if (typeof module !== 'undefined' && module.exports) module.exports = exported;
if (typeof window !== 'undefined') window.CreatorLocalLive2DValidator = exported;
