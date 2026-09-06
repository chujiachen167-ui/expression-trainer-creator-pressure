const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const converter = fs.readFileSync(path.join(__dirname, '../functions/lib/opencc-t2s.js'), 'utf8')
    .replace('export function toSimplifiedChinese', 'function toSimplifiedChinese');
  const workerSource = fs.readFileSync(path.join(__dirname, '../functions/api/transcribe.js'), 'utf8')
    .replace("import { toSimplifiedChinese } from '../lib/opencc-t2s.js';", '');
  const source = `${converter}\n${workerSource}`;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const worker = await import(moduleUrl);
  let invocation = null;
  const context = {
    env: {
      WEB_STT_ENABLED: 'true',
      AI: {
        async run(model, input) {
          invocation = { model, input };
          return { text: '  我現在正在說中文，這是網頁轉寫測試。  ' };
        }
      }
    },
    request: new Request('https://read-yourself.test/api/transcribe?lang=zh', {
      method: 'POST',
      headers: { 'content-type': 'audio/webm;codecs=opus' },
      body: new Uint8Array([0, 17, 128, 255])
    })
  };

  const response = await worker.onRequestPost(context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    text: '我现在正在说中文，这是网页转写测试。',
    filtered: true,
    filters: ['simplified-chinese']
  });
  assert.equal(invocation.model, '@cf/openai/whisper-large-v3-turbo');
  assert.equal(invocation.input.audio, 'ABGA/w==');
  assert.equal(invocation.input.language, 'zh');
  assert.equal(invocation.input.task, 'transcribe');
  assert.equal(invocation.input.vad_filter, true);
  assert.equal(invocation.input.condition_on_previous_text, false);
  assert.match(invocation.input.initial_prompt, /简体中文/);

  let retryAttempts = 0;
  const retryContext = {
    request: new Request('https://read-yourself.test/api/transcribe?lang=zh', {
      method: 'POST',
      headers: { 'content-type': 'audio/webm;codecs=opus' },
      body: new Uint8Array([0, 17, 128, 255])
    }),
    env: {
      WEB_STT_ENABLED: 'true',
      AI: {
        async run() {
          retryAttempts += 1;
          if (retryAttempts < 3) throw new Error('temporary out of capacity');
          return { text: '恢复成功' };
        }
      }
    }
  };
  const retryResponse = await worker.onRequestPost(retryContext);
  assert.equal(retryResponse.status, 200);
  assert.deepEqual(await retryResponse.json(), { text: '恢复成功', filtered: false, filters: [] });
  assert.equal(retryAttempts, 3, 'transient Workers AI failures should be retried twice');

  const loopContext = {
    request: new Request('https://read-yourself.test/api/transcribe?lang=zh-CN', {
      method: 'POST',
      headers: { 'content-type': 'audio/webm' },
      body: new Uint8Array([1, 2, 3])
    }),
    env: {
      WEB_STT_ENABLED: 'true',
      AI: { async run() { return { text: `謝謝。건강。${'4-'.repeat(80)}` }; } }
    }
  };
  const loopResponse = await worker.onRequestPost(loopContext);
  assert.deepEqual(await loopResponse.json(), {
    text: '',
    filtered: true,
    filters: ['simplified-chinese', 'unexpected-script', 'repetition-loop']
  }, 'Traditional text, unexpected scripts and long repetition loops must not reach the UI');

  const unavailable = await worker.onRequestGet({ env: {} });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).code, 'not-configured');

  console.log('Web STT function: large-v3-turbo base64 input, Simplified Chinese normalization, hallucination filtering and retry passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
