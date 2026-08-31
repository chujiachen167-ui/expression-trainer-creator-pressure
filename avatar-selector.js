(() => {
  const storageKey = 'expression-trainer.audience-selection.v1';
  const listeners = new Set();
  let dialog = null;
  let selected = [];
  let activeTemplate = null;
  let limit = 1;
  let opener = null;

  function loadSelections() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch (_) { return {}; }
  }

  function saveSelection(templateId, ids) {
    const all = loadSelections();
    all[templateId] = ids;
    localStorage.setItem(storageKey, JSON.stringify(all));
  }

  function getSelection(templateId, max = 3) {
    const engine = window.CreatorAudienceEngine;
    if (!engine) return [];
    const template = engine.getTemplate(templateId);
    const valid = new Set(template.audiences);
    const saved = (loadSelections()[template.id] || []).filter(id => valid.has(id));
    const remaining = template.audiences.filter(id => !saved.includes(id));
    return [...saved, ...remaining].slice(0, max);
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'avatar-selector-dialog';
    dialog.dataset.qaCopyIgnore = '';
    dialog.setAttribute('aria-labelledby', 'avatarSelectorTitle');
    dialog.innerHTML = `
      <form method="dialog" class="avatar-selector-shell">
        <header class="avatar-selector-head">
          <div><span class="section-kicker">DIGITAL AUDIENCE CAST</span><h2 id="avatarSelectorTitle">选择会对你产生反应的观众</h2><p>角色来自当前受众模板；选择改变观察角度，不会把训练扩展成面试或会议。</p></div>
          <button class="avatar-selector-close" value="cancel" aria-label="关闭数字观众选择">×</button>
        </header>
        <div class="avatar-selector-template" data-avatar-template></div>
        <div class="avatar-selector-grid" data-avatar-grid role="group" aria-label="数字观众角色"></div>
        <footer class="avatar-selector-actions">
          <span data-avatar-selection-status role="status" aria-live="polite"></span>
          <button class="ghost-btn" value="cancel">取消</button>
          <button class="primary-btn" type="button" data-avatar-confirm>使用这些观众</button>
        </footer>
      </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      document.body.classList.remove('avatar-selector-open');
      opener?.focus?.();
      opener = null;
    });
    dialog.querySelector('[data-avatar-confirm]').addEventListener('click', () => {
      if (!activeTemplate || !selected.length) return;
      saveSelection(activeTemplate.id, selected);
      const detail = { templateId: activeTemplate.id, profileIds: [...selected] };
      listeners.forEach(listener => listener(detail));
      document.dispatchEvent(new CustomEvent('creator:audience-selection-change', { detail }));
      dialog.close('confirm');
    });
    return dialog;
  }

  function render() {
    const engine = window.CreatorAudienceEngine;
    if (!engine || !activeTemplate) return;
    const profiles = activeTemplate.audiences.map(id => engine.profiles[id]).filter(Boolean);
    dialog.querySelector('[data-avatar-template]').innerHTML = `<span>${activeTemplate.domain}</span><strong>${activeTemplate.name}</strong><small>${activeTemplate.goal}</small>`;
    dialog.querySelector('[data-avatar-grid]').innerHTML = profiles.map(profile => {
      const pressed = selected.includes(profile.id);
      return `<button type="button" class="avatar-choice${pressed ? ' selected' : ''}" data-avatar-choice="${profile.id}" aria-pressed="${pressed}"><span class="avatar-choice-glyph" aria-hidden="true">${profile.glyph}</span><span><strong>${profile.name}</strong><small>${profile.role}</small><em>${profile.motivation}</em></span><i aria-hidden="true">${pressed ? '✓' : ''}</i></button>`;
    }).join('');
    dialog.querySelectorAll('[data-avatar-choice]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.avatarChoice;
      if (limit === 1) selected = [id];
      else if (selected.includes(id)) selected = selected.filter(item => item !== id);
      else if (selected.length < limit) selected = [...selected, id];
      else selected = [...selected.slice(1), id];
      render();
    }));
    const status = dialog.querySelector('[data-avatar-selection-status]');
    status.textContent = limit === 1 ? '选择 1 位主观众' : `已选择 ${selected.length}/${limit} 位观众`;
    dialog.querySelector('[data-avatar-confirm]').disabled = selected.length === 0;
  }

  function open({ templateId, max = 1, trigger = document.activeElement } = {}) {
    const engine = window.CreatorAudienceEngine;
    if (!engine) return;
    ensureDialog();
    activeTemplate = engine.getTemplate(templateId);
    limit = Math.max(1, Number(max) || 1);
    selected = getSelection(activeTemplate.id, limit);
    opener = trigger;
    render();
    document.body.classList.add('avatar-selector-open');
    dialog.showModal();
    dialog.querySelector('.avatar-choice')?.focus();
  }

  window.CreatorAvatarSelector = {
    open,
    getSelection,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
})();
