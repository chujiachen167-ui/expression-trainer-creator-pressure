const assert = require('node:assert/strict');
const { makePage, input, read, storageKey } = require('./qa-dom-helper');
const tick = () => new Promise(resolve => setImmediate(resolve));
const rulesKey = 'expression-trainer.v1-controls';
const topicKey = 'expression-trainer.v1-topic';
function mount({ saved, topic, api, qaDraft } = {}) {
  const dom = makePage('v1-camera-baseline.html', { draft: qaDraft });
  const w = dom.window;
  if (saved) w.localStorage.setItem(rulesKey, JSON.stringify(saved));
  if (topic) w.localStorage.setItem(topicKey, JSON.stringify(topic));
  if (api) w.api = api;
  for (const file of ['expression-analysis.js', 'v1-controls.js', 'v1-topic-picker.js', 'app.js']) w.eval(read(file));
  return dom;
}
function change(w, id, value) {
  const node = w.document.getElementById(id); node.value = value;
  node.dispatchEvent(new w.Event(node.tagName === 'TEXTAREA' ? 'input' : 'change', { bubbles: true }));
}
async function submit(w) {
  w.document.getElementById('v1TopicForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
}
async function run() {
  const dom = mount({ saved: { rules: { goal: '我自己的旧选题', customWords: '咱就是说', customRules: '先说结论', styleReference: '自然' } } });
  const w = dom.window, d = w.document;
  await tick();
  const picker = d.getElementById('v1TopicPicker');
  const toggle = d.getElementById('v1TopicToggle');
  assert.equal(d.querySelector('.v1-diagnostic-room').nextElementSibling, picker);
  assert(!d.querySelector('.v1-diagnostic-room #sessionPrompt'));
  assert.equal(d.querySelectorAll('#sessionPrompt').length, 1);
  assert.equal(d.getElementById('sessionPrompt').textContent, '我自己的旧选题');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(d.getElementById('v1TopicInput').value, '我自己的旧选题');
  change(w, 'v1TopicInput', '   ');
  await submit(w);
  assert.equal(d.activeElement.id, 'v1TopicInput');
  assert.equal(d.getElementById('v1TopicInput').getAttribute('aria-invalid'), 'true');
  assert.equal(w.CreatorV1Controls.getRules().goal, '我自己的旧选题');
  change(w, 'v1TopicInput', '如何让第一次做口播的人自然开场？');
  // Selecting another source must not destroy the unsent custom draft.
  d.querySelector('[name="topic-source"][value="template"]').click();
  d.querySelector('[name="topic-source"][value="custom"]').click();
  assert.equal(d.getElementById('v1TopicInput').value, '如何让第一次做口播的人自然开场？');
  await submit(w);
  assert.equal(w.CreatorV1Controls.getRules().goal, '如何让第一次做口播的人自然开场？');
  assert.equal(d.getElementById('sessionPrompt').textContent, w.CreatorV1Controls.getRules().goal);
  assert.equal(d.querySelector('[data-rule-goal]').value, w.CreatorV1Controls.getRules().goal);
  assert.equal(w.CreatorV1Controls.getRules().customWords, '咱就是说');
  assert(!JSON.stringify(w.CreatorQAControls.getState()).includes('如何让第一次做口播的人自然开场？'), 'private topic must not be exported as public UI configuration');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  const reloaded = mount({ saved: JSON.parse(w.localStorage.getItem(rulesKey)), topic: JSON.parse(w.localStorage.getItem(topicKey)) });
  assert.equal(reloaded.window.CreatorV1Controls.getRules().goal, '如何让第一次做口播的人自然开场？');
  await tick(); reloaded.window.close();

  toggle.click();
  d.querySelector('[name="topic-source"][value="template"]').click();
  change(w, 'v1TopicTemplate', 'knowledge');
  assert.equal(d.getElementById('v1TopicTemplate-knowledge').hidden, false);
  assert.equal(d.getElementById('v1TopicTemplate-account').hidden, true);
  // QA-edited template must become the actual training goal, not just a label.
  d.querySelector('[data-qa-tab="copy"]').click();
  const copy = d.querySelector('[data-copy-key="v1.topic.template.knowledge"]');
  assert(copy, 'template body must be editable in the existing QA copy tab');
  copy.value = '向你的目标观众解释一个常见误区。';
  copy.dispatchEvent(new w.Event('input', { bubbles: true }));
  await submit(w);
  assert.equal(w.CreatorV1Controls.getRules().goal, copy.value);
  input(w, 'theme.text', '#abcdef');
  assert.equal(d.getElementById('sessionPrompt').textContent, copy.value, 'QA edits must not restore the old prompt');
  const all = w.CreatorQAControls.inspectElements();
  for (const node of picker.querySelectorAll('*')) {
    if (!w.CreatorElementEditor.eligible(node)) continue;
    assert(all.some(item => item.selector === w.CreatorElementEditor.selectorFor(node)));
  }
  // Exercise the real app start path without a microphone backend.
  d.querySelector('[data-session-toggle]').click();
  assert.equal(d.getElementById('sessionPrompt').textContent, copy.value);
  assert.equal(d.getElementById('v1TopicFields').disabled, true);
  assert.equal((await w.CreatorV1Controls.setGoal('不应更换')).applied, false);
  assert.equal(w.CreatorV1Controls.getRules().goal, copy.value);
  d.dispatchEvent(new w.CustomEvent('creator:session-state', { detail: { running: false } }));
  assert.equal(d.getElementById('v1TopicFields').disabled, false);
  await tick(); w.close();

  // Desktop bridge gets the same goal and retains all existing prompt rules.
  let savedDesktop, resolveInitial;
  const desktop = mount({ saved: { rules: { customRules: '保留规则', customWords: '那个' } }, api: {
    getCustomPrompt: () => new Promise(resolve => { resolveInitial = resolve; }),
    saveCustomPrompt: async payload => { savedDesktop = payload; return { success: true }; }
  } });
  const dw = desktop.window;
  await dw.CreatorV1Controls.setGoal('新的知识选题');
  resolveInitial({ goals: '迟到的旧选题' });
  await tick();
  assert.equal(dw.CreatorV1Controls.getRules().goal, '新的知识选题', 'late initial desktop load must not replace a new selection');
  assert.equal(savedDesktop.goals, '新的知识选题');
  assert.equal(savedDesktop.customRules, '保留规则');
  assert.equal(savedDesktop.customWords, '那个');
  dw.api.saveCustomPrompt = async () => { throw new Error('offline'); };
  const failure = await dw.CreatorV1Controls.setGoal('仍保留当前输入');
  assert.equal(failure.desktopSynced, false);
  assert.equal(failure.applied, true);
  await tick(); dw.close();

  const unavailable = mount();
  const uw = unavailable.window;
  uw.Storage.prototype.setItem = () => { throw new Error('quota'); };
  assert.equal((await uw.CreatorV1Controls.setGoal('临时练习')).persisted, false);
  assert.equal(uw.CreatorV1Controls.getRules().goal, '临时练习');
  await tick(); uw.close();
  for (const page of ['v2-ai-audience.html', 'v3-creator-studio.html']) assert(!read(page).includes('v1-topic-picker.js'));
  console.log('V1 topic picker: relocation, disclosure, drafts, validation, templates, QA edits, real session goal, training lock and desktop persistence passed (DOM only).');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
