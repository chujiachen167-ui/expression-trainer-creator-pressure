const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makePage } = require('./qa-dom-helper');

const development = makePage('v2-ai-audience.html', {
  extraScripts: ['avatar-runtime.js', 'avatar-provider.js']
});
development.window.localStorage.setItem('expression-trainer.avatar-provider.v1', JSON.stringify({
  provider: 'live',
  serverUrl: 'http://127.0.0.1:8010',
  avatarId: 'wav2lip256_avatar1'
}));
assert.equal(development.window.CreatorAvatarProvider.loadConfig().provider, 'live');
assert.equal(development.window.CreatorAvatarProvider.loadConfig().avatarId, 'wav2lip256_avatar1');
development.window.close();

const production = makePage('v2-ai-audience.html', {
  production: true,
  extraScripts: ['avatar-runtime.js', 'avatar-provider.js']
});
production.window.localStorage.setItem('expression-trainer.avatar-provider.v1', JSON.stringify({
  provider: 'live',
  serverUrl: 'http://127.0.0.1:8010',
  avatarId: 'should-not-ship'
}));
assert.equal(production.window.CreatorAvatarProvider.loadConfig().provider, 'mock', 'production must use shipped avatar runtime, not a leftover live draft');
assert.equal(production.window.CreatorAvatarProvider.loadConfig().avatarId, '');
assert.match(production.window.CreatorAvatarProvider.describeError('https-page-cannot-reach-http-livetalking'), /https/);
production.window.close();

const liveShipped = makePage('v2-ai-audience.html', {
  production: true,
  extraScripts: ['avatar-provider.js']
});
liveShipped.window.CreatorAvatarRuntime = {
  provider: 'live',
  serverUrl: 'https://avatar.example.test',
  avatarId: 'wav2lip256_avatar1'
};
assert.equal(liveShipped.window.CreatorAvatarProvider.loadConfig().provider, 'live');
assert.equal(liveShipped.window.CreatorAvatarProvider.loadConfig().serverUrl, 'https://avatar.example.test');
liveShipped.window.close();

const mock = makePage('v2-ai-audience.html', { extraScripts: ['avatar-runtime.js', 'avatar-provider.js'] });
const appSource = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const v2Html = fs.readFileSync(path.join(__dirname, '../v2-ai-audience.html'), 'utf8');
assert.doesNotMatch(appSource, /avatarProvider\?\.speak/, 'B mode must never trigger TTS while the creator is speaking');
assert.doesNotMatch(appSource, /试听反应/, 'B reaction preview must describe a visual preview, not audio playback');
assert.match(v2Html, /不播放语音，也不会打断你的表达/, 'V2 must state the silent-observer boundary');
const provider = mock.window.CreatorAvatarProvider.create({ provider: 'mock' });
provider.connect([]).then(result => {
  assert.equal(result.mode, 'demo');
  mock.window.close();
  console.log('Avatar provider: production ignores live drafts, shipped runtime can enable LiveTalking, mock still constructs.');
}).catch(error => { console.error(error); process.exitCode = 1; });
