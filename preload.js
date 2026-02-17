const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  captureScreen: (rect) => ipcRenderer.invoke('capture', rect),
  onCaptureComplete: (callback) => ipcRenderer.on('capture-result', (event, data) => callback(data)),
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  sendPrompt: (prompt) => ipcRenderer.invoke('query-ollama', prompt),
  onResponse: (callback) => ipcRenderer.on('ai-response', (event, data) => callback(data)),
  onReady: (callback) => ipcRenderer.on('ready', () => callback()),
  fetchSetting: (setting) => ipcRenderer.invoke('fetch-setting', setting),
  fetchAvailableModels: () => ipcRenderer.invoke('fetch-models'),
  setSetting: (setting, value) => ipcRenderer.invoke('set-setting', setting, value),
  search: (query) => ipcRenderer.invoke('search', query),
  onSearchResults: (callback) => ipcRenderer.on('search-response', (event, data) => callback(data)),
  onSearchResultsDone: (callback) => ipcRenderer.on('search-response-done', (event, data) => callback(data)),
  getHistory: () => ipcRenderer.invoke('get-history'),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('delete-history-entry', id),
  pullModel: (model) => ipcRenderer.invoke('pull-model', model),
  onPullProgress: (callback) => ipcRenderer.on('model-pull-log', (event, data) => callback(data)),
  deleteModel: (model) => ipcRenderer.invoke('delete-model', model),
  askQuery: (fileId) => ipcRenderer.invoke('ask-query', fileId),
});
