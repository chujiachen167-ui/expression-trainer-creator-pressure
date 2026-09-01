(() => {
  const tr = (key, fallback) => window.CreatorI18n?.t(key, {}, fallback) || fallback;
  const STORAGE_KEY = 'expression-trainer.media-preferences.v1';
  const MIME_TYPES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  function readPreferences(storage = window.localStorage) {
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
      return {
        cameraId: typeof value.cameraId === 'string' ? value.cameraId : '',
        microphoneId: typeof value.microphoneId === 'string' ? value.microphoneId : '',
        recordSession: value.recordSession === true
      };
    } catch (_) {
      return { cameraId: '', microphoneId: '', recordSession: false };
    }
  }

  function writePreferences(preferences, storage = window.localStorage) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch (_) { /* Private mode may block storage. */ }
  }

  function formatDuration(milliseconds) {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function safeFilename(date = new Date()) {
    const stamp = date.toISOString().replace(/[:.]/g, '-');
    return `read-yourself-practice-${stamp}.webm`;
  }

  function create({ video, videoTile, cameraButton } = {}) {
    const mediaDevices = navigator.mediaDevices;
    const cameraSelect = document.querySelector('[data-camera-device]');
    const microphoneSelect = document.querySelector('[data-microphone-device]');
    const refreshButton = document.querySelector('[data-media-refresh]');
    const recordToggle = document.querySelector('[data-record-session]');
    const deviceSummary = document.querySelector('[data-device-summary]');
    const status = document.querySelector('[data-media-status]');
    const badge = document.querySelector('[data-recording-badge]');
    const badgeTime = document.querySelector('[data-recording-time]');
    const review = document.querySelector('[data-recording-review]');
    const reviewVideo = document.querySelector('[data-recording-preview]');
    const reviewMeta = document.querySelector('[data-recording-meta]');
    const reviewTranscript = document.querySelector('[data-recording-transcript]');
    const saveButton = document.querySelector('[data-recording-save]');
    const discardButton = document.querySelector('[data-recording-discard]');
    const saveStatus = document.querySelector('[data-recording-save-status]');
    if (!video || !videoTile || !cameraButton || !cameraSelect || !microphoneSelect) return null;

    const preferences = readPreferences();
    let cameraStream = null;
    let recordingAudioStream = null;
    let recorder = null;
    let chunks = [];
    let recordingStartedAt = 0;
    let recordingTimer = null;
    let latestRecording = null;
    let currentDevices = [];
    let sessionRunning = false;

    recordToggle.checked = preferences.recordSession;

    function setStatus(message, kind = '') {
      if (!status) return;
      status.textContent = message;
      status.dataset.kind = kind;
    }

    function savePreferences() {
      preferences.cameraId = cameraSelect.value;
      preferences.microphoneId = microphoneSelect.value;
      preferences.recordSession = recordToggle.checked;
      writePreferences(preferences);
      updateSummary();
    }

    function selectedLabel(select, fallback) {
      const option = select.options[select.selectedIndex];
      return option?.textContent || fallback;
    }

    function updateSummary() {
      if (!deviceSummary) return;
      const camera = selectedLabel(cameraSelect, '系统默认摄像头').replace(/^摄像头：/, '');
      const microphone = selectedLabel(microphoneSelect, '系统默认麦克风').replace(/^麦克风：/, '');
      deviceSummary.textContent = `${camera} · ${microphone}${recordToggle.checked ? ' · 录制开启' : ''}`;
    }

    function renderDevices(select, kind, fallbackLabel, preferredId) {
      const devices = currentDevices.filter(device => device.kind === kind);
      const previous = preferredId || select.value;
      select.replaceChildren();
      if (!devices.length) {
        const option = new Option(fallbackLabel, '');
        select.appendChild(option);
        return;
      }
      devices.forEach((device, index) => {
        const generic = kind === 'videoinput' ? `摄像头 ${index + 1}` : `麦克风 ${index + 1}`;
        select.appendChild(new Option(device.label || generic, device.deviceId));
      });
      if (devices.some(device => device.deviceId === previous)) select.value = previous;
    }

    async function refreshDevices({ requestPermission = false } = {}) {
      if (!mediaDevices?.enumerateDevices) {
        setStatus('当前环境不能列出摄像头和麦克风。', 'error');
        return [];
      }
      let permissionStream = null;
      refreshButton.disabled = true;
      try {
        if (requestPermission) permissionStream = await mediaDevices.getUserMedia({ video: true, audio: true });
        currentDevices = await mediaDevices.enumerateDevices();
        renderDevices(cameraSelect, 'videoinput', '未检测到摄像头', preferences.cameraId);
        renderDevices(microphoneSelect, 'audioinput', '未检测到麦克风', preferences.microphoneId);
        savePreferences();
        const cameras = currentDevices.filter(device => device.kind === 'videoinput').length;
        const microphones = currentDevices.filter(device => device.kind === 'audioinput').length;
        setStatus(`检测到 ${cameras} 个摄像头、${microphones} 个麦克风。`, cameras ? 'ready' : 'warning');
        return currentDevices;
      } catch (error) {
        const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        setStatus(denied ? '没有获得设备权限。你仍可使用不需要摄像头的训练入口。' : `设备检测失败：${error.message}`, 'error');
        return [];
      } finally {
        permissionStream?.getTracks().forEach(track => track.stop());
        refreshButton.disabled = sessionRunning;
      }
    }

    function videoConstraints(useSelected = true) {
      const deviceId = useSelected ? cameraSelect.value : '';
      return {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      };
    }

    function getAudioConstraints() {
      const deviceId = microphoneSelect.value;
      return {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
    }

    function renderCameraState(active) {
      videoTile.classList.toggle('camera-on', active);
      cameraButton.classList.toggle('active', active);
      cameraButton.innerHTML = `<span class="control-indicator"></span>${tr(active ? 'common.closeCamera' : 'common.openCamera', active ? '关闭摄像头' : '开启摄像头')}`;
    }

    function closeCamera(force = false) {
      if (!force && isRecording()) {
        setStatus('正在录制，摄像头会在本轮结束后保持预览；请勿中途断开设备。', 'warning');
        return;
      }
      cameraStream?.getTracks().forEach(track => track.stop());
      cameraStream = null;
      video.srcObject = null;
      renderCameraState(false);
    }

    async function openCamera() {
      if (!mediaDevices?.getUserMedia) throw new Error('当前环境不支持摄像头。');
      closeCamera(true);
      try {
        cameraStream = await mediaDevices.getUserMedia({ video: videoConstraints(true), audio: false });
      } catch (error) {
        if (!cameraSelect.value || !['NotFoundError', 'OverconstrainedError'].includes(error?.name)) throw error;
        cameraSelect.value = '';
        savePreferences();
        cameraStream = await mediaDevices.getUserMedia({ video: videoConstraints(false), audio: false });
        setStatus('上次选择的摄像头不可用，已经改用系统默认设备。', 'warning');
      }
      video.srcObject = cameraStream;
      renderCameraState(true);
      await refreshDevices();
      return cameraStream;
    }

    async function toggleCamera() {
      if (cameraStream) {
        closeCamera(true);
        setStatus(sessionRunning ? '摄像头已关闭；语音训练仍在继续。' : '摄像头已关闭。', '');
        return null;
      }
      try {
        const active = await openCamera();
        setStatus(sessionRunning ? '摄像头已加入当前训练。' : '摄像头仅在当前页面预览。', 'ready');
        return active;
      } catch (error) {
        const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        setStatus(denied ? '摄像头权限被拒绝。请在系统或浏览器设置中允许后重试。' : `摄像头无法打开：${error.message}`, 'error');
        throw error;
      }
    }

    function selectMimeType() {
      if (typeof MediaRecorder === 'undefined') return '';
      return MIME_TYPES.find(type => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type)) || '';
    }

    function updateRecordingClock() {
      if (badgeTime) badgeTime.textContent = formatDuration(Date.now() - recordingStartedAt);
    }

    async function startSessionRecording({ prompt = '' } = {}) {
      if (!recordToggle.checked) return { recording: false };
      if (typeof MediaRecorder === 'undefined') throw new Error('当前环境不支持本地视频录制。');
      if (recorder && recorder.state !== 'inactive') throw new Error('已有一段录制正在进行。');
      if (!cameraStream) await openCamera();
      recordingAudioStream = await mediaDevices.getUserMedia({ audio: getAudioConstraints(), video: false });
      const recordingStream = new MediaStream([
        ...cameraStream.getVideoTracks(),
        ...recordingAudioStream.getAudioTracks()
      ]);
      const mimeType = selectMimeType();
      recorder = new MediaRecorder(recordingStream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 4_000_000,
        audioBitsPerSecond: 128_000
      });
      chunks = [];
      recorder.addEventListener('dataavailable', event => { if (event.data?.size) chunks.push(event.data); });
      recorder.addEventListener('error', event => setStatus(`录制中断：${event.error?.message || '未知错误'}`, 'error'));
      recorder.start(1000);
      recordingStartedAt = Date.now();
      latestRecording = { prompt, startedAt: recordingStartedAt };
      badge.hidden = false;
      updateRecordingClock();
      recordingTimer = setInterval(updateRecordingClock, 250);
      setStatus('正在本机录制。停止训练后可以回看并选择保存。', 'recording');
      return { recording: true };
    }

    async function stopSessionRecording({ transcript = '', prompt = '' } = {}) {
      if (!recorder || recorder.state === 'inactive') return null;
      const activeRecorder = recorder;
      const duration = Date.now() - recordingStartedAt;
      return new Promise(resolve => {
        activeRecorder.addEventListener('stop', () => {
          clearInterval(recordingTimer);
          recordingTimer = null;
          badge.hidden = true;
          recordingAudioStream?.getTracks().forEach(track => track.stop());
          recordingAudioStream = null;
          const mimeType = activeRecorder.mimeType || chunks[0]?.type || 'video/webm';
          const blob = new Blob(chunks, { type: mimeType });
          chunks = [];
          if (latestRecording?.url) URL.revokeObjectURL(latestRecording.url);
          const url = URL.createObjectURL(blob);
          latestRecording = {
            ...latestRecording,
            blob,
            url,
            filename: safeFilename(new Date(latestRecording?.startedAt || Date.now())),
            duration,
            transcript,
            prompt
          };
          reviewVideo.src = url;
          review.hidden = false;
          reviewMeta.textContent = `${formatDuration(duration)} · ${Math.max(1, Math.round(blob.size / 1024 / 1024))} MB · 尚未保存到磁盘`;
          reviewTranscript.textContent = transcript.trim() || '本轮没有可用逐字稿。';
          saveStatus.textContent = '刷新或关闭页面前请先保存；项目不会自动上传或保存录像。';
          saveStatus.dataset.kind = 'warning';
          setStatus('本轮录制已完成，等待你回看或保存。', 'ready');
          recorder = null;
          resolve(latestRecording);
        }, { once: true });
        activeRecorder.stop();
      });
    }

    async function saveLatestRecording() {
      if (!latestRecording?.blob) return;
      saveButton.disabled = true;
      saveStatus.textContent = '正在准备视频文件…';
      try {
        if (window.api?.saveRecording) {
          const bytes = new Uint8Array(await latestRecording.blob.arrayBuffer());
          const result = await window.api.saveRecording(bytes, latestRecording.filename, latestRecording.blob.type);
          if (!result?.success) {
            if (result?.canceled) saveStatus.textContent = '你取消了保存，录像仍保留在当前页面。';
            else throw new Error(result?.error || '保存失败');
            return;
          }
          saveStatus.textContent = `已保存到：${result.path}`;
        } else {
          const anchor = document.createElement('a');
          anchor.href = latestRecording.url;
          anchor.download = latestRecording.filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          saveStatus.textContent = '浏览器已开始下载。请在下载记录中确认文件已经保存。';
        }
        saveStatus.dataset.kind = 'ready';
      } catch (error) {
        saveStatus.textContent = `视频没有保存成功：${error.message}`;
        saveStatus.dataset.kind = 'error';
      } finally {
        saveButton.disabled = false;
      }
    }

    function discardLatestRecording() {
      if (latestRecording?.url) URL.revokeObjectURL(latestRecording.url);
      latestRecording = null;
      reviewVideo.removeAttribute('src');
      reviewVideo.load?.();
      review.hidden = true;
      setStatus('本轮录像已从当前页面移除。', '');
    }

    function setSessionRunning(value) {
      sessionRunning = Boolean(value);
      cameraSelect.disabled = sessionRunning;
      microphoneSelect.disabled = sessionRunning;
      refreshButton.disabled = sessionRunning;
      recordToggle.disabled = sessionRunning;
      cameraButton.disabled = sessionRunning && isRecording();
      document.querySelector('[data-media-panel]')?.toggleAttribute('data-session-running', sessionRunning);
    }

    function isRecordingEnabled() { return recordToggle.checked; }
    function isRecording() { return Boolean(recorder && recorder.state !== 'inactive'); }

    refreshButton.addEventListener('click', () => refreshDevices({ requestPermission: true }));
    cameraSelect.addEventListener('change', async () => {
      savePreferences();
      if (!cameraStream || sessionRunning) return;
      try { await openCamera(); } catch (error) { setStatus(`切换摄像头失败：${error.message}`, 'error'); }
    });
    microphoneSelect.addEventListener('change', savePreferences);
    recordToggle.addEventListener('change', savePreferences);
    saveButton.addEventListener('click', saveLatestRecording);
    discardButton.addEventListener('click', discardLatestRecording);

    const handleDeviceChange = async () => {
      const activeId = cameraStream?.getVideoTracks?.()[0]?.getSettings?.().deviceId;
      await refreshDevices();
      if (activeId && !currentDevices.some(device => device.kind === 'videoinput' && device.deviceId === activeId)) {
        closeCamera(true);
        setStatus('正在使用的摄像头已断开，请选择其他设备。', 'warning');
      }
    };
    const handleLocaleChange = () => renderCameraState(Boolean(cameraStream));
    mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    document.addEventListener('creator:locale-change', handleLocaleChange);

    refreshDevices();
    updateSummary();

    return {
      toggleCamera,
      closeCamera,
      getAudioConstraints,
      isRecordingEnabled,
      isRecording,
      startSessionRecording,
      stopSessionRecording,
      setSessionRunning,
      refreshDevices,
      dispose() {
        if (isRecording()) recorder.stop();
        closeCamera(true);
        recordingAudioStream?.getTracks().forEach(track => track.stop());
        if (latestRecording?.url) URL.revokeObjectURL(latestRecording.url);
        mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
        document.removeEventListener('creator:locale-change', handleLocaleChange);
      }
    };
  }

  window.CreatorMediaCapture = { create, readPreferences, writePreferences, formatDuration, safeFilename };
})();
