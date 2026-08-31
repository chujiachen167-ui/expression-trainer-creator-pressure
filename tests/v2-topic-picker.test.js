const assert = require('node:assert/strict');
const { makePage, read } = require('./qa-dom-helper');
const tick = () => new Promise(resolve => setImmediate(resolve));
const topicKey = 'expression-trainer.v2-topic';

function mount({ topic } = {}) {
  const dom = makePage('v2-ai-audience.html');
  const w = dom.window;
  if (topic) w.localStorage.setItem(topicKey, JSON.stringify(topic));
  for (const file of ['audience-templates.js', 'avatar-provider.js', 'avatar-selector.js', 'app.js', 'v2-topic-picker.js']) w.eval(read(file));
  return dom;
}

async function submit(w) {
  w.document.getElementById('v2TopicForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
}

async function run() {
  const dom = mount();
  const w = dom.window, d = w.document;
  await tick();
  const room = d.querySelector('.audience-primary-room');
  const picker = d.getElementById('v2TopicPicker');
  const toggle = d.getElementById('v2TopicToggle');
  assert.equal(room.nextElementSibling, picker, 'V2 topic choice must sit below the audience/camera room');
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
