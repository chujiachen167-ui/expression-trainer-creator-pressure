(() => {
  const marker = 'expression-trainer.read-transition.v1';
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function addGate(state) {
    const gate = document.createElement('div');
    gate.className = `reading-transition ${state}`;
    gate.setAttribute('aria-hidden', 'true');
    gate.innerHTML = '<div class="reading-leaf reading-leaf-left"><span>READ YOURSELF</span></div><div class="reading-spine"></div><div class="reading-leaf reading-leaf-right"><span>READ YOURSELF</span></div>';
    document.body.appendChild(gate);
    return gate;
  }

  function enterFromBook() {
    if (sessionStorage.getItem(marker) !== 'open' || reducedMotion) return;
    sessionStorage.removeItem(marker);
    const gate = addGate('is-opening');
    requestAnimationFrame(() => gate.classList.add('is-active'));
    setTimeout(() => gate.remove(), 760);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-read-transition]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reducedMotion) return;
    event.preventDefault();
    sessionStorage.setItem(marker, 'open');
    const gate = addGate('is-closing');
    requestAnimationFrame(() => gate.classList.add('is-active'));
    setTimeout(() => { window.location.href = link.href; }, 430);
  });

  enterFromBook();
})();
