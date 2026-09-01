const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../config-file-store.js'), 'utf8');

// File-system/IndexedDB boundary fakes: exercise real app code without touching user files.
function projectFolder(name = 'my-project') {
  const files = new Map([
    ['package.json', '{"name":"expression-trainer-creator-pressure"}'],
    ['index.html', '<script src="creator-project-config.js"></script>'],
    ['creator-project-config.js', 'old JS']
  ]);
  const writes = [];
  const folder = {
    name, files, writes, permission: 'granted', failWrite: false,
    queryPermission: async () => folder.permission,
    requestPermission: async () => folder.permission,
    getDirectoryHandle: async name => {
      assert.equal(name, 'docs');
      return { getFileHandle: (name, options) => folder.getFileHandle(`docs/${name}`, options) };
    },
    getFileHandle: async (filename, options) => {
      if (!files.has(filename) && !options?.create) throw new Error('NotFound');
      return {
        getFile: async () => ({ text: async () => files.get(filename) }),
        createWritable: async () => {
          let staged;
          return {
            write: async value => { if (folder.failWrite) throw new Error('disk full'); staged = value; },
            close: async () => { files.set(filename, staged); writes.push(filename); },
            abort: async () => {}
          };
        }
      };
    }
  };
  return folder;
}
function fakeDatabase() {
  const records = new Map();
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            const tx = { objectStore: () => ({
              get(key) { const lookup = {}; queueMicrotask(() => { lookup.result = records.get(key); lookup.onsuccess(); tx.oncomplete(); }); return lookup; },
              put(value, key) { records.set(key, value); queueMicrotask(() => tx.oncomplete()); }
            }) };
            return tx;
          }
        };
        request.onsuccess();
      });
      return request;
    }
  };
}
function boot(folder, indexedDB) {
  let selections = 0;
  const context = {
    URL, location: { href: 'http://localhost:8766/index.html' }, indexedDB,
    document: { dispatchEvent() {} }, CustomEvent: class {},
    showDirectoryPicker: async options => { selections++; assert.equal(options.mode, 'readwrite'); return folder; }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return { store: context.CreatorConfigFiles, context, selections: () => selections };
}
async function run() {
  const folder = projectFolder();
  const database = fakeDatabase();
  const first = boot(folder, database);
  await first.store.ready;
  assert.equal(first.selections(), 0, 'loading must not request directory permission');
  await first.store.bind();
  assert.deepEqual(folder.writes, [], 'binding must not write any files');
  assert.equal(first.store.info().remembered, true);
  await first.store.write('project', 'saved JS');
  await first.store.write('backup', '{"config":{"all":"parameters"}}');
  await first.store.write('project', 'newer JS');
  assert.equal(folder.files.get('creator-project-config.js'), 'newer JS');
  assert.equal(folder.files.get('docs/creator-pressure-config.json'), '{"config":{"all":"parameters"}}');
  assert.deepEqual(folder.writes, ['creator-project-config.js', 'docs/creator-pressure-config.json', 'creator-project-config.js']);
  assert.equal(first.selections(), 1, 'repeat saves must not reopen a save picker');
  const reloaded = boot(folder, database);
  await reloaded.store.ready;
  assert.equal(reloaded.store.info().name, 'my-project', 'folder survives a page reload');
  await reloaded.store.write('backup', 'updated JSON');
  assert.equal(reloaded.selections(), 0, 'restored handle is reused');

  const wrong = projectFolder('docs');
  wrong.files.delete('package.json');
  reloaded.context.showDirectoryPicker = async () => wrong;
  await assert.rejects(reloaded.store.bind(), /项目根文件夹/);
  assert.equal(reloaded.store.info().name, folder.name, 'invalid selection must preserve the old binding');
  assert.equal(wrong.writes.length, 0);
  reloaded.context.showDirectoryPicker = async () => { throw Object.assign(new Error('cancel'), { name: 'AbortError' }); };
  await assert.rejects(reloaded.store.bind(), { name: 'AbortError' });
  assert.equal(reloaded.store.info().name, folder.name);
  folder.permission = 'denied';
  await assert.rejects(reloaded.store.write('project', 'denied JS'), /权限/);
  assert.equal(folder.files.get('creator-project-config.js'), 'newer JS');
  folder.permission = 'granted'; folder.failWrite = true;
  await assert.rejects(reloaded.store.write('project', 'broken JS'), /disk full/);
  assert.equal(folder.files.get('creator-project-config.js'), 'newer JS', 'failed stream must not replace saved file');
  await assert.rejects(reloaded.store.write('../evil', 'bad'), /不支持/);

  const session = boot(projectFolder('session'), undefined);
  await session.store.bind();
  assert.equal(session.store.info().remembered, false, 'unavailable storage must not claim durable binding');
  for (const page of ['index.html', 'v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert(html.indexOf('config-file-store.js') < html.indexOf('control-panel.js'));
    assert(html.includes('config-file-store.js'));
  }
  console.log('Fixed folder saves: two exact targets, replacement, reload reuse, no writes on bind, wrong folder/cancel/denial/disk failure, storage fallback and all-page wiring passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
