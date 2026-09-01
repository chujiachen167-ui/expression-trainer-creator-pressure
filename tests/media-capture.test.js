const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { read } = require('./qa-dom-helper');

const html = read('v1-camera-baseline.html');
const main = read('main.js');
const preload = read('preload.js');
const app = read('app.js');

assert.match(html, /data-camera-device/, 'V1 exposes a camera selector');
assert.match(html, /data-microphone-device/, 'V1 exposes a microphone selector');
assert.match(html, /data-record-session/, 'recording is explicit opt-in');
assert.match(html, /data-recording-review/, 'V1 has a local review surface');
assert.match(main, /ipcMain\.handle\('save-recording'/, 'desktop runtime owns the video save dialog');
assert.match(preload, /saveRecording:/, 'recording save IPC is exposed through the isolated preload');
assert.match(app, /mediaController\?\.getAudioConstraints\(\)/, 'desktop STT uses the selected microphone constraints');

class FakeTrack {
  constructor(kind, deviceId) { this.kind = kind; this.deviceId = deviceId; this.stopped = false; }
  stop() { this.stopped = true; }
  getSettings() { return { deviceId: this.deviceId }; }
}

class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
}

(async () => {
  const dom = new JSDOM(html, { url: 'https://qa.invalid/v1-camera-baseline.html', runScripts: 'outside-only' });
  const { window } = dom;
  const requests = [];
  const deviceEvents = new window.EventTarget();
  const devices = [
    { kind: 'videoinput', deviceId: 'camera-built-in', label: 'Built-in Camera' },
    { kind: 'videoinput', deviceId: 'camera-usb', label: 'USB Creator Camera' },
    { kind: 'audioinput', deviceId: 'mic-built-in', label: 'Built-in Microphone' },
    { kind: 'audioinput', deviceId: 'mic-usb', label: 'USB Creator Microphone' }
  ];
  const mediaDevices = {
    async enumerateDevices() { return devices; },
    async getUserMedia(constraints) {
      requests.push(constraints);
      const tracks = [];
      if (constraints.video) {
        const id = constraints.video.deviceId?.exact || 'camera-built-in';
        tracks.push(new FakeTrack('video', id));
      }
      if (constraints.audio) {
        const id = constraints.audio.deviceId?.exact || 'mic-built-in';
        tracks.push(new FakeTrack('audio', id));
      }
      return new FakeStream(tracks);
    },
    addEventListener: (...args) => deviceEvents.addEventListener(...args),
    removeEventListener: (...args) => deviceEvents.removeEventListener(...args)
  };
  Object.defineProperty(window.navigator, 'mediaDevices', { value: mediaDevices, configurable: true });
  window.MediaStream = FakeStream;
  window.URL.createObjectURL = () => 'blob:practice-take';
  window.URL.revokeObjectURL = () => {};

  class FakeMediaRecorder extends window.EventTarget {
    static isTypeSupported(type) { return type.startsWith('video/webm'); }
    constructor(stream, options = {}) {
      super();
      this.stream = stream;
      this.mimeType = options.mimeType || 'video/webm';
      this.state = 'inactive';
    }
    start() { this.state = 'recording'; }
    stop() {
      const data = new window.Event('dataavailable');
      Object.defineProperty(data, 'data', { value: new window.Blob(['practice'], { type: this.mimeType }) });
      this.dispatchEvent(data);
      this.state = 'inactive';
      this.dispatchEvent(new window.Event('stop'));
    }
  }
  window.MediaRecorder = FakeMediaRecorder;
  window.eval(read('media-capture.js'));

  const controller = window.CreatorMediaCapture.create({
    video: window.document.querySelector('#cameraVideo'),
    videoTile: window.document.querySelector('.video-tile'),
    cameraButton: window.document.querySelector('[data-camera-toggle]')
  });
  await controller.refreshDevices({ requestPermission: true });
  const cameraSelect = window.document.querySelector('[data-camera-device]');
  const microphoneSelect = window.document.querySelector('[data-microphone-device]');
  assert.equal(cameraSelect.options.length, 2, 'all connected cameras are listed');
  assert.equal(microphoneSelect.options.length, 2, 'all connected microphones are listed');

  cameraSelect.value = 'camera-usb';
  cameraSelect.dispatchEvent(new window.Event('change'));
  microphoneSelect.value = 'mic-usb';
  microphoneSelect.dispatchEvent(new window.Event('change'));
  await controller.toggleCamera();
  assert.equal(requests.at(-1).video.deviceId.exact, 'camera-usb', 'selected external camera opens by deviceId');
  assert.equal(controller.getAudioConstraints().deviceId.exact, 'mic-usb', 'selected external microphone is shared with STT');

  const recordToggle = window.document.querySelector('[data-record-session]');
  recordToggle.checked = true;
  recordToggle.dispatchEvent(new window.Event('change'));
  await controller.startSessionRecording({ prompt: '测试选题' });
  controller.setSessionRunning(true);
  assert.equal(controller.isRecording(), true, 'opt-in session recording starts');
  assert.equal(cameraSelect.disabled, true, 'devices cannot switch during a recording session');
  const result = await controller.stopSessionRecording({ transcript: '这是一段练习。', prompt: '测试选题' });
  controller.setSessionRunning(false);
  assert.equal(result.blob.type.startsWith('video/webm'), true, 'recording produces a local WebM blob');
  assert.equal(window.document.querySelector('[data-recording-review]').hidden, false, 'completed take opens local review');
  assert.equal(window.document.querySelector('[data-recording-transcript]').textContent, '这是一段练习。', 'review keeps the matching transcript');
  assert.equal(requests.some(request => request.audio?.deviceId?.exact === 'mic-usb'), true, 'recording uses the selected microphone');

  controller.dispose();
  dom.window.close();
  console.log('Media capture: device enumeration, external camera/microphone selection, explicit recording, local review and desktop save contract passed (DOM/mocks).');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
