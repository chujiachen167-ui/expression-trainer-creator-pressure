const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makePage } = require('./qa-dom-helper');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'drift-wall.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'drift-wall.css'), 'utf8');

assert.match(script, /TILES_PER_COLUMN = 15/, 'the wall must keep the original column length so the loop can wrap');
assert.match(script, /\[\.\.\.orderedItems, \.\.\.orderedItems\]/, 'each column must duplicate one cycle of tiles');
assert.match(script, /TILES_PER_COLUMN \* \(settings\.tileHeight \+ settings\.gap\)/, 'the wrap distance must equal one tile cycle, not the whole track');
assert.match(script, /createElement\('button'\)/, 'chooser tiles must be real buttons');
assert.match(script, /aria-label', '选择数字观众形象'/, 'the wall must expose a chooser name');
assert.match(script, /openChooser/, 'after a choice is applied there must be a way back to the wall');
assert.doesNotMatch(script, /picsum\.photos/, 'stock photos must not stand in for audience choices');
assert.doesNotMatch(script, /audience-preview\/.*\.jpg/, 'do not ship unsolicited generated stills as chooser art');
assert.match(script, /rb-drift-face-bloub/, 'bloub tiles use a CSS face, not a generated image');
assert.match(script, /if \(reduceMotion\) renderColumns\(\); else frame = requestAnimationFrame\(animate\);/,
  'reduced motion must not keep a permanent animation-frame loop alive');
assert.match(styles, /prefers-reduced-motion:[\s\S]*\.rb-drift-tile:hover \{ transform: translateZ\(0\); filter: none; \}/,
  'reduced motion must also remove pointer-driven depth movement');

const page = makePage('v2-ai-audience.html', {
  extraScripts: ['live2d-local-validator.js', 'live2d-local-import.js', 'drift-wall.js']
});
page.window.requestAnimationFrame = () => 1;
page.window.cancelAnimationFrame = () => {};
const wall = page.window.document.querySelector('#avatarDriftWall');
page.window.CreatorDriftWall.mount(wall);
const buttons = [...wall.querySelectorAll('button.rb-drift-tile')];
assert.ok(buttons.length >= 30, 'columns must still contain a doubled 15-tile cycle');
assert.equal(new Set(buttons.map(button => button.dataset.kind)).has('bloub'), true);
assert.equal(new Set(buttons.map(button => button.dataset.kind)).has('live2d'), true);
assert.equal(wall.querySelector('img'), null, 'chooser tiles must not depend on generated images');
const live2dTile = buttons.find(button => button.dataset.kind === 'live2d');
live2dTile.click();
assert.match(page.window.document.querySelector('.audience-preview-caption strong').textContent, /左侧边栏|Hiyori|Live2D/);
const bloubTile = buttons.find(button => button.dataset.kind === 'bloub');
bloubTile.click();
assert.match(page.window.document.querySelector('.audience-preview-caption strong').textContent, /bloub/);
assert(page.window.document.querySelector('[data-audience-avatar-switch]'), 'live stage must keep a switch-back control');
page.window.close();

console.log('Drift Wall chooser: original loop math, CSS faces, and switch-back entry passed.');
