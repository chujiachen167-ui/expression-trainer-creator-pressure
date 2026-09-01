const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { resampleTo16k } = require('../stt-audio');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function mixedTokens(value) {
  const normalized = String(value || '').normalize('NFKC').toLowerCase();
  return normalized.match(/[\p{Script=Han}]|[\p{L}\p{N}]+/gu) || [];
}

function editDistance(reference, hypothesis) {
  const previous = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  for (let i = 1; i <= reference.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= hypothesis.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[hypothesis.length];
}

function transcriptMetrics(reference, hypothesis) {
  const referenceChars = [...normalizeText(reference)];
  const hypothesisChars = [...normalizeText(hypothesis)];
  const referenceTokens = mixedTokens(reference);
  const hypothesisTokens = mixedTokens(hypothesis);
  const charEdits = editDistance(referenceChars, hypothesisChars);
  const tokenEdits = editDistance(referenceTokens, hypothesisTokens);
  return {
    referenceChars: referenceChars.length,
    hypothesisChars: hypothesisChars.length,
    charEdits,
    cer: referenceChars.length ? charEdits / referenceChars.length : (hypothesisChars.length ? 1 : 0),
    referenceTokens: referenceTokens.length,
    hypothesisTokens: hypothesisTokens.length,
    tokenEdits,
    mixedTokenErrorRate: referenceTokens.length ? tokenEdits / referenceTokens.length : (hypothesisTokens.length ? 1 : 0)
  };
}

function readWav(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path.basename(filePath)} 不是有效的 WAV 文件。`);
  }
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      format = {
        audioFormat: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bitsPerSample: buffer.readUInt16LE(start + 14)
      };
    }
    if (id === 'data') data = buffer.subarray(start, Math.min(buffer.length, start + size));
    offset = start + size + (size % 2);
  }
  if (!format || !data) throw new Error(`${path.basename(filePath)} 缺少 WAV fmt 或 data 区块。`);
  if (![1, 3].includes(format.audioFormat)) throw new Error('只支持 PCM 或 IEEE float WAV。');
  if (![1, 2].includes(format.channels)) throw new Error('只支持单声道或双声道 WAV。');
  if (!([16, 32].includes(format.bitsPerSample))) throw new Error('只支持 16-bit PCM 或 32-bit float WAV。');

  const bytesPerSample = format.bitsPerSample / 8;
  const frames = Math.floor(data.length / bytesPerSample / format.channels);
  const samples = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < format.channels; channel += 1) {
      const index = (frame * format.channels + channel) * bytesPerSample;
      if (format.audioFormat === 3) sum += data.readFloatLE(index);
      else if (format.bitsPerSample === 16) sum += data.readInt16LE(index) / 32768;
      else sum += data.readInt32LE(index) / 2147483648;
    }
    samples[frame] = Math.max(-1, Math.min(1, sum / format.channels));
  }
  const normalized = resampleTo16k(samples, format.sampleRate);
  return {
    samples: normalized,
    sourceSampleRate: format.sampleRate,
    sourceChannels: format.channels,
    durationMs: Math.round(normalized.length / 16000 * 1000)
  };
}

async function runCurrentStreamingParaformer(samples, { chunkSize = 2048 } = {}) {
  const { initASR, feedAudio, stopRecognition, getASRStatus } = require('./asr');
  await initASR();
  const started = performance.now();
  const finalParts = [];
  let lastPartial = '';
  let firstPartialAudioMs = null;
  let firstFinalAudioMs = null;
  for (let offset = 0; offset < samples.length; offset += chunkSize) {
    const end = Math.min(samples.length, offset + chunkSize);
    const result = feedAudio(samples.subarray(offset, end));
    if (!result?.text) continue;
    const consumedAudioMs = Math.round(end / 16000 * 1000);
    if (firstPartialAudioMs === null) firstPartialAudioMs = consumedAudioMs;
    if (result.isFinal) {
      if (firstFinalAudioMs === null) firstFinalAudioMs = consumedAudioMs;
      finalParts.push(result.text);
      lastPartial = '';
    } else {
      lastPartial = result.text;
    }
  }
  const tail = stopRecognition();
  if (tail) finalParts.push(tail);
  const inferenceMs = Math.round(performance.now() - started);
  const hypothesis = finalParts.join('') || lastPartial;
  return {
    model: getASRStatus().model,
    hypothesis,
    inferenceMs,
    firstPartialAudioMs,
    firstFinalAudioMs,
    finalSegments: finalParts.length
  };
}

module.exports = {
  normalizeText,
  mixedTokens,
  editDistance,
  transcriptMetrics,
  readWav,
  runCurrentStreamingParaformer
};
