'use strict';

const urlParams = new URLSearchParams(window.location.search);
const panelId = urlParams.get('panel') || 'projects';
const userName = urlParams.get('user') || 'Team Member';
const userRole = urlParams.get('role') || 'Member';

const panelTitles = {
  'overview': { title: 'Overview & Deck', icon: '⌂' },
  'projects': { title: 'My Projects', icon: '📁' },
  'files': { title: 'Project Files & Notes', icon: '📑' },
  'tasks': { title: 'My Tasks', icon: '✅' },
  'chat': { title: 'Project AI Chat', icon: '💬' },
  'messages': { title: 'Team Messages with Jax', icon: '👥' },
  'send': { title: 'Send to Meridian', icon: '🚀' },
  'tools': { title: 'Tools & Services', icon: '⚡' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const info = panelTitles[panelId] || { title: 'Panel', icon: '🖥️' };
  document.getElementById('popout-heading').textContent = info.title;
  document.getElementById('popout-icon').textContent = info.icon;
  document.getElementById('popout-user-label').textContent = `${userName} (${userRole})`;
  document.title = `Meridian Connect - ${info.title}`;

  document.getElementById('btn-dock-this').onclick = async () => {
    await window.meridian.dockPanel(panelId);
    window.close();
  };

  renderPanel();

  window.meridian.onDataSync(() => {
    renderPanel();
  });
});

async function renderPanel() {
  const container = document.getElementById('popout-content');
  if (panelId === 'overview') {
    const projRes = await window.meridian.api.getProjects();
    const taskRes = await window.meridian.api.getTasks();
    const projects = projRes.data || [];
    const tasks = taskRes.data || [];
    container.innerHTML = `
      <div class="command-card" style="margin-bottom: 14px;">
        <div class="card-head">
          <div class="card-title-group"><span class="card-glyph">✦</span><span class="card-name">Workstation Live Deck</span></div>
          <span class="card-badge">SAMPLE</span>
        </div>
        <div style="font-size: 13px; color: var(--bone);">Popped out overview on dedicated display. All remote requests route to Jax's PC.</div>
      </div>
      <div class="overview-grid">
        <div class="command-card">
          <div class="card-head"><span class="card-name">Projects</span><span class="card-badge">${projects.length} ACTIVE</span></div>
          <div class="overview-stat-row"><strong>${projects.length}</strong><span>Projects</span></div>
        </div>
        <div class="command-card">
          <div class="card-head"><span class="card-name">Tasks</span><span class="card-badge">${tasks.length} PENDING</span></div>
          <div class="overview-stat-row"><strong>${tasks.filter(t => !t.completed).length}</strong><span>Assigned</span></div>
        </div>
      </div>
    `;
  } else if (panelId === 'projects') {
    const res = await window.meridian.api.getProjects();
    const projects = res.data || [];
    container.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: 700; font-size: 14px;">My Assigned Projects</div>
      <div class="project-list">
        ${projects.map(p => `
          <div class="project-item active">
            <div class="project-item-head">
              <span class="project-name">${p.name}</span>
              <span class="status-badge in-progress">${p.status}</span>
            </div>
            <div class="project-desc">${p.description}</div>
            <div style="margin-top: 8px; font-size: 11px; color: var(--ash);">Lead: ${p.lead} · Assigned: ${p.assignedTo} · Files: ${p.filesCount} · Notes: ${p.notesCount}</div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (panelId === 'files') {
    const projRes = await window.meridian.api.getProjects();
    const projects = projRes.data || [];
    const activeProj = projects[0] || { id: 'proj-001', name: 'Project' };
    const filesRes = await window.meridian.api.getProjectFiles(activeProj.id);
    const notesRes = await window.meridian.api.getProjectNotes(activeProj.id);
    const files = filesRes.data || [];
    const notes = notesRes.data || [];

    container.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: 700; font-size: 14px;">Scope: <span style="color: var(--ion);">${activeProj.name}</span></div>
      <div class="project-detail-view" style="height: 100%;">
        <div class="detail-tabs">
          <button type="button" id="pop-tab-files" class="tab-btn active">📄 Files (${files.length})</button>
          <button type="button" id="pop-tab-notes" class="tab-btn">📝 Notes (${notes.length})</button>
        </div>
        <div id="pop-content-files" class="detail-content">
          ${files.map(f => `
            <div class="file-row">
              <div>
                <div class="file-name">📄 ${f.name}</div>
                <div class="file-meta">${f.type} · ${f.size} · Updated ${f.updated}</div>
              </div>
              <span class="panel-badge">SAMPLE</span>
            </div>
          `).join('')}
        </div>
        <div id="pop-content-notes" class="detail-content" style="display: none;">
          ${notes.map(n => `
            <div class="note-card">
              <div class="note-title">${n.title}</div>
              <div class="note-text">${n.content}</div>
              <div class="note-foot">
                <span>By ${n.author}</span>
                <span>${n.date}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const tf = document.getElementById('pop-tab-files');
    const tn = document.getElementById('pop-tab-notes');
    const cf = document.getElementById('pop-content-files');
    const cn = document.getElementById('pop-content-notes');
    if (tf && tn && cf && cn) {
      tf.onclick = () => {
        tf.classList.add('active');
        tn.classList.remove('active');
        cf.style.display = 'block';
        cn.style.display = 'none';
      };
      tn.onclick = () => {
        tn.classList.add('active');
        tf.classList.remove('active');
        cn.style.display = 'block';
        cf.style.display = 'none';
      };
    }
  } else if (panelId === 'tasks') {
    const res = await window.meridian.api.getTasks();
    const tasks = res.data || [];
    container.innerHTML = `
      <div class="tasks-header-note">
        Assigned Tasks (Read & Check-off Only · Read-only on remote workstation)
      </div>
      <div class="task-list">
        ${tasks.map(t => `
          <div class="task-row ${t.completed ? 'completed' : ''}" data-id="${t.id}">
            <input type="checkbox" class="task-checkbox" ${t.completed ? 'checked' : ''}>
            <div class="task-content">
              <div class="task-title">${t.title}</div>
              <div class="task-meta">
                <span>Assigned: <strong>${t.assignedTo}</strong></span>
                <span class="priority-pill ${t.priority}">${t.priority}</span>
                <span>Due: ${t.dueDate}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('.task-row').forEach(row => {
      const chk = row.querySelector('.task-checkbox');
      const taskId = row.dataset.id;
      chk.onchange = async () => {
        row.classList.toggle('completed', chk.checked);
        await window.meridian.api.markTaskDone(taskId, chk.checked);
        window.meridian.notifyDataChanged('task-updated', { taskId, completed: chk.checked });
      };
    });
  } else if (panelId === 'chat') {
    const res = await window.meridian.api.getChatHistory('proj-001');
    const history = res.data || [];
    container.innerHTML = `
      <div class="chat-container" style="height: 100%;">
        <div class="chat-offline-banner">
          <span>⚠️</span>
          <div>Connecting to Meridian... (AI models & context run exclusively on Jax's host PC)</div>
        </div>
        <div class="chat-history">
          ${history.map(m => `
            <div class="chat-bubble ${m.sender === 'AI' ? 'ai' : 'user'}">
              <div><strong>${m.sender}:</strong> ${m.text}</div>
              <div class="chat-time">${m.time}</div>
            </div>
          `).join('')}
        </div>
        <div class="chat-compose">
          <input type="text" class="chat-input" placeholder="Connecting to Meridian..." disabled>
          <button type="button" class="btn-chat-send" disabled>Send</button>
        </div>
      </div>
    `;
  } else if (panelId === 'messages') {
    const res = await window.meridian.api.getMessages();
    const messages = res.data || [];
    container.innerHTML = `
      <div class="messages-history" style="flex: 1;">
        ${messages.map(m => `
          <div class="msg-item ${m.isJax ? 'jax' : ''}">
            <div class="msg-head">
              <span class="msg-sender ${m.isJax ? 'jax-name' : ''}">${m.sender}</span>
              <span class="msg-time">${m.time}</span>
            </div>
            <div class="msg-body">${m.text}</div>
          </div>
        `).join('')}
      </div>
      <form id="popout-msg-form" class="msg-compose" style="margin-top: 8px;">
        <input type="text" id="popout-msg-input" class="msg-input" placeholder="Message Jax..." required>
        <button type="submit" class="btn-msg-send">Send</button>
      </form>
    `;

    const form = document.getElementById('popout-msg-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('popout-msg-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      await window.meridian.api.sendTeamMessage(text, userName);
      window.meridian.notifyDataChanged('message-sent', {});
      renderPanel();
    };
  } else if (panelId === 'send') {
    const res = await window.meridian.api.getSentToMeridianList();
    const items = res.data || [];
    container.innerHTML = `
      <div class="send-banner">
        <span>📬</span>
        <div>Items dropped or linked here <strong>will be sent to Jax's inbox</strong> on his PC.</div>
      </div>
      <div id="popout-dropzone" class="dropzone">
        <div class="dropzone-icon">📥</div>
        <div class="dropzone-text">Drop files to send to Jax's PC</div>
        <div class="dropzone-sub">or click to browse files</div>
        <input type="file" id="popout-file-picker" style="display: none;" multiple>
      </div>
      <div class="send-queue">
        <div style="font-size: 10px; font-weight: 700; color: #7E8CA6; text-transform: uppercase; margin-bottom: 4px;">Recently Sent to Jax</div>
        ${items.map(item => `
          <div class="queue-item">
            <div>
              <div class="queue-name">${item.name}</div>
              <div style="font-size: 10px; color: var(--ash);">${item.size} · ${item.timestamp}</div>
            </div>
            <span class="queue-status">${item.status}</span>
          </div>
        `).join('')}
      </div>
    `;

    const dz = document.getElementById('popout-dropzone');
    const fp = document.getElementById('popout-file-picker');
    dz.onclick = () => fp.click();
    fp.onchange = async () => {
      for (const f of fp.files) {
        await window.meridian.api.uploadToSendToMeridian({ name: f.name, type: 'file', size: 'File' });
      }
      window.meridian.notifyDataChanged('upload-complete', {});
      renderPanel();
    };
  } else if (panelId === 'tools') {
    const res = await window.meridian.api.getTools();
    const tools = (res && res.data) ? res.data : [];
    container.innerHTML = `
      <div class="command-card" style="margin-bottom: 14px;">
        <div class="card-head">
          <div class="card-title-group"><span class="card-glyph">⚡</span><span class="card-name">Host Tools & Services</span></div>
          <span class="card-badge">CONNECTED</span>
        </div>
        <div style="font-size: 13px; color: var(--bone);">Remote execution doorway to Jax's PC. Trigger intelligence engines and deliverable generation.</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
        ${tools.map(t => `
          <div class="tool-card">
            <div>
              <div class="tool-card-head">
                <div class="tool-card-title-group">
                  <div class="tool-card-icon">${t.icon || '⚡'}</div>
                  <div>
                    <div class="tool-card-name">${t.name}</div>
                    <div class="tool-card-category">${t.category}</div>
                  </div>
                </div>
              </div>
              <div class="tool-card-desc" style="margin-top: 8px;">${t.description}</div>
            </div>
            <div class="tool-card-footer">
              <span class="tool-status-pill"><i></i>HOST READY</span>
              <button type="button" class="btn-trigger-tool" data-pop-tool="${t.id}" data-name="${t.name}">▶ Run</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div id="popToolOutput" style="display: none; margin-top: 14px; padding: 12px; background: #060913; border: 1px solid var(--line); border-radius: 8px; font-family: var(--font-mono); font-size: 11.5px; color: #c5d4ef; white-space: pre-wrap;"></div>
    `;

    container.querySelectorAll('[data-pop-tool]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.popTool;
        const name = btn.dataset.name;
        btn.disabled = true;
        btn.textContent = 'Executing...';
        const execRes = await window.meridian.api.executeTool(id, {});
        btn.disabled = false;
        btn.textContent = '▶ Run';
        const out = document.getElementById('popToolOutput');
        if (out) {
          out.style.display = 'block';
          out.textContent = `[EXECUTED] ${name} on Jax's PC\n${execRes.data ? execRes.data.output : 'Done'}`;
        }
      };
    });
  }
}

