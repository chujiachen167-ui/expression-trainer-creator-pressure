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

const englishSample = "Um, I think this project is kind of interesting. This project won't highlight the problem. This project won't highlight the problem.";
const english = engine.analyze(englishSample);
assert.ok(english.fillers.includes('um'), 'detects English fillers case-insensitively');
assert.ok(english.hedges.includes('i think'), 'detects English hedges');
assert.ok(english.hedges.includes('kind of'), 'detects multi-word English hedges');
assert.ok(english.vague.includes('interesting'), 'detects English vague wording');
assert.ok(english.repeats.length >= 1, 'detects repeated English clauses or phrases');
assert.match(engine.highlight(englishSample), /stt-token filler/);
assert.match(engine.highlight(englishSample), /stt-token hedge/);
assert.match(engine.highlight(englishSample), /stt-token vague/);
assert.match(engine.highlight(englishSample), /stt-token repeat/);
assert.match(engine.highlight(englishSample), />Um<\//, 'highlighting preserves the speaker transcript casing');
assert.match(engine.suggestions(english)[0].title, /Make|Filler|Hedge|Vague|Repeated|Structure/, 'English input receives English feedback');

const normalFunctionWords = engine.analyze('It works if the camera is ready.');
assert.equal(normalFunctionWords.fillers.length, 0, 'normal English function words such as it/if are not mislabeled as fillers');
assert.ok(english.density < 99 && english.density > 0, 'diagnosed English density is based on expression units rather than raw letters');

console.log('Expression analysis contract tests passed for Chinese, English and mixed-language input.');
