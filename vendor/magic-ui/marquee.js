/**
 * Magic UI Marquee — local vanilla-DOM adaptation. MIT; see ./LICENSE.
 * Source: https://magicui.design/r/marquee.json (retrieved 2026-08-31)
 * Original: https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/marquee.tsx
 * Preserves repeated flex groups, reverse, pauseOnHover, vertical, repeat,
 * --duration and --gap. Adds persistent pause and accessible duplicate hiding.
 */
(() => {
  function mount(root, children, initial = {}) {
    const options = { vertical: true, reverse: false, pauseOnHover: false, repeat: 4, duration: 40000, gap: 32, paused: false, playbackMode: 'system' };
    let renderedRepeat = 0;
    root.classList.add('magic-marquee');
    function update(incoming = {}) {
      Object.assign(options, incoming);
      options.repeat = Math.max(2, Math.min(6, Math.round(Number(options.repeat) || 4)));
      root.dataset.vertical = String(options.vertical !== false);
      root.dataset.reverse = String(Boolean(options.reverse));
      root.dataset.pauseOnHover = String(Boolean(options.pauseOnHover));
      root.dataset.paused = String(Boolean(options.paused));
      const playbackMode = ['autoplay', 'system', 'static'].includes(options.playbackMode) ? options.playbackMode : 'system';
      if (root.dataset.playbackMode !== playbackMode) {
        // Do not carry a static reader's scroll offset into the animation.
        root.scrollTop = 0;
        root.scrollLeft = 0;
      }
      root.dataset.playbackMode = playbackMode;
      root.style.setProperty('--duration', `${Math.max(12000, Number(options.duration) || 40000)}ms`);
      root.style.setProperty('--gap', `${Math.max(0, Number(options.gap) || 0)}px`);
      if (renderedRepeat === options.repeat) return;
      const groups = Array.from({ length: options.repeat }, (_, index) => {
        const group = root.ownerDocument.createElement('div');
        group.className = 'magic-marquee-group';
        if (index > 0) group.setAttribute('aria-hidden', 'true');
        children.forEach(child => group.append(child.cloneNode(true)));
        // Duplicates must still respond to the pointer when they scroll into
        // view. `inert` also disables hover; exclude only keyboard/AT duplicates.
        if (index > 0) group.querySelectorAll('[tabindex], button, a, input, select, textarea').forEach(node => { node.tabIndex = -1; });
        return group;
      });
      root.replaceChildren(...groups);
      renderedRepeat = options.repeat;
    }
    update(initial);
    return { update, destroy: () => root.replaceChildren() };
  }
  window.MagicUIMarquee = { mount };
})();
