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
assert(worker.includes("'@cf/openai/whisper-large-v3-turbo'"), 'the Pages Function must use the higher-accuracy multilingual Whisper model');
assert(worker.includes('condition_on_previous_text: false'), 'independent chunks must disable previous-text conditioning to prevent repetition loops');
assert(worker.includes('vad_filter: true'), 'the server must filter silent regions before transcription');
assert(worker.includes('toSimplifiedChinese'), 'Chinese web transcripts must be normalized to Simplified Chinese');
assert(worker.includes('function toAudioBase64'), 'the large-v3-turbo binding must receive base64-encoded audio');
assert(worker.includes('offset += 0x8000'), 'audio conversion must avoid one unbounded call-stack expansion');
assert(worker.includes('MAX_AUDIO_BYTES'), 'the public endpoint must impose a request-size bound');
assert(app.includes('const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition'), 'the app must detect native streaming recognition');
assert(app.indexOf('const Recognition = window.SpeechRecognition') < app.indexOf('if (!Recognition) return await webSTTPromise'), 'native streaming recognition must stay the primary web path');
assert(app.includes('switchToWebFallback'), 'cloud transcription must remain available as an automatic fallback');
assert(app.includes("webSttIssue?.code === 'not-configured'"), 'unconfigured cloud STT must be explained without blaming microphone permission');
assert(app.includes('error.requestId'), 'terminal web transcription failures must expose a Cloudflare trace id for diagnosis');
assert(packager.includes("'web-stt.js'"), 'the web package must ship the browser transcription adapter');
assert(client.includes('recorder.start();'), 'each upload segment must start as a standalone recording');
assert(!client.includes('recorder.start(chunkMs)'), 'MediaRecorder timeslices must not be uploaded as independent files');
assert(client.includes('maxConsecutiveFailures = 3'), 'one transient failed segment must not stop the whole training session');
assert(client.includes('fallbackChunkMs = 2200'), 'cloud fallback chunks must keep perceived latency near two seconds');
assert(client.includes('segmentContainsSpeech'), 'silent chunks must be rejected before upload');
assert(client.includes('minimumPeakRms'), 'the silence gate must use measured microphone energy');
assert(client.includes('minimumVoicedFrameRatio'), 'one noise spike must not be mistaken for sustained speech');
assert(client.includes('maxConsecutiveRejectedSegments = 3'), 'repeated model hallucinations must trip a circuit breaker');
assert(worker.includes('MAX_AI_ATTEMPTS = 3'), 'the server must retry transient Workers AI failures');
assert(worker.includes('中文字幕志愿者'), 'known subtitle-credit hallucinations must be removed');
assert(worker.includes('known-hallucination'), 'known Whisper training-caption phrases must drop the entire chunk');
assert(!worker.includes('initial_prompt:'), 'decoder guidance must not be echoed back into low-confidence transcripts');
assert(app.includes('noiseSuppression: true'), 'web microphone capture must request speech-oriented noise suppression');

for (const page of ['v1-camera-baseline.html', 'v2-ai-audience.html', 'v3-creator-studio.html']) {
  assert(read(page).includes('web-stt.js'), `${page} must load the browser transcription adapter`);
}

console.log('Web STT fallback and deployment contract tests passed.');
