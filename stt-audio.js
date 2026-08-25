(function attachSTTAudio(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CreatorSTTAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function resampleTo16k(input, inputSampleRate) {
    const source = input instanceof Float32Array ? input : Float32Array.from(input || []);
    const sourceRate = Number(inputSampleRate) || 16000;
    const targetRate = 16000;
    if (!source.length) return new Float32Array();
    if (sourceRate === targetRate) return Float32Array.from(source);

    const outputLength = Math.max(1, Math.round(source.length * targetRate / sourceRate));
    const output = new Float32Array(outputLength);
    const ratio = sourceRate / targetRate;

    if (sourceRate > targetRate) {
      for (let i = 0; i < outputLength; i += 1) {
        const start = Math.floor(i * ratio);
        const end = Math.min(source.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
        let sum = 0;
        for (let j = start; j < end; j += 1) sum += source[j];
        output[i] = sum / (end - start);
      }
      return output;
    }

    for (let i = 0; i < outputLength; i += 1) {
      const position = i * ratio;
      const left = Math.floor(position);
      const right = Math.min(source.length - 1, left + 1);
      const mix = position - left;
      output[i] = source[left] * (1 - mix) + source[right] * mix;
    }
    return output;
  }

  function createSerialAudioQueue(handler, hooks = {}) {
    let tail = Promise.resolve();
    let closed = false;
    const state = {
      queued: 0,
      processed: 0,
      failed: 0,
      maxQueueDepth: 0,
      totalProcessMs: 0
    };
    const snapshot = () => ({
      ...state,
      averageProcessMs: state.processed ? Math.round(state.totalProcessMs / state.processed) : 0
    });

    return {
      enqueue(samples) {
        if (closed) return tail;
        state.queued += 1;
        state.maxQueueDepth = Math.max(state.maxQueueDepth, state.queued);
        hooks.onStatus?.(snapshot());
        const run = async () => {
          const started = Date.now();
          try {
            const result = await handler(samples);
            state.processed += 1;
            state.totalProcessMs += Date.now() - started;
            if (result) hooks.onResult?.(result);
          } catch (error) {
            state.failed += 1;
            hooks.onError?.(error);
          } finally {
            state.queued -= 1;
            hooks.onStatus?.(snapshot());
          }
        };
        tail = tail.then(run, run);
        return tail;
      },
      async drain() { await tail; },
      close() { closed = true; },
      getStatus: snapshot
    };
  }

  return { resampleTo16k, createSerialAudioQueue };
});
