const assert = require('assert');
const { loadLexicon, analyzeText } = require('../lib/lexicon');
const { getASRStatus } = require('../lib/asr');
const { getRealtimePrompt, getReportPrompt } = require('../lib/prompts');

loadLexicon();
const result = analyzeText('咱就是说，我觉得这个东西可能很好。', { customWords: '咱就是说' });
assert(result.fillers.some(item => item.word === '咱就是说'), 'custom filler should enter inherited lexicon analysis');
assert(result.hedges.length >= 2, 'hedges should be detected by inherited lexicon');
assert(result.vagueWords.length >= 1, 'vague words should be detected by inherited lexicon');

const asr = getASRStatus();
assert.strictEqual(asr.engine, 'sherpa-onnx');
assert(Array.isArray(asr.missingFiles));

const realtime = getRealtimePrompt('测试表达', null, { goals: '先说结论' });
assert(realtime.system.includes('先说结论'));
const report = getReportPrompt('测试表达', { duration: 10, totalWords: 4, fillers: 0, hedges: 0, vagueWords: 0 });
assert(report.user.includes('测试表达'));

console.log('Desktop diagnostic core contract tests passed.');
