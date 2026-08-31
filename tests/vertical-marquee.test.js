const assert = require('node:assert/strict');
const { read, storageKey, makePage, input } = require('./qa-dom-helper');
const { defaults, normalize, migrate, parseExamples, segments } = require('../vertical-marquee-config');

// JSDOM has no media-query evaluator or animation timeline. Materialize only
// this media query to test the actual CSS cascade; this is NOT a motion render.
function applyReducedMotionCss(window, enabled) {
  window.document.querySelector('[data-test-reduced-motion]')?.remove();
  if (!enabled) return;
  const rules = [...window.document.styleSheets].flatMap(sheet => [...sheet.cssRules])
    .filter(rule => rule.conditionText === '(prefers-reduced-motion: reduce)')
    .flatMap(rule => [...rule.cssRules].map(child => child.cssText));
  const style = window.document.createElement('style');
  style.dataset.testReducedMotion = '';
  style.textContent = rules.join('\n');
  window.document.head.append(style);
}

async function run() {
  assert.equal(parseExamples(defaults.examples).length, 10);
  assert.equal(parseExamples('only one line'), null);
  assert.equal(parseExamples('a\nb\nc'), null);
  assert.equal(normalize({ repeat: 999, scrollDuration: -1, rawColor: 'url(bad)' }).repeat, 6);
  assert.equal(normalize({ scrollDuration: -1 }).scrollDuration, 12000);
  assert.equal(normalize({ rawColor: 'url(bad)' }).rawColor, defaults.rawColor);
  assert.equal(normalize({ playbackMode: 'broken' }).playbackMode, 'autoplay');
  assert.equal(defaults.pauseOnHover, true);
  assert.equal(migrate({ pauseOnHover: false }).pauseOnHover, true, 'old manual-control drafts migrate to hover pause');
  assert.equal(migrate({ labelColor: '#123456' }).issueColor, '#123456');
  assert.equal(migrate({ rawColor: '#654321' }).followTheme, false);
  const legacyMarks = migrate({ highlightStyle: 'underline', rawColor: '#654321', examples: '自己的[[草稿]]\n自己的优化稿' });
  assert.equal(legacyMarks.highlightStyle, 'random');
  assert.equal(legacyMarks.rawColor, '#654321');
  assert.equal(legacyMarks.examples, '自己的[[草稿]]\n自己的优化稿');
  assert.equal(migrate({ ...legacyMarks, highlightStyle: 'box' }).highlightStyle, 'box', 'after migration, later explicit marker choices must survive refresh');
  assert.deepEqual(segments('a[[b]]c'), [{ text: 'a', marked: false }, { text: 'b', marked: true }, { text: 'c', marked: false }]);

  const extraScripts = ['vendor/magic-ui/marquee.js', 'launcher-transcript.js'];
  const dom = makePage('index.html', { extraScripts, draft: { components: { transcriptCover: { scrollDuration: 26000, rawColor: '#654321', labelColor: '#123456' } }, copy: { 'launcher.document-title': 'Founder title' } } });
  const { window } = dom;
  const doc = window.document;
  const stream = doc.querySelector('[data-transcript-stream]');
  const cover = doc.querySelector('[data-transcript-cover]');
  assert.equal(doc.title, 'Founder title');
  assert.equal(stream.children.length, 4);
  assert.equal(stream.dataset.playbackMode, 'autoplay', 'legacy drafts inherit autoplay without losing copy or speed');
  assert.equal(stream.dataset.paused, 'false');
  assert.equal(stream.dataset.pauseOnHover, 'true');
  assert.equal(doc.querySelector('[data-marquee-pause]'), null, 'the page must not expose a playback button');
  assert.equal(stream.children[0].children.length, 10);
  assert.equal(stream.querySelectorAll('.magic-marquee-group[aria-hidden="true"]').length, 3);
  assert(stream.querySelector('.transcript-raw mark'));
  assert(stream.querySelector('.transcript-clean strong'));
  assert(!/原句|精炼|LIVE EDIT|正在整理/.test(cover.textContent));
  assert.equal(stream.style.getPropertyValue('--duration'), '26000ms');
  assert.equal(cover.style.getPropertyValue('--transcript-raw-color'), '#654321');
  assert.equal(cover.style.getPropertyValue('--transcript-issue-color'), '#123456');
  assert.equal(window.getComputedStyle(cover).backgroundColor, 'rgba(0, 0, 0, 0)');
  assert(!read('shared.css').includes('.transcript-cover::before'));
  assert.match(read('vendor/magic-ui/marquee.css'), /translateY\(calc\(-100% - var\(--gap\)\)\)/);
  assert.match(read('vendor/magic-ui/marquee.css'), /prefers-reduced-motion/);
  assert(!read('vendor/magic-ui/marquee.css').includes(':focus-within'), 'clicking or focusing text must not silently suspend playback');

  for (const tabName of ['vertical-marquee', 'palette', 'components', 'scroll-expand', 'copy', 'ui', 'vertical-marquee', 'components', 'vertical-marquee']) {
    doc.querySelector(`[data-qa-tab="${tabName}"]`).click();
    assert.equal(doc.querySelectorAll('.qa-page:not([hidden])').length, 1);
    assert.equal(doc.querySelector('.qa-page:not([hidden])').dataset.qaPage, tabName);
  }
  input(window, 'components.transcriptCover.reverse', true);
  input(window, 'components.transcriptCover.pauseOnHover', false);
  input(window, 'components.transcriptCover.scrollDuration', 18000);
  input(window, 'components.transcriptCover.repeat', 2);
  input(window, 'components.transcriptCover.gap', 48);
  assert.equal(stream.children.length, 2);
  assert.equal(stream.dataset.reverse, 'true');
  assert.equal(stream.dataset.pauseOnHover, 'false');
  assert.equal(stream.style.getPropertyValue('--duration'), '18000ms');
  assert.equal(stream.style.getPropertyValue('--gap'), '48px');
  assert.equal(doc.querySelector('[data-path="components.transcriptCover.paused"]'), null, 'manual pause must not remain in the QA page');
  const palette = doc.querySelector('[data-qa-palette="slate-cyan"]');
  palette.click();
  assert.equal(window.CreatorQAControls.getState().theme.palette, 'slate-cyan');
  assert.equal(doc.documentElement.style.getPropertyValue('--bg'), '#111113');
  input(window, 'theme.accent', '#123456');
  assert.equal(window.CreatorQAControls.getState().theme.palette, 'custom');
  input(window, 'components.transcriptCover.enabled', false);
  assert(cover.hidden);
  assert(doc.querySelector('.launcher-hero').classList.contains('without-marquee'));
  input(window, 'components.transcriptCover.enabled', true);
  assert(!cover.hidden);
  input(window, 'components.transcriptCover.followTheme', true);
  input(window, 'components.transcriptCover.cleanColor', '#111111');
  assert.equal(window.CreatorQAControls.getState().components.transcriptCover.followTheme, false);
  assert.equal(cover.style.getPropertyValue('--transcript-clean-color'), '#111111');
  input(window, 'components.transcriptCover.highlightStyle', 'both');
  assert.equal(cover.dataset.highlightStyle, 'both');
  input(window, 'components.transcriptCover.examples', '我[[其实]]想聊内容。\n我想聊[[内容]]。');
  assert.equal(stream.children[0].children.length, 1);
  input(window, 'components.transcriptCover.examples', 'unfinished');
  assert.equal(stream.children[0].children.length, 1, 'invalid in-progress edits must retain the preview');
  assert.match(doc.querySelector('[data-marquee-example-status]').textContent, /保留上一份/);
  input(window, 'components.transcriptCover.examples', '<img src=x onerror=alert(1)>[[多余]]\n<strong>文本</strong>');
  assert.equal(stream.querySelectorAll('img').length, 0, 'editable examples must never interpret HTML');

  let saved;
  window.api = { saveProjectConfig: async content => { saved = content; return { success: true, path: 'test-config.js' }; } };
  doc.querySelector('[data-qa-save-project]').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(saved, /"reverse": true/);
  assert.match(saved, /Founder title/);
  assert.match(doc.querySelector('[data-qa-save-status]').textContent, /写入当前项目/);
  const reloaded = makePage('index.html', { extraScripts, draft: JSON.parse(window.localStorage.getItem(storageKey)) });
  assert.equal(reloaded.window.document.querySelector('[data-transcript-stream]').dataset.reverse, 'true');
  assert.equal(reloaded.window.document.title, 'Founder title');
  reloaded.window.close();
  window.close();

  for (const page of ['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
    assert(read(page).indexOf('vertical-marquee-config.js') < read(page).indexOf('control-panel.js'));
    const view = makePage(page);
    assert(view.window.document.querySelector('[data-qa-tab="vertical-marquee"]'));
    view.window.close();
  }
  const production = makePage('index.html', { production: true, extraScripts, project: { components: { transcriptCover: { reverse: true } } } });
  assert(!production.window.document.querySelector('.qa-panel'));
  assert.equal(production.window.document.querySelector('[data-transcript-stream]').dataset.reverse, 'true');
  production.window.close();

  // Initial playback across both system preferences, without wheel/scroll input.
  for (const reduced of [false, true]) {
    for (const mode of ['autoplay', 'system', 'static']) {
      const view = makePage('index.html', { extraScripts, reducedMotion: reduced,
        draft: { components: { transcriptCover: { playbackMode: mode } } } });
      const w = view.window;
      applyReducedMotionCss(w, reduced);
      const viewport = w.document.querySelector('[data-transcript-stream]');
      const staticMode = mode === 'static' || (mode === 'system' && reduced);
      assert.equal(viewport.dataset.paused, String(staticMode));
      assert.equal(w.getComputedStyle(viewport).overflow, staticMode ? 'auto' : 'hidden');
      assert.equal(w.getComputedStyle(viewport.firstChild).animation === 'none', staticMode);
      if (!staticMode) {
        assert.match(w.getComputedStyle(viewport.firstChild).animation, /magic-marquee .*linear infinite/);
        assert.equal(w.getComputedStyle(viewport.firstChild).animationName, 'magic-marquee-vertical');
      }
      assert.equal(w.getComputedStyle(viewport.children[1]).display, staticMode ? 'none' : 'flex');
      assert.equal(w.document.querySelector('[data-marquee-pause]'), null);
      if (staticMode) {
        viewport.scrollTop = 180;
        input(w, 'components.transcriptCover.playbackMode', 'autoplay');
        assert.equal(viewport.dataset.playbackMode, 'autoplay');
        assert.equal(viewport.dataset.paused, 'false');
        assert.equal(viewport.scrollTop, 0);
        assert.notEqual(w.getComputedStyle(viewport.firstChild).animation, 'none');
        assert.equal(w.getComputedStyle(viewport).overflow, 'hidden');
        const reload = makePage('index.html', { extraScripts, reducedMotion: reduced,
          draft: JSON.parse(w.localStorage.getItem(storageKey)) });
        assert.equal(reload.window.document.querySelector('[data-transcript-stream]').dataset.playbackMode, 'autoplay');
        reload.window.close();
      }
      // Follow live changes only when requested. Explicit autoplay remains on.
      input(w, 'components.transcriptCover.playbackMode', 'system');
      view.setReducedMotion(true);
      assert.equal(viewport.dataset.paused, 'true');
      viewport.scrollTop = 120;
      view.setReducedMotion(false);
      assert.equal(viewport.dataset.paused, 'false');
      assert.equal(viewport.scrollTop, 0);
      input(w, 'components.transcriptCover.playbackMode', 'autoplay');
      view.setReducedMotion(true);
      assert.equal(viewport.dataset.paused, 'false');
      w.close();
    }
  }
  console.log('Vertical Marquee: DOM behavior, parameter wiring, legacy migration, safe copy, tab switching and persistence passed (not a rendered animation test).');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
