const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../functions/api/transcribe.js'), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const worker = await import(moduleUrl);
  let invocation = null;
  const context = {
    env: {
      WEB_STT_ENABLED: 'true',
      AI: {
        async run(model, input) {
          invocation = { model, input };
          return { text: '  测试字幕  ' };
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
  assert.deepEqual(await response.json(), { text: '测试字幕' });
  assert.equal(invocation.model, '@cf/openai/whisper');
  assert.deepEqual(invocation.input, { audio: [0, 17, 128, 255], language: 'zh' });

  const unavailable = await worker.onRequestGet({ env: {} });
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).code, 'not-configured');

  console.log('Web STT function: raw-byte Whisper input and configuration gate passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
