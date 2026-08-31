/** Page-scoped, development-only visual and copy editing. Never edits input values or diagnostics. */
(() => {
  const excluded = 'script, style, link, meta, template, noscript, source, track, .qa-panel, .qa-trigger, [data-qa-editor-owned]';
  const live = '#timer, #statusText, #sessionPrompt, #liveTranscript, #eventFeed, [data-core-report], [data-language-status], [data-provider-status], [data-compact-title], [data-compact-goal], [data-compact-platform], [data-avatar-template], [data-avatar-grid], [data-avatar-selection-status], .avatar-provider-state, .audience-reaction, #reportFocus, #reportReason, [data-interest-value], [data-interest-summary], [data-interest-table], #fillerMetric, #vagueMetric, #hedgeMetric, #repeatMetric, #speedMetric, #densityMetric, #wordMetric, #reportDensity, #reportFiller, #reportHedge, #reportVague, #reportWords';
  const properties = [
    ['color', '文字颜色', 'color'], ['background-color', '背景颜色', 'color'], ['border-color', '边框颜色', 'color'],
    ['font-size', '字号（px）', 'number', 8, 180], ['font-weight', '字重', 'number', 100, 900, 50],
    ['line-height', '行高（倍）', 'number', 0.8, 3, 0.05], ['letter-spacing', '字距（px）', 'number', -8, 30, 0.1],
    ['width', '宽度（px）', 'number', 0, 2400], ['height', '高度（px）', 'number', 0, 1600],
    ['min-width', '最小宽度（px）', 'number', 0, 2400], ['max-width', '最大宽度（px）', 'number', 0, 2400],
    ['x', 'X 偏移（px）', 'number', -1200, 1200], ['y', 'Y 偏移（px）', 'number', -1200, 1200],
    ['padding-top', '上内边距', 'number', 0, 240], ['padding-right', '右内边距', 'number', 0, 240],
    ['padding-bottom', '下内边距', 'number', 0, 240], ['padding-left', '左内边距', 'number', 0, 240],
    ['margin-top', '上外边距', 'number', -240, 240], ['margin-right', '右外边距', 'number', -240, 240],
    ['margin-bottom', '下外边距', 'number', -240, 240], ['margin-left', '左外边距', 'number', -240, 240],
    ['row-gap', '行间距', 'number', 0, 240], ['column-gap', '列间距', 'number', 0, 240],
    ['border-width', '边框粗细', 'number', 0, 24], ['border-radius', '圆角', 'number', 0, 240],
    ['opacity', '不透明度', 'number', 0, 1, 0.05], ['z-index', '叠放层级', 'number', -1, 100],
    ['fill', 'SVG 填充色', 'color'], ['stroke', 'SVG 描边色', 'color']
  ];
  const choices = {
    'font-family': ['字体', ['', '继承'], ['Microsoft YaHei, PingFang SC, sans-serif', '中文无衬线'], ['Georgia, STFangsong, serif', '衬线'], ['ui-monospace, Consolas, monospace', '等宽']],
    'text-align': ['文字对齐', ['', '继承'], ['left', '左对齐'], ['center', '居中'], ['right', '右对齐']],
    'background-image': ['背景图层', ['', '保留原样'], ['none', '移除渐变 / 图片']],
    'box-shadow': ['阴影', ['', '保留原样'], ['none', '移除阴影']],
    'border-style': ['边框线型', ['', '保留原样'], ['none', '无'], ['solid', '实线'], ['dashed', '虚线']],
    'display': ['显示', ['', '跟随运行状态'], ['none', '在验收视图隐藏']]
  };
  const attrNames = ['placeholder', 'title', 'aria-label', 'alt', 'data-prompt'];
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const quote = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r]/g, '');
  const eligible = node => node?.nodeType === 1 && !node.closest(excluded) && node !== node.ownerDocument.documentElement;
  function selectorFor(node) {
    if (node === document.body) return 'body';
    if (node.id) return `[id="${quote(node.id)}"]`;
    const parts = [];
    while (node && node !== document.body) {
      if (node.id) { parts.unshift(`[id="${quote(node.id)}"]`); break; }
      // Data identities survive active/selected CSS-class changes.
      const identity = ['data-language', 'data-pressure', 'data-profile-id', 'data-avatar-choice'].find(name => node.hasAttribute(name));
      if (identity) { parts.unshift(`${node.localName}[${identity}="${quote(node.getAttribute(identity))}"]`); break; }
      const siblings = [...(node.parentElement?.children || [])].filter(sibling => sibling.localName === node.localName);
      parts.unshift(`${node.localName}:nth-of-type(${siblings.indexOf(node) + 1})`);
      node = node.parentElement;
    }
    return `${node === document.body ? 'body > ' : ''}${parts.join(' > ')}`;
  }
  function copyFields(node) {
    if (!eligible(node)) return [];
    const fields = attrNames.filter(name => node.hasAttribute(name)).map(name => ({ type: 'attribute', slot: name, source: node.getAttribute(name), label: ({ placeholder: '输入占位提示', title: '悬停提示', 'aria-label': '无障碍名称', alt: '图片说明', 'data-prompt': '场景训练题' })[name] }));
    const isExample = node.closest('[data-transcript-cover]');
    const isLive = (node.closest(live) || node.closest('#v1TopicStatus, #v1TopicError, [data-audience-summary], [data-provider-label], .compact-brief-tag')) && !node.closest('#liveTranscript .placeholder');
    if (isLive || isExample || node.matches('input,textarea,select,video,canvas,svg')) return fields;
    node.childNodes.forEach((child, slot) => { if (child.nodeType === 3 && child.data.trim()) fields.push({ type: 'text', slot, source: child.data, label: '显示文字' }); });
    return fields;
  }
  function mount(panel, bridge) {
    const style = document.createElement('style');
    style.dataset.qaEditorOwned = '';
    document.head.append(style);
    let inventory = [];
    let selected;
    let picking = null;
    let hovered;
    let appliedCopy = [];
    let observerQueued = false;
    const ui = panel.querySelector('[data-qa-fine-ui]');
    const copy = panel.querySelector('[data-qa-fine-copy]');
    const selectorUi = kind => `<div class="qa-fine-actions"><button type="button" data-qa-pick="${kind}">点选页面元素</button><button type="button" data-qa-rescan>刷新元素列表</button></div><label class="qa-copy-field"><span>查找元素</span><input data-qa-find placeholder="标题、按钮、区域名或 ID"></label><label class="qa-select"><span>当前元素</span><select data-qa-target aria-label="${kind === 'ui' ? 'UI' : '文案'}编辑目标"></select></label><small class="qa-fine-target" data-qa-target-path></small>`;
    ui.innerHTML = `<h2>本页全元素精调</h2><p class="qa-hint">大区块参数不够细时，点选页面上的任意元素。留空表示跟随原样；只覆盖本页，不改动训练逻辑。</p>${selectorUi('ui')}
      <label class="qa-select"><span>编辑部位 / 状态</span><select data-qa-part><option value="self">元素默认状态</option><option value="hover">鼠标悬停</option><option value="focus">键盘焦点</option><option value="active">当前选中</option><option value="disabled">禁用状态</option><option value="before">::before 装饰</option><option value="after">::after 装饰</option></select></label>
      <div class="qa-fine-properties"></div><button type="button" data-qa-reset-element>恢复所选元素样式</button><p class="qa-hint">::before / ::after 可调整状态点、装饰线等。没有该装饰的元素不会凭空新增装饰。运行时隐藏的功能不会被强行打开。</p>`;
    copy.innerHTML = `<h2>遗漏文案与占位提示</h2><p class="qa-hint">可编辑 div / label 内的文字、带图标按钮的文字、输入占位、图片说明和悬停提示。数据及状态结果只允许调整样式；Marquee 句子在自己的参数页修改。</p>${selectorUi('copy')}<div data-qa-fine-copy-fields></div><button type="button" data-qa-reset-copy>恢复所选元素文案</button>`;
    const controls = ui.querySelector('.qa-fine-properties');
    const fieldMarkup = ([key, label, type, min, max, step = 1]) => `<label class="qa-fine-property"><span>${label}</span><input data-qa-style="${key}" aria-label="${label}" type="${type === 'color' ? 'text' : 'number'}" ${type === 'color' ? 'placeholder="#颜色 / transparent"' : `min="${min}" max="${max}" step="${step}" placeholder="原样"`}>${type === 'color' ? `<input type="color" data-qa-palette="${key}" aria-label="选择${label}">` : ''}<button type="button" data-qa-clear-style="${key}" aria-label="恢复${label}">↺</button></label>`;
    controls.innerHTML = [['颜色与文字', properties.slice(0, 7)], ['位置与尺寸', properties.slice(7, 13)], ['间距与边框', properties.slice(13, 25)], ['透明度与图形', properties.slice(25)]].map(([label, fields], index) => `<details class="qa-fine-group" ${index === 0 ? 'open' : ''}><summary>${label}</summary>${fields.map(fieldMarkup).join('')}</details>`).join('') + `<details class="qa-fine-group"><summary>字体、对齐与装饰</summary>${Object.entries(choices).map(([key, [label, ...options]]) => `<label class="qa-select"><span>${label}</span><select data-qa-style="${key}">${options.map(([value, text]) => `<option value="${escape(value)}">${text}</option>`).join('')}</select></label>`).join('')}</details>`;
    const region = node => node.closest('.topbar') ? '顶栏' : node.closest('.side-panel.left') ? '左栏' : node.closest('.side-panel.right') ? '右栏' : node.closest('.stage') ? '舞台' : node.closest('.report-panel,dialog') ? '弹窗' : '起始页';
    function scan() {
      inventory = [document.body, ...document.body.querySelectorAll('*')].filter(eligible).map(node => ({ node, selector: selectorFor(node), label: `${region(node)} · ${node.localName}${node.id ? ` #${node.id}` : ''} · ${(node.getAttribute('aria-label') || node.textContent).trim().replace(/\s+/g, ' ').slice(0, 40)}` }));
      selected = inventory.find(item => item.node === selected?.node) || inventory.find(item => item.selector === selected?.selector) || inventory.find(item => item.node.matches('h1')) || inventory[0];
      renderLists();
    }
    function renderLists() {
      for (const area of [ui, copy]) {
        const search = area.querySelector('[data-qa-find]').value.toLowerCase();
        const filtered = inventory.filter(item => item.label.toLowerCase().includes(search) || item.selector.toLowerCase().includes(search));
        if (selected && !filtered.includes(selected)) filtered.unshift(selected);
        const select = area.querySelector('[data-qa-target]');
        select.replaceChildren(...filtered.map(item => { const option = document.createElement('option'); option.value = item.selector; option.textContent = item.label; return option; }));
        select.value = selected?.selector || '';
        area.querySelector('[data-qa-target-path]').textContent = selected?.selector || '暂无元素';
      }
    }
    function renderStyles() {
      const part = ui.querySelector('[data-qa-part]').value;
      const values = bridge.read().styles[selected?.selector]?.[part] || {};
      ui.querySelectorAll('[data-qa-style]').forEach(input => { input.value = values[input.dataset.qaStyle] ?? ''; });
      ui.querySelectorAll('[data-qa-palette]').forEach(input => { const value = values[input.dataset.qaPalette]; input.value = /^#[\da-f]{6}$/i.test(value) ? value : '#808080'; });
    }
    function renderCopy() {
      const list = copy.querySelector('[data-qa-fine-copy-fields]');
      const fields = selected ? copyFields(selected.node) : [];
      list.replaceChildren();
      if (!fields.length) {
        const hint = document.createElement('p'); hint.className = 'qa-hint';
        hint.textContent = selected?.node.closest('[data-transcript-cover]') ? '请前往 Vertical Marquee 页编辑成对句子。' : '此元素没有可改写的固定文字。可选它的子元素，或在 UI 参数中调整外观；实时数据不允许伪造。';
        list.append(hint);
      }
      fields.forEach(field => {
        const previous = appliedCopy.find(entry => entry.node === selected.node && entry.type === field.type && entry.slot === field.slot && field.source === entry.value);
        if (previous) field.source = previous.source;
        const key = JSON.stringify([selected.selector, field.type, field.slot, field.source]);
        const entry = bridge.read().copy[key];
        const label = document.createElement('label'); label.className = 'qa-copy-field';
        const text = document.createElement('span'); text.textContent = field.label;
        const input = document.createElement('textarea'); input.rows = 2; input.value = entry?.value ?? field.source;
        input.setAttribute('aria-label', `${field.label} ${field.slot}`);
        input.addEventListener('input', () => {
          const config = bridge.read().copy;
          config[key] = { selector: selected.selector, ...field, value: input.value };
          restoreCopy(); bridge.commit('copy', config); applyCopy();
        });
        label.append(text, input); list.append(label);
      });
      const decorations = document.createElement('details'); decorations.className = 'qa-fine-group';
      const summary = document.createElement('summary'); summary.textContent = 'CSS 装饰文字（如“看这里”）'; decorations.append(summary);
      for (const part of ['before', 'after']) {
        const label = document.createElement('label'); label.className = 'qa-copy-field';
        const text = document.createElement('span'); text.textContent = `::${part} 文字`;
        const input = document.createElement('input'); input.setAttribute('aria-label', `::${part} 文字`); input.placeholder = '留空保留原样';
        input.value = bridge.read().styles[selected?.selector]?.[part]?.content ?? '';
        input.addEventListener('input', () => updateStyle('content', input.value, part));
        label.append(text, input); decorations.append(label);
      }
      list.append(decorations);
    }
    function select(selector) {
      selected = inventory.find(item => item.selector === selector);
      renderLists(); renderStyles(); renderCopy();
    }
    function updateStyle(key, value, overridePart) {
      if (!selected) return;
      const config = bridge.read().styles;
      const part = overridePart || ui.querySelector('[data-qa-part]').value;
      config[selected.selector] ||= {};
      config[selected.selector][part] ||= {};
      if (value === '') delete config[selected.selector][part][key]; else config[selected.selector][part][key] = value;
      bridge.commit('styles', config); applyStyles();
    }
    function cssValue(key, value) {
      if (key === 'content') return `"${quote(value)}"`;
      const property = properties.find(item => item[0] === key);
      if (property?.[2] === 'color') return /^(#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|transparent|currentColor)$/i.test(value) ? value : null;
      if (property?.[2] === 'number') {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;
        const clamped = Math.min(property[4], Math.max(property[3], number));
        return `${clamped}${['font-weight', 'line-height', 'opacity', 'z-index'].includes(key) ? '' : 'px'}`;
      }
      return choices[key]?.slice(1).some(([choice]) => choice === value) ? value : null;
    }
    function applyStyles() {
      const rules = [];
      for (const [selector, parts] of Object.entries(bridge.read().styles)) {
        // Only locally generated selectors; prevent a saved config injecting CSS.
        if (/[{};<\n\r]/.test(selector)) continue;
        try { if (!document.querySelector(selector)) continue; } catch (_) { continue; }
        for (const [part, values] of Object.entries(parts)) {
          const suffix = { self: '', before: '::before', after: '::after', hover: ':hover', focus: ':focus-visible', active: ':is(.active,[aria-pressed="true"],[aria-selected="true"])', disabled: ':is(:disabled,[aria-disabled="true"])' }[part];
          if (suffix == null) continue;
          const declarations = Object.entries(values).filter(([key]) => !['x', 'y'].includes(key)).map(([key, value]) => { const safe = cssValue(key, value); return safe ? `${key}:${safe}!important` : ''; }).filter(Boolean);
          if (values.x != null || values.y != null) declarations.push(`translate:${cssValue('x', values.x || 0)} ${cssValue('y', values.y || 0)}!important`);
          if (declarations.length) rules.push(`${selector}${suffix} {${declarations.join(';')}}`);
        }
      }
      const css = rules.join('\n');
      if (style.textContent !== css) style.textContent = css;
    }
    function valueOf(node, entry) { return entry.type === 'attribute' ? node.getAttribute(entry.slot) : node.childNodes[entry.slot]?.nodeType === 3 ? node.childNodes[entry.slot].data : null; }
    function setValue(node, entry, value) { if (entry.type === 'attribute') node.setAttribute(entry.slot, value); else if (node.childNodes[entry.slot]?.nodeType === 3) node.childNodes[entry.slot].data = value; }
    function restoreCopy() {
      for (const entry of appliedCopy) if (entry.node.isConnected && valueOf(entry.node, entry) === entry.value) setValue(entry.node, entry, entry.source);
      appliedCopy = [];
    }
    function applyCopy() {
      for (const entry of Object.values(bridge.read().copy)) {
        let node; try { node = document.querySelector(entry.selector); } catch (_) { continue; }
        if (!node || !copyFields(node).some(field => field.type === entry.type && field.slot === entry.slot)) continue;
        // State-specific edits apply only to the matching source phrase. Never turn
        // a runtime "stop" button back into a saved "start" caption.
        if (valueOf(node, entry) !== entry.source || entry.source === entry.value) continue;
        setValue(node, entry, String(entry.value));
        appliedCopy.push({ ...entry, node });
      }
    }
    function stopPicking() {
      picking = null;
      hovered?.removeAttribute('data-qa-inspect-hover'); hovered = null;
      panel.querySelectorAll('[data-qa-pick]').forEach(button => { button.textContent = '点选页面元素'; button.setAttribute('aria-pressed', 'false'); });
    }
    for (const area of [ui, copy]) {
      area.querySelector('[data-qa-find]').addEventListener('input', renderLists);
      area.querySelector('[data-qa-target]').addEventListener('change', event => select(event.target.value));
      area.querySelector('[data-qa-rescan]').addEventListener('click', () => { scan(); renderStyles(); renderCopy(); });
      area.querySelector('[data-qa-pick]').addEventListener('click', event => {
        if (picking) { stopPicking(); return; }
        picking = event.target.dataset.qaPick;
        event.target.textContent = '请点页面元素 · Esc 退出'; event.target.setAttribute('aria-pressed', 'true');
      });
    }
    ui.querySelector('[data-qa-part]').addEventListener('change', renderStyles);
    ui.querySelectorAll('[data-qa-style]').forEach(input => input.addEventListener('input', () => {
      if (input.value && cssValue(input.dataset.qaStyle, input.value) === null) { input.setCustomValidity('请输入有效的数值、十六进制颜色或 transparent'); return; }
      input.setCustomValidity(''); updateStyle(input.dataset.qaStyle, input.value);
    }));
    ui.querySelectorAll('[data-qa-clear-style]').forEach(button => button.addEventListener('click', () => { updateStyle(button.dataset.qaClearStyle, ''); renderStyles(); }));
    ui.querySelectorAll('[data-qa-palette]').forEach(input => input.addEventListener('input', () => { updateStyle(input.dataset.qaPalette, input.value); renderStyles(); }));
    ui.querySelector('[data-qa-reset-element]').addEventListener('click', () => { const config = bridge.read().styles; delete config[selected.selector]; bridge.commit('styles', config); applyStyles(); renderStyles(); });
    copy.querySelector('[data-qa-reset-copy]').addEventListener('click', () => { const config = bridge.read().copy; for (const [key, entry] of Object.entries(config)) if (entry.selector === selected.selector) delete config[key]; restoreCopy(); bridge.commit('copy', config); applyCopy(); renderCopy(); });
    document.addEventListener('pointerover', event => {
      if (!picking || !eligible(event.target)) return;
      hovered?.removeAttribute('data-qa-inspect-hover'); hovered = event.target; hovered.dataset.qaInspectHover = '';
    }, true);
    document.addEventListener('click', event => {
      if (!picking || !eligible(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const selector = selectorFor(event.target); stopPicking(); scan(); select(selector);
    }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && picking) { event.preventDefault(); event.stopImmediatePropagation(); stopPicking(); } }, true);
    panel.addEventListener('click', event => { if (event.target.closest('.qa-close, [data-qa-tab]')) stopPicking(); });
    document.querySelector('.qa-trigger')?.addEventListener('click', stopPicking);
    new MutationObserver(records => {
      if (!window.document) return;
      if (!records.some(record => eligible(record.target.nodeType === 1 ? record.target : record.target.parentElement))) return;
      if (observerQueued) return;
      observerQueued = true;
      queueMicrotask(() => { observerQueued = false; if (window.document) { applyStyles(); applyCopy(); } });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    scan(); applyStyles(); applyCopy(); renderStyles(); renderCopy();
    return { refresh: () => { restoreCopy(); applyStyles(); applyCopy(); renderStyles(); renderCopy(); }, rescan: () => { scan(); renderStyles(); renderCopy(); }, inventory: () => { scan(); return inventory.map(item => ({ selector: item.selector, label: item.label, copyFields: copyFields(item.node).length })); }, selectorFor, copyFields };
  }
  window.CreatorElementEditor = { mount, selectorFor, copyFields, eligible };
})();
