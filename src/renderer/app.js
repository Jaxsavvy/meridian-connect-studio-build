'use strict';

let currentUser = null;
let currentMe = null;
let currentProject = null;
let projects = [];
let clientSettings = null;
let idleTimer = null;
let activeView = 'overview';
const poppedViews = new Set();

const viewHeadings = {
  'overview': { eyebrow: 'Remote intelligence workspace · Employee Client', title: 'Meridian / Connect' },
  'projects': { eyebrow: 'WORKSPACE // PROJECTS', title: 'Projects & <em>Workspace.</em>' },
  'studio': { eyebrow: 'STUDIO // COMMAND WORKBENCH', title: 'Meridian / <em>Studio.</em>' },
  'tasks': { eyebrow: 'WORKSPACE // TASKS', title: 'My Tasks & <em>Queue.</em>' },
  'messages': { eyebrow: 'WORKSPACE // MESSAGES', title: 'Team Messages with <em>Jax.</em>' },
  'send': { eyebrow: 'WORKSPACE // INBOX', title: 'Send to <em>Meridian.</em>' },
  'tools': { eyebrow: 'MERIDIAN HOST // DOORWAY', title: 'Tools & <em>Services.</em>' },
  'chat': { eyebrow: 'WORKSPACE // PROJECT AI', title: 'Meridian AI <em>Chat.</em>' }
};

document.addEventListener('DOMContentLoaded', async () => {
  initAuthUI();
  setupNavigation();
  initBokehField();
  initSkyOrb();
  setupClock();

  // Check dev mode
  const isDev = await window.meridian.isDevMode();
  if (isDev) {
    const devBox = document.getElementById('dev-bypass-box');
    if (devBox) devBox.style.display = 'block';
  }
  await configureStudioGate(isDev);

  // Check saved session
  const existingUser = await window.meridian.getCurrentUser();
  if (existingUser) {
    enterApp(existingUser);
  } else {
    showLogin();
  }
});

/* ==========================================================================
   1. AUTHENTICATION & LOGIN UI
   ========================================================================== */
function initAuthUI() {
  const loginForm = document.getElementById('login-form');
  const devBypassBtn = document.getElementById('btn-dev-bypass');
  const signoutBtn = document.getElementById('btn-signout');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('login-remember').checked;
    const errorEl = document.getElementById('login-error');

    errorEl.style.display = 'none';
    const res = await window.meridian.login(username, password, remember);
    if (res.success && res.user) {
      enterApp(res.user);
    } else {
      errorEl.textContent = res.error || 'Authentication failed';
      errorEl.style.display = 'block';
    }
  });

  if (devBypassBtn) {
    devBypassBtn.addEventListener('click', async () => {
      const res = await window.meridian.devLogin();
      if (res.success && res.user) {
        enterApp(res.user);
      }
    });
  }

  if (signoutBtn) {
    signoutBtn.addEventListener('click', async () => {
      const completeSignout = async () => {
        await window.meridian.logout();
        showLogin();
      };
      if (!window.MeridianStudioUI || window.MeridianStudioUI.guardLeave(completeSignout, 'sign out')) {
        await completeSignout();
      }
    });
  }
}

function setStudioGatePresentation(enabled) {
  const nav = document.getElementById('nav-studio-link');
  const badge = document.getElementById('nav-studio-status');
  const host = document.getElementById('studioCenter');
  if (nav) {
    nav.disabled = !enabled;
    nav.setAttribute('aria-disabled', String(!enabled));
    nav.dataset.availability = enabled ? 'development-only' : 'unavailable';
    nav.title = enabled ? 'Open synthetic development-only Studio' : 'Studio is being rebuilt — coming soon';
  }
  if (badge) badge.textContent = enabled ? 'Dev' : 'Soon';
  if (host) {
    host.hidden = true;
    host.dataset.mode = enabled ? 'synthetic-development' : 'employee-unavailable';
  }
}

// Studio is being rebuilt under docs/PLAN.md (Wave 1). It stays closed until the
// new Studio frame lands; initStudioUI() below is the mount point it will use.
async function configureStudioGate() {
  setStudioGatePresentation(false);
  return false;
}

function initStudioUI() {
  const host = document.getElementById('studioCenter');
  if (!host || !window.MeridianStudioUI) return;
  window.MeridianStudioUI.mount({
    host,
    context: window.meridianStudioContext,
    getProjects: () => projects,
    onProjectSelect: projectId => selectProject(projectId),
  });
}

function showLogin() {
  currentUser = null;
  currentMe = null;
  currentProject = null;
  projects = [];
  window.meridianStudioContext.reset();
  if (window.meridianWorkspace) window.meridianWorkspace.clear();
  clearProjectCards('Sign in to load projects.');
  if (idleTimer) clearInterval(idleTimer);
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('login-password').value = '';
}

async function enterApp(user) {
  currentUser = user;
  document.getElementById('login-view').style.display = 'none';

  // Load authoritative profile & permissions
  const meRes = await window.meridian.api.getMe(user.username);
  if (!meRes || !meRes.success || !meRes.data) {   // 2026-10-06: a saved sign-in must still be valid at home base
    await window.meridian.logout();
    showLogin();
    const errorEl = document.getElementById('login-error');
    if (errorEl) { errorEl.textContent = (meRes && meRes.offline) ? 'Cannot reach home base. Check that Meridian is running, then sign in.' : 'Please sign in.'; errorEl.style.display = 'block'; }
    return;
  }
  if (meRes.data.must_change) {   // temporary password: choose a new one before using Connect
    showChangePassword(user, meRes.data);
    return;
  }
  currentMe = Object.assign({}, user, meRes.data, { displayName: meRes.data.name || user.displayName });

  // Update profile in sidebar & header
  const initial = currentMe.displayName ? currentMe.displayName.charAt(0).toUpperCase() : 'U';
  const avatarBadge = document.getElementById('user-avatar-badge');
  if (avatarBadge) avatarBadge.textContent = initial;

  const nameLabel = document.getElementById('user-name-label');
  if (nameLabel) nameLabel.textContent = currentMe.displayName || user.username;

  const greetEl = document.getElementById('greet');
  if (greetEl) {
    const h = new Date().getHours();
    greetEl.textContent = (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + `, ${currentMe.displayName || user.username}.`;
  }

  // Load server settings
  clientSettings = await window.meridian.getSettings();
  if (clientSettings && clientSettings.serverUrl) {
    const cleanUrl = clientSettings.serverUrl.replace(/^https?:\/\//, '');
    const topUrlEl = document.getElementById('top-server-url');
    if (topUrlEl) topUrlEl.textContent = cleanUrl;
  }

  // Restore popouts from layout
  const layout = await window.meridian.getUserLayout(currentMe.id || currentMe.username);
  if (layout && layout.popouts) {
    for (const [panelId, info] of Object.entries(layout.popouts)) {
      if (info && info.isOpen) {
        poppedViews.add(panelId);
      }
    }
  }

  // Switch to default view
  switchView('overview');

  // Load panel data
  await loadAllPanelData();

  setupQuickSearch();
  setupSettingsUI();
  setupChatHandlers();
  setupIdleWatcher();
  setupPopoutListeners();
}

/* ==========================================================================
   2. VIEW NAVIGATION & SPACE SWITCHING
   ========================================================================== */
function setupNavigation() {
  document.querySelectorAll('[data-view], [data-nav]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const viewKey = e.currentTarget.dataset.view || e.currentTarget.dataset.nav;
      if (viewKey) switchView(viewKey);
    });
  });

  const jumpMap = {
    'tile-jump-projects': 'projects',
    'openProjectsLink': 'projects',
    'heroProjects': 'projects',
    'tile-jump-tasks': 'tasks',
    'openTasksLink': 'tasks',
    'heroTasks': 'tasks',
    'tile-jump-messages': 'messages',
    'openMessagesLink': 'messages',
    'tile-jump-send': 'send',
    'openSendLink': 'send',
    'openFilesLink': 'projects',
    'brand-home-btn': 'overview'
  };

  for (const [id, targetView] of Object.entries(jumpMap)) {
    const el = document.getElementById(id);
    if (el) el.onclick = () => switchView(targetView);
  }

  const heroTalk = document.getElementById('heroTalk');
  if (heroTalk) heroTalk.onclick = () => switchView('chat');

  // Top Pop-Out button: pops out the active view
  const popoutBtn = document.getElementById('btn-popout-active');
  if (popoutBtn) {
    popoutBtn.onclick = async () => {
      await window.meridian.popoutPanel(activeView);
      poppedViews.add(activeView);
      updatePoppedState();
    };
  }

  // Dock back button on popped notice
  const dockBackBtn = document.getElementById('btn-dock-current');
  if (dockBackBtn) {
    dockBackBtn.onclick = async () => {
      await window.meridian.dockPanel(activeView);
      poppedViews.delete(activeView);
      updatePoppedState();
    };
  }

  // Dock close button
  const dockCloseBtn = document.getElementById('dockCloseBtn');
  const chatDock = document.getElementById('chatDock');
  if (dockCloseBtn && chatDock) {
    dockCloseBtn.onclick = () => {
      const isHidden = chatDock.style.display === 'none';
      chatDock.style.display = isHidden ? 'flex' : 'none';
    };
  }
}

function switchView(viewKey, options = {}) {
  const studioNav = document.getElementById('nav-studio-link');
  if (viewKey === 'studio' && (!window.MeridianStudioUI || !studioNav || studioNav.disabled)) return;
  if (!options.skipStudioGuard && activeView === 'studio' && viewKey !== 'studio' &&
      window.MeridianStudioUI &&
      !window.MeridianStudioUI.guardLeave(() => switchView(viewKey, { skipStudioGuard: true }), 'leave Studio')) {
    return;
  }
  activeView = viewKey;
  document.body.classList.toggle('view-chat', viewKey === 'chat');   // floating orb/logo only on Meridian AI
  document.body.classList.toggle('view-studio', viewKey === 'studio');

  // Update navigation buttons
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewKey);
  });

  // Update header text
  const headInfo = viewHeadings[viewKey] || { eyebrow: 'WORKSPACE // CLIENT', title: 'Meridian / Connect' };
  const eyebrowEl = document.getElementById('deck-eyebrow');
  const titleEl = document.getElementById('deck-title');
  if (eyebrowEl) eyebrowEl.textContent = headInfo.eyebrow;
  if (titleEl) titleEl.innerHTML = headInfo.title;

  // Show/Hide main sections
  const msgsEl = document.getElementById('msgs');
  const tasksEl = document.getElementById('tasksCenter');
  const projectsEl = document.getElementById('projectsCenter');
  const messagesEl = document.getElementById('teamMessagesCenter');
  const sendEl = document.getElementById('sendCenter');
  const toolsEl = document.getElementById('toolsCenter');
  const studioEl = document.getElementById('studioCenter');
  const chatDock = document.getElementById('chatDock');

  if (msgsEl) msgsEl.style.display = (viewKey === 'overview') ? 'block' : 'none';
  if (tasksEl) tasksEl.style.display = (viewKey === 'tasks') ? 'flex' : 'none';
  if (projectsEl) projectsEl.style.display = (viewKey === 'projects') ? 'flex' : 'none';
  if (messagesEl) messagesEl.style.display = (viewKey === 'messages') ? 'flex' : 'none';
  if (sendEl) sendEl.style.display = (viewKey === 'send') ? 'flex' : 'none';
  if (toolsEl) toolsEl.style.display = (viewKey === 'tools') ? 'flex' : 'none';
  if (studioEl) studioEl.hidden = viewKey !== 'studio';
  if (window.MeridianStudioUI) window.MeridianStudioUI.setActive(viewKey === 'studio');

  if (chatDock) {
    if (viewKey === 'chat') {
      chatDock.style.display = 'flex';
      const textEl = document.getElementById('text');
      if (textEl) textEl.focus();
    } else {
      chatDock.style.display = 'flex';
    }
  }

  updatePoppedState();
}

function updatePoppedState() {
  const isPopped = poppedViews.has(activeView);
  const poppedNotice = document.getElementById('view-popped-notice');
  const poppedTitleEl = document.getElementById('popped-view-title');

  if (poppedNotice) {
    if (isPopped) {
      poppedNotice.style.display = 'flex';
      if (poppedTitleEl) {
        poppedTitleEl.textContent = `${activeView.toUpperCase()} Popped Out`;
      }
    } else {
      poppedNotice.style.display = 'none';
    }
  }
}

/* ==========================================================================
   3. DATA FETCHING & POPULATION (PORT 5280 MOCK SERVER)
   ========================================================================== */
async function loadAllPanelData() {
  await Promise.all([
    loadProjects(),
    loadTasks(),
    loadTeamMessages(),
    loadSendQueue(),
    loadTools()
  ]);
}

// 1. Projects & Files
function clearProjectCards(message) {
  for (const id of ['nav-projects-count', 'overview-projects-stat', 'overview-projects-count']) {
    const count = document.getElementById(id);
    if (count) count.textContent = '0';
  }
  const badge = document.getElementById('projCountBadge');
  if (badge) badge.textContent = '0 Projects';
  for (const id of ['dashboardProjectsList', 'projectsMasterList', 'dashboardFilesList',
    'projectFilesList', 'projectNotesList']) {
    const list = document.getElementById(id);
    if (list) list.textContent = message;
  }
  for (const id of ['activeProjectScopeTitle', 'dockProjectName']) {
    const label = document.getElementById(id);
    if (label) label.textContent = 'No project selected';
  }
}

async function loadProjects() {
  const studio = window.meridianStudioContext;
  const listRequest = studio.beginProjectList();
  const res = await window.meridian.api.getProjects(currentMe ? currentMe.username : '');
  if (!res || !res.success) {
    if (studio.rejectProjectList(listRequest)) {
      projects = [];
      currentProject = null;
      clearProjectCards('Projects could not be loaded.');
    }
    return;
  }
  if (!studio.acceptProjects(res.data, listRequest)) {
    if (studio.rejectProjectList(listRequest)) {
      projects = [];
      currentProject = null;
      clearProjectCards('Projects could not be loaded.');
    }
    return;
  }
  projects = res.data || [];
  if (projects.length === 0) {
    currentProject = null;
    clearProjectCards('No projects assigned.');
    return;
  }

  const navCount = document.getElementById('nav-projects-count');
  if (navCount) navCount.textContent = projects.length;
  const overviewStat = document.getElementById('overview-projects-stat');
  if (overviewStat) overviewStat.textContent = projects.length;
  const overviewBadge = document.getElementById('overview-projects-count');
  if (overviewBadge) overviewBadge.textContent = projects.length;
  const projBadge = document.getElementById('projCountBadge');
  if (projBadge) projBadge.textContent = `${projects.length} Projects`;

  // Overview Deck List
  const overviewList = document.getElementById('dashboardProjectsList');
  if (overviewList) {
    overviewList.innerHTML = projects.slice(0, 3).map(p => `
      <div class="tile-row">
        <b>${escapeHtml(p.name)}</b>
        <small>${escapeHtml(p.status)} · Lead: ${escapeHtml(p.lead)}</small>
      </div>
    `).join('');
  }

  // Projects Space Master List
  const masterList = document.getElementById('projectsMasterList');
  if (masterList) {
    masterList.innerHTML = '';
    projects.forEach((proj, idx) => {
      const item = document.createElement('div');
      item.className = 'project-item' + (idx === 0 ? ' active' : '');
      item.dataset.id = proj.id;
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <b style="color: #fff; font-size: 13px;">${escapeHtml(proj.name)}</b>
          <span class="card-badge">${escapeHtml(proj.status)}</span>
        </div>
        <div style="font-size: 11.5px; color: var(--ash); line-height: 1.4;">${escapeHtml(proj.description)}</div>
      `;
      item.addEventListener('click', () => selectProject(proj.id));
      masterList.appendChild(item);
    });
  }

  if (projects.length > 0) {
    selectProject(projects[0].id);
  }

  // Tabs for Files & Notes in Projects space
  const tabBtnFiles = document.getElementById('tabBtnFiles');
  const tabBtnNotes = document.getElementById('tabBtnNotes');
  const filesList = document.getElementById('projectFilesList');
  const notesList = document.getElementById('projectNotesList');

  if (tabBtnFiles && tabBtnNotes && filesList && notesList) {
    tabBtnFiles.onclick = () => {
      tabBtnFiles.style.color = 'var(--ion)';
      tabBtnNotes.style.color = 'inherit';
      filesList.style.display = 'flex';
      notesList.style.display = 'none';
    };
    tabBtnNotes.onclick = () => {
      tabBtnNotes.style.color = 'var(--ion)';
      tabBtnFiles.style.color = 'inherit';
      notesList.style.display = 'flex';
      filesList.style.display = 'none';
    };
  }
}

async function selectProject(projectId, options = {}) {
  const nextProject = projects.find(p => p.id === projectId);
  if (!nextProject) return;
  if (!options.skipStudioGuard && currentProject && currentProject.id !== projectId &&
      window.MeridianStudioUI &&
      !window.MeridianStudioUI.guardLeave(() => selectProject(projectId, { skipStudioGuard: true }), 'switch projects')) {
    return;
  }
  const studio = window.meridianStudioContext;
  if (!studio.selectProject(projectId)) return;
  currentProject = nextProject;
  const projectRequest = studio.beginProjectRequest();

  document.querySelectorAll('#projectsMasterList .project-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === projectId);
  });

  const scopeTitle = document.getElementById('activeProjectScopeTitle');
  if (scopeTitle) scopeTitle.textContent = `${currentProject.name} Scope`;

  const dockTitle = document.getElementById('dockProjectName');
  if (dockTitle) dockTitle.textContent = currentProject.name;

  // Load project files
  const filesRes = await window.meridian.api.getProjectFiles(projectId);
  if (!studio.isCurrentRequest(projectRequest)) return;
  const files = (filesRes && filesRes.data) ? filesRes.data : [];
  const filesList = document.getElementById('projectFilesList');
  if (filesList) {
    filesList.innerHTML = files.map(f => `
      <div class="tile-row">
        <b>📄 ${escapeHtml(f.name)}</b>
        <small>${escapeHtml(f.type)} · ${escapeHtml(f.size)} · Updated ${escapeHtml(f.updated)}</small>
      </div>
    `).join('');
  }

  // Overview Files list
  const overviewFiles = document.getElementById('dashboardFilesList');
  if (overviewFiles) {
    overviewFiles.innerHTML = files.slice(0, 3).map(f => `
      <div class="tile-row">
        <b>📄 ${escapeHtml(f.name)}</b>
        <small>${escapeHtml(f.size)} · Scoped</small>
      </div>
    `).join('');
  }

  // Load project notes
  const notesRes = await window.meridian.api.getProjectNotes(projectId);
  if (!studio.isCurrentRequest(projectRequest)) return;
  const notes = (notesRes && notesRes.data) ? notesRes.data : [];
  const notesList = document.getElementById('projectNotesList');
  if (notesList) {
    notesList.innerHTML = notes.map(n => `
      <div style="padding: 10px 12px; border-radius: 8px; background: #0b1424; border: 1px solid var(--line);">
        <b style="color: #fff; font-size: 12.5px;">${escapeHtml(n.title)}</b>
        <p style="font-size: 11.5px; color: var(--ash-light); margin: 4px 0 6px; line-height: 1.45;">${escapeHtml(n.content)}</p>
        <small style="color: var(--ash); font-size: 10px;">By ${escapeHtml(n.author)} · ${escapeHtml(n.date)}</small>
      </div>
    `).join('');
  }
}

// 2. Tasks
async function loadTasks() {
  const username = currentMe ? currentMe.username : '';
  const res = await window.meridian.api.getTasks(username);
  if (!res || !res.success) return;
  const tasks = res.data || [];

  const pending = tasks.filter(t => !t.completed).length;
  const navCount = document.getElementById('nav-tasks-count');
  if (navCount) navCount.textContent = pending;
  const overviewStat = document.getElementById('overview-tasks-stat');
  if (overviewStat) overviewStat.textContent = pending;
  const overviewBadge = document.getElementById('overview-tasks-count');
  if (overviewBadge) overviewBadge.textContent = pending;

  // Counts in dedicated tasks space
  const tkAssigned = document.getElementById('tkAssignedCount');
  if (tkAssigned) tkAssigned.textContent = pending;
  const tkProgress = document.getElementById('tkProgressCount');
  if (tkProgress) tkProgress.textContent = tasks.filter(t => t.priority === 'high' && !t.completed).length || 1;
  const tkDone = document.getElementById('tkDoneCount');
  if (tkDone) tkDone.textContent = tasks.filter(t => t.completed).length;
  const tkHigh = document.getElementById('tkHighPriorityCount');
  if (tkHigh) tkHigh.textContent = tasks.filter(t => t.priority === 'high').length;

  // Overview list preview
  const overviewTasks = document.getElementById('dashboardTasksList');
  if (overviewTasks) {
    overviewTasks.innerHTML = tasks.slice(0, 3).map(t => `
      <div class="tile-row">
        <b>${t.completed ? '✓ ' : '○ '}${escapeHtml(t.title)}</b>
        <small>${escapeHtml(t.priority).toUpperCase()} · Due ${escapeHtml(t.dueDate)}</small>
      </div>
    `).join('');
  }

  // Tasks Space list
  const container = document.getElementById('tkTasksContainer');
  if (container) {
    container.innerHTML = `
      <div class="tk-person" style="grid-column: 1/-1;">
        <div class="tk-ph">
          <div class="tk-av">${(currentMe && currentMe.displayName) ? currentMe.displayName.charAt(0).toUpperCase() : 'U'}</div>
          <div class="tk-pmeta">
            <span class="tk-pname">${(currentMe && currentMe.displayName) ? currentMe.displayName : 'Assigned Employee'}</span>
            <span class="tk-pcount">${pending} tasks remaining</span>
          </div>
        </div>
        <div class="tk-bar">
          <span style="width: ${tasks.length ? Math.round(((tasks.length - pending) / tasks.length) * 100) : 0}%;"></span>
        </div>
        <div class="task-rows-wrap" style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
          ${tasks.map(t => `
            <div class="tk-task" data-id="${t.id}" style="${t.completed ? 'opacity: 0.55;' : ''}">
              <input type="checkbox" class="task-chk" ${t.completed ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--ion);">
              <b style="color: ${t.completed ? 'var(--ash)' : '#fff'}; ${t.completed ? 'text-decoration: line-through;' : ''}">${escapeHtml(t.title)}</b>
              <span class="tk-pill ${t.completed ? 'finished' : 'in_progress'}">${t.completed ? 'FINISHED' : t.priority.toUpperCase()}</span>
              <span style="font-size: 11px; color: var(--ash);">Due ${escapeHtml(t.dueDate)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.task-chk').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const row = e.target.closest('.tk-task');
        const taskId = row.dataset.id;
        const completed = e.target.checked;
        await window.meridian.api.markTaskDone(taskId, completed);
        window.meridian.notifyDataChanged('task-updated', { taskId, completed });
        loadTasks();
      });
    });
  }
}

// 3. Team Messages
async function loadTeamMessages() {
  const res = await window.meridian.api.getMessages();
  const messages = (res && res.data) ? res.data : [];

  // Overview preview
  const overviewList = document.getElementById('dashboardMessagesList');
  if (overviewList) {
    overviewList.innerHTML = messages.slice(-3).map(m => `
      <div class="tile-row">
        <b>${m.isJax ? '⚡ Jax' : 'You'}: ${escapeHtml(m.text)}</b>
        <small>${escapeHtml(m.time)}</small>
      </div>
    `).join('');
  }

  // Full Messages Space
  const stream = document.getElementById('teamMessagesFullStream');
  if (stream) {
    stream.innerHTML = messages.map(m => `
      <div class="msg-item ${m.isJax ? 'jax' : 'mine'}">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <b style="color: ${m.isJax ? 'var(--ion)' : 'var(--flux)'}; font-size: 11.5px;">${escapeHtml(m.sender)}</b>
          <small style="color: var(--ash); font-size: 10px;">${escapeHtml(m.time)}</small>
        </div>
        <div style="font-size: 13px; line-height: 1.45; color: #fff;">${escapeHtml(m.text)}</div>
      </div>
    `).join('');
    stream.scrollTop = stream.scrollHeight;
  }

  const form = document.getElementById('teamMessageFullForm');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('teamMessageFullInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      const senderName = currentMe ? currentMe.displayName : 'Team Member';
      const sendRes = await window.meridian.api.sendTeamMessage(text, senderName);
      if (sendRes && sendRes.success) {
        loadTeamMessages();
        window.meridian.notifyDataChanged('message-sent', sendRes.data);
      }
    };
  }
}

// 4. Send to Meridian
async function loadSendQueue() {
  const res = await window.meridian.api.getSentToMeridianList();
  const items = (res && res.data) ? res.data : [];

  const outboxBadge = document.getElementById('overview-outbox-count');
  if (outboxBadge) outboxBadge.textContent = items.length;

  const dashboardOutbox = document.getElementById('dashboardOutboxList');
  if (dashboardOutbox) {
    dashboardOutbox.innerHTML = items.length ? items.slice(0, 3).map(item => `
      <div class="tile-row">
        <b>${escapeHtml(item.name)}</b>
        <small>${escapeHtml(item.size)} · ${escapeHtml(item.status)}</small>
      </div>
    `).join('') : '<p class="tile-state">Drop deliverables or links to Jax\'s inbox.</p>';
  }

  const receiptsList = document.getElementById('sendReceiptsList');
  if (receiptsList) {
    receiptsList.innerHTML = items.map(item => `
      <div class="tile-row">
        <b>📦 ${escapeHtml(item.name)}</b>
        <small>${escapeHtml(item.size)} · Sent ${escapeHtml(item.timestamp)} · Status: <span style="color: var(--ion);">${escapeHtml(item.status)}</span></small>
      </div>
    `).join('');
  }

  // Full Dropzone in Send space
  const dropzone = document.getElementById('fullDropzone');
  const fileInput = document.getElementById('fullFileInput');
  if (dropzone && fileInput) {
    dropzone.onclick = () => fileInput.click();
    const senderName = currentMe ? currentMe.displayName : 'Team Member';

    fileInput.onchange = async () => {
      for (const f of fileInput.files) {
        await window.meridian.api.uploadToSendToMeridian({
          name: f.name,
          type: 'file',
          size: `${Math.round(f.size / 1024)} KB`
        }, senderName);
      }
      loadSendQueue();
    };

    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--ion)'; };
    dropzone.ondragleave = () => { dropzone.style.borderColor = '#2A3654'; };
    dropzone.ondrop = async (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#2A3654';
      if (e.dataTransfer && e.dataTransfer.files) {
        for (const f of e.dataTransfer.files) {
          await window.meridian.api.uploadToSendToMeridian({
            name: f.name,
            type: 'file',
            size: `${Math.round(f.size / 1024)} KB`
          }, senderName);
        }
        loadSendQueue();
      }
    };
  }

  // Full Link Form
  const linkForm = document.getElementById('fullLinkForm');
  if (linkForm) {
    linkForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('fullLinkInput');
      const url = input.value.trim();
      if (!url) return;
      input.value = '';

      const senderName = currentMe ? currentMe.displayName : 'Team Member';
      await window.meridian.api.uploadToSendToMeridian({
        name: url,
        type: 'link',
        size: 'Resource URL'
      }, senderName);
      loadSendQueue();
    };
  }
}

// 5. Tools & Services Doorway
async function loadTools() {
  const container = document.getElementById('toolsGridContainer');
  const navCount = document.getElementById('nav-tools-count');
  if (!container) return;

  const res = await window.meridian.api.getTools();
  if (!res || !res.success) {
    container.innerHTML = '<div style="color: var(--ash); padding: 20px;">Could not load tools from Meridian host.</div>';
    return;
  }

  const tools = res.data || [];
  if (navCount) navCount.textContent = tools.length;

  if (res.hostInfo) {
    const machineEl = document.getElementById('hostMachineName');
    if (machineEl) machineEl.textContent = res.hostInfo.machine || "Jax's PC";
  }

  container.innerHTML = tools.map(t => `
    <div class="tool-card" data-tool-id="${escapeHtml(t.id)}">
      <div>
        <div class="tool-card-head">
          <div class="tool-card-title-group">
            <div class="tool-card-icon">${t.icon || '⚡'}</div>
            <div>
              <div class="tool-card-name">${escapeHtml(t.name)}</div>
              <div class="tool-card-category">${escapeHtml(t.category)}</div>
            </div>
          </div>
        </div>
        <div class="tool-card-desc" style="margin-top: 10px;">${escapeHtml(t.description)}</div>
      </div>
      <div class="tool-card-footer">
        <span class="tool-status-pill"><i></i>HOST READY</span>
        <button type="button" class="btn-trigger-tool" data-action="run-tool" data-id="${escapeHtml(t.id)}" data-name="${escapeHtml(t.name)}">
          <span>▶</span> Run on Host
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-action="run-tool"]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const toolId = btn.dataset.id;
      const toolName = btn.dataset.name;
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> Executing…';

      const execRes = await window.meridian.api.executeTool(toolId, {
        topic: 'Meridian Connect Architecture & Team Workflows',
        title: 'Q4 Remote Workstation Overview',
        query: 'Security baseline & host routing'
      });

      btn.disabled = false;
      btn.innerHTML = '<span>▶</span> Run on Host';

      const panel = document.getElementById('toolExecOutputPanel');
      const titleEl = document.getElementById('toolExecOutputTitle');
      const contentEl = document.getElementById('toolExecOutputContent');

      if (panel && contentEl) {
        panel.style.display = 'block';
        if (titleEl) titleEl.textContent = `Host Execution: ${toolName}`;
        if (execRes && execRes.success && execRes.data) {
          const d = execRes.data;
          contentEl.textContent = `[TIMESTAMP] ${d.timestamp}\n[TARGET]    ${d.executed_on}\n[TRIGGERED] ${d.requested_by}\n[STATUS]    ${d.status.toUpperCase()}\n\n${d.output}`;
        } else {
          contentEl.textContent = `Error executing tool: ${(execRes && execRes.error) || 'Host service unreachable'}`;
        }
        panel.scrollIntoView({ behavior: 'smooth' });
      }
    };
  });

  const clearBtn = document.getElementById('btnCloseToolOutput');
  if (clearBtn) {
    clearBtn.onclick = () => {
      const panel = document.getElementById('toolExecOutputPanel');
      if (panel) panel.style.display = 'none';
    };
  }
}


// 5. Chat Dock Handlers
function setupChatHandlers() {
  const textInput = document.getElementById('text');
  const sendBtn = document.getElementById('dockSendBtn');

  const doSend = async () => {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = '';
    if (window.meridianNav) { const nav = await window.meridianNav.handle(text).catch(() => null); if (nav) return; }   // "take me to…"

    const container = document.getElementById('dockMessages');
    if (!container) return;

    // Use the selected project from the authenticated list; never invent an ID.
    const studio = window.meridianStudioContext;
    const request = studio.beginProjectRequest();
    if (!request) {
      textInput.value = text;
      const notice = document.createElement('div');
      notice.className = 'm mer';
      notice.textContent = 'Select a project before sending.';
      container.appendChild(notice);
      return;
    }
    const you = document.createElement('div');
    you.className = 'm you';
    you.textContent = text;
    container.appendChild(you);
    container.scrollTop = container.scrollHeight;
    const res = await window.meridian.api.sendChatMessage(request.projectId, text);
    if (!studio.isCurrentRequest(request)) return;
    if (res && res.success && res.data) {
      const mer = document.createElement('div');
      mer.className = 'm mer';
      mer.innerHTML = `<span class="route" style="font-size: 10px; color: var(--ion); display: block; margin-bottom: 4px;">MERIDIAN CORE · SAMPLE</span><div>${escapeHtml(res.data.reply)}</div>`;
      container.appendChild(mer);
      container.scrollTop = container.scrollHeight;
    }
  };

  if (sendBtn) sendBtn.onclick = doSend;
  if (textInput) {
    textInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    };
  }

  // Quick Action Buttons
  document.querySelectorAll('[data-prompt]').forEach(btn => {
    btn.onclick = () => {
      if (textInput) {
        textInput.value = btn.dataset.prompt;
        textInput.focus();
      }
    };
  });
}

/* ==========================================================================
   4. ATMOSPHERIC BOKEH GLINTS & LIVE SKY ORB
   ========================================================================== */
function initBokehField() {
  const field = document.getElementById('bokehField');
  if (!field) return;
  field.innerHTML = '';
  let bokehSeed = 17;
  function bokehRand() {
    bokehSeed = (bokehSeed * 1664525 + 1013904223) >>> 0;
    return bokehSeed / 4294967296;
  }

  for (let bi = 0; bi < 42; bi++) {
    const glint = document.createElement('span');
    const sz = 5 + bokehRand() * 35;
    glint.style.left = (33 + bokehRand() * 67) + '%';
    glint.style.top = (8 + bokehRand() * 67) + '%';
    glint.style.setProperty('--size', sz + 'px');
    glint.style.setProperty('--alpha', (0.1 + bokehRand() * 0.4).toFixed(2));
    glint.style.setProperty('--blur', (bokehRand() * 2).toFixed(1) + 'px');
    glint.style.setProperty('--duration', (9 + bokehRand() * 16).toFixed(1) + 's');
    glint.style.setProperty('--dx', (-18 + bokehRand() * 36).toFixed(1) + 'px');
    glint.style.setProperty('--dy', (-18 + bokehRand() * 36).toFixed(1) + 'px');
    field.appendChild(glint);
  }
}

function initSkyOrb() {
  const cv = document.getElementById('orb');
  if (!cv) return;
  const cx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, Hh = 0;

  function resize() {
    const r = cv.getBoundingClientRect();
    W = r.width;
    Hh = r.height;
    cv.width = W * dpr;
    cv.height = Hh * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(cv);
  resize();

  const markImg = new Image();
  markImg.src = 'assets/mark.webp';

  const t0 = performance.now();
  function render(now) {
    const time = (now - t0) / 1000;
    cx.clearRect(0, 0, W, Hh);

    const c = W / 2;
    const my = Hh * 0.46 + Math.sin(time * 0.8) * 8;
    const sz = Math.min(W, Hh) * 0.55;

    // Draw mark
    if (markImg.complete && markImg.naturalWidth) {
      cx.save();
      cx.globalAlpha = 0.85;
      cx.drawImage(markImg, c - sz / 2, my - sz / 2, sz, sz);
      cx.restore();
    }

    // Circular orbit particles
    cx.fillStyle = 'rgba(79, 209, 224, 0.4)';
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2 + time * 0.12;
      const radius = sz * (0.65 + 0.03 * Math.sin(i * 5 + time));
      const px = c + Math.cos(angle) * radius;
      const py = my + Math.sin(angle) * radius * 0.35;
      cx.beginPath();
      cx.arc(px, py, 1.2, 0, Math.PI * 2);
      cx.fill();
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function setupClock() {
  function update() {
    const d = new Date();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

    const navTime = document.getElementById('navTime');
    if (navTime) navTime.textContent = timeStr;
    const navDate = document.getElementById('navDate');
    if (navDate) navDate.textContent = dateStr;

    const heroTime = document.getElementById('heroTime');
    if (heroTime) heroTime.textContent = timeStr;
    const heroDate = document.getElementById('heroDate');
    if (heroDate) heroDate.textContent = dateStr;
  }
  update();
  setInterval(update, 30000);
}

/* ==========================================================================
   5. QUICK SEARCH & SETTINGS
   ========================================================================== */
function setupQuickSearch() {
  const trigger = document.getElementById('dashboardSearchTrigger');
  const modal = document.getElementById('quick-search-modal');
  const closeBtn = document.getElementById('btn-search-close');
  const input = document.getElementById('quick-search-input');
  const results = document.getElementById('quick-search-results');

  const openModal = () => {
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
  };
  const closeModal = () => { modal.style.display = 'none'; };

  if (trigger) trigger.onclick = openModal;
  if (closeBtn) closeBtn.onclick = closeModal;
  if (modal) modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (modal.style.display === 'flex') closeModal(); else openModal();
    } else if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (!q) {
      results.innerHTML = '<div style="text-align: center; color: var(--ash); padding: 24px;">Type to search across all records…</div>';
      return;
    }
    const res = await window.meridian.api.searchAll(q, currentMe ? currentMe.username : '');
    const items = (res && res.data) ? res.data : [];
    if (!items.length) {
      results.innerHTML = '<div style="text-align: center; color: var(--ash); padding: 24px;">No matching records found.</div>';
      return;
    }
    results.innerHTML = items.map(item => `
      <div class="search-result-item" data-panel="${item.panel}">
        <div>
          <b style="color: #fff; font-size: 13px;">${escapeHtml(item.title)}</b>
          <div style="font-size: 11px; color: var(--ash);">${escapeHtml(item.subtitle)}</div>
        </div>
        <span class="card-badge">${escapeHtml(item.type)}</span>
      </div>
    `).join('');

    results.querySelectorAll('.search-result-item').forEach(el => {
      el.onclick = () => {
        if (el.dataset.panel) switchView(el.dataset.panel);
        closeModal();
      };
    });
  });
}

function setupSettingsUI() {
  const openBtn = document.getElementById('openSettingsBtn');
  const modal = document.getElementById('settings-modal');
  const cancelBtn = document.getElementById('btn-settings-cancel');
  const form = document.getElementById('settings-form');

  if (openBtn) openBtn.onclick = () => { modal.style.display = 'flex'; };
  if (cancelBtn) cancelBtn.onclick = () => { modal.style.display = 'none'; };
  if (modal) modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const url = document.getElementById('settings-server-url').value;
      const timeout = parseInt(document.getElementById('settings-timeout').value, 10) || 10000;
      const notifications = document.getElementById('settings-notifications').checked;

      await window.meridian.saveSettings({
        serverUrl: url,
        apiTimeoutMs: timeout,
        notificationsEnabled: notifications
      });
      modal.style.display = 'none';
    };
  }
}

function setupPopoutListeners() {
  window.meridian.onPanelDocked((panelId) => {
    poppedViews.delete(panelId);
    updatePoppedState();
  });
  window.meridian.onPanelPoppedOut((panelId) => {
    poppedViews.add(panelId);
    updatePoppedState();
  });
  window.meridian.onDataSync(() => {
    loadAllPanelData();
  });
}

function setupIdleWatcher() {
  let lastActive = Date.now();
  window.addEventListener('mousemove', () => { lastActive = Date.now(); });
  window.addEventListener('keydown', () => { lastActive = Date.now(); });

  idleTimer = setInterval(() => {
    const idleHours = (Date.now() - lastActive) / (1000 * 60 * 60);
    const limit = (clientSettings && clientSettings.idleTimeoutHours) ? clientSettings.idleTimeoutHours : 8;
    if (idleHours >= limit && currentUser) {
      window.meridian.logout();
      showLogin();
    }
  }, 60000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* 2026-10-06: first sign-in with a temporary password -> choose your own */
function showChangePassword(user, me) {
  let box = document.getElementById('pw-change-view');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pw-change-view';
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#05070EF0;font-family:inherit';
    box.innerHTML = `<form id="pw-change-form" style="width:min(420px,92vw);padding:28px;border:1px solid #3A4260;border-radius:16px;background:linear-gradient(150deg,#19192B,#0D1220);color:#EAF1FC;display:grid;gap:10px">
      <div style="font:700 10px ui-monospace,monospace;letter-spacing:.16em;color:#79DDE9">MERIDIAN CONNECT</div>
      <h2 style="margin:0;font-size:22px">Choose your password</h2>
      <p id="pw-change-hello" style="margin:0 0 6px;color:#8EA0BC;font-size:13px"></p>
      <input id="pw-cur" type="password" placeholder="Temporary password" required style="padding:10px;border-radius:8px;border:1px solid #2C3248;background:#0B0F1C;color:inherit">
      <input id="pw-new" type="password" placeholder="New password (12+ characters)" required style="padding:10px;border-radius:8px;border:1px solid #2C3248;background:#0B0F1C;color:inherit">
      <input id="pw-new2" type="password" placeholder="Type it again" required style="padding:10px;border-radius:8px;border:1px solid #2C3248;background:#0B0F1C;color:inherit">
      <div id="pw-change-err" style="color:#FFC8D0;font-size:12px;min-height:16px"></div>
      <button style="padding:11px;border-radius:9px;border:1px solid #2E6670;background:#12313A;color:#79DDE9;font-weight:700;cursor:pointer">Save and continue</button>
      <button type="button" id="pw-change-cancel" style="padding:8px;border:0;background:none;color:#8EA0BC;cursor:pointer">Sign out</button></form>`;
    document.body.appendChild(box);
    document.getElementById('pw-change-cancel').onclick = async () => { box.remove(); await window.meridian.logout(); showLogin(); };
  }
  document.getElementById('pw-change-hello').textContent = `Welcome, ${me.name || user.displayName}. You signed in with a temporary password; pick your own to continue.`;
  document.getElementById('pw-change-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = document.getElementById('pw-change-err');
    const cur = document.getElementById('pw-cur').value, n1 = document.getElementById('pw-new').value, n2 = document.getElementById('pw-new2').value;
    if (n1 !== n2) { err.textContent = 'The new passwords do not match.'; return; }
    const res = await window.meridian.api.changePassword(cur, n1);
    if (res && res.success) { box.remove(); enterApp(user); }
    else { err.textContent = (res && res.error) || 'Could not change the password.'; }
  };
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('pw-cur').focus();
}
