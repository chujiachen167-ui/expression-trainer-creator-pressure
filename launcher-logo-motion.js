/** Homepage-only eye tracking and blink motion, sampled from the unchanged approved PNG. */
(() => {
  const root = document.querySelector('[data-brand-background]');
  if (!root || !window.CreatorLogoConfig || root.querySelector('[data-logo-art]')) return;
  const original = root.querySelector(':scope > svg');
  const source = original?.querySelector('image')?.getAttribute('href');
  if (!source) return;

  // Camera/lens coordinates refer to the original 1254px PNG. The approved
  // raster remains the fixed outer silhouette. Blink surfaces are traced from
  // its inner edges and morph to one shared seam instead of moving the lips.
  const cameraContour = 'M444 540 L496 478 H704 L745 515 H790 L824 552 V641 A190 182 0 0 1 444 641 Z';
  const blinkSeamY = 625;
  const lidCurves = {
    top: [
      { x: 130, y: 625 },
      { c1x: 250, c1y: 590, c2x: 350, c2y: 505, x: 460, y: 460 },
      { c1x: 555, c1y: 420, c2x: 705, c2y: 420, x: 800, y: 458 },
      { c1x: 915, c1y: 500, c2x: 1020, c2y: 585, x: 1138, y: 625 }
    ],
    bottom: [
      { x: 130, y: 625 },
      { c1x: 250, c1y: 675, c2x: 350, c2y: 765, x: 460, y: 807 },
      { c1x: 555, c1y: 842, c2x: 705, c2y: 842, x: 800, y: 810 },
      { c1x: 915, c1y: 770, c2x: 1020, c2y: 675, x: 1138, y: 625 }
    ]
  };
  const towardSeam = (value, progress) => value + (blinkSeamY - value) * progress;
  function lidPath(curve, progress = 0) {
    const start = curve[0];
    let path = `M${start.x} ${start.y}`;
    for (let index = 1; index < curve.length; index += 1) {
      const segment = curve[index];
      path += ` C${segment.c1x} ${segment.c1y} ${segment.c2x} ${segment.c2y} ${segment.x} ${segment.y}`;
    }
    for (let index = curve.length - 1; index > 0; index -= 1) {
      const segment = curve[index];
      const previous = curve[index - 1];
      path += ` C${segment.c2x} ${towardSeam(segment.c2y, progress).toFixed(3)} ${segment.c1x} ${towardSeam(segment.c1y, progress).toFixed(3)} ${previous.x} ${towardSeam(previous.y, progress).toFixed(3)}`;
    }
    return `${path} Z`;
  }
  const art = document.createElement('div');
  art.className = 'brand-background-art';
  art.dataset.logoArt = '';
  art.innerHTML = `<div class="brand-background-outline" data-logo-outline><svg viewBox="60 270 1140 720" focusable="false" aria-hidden="true">
    <defs>
      <filter id="logo-motion-outline-alpha" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -.2126 -.7152 -.0722 0 1"/><feComponentTransfer><feFuncA type="linear" slope="1.2" intercept="-.1"/></feComponentTransfer></filter>
      <mask id="logo-motion-outline-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254" style="mask-type: alpha"><image width="1254" height="1254" filter="url(#logo-motion-outline-alpha)"/></mask>
      <clipPath id="logo-motion-outline-outside"><path clip-rule="evenodd" d="M0 0H1254V1254H0Z ${cameraContour}"/></clipPath>
    </defs>
    <rect width="1254" height="1254" fill="currentColor" mask="url(#logo-motion-outline-mask)" clip-path="url(#logo-motion-outline-outside)"/>
  </svg></div>
  <div class="brand-background-camera" data-logo-camera><svg viewBox="60 270 1140 720" focusable="false">
    <defs>
      <filter id="logo-motion-ink" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="matrix" values="-.2126 -.7152 -.0722 0 1  -.2126 -.7152 -.0722 0 1  -.2126 -.7152 -.0722 0 1  0 0 0 0 1"/>
        <feComponentTransfer><feFuncR type="linear" slope="1.2" intercept="-.1"/><feFuncG type="linear" slope="1.2" intercept="-.1"/><feFuncB type="linear" slope="1.2" intercept="-.1"/></feComponentTransfer>
      </filter>
      <clipPath id="logo-motion-camera-clip"><path d="${cameraContour}"/></clipPath>
      <clipPath id="logo-motion-lens-clip"><circle cx="631" cy="668" r="85"/></clipPath>
      <mask id="logo-motion-camera-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254" style="mask-type: luminance">
        <g clip-path="url(#logo-motion-camera-clip)"><image data-logo-camera-source width="1254" height="1254" filter="url(#logo-motion-ink)"/>
          <circle cx="631" cy="668" r="85" fill="white"/>
          <g data-logo-lens><g clip-path="url(#logo-motion-lens-clip)"><image data-logo-lens-source width="1254" height="1254" filter="url(#logo-motion-ink)"/></g></g>
        </g>
      </mask>
    </defs>
    <rect width="1254" height="1254" fill="currentColor" mask="url(#logo-motion-camera-mask)"/>
  </svg></div>
  <svg class="brand-background-lids" viewBox="60 270 1140 720" focusable="false" aria-hidden="true">
    <path data-logo-lid="top" fill="currentColor" d="${lidPath(lidCurves.top)}"/>
    <path data-logo-lid="bottom" fill="currentColor" d="${lidPath(lidCurves.bottom)}"/>
  </svg>`;
  art.querySelectorAll('image').forEach(node => node.setAttribute('href', source));
  root.append(art);

  const camera = art.querySelector('[data-logo-camera]');
  const lens = art.querySelector('[data-logo-lens]');
  const topLid = art.querySelector('[data-logo-lid="top"]');
  const bottomLid = art.querySelector('[data-logo-lid="bottom"]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let settings = window.CreatorLogoConfig.normalizeBackground(window.CreatorProjectConfig?.config?.components?.logoBackground);
  let pointer = null, rect = null, dirtyGeometry = true, frame = 0, previousTime = 0;
  let blinkTimer = 0, blinkFrame = 0, blinkStart = null, intersects = true, pageSuspended = false, loaded = false;
  const movesCamera = () => settings.motionMode === 'camera' || settings.motionMode === 'combined';
  const movesLens = () => settings.motionMode === 'lens' || settings.motionMode === 'combined';
  const restingScale = () => movesCamera() ? settings.cameraScale : 1;
  const current = { x: 0, y: 0, scale: restingScale(), lensX: 0, lensY: 0 };

  const canShowArt = () => loaded && settings.enabled && settings.opacity > 0 && !reduced.matches;
  const canAnimate = () => canShowArt() && settings.motionMode !== 'off' && !document.hidden && !pageSuspended && intersects;
  const canBlink = (preview = false) => canShowArt() && (preview || settings.blinkEnabled) && !document.hidden && !pageSuspended && intersects;
  function geometry() {
    rect = art.getBoundingClientRect();
    dirtyGeometry = false;
    camera.style.transformOrigin = '50.350877% 52.777778%'; // source (634, 650)
  }
  function paint() {
    const scale = (rect?.width || 1140) / 1140;
    camera.style.transform = `translate3d(${(current.x * scale).toFixed(3)}px,${(current.y * scale).toFixed(3)}px,0) scale(${current.scale.toFixed(4)})`;
    lens.style.transform = `translate(${current.lensX.toFixed(3)}px,${current.lensY.toFixed(3)}px)`;
  }
  function stop(reset = true) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previousTime = 0;
    delete root.dataset.motionRunning;
    if (reset) {
      current.x = 0; current.y = 0; current.scale = restingScale(); current.lensX = 0; current.lensY = 0;
      paint();
    }
  }
  function clearBlink(reset = true) {
    if (blinkTimer) clearTimeout(blinkTimer);
    if (blinkFrame) cancelAnimationFrame(blinkFrame);
    blinkTimer = 0; blinkFrame = 0; blinkStart = null;
    if (reset) {
      topLid.setAttribute('d', lidPath(lidCurves.top));
      bottomLid.setAttribute('d', lidPath(lidCurves.bottom));
      root.removeAttribute('data-blinking');
    }
  }
  function scheduleBlink() {
    if (blinkTimer) clearTimeout(blinkTimer);
    blinkTimer = 0;
    if (!canBlink()) return;
    const min = settings.blinkMinDelay * 1000;
    const max = settings.blinkMaxDelay * 1000;
    blinkTimer = window.setTimeout(() => playBlink(false), min + Math.random() * Math.max(0, max - min));
  }
  function playBlink(preview = false) {
    if (!canBlink(preview)) return;
    clearBlink();
    root.style.setProperty('--logo-blink-duration', `${settings.blinkDuration}ms`);
    root.setAttribute('data-blinking', '');
    const duration = settings.blinkDuration;
    const animateBlink = time => {
      blinkFrame = 0;
      if (!canBlink(preview)) { clearBlink(); return; }
      if (blinkStart === null) blinkStart = time;
      const elapsed = Math.min(1, Math.max(0, (time - blinkStart) / duration));
      const phase = elapsed < .45 ? elapsed / .45 : elapsed <= .55 ? 1 : (1 - elapsed) / .45;
      const eased = phase * phase * (3 - 2 * phase);
      const closure = eased * settings.blinkDepth;
      topLid.setAttribute('d', lidPath(lidCurves.top, closure));
      bottomLid.setAttribute('d', lidPath(lidCurves.bottom, closure));
      if (elapsed < 1) blinkFrame = requestAnimationFrame(animateBlink);
      else {
        blinkStart = null;
        root.removeAttribute('data-blinking');
        scheduleBlink();
      }
    };
    blinkFrame = requestAnimationFrame(animateBlink);
  }
  function updateVisibility() {
    root.dataset.motionMode = settings.motionMode;
    const active = canShowArt() && (settings.motionMode !== 'off' || settings.blinkEnabled);
    root.toggleAttribute('data-motion-ready', active);
    art.hidden = !active;
    root.dataset.motionState = reduced.matches ? 'reduced' : !settings.enabled || settings.opacity === 0 ? 'off' : !loaded ? 'loading' : !intersects || document.hidden || pageSuspended ? 'suspended' : settings.motionMode === 'off' ? settings.blinkEnabled ? 'blink-only' : 'off' : 'ready';
  }
  function target() {
    const result = { x: 0, y: 0, scale: restingScale(), lensX: 0, lensY: 0 };
    if (!pointer || !rect?.width || !rect?.height) return result;
    let x = (pointer.x - (rect.left + rect.width * (634 - 60) / 1140)) / Math.max(1, window.innerWidth * .55);
    let y = (pointer.y - (rect.top + rect.height * (650 - 270) / 720)) / Math.max(1, window.innerHeight * .55);
    const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
    if (movesCamera()) {
      result.x = x * settings.cameraTravel;
      // The lower eyelid is the tight edge. This clamp keeps the raster camera
      // inside the opening even when a large travel value is selected.
      const safeVertical = Math.max(4, 170 - 164 * settings.cameraScale);
      result.y = y * Math.min(settings.cameraTravel * settings.cameraVerticalRatio, safeVertical);
    }
    if (movesLens()) {
      result.lensX = x * settings.lensTravel;
      result.lensY = y * settings.lensTravel;
    }
    return result;
  }
  function step(time) {
    frame = 0;
    if (!canAnimate()) { stop(); updateVisibility(); return; }
    if (dirtyGeometry) geometry();
    const dt = previousTime ? Math.min(64, Math.max(1, time - previousTime)) : 16.667;
    previousTime = time;
    const blend = 1 - Math.exp(-dt / settings.motionResponse);
    const goal = target();
    let moving = false;
    for (const key of Object.keys(current)) {
      current[key] += (goal[key] - current[key]) * blend;
      if (Math.abs(goal[key] - current[key]) < .005) current[key] = goal[key]; else moving = true;
    }
    paint();
    if (moving) frame = requestAnimationFrame(step);
    else { previousTime = 0; delete root.dataset.motionRunning; }
  }
  function wake() {
    if (!canAnimate()) return;
    if (!frame) { root.dataset.motionRunning = ''; frame = requestAnimationFrame(step); }
  }
  function release() { pointer = null; wake(); }
  function invalidate() { dirtyGeometry = true; wake(); }
  function suspend() { pointer = null; stop(); clearBlink(); updateVisibility(); }
  function resume() { dirtyGeometry = true; updateVisibility(); scheduleBlink(); wake(); }

  // Capture observes the whole homepage. It never cancels input, captures the
  // pointer, records positions or requests camera/microphone permissions.
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !event.isPrimary && event.isPrimary !== undefined || !canAnimate()) return;
    pointer = { x: event.clientX, y: event.clientY }; wake();
  }, { capture: true, passive: true });
  document.documentElement.addEventListener('pointerleave', release);
  window.addEventListener('blur', release);
  window.addEventListener('resize', invalidate, { passive: true });
  window.addEventListener('scroll', invalidate, { capture: true, passive: true });
  window.addEventListener('pagehide', () => { pageSuspended = true; suspend(); });
  window.addEventListener('pageshow', () => { pageSuspended = false; resume(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
  document.addEventListener('creator:logo-layout-change', invalidate);
  document.addEventListener('creator:logo-blink-preview', () => playBlink(true));
  document.addEventListener('creator:component-settings-change', event => {
    settings = window.CreatorLogoConfig.normalizeBackground(event.detail?.logoBackground);
    dirtyGeometry = true; pointer = null; stop(); clearBlink(); updateVisibility(); scheduleBlink(); wake();
  });
  reduced.addEventListener('change', () => { pointer = null; stop(); clearBlink(); updateVisibility(); scheduleBlink(); });
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(entries => {
      intersects = entries[0].isIntersecting;
      if (!intersects) suspend(); else resume();
    }).observe(art);
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(invalidate).observe(art);
  const image = new Image();
  image.onload = () => { loaded = true; updateVisibility(); geometry(); scheduleBlink(); wake(); };
  image.onerror = () => { loaded = false; suspend(); root.dataset.motionState = 'image-error'; };
  image.src = source;
  updateVisibility();
})();
