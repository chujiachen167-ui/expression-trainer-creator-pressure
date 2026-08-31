/** V1 only: a topic is user-owned training input, not a caption on the camera. */
(() => {
  if (document.body.dataset.mode !== 'v1' || !window.CreatorV1Controls) return;
  const banner = document.querySelector('.v1-diagnostic-room .prompt-banner');
  const prompt = document.getElementById('sessionPrompt');
  if (!banner || !prompt) return;
  const storageKey = 'expression-trainer.v1-topic';
  const templates = [
    ['account', '介绍你的账号', '请用 60 秒解释：为什么观众应该关注你的账号？'],
    ['knowledge', '讲清一个知识点', '选一个你熟悉的知识点，讲给完全不了解它的人听：先说它解决什么问题，再举一个生活中的例子。'],
    ['experience', '分享一次产品体验', '选一件你真实用过的产品：先说适合谁，再讲一个优点和一个局限，不夸大使用效果。'],
    ['opinion', '表达一个观点', '选择你所在领域的一个话题：先亮明观点，再给出一个理由和一个具体例子。'],
    ['story', '讲一段真实经历', '分享一次与你的内容领域有关的真实经历：遇到了什么问题，做了什么，最后学到了什么。'],
    ['tips', '分享一个实用方法', '教目标观众一个你亲自尝试过的方法：先说明能解决什么问题，再分步骤讲清楚怎么做。']
  ];
  let draft = { source: 'template', templateId: 'account', customDraft: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && ['custom', 'template'].includes(saved.source)) draft.source = saved.source;
    if (templates.some(([id]) => id === saved?.templateId)) draft.templateId = saved.templateId;
    if (typeof saved?.customDraft === 'string') draft.customDraft = saved.customDraft.slice(0, 300);
  } catch (_) { /* A corrupt or unavailable draft must not block training. */ }
  const currentGoal = window.CreatorV1Controls.getRules().goal;
  const currentTemplate = templates.find(([, , text]) => text === currentGoal);
  if (currentTemplate) draft.templateId = currentTemplate[0];
  else { draft.source = 'custom'; if (!draft.customDraft) draft.customDraft = currentGoal; }
  let running = false;
  let applying = false;

  // Run after the initial QA scan: preserve existing page copy keys before
  // inserting new controls. Reuse the actual prompt node used by app.js.
  banner.className = 'v1-topic-picker';
  banner.id = 'v1TopicPicker';
  document.querySelector('.v1-diagnostic-room').after(banner);
  banner.replaceChildren();
  banner.innerHTML = `
    <button class="topic-toggle" id="v1TopicToggle" type="button" aria-expanded="false" aria-controls="v1TopicPanel">
      <span class="topic-label" data-qa-copy-key="v1.topic.label">选题</span>
      <span class="topic-chevron" aria-hidden="true" data-qa-copy-ignore>⌄</span>
    </button>
    <div id="v1TopicPanel" class="topic-panel" hidden>
      <form id="v1TopicForm" novalidate>
        <fieldset id="v1TopicFields">
          <legend class="topic-legend">这次想讲什么？</legend>
          <div class="topic-source">
            <label><input type="radio" name="topic-source" value="custom"><span>自己写选题</span></label>
            <label><input type="radio" name="topic-source" value="template"><span>使用选题模板</span></label>
          </div>
          <div id="v1TopicCustomPanel" class="topic-input-panel">
            <label for="v1TopicInput">你的选题</label>
            <textarea id="v1TopicInput" rows="3" maxlength="300" placeholder="例如：向刚开始健身的人，分享我坚持运动的一个方法。" aria-describedby="v1TopicHelp v1TopicError"></textarea>
            <p id="v1TopicHelp" class="topic-hint">写下想讲的主题即可，不需要准备完整逐字稿。最多 300 字。</p>
          </div>
          <div id="v1TopicTemplatePanel" class="topic-input-panel">
            <label for="v1TopicTemplate">选择一个口播模板</label>
            <select id="v1TopicTemplate"></select>
            <div id="v1TopicTemplates" class="topic-template-preview"></div>
          </div>
          <p id="v1TopicError" class="topic-error" role="alert" data-qa-copy-ignore hidden></p>
          <div class="topic-actions"><button type="submit" class="primary-btn" id="v1TopicApply">使用这个选题</button><button type="button" class="ghost-btn" id="v1TopicCancel">收起</button></div>
        </fieldset>
      </form>
    </div>
    <p id="v1TopicStatus" class="topic-hint" role="status" data-qa-copy-ignore hidden></p>`;
  const toggle = document.getElementById('v1TopicToggle');
  toggle.querySelector('.topic-label').after(prompt);
  prompt.textContent = currentGoal;
  const panel = document.getElementById('v1TopicPanel');
  const textarea = document.getElementById('v1TopicInput');
  const select = document.getElementById('v1TopicTemplate');
  const error = document.getElementById('v1TopicError');
  const status = document.getElementById('v1TopicStatus');
  const fields = document.getElementById('v1TopicFields');
  const previews = document.getElementById('v1TopicTemplates');
  templates.forEach(([id, name, text]) => {
    const option = document.createElement('option');
    option.value = id; option.textContent = name; select.append(option);
    const preview = document.createElement('p');
    preview.id = `v1TopicTemplate-${id}`;
    preview.dataset.topicTemplate = id;
    preview.dataset.qaCopyKey = `v1.topic.template.${id}`;
    preview.textContent = text;
    previews.append(preview);
  });
  textarea.value = draft.customDraft;
  select.value = draft.templateId;
  function notice(text) { status.textContent = text; status.hidden = !text; }
  function saveDraft() {
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); return true; }
    catch (_) { notice('浏览器未能保存选题草稿；当前页面仍可使用，刷新前请自行备份。'); return false; }
  }
  function renderSource() {
    banner.querySelectorAll('[name="topic-source"]').forEach(input => { input.checked = input.value === draft.source; });
    document.getElementById('v1TopicCustomPanel').hidden = draft.source !== 'custom';
    document.getElementById('v1TopicTemplatePanel').hidden = draft.source !== 'template';
    previews.querySelectorAll('[data-topic-template]').forEach(node => { node.hidden = node.dataset.topicTemplate !== select.value; });
    error.hidden = true; textarea.removeAttribute('aria-invalid');
  }
  function expand(open) { panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); }
  toggle.addEventListener('click', () => expand(panel.hidden));
  document.getElementById('v1TopicCancel').addEventListener('click', () => { expand(false); toggle.focus(); });
  banner.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); expand(false); toggle.focus(); }
  });
  banner.querySelectorAll('[name="topic-source"]').forEach(input => input.addEventListener('change', () => {
    draft.source = input.value; renderSource(); saveDraft();
  }));
  select.addEventListener('change', () => { draft.templateId = select.value; renderSource(); saveDraft(); });
  textarea.addEventListener('input', () => {
    draft.customDraft = textarea.value; saveDraft();
    if (textarea.value.trim()) { error.hidden = true; textarea.removeAttribute('aria-invalid'); }
  });
  document.getElementById('v1TopicForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (running || applying) return;
    // Read the preview text itself so founder edits in the QA copy panel also
    // become the real template, rather than a decorative-only override.
    const text = draft.source === 'custom' ? textarea.value.trim() : document.getElementById(`v1TopicTemplate-${select.value}`).textContent.trim();
    if (!text || text.length > 300) {
      error.textContent = '请填写 1–300 字的选题，或选择一个有效模板。'; error.hidden = false;
      if (draft.source === 'custom') { textarea.setAttribute('aria-invalid', 'true'); textarea.focus(); }
      return;
    }
    applying = true; fields.disabled = true;
    notice('正在应用选题…');
    try {
      const result = await window.CreatorV1Controls.setGoal(text);
      if (!result.applied) { notice(result.error); return; }
      const draftSaved = saveDraft();
      notice(!result.persisted || !draftSaved ? '选题已用于当前页面，但浏览器保存失败；刷新前请备份。' : !result.desktopSynced ? '当前页选题已更新；桌面端复盘配置未同步，请稍后重新应用。' : '');
      expand(false); toggle.focus();
    } catch (_) { notice('选题未能应用，请保留输入并重试。'); }
    finally { applying = false; fields.disabled = running; }
  });
  document.addEventListener('creator:session-state', event => {
    running = Boolean(event.detail?.running); fields.disabled = running || applying;
    if (running) notice('本轮正在训练，结束后可更换选题。');
    else notice('');
  });
  document.addEventListener('creator:v1-rules-change', event => {
    if (typeof event.detail?.goal === 'string') prompt.textContent = event.detail.goal;
  });
  renderSource();
  window.CreatorQAControls?.refreshCopyLibrary?.();
})();
