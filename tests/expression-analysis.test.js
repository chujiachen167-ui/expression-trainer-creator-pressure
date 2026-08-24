const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

global.window = {};
const source = fs.readFileSync(path.join(__dirname, '..', 'expression-analysis.js'), 'utf8');
vm.runInThisContext(source, { filename: 'expression-analysis.js' });

const engine = window.CreatorExpressionAnalysis;
const sample = '嗯，我觉得这个方案可能有很多很多问题。测试测试，然后我觉得应该改一下。';
const result = engine.analyze(sample);

assert.ok(result.fillers.length >= 2, 'counts original filler vocabulary');
assert.ok(result.hedges.length >= 3, 'counts original hedge vocabulary');
assert.ok(result.vague.length >= 2, 'counts vague-to-precise vocabulary');
assert.ok(result.repeats.length >= 1, 'detects adjacent repeated phrases');
assert.ok(result.density >= 40 && result.density <= 80, 'strict density stays discriminating without collapsing to zero');
assert.match(engine.highlight(sample), /stt-token filler/);
assert.match(engine.highlight(sample), /stt-token hedge/);
assert.match(engine.highlight(sample), /stt-token vague/);
assert.ok(engine.suggestions(result).length >= 4, 'produces immediate diagnostic feedback');

console.log('Expression analysis contract tests passed.');
