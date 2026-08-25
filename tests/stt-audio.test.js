const assert = require('assert');
const { resampleTo16k, createSerialAudioQueue } = require('../stt-audio');

const source48k = new Float32Array(4800).fill(0.5);
const downsampled = resampleTo16k(source48k, 48000);
assert.strictEqual(downsampled.length, 1600, '48 kHz audio should become 16 kHz');
assert(Math.abs(downsampled[800] - 0.5) < 0.0001, 'resampling should preserve a constant signal');

const source16k = Float32Array.from([0.1, -0.2, 0.3]);
const identity = resampleTo16k(source16k, 16000);
assert.deepStrictEqual([...identity], [...source16k], '16 kHz audio should be copied without distortion');

(async () => {
  const order = [];
  const queue = createSerialAudioQueue(async value => {
    await new Promise(resolve => setTimeout(resolve, value === 1 ? 10 : 1));
    order.push(value);
    return value;
  });
  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  queue.close();
  await queue.drain();
  assert.deepStrictEqual(order, [1, 2, 3], 'audio frames must never overtake or disappear');
  const status = queue.getStatus();
  assert.strictEqual(status.processed, 3);
  assert.strictEqual(status.failed, 0);
  assert.strictEqual(status.queued, 0);
  assert.strictEqual(status.maxQueueDepth, 3);
  console.log('STT audio pipeline contract tests passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
