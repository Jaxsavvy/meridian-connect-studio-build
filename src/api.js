/**
 * Meridian Connect API Client
 *
 * Communicates with Meridian Command (or mock server) via HTTP/REST.
 * Base URL is dynamically loaded from config/settings.json (defaults to http://127.0.0.1:5280).
 * If the server is unreachable or offline, returns graceful status indicators so the UI
 * can render the 'Cannot reach server' banner without throwing unhandled exceptions.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Active session token and user profile
let currentAuthToken = null;
let currentAuthUser = null;

// Local cache / fallbacks
let localChatHistory = {};

function readSettings() {   // shipped defaults, then this person's own settings (app-data folder) on top
  let data = {};
  for (const p of [path.join(__dirname, '..', 'config', 'settings.json'), process.env.MERIDIAN_CONNECT_SETTINGS]) {
    try { if (p && fs.existsSync(p)) data = Object.assign(data, JSON.parse(fs.readFileSync(p, 'utf8'))); } catch (e) {}
  }
  return data;
}

function getServerUrl() {
  const data = readSettings();
  return (data.serverUrl || 'http://127.0.0.1:7871/connect').replace(/\/+$/, '');
}

function getTimeoutMs() {
  const data = readSettings();
  return data.apiTimeoutMs || 8000;
}

/**
 * Robust HTTP request wrapper with timeout and connection error recovery.
 */
async function apiRequest(endpoint, options = {}) {
  const baseUrl = getServerUrl();
  const url = `${baseUrl}${endpoint}`;
  const headers = Object.assign({}, options.headers || {});

  if (currentAuthToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }

  if (!headers['Content-Type'] && !(options.body instanceof FormData) && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const timeoutMs = options.timeoutMs || getTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // 403 Forbidden
    if (resp.status === 403) {
      const errData = await resp.json().catch(() => ({}));
      return {
        success: false,
        status: 403,
        error: errData.error || 'Access Forbidden: Invalid or missing authorization token'
      };
    }

    // 404 Not Found
    if (resp.status === 404) {
      const errData = await resp.json().catch(() => ({}));
      return {
        success: false,
        status: 404,
        error: errData.error || `Endpoint not found: ${endpoint}`
      };
    }

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: false,
        status: resp.status,
        error: data.error || `Server returned HTTP ${resp.status}`
      };
    }

    return { success: true, ...data };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      success: false,
      offline: true,
      error: "Can't reach home base. Check that Tailscale is on, or Jax's computer may be off or asleep. Connect keeps trying.",
      detail: `${baseUrl} (${err.name === 'AbortError' ? 'Request timed out' : err.message})`
    };
  }
}

const api = {
  getServerUrl,

  setAuthToken(token, user) {
    currentAuthToken = token;
    currentAuthUser = user;
  },

  getAuthToken() {
    return currentAuthToken;
  },

  /**
   * Ping server health
   */
  async ping() {
    return apiRequest('/api/ping', { timeoutMs: 3000 });
  },

  /**
   * Login user with credentials
   */
  async login(username, password) {
    const cleanUser = (username || '').trim().toLowerCase();
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: cleanUser, password: password || '' })
    });

    if (res.success && res.token) {
      currentAuthToken = res.token;
      currentAuthUser = res.user;
      return { success: true, token: res.token, user: res.user };
    }

    return res;
  },

  /**
   * Logout user and revoke token
   */
  async logout() {
    const res = await apiRequest('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({})
    });
    currentAuthToken = null;
    currentAuthUser = null;
    return { success: true, ...res };
  },

  /**
   * Get current user profile (via /api/me)
   */
  async getMe(username) {
    const res = await apiRequest('/api/me');
    if (res.success && res.user) {
      currentAuthUser = res.user;
      return { success: true, data: res.user };
    }
    return res;
  },

  /**
   * Project workspace (2026-10-06): one guarded request helper for /api/projects/* and /api/tasks*
   */
  async wsRequest(method, endpoint, body) {
    if (typeof endpoint !== 'string' || !/^\/api\/(projects|tasks|chat-hub)(\/|$|\?)/.test(endpoint)) {
      return { success: false, error: 'Not allowed' };
    }
    return apiRequest(endpoint, {
      method: method === 'POST' ? 'POST' : 'GET',
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
      // storyboard frames and AI shot lists can take a couple of minutes on home base
      timeoutMs: /\/storyboards\/[0-9a-f]{32}\/assist$/.test(endpoint) ? 330000
        : /\/storyboards\/[0-9a-f]{32}\/(draft|panels\/[0-9a-f]{32}\/generate)$/.test(endpoint) ? 260000 : 20000
    });
  },

  /** Storyboard frame (or any project image) as a data: URL the page can show. */
  async wsImage(endpoint) {
    if (typeof endpoint !== 'string' || !/^\/api\/projects\/[0-9a-f]{32}\/storyboards\//.test(endpoint)) return { success: false, error: 'Not allowed' };
    const baseUrl = getServerUrl();
    try {
      const resp = await fetch(`${baseUrl}${endpoint}`, { headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '' } });
      if (!resp.ok) return { success: false, status: resp.status };
      const type = resp.headers.get('content-type') || 'image/png';
      const buf = Buffer.from(await resp.arrayBuffer());
      return { success: true, url: `data:${type};base64,${buf.toString('base64')}` };
    } catch (err) {
      return { success: false, offline: true, error: err.message };
    }
  },

  /** Voice: a short 16 kHz WAV recording -> text (home base's own speech-to-text). */
  async voiceTranscribe(bytes) {
    const baseUrl = getServerUrl();
    try {
      const resp = await fetch(`${baseUrl}/api/voice/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '', 'Content-Type': 'audio/wav' },
        body: Buffer.from(bytes)
      });
      const data = await resp.json().catch(() => ({}));
      return resp.ok ? { success: true, text: data.text || '' } : { success: false, error: data.error || `HTTP ${resp.status}` };
    } catch (err) {
      return { success: false, offline: true, error: "Can't reach home base for voice." };
    }
  },

  /** Voice: reply text -> spoken audio from home base (or none, then Connect uses the computer's own voice). */
  async voiceSpeech(text) {
    const baseUrl = getServerUrl();
    try {
      const resp = await fetch(`${baseUrl}/api/voice/speech`, {
        method: 'POST',
        headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text || '').slice(0, 2500) })
      });
      if (resp.status === 204) return { success: true, none: true };
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
      const buf = Buffer.from(await resp.arrayBuffer());
      return { success: true, audio: buf.toString('base64'), mime: resp.headers.get('content-type') || 'audio/wav' };
    } catch (err) {
      return { success: false, offline: true, error: err.message };
    }
  },

  /** "Show Meridian": upload a snapshot of the Connect window to a storyboard. */
  async uploadScreen(endpoint, bytes) {
    if (typeof endpoint !== 'string' || !/^\/api\/projects\/[0-9a-f]{32}\/storyboards\/[0-9a-f]{32}\/screen\/image\/upload$/.test(endpoint)) {
      return { success: false, error: 'Not allowed' };
    }
    const baseUrl = getServerUrl();
    try {
      const resp = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '', 'Content-Type': 'application/octet-stream' },
        body: bytes
      });
      const data = await resp.json().catch(() => ({}));
      return resp.ok ? { success: true, ...data } : { success: false, error: data.error || `HTTP ${resp.status}` };
    } catch (err) {
      return { success: false, offline: true, error: `Snapshot upload failed (${err.message})` };
    }
  },

  /** Upload one image file to a storyboard panel. */
  async uploadPanelImage(endpoint, filePath) {
    if (typeof endpoint !== 'string' || !/^\/api\/projects\/[0-9a-f]{32}\/storyboards\/[0-9a-f]{32}\/panels\/[0-9a-f]{32}\/image\/upload$/.test(endpoint)) {
      return { success: false, error: 'Not allowed' };
    }
    const baseUrl = getServerUrl();
    try {
      const resp = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '', 'Content-Type': 'application/octet-stream' },
        body: fs.readFileSync(filePath)
      });
      const data = await resp.json().catch(() => ({}));
      return resp.ok ? { success: true, ...data } : { success: false, error: data.error || `HTTP ${resp.status}` };
    } catch (err) {
      return { success: false, offline: true, error: `Upload failed (${err.message})` };
    }
  },

  async uploadProjectFile(projectId, filePath, section) {
    const baseUrl = getServerUrl();
    try {
      const bytes = fs.readFileSync(filePath);
      const name = encodeURIComponent(path.basename(filePath));
      const sec = encodeURIComponent(section || 'Files');
      const resp = await fetch(`${baseUrl}/api/projects/${projectId}/files/upload?name=${name}&section=${sec}`, {
        method: 'POST',
        headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '', 'Content-Type': 'application/octet-stream' },
        body: bytes
      });
      const data = await resp.json().catch(() => ({}));
      return resp.ok ? { success: true, ...data } : { success: false, error: data.error || `HTTP ${resp.status}` };
    } catch (err) {
      return { success: false, offline: true, error: `Upload failed (${err.message})` };
    }
  },

  async downloadProjectFile(projectId, name, section) {
    const baseUrl = getServerUrl();
    try {
      const resp = await fetch(`${baseUrl}/api/projects/${projectId}/files/download?name=${encodeURIComponent(name)}&section=${encodeURIComponent(section || 'Files')}`, {
        headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '' }
      });
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
      return { success: true, bytes: Buffer.from(await resp.arrayBuffer()) };
    } catch (err) {
      return { success: false, offline: true, error: `Download failed (${err.message})` };
    }
  },

  /** Chat media (2026-10-08): upload pictures, videos, and files to chat and vault */
  async uploadChatMedia(convo, filePath, caption = '') {
    const baseUrl = getServerUrl();
    try {
      if (!fs.existsSync(filePath)) return { success: false, error: 'File does not exist' };
      const bytes = fs.readFileSync(filePath);
      const name = encodeURIComponent(path.basename(filePath));
      const c = encodeURIComponent(convo);
      const cap = encodeURIComponent(caption || '');
      const resp = await fetch(`${baseUrl}/api/chat-hub/upload?c=${c}&name=${name}&caption=${cap}`, {
        method: 'POST',
        headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '', 'Content-Type': 'application/octet-stream' },
        body: bytes
      });
      const data = await resp.json().catch(() => ({}));
      return resp.ok && data.ok ? { success: true, ...data } : { success: false, error: data.error || `HTTP ${resp.status}` };
    } catch (err) {
      return { success: false, offline: true, error: `Upload failed (${err.message})` };
    }
  },

  async downloadChatMedia(mediaId) {
    const baseUrl = getServerUrl();
    try {
      const resp = await fetch(`${baseUrl}/api/chat-hub/media/${encodeURIComponent(mediaId)}`, {
        headers: { 'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : '' }
      });
      if (!resp.ok) return { success: false, error: `Download failed (HTTP ${resp.status})` };
      return { success: true, bytes: Buffer.from(await resp.arrayBuffer()) };
    } catch (err) {
      return { success: false, offline: true, error: `Download failed (${err.message})` };
    }
  },

  getChatMediaUrl(mediaId) {
    const baseUrl = getServerUrl();
    const token = currentAuthToken ? `?token=${encodeURIComponent(currentAuthToken)}` : '';
    return `${baseUrl}/api/chat-hub/media/${encodeURIComponent(mediaId)}${token}`;
  },

  /**
   * Change password (required after a temporary password)
   */
  async changePassword(current, next) {
    return apiRequest('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current: current || '', new: next || '' })
    });
  },

  /**
   * Get projects list
   */
  async getProjects(username) {
    const res = await apiRequest('/api/projects');
    if (res.success && res.projects) {
      return { success: true, data: res.projects };
    }
    return res;
  },

  /**
   * Get files linked to a specific project
   */
  async getProjectFiles(projectId) {
    const res = await apiRequest(`/api/projects/${projectId}/files`);
    if (res.success && res.files) {
      return { success: true, data: res.files };
    }
    return res;
  },

  /**
   * Get notes linked to a specific project
   */
  async getProjectNotes(projectId) {
    // 2026-10-06: sample notes removed; notes come from home base
    const res = await apiRequest(`/api/projects/${projectId}/notes`);
    if (res.success && res.notes) {
      return { success: true, data: res.notes };
    }
    return { success: true, data: [] };
  },

  /**
   * Get tasks list
   */
  async getTasks(username) {
    const qs = username ? `?assigned_to=${encodeURIComponent(username)}` : '';
    const res = await apiRequest(`/api/tasks${qs}`);
    if (res.success && res.tasks) {
      // Map server properties to renderer format
      const formatted = res.tasks.map(t => ({
        id: t.id,
        projectId: t.project_id || t.projectId,
        title: t.title,
        assignedTo: t.assigned_to || t.assignedTo,
        priority: t.priority,
        dueDate: t.due_date || t.dueDate,
        completed: Boolean(t.completed)
      }));
      return { success: true, data: formatted };
    }
    return res;
  },

  /**
   * Mark a task completed or uncompleted
   */
  async markTaskDone(taskId, completed) {
    const res = await apiRequest(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completed: Boolean(completed) })
    });
    if (res.success && res.task) {
      const t = res.task;
      return {
        success: true,
        data: {
          id: t.id,
          projectId: t.project_id || t.projectId,
          title: t.title,
          assignedTo: t.assigned_to || t.assignedTo,
          priority: t.priority,
          dueDate: t.due_date || t.dueDate,
          completed: Boolean(t.completed)
        }
      };
    }
    return res;
  },

  /**
   * Send chat message (standard)
   */
  async sendChatMessage(projectId, message) {
    if (!localChatHistory[projectId]) localChatHistory[projectId] = [];
    localChatHistory[projectId].push({ sender: 'User', text: message, time: 'Just now' });

    const res = await apiRequest('/api/chat/send', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, message: message })
    });

    if (res.success) {
      return { success: true, data: localChatHistory[projectId] };
    }
    return res;
  },

  /**
   * Stream chat message with real NDJSON parser
   */
  async streamChat(projectId, message, onChunk) {
    const baseUrl = getServerUrl();
    const url = `${baseUrl}/api/chat/send`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150000);   // Meridian can take a minute on hard questions
    const key = projectId || 'general';
    const history = (localChatHistory[key] || []).slice(-8);

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : ''
        },
        body: JSON.stringify({ project_id: projectId, message: message, history }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        return { success: false, status: resp.status, error: errData.error || `HTTP ${resp.status}` };
      }

      // Read streaming NDJSON response line by line
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete tail

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            try {
              const chunk = JSON.parse(trimmed);
              if (chunk.type === 'chunk' && chunk.text) {
                fullText += chunk.text;
                if (typeof onChunk === 'function') {
                  onChunk(chunk.text);
                }
              }
            } catch (e) {}
          }
        }
      }

      if (!localChatHistory[key]) localChatHistory[key] = [];
      localChatHistory[key].push({ role: 'user', content: message }, { role: 'assistant', content: fullText });
      return { success: true, text: fullText };
    } catch (err) {
      clearTimeout(timer);
      return {
        success: false,
        offline: true,
        error: `Cannot stream from server at ${baseUrl} (${err.message})`
      };
    }
  },

  /**
   * Get chat history for a project
   */
  async getChatHistory(projectId) {
    return { success: true, data: localChatHistory[projectId] || [] };
  },

  /**
   * Get team messages from Jax & team
   */
  async getMessages() {
    const res = await apiRequest('/api/messages');
    if (res.success && res.messages) {
      const formatted = res.messages.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        time: m.time,
        isJax: Boolean(m.is_jax || m.isJax)
      }));
      return { success: true, data: formatted };
    }
    return res;
  },

  /**
   * Send a team message
   */
  async sendTeamMessage(text, senderName) {
    const res = await apiRequest('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify({ text, sender: senderName || 'Team' })
    });
    if (res.success && res.message) {
      const m = res.message;
      return {
        success: true,
        data: {
          id: m.id,
          sender: m.sender,
          text: m.text,
          time: m.time,
          isJax: Boolean(m.is_jax || m.isJax)
        }
      };
    }
    return res;
  },

  /**
   * Upload file or link to send to Jax inbox (supports multipart/form-data)
   */
  async uploadToSendToMeridian(payload, senderName = 'Unknown') {
    const baseUrl = getServerUrl();
    const url = `${baseUrl}/api/send-to-meridian`;

    try {
      if (payload && payload.filePath && fs.existsSync(payload.filePath)) {
        // Multipart file upload
        const fileBytes = fs.readFileSync(payload.filePath);
        const fileName = path.basename(payload.filePath);
        const formData = new FormData();
        const blob = new Blob([fileBytes]);
        formData.append('file', blob, fileName);
        formData.append('sender', senderName);

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': currentAuthToken ? `Bearer ${currentAuthToken}` : ''
          },
          body: formData
        });
        const data = await resp.json();
        return { success: resp.ok, ...data };
      } else {
        // JSON payload for link or plain metadata
        const res = await apiRequest('/api/send-to-meridian', {
          method: 'POST',
          body: JSON.stringify({
            name: payload.name || payload.url || 'Dropped item',
            type: payload.type || 'link',
            size: payload.size || 'Link',
            sender: senderName
          })
        });
        return res;
      }
    } catch (err) {
      return {
        success: false,
        offline: true,
        error: "Can't reach home base. Check that Tailscale is on, or Jax's computer may be off or asleep. Connect keeps trying.",
        detail: `${baseUrl} (${err.message})`
      };
    }
  },

  /**
   * Get list of items sent to Jax inbox
   */
  async getSentToMeridianList() {
    const res = await apiRequest('/api/send-to-meridian/list');
    if (res.success && res.items) {
      return { success: true, data: res.items };
    }
    return res;
  },

  /**
   * Quick search across projects, tasks, messages, etc.
   */
  async searchAll(query, username) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return { success: true, data: [] };

    // Fetch live datasets
    const [projRes, taskRes, msgRes] = await Promise.all([
      this.getProjects(username),
      this.getTasks(username),
      this.getMessages()
    ]);

    const results = [];
    if (projRes.success && Array.isArray(projRes.data)) {
      projRes.data.forEach(p => {
        if ((p.name && p.name.toLowerCase().includes(q)) || (p.description && p.description.toLowerCase().includes(q))) {
          results.push({ type: 'Project', title: p.name, subtitle: `${p.status} · Lead: ${p.lead}`, id: p.id, panel: 'projects' });
        }
      });
    }

    if (taskRes.success && Array.isArray(taskRes.data)) {
      taskRes.data.forEach(t => {
        if ((t.title && t.title.toLowerCase().includes(q)) || (t.assignedTo && t.assignedTo.toLowerCase().includes(q))) {
          results.push({ type: 'Task', title: t.title, subtitle: `Assigned: ${t.assignedTo} · Priority: ${t.priority}`, id: t.id, panel: 'tasks' });
        }
      });
    }

    if (msgRes.success && Array.isArray(msgRes.data)) {
      msgRes.data.forEach(m => {
        if (m.text && m.text.toLowerCase().includes(q)) {
          results.push({ type: 'Message', title: `${m.sender}: ${m.text.substring(0, 50)}`, subtitle: m.time, id: m.id, panel: 'messages' });
        }
      });
    }

    return { success: true, data: results.slice(0, 15) };
  },

  /**
   * Get host tools catalog & capability status
   */
  async getTools() {
    const res = await apiRequest('/api/tools');
    if (res.success && res.tools) {
      return { success: true, data: res.tools, hostInfo: res.host_info };
    }
    return res;
  },

  /**
   * Execute a tool remotely on Jax's host PC
   */
  async executeTool(toolId, params = {}) {
    const res = await apiRequest('/api/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ tool_id: toolId, params })
    });
    if (res.success && res.result) {
      return { success: true, data: res.result };
    }
    return res;
  }
};

module.exports = api;
