/*
 * Local adaptation of React Bits Scroll Expand for the non-React Electron shell.
 * It retains the upstream component's core grammar: a clipped rounded frame grows
 * from the selected entry to the full viewport while the content settles into view.
 */
(() => {
  const storageKey = 'expression-trainer.scroll-expand.entry';
  const MAX_TRANSITION_DURATION = 500;
  const MAX_FEEDBACK_DURATION = 300;
  const fallback = {
    enabled: true,
    duration: 480,
    startRadius: 24,
    endRadius: 0,
    overlayScrim: 0.32,
    contentDelay: 0.48,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    backgroundHandoff: true,
    handoffDuration: 340,
    handoffContentDelay: 0.16,
    handoffOffset: 24,
    handoffDirection: 'random'
  };

  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const settings = () => ({ ...fallback, ...(window.CreatorQAControls?.getState?.().components?.scrollExpand || {}) });
  const safeSet = value => { try { sessionStorage.setItem(storageKey, JSON.stringify(value)); } catch (_) { /* Navigation still works without the arrival cue. */ } };
  const safeGet = () => { try { return JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch (_) { return null; } };
  const safeRemove = () => { try { sessionStorage.removeItem(storageKey); } catch (_) { /* No stored transition. */ } };
  const directions = ['up', 'down', 'left', 'right'];
  const chooseDirection = value => value === 'random' || !directions.includes(value) ? directions[Math.floor(Math.random() * directions.length)] : value;
  let transitionInFlight = false;
  let arrivalTimer = 0;

  // A launcher page can be restored from the browser back/forward cache without
  // this script being evaluated again. Never let a departure overlay become part
  // of that cached page, or it will sit above the launcher and consume all taps.
  function clearDepartureOverlay() {
    document.querySelectorAll('.scroll-expand-transition').forEach(transition => {
      try { transition.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel()); } catch (_) { /* Best-effort cleanup only. */ }
      transition.remove();
    });
    document.querySelectorAll('.version-card.is-scroll-expand-source').forEach(card => {
      try { card.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel()); } catch (_) { /* Best-effort cleanup only. */ }
      card.classList.remove('is-scroll-expand-source');
    });
    transitionInFlight = false;
    document.documentElement.classList.remove('is-page-transitioning');
  }

  function clearArrivalState() {
    if (arrivalTimer) {
      window.clearTimeout(arrivalTimer);
      arrivalTimer = 0;
    }
    safeRemove();
    document.documentElement.classList.remove('scroll-expand-entry-pending', 'scroll-expand-entry-settling');
    document.documentElement.removeAttribute('data-scroll-expand-mode');
    document.documentElement.removeAttribute('data-scroll-expand-direction');
  }

  function playArrival() {
    const mode = document.body.dataset.mode;
    const entry = safeGet();
    if (!mode || !entry || entry.mode !== mode) return;
    const stale = !Number.isFinite(Number(entry.at)) || Date.now() - Number(entry.at) > 15000;
    if (reduceMotion() || stale) {
      clearArrivalState();
      return;
    }
    safeRemove();
    const config = settings();
    if (!config.backgroundHandoff) {
      clearArrivalState();
      return;
    }
    const duration = Math.min(MAX_TRANSITION_DURATION, Math.max(260, Number(config.handoffDuration) || fallback.handoffDuration));
    const contentDelay = Math.min(0.7, Math.max(0, Number(config.handoffContentDelay) || 0));
    const contentOffset = Math.min(96, Math.max(0, Number(config.handoffOffset) || 0));
    const direction = directions.includes(entry.direction) ? entry.direction : chooseDirection(config.handoffDirection);
    document.documentElement.style.setProperty('--se-arrival-duration', `${duration}ms`);
    document.documentElement.style.setProperty('--se-arrival-ease', entry.easing || fallback.easing);
    document.documentElement.style.setProperty('--se-handoff-content-delay', `${Math.round(duration * contentDelay)}ms`);
    document.documentElement.style.setProperty('--se-handoff-element-duration', `${Math.round(duration * 0.52)}ms`);
    document.documentElement.style.setProperty('--se-handoff-topbar-delay', `${Math.round(duration * 0.1)}ms`);
    document.documentElement.style.setProperty('--se-handoff-offset', `${contentOffset}px`);
    document.documentElement.dataset.scrollExpandDirection = direction;
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('scroll-expand-entry-settling')));
    arrivalTimer = window.setTimeout(() => {
      clearArrivalState();
    }, duration + 90);
  }

  function startTransition(card, event) {
    if (transitionInFlight || event.defaultPrevented || event.button !== 0 || event.detail === 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const config = settings();
    if (!config.enabled) return;
    const href = card.href;
    if (!href) return;
    // Reduced-motion users keep the native anchor path: no overlay, no delay,
    // and no scripted navigation that could fire after a cancelled lifecycle.
    if (reduceMotion()) return;

    event.preventDefault();
    transitionInFlight = true;
    document.documentElement.classList.add('is-page-transitioning');
    const rect = card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const frame = document.createElement('div');
    const transition = document.createElement('div');
    const scrim = document.createElement('div');
    const label = document.createElement('span');
    const duration = Math.min(MAX_TRANSITION_DURATION, Math.max(250, Number(config.duration) || fallback.duration));
    const endAt = Math.min(0.9, Math.max(0.2, Number(config.contentDelay) || fallback.contentDelay));

    transition.className = 'scroll-expand-transition';
    frame.className = 'scroll-expand-transition__frame';
    label.className = 'scroll-expand-transition__label';
    label.textContent = card.querySelector('h2')?.textContent?.trim() || `进入 ${String(card.dataset.version || '').toUpperCase()}`;
    scrim.className = 'scroll-expand-transition__scrim';
    const startClip = `inset(${Math.max(0, rect.top)}px ${Math.max(0, viewportWidth - rect.right)}px ${Math.max(0, viewportHeight - rect.bottom)}px ${Math.max(0, rect.left)}px round ${Math.max(0, Number(config.startRadius) || 0)}px)`;
    frame.style.setProperty('--se-top', `${Math.max(0, rect.top)}px`);
    frame.style.setProperty('--se-right', `${Math.max(0, viewportWidth - rect.right)}px`);
    frame.style.setProperty('--se-bottom', `${Math.max(0, viewportHeight - rect.bottom)}px`);
    frame.style.setProperty('--se-left', `${Math.max(0, rect.left)}px`);
    frame.style.setProperty('--se-start-radius', `${Math.max(0, Number(config.startRadius) || 0)}px`);
    frame.style.clipPath = startClip;
    frame.append(label, scrim);
    transition.append(frame);
    document.body.append(transition);
    card.classList.add('is-scroll-expand-source');

    const frameAnimation = frame.animate([
      { clipPath: startClip },
      { clipPath: `inset(0px 0px 0px 0px round ${Math.max(0, Number(config.endRadius) || 0)}px)` }
    ], { duration, easing: config.easing || fallback.easing, fill: 'forwards' });
    // The source card remains in layout but its contents quietly leave. The
    // transition layer owns the single visible mode label; no text-bearing
    // card clone is enlarged underneath it.
    card.querySelectorAll(':scope > *').forEach(node => {
      node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.min(MAX_FEEDBACK_DURATION, duration), easing: 'ease-out', fill: 'forwards' });
    });
    scrim.animate([
      { opacity: 0 },
      { opacity: Math.max(0, Math.min(0.85, Number(config.overlayScrim) || 0)) }
    ], { duration: Math.round(duration * endAt), easing: 'ease-out', fill: 'forwards' });

    safeSet({ mode: card.dataset.version, direction: chooseDirection(config.handoffDirection), duration, easing: config.easing || fallback.easing, at: Date.now() });
    frameAnimation.finished.catch(() => {}).finally(() => {
      // A mobile Back gesture can cancel the departure before navigation. Do not
      // navigate forward again after that cleanup has restored the launcher.
      if (transitionInFlight) window.location.assign(href);
    });
  }

  function bindLauncher() {
    if (!document.body.classList.contains('launcher-page')) return;
    document.querySelectorAll('.version-card[data-version]').forEach(card => {
      card.addEventListener('click', event => startTransition(card, event));
    });
  }

  window.addEventListener('pagehide', () => {
    if (document.body.classList.contains('launcher-page')) {
      clearDepartureOverlay();
      return;
    }
    clearArrivalState();
  });
  window.addEventListener('pageshow', event => {
    if (!document.body.classList.contains('launcher-page')) {
      if (event.persisted) clearArrivalState();
      return;
    }
    clearDepartureOverlay();
    // No arrival handoff belongs to the launcher. A restored home page may
    // otherwise retain an old target-page cue in session storage.
    if (event.persisted) safeRemove();
  });

  playArrival();
  bindLauncher();
})();
