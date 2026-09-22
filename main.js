/**
 * Expression Trainer · Creator Pressure desktop runtime.
 *
 * Derived from fxy2311-youyou/expression-trainer (MIT, Copyright 2026 Sisi).
 * The Electron, Sherpa-ONNX, lexicon and multi-provider AI runtime remain the
 * diagnostic core; Creator Pressure supplies the creator-specific surfaces.
 */
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initASR, feedAudio, stopRecognition, getASRStatus } = require('./lib/asr');
const { loadLexicon, analyzeText } = require('./lib/lexicon');
const { sendFeedback, sendReport, sendOptimizedScript, testConnection } = require('./lib/ai-feedback');
const { validateModelFolder, readValidatedAsset } = require('./live2d-local-validator');
const live2dFolderCache = new Map();
const live2dSmokeTest = process.argv.includes('--live2d-smoke-test');
const useLocalLive2DSample = !app.isPackaged && (process.argv.includes('--use-local-live2d-sample') || live2dSmokeTest);

app.setName('Expression Trainer · Creator Pressure');

let mainWindow;
let settingsWindow;
let promptEditorWindow;
let classicWindow;
let asrReady = false;

const DEFAULT_PROVIDER_CONFIGS = {
  openai: { apiKey: '', model: 'gpt-4o-mini' },
  deepseek: { apiKey: '', model: 'deepseek-chat' },
  ollama: { ollamaUrl: 'http://localhost:11434', model: 'qwen2.5:7b' },
  custom: { apiKey: '', baseUrl: '', model: '', customModel: '' }
};

function userDataFile(name) { return path.join(app.getPath('userData'), name); }
function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return fallback; }
}
function writeJson(filePath, value) { fs.writeFileSync(filePath, JSON.stringify(value, null, 2)); }

function getCustomPromptPath() { return userDataFile('custom-prompt.json'); }
function loadCustomPrompt() { return readJson(getCustomPromptPath(), null); }
function saveCustomPrompt(data) { writeJson(getCustomPromptPath(), data); }

function getSettingsPath() { return userDataFile('settings.json'); }
function defaultSettings() {
  return { provider: 'deepseek', providers: JSON.parse(JSON.stringify(DEFAULT_PROVIDER_CONFIGS)) };
}
function saveSettings(settings) { writeJson(getSettingsPath(), settings); }
function loadSettings() {
  const raw = readJson(getSettingsPath(), null);
  if (!raw) return defaultSettings();
  if (!raw.providers) {
    const migrated = defaultSettings();
    migrated.provider = raw.provider || 'deepseek';
    const selected = migrated.providers[migrated.provider] || {};
    if (raw.apiKey) selected.apiKey = raw.apiKey;
    if (raw.model) selected.model = raw.model;
    if (raw.ollamaUrl) migrated.providers.ollama.ollamaUrl = raw.ollamaUrl;
    if (raw.customEndpoint) migrated.providers.custom.baseUrl = raw.customEndpoint;
    if (raw.customModel) migrated.providers.custom.model = raw.customModel;
    saveSettings(migrated);
    return migrated;
  }
  for (const [name, defaults] of Object.entries(DEFAULT_PROVIDER_CONFIGS)) {
    raw.providers[name] = { ...defaults, ...(raw.providers[name] || {}) };
  }
  if (!raw.provider || !raw.providers[raw.provider]) raw.provider = 'deepseek';
  return raw;
}
function currentProviderSettings(settings = loadSettings()) {
  return settings.providers?.[settings.provider] || DEFAULT_PROVIDER_CONFIGS[settings.provider] || {};
}
function llmConfigured(settings = loadSettings()) {
  const config = currentProviderSettings(settings);
  if (settings.provider === 'ollama') return Boolean(config.ollamaUrl);
  if (settings.provider === 'custom') return Boolean(config.baseUrl && config.model);
  return Boolean(config.apiKey && config.model);
}

const commonWindowOptions = {
  backgroundColor: '#08090d',
  titleBarStyle: 'hiddenInset',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
};

function createMainWindow() {
  mainWindow = new BrowserWindow({ ...commonWindowOptions, width: 1440, height: 920, minWidth: 1024, minHeight: 700 });
  const smokeTest = process.argv.includes('--smoke-test');
  const startPage = smokeTest ? 'v1-camera-baseline.html' : (process.argv.includes('--open-v2') || live2dSmokeTest) ? 'v2-ai-audience.html' : 'index.html';
  mainWindow.loadFile(path.join(__dirname, startPage));
  if (smokeTest) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const renderer = await mainWindow.webContents.executeJavaScript(`({
          title: document.title,
          mode: document.body.dataset.mode,
          api: typeof window.api?.getRuntimeStatus === 'function',
          projectSave: typeof window.api?.saveProjectConfig === 'function',
          controls: Boolean(document.querySelector('.v1-training-tools')),
          languages: [...document.querySelectorAll('[data-language]')].map(button => button.dataset.language),
          sttStatus: document.querySelector('[data-stt-status]')?.textContent
        })`);
        process.stdout.write(`ELECTRON_SMOKE_OK ${JSON.stringify({ renderer, asr: getASRStatus() })}\n`);
        app.exit(0);
      } catch (error) {
        process.stderr.write(`ELECTRON_SMOKE_FAILED ${error.stack || error.message}\n`);
        app.exit(1);
      }
    });
  }
  if (live2dSmokeTest) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const renderer = await mainWindow.webContents.executeJavaScript(`(async () => {
          const waitFor = async (check, timeout = 15000) => {
            const deadline = Date.now() + timeout;
            while (Date.now() < deadline) {
              const value = check();
              if (value) return value;
              await new Promise(resolve => setTimeout(resolve, 80));
            }
            return null;
          };
          const imported = await waitFor(() => window.CreatorLocalAvatarImport?.selected?.());
          document.querySelector('[data-audience-apply]')?.click();
          const stage = await waitFor(() => {
            const node = document.querySelector('[data-v2-audience-stage]');
            return node?.dataset.presentation === 'adapter' && node?.dataset.adapterStatus === 'ready' ? node : null;
          });
          return {
            imported: Boolean(imported),
            model: imported?.name || '',
            presentation: stage?.dataset.presentation || document.querySelector('[data-v2-audience-stage]')?.dataset.presentation || '',
            adapterStatus: stage?.dataset.adapterStatus || document.querySelector('[data-v2-audience-stage]')?.dataset.adapterStatus || '',
            canvas: Boolean(stage?.querySelector('canvas')),
            silentB: !document.documentElement.innerHTML.includes('试听反应')
          };
        })()`);
        if (!renderer.imported || renderer.presentation !== 'adapter' || renderer.adapterStatus !== 'ready' || !renderer.canvas || !renderer.silentB) {
          throw new Error(`V2 Live2D smoke assertion failed: ${JSON.stringify(renderer)}`);
        }
        process.stdout.write(`V2_LIVE2D_SMOKE_OK ${JSON.stringify(renderer)}\n`);
        app.exit(0);
      } catch (error) {
        process.stderr.write(`V2_LIVE2D_SMOKE_FAILED ${error.stack || error.message}\n`);
        app.exit(1);
      }
    });
  }
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createUtilityWindow(kind) {
  const configs = {
    settings: { width: 620, height: 620, file: 'settings.html', title: '大模型配置' },
    prompt: { width: 760, height: 780, file: 'prompt-editor.html', title: '训练规则' },
    classic: { width: 1240, height: 820, file: 'classic.html', title: '原始诊断模式' }
  };
  const config = configs[kind];
  const existing = kind === 'settings' ? settingsWindow : kind === 'prompt' ? promptEditorWindow : classicWindow;
  if (existing && !existing.isDestroyed()) { existing.focus(); return existing; }
  const window = new BrowserWindow({
    ...commonWindowOptions,
    width: config.width,
    height: config.height,
    minWidth: kind === 'classic' ? 960 : 520,
    minHeight: kind === 'classic' ? 640 : 500,
    parent: kind === 'classic' ? undefined : mainWindow,
    modal: kind === 'settings',
    title: config.title
  });
  window.loadFile(path.join(__dirname, 'desktop', config.file));
  window.on('closed', () => {
    if (kind === 'settings') settingsWindow = null;
    if (kind === 'prompt') promptEditorWindow = null;
    if (kind === 'classic') classicWindow = null;
  });
  if (kind === 'settings') settingsWindow = window;
  if (kind === 'prompt') promptEditorWindow = window;
  if (kind === 'classic') classicWindow = window;
  return window;
}

function createMenu() {
  const template = [
    { label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
    { label: '训练', submenu: [
      { label: 'Creator Pressure 总览', click: () => mainWindow?.loadFile(path.join(__dirname, 'index.html')) },
      { label: '原始诊断模式', click: () => createUtilityWindow('classic') },
      { type: 'separator' },
      { label: '训练规则', click: () => createUtilityWindow('prompt') },
      { label: '大模型配置', click: () => createUtilityWindow('settings') }
    ] },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '视图', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  loadLexicon();
  createMenu();
  createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('get-runtime-status', () => ({
  desktop: true,
  asr: getASRStatus(),
  llmConfigured: llmConfigured(),
  provider: loadSettings().provider,
  upstreamCommit: 'f925434'
}));
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('save-settings', (_event, settings) => {
  saveSettings(settings);
  BrowserWindow.getAllWindows().forEach(window => window.webContents.send('settings-updated'));
  return { success: true };
});
ipcMain.handle('open-settings', () => { createUtilityWindow('settings'); return { success: true }; });
ipcMain.handle('open-prompt-editor', () => { createUtilityWindow('prompt'); return { success: true }; });
ipcMain.handle('open-classic-mode', () => { createUtilityWindow('classic'); return { success: true }; });
ipcMain.handle('get-custom-prompt', () => loadCustomPrompt());
ipcMain.handle('save-custom-prompt', (_event, data) => {
  saveCustomPrompt(data);
  BrowserWindow.getAllWindows().forEach(window => window.webContents.send('custom-prompt-updated', data));
  return { success: true };
});
ipcMain.handle('close-current-window', event => { BrowserWindow.fromWebContents(event.sender)?.close(); });

ipcMain.handle('init-asr', async () => {
  try { await initASR(); asrReady = true; return { success: true }; }
  catch (error) { asrReady = false; return { success: false, error: error.message }; }
});
ipcMain.handle('feed-audio', (_event, samplesArray) => {
  if (!asrReady) return null;
  return feedAudio(Float32Array.from(samplesArray));
});
ipcMain.handle('stop-asr', () => {
  const finalText = asrReady ? stopRecognition() : '';
  asrReady = false;
  return { success: true, finalText };
});
ipcMain.handle('analyze-text', (_event, text) => analyzeText(text, loadCustomPrompt() || {}));
ipcMain.handle('test-llm-connection', async (_event, settings) => testConnection({ ...settings, ...currentProviderSettings(settings) }));
ipcMain.handle('get-realtime-feedback', async (_event, text) => {
  const settings = loadSettings();
  if (!llmConfigured(settings)) return { success: false, error: '请先配置大模型' };
  try { return { success: true, feedback: await sendFeedback(text, { ...settings, ...currentProviderSettings(settings) }, loadCustomPrompt()) }; }
  catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('get-final-report', async (_event, payload) => {
  const settings = loadSettings();
  if (!llmConfigured(settings)) return { success: false, error: '请先配置大模型' };
  try { return { success: true, report: await sendReport(payload.fullText, payload.stats, { ...settings, ...currentProviderSettings(settings) }, loadCustomPrompt()) }; }
  catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('get-optimized-script', async (_event, payload) => {
  const settings = loadSettings();
  if (!llmConfigured(settings)) return { success: false, error: '请先配置大模型' };
  try { return { success: true, script: await sendOptimizedScript(payload.fullText, { ...settings, ...currentProviderSettings(settings) }, loadCustomPrompt()) }; }
  catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('save-file', async (_event, content, filename) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存报告', defaultPath: path.join(app.getPath('desktop'), filename),
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: 'Text', extensions: ['txt'] }]
  });
  if (result.canceled || !result.filePath) return { success: false };
  fs.writeFileSync(result.filePath, content, 'utf8');
  return { success: true, path: result.filePath };
});
ipcMain.handle('save-recording', async (event, bytes, filename, mimeType) => {
  const byteLength = bytes?.byteLength ?? bytes?.length ?? 0;
  if (!byteLength || byteLength > 1_500_000_000) return { success: false, error: '录像文件无效或超过 1.5 GB。' };
  if (typeof filename !== 'string' || !/^read-yourself-practice-[\w.-]+\.webm$/i.test(filename)) {
    return { success: false, error: '录像文件名无效。' };
  }
  if (typeof mimeType !== 'string' || !mimeType.startsWith('video/webm')) {
    return { success: false, error: '当前只支持保存 WebM 录像。' };
  }
  const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showSaveDialog(owner, {
    title: '保存本轮练习视频',
    defaultPath: path.join(app.getPath('videos'), filename),
    filters: [{ name: 'WebM 视频', extensions: ['webm'] }]
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, Buffer.from(bytes));
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle('save-project-config', (_event, content) => {
  if (app.isPackaged) return { success: false, error: '打包版不能修改源代码项目，请改用“下载备份”。' };
  if (typeof content !== 'string' || content.length > 2_000_000 || !content.includes('window.CreatorProjectConfig =')) {
    return { success: false, error: '项目配置内容无效。' };
  }
  const targetPath = path.resolve(__dirname, 'creator-project-config.js');
  if (path.dirname(targetPath) !== path.resolve(__dirname)) return { success: false, error: '项目配置路径无效。' };
  try {
    fs.writeFileSync(targetPath, content, 'utf8');
    return { success: true, path: targetPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle('save-project-backup', (_event, content) => {
  if (app.isPackaged) return { success: false, unsupported: true, error: '打包版不能写入源码项目，请导出备份。' };
  try {
    if (typeof content !== 'string' || content.length > 2_000_000) throw new Error('备份内容无效。');
    const envelope = JSON.parse(content);
    if (envelope.version !== 1 || !envelope.config || typeof envelope.config !== 'object' || Array.isArray(envelope.config)) throw new Error('备份格式无效。');
    const targetPath = path.join(__dirname, 'docs', 'creator-pressure-config.json');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
    return { success: true, path: targetPath };
  } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('pick-local-live2d-avatar', async event => {
  const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const result = await dialog.showOpenDialog(owner, {
    title: '选择本地 Live2D 模型文件夹',
    properties: ['openDirectory'],
    buttonLabel: '登记此文件夹'
  });
  if (result.canceled || !result.filePaths?.[0]) return { success: false, canceled: true };
  try {
    const record = validateModelFolder(result.filePaths[0]);
    live2dFolderCache.set(record.id, record);
    const { folderPath: _privateFolderPath, ...publicRecord } = record;
    return { success: true, record: publicRecord };
  } catch (error) {
    return { success: false, error: error.message || '本地模型文件夹验证失败。' };
  }
});
function listBundledLive2DSamples() {
  if (!useLocalLive2DSample) return { success: false, unavailable: true, records: [] };
  const root = path.join(__dirname, 'local-runtime', 'Resources');
  if (!fs.existsSync(root)) return { success: false, error: '本机 Resources 目录不存在。', records: [] };
  const records = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const record = validateModelFolder(path.join(root, entry.name));
      live2dFolderCache.set(record.id, record);
      const { folderPath: _privateFolderPath, ...publicRecord } = record;
      records.push({ ...publicRecord, bundle: true });
    } catch (_) { /* skip non-model folders and invalid packages */ }
  }
  records.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en'));
  return { success: records.length > 0, records };
}
ipcMain.handle('get-local-live2d-dev-samples', () => listBundledLive2DSamples());
ipcMain.handle('get-local-live2d-dev-sample', () => {
  const listed = listBundledLive2DSamples();
  const record = listed.records?.find(item => item.name === 'Hiyori') || listed.records?.[0] || null;
  return record ? { success: true, record } : { success: false, unavailable: listed.unavailable === true, error: listed.error };
});
ipcMain.handle('get-local-live2d-session-info', (_event, recordId) => {
  const record = live2dFolderCache.get(String(recordId || ''));
  if (!record) return { success: false, authorized: false };
  return {
    success: true,
    authorized: true,
    name: record.name,
    modelFile: record.modelFile,
    folderPath: record.folderPath,
    source: record.source,
    fileCount: record.fileCount,
    totalBytes: record.totalBytes
  };
});
ipcMain.handle('read-local-live2d-asset', async (_event, recordId, relativePath) => {
  try {
    const record = live2dFolderCache.get(String(recordId || ''));
    if (!record) throw new Error('本次启动尚未授权读取该模型文件夹，请重新导入。');
    const asset = readValidatedAsset(record.folderPath, relativePath, { record });
    return { success: true, mime: asset.mime, bytes: asset.bytes };
  } catch (error) {
    return { success: false, error: error.message || '本地模型文件读取失败。' };
  }
});
