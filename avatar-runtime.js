/** Shipped LiveTalking endpoint. Production uses this file; development QA drafts can override it.
 *  Keep provider `mock` until a public HTTPS GPU server exists. Local 127.0.0.1 only works
 *  from Electron or http://127.0.0.1 previews — not from https://read-yourself.com.
 */
window.CreatorAvatarRuntime = {
  provider: 'mock',
  serverUrl: 'http://127.0.0.1:8010',
  avatarId: '',
  iceServers: [{ urls: 'stun:stun.freeswitch.org:3478' }]
};
