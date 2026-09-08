const assert = require('node:assert/strict');
const { makePage, read } = require('./qa-dom-helper');
const tick = () => new Promise(resolve => setImmediate(resolve));
const topicKey = 'expression-trainer.v2-topic';

function mount({ topic } = {}) {
  const dom = makePage('v2-ai-audience.html');
  const w = dom.window;
  if (topic) w.localStorage.setItem(topicKey, JSON.stringify(topic));
  for (const file of ['audience-templates.js', 'avatar-provider.js', 'avatar-selector.js', 'v2-session-model.js', 'v2-rule-judge.js', 'v2-review.js', 'v2-interest-panel.js', 'app.js', 'v2-topic-picker.js']) w.eval(read(file));
  return dom;
}

async function submit(w) {
  const d = w.document;
  w.document.getElementById('v2TopicForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  const audienceChoice = d.querySelector('[data-audience-choose]');
  assert(audienceChoice.querySelector('svg'), 'the quiet audience row has a consistent line icon');
  assert(!d.querySelector('.audience-config-actions').contains(audienceChoice), 'audience selection is distinct from apply and preview actions');
  d.querySelector('[data-pressure="high"]').click();
  assert.equal(d.querySelector('[data-pressure="high"]').getAttribute('aria-pressed'), 'true');
  assert.equal(d.querySelector('[data-pressure="medium"]').getAttribute('aria-pressed'), 'false');
  assert.equal(d.querySelector('[data-v2-pressure-label]').textContent, '高压模式');
}

async function run() {
  const dom = mount();
  const w = dom.window, d = w.document;
  await tick();
  const room = d.querySelector('.audience-primary-room');
  const picker = d.getElementById('v2TopicPicker');
  const toggle = d.getElementById('v2TopicToggle');
  d.querySelector('[data-qa-tab="copy"]').click();
  assert(d.querySelector('[data-copy-key="v2.audience.goal"]'), 'audience goal is editable with a stable copy key');
  assert.equal(d.querySelector('[data-qa-copy-key="v2.audience.goal"]').textContent, '让陌生概念被听懂并愿意关注');
  assert.equal(picker.parentElement, d.querySelector('[data-v2-topic-slot]'), 'V2 topic choice belongs with the left-hand training setup');
  assert(!room.querySelector('#sessionPrompt'), 'V2 prompt must not overlay the audience or camera image');
  assert.equal(d.querySelectorAll('#sessionPrompt').length, 1);
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');

  d.querySelector('[name="v2-topic-source"][value="custom"]').click();
  const input = d.getElementById('v2TopicInput');
  input.value = '向刚开始做美食账号的人讲清楚：怎样让第一条视频更有重点。';
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
  await submit(w);
  assert.equal(w.CreatorAudienceControls.getTopic().goal, input.value, 'custom topic must replace V2 training text');
  assert.equal(d.getElementById('sessionPrompt').textContent, input.value);
  assert.equal(JSON.parse(w.localStorage.getItem(topicKey)).customDraft, input.value, 'custom topic draft must survive refresh');

  toggle.click();
  d.querySelector('[name="v2-topic-source"][value="template"]').click();
  const select = d.getElementById('v2TopicTemplate');
  select.value = 'fitness-beginner';
  select.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(d.getElementById('v2TopicTemplate-fitness-beginner').hidden, false);
  assert.equal(d.getElementById('v2TopicTemplate-knowledge-beginner').hidden, true);
  // Template copy stays editable through the existing QA copy library.
  d.querySelector('[data-qa-tab="copy"]').click();
  assert(d.querySelector('[data-copy-key="v2.topic.template.fitness-beginner"]'));

  d.dispatchEvent(new w.CustomEvent('creator:session-state', { detail: { running: true } }));
  assert.equal(d.getElementById('v2TopicFields').disabled, true, 'topic changes lock while a V2 session is running');
  d.dispatchEvent(new w.CustomEvent('creator:session-state', { detail: { running: false } }));
  assert.equal(d.getElementById('v2TopicFields').disabled, false);
  await tick(); w.close();
  assert(!read('v1-camera-baseline.html').includes('v2-topic-picker.js'), 'V2 controls must not leak into V1');
  console.log('V2 topic picker: relocation, custom topic, audience template selection, QA copy and training lock passed (DOM only).');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
