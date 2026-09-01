/** Browser-only, user-authorized project folder. Never included in exported settings. */
(() => {
  const targets = { project: 'creator-project-config.js', backup: 'docs/creator-pressure-config.json' };
  const key = new URL('.', location.href).pathname;
  let directory = null;
  let remembered = false;
  let db = null;
  const supported = () => typeof window.showDirectoryPicker === 'function';
  const emit = () => document.dispatchEvent(new CustomEvent('creator:save-location-change'));
  const ready = new Promise(resolve => {
    if (!window.indexedDB) return resolve();
    const request = indexedDB.open('creator-project-save-location', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('folders');
    request.onerror = request.onblocked = () => resolve();
    request.onsuccess = () => {
      db = request.result;
      db.onversionchange = () => { db.close(); db = null; };
      try {
        const transaction = db.transaction('folders', 'readonly');
        const lookup = transaction.objectStore('folders').get(key);
        lookup.onsuccess = () => { directory = lookup.result || null; remembered = !!directory; };
        transaction.oncomplete = () => { emit(); resolve(); };
        transaction.onerror = transaction.onabort = () => resolve();
      } catch (_) { resolve(); }
    };
  });
  async function remember(handle) {
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction('folders', 'readwrite');
        tx.objectStore('folders').put(handle, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }
  async function validate(handle) {
    try {
      const packageFile = await handle.getFileHandle('package.json');
      const pkg = JSON.parse(await (await packageFile.getFile()).text());
      const indexFile = await handle.getFileHandle('index.html');
      const html = await (await indexFile.getFile()).text();
      if (pkg.name !== 'expression-trainer-creator-pressure' || !/src=["'](?:\.\/)?creator-project-config\.js["']/.test(html)) throw new Error('not-project');
    } catch (_) {
      throw new Error('请选择包含 index.html、package.json 的项目根文件夹，不是 docs、下载或文档文件夹。原保存位置未更改。');
    }
  }
  async function bind() {
    if (!supported()) throw new Error('此浏览器不支持绑定文件夹，请用支持目录授权的浏览器或桌面开发版。');
    // Invoke the picker directly from the user's click, without a network request.
    const handle = await window.showDirectoryPicker({ id: 'creator-project-folder', mode: 'readwrite', ...(directory ? { startIn: directory } : {}) });
    await validate(handle);
    await ready;
    directory = handle;
    remembered = await remember(handle);
    emit();
    return info();
  }
  const info = () => ({ name: directory?.name || null, remembered, supported: supported(), targets });
  async function write(kind, content) {
    if (!Object.hasOwn(targets, kind)) throw new Error('不支持的配置文件。');
    await ready;
    if (!directory) await bind();
    const handle = directory;
    const permission = { mode: 'readwrite' };
    if (await handle.queryPermission(permission) !== 'granted' && await handle.requestPermission(permission) !== 'granted') {
      throw new Error('没有项目文件夹写入权限。请重新授权或更换保存目录；浏览器草稿仍保留。');
    }
    await validate(handle);
    const parent = kind === 'backup' ? await handle.getDirectoryHandle('docs', { create: true }) : handle;
    const filename = targets[kind].split('/').pop();
    const file = await parent.getFileHandle(filename, { create: true });
    const writable = await file.createWritable();
    try {
      await writable.write(content);
      await writable.close();
    } catch (error) {
      try { await writable.abort(); } catch (_) {}
      throw error;
    }
    if (await (await file.getFile()).text() !== content) throw new Error('写入后的校验未通过，请重试；浏览器草稿仍保留。');
    return { persisted: true, mode: 'directory', path: `${handle.name}/${targets[kind]}` };
  }
  window.CreatorConfigFiles = { ready, info, bind, write };
})();
