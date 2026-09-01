const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeText, mixedTokens, editDistance, transcriptMetrics, readWav } = require('../lib/stt-benchmark');

assert.equal(normalizeText('你好，Content Hook！'), '你好contenthook');
assert.deepEqual(mixedTokens('三个 content hooks'), ['三', '个', 'content', 'hooks']);
assert.equal(editDistance([...('镜头')], [...('尽头')]), 1);
const metrics = transcriptMetrics('先说结论', '先讲结论');
assert.equal(metrics.referenceChars, 4);
assert.equal(metrics.charEdits, 1);
assert.equal(metrics.cer, 0.25);

function makeWav(samples, sampleRate = 48000) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  return buffer;
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-stt-benchmark-'));
const wavPath = path.join(tempRoot, 'tone.wav');
fs.writeFileSync(wavPath, makeWav(Array.from({ length: 4800 }, (_, index) => Math.sin(index / 20) * 0.1)));
const wav = readWav(wavPath);
assert.equal(wav.sourceSampleRate, 48000);
assert.equal(wav.sourceChannels, 1);
assert.equal(wav.samples.length, 1600, '48 kHz WAV is normalized to 16 kHz');
assert.equal(wav.durationMs, 100);
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log('STT benchmark: mixed-language metrics, edit distance and WAV normalization passed.');
