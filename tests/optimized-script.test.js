const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const workerSource = fs.readFileSync(path.join(__dirname, '../functions/api/optimize-script.js'), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`;
  const worker = await import(moduleUrl);
  let invocation = null;
  const context = {
    env: {
      WEB_STT_ENABLED: 'true',
      AI: {
        async run(model, input) {
          invocation = { model, input };
          return { response: '观众为什么要关注你？因为你能把复杂问题讲清楚。' };
        }
      }
    },
    request: new Request('https://read-yourself.test/api/optimize-script', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '嗯，然后我觉得，观众关注你，是因为你能讲清楚复杂问题。' })
    })
  };

  const response = await worker.onRequestPost(context);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { script: '观众为什么要关注你？因为你能把复杂问题讲清楚。' });
  assert.equal(invocation.model, '@cf/qwen/qwen3-30b-a3b-fp8');
  assert.equal(invocation.input.temperature, 0.3);
  assert.match(invocation.input.messages[0].content, /绝不编造/);
  assert.match(invocation.input.messages[1].content, /复杂问题/);

  const empty = await worker.onRequestPost({
    env: context.env,
    request: new Request('https://read-yourself.test/api/optimize-script', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '   ' })
    })
  });
  assert.equal(empty.status, 400);

  const html = fs.readFileSync(path.join(__dirname, '../v1-camera-baseline.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  assert(html.includes('data-show-script'), 'live and pasted transcript actions must expose script generation');
  assert(html.includes('data-optimized-script'), 'the report dialog must include the optimized-script workspace');
  assert(app.includes("fetch('/api/optimize-script'"), 'the browser must call the same-origin optimization endpoint');
  assert(app.includes("analysis?.quality?.status === 'unreliable'"), 'unreliable transcripts must be stopped before optimization');

  console.log('Optimized script API, safety prompt and V1 UI contract tests passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
