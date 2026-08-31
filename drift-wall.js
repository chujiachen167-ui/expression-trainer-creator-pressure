/*
 * Static-JavaScript port of React Bits DriftWall (JS + CSS variant).
 * Source and parameter model: https://github.com/DavidHDev/react-bits/tree/main/src/content/Components/DriftWall
 */
(() => {
  const imageIds = [1015, 1025, 1039, 1043, 1044, 1050, 1062, 1069, 1074, 1080, 1084, 106, 110, 133, 164];
  const items = imageIds.map(id => ({ src: `https://picsum.photos/id/${id}/600/400`, alt: '' }));
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

  function mount(container, options = {}) {
    if (!container) return null;
    activeController?.destroy();
    const settings = { ...defaults, ...options };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wall = document.createElement('div');
    wall.className = 'rb-drift-wall';
    wall.setAttribute('aria-hidden', 'true');
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
      const orderedItems = items.map((_, itemIndex) => items[(itemIndex + columnIndex * 3) % items.length]);
      [...orderedItems, ...orderedItems].forEach(item => {
        const tile = document.createElement('div');
        tile.className = 'rb-drift-tile';
        const image = document.createElement('img');
        image.src = item.src; image.alt = item.alt; image.loading = 'lazy'; image.decoding = 'async'; image.draggable = false;
        tile.appendChild(image);
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
    let frame = 0;
    let previous = performance.now();
    const cycle = items.length * (settings.tileHeight + settings.gap);
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

    const controller = {
      destroy() {
        cancelAnimationFrame(frame);
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
  const boot = () => refresh();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();

  window.CreatorDriftWall = { defaults: { ...defaults }, items: [...items], mount, refresh, destroy: () => activeController?.destroy() };
})();
