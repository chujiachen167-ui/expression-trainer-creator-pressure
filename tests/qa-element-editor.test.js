const assert = require('node:assert/strict');
const { makePage, input, read, storageKey } = require('./qa-dom-helper');
const tick = () => new Promise(resolve => setImmediate(resolve));
const runtimeScripts = ['expression-analysis.js', 'v1-controls.js', 'v1-topic-picker.js', 'audience-templates.js', 'avatar-provider.js', 'avatar-selector.js', 'interest-curve.js', 'stt-audio.js', 'app.js'];
function select(window, node, area = 'ui') {
  window.document.querySelector(`[data-qa-fine-${area}] [data-qa-rescan]`).click();
  const picker = window.document.querySelector(`[data-qa-fine-${area}] [data-qa-target]`);
  picker.value = window.CreatorElementEditor.selectorFor(node);
  picker.dispatchEvent(new window.Event('change', { bubbles: true }));
}
function styleInput(window, key, value) {
  const control = window.document.querySelector(`[data-qa-style="${key}"]`);
  control.value = value;
  control.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function editText(window, node, value, slotType = 'text', slot) {
  select(window, node, 'copy');
  const field = window.CreatorElementEditor.copyFields(node).find(item => item.type === slotType && (slot == null || item.slot === slot));
  assert(field, 'target must expose the requested copy field');
  const textarea = [...window.document.querySelectorAll('[data-qa-fine-copy-fields] textarea')].find(item => item.getAttribute('aria-label') === `${field.label} ${field.slot}`);
  textarea.value = value;
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
}
async function run() {
  const coverage = [];
  for (const page of ['index.html', 'v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
    const extraScripts = page === 'index.html' ? ['vendor/magic-ui/marquee.js', 'launcher-transcript.js'] : runtimeScripts;
    const dom = makePage(page, { extraScripts });
    const { window } = dom;
    const doc = window.document;
    for (const asset of doc.querySelectorAll('script[src], link[rel="stylesheet"]')) {
      const file = (asset.getAttribute('src') || asset.getAttribute('href')).split('?')[0];
      assert(read(file).length > 0, `${page}: linked local asset must exist: ${file}`);
    }
    await tick();
    if (page === 'v2-ai-audience.html' || page === 'v3-creator-studio.html') {
      window.CreatorAvatarSelector.open({ max: page.startsWith('v3') ? 3 : 1 });
      assert(doc.querySelector('.avatar-selector-dialog'), 'late-created audience dialog must be audited too');
      await tick();
    }
    const inventory = window.CreatorQAControls.inspectElements();
    const targets = [doc.body, ...doc.body.querySelectorAll('*')].filter(window.CreatorElementEditor.eligible);
    assert.equal(inventory.length, targets.length, `${page}: all owned DOM elements should be discoverable`);
    for (const node of targets) {
      const selector = window.CreatorElementEditor.selectorFor(node);
      assert.equal(doc.querySelector(selector), node, `${page}: selector must locate exactly its element: ${selector}`);
    }
    const h1 = doc.querySelector('h1');
    const selector = window.CreatorElementEditor.selectorFor(h1);
    const legacyKey = h1.dataset.qaCopyKey;
    select(window, h1);
    styleInput(window, 'color', '#123456');
    styleInput(window, 'font-size', '43');
    styleInput(window, 'x', '12');
    styleInput(window, 'y', '-7');
    styleInput(window, 'background-color', 'transparent');
    const sheet = doc.querySelector('style[data-qa-editor-owned]');
    assert(sheet.textContent.includes(`${selector} {`));
    assert(sheet.textContent.includes('color:#123456!important'));
    assert(sheet.textContent.includes('translate:12px -7px!important'));
    assert(sheet.textContent.includes('background-color:transparent!important'));
    const part = doc.querySelector('[data-qa-part]'); part.value = 'hover'; part.dispatchEvent(new window.Event('change'));
    styleInput(window, 'color', '#abcdef');
    assert(sheet.textContent.includes(`${selector}:hover {color:#abcdef!important}`));
    part.value = 'before'; part.dispatchEvent(new window.Event('change'));
    styleInput(window, 'background-color', '#fedcba');
    assert(sheet.textContent.includes(`${selector}::before {background-color:#fedcba!important}`));

    const late = doc.createElement('div'); late.id = 'late-test';
    late.innerHTML = '<label><span>额外文案 <small>小提示</small></span><input placeholder="待填写"></label>';
    doc.querySelector('main').append(late);
    window.CreatorQAControls.refreshCopyLibrary();
    assert.equal(h1.dataset.qaCopyKey, legacyKey, 'late-inserted copy must not renumber founder keys');
    const label = late.querySelector('span');
    editText(window, label, '新文案 ');
    assert.equal(label.childNodes[0].data, '新文案 ');
    assert.equal(label.querySelector('small').textContent, '小提示', 'editing mixed text must preserve child markup');
    const formInput = late.querySelector('input'); formInput.value = 'NEVER-EXPORT-PRIVATE-VALUE';
    editText(window, formInput, '新的占位提示', 'attribute', 'placeholder');
    assert.equal(formInput.placeholder, '新的占位提示');
    assert(!JSON.stringify(window.CreatorQAControls.getState()).includes('NEVER-EXPORT-PRIVATE-VALUE'));

    const button = doc.querySelector('[data-camera-toggle]') || doc.querySelector('.version-card');
    let clicked = false;
    button.addEventListener('click', () => { clicked = true; });
    doc.querySelector('[data-qa-fine-ui] [data-qa-pick]').click();
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.equal(clicked, false, 'inspection click must not start camera or navigate');
    assert.equal(doc.querySelector('[data-qa-fine-ui] [data-qa-target]').value, window.CreatorElementEditor.selectorFor(button));
    doc.querySelector('[data-qa-fine-ui] [data-qa-pick]').click();
    doc.querySelector('.qa-close').click();
    let ordinaryClick = false;
    h1.addEventListener('click', () => { ordinaryClick = true; }, { once: true });
    h1.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert(ordinaryClick, 'closing the QA panel must exit inspection mode');

    if (page !== 'index.html') {
      const timer = doc.querySelector('#timer'); timer.textContent = '00:37';
      const status = doc.querySelector('#statusText'); status.textContent = '正在转写';
      const transcript = doc.querySelector('#liveTranscript'); transcript.textContent = '真实转写结果';
      assert(!window.CreatorElementEditor.copyFields(timer).some(field => field.type === 'text'));
      assert(!window.CreatorElementEditor.copyFields(transcript).some(field => field.type === 'text'));
      const camera = doc.querySelector('[data-camera-toggle]');
      camera.innerHTML = '<span class="control-indicator"></span>关闭摄像头';
      input(window, 'theme.accent', '#ee5577');
      assert.equal(timer.textContent, '00:37');
      assert.equal(status.textContent, '正在转写');
      assert.equal(transcript.textContent, '真实转写结果');
      assert.equal(camera.textContent, '关闭摄像头', 'UI color changes must not revert a running button caption');
      const p = doc.querySelector('#sessionPrompt');
      p.textContent = '运行中的训练题'; input(window, 'theme.info', '#668899');
      assert.equal(p.textContent, '运行中的训练题');
      const summary = doc.querySelector('[data-audience-summary]');
      if (summary) {
        summary.innerHTML = '<strong>更新后的领域</strong><span>更新后的受众目标</span>';
        input(window, 'theme.warning', '#bb8844');
        assert.equal(summary.textContent, '更新后的领域更新后的受众目标');
      }
    }
    if (page === 'v1-camera-baseline.html') {
      const extra = doc.querySelector('[data-rule-words]');
      assert(extra, 'real V1 rules dialog must be included');
      editText(window, extra, '可自定义提示', 'attribute', 'placeholder');
      assert.equal(extra.placeholder, '可自定义提示');
    }
    if (page === 'v3-creator-studio.html') {
      const scenario = doc.querySelector('[data-prompt]');
      editText(window, scenario, '人工自定义训练题', 'attribute', 'data-prompt');
      assert.equal(scenario.dataset.prompt, '人工自定义训练题');
    }
    select(window, h1);
    const draft = JSON.parse(window.localStorage.getItem(storageKey));
    assert(draft.fineTune[doc.body.dataset.mode || 'launcher'][selector]);
    const restored = makePage(page, { draft });
    assert(restored.window.document.querySelector('style[data-qa-editor-owned]').textContent.includes('color:#123456!important'));
    restored.window.close();
    let saved;
    window.api = { saveProjectConfig: async content => { saved = content; return { success: true, path: 'test-only.js' }; } };
    doc.querySelector('[data-qa-save-project]').click();
    await tick();
    assert(saved.includes('fineTune') && saved.includes('extraCopy'), 'project export must include both editing layers');
    assert(!saved.includes('NEVER-EXPORT-PRIVATE-VALUE'));
    doc.querySelector('[data-qa-reset-element]').click();
    assert(!sheet.textContent.includes(selector + ' {'), 'element reset must remove only selected styles');
    await tick();
    assert.equal(dom.qaErrors.length, 0, `${page}: no DOM runtime errors`);
    coverage.push({ page, editableDOMElements: inventory.length, textAndAttributeFields: inventory.reduce((count, item) => count + item.copyFields, 0) });
    dom.window.close();
  }
  console.log('QA coverage (DOM, not rendered visibility):', JSON.stringify(coverage));
  assert(read('qa-element-editor.js').includes('Never edits input values or diagnostics'));
  console.log('Element editor: four-page asset references, coverage, precise selectors, state/pseudo styling, safe mixed copy, legacy-key stability, persistence and non-activating picker passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
