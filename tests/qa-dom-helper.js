const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const storageKey = 'expression-trainer.creator-qa.v1';
function makePage(page = 'index.html', { draft, project = {}, extraScripts = [], production = false, reducedMotion = false } = {}) {
  // Non-rendering DOM tests. No resources option: never fetch external assets.
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on('jsdomError', error => { errors.push(error); });
  const dom = new JSDOM(read(page), { url: `https://qa.invalid/${page}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  dom.qaErrors = errors;
  const { window } = dom;
  const motionQuery = new window.EventTarget();
  motionQuery.matches = reducedMotion;
  motionQuery.media = '(prefers-reduced-motion: reduce)';
  window.matchMedia = query => query === motionQuery.media ? motionQuery : { matches: false, addEventListener() {}, removeEventListener() {} };
  dom.setReducedMotion = value => {
    motionQuery.matches = value;
    motionQuery.dispatchEvent(new window.Event('change'));
  };
  // JSDOM does not render the top layer. This shim only exposes the real
  // app-generated dialog DOM; it does not verify native modality/focus trapping.
  if (typeof window.HTMLDialogElement?.prototype.showModal !== 'function') {
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  }
  if (production) window.document.body.dataset.environment = 'production';
  for (const link of window.document.querySelectorAll('link[rel="stylesheet"]')) {
    const sheet = window.document.createElement('style');
    sheet.textContent = read(link.getAttribute('href'));
    window.document.head.append(sheet);
  }
  // Unit tests use explicit fixtures, not the founder's changing shipped
  // palette/copy. Shipped-config integration passes that file in as `project`.
  window.CreatorProjectConfig = { version: 1, savedAt: null, config: project };
  if (draft) window.localStorage.setItem(storageKey, JSON.stringify(draft));
  for (const script of ['brand-logo.js', 'product-shell.js', 'vertical-marquee-config.js', 'qa-element-editor.js', 'config-file-store.js', 'control-panel.js', ...extraScripts]) window.eval(read(script));
  return dom;
}
function input(window, path, value) {
  const node = window.document.querySelector(`[data-path="${path}"]`);
  if (!node) throw new Error(`Missing control: ${path}`);
  if (node.type === 'checkbox') node.checked = value; else node.value = value;
  node.dispatchEvent(new window.Event('input', { bubbles: true }));
  return node;
}
module.exports = { read, root, storageKey, makePage, input };
