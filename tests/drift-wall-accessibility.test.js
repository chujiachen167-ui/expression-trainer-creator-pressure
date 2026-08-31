const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'drift-wall.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'drift-wall.css'), 'utf8');

assert.match(script, /wall\.setAttribute\('aria-hidden', 'true'\)/,
  'the decorative Drift Wall must stay out of the accessibility tree');
assert.doesNotMatch(script, /createElement\('button'\)/,
  'decorative preview tiles must not create fake keyboard actions');
assert.doesNotMatch(script, /预览形象 \$\{/,
  'decorative repeated tiles must not produce duplicated accessible names');
assert.match(script, /image\.loading = 'lazy'/,
  'repeated preview imagery should not all load eagerly');
assert.match(script, /image\.decoding = 'async'/,
  'preview imagery should decode without blocking the main interaction');
assert.match(script, /if \(reduceMotion\) renderColumns\(\); else frame = requestAnimationFrame\(animate\);/,
  'reduced motion must not keep a permanent animation-frame loop alive');
assert.match(styles, /prefers-reduced-motion:[\s\S]*\.rb-drift-tile:hover \{ transform: translateZ\(0\); filter: none; \}/,
  'reduced motion must also remove pointer-driven depth movement');

console.log('Drift Wall accessibility contract tests passed.');
