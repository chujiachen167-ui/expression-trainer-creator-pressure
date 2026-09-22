/*
 * Static-JavaScript port of React Bits DriftWall (JS + CSS variant).
 * Source and parameter model: https://github.com/DavidHDev/react-bits/tree/main/src/content/Components/DriftWall
 * V2 uses the wall as a chooser for default bloub vs local Live2D.
 */
(() => {
  const chooserItems = [
    { kind: 'bloub', label: '默认表情', name: 'bloub' },
    { kind: 'live2d', label: 'Live2D', name: '本机模型' }
  ];
  const TILES_PER_COLUMN = 15;
  const defaults = {
    columns: 5, tileWidth: 200, tileHeight: 132, gap: 18, radius: 14,
    tilt: 16, turn: -14, roll: 0, perspective: 1200, depth: 120,
    speed: 42, direction: 'up', variance: 0.45, parallax: 0.6,
    pauseOnHover: false, lift: 64, fade: 0.6, dim: 0.55,
    grayscale: false, overlayColor: '#060010'
  };

  let activeController = null;
  const currentSettings = () => ({
    ...defaults,
    ...(window.CreatorQAControls?.getState?.().components?.driftWall || {})
  });

  function currentKind() {
    return window.CreatorLocalAvatarImport?.selected?.() ? 'live2d' : 'bloub';
  }

  function audienceApplied() {
    return Boolean(document.querySelector('[data-primary-audience] .audience-tile'));
  }

  function setCaption(text) {
    const strong = document.querySelector('.audience-preview-caption strong');
    if (strong) strong.textContent = text;
  }

  function markChosen(kind) {
    document.querySelectorAll('.rb-drift-tile[data-kind]').forEach(tile => {
      const selected = tile.dataset.kind === kind;
      tile.classList.toggle('is-selected', selected);
      tile.setAttribute('aria-pressed', String(selected));
    });
  }

  function closeChooser() {
    const preview = document.querySelector('#avatarDriftWall');
    const slot = document.querySelector('[data-primary-audience]');
    if (preview) {
      preview.hidden = true;
      preview.classList.remove('is-chooser');
    }
    activeController?.destroy();
    if (slot && audienceApplied()) slot.hidden = false;
    document.querySelector('[data-audience-avatar-switch]')?.removeAttribute('hidden');
  }

  function openChooser() {
    const preview = document.querySelector('#avatarDriftWall');
    const slot = document.querySelector('[data-primary-audience]');
    const caption = document.querySelector('.audience-preview-caption');
    if (slot && audienceApplied()) slot.hidden = true;
    if (preview) {
      preview.hidden = false;
      preview.classList.add('is-chooser');
    }
    caption?.removeAttribute('hidden');
    refresh();
    setCaption('点窗口切换默认表情 bloub 或 Live2D');
  }

  async function chooseAvatar(kind) {
    const importer = window.CreatorLocalAvatarImport;
    if (kind === 'bloub') {
      importer?.clearSelection?.();
      markChosen('bloub');
      setCaption(audienceApplied() ? '已改回默认表情 bloub。' : '已选择默认表情 bloub。应用受众模板后会出现在舞台上。');
      if (audienceApplied()) closeChooser();
      return 'bloub';
    }
    if (!importer?.isLocalEnvironment?.()) {
      setCaption('网页版不能读取 Live2D。请用 GitHub 本机版，或继续点选 bloub。');
      return 'blocked';
    }
    const current = importer.selected?.();
    if (current) importer.select(current.id);
    else {
      await importer.loadBundledSamples?.();
      const records = importer.readRecords?.() || [];
      const preferred = records.find(record => record.name === 'Hiyori') || records.find(record => record.bundle) || records[0];
      if (preferred) importer.select(preferred.id);
    }
    if (importer.selected?.()) {
      markChosen('live2d');
      setCaption(`已选择 Live2D · ${importer.selected().name}。导入其他模型请用左侧边栏。`);
      if (audienceApplied()) closeChooser();
      return 'live2d';
    }
    setCaption('还没有可用的 Live2D 模型。请先在左侧边栏选择本地文件夹，或用 npm run dev:live2d 加载 Hiyori。');
    return 'missing';
  }

  function faceMarkup(kind) {
    if (kind === 'live2d') {
      return `<span class="rb-drift-face rb-drift-face-live2d" aria-hidden="true"><i></i><i></i><i></i></span>`;
    }
    return `<span class="rb-drift-face rb-drift-face-bloub" aria-hidden="true"><i></i><i></i></span>`;
  }

  function mount(container, options = {}) {
    if (!container) return null;
    activeController?.destroy();
    const settings = { ...defaults, ...options };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wall = document.createElement('div');
    wall.className = 'rb-drift-wall';
    container.setAttribute('aria-label', '选择数字观众形象');
    container.style.setProperty('--dw-overlay', settings.overlayColor);
    container.style.setProperty('--dw-dim', settings.dim);
    wall.style.setProperty('--dw-columns', settings.columns);
    wall.style.setProperty('--dw-tile-width', `${settings.tileWidth}px`);
    wall.style.setProperty('--dw-tile-height', `${settings.tileHeight}px`);
    wall.style.setProperty('--dw-gap', `${settings.gap}px`);
    wall.style.setProperty('--dw-radius', `${settings.radius}px`);
    wall.style.setProperty('--dw-tilt', `${settings.tilt}deg`);
    wall.style.setProperty('--dw-turn', `${settings.turn}deg`);
    wall.style.setProperty('--dw-roll', `${settings.roll}deg`);
    wall.style.setProperty('--dw-perspective', `${settings.perspective}px`);
    wall.style.setProperty('--dw-depth', `${settings.depth}px`);
    wall.style.setProperty('--dw-lift', `${settings.lift}px`);
    wall.style.setProperty('--dw-fade', settings.fade);
    wall.style.setProperty('--dw-fade-edge', `${settings.fade * 18}%`);
    wall.style.setProperty('--dw-overlay', settings.overlayColor);
    wall.classList.toggle('is-grayscale', settings.grayscale);

    const columns = [];
    for (let columnIndex = 0; columnIndex < settings.columns; columnIndex += 1) {
      const column = document.createElement('div');
      column.className = 'rb-drift-column';
      const track = document.createElement('div');
      track.className = 'rb-drift-track';
      const orderedItems = Array.from({ length: TILES_PER_COLUMN }, (_, itemIndex) => (
        chooserItems[(itemIndex + columnIndex) % chooserItems.length]
      ));
      [...orderedItems, ...orderedItems].forEach(item => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'rb-drift-tile';
        tile.dataset.kind = item.kind;
        tile.setAttribute('aria-label', `使用${item.label} ${item.name}`);
        tile.setAttribute('aria-pressed', 'false');
        tile.innerHTML = `${faceMarkup(item.kind)}<span class="rb-drift-label">${item.label} · ${item.name}</span>`;
        tile.addEventListener('click', event => {
          event.preventDefault();
          chooseAvatar(item.kind);
        });
        if (settings.pauseOnHover) {
          tile.addEventListener('mouseenter', () => { column.dataset.paused = 'true'; });
          tile.addEventListener('mouseleave', () => { delete column.dataset.paused; });
        }
        track.appendChild(tile);
      });
      column.appendChild(track); wall.appendChild(column);
      const alternating = columnIndex % 2 === 0 ? 1 : -1;
      const requestedDirection = settings.direction === 'down' ? -1 : 1;
      const variance = 1 + (((columnIndex * 37) % 100) / 100 - 0.5) * settings.variance;
      columns.push({ column, track, offset: -columnIndex * 83, velocity: settings.speed * variance * alternating * requestedDirection });
    }

    container.replaceChildren(wall);
    markChosen(currentKind());
    let frame = 0;
    let previous = performance.now();
    const cycle = TILES_PER_COLUMN * (settings.tileHeight + settings.gap);
    const renderColumns = () => {
      columns.forEach(entry => { entry.track.style.transform = `translate3d(0, ${entry.offset}px, 0)`; });
    };
    const animate = now => {
      const delta = Math.min((now - previous) / 1000, 0.05); previous = now;
      columns.forEach(entry => {
        if (!reduceMotion && !entry.column.dataset.paused) entry.offset -= entry.velocity * delta;
        entry.offset = ((entry.offset % cycle) + cycle) % cycle - cycle;
        entry.track.style.transform = `translate3d(0, ${entry.offset}px, 0)`;
      });
      frame = requestAnimationFrame(animate);
    };
    if (reduceMotion) renderColumns(); else frame = requestAnimationFrame(animate);

    const pointerMove = event => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * settings.parallax * 42;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * settings.parallax * 42;
      wall.style.setProperty('--dw-pointer-x', `${x}px`); wall.style.setProperty('--dw-pointer-y', `${y}px`);
    };
    const pointerLeave = () => { wall.style.setProperty('--dw-pointer-x', '0px'); wall.style.setProperty('--dw-pointer-y', '0px'); };
    if (!reduceMotion) {
      container.addEventListener('pointermove', pointerMove); container.addEventListener('pointerleave', pointerLeave);
    }

    const onSelection = () => markChosen(currentKind());
    document.addEventListener('creator:local-avatar-selection-change', onSelection);

    const controller = {
      destroy() {
        cancelAnimationFrame(frame);
        document.removeEventListener('creator:local-avatar-selection-change', onSelection);
        if (!reduceMotion) {
          container.removeEventListener('pointermove', pointerMove); container.removeEventListener('pointerleave', pointerLeave);
        }
        if (container.contains(wall)) container.replaceChildren();
        if (activeController === controller) activeController = null;
      }
    };
    activeController = controller;
    return controller;
  }

  function refresh(settings = currentSettings()) {
    const container = document.querySelector('#avatarDriftWall');
    if (container && !container.hidden) mount(container, settings);
  }

  document.addEventListener('creator:component-settings-change', event => {
    if (event.detail?.driftWall) refresh(event.detail.driftWall);
  });
  const boot = () => {
    refresh();
    document.querySelector('[data-audience-avatar-switch]')?.addEventListener('click', openChooser);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();

  window.CreatorDriftWall = {
    defaults: { ...defaults },
    items: chooserItems.map(item => ({ ...item })),
    TILES_PER_COLUMN,
    mount,
    refresh,
    chooseAvatar,
    openChooser,
    closeChooser,
    destroy: () => activeController?.destroy()
  };
})();
