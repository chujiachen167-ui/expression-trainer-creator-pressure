/** Native adaptation of the depth-stacked browsing pattern used by React Bits Depth Carousel. */
(() => {
  const root = document.querySelector('[data-depth-carousel]');
  if (!root) return;

  const slides = [...root.querySelectorAll('[data-carousel-slide]')];
  const previous = root.querySelector('[data-carousel-prev]');
  const next = root.querySelector('[data-carousel-next]');
  const counter = root.querySelector('[data-carousel-counter]');
  const label = root.querySelector('[data-carousel-live]');
  if (!slides.length) return;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let active = 0;
  let timer = null;
  let paused = false;
  let pointerStart = null;

  const setPosition = (position, index) => {
    const distance = (index - position + slides.length) % slides.length;
    return distance > slides.length / 2 ? distance - slides.length : distance;
  };

  function render() {
    slides.forEach((slide, index) => {
      const position = setPosition(active, index);
      slide.dataset.position = position;
      slide.setAttribute('aria-hidden', position === 0 ? 'false' : 'true');
      slide.tabIndex = position === 0 ? 0 : -1;
    });
    if (counter) counter.textContent = `${String(active + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    if (label) label.textContent = slides[active].dataset.carouselLabel || `联系入口 ${active + 1}`;
  }

  function go(step) {
    active = (active + step + slides.length) % slides.length;
    render();
    restart();
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function restart() {
    stop();
    if (reducedMotion?.matches || paused || slides.length < 2) return;
    timer = window.setInterval(() => go(1), 7000);
  }

  function stopPointerGesture(event) {
    event.stopPropagation();
  }
  previous?.addEventListener('pointerdown', stopPointerGesture);
  next?.addEventListener('pointerdown', stopPointerGesture);
  previous?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); go(-1); });
  next?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); go(1); });
  root.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
  });
  root.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY };
    root.setPointerCapture?.(event.pointerId);
  });
  root.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const deltaX = event.clientX - pointerStart.x;
    pointerStart = null;
    if (Math.abs(deltaX) < 48) return;
    go(deltaX > 0 ? -1 : 1);
  });
  root.addEventListener('pointercancel', () => { pointerStart = null; });
  root.addEventListener('pointerenter', () => { paused = true; stop(); });
  root.addEventListener('pointerleave', () => { paused = false; restart(); });
  root.addEventListener('focusin', () => { paused = true; stop(); });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) { paused = false; restart(); }
  });
  reducedMotion?.addEventListener?.('change', restart);

  render();
  restart();
})();
