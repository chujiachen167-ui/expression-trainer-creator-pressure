const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getRuntimeStatus: () => ipcRenderer.invoke('get-runtime-status'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: settings => ipcRenderer.invoke('save-settings', settings),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  openPromptEditor: () => ipcRenderer.invoke('open-prompt-editor'),
  openClassicMode: () => ipcRenderer.invoke('open-classic-mode'),
  getCustomPrompt: () => ipcRenderer.invoke('get-custom-prompt'),
  saveCustomPrompt: data => ipcRenderer.invoke('save-custom-prompt', data),
  closeWindow: () => ipcRenderer.invoke('close-current-window'),
  initASR: () => ipcRenderer.invoke('init-asr'),
  feedAudio: samples => ipcRenderer.invoke('feed-audio', Array.from(samples)),
  stopASR: () => ipcRenderer.invoke('stop-asr'),
  analyzeText: text => ipcRenderer.invoke('analyze-text', text),
  getRealtimeFeedback: text => ipcRenderer.invoke('get-realtime-feedback', text),
  getFinalReport: data => ipcRenderer.invoke('get-final-report', data),
  testLLMConnection: settings => ipcRenderer.invoke('test-llm-connection', settings),
  saveFile: (content, filename) => ipcRenderer.invoke('save-file', content, filename),
  saveProjectConfig: content => ipcRenderer.invoke('save-project-config', content),
  saveProjectBackup: content => ipcRenderer.invoke('save-project-backup', content),
  onSettingsUpdated: callback => {
    const listener = () => callback();
    ipcRenderer.on('settings-updated', listener);
    return () => ipcRenderer.removeListener('settings-updated', listener);
  },
  onCustomPromptUpdated: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('custom-prompt-updated', listener);
    return () => ipcRenderer.removeListener('custom-prompt-updated', listener);
  }
});
