/** Local-only Live2D folder import for the open-source desktop/local build.
 *  This module deliberately has no upload, account, network, or community path.
 */
(() => {
  const validator = window.CreatorLocalLive2DValidator;
  const STORAGE_KEY = 'expression-trainer.local-avatar.v1';
  const SELECTED_KEY = 'expression-trainer.local-avatar.selected.v1';
  const DEV_SAMPLE_PATH = 'local-runtime/Resources';
  const MAX_RECORDS = 32;
  const HIDDEN_KEY = 'expression-trainer.local-avatar.hidden.v1';
  const DB_NAME = 'expression-trainer.local-avatar.v1';
  const DB_STORE = 'folders';
  let dbPromise;
  let mounted = new WeakSet();
  let devSampleRequested = false;

  const isLocalEnvironment = () => {
    if (document.body?.dataset.environment === 'production') return false;
    const host = String(window.location?.hostname || '').toLowerCase();
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    return Boolean(window.api?.pickLocalLive2DAvatar || loopback);
  };

  function readRecords() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      const records = value
        .filter(item => item && item.source === 'local-folder')
        .map(item => {
          const { folderPath: _legacyAbsolutePath, ...safeRecord } = item;
          return safeRecord;
        });
      if (value.some(item => item && Object.hasOwn(item, 'folderPath'))) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
      }
      return records;
    } catch (_) { return []; }
  }

  function writeRecords(records) {
    const safeRecords = records.map(item => {
      const { folderPath: _absolutePath, ...safeRecord } = item;
      return safeRecord;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeRecords.slice(-MAX_RECORDS)));
  }

  function register(record) {
    const records = readRecords().filter(item => item.id !== record.id);
    records.push({ ...record, source: 'local-folder' });
    writeRecords(records);
    renderAll();
    return record;
  }

  function upsert(record) {
    register(record);
    writeHidden(readHidden().filter(id => id !== record.id));
    localStorage.setItem(SELECTED_KEY, record.id);
    return record;
  }

  function selectedId() { return localStorage.getItem(SELECTED_KEY) || ''; }

  function readHidden() {
    try {
      const value = JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
      return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
    } catch (_) { return []; }
  }

  function writeHidden(ids) {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...new Set(ids)]));
  }

  function visibleRecords() {
    const hidden = new Set(readHidden());
    return readRecords().filter(record => !hidden.has(record.id));
  }

  function renderAll() {
    document.querySelectorAll('.local-avatar-import').forEach(renderRecords);
  }

  async function forgetHandle(id) {
    const db = await openDb();
    if (!db || !id) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }

  function removeFromList(id) {
    const recordId = String(id || '');
    if (!recordId) return false;
    const record = readRecords().find(item => item.id === recordId);
    if (!record) return false;
    if (record.bundle) writeHidden([...readHidden(), recordId]);
    else {
      writeRecords(readRecords().filter(item => item.id !== recordId));
      forgetHandle(recordId);
    }
    if (selectedId() === recordId) clearSelection();
    else renderAll();
    return true;
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    if (!window.indexedDB) return Promise.resolve(null);
    dbPromise = new Promise(resolve => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
      request.onerror = request.onblocked = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
    });
    return dbPromise;
  }

  async function rememberHandle(id, handle) {
    const db = await openDb();
    if (!db || !handle) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(handle, id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }

  async function restoreHandle(id) {
    const db = await openDb();
    if (!db || !id) return null;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(DB_STORE, 'readonly');
        const request = tx.objectStore(DB_STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }

  async function ensurePermission(handle) {
    if (!handle) return false;
    if (typeof handle.queryPermission !== 'function') return true;
    const current = await handle.queryPermission({ mode: 'read' });
    if (current === 'granted') return true;
    if (typeof handle.requestPermission !== 'function') return false;
    return (await handle.requestPermission({ mode: 'read' })) === 'granted';
  }

  async function fileFromHandle(rootHandle, relativePath) {
    const parts = String(relativePath || '').split('/').filter(Boolean);
    if (!parts.length) throw new Error('模型引用必须是文件夹内的相对路径。');
    let directory = rootHandle;
    for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
    const fileHandle = await directory.getFileHandle(parts[parts.length - 1]);
    return fileHandle.getFile();
  }

  function bytesFromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function readFile(record, relativePath) {
    const cleaned = validator?.cleanRelativePath(relativePath);
    if (!cleaned) throw new Error(`模型引用必须是文件夹内的相对路径：${relativePath}`);
    if (typeof window.api?.readLocalLive2DAsset === 'function' && record?.id) {
      const result = await window.api.readLocalLive2DAsset(record.id, cleaned);
      if (!result?.success) throw new Error(result?.error || `模型文件读取失败：${cleaned}`);
      if (result.bytes instanceof Uint8Array) return { bytes: result.bytes, mime: result.mime };
      if (ArrayBuffer.isView(result.bytes)) return { bytes: new Uint8Array(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength), mime: result.mime };
      if (result.bytes instanceof ArrayBuffer) return { bytes: new Uint8Array(result.bytes), mime: result.mime };
      if (typeof result.base64 === 'string') return { bytes: bytesFromBase64(result.base64), mime: result.mime };
      throw new Error(`模型文件读取失败：${cleaned}`);
    }
    const handle = await restoreHandle(record?.id);
    if (!handle || !(await ensurePermission(handle))) throw new Error('无法读取本地模型文件夹，请重新导入。');
    const file = await fileFromHandle(handle, cleaned);
    return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type || validator?.mimeFor?.(cleaned) };
  }

  async function collectHandleFiles(handle, prefix = '') {
    const files = [];
    for await (const [name, entry] of handle.entries()) {
      const relative = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'directory') files.push(...await collectHandleFiles(entry, relative));
      else if (entry.kind === 'file') {
        const file = await entry.getFile();
        files.push({ path: relative, file, size: file.size });
      }
    }
    return files;
  }

  async function importFromHandle(handle) {
    if (!handle || handle.kind !== 'directory') throw new Error('请选择本地 Live2D 模型文件夹，不接受 zip 文件。');
    const files = await collectHandleFiles(handle);
    if (files.length > (validator?.LIMITS.maxFileCount || 2048)) throw new Error('模型文件数量超过 2048 个上限。');
    const manifests = files.filter(file => validator?.isModelManifest(file.path));
    if (manifests.length !== 1) throw new Error(`模型文件夹必须且只能包含一个 .model3.json（当前 ${manifests.length} 个）。`);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const limits = validator?.LIMITS || { maxManifestBytes: 1e6, maxFileBytes: 50 * 1024 * 1024, maxTotalBytes: 250 * 1024 * 1024 };
    if (totalBytes > limits.maxTotalBytes) throw new Error('模型文件夹超过 250 MB 总大小上限。');
    const tooLarge = files.find(file => file.size > limits.maxFileBytes);
    if (tooLarge) throw new Error(`文件超过 50 MB 上限：${tooLarge.path}`);
    if (files.some(file => validator?.FORBIDDEN_EXTENSIONS.has(validator.fileExtension(file.path)))) throw new Error('模型文件夹不允许包含脚本或 HTML。');
    const manifestFile = manifests[0];
    if (manifestFile.size > limits.maxManifestBytes) throw new Error('模型清单超过 1 MB 上限。');
    let manifest;
    try { manifest = JSON.parse(await manifestFile.file.text()); } catch (_) { throw new Error('模型清单不是有效 JSON。'); }
    const checked = validator.validateManifest(manifest, manifestFile.path, files.map(file => file.path));
    const id = `local-${cryptoRandomId()}`;
    const record = { id, name: handle.name || '本地 Live2D', modelFile: checked.modelFile, references: checked.references, fileCount: files.length, totalBytes, source: 'local-folder', importedAt: new Date().toISOString() };
    await rememberHandle(id, handle);
    return upsert(record);
  }

  function cryptoRandomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replaceAll('-', '').slice(0, 20);
    return Math.random().toString(36).slice(2, 22);
  }

  function canUseDirectoryPicker() { return typeof window.showDirectoryPicker === 'function'; }

  async function choose() {
    if (!isLocalEnvironment()) throw new Error('正式网站不提供本地模型上传。请安装 GitHub 项目并在本机运行。');
    if (typeof window.api?.pickLocalLive2DAvatar === 'function') {
      const result = await window.api.pickLocalLive2DAvatar();
      if (!result?.success) {
        if (result?.canceled) return null;
        throw new Error(result?.error || '本地模型文件夹验证失败。');
      }
      return upsert(result.record);
    }
    if (!canUseDirectoryPicker()) throw new Error('当前本地环境不支持目录授权，请使用 Electron 或支持目录授权的浏览器。');
    const handle = await window.showDirectoryPicker({ id: 'creator-local-live2d', mode: 'read' });
    return importFromHandle(handle);
  }

  function select(id) {
    if (!visibleRecords().some(record => record.id === id)) return false;
    localStorage.setItem(SELECTED_KEY, id);
    applySelectedAdapter();
    renderAll();
    document.dispatchEvent(new CustomEvent('creator:local-avatar-selection-change', { detail: { id } }));
    return true;
  }

  function clearSelection() {
    localStorage.removeItem(SELECTED_KEY);
    applySelectedAdapter();
    renderAll();
    document.dispatchEvent(new CustomEvent('creator:local-avatar-selection-change', { detail: { id: '' } }));
    return true;
  }

  function selected() { return visibleRecords().find(record => record.id === selectedId()) || null; }

  async function describeSession(recordId) {
    const id = String(recordId || selectedId() || '');
    if (typeof window.api?.getLocalLive2DSessionInfo === 'function' && id) {
      const result = await window.api.getLocalLive2DSessionInfo(id);
      if (result?.success && result.folderPath) {
        return { folderPath: result.folderPath, modelFile: result.modelFile, name: result.name, source: result.source || 'session' };
      }
    }
    const record = readRecords().find(item => item.id === id) || selected();
    if (record?.bundle || record?.name === 'Hiyori') {
      return { sampleHint: `本机样例目录：项目内 ${DEV_SAMPLE_PATH}/${record.name || ''}（仅 npm run dev:live2d 授权）`, modelFile: record.modelFile, name: record.name, source: 'dev-sample' };
    }
    if (record) {
      return { sampleHint: '绝对路径只保存在本次 Electron 会话或浏览器目录授权中，页面 localStorage 不含文件夹路径。', modelFile: record.modelFile, name: record.name, source: record.source };
    }
    return { sampleHint: `尚未选择模型。本机样例在 ${DEV_SAMPLE_PATH}。` };
  }

  function adapterStatusMessage(record, status) {
    if (status === 'ready') return `${record.name} 已在本机绘制。形象只改变外观，不改变判断。`;
    if (status === 'webgl-unavailable') return `${record.name} 已登记，但当前环境无法使用 WebGL，已恢复默认 bloub 观众。`;
    if (status === 'model-load-failed') return `${record.name} 已登记，但模型加载或逐帧运行失败，已恢复默认 bloub 观众。`;
    if (status === 'folder-access-expired') return `${record.name} 仍在本机列表中，但本次启动尚未获得文件夹读取权限。请重新导入该文件夹。`;
    if (status === 'cubism-core-missing') return `${record.name} 已登记。未找到本机 Cubism Core，已恢复默认 bloub 观众。`;
    if (status === 'cubism-framework-missing') return `${record.name} 已登记。未找到本机官方 Cubism Web Framework 运行桥，已恢复默认 bloub 观众。`;
    return `${record.name} 已安全登记在本机。`;
  }

  async function applySelectedAdapter() {
    const record = selected();
    const pending = [];
    document.querySelectorAll('.audience-tile').forEach(tile => {
      const stage = tile.querySelector('[data-v2-audience-stage]');
      if (!stage || !window.CreatorAudienceStage?.attachAdapter) return;
      const current = stage._audienceAdapter;
      if (!record) {
        if (current) window.CreatorAudienceStage.detachAdapter(stage);
        return;
      }
      if (current?.kind === 'local-live2d' && current.record?.id === record.id) {
        if (current.ready) pending.push(current.ready);
        return;
      }
      const adapter = window.CreatorAudienceStage.createLocalAdapter(record);
      window.CreatorAudienceStage.attachAdapter(stage, adapter);
      if (adapter?.ready) pending.push(adapter.ready);
    });
    await Promise.all(pending);
  }

  function renderRecords(host) {
    const local = isLocalEnvironment();
    const records = local ? visibleRecords() : [];
    const current = selectedId();
    const currentRecord = records.find(record => record.id === current) || null;
    const currentKind = host.querySelector('[data-local-avatar-current-kind]');
    const toggle = host.querySelector('[data-local-avatar-toggle]');
    if (toggle) toggle.textContent = currentRecord?.name || '默认表情 bloub';
    if (currentKind) currentKind.textContent = currentRecord ? 'Live2D · 本机读取' : '它不是 Live2D · 已保留表情反馈';
    const list = host.querySelector('[data-local-avatar-list]');
    if (!list) return;
    const row = (id, name, removable) => `<li class="local-avatar-row${id === current ? ' is-selected' : ''}"><button type="button" class="local-avatar-pick" data-local-avatar-pick="${escapeHtml(id)}">${escapeHtml(name)}</button>${removable ? `<button type="button" class="local-avatar-remove" data-local-avatar-remove="${escapeHtml(id)}" aria-label="从列表移除 ${escapeHtml(name)}">删除</button>` : ''}</li>`;
    const bundled = records.filter(record => record.bundle);
    const imported = records.filter(record => !record.bundle);
    list.innerHTML = [
      row('', '默认表情 bloub', false),
      bundled.length ? `<li class="local-avatar-group" aria-hidden="true">本机 Resources</li>${bundled.map(record => row(record.id, record.name, true)).join('')}` : '',
      imported.length ? `<li class="local-avatar-group" aria-hidden="true">已导入</li>${imported.map(record => row(record.id, record.name, true)).join('')}` : ''
    ].join('');
  }

  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

  function mount(host) {
    if (!host || mounted.has(host)) return;
    mounted.add(host);
    const local = isLocalEnvironment();
    const panel = document.createElement('section');
    panel.className = 'local-avatar-import';
    panel.dataset.availability = local ? 'available' : 'local-app-required';
    panel.innerHTML = `<div class="local-avatar-import-head"><h4>本地 Live2D</h4><p>${local ? '只在本机使用、只登记在本机。点「当前形象」展开列表选择或删除；导入的文件夹会出现在同一份列表。文件不会上传。' : '网页版本不读取模型或 Cubism Core，请使用 GitHub 本机版。'}</p></div><div class="local-avatar-current"><span>当前形象</span><button type="button" class="local-avatar-toggle" data-local-avatar-toggle ${local ? '' : 'disabled'} aria-expanded="false">默认表情 bloub</button><small data-local-avatar-current-kind>它不是 Live2D · 已保留表情反馈</small><ul class="local-avatar-menu" data-local-avatar-list hidden></ul></div><button type="button" class="ghost-btn local-avatar-import-button" data-local-avatar-import ${local ? '' : 'disabled aria-disabled="true"'}>${local ? '选择本地模型文件夹' : '仅 GitHub 本机版可导入'}</button><div class="local-avatar-status" data-local-avatar-status role="status" aria-live="polite">${local ? '支持 Electron 或 localhost 浏览器。' : '本机启动：npm run dev:live2d'}</div>`;
    host.append(panel);
    renderRecords(panel);
    const toggle = panel.querySelector('[data-local-avatar-toggle]');
    const menu = panel.querySelector('[data-local-avatar-list]');
    const setOpen = open => {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', () => { if (!toggle.disabled) setOpen(menu.hidden); });
    menu.addEventListener('click', event => {
      const remove = event.target.closest('[data-local-avatar-remove]');
      if (remove) {
        event.preventDefault();
        removeFromList(remove.dataset.localAvatarRemove);
        return;
      }
      const pick = event.target.closest('[data-local-avatar-pick]');
      if (!pick) return;
      const id = pick.dataset.localAvatarPick;
      if (!id) clearSelection();
      else select(id);
      setOpen(false);
    });
    document.addEventListener('click', event => {
      if (!panel.contains(event.target)) setOpen(false);
    });
    panel.querySelector('[data-local-avatar-import]').addEventListener('click', async event => {
      const button = event.currentTarget;
      const status = panel.querySelector('[data-local-avatar-status]');
      button.disabled = true;
      status.textContent = '请选择包含单一 .model3.json 的本地文件夹…';
      try {
        const record = await choose();
        if (record) {
          renderAll();
          await applySelectedAdapter();
          const stage = document.querySelector('[data-v2-audience-stage]');
          status.textContent = adapterStatusMessage(record, stage?._audienceAdapter?.status || stage?.dataset.adapterStatus);
        } else status.textContent = '已取消，未改变当前形象。';
      } catch (error) { status.textContent = error.message; }
      button.disabled = false;
    });
  }

  async function loadBundledSamples() {
    const api = window.api?.getLocalLive2DDevSamples || window.api?.getLocalLive2DDevSample;
    if (devSampleRequested || typeof api !== 'function') return;
    devSampleRequested = true;
    try {
      const result = await api();
      const records = Array.isArray(result?.records) ? result.records : (result?.record ? [result.record] : []);
      if (!result?.success || !records.length) return;
      records.forEach(record => register({ ...record, bundle: true }));
      renderAll();
      const current = selected();
      if (current) await applySelectedAdapter();
      const stage = document.querySelector('[data-v2-audience-stage]');
      const statusMessage = current
        ? adapterStatusMessage(current, stage?._audienceAdapter?.status || stage?.dataset.adapterStatus || 'loading')
        : `已载入 ${records.length} 个本机 Resources 模型，点「当前形象」选择。`;
      document.querySelectorAll('[data-local-avatar-status]').forEach(status => {
        status.textContent = statusMessage;
      });
    } catch (_) { /* An optional development sample never blocks normal import. */ }
  }

  async function selectAuthorizedDevSample() {
    await loadBundledSamples();
    const records = readRecords();
    const preferred = records.find(record => record.name === 'Hiyori') || records.find(record => record.bundle) || records[0];
    if (preferred && !selectedId()) return;
    return preferred || null;
  }

  function scan() {
    const anchors = document.querySelectorAll('[data-local-avatar-anchor]');
    if (anchors.length) anchors.forEach(mount);
    else if (isLocalEnvironment()) document.querySelectorAll('.audience-config').forEach(mount);
    if (isLocalEnvironment()) {
      applySelectedAdapter();
      loadBundledSamples();
    }
  }

  const observer = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
  if (observer) observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
  document.addEventListener('creator:local-avatar-stage-ready', applySelectedAdapter);

  window.CreatorLocalAvatarImport = { STORAGE_KEY, SELECTED_KEY, HIDDEN_KEY, DEV_SAMPLE_PATH, isLocalEnvironment, readRecords, visibleRecords, selected, choose, importFromHandle, register, upsert, select, clearSelection, removeFromList, readFile, mount, scan, applySelectedAdapter, loadBundledSamples, selectAuthorizedDevSample, describeSession, adapterStatusMessage };
})();
