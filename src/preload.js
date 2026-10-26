/**
 * Meridian Connect Preload Script
 * Exposes safe, typed bridge APIs to the renderer.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meridian', {
  // Auth
  isDevMode: () => ipcRenderer.invoke('auth:is-dev'),
  getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),
  devLogin: () => ipcRenderer.invoke('auth:dev-login'),
  login: (username, password, remember) => ipcRenderer.invoke('auth:login', { username, password, remember }),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // Settings & System
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (newSettings) => ipcRenderer.invoke('settings:save', newSettings),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  showNotification: (opts) => ipcRenderer.invoke('app:show-notification', opts),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // Multi-Monitor Layout
  getUserLayout: (userId) => ipcRenderer.invoke('layout:get-user-layout', userId),
  popoutPanel: (panelId) => ipcRenderer.invoke('layout:popout-panel', panelId),
  dockPanel: (panelId) => ipcRenderer.invoke('layout:dock-panel', panelId),
  onPanelDocked: (callback) => {
    const handler = (event, panelId) => callback(panelId);
    ipcRenderer.on('layout:panel-docked', handler);
    return () => ipcRenderer.removeListener('layout:panel-docked', handler);
  },
  onPanelPoppedOut: (callback) => {
    const handler = (event, panelId) => callback(panelId);
    ipcRenderer.on('layout:panel-popped-out', handler);
    return () => ipcRenderer.removeListener('layout:panel-popped-out', handler);
  },
  onDataSync: (callback) => {
    const handler = (event, payload) => callback(payload);
    ipcRenderer.on('sync:data-changed', handler);
    return () => ipcRenderer.removeListener('sync:data-changed', handler);
  },
  notifyDataChanged: (type, payload) => ipcRenderer.send('sync:broadcast', { type, payload }),

  // Auto-update
  updateStatus: () => ipcRenderer.invoke('update:status'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  onUpdateReady: (callback) => {
    const handler = (event, info) => callback(info);
    ipcRenderer.on('update:ready', handler);
    return () => ipcRenderer.removeListener('update:ready', handler);
  },

  // API Stub Methods
  api: {
    getMe: (username) => ipcRenderer.invoke('api:get-me', username),
    ping: () => ipcRenderer.invoke('api:ping'),
    changePassword: (current, next) => ipcRenderer.invoke('api:change-password', { current, next }),
    ws: (method, endpoint, body) => ipcRenderer.invoke('ws:request', { method, endpoint, body }),
    studio: (method, endpoint, body) => ipcRenderer.invoke('studio:request', { method, endpoint, body }),
    studioSaveFile: (projectId, name, content) => ipcRenderer.invoke('studio:save-project-file', { projectId, name, content }),
    wsUpload: (projectId, section) => ipcRenderer.invoke('ws:upload', { projectId, section }),
    wsCreateProjectPdf: (projectId, title, content) => ipcRenderer.invoke('ws:create-project-pdf', { projectId, title, content }),
    // A file dropped onto the chat: its bytes go to the main process (no file path crosses over)
    wsUploadDroppedChatFile: async (convo, file, caption) => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return await ipcRenderer.invoke('ws:upload-dropped-chat-file', { convo, name: file.name, bytes, caption });
      } catch (_) {
        return { success: false, error: 'Could not read the dropped file.' };
      }
    },
    wsDownload: (projectId, name, section) => ipcRenderer.invoke('ws:download', { projectId, name, section }),
    wsUploadChatMedia: (convo, caption) => ipcRenderer.invoke('ws:upload-chat-media', { convo, caption }),
    wsDownloadChatMedia: (mediaId, name) => ipcRenderer.invoke('ws:download-chat-media', { mediaId, name }),
    getChatMediaUrl: (mediaId) => ipcRenderer.invoke('ws:chat-media-url', { mediaId }),
    wsPreview: (url, title) => ipcRenderer.invoke('ws:preview', { url, title }),
    wsImage: (endpoint) => ipcRenderer.invoke('ws:image', { endpoint }),
    wsUploadImage: (endpoint) => ipcRenderer.invoke('ws:upload-image', { endpoint }),
    wsExportPdf: (html, name) => ipcRenderer.invoke('ws:export-pdf', { html, name }),
    wsCapture: (endpoint) => ipcRenderer.invoke('ws:capture', { endpoint }),
    voiceTranscribe: (bytes) => ipcRenderer.invoke('voice:transcribe', bytes),
    voiceSpeech: (text) => ipcRenderer.invoke('voice:speech', text),
    getProjects: (username) => ipcRenderer.invoke('api:get-projects', username),
    getProjectFiles: (projectId) => ipcRenderer.invoke('api:get-project-files', projectId),
    getProjectNotes: (projectId) => ipcRenderer.invoke('api:get-project-notes', projectId),
    getTasks: (username) => ipcRenderer.invoke('api:get-tasks', username),
    markTaskDone: (taskId, completed) => ipcRenderer.invoke('api:mark-task-done', { taskId, completed }),
    sendChatMessage: (projectId, message) => ipcRenderer.invoke('api:send-chat-message', { projectId, message }),
    // onChunk(text) gets each piece of the reply as it arrives; the promise still resolves with the whole reply
    streamChat: (projectId, message, onChunk) => {
      const streamId = typeof onChunk === 'function' ? Date.now() + '-' + Math.random().toString(36).slice(2) : null;
      const handler = (event, d) => { if (d && d.streamId === streamId) onChunk(d.text); };
      if (streamId) ipcRenderer.on('api:stream-chat-chunk', handler);
      return ipcRenderer.invoke('api:stream-chat', { projectId, message, streamId })
        .finally(() => { if (streamId) ipcRenderer.removeListener('api:stream-chat-chunk', handler); });
    },
    getChatHistory: (projectId) => ipcRenderer.invoke('api:get-chat-history', projectId),
    getMessages: () => ipcRenderer.invoke('api:get-messages'),
    sendTeamMessage: (text, senderName) => ipcRenderer.invoke('api:send-team-message', { text, senderName }),
    uploadToSendToMeridian: (payload, senderName) => ipcRenderer.invoke('api:upload-send-to-meridian', { payload, senderName }),
    getSentToMeridianList: () => ipcRenderer.invoke('api:get-sent-to-meridian-list'),
    searchAll: (query, username) => ipcRenderer.invoke('api:search-all', { query, username }),
    getTools: () => ipcRenderer.invoke('api:get-tools'),
    executeTool: (toolId, params) => ipcRenderer.invoke('api:execute-tool', { toolId, params })
  }
});
