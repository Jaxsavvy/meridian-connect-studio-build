'use strict';

const { contextBridge } = require('electron');

const evidenceMode = process.argv.find(argument => argument.startsWith('--studio-evidence-mode='))?.split('=')[1] || 'employee';
const developmentMode = evidenceMode === 'development';

const projects = [
  {
    id: 'synthetic-northstar',
    name: 'Northstar Product Launch — Extended Synthetic Project Name For Reflow Review',
    status: 'Development only',
    lead: 'Synthetic team',
    description: 'A local fixture for isolated Studio UI review.',
  },
  {
    id: 'synthetic-field-notes',
    name: 'Field Notes Campaign',
    status: 'Development only',
    lead: 'Synthetic team',
    description: 'A second accepted fixture for project-switch checks.',
  },
];

const empty = async () => ({ success: true, data: [] });
const api = {
  getMe: async () => ({ success: true, data: { id: 'synthetic-chair-2', username: 'tyler.synthetic', name: 'Tyler — Isolated Review', must_change: false } }),
  getProjects: async () => ({ success: true, data: projects }),
  getProjectFiles: empty,
  getProjectNotes: empty,
  getTasks: empty,
  getMessages: empty,
  getSentToMeridianList: empty,
  getTools: empty,
  searchAll: empty,
  ping: async () => ({ success: true, mode: 'synthetic' }),
  markTaskDone: async () => ({ success: true }),
  sendChatMessage: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  sendTeamMessage: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  uploadToSendToMeridian: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  executeTool: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  changePassword: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  streamChat: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  voiceSpeech: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  voiceTranscribe: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  ws: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  wsPreview: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  wsDownload: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  wsUpload: async () => ({ success: false, error: 'Unavailable in isolated evidence build.' }),
  wsDownloadChatMedia: async () => ({ success: false }),
  wsUploadChatFile: async () => ({ success: false }),
  wsUploadChatMedia: async () => ({ success: false }),
  getChatMediaUrl: () => '',
};

contextBridge.exposeInMainWorld('meridian', {
  api,
  isDevMode: async () => developmentMode,
  getCurrentUser: async () => ({ id: 'synthetic-chair-2', username: 'tyler.synthetic', displayName: 'Tyler — Isolated Review' }),
  getSettings: async () => ({ serverUrl: 'synthetic://isolated-review' }),
  getUserLayout: async () => ({ popouts: {} }),
  saveSettings: async () => ({ success: true }),
  login: async () => ({ success: false }),
  devLogin: async () => ({ success: false }),
  logout: async () => ({ success: true }),
  popoutPanel: async () => ({ success: false }),
  dockPanel: async () => ({ success: false }),
  openExternal: async () => ({ success: false }),
  notifyDataChanged: () => {},
  updateStatus: () => {},
  installUpdate: () => {},
  onDataSync: () => () => {},
  onPanelDocked: () => () => {},
  onPanelPoppedOut: () => () => {},
  onUpdateReady: () => () => {},
});
