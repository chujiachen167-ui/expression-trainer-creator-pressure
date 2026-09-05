const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const client = read('web-stt.js');
const worker = read('functions/api/transcribe.js');
const app = read('app.js');
const packager = read('scripts/package-web.js');

assert(client.includes("const endpoint = '/api/transcribe'"), 'browser STT must use a same-origin endpoint');
assert(client.includes('audio/mp4'), 'Safari-compatible MediaRecorder output must be considered');
assert(client.includes('await uploadChain'), 'the final audio fragment must finish uploading before stop resolves');
assert(worker.includes("env.WEB_STT_ENABLED === 'true'"), 'cloud transcription must stay disabled until an owner enables it');
assert(worker.includes("'@cf/openai/whisper'"), 'the Pages Function must use the selected multilingual Whisper model');
assert(worker.includes('MAX_AUDIO_BYTES'), 'the public endpoint must impose a request-size bound');
assert(app.includes('createWebTranscriptionService'), 'the app must prefer the cross-browser web transcription adapter');
assert(app.includes("webSttIssue?.code === 'not-configured'"), 'unconfigured cloud STT must be explained without blaming microphone permission');
assert(packager.includes("'web-stt.js'"), 'the web package must ship the browser transcription adapter');

for (const page of ['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
  assert(read(page).includes('web-stt.js'), `${page} must load the browser transcription adapter`);
}

console.log('Web STT fallback and deployment contract tests passed.');
