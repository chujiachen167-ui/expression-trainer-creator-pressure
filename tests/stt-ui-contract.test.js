const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const controls = fs.readFileSync(path.join(root, 'v1-controls.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const v1 = fs.readFileSync(path.join(root, 'v1-camera-baseline.html'), 'utf8');

assert(controls.includes('data-language="mixed"'), 'mixed Chinese/English mode should exist');
assert(controls.includes('data-language="en"'), 'English mode should exist');
assert(!controls.includes('data-language="zh"'), 'duplicate Chinese-only mode should be removed');
assert(controls.includes("saved.language === 'zh'"), 'old Chinese-mode settings should migrate to mixed mode');

const browserEndStart = app.indexOf('instance.onend = () => {', app.indexOf('function setupRecognition'));
const browserErrorStart = app.indexOf('instance.onerror = event => {', browserEndStart);
const browserEndHandler = app.slice(browserEndStart, browserErrorStart);
assert(!browserEndHandler.includes('instance.start('), 'browser recognition must not restart itself after onend');
assert(browserEndHandler.includes('不会自动重新申请麦克风权限'), 'unexpected browser end should explain the permission-safe behavior');

assert(app.includes('createSerialAudioQueue'), 'Electron recognition should preserve every audio frame in a serial queue');
assert(app.includes('resampleTo16k'), 'Electron recognition should normalize device audio to 16 kHz');
assert(app.includes('createScriptProcessor(2048'), 'local subtitle audio frames should target roughly 128 ms');
assert(v1.includes('stt-audio.js?v=0.2.1'), 'V1 should load the STT audio pipeline before app.js');

console.log('STT UI and lifecycle contract tests passed.');
