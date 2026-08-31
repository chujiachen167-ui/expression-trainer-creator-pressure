/** V2 topic choice: owned by the creator and synchronized with audience templates. */
(() => {
  if (document.body.dataset.mode !== 'v2' || !window.CreatorAudienceEngine || !window.CreatorAudienceControls) return;
  const room = document.querySelector('.audience-primary-room');
  const banner = room?.querySelector('.prompt-banner');
  const prompt = document.getElementById('sessionPrompt');
  if (!room || !banner || !prompt) return;

  const storageKey = 'expression-trainer.v2-topic';
  const templates = window.CreatorAudienceEngine.templates;
  const initial = window.CreatorAudienceControls.getTopic();
  let draft = { source: 'template', templateId: initial.templateId || templates[0].id, customDraft: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && ['custom', 'template'].includes(saved.source)) draft.source = saved.source;
    if (templates.some(template => template.id === saved?.templateId)) draft.templateId = saved.templateId;
    if (typeof saved?.customDraft === 'string') draft.customDraft = saved.customDraft.slice(0, 300);
  } catch (_) { /* A corrupt browser draft never blocks training. */ }
  const activeTemplate = templates.find(template => template.id === initial.templateId);
  if (!activeTemplate || activeTemplate.prompt !== initial.goal) {
    draft.source = 'custom';
    if (!draft.customDraft) draft.customDraft = initial.goal;
  }

  banner.className = 'creator-topic-picker v2-topic-picker';
  banner.id = 'v2TopicPicker';
  room.after(banner);
  banner.replaceChildren();
  banner.innerHTML = `
    <button class="topic-toggle" id="v2TopicToggle" type="button" aria-expanded="false" aria-controls="v2TopicPanel">
      <span class="topic-label" data-qa-copy-key="v2.topic.label">选题</span>
      <span class="topic-chevron" aria-hidden="true" data-qa-copy-ignore>⌄</span>
    </button>
    <div id="v2TopicPanel" class="topic-panel" hidden>
      <form id="v2TopicForm" novalidate>
        <fieldset id="v2TopicFields">
          <legend class="topic-legend">这轮想让哪类观众听懂什么？</legend>
          <div class="topic-source">
            <label><input type="radio" name="v2-topic-source" value="custom"><span>自己写选题</span></label>
            <label><input type="radio" name="v2-topic-source" value="template"><span>使用受众模板</span></label>
          </div>
          <div id="v2TopicCustomPanel" class="topic-input-panel">
            <label for="v2TopicInput">你的选题</label>
            <textarea id="v2TopicInput" rows="3" maxlength="300" placeholder="例如：向准备买第一台相机的人，讲清楚手机拍摄和相机的真实差异。" aria-describedby="v2TopicHelp v2TopicError"></textarea>
            <p id="v2TopicHelp" class="topic-hint">自定义选题会保留当前数字观众，只替换你要练习的内容。最多 300 字。</p>
          </div>
          <div id="v2TopicTemplatePanel" class="topic-input-panel">
            <label for="v2TopicTemplate">选择一个受众与选题模板</label>
            <select id="v2TopicTemplate"></select>
            <div id="v2TopicTemplates" class="topic-template-preview"></div>
          </div>
          <p id="v2TopicError" class="topic-error" role="alert" data-qa-copy-ignore hidden></p>
          <div class="topic-actions"><button type="submit" class="primary-btn" id="v2TopicApply">使用这个选题</button><button type="button" class="ghost-btn" id="v2TopicCancel">收起</button></div>
        </fieldset>
      </form>
    </div>
    <p id="v2TopicStatus" class="topic-hint" role="status" data-qa-copy-ignore hidden></p>`;

  const toggle = document.getElementById('v2TopicToggle');
  const panel = document.getElementById('v2TopicPanel');
  const textarea = document.getElementById('v2TopicInput');
  const select = document.getElementById('v2TopicTemplate');
  const previews = document.getElementById('v2TopicTemplates');
  const fields = document.getElementById('v2TopicFields');
  const error = document.getElementById('v2TopicError');
  const status = document.getElementById('v2TopicStatus');
  let applying = false;
  templates.forEach(template => {
    const option = document.createElement('option'); option.value = template.id; option.textContent = template.name; select.append(option);
    const preview = document.createElement('p'); preview.id = `v2TopicTemplate-${template.id}`; preview.dataset.topicTemplate = template.id;
    preview.dataset.qaCopyKey = `v2.topic.template.${template.id}`; preview.textContent = template.prompt; previews.append(preview);
  });
  textarea.value = draft.customDraft; select.value = draft.templateId;
  const notice = text => { status.textContent = text; status.hidden = !text; };
  const saveDraft = () => { try { localStorage.setItem(storageKey, JSON.stringify(draft)); return true; } catch (_) { notice('浏览器未能保存选题草稿；刷新前请自行备份。'); return false; } };
  const renderSource = () => {
    banner.querySelectorAll('[name="v2-topic-source"]').forEach(input => { input.checked = input.value === draft.source; });
    document.getElementById('v2TopicCustomPanel').hidden = draft.source !== 'custom';
    document.getElementById('v2TopicTemplatePanel').hidden = draft.source !== 'template';
    previews.querySelectorAll('[data-topic-template]').forEach(node => { node.hidden = node.dataset.topicTemplate !== select.value; });
    error.hidden = true; textarea.removeAttribute('aria-invalid');
  };
  const expand = open => { panel.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
  toggle.querySelector('.topic-label').after(prompt);
  toggle.addEventListener('click', () => expand(panel.hidden));
  document.getElementById('v2TopicCancel').addEventListener('click', () => { expand(false); toggle.focus(); });
  banner.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); expand(false); toggle.focus(); } });
  banner.querySelectorAll('[name="v2-topic-source"]').forEach(input => input.addEventListener('change', () => { draft.source = input.value; renderSource(); saveDraft(); }));
  select.addEventListener('change', () => { draft.templateId = select.value; renderSource(); saveDraft(); });
  textarea.addEventListener('input', () => { draft.customDraft = textarea.value; saveDraft(); if (textarea.value.trim()) { error.hidden = true; textarea.removeAttribute('aria-invalid'); } });
  document.getElementById('v2TopicForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (applying) return;
    const current = window.CreatorAudienceControls.getTopic();
    if (current.running) { notice('本轮正在训练，结束后可更换选题。'); return; }
    const selected = templates.find(template => template.id === select.value);
    const text = draft.source === 'custom' ? textarea.value.trim() : document.getElementById(`v2TopicTemplate-${select.value}`).textContent.trim();
    if (!text || text.length > 300 || !selected) {
      error.textContent = '请填写 1–300 字的选题，或选择一个有效模板。'; error.hidden = false;
      if (draft.source === 'custom') { textarea.setAttribute('aria-invalid', 'true'); textarea.focus(); }
      return;
    }
    applying = true; fields.disabled = true; notice('正在应用选题…');
    try {
      const result = await window.CreatorAudienceControls.setTopic(draft.source === 'template' ? { templateId: selected.id } : { goal: text });
      if (!result.applied) { notice(result.error); return; }
      saveDraft(); expand(false); toggle.focus();
    } catch (_) { notice('选题未能应用，请保留输入并重试。'); }
    finally { applying = false; fields.disabled = window.CreatorAudienceControls.getTopic().running; }
  });
  document.addEventListener('creator:session-state', event => { fields.disabled = Boolean(event.detail?.running) || applying; });
  renderSource();
  window.CreatorQAControls?.refreshCopyLibrary?.();
})();
