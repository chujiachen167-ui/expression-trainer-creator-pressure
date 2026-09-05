(() => {
  const endpoint = '/api/transcribe';
  const chunkMs = 3000;

  class WebSTTError extends Error {
    constructor(message, code = 'web-stt-unavailable') {
      super(message);
      this.name = 'WebSTTError';
      this.code = code;
    }
  }

  function preferredMimeType() {
    if (!window.MediaRecorder) return '';
    return [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/webm',
      'audio/ogg;codecs=opus'
    ].find(type => MediaRecorder.isTypeSupported?.(type)) || '';
  }

  function languageCode(locale) {
    return String(locale || '').split('-')[0].toLowerCase() || 'zh';
  }

  function parseFailure(response, body) {
    const code = body?.code || `http-${response.status}`;
    const message = body?.message || '网页转写服务暂不可用。';
    return new WebSTTError(message, code);
  }

  async function requestJSON(url, options) {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store', ...options });
    } catch (_) {
      throw new WebSTTError('无法连接网页转写服务。请检查网络后重试。', 'network');
    }
    let body = null;
    try { body = await response.json(); } catch (_) { /* Non-JSON server failures are still handled below. */ }
    if (!response.ok) throw parseFailure(response, body);
    return body || {};
  }

  function isSupported() {
    return Boolean(window.MediaRecorder && window.fetch && window.navigator?.mediaDevices?.getUserMedia);
  }

  function create({ getStream, getLanguage, onResult, onStatus, onError } = {}) {
    let recorder = null;
    let running = false;
    let uploadChain = Promise.resolve();
    let pending = 0;
    let terminalError = null;

    const reportStatus = patch => onStatus?.({ engine: 'web-stt', ...patch });
    const reportError = error => {
      terminalError = error instanceof Error ? error : new WebSTTError(String(error || '网页转写服务暂不可用。'));
      reportStatus({ state: 'error', lastError: terminalError.code || terminalError.message });
      onError?.(terminalError);
    };

    async function probe() {
      if (!isSupported()) throw new WebSTTError('当前浏览器不支持网页音频分段转写。', 'unsupported');
      const status = await requestJSON(endpoint, { method: 'GET' });
      if (!status.available) throw new WebSTTError(status.message || '网页转写服务尚未启用。', status.code || 'not-configured');
      return status;
    }

    async function uploadChunk(blob) {
      if (!blob?.size || terminalError) return;
      pending += 1;
      reportStatus({ state: 'running', queued: pending, lastError: '' });
      try {
        const result = await requestJSON(`${endpoint}?lang=${encodeURIComponent(languageCode(getLanguage?.()))}`, {
          method: 'POST',
          headers: { 'content-type': blob.type || 'application/octet-stream' },
          body: blob
        });
        const text = String(result.text || '').trim();
        if (text) onResult?.(text, true);
      } catch (error) {
        reportError(error);
      } finally {
        pending = Math.max(0, pending - 1);
        if (!terminalError) reportStatus({ state: running ? 'running' : 'stopped', queued: pending, lastError: '' });
      }
    }

    function enqueue(blob) {
      uploadChain = uploadChain.then(() => uploadChunk(blob));
      return uploadChain;
    }

    return {
      async probe() { return probe(); },
      async start() {
        if (running) return;
        const stream = getStream?.();
        if (!stream?.getAudioTracks?.().some(track => track.readyState === 'live')) {
          throw new WebSTTError('麦克风尚未就绪，无法开始网页转写。', 'microphone-unavailable');
        }
        terminalError = null;
        const mimeType = preferredMimeType();
        try {
          recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        } catch (_) {
          throw new WebSTTError('当前浏览器无法把麦克风编码为可转写的音频。', 'media-recorder');
        }
        recorder.ondataavailable = event => { if (event.data?.size) enqueue(event.data); };
        recorder.onerror = () => reportError(new WebSTTError('网页音频采集意外中断。', 'media-recorder'));
        recorder.onstop = () => { running = false; };
        recorder.start(chunkMs);
        running = true;
        reportStatus({ state: 'running', starts: 1, queued: 0, lastError: '' });
      },
      async stop() {
        let stopped = Promise.resolve();
        if (recorder && recorder.state !== 'inactive') {
          stopped = new Promise(resolve => {
            recorder.addEventListener('stop', resolve, { once: true });
          });
          try { recorder.requestData(); } catch (_) { /* No final partial chunk is available. */ }
          recorder.stop();
        }
        running = false;
        await stopped;
        await uploadChain.catch(() => {});
        if (!terminalError) reportStatus({ state: 'stopped', queued: 0, lastError: '' });
        recorder = null;
      }
    };
  }

  window.CreatorWebSTT = { create, isSupported, WebSTTError };
})();
