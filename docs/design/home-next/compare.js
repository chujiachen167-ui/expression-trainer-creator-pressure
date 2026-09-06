(() => {
  'use strict';
  let option = 'a';
  let device = window.innerWidth < 760 ? 'mobile' : 'desktop';
  const frame = document.querySelector('#preview');
  function update(reload) {
    const lang = document.querySelector('#locale').value;
    const page = `option-${option}.html?lang=${lang}`;
    if (reload) frame.src = page;
    frame.classList.toggle('mobile', device === 'mobile');
    frame.title = `首页方案 ${option.toUpperCase()} 交互预览`;
    const link = document.querySelector('#open-page');
    link.href = page; link.textContent = `单独打开 ${option.toUpperCase()} ↗`;
    document.querySelectorAll('[data-option]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.option === option)));
    document.querySelectorAll('[data-device]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.device === device)));
  }
  document.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', () => { option = button.dataset.option; update(true); }));
  document.querySelectorAll('[data-device]').forEach(button => button.addEventListener('click', () => { device = button.dataset.device; update(false); }));
  document.querySelector('#locale').addEventListener('change', () => update(true));
  update(false);
})();
