(() => {
  const endpoint = '/api/transcribe';
  const fallbackChunkMs = 2200;
  const maxConsecutiveFailures = 3;
  const minimumPeakRms = 0.012;
  const minimumAverageRms = 0.0035;
  const voicedFrameRms = 0.006;
  const minimumVoicedFrameRatio = 0.12;
  const maxConsecutiveRejectedSegments = 3;

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
    const error = new WebSTTError(message, code);
    error.status = response.status;
    error.requestId = body?.requestId || response.headers.get('cf-ray') || '';
    return error;
  }

  function isTransient(error) {
    return ['network', 'transcription-failed', 'http-408', 'http-429', 'http-500', 'http-502', 'http-503', 'http-504']
      .includes(error?.code);
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
    let segmentTimer = null;
    let recordingStartedAt = 0;
    let chunkIndex = 0;
    let lastChunkEndedAt = 0;
    let consecutiveFailures = 0;
    let transientError = '';
    let chunkMs = fallbackChunkMs;
    let audioContext = null;
    let analyser = null;
    let energyTimer = null;
    let segmentPeakRms = 0;
    let segmentRmsTotal = 0;
    let segmentRmsSamples = 0;
    let segmentVoicedSamples = 0;
    let consecutiveRejectedSegments = 0;

    const reportStatus = patch => onStatus?.({ engine: 'web-stt', ...patch });
    const reportError = error => {
      terminalError = error instanceof Error ? error : new WebSTTError(String(error || '网页转写服务暂不可用。'));
      running = false;
      if (segmentTimer) clearTimeout(segmentTimer);
      segmentTimer = null;
      stopEnergyMonitor();
      if (recorder?.state !== 'inactive') {
        try { recorder.stop(); } catch (_) { /* The recorder may already be stopping. */ }
      }
      reportStatus({ state: 'error', lastError: terminalError.code || terminalError.message });
      onError?.(terminalError);
    };

    async function probe() {
      if (!isSupported()) throw new WebSTTError('当前浏览器不支持网页音频分段转写。', 'unsupported');
      const status = await requestJSON(endpoint, { method: 'GET' });
      if (!status.available) throw new WebSTTError(status.message || '网页转写服务尚未启用。', status.code || 'not-configured');
      if (Number.isFinite(status.chunkMs) && status.chunkMs >= 1500 && status.chunkMs <= 15000) chunkMs = status.chunkMs;
      return status;
    }

    function resetSegmentEnergy() {
      segmentPeakRms = 0;
      segmentRmsTotal = 0;
      segmentRmsSamples = 0;
      segmentVoicedSamples = 0;
    }

    async function startEnergyMonitor(stream) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      try {
        audioContext = new AudioContext();
        if (audioContext.state === 'suspended') await audioContext.resume();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        energyTimer = setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          let squareTotal = 0;
          for (const sample of samples) squareTotal += sample * sample;
          const rms = Math.sqrt(squareTotal / samples.length);
          segmentPeakRms = Math.max(segmentPeakRms, rms);
          segmentRmsTotal += rms;
          segmentRmsSamples += 1;
          if (rms >= voicedFrameRms) segmentVoicedSamples += 1;
        }, 100);
      } catch (_) {
        stopEnergyMonitor();
      }
    }

    function stopEnergyMonitor() {
      if (energyTimer) clearInterval(energyTimer);
      energyTimer = null;
      analyser?.disconnect?.();
      analyser = null;
      audioContext?.close?.().catch?.(() => {});
      audioContext = null;
      resetSegmentEnergy();
    }

    function segmentContainsSpeech() {
      if (!segmentRmsSamples) return true;
      const averageRms = segmentRmsTotal / segmentRmsSamples;
      const voicedRatio = segmentVoicedSamples / segmentRmsSamples;
      return segmentPeakRms >= minimumPeakRms
        && averageRms >= minimumAverageRms
        && voicedRatio >= minimumVoicedFrameRatio;
    }

    async function uploadChunk(blob, chunkMeta) {
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
        consecutiveFailures = 0;
        transientError = result.filtered && !text ? '已过滤低可信片段' : '';
        if (text) {
          consecutiveRejectedSegments = 0;
          onResult?.(text, true, {
            source: 'web-stt',
            resultId: `web-stt:${recordingStartedAt}:${chunkMeta.chunkIndex}`,
            audioStartedAt: chunkMeta.audioStartedAt,
            audioEndedAt: chunkMeta.audioEndedAt,
            arrivedAt: Date.now(),
            chunkIndex: chunkMeta.chunkIndex
          });
        } else if (result.filtered) {
          consecutiveRejectedSegments += 1;
          if (consecutiveRejectedSegments >= maxConsecutiveRejectedSegments) {
            reportError(new WebSTTError('连续检测到模型幻觉，已暂停云端转写。请降低环境噪声后重试。', 'hallucination-burst'));
          }
        }
      } catch (error) {
        if (running && isTransient(error) && consecutiveFailures < maxConsecutiveFailures - 1) {
          consecutiveFailures += 1;
          transientError = `${error.code || 'network'} · 自动恢复 ${consecutiveFailures}/${maxConsecutiveFailures}`;
          reportStatus({ state: 'running', queued: pending, lastError: transientError });
        } else {
          reportError(error);
        }
      } finally {
        pending = Math.max(0, pending - 1);
        if (!terminalError) reportStatus({ state: running ? 'running' : 'stopped', queued: pending, lastError: transientError });
      }
    }

    function enqueue(blob, chunkMeta) {
      uploadChain = uploadChain.then(() => uploadChunk(blob, chunkMeta));
      return uploadChain;
    }

    function startSegment(stream, mimeType) {
      if (!running || terminalError) return;
      const chunks = [];
      const audioStartedAt = lastChunkEndedAt || Date.now();
      resetSegmentEnergy();
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (_) {
        reportError(new WebSTTError('当前浏览器无法把麦克风编码为可转写的音频。', 'media-recorder'));
        return;
      }
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.onerror = () => reportError(new WebSTTError('网页音频采集意外中断。', 'media-recorder'));
      recorder.onstop = () => {
        if (segmentTimer) clearTimeout(segmentTimer);
        segmentTimer = null;
        const audioEndedAt = Date.now();
        lastChunkEndedAt = audioEndedAt;
        const containsSpeech = segmentContainsSpeech();
        const blob = new Blob(chunks, { type: recorder?.mimeType || mimeType || 'application/octet-stream' });
        recorder = null;
        const meta = { chunkIndex, audioStartedAt, audioEndedAt };
        chunkIndex += 1;
        if (blob.size && !terminalError && containsSpeech) enqueue(blob, meta);
        else if (blob.size && !terminalError) {
          transientError = '静音片段未上传';
          reportStatus({ state: running ? 'running' : 'stopped', queued: pending, lastError: transientError });
        }
        // Restarting the recorder makes every upload a complete, independently
        // decodable file. MediaRecorder timeslices can omit container headers.
        if (running && !terminalError) startSegment(stream, mimeType);
      };
      recorder.start();
      segmentTimer = setTimeout(() => {
        if (recorder?.state !== 'inactive') recorder.stop();
      }, chunkMs);
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
        consecutiveFailures = 0;
        transientError = '';
        recordingStartedAt = Date.now();
        lastChunkEndedAt = recordingStartedAt;
        chunkIndex = 0;
        const mimeType = preferredMimeType();
        running = true;
        await startEnergyMonitor(stream);
        startSegment(stream, mimeType);
        if (terminalError) throw terminalError;
        reportStatus({ state: 'running', starts: 1, queued: 0, lastError: '' });
      },
      async stop() {
        running = false;
        if (segmentTimer) clearTimeout(segmentTimer);
        segmentTimer = null;
        let stopped = Promise.resolve();
        if (recorder && recorder.state !== 'inactive') {
          stopped = new Promise(resolve => {
            recorder.addEventListener('stop', resolve, { once: true });
          });
          recorder.stop();
        }
        await stopped;
        stopEnergyMonitor();
        await uploadChain.catch(() => {});
        if (!terminalError) reportStatus({ state: 'stopped', queued: 0, lastError: '' });
        recorder = null;
      }
    };
  }

  window.CreatorWebSTT = { create, isSupported, WebSTTError };
})();
