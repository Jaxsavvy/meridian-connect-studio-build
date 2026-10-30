'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('work', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  // AUDIT 2026-10-29: a stage only offers tools that work there: the Copywriter is Kickoff's brief form (on Story and
  // Words it only said "open it from Kickoff"), and a tool that isn't built yet ('video') is left out.
  const usableTools = (stage, hasTool) => (stage?.tools || []).filter(id => (id !== 'copywriter' || stage.id === 'brief')
    && (typeof hasTool !== 'function' || hasTool(id)));
  function createWork({ service, spaceId, toolId, jobId, stageId, navigate, report, owner = false, hasTool }) {
    let disposed = false, revision = 0;
    return {
      async load() {
        if (disposed) return;
        const request = ++revision;
        report({ state: 'loading' });
        try {
          const [space, tools, job] = await Promise.all([service.getSpace(spaceId), service.listTools(),
            jobId ? service.getJob(spaceId, jobId) : null]);
          if (disposed || request !== revision) return;
          if (!space || space.id !== spaceId) throw Error('Space unavailable');
          if (jobId) {
            if (!job || job.spaceId !== spaceId || job.id !== jobId) throw Error('Job unavailable');
            // OWNER-JUMP 2026-10-29: Jax can open any stage to look at it and work on it; everyone else sees the current one.
            const picked = owner && stageId ? job.stages.find(item => item.id === stageId) : null;
            const found = picked || job.stages.find(item => item.id === job.stageId);
            const stage = found && { ...found, tools: usableTools(found, hasTool) };
            const selected = stageId === stage?.id && stage?.tools.includes(toolId) ? toolId : stage?.tools[0];
            report({ state: 'ready', space, job, stage, tools, jumped: Boolean(picked && picked.id !== job.stageId),
              tool: tools.find(item => item.id === selected) || (selected ? { id: selected, name: selected } : null) }); return;
          }
          const tool = tools.find(item => item.id === toolId);
          if (!tool || tool.state !== 'available') {
            report({ state: 'empty', space, message: tool ? `${tool.name} — Coming soon` : 'Choose an available tool from your Space.' });
            return;
          }
          report({ state: 'ready', space, tool });
        } catch (_) {
          if (!disposed && request === revision) report({ state: 'failed',
            message: 'Unable to open this Work view. Check your connection and access, then try again.' });
        }
      },
      back() { if (!disposed) navigate('space', { spaceId }); },
      dispose() { disposed = true; revision++; },
    };
  }
  function render(el, { spaceId, toolId, jobId, stageId }, studio) {
    const doc = el.ownerDocument;
    const root = doc.createElement('section'); root.className = 'studio-work';
    root.setAttribute('aria-label', 'Studio Work view'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    let backButton, disposed = false;
    const back = () => model.back();
    function node(tag, text, className) {
      const item = doc.createElement(tag);
      if (text) item.textContent = text;
      if (className) item.className = className;
      return item;
    }
    function region(id, title, className) {
      const box = node('section', '', className); box.tabIndex = 0;
      box.setAttribute('aria-labelledby', id);
      const heading = node('h2', title); heading.id = id; heading.tabIndex = -1;
      const slot = node('div', '', 'studio-work-slot'); box.append(heading, slot); root.appendChild(box);
      return { box, slot, heading };
    }
    function removeListeners() {
      backButton?.removeEventListener('click', back);
    }
    const model = createWork({ service: studio.service, spaceId, toolId, jobId, stageId, navigate: studio.navigate,
      owner: studio.isOwner === true, hasTool: studio.hasTool,
      report(view) {
        const restoreFocus = focus();
        removeListeners(); root.replaceChildren();
        const header = node('header', '', 'studio-work-header');
        backButton = node('button', 'Back to Space', 'studio-button is-secondary'); backButton.type = 'button';
        backButton.addEventListener('click', back);
        header.append(backButton, node('h1', view.space ? `${view.space.name} — ${view.tool?.name || 'Work'}` : 'Work'));
        root.appendChild(header); root.setAttribute('aria-busy', String(view.state === 'loading'));
        if (view.state !== 'ready') {
          root.appendChild(states.panel(doc, view.state, view.state === 'loading' ? 'Loading Work view…' : view.message,
            () => void model.load()));
          restoreFocus(); return;
        }
        if (view.jumped) {   // OWNER-JUMP: say plainly that this isn't where the Job is
          const current = view.job.stages.find(item => item.id === view.job.stageId);
          const note = node('div', '', 'studio-work-jump'); note.setAttribute('role', 'status');
          note.appendChild(node('p', `You're looking at ${view.stage.name}. The Job is on ${current ? current.name : 'its last stage'}.`));
          if (current) {
            const backTo = node('button', `Back to ${current.name}`, 'studio-button is-secondary'); backTo.type = 'button';
            backTo.addEventListener('click', () => studio.navigate('work', { spaceId, jobId, stageId: current.id }));
            note.appendChild(backTo);
          }
          root.appendChild(note);
        }
        const stage = node('section', '', 'studio-work-stage-bar'); stage.hidden = !jobId;
        stage.setAttribute('aria-label', 'Workflow stage'); root.appendChild(stage);
        const canvas = region('studio-work-canvas-heading', view.tool ? `${view.tool.name} canvas` : 'Stage canvas', 'studio-work-canvas studio-card');
        const conversation = region('studio-work-conversation-heading', 'Meridian Studio', 'studio-work-conversation studio-card');
        const assets = region('studio-work-assets-heading', 'Space assets', 'studio-work-assets studio-card');
        if (jobId) {
          const ctx = { spaceId, toolId: view.tool?.id, jobId, stageId: view.stage?.id || null };
          // Navigate through the shell so it cleans up old mounts and guards unsaved drafts.
          const open = selected => studio.navigate('work', { ...ctx, toolId: selected });
          if (view.stage?.tools.length > 1) {
            const switcher = node('div', '', 'studio-work-tools'); switcher.setAttribute('role', 'group');
            switcher.setAttribute('aria-label', 'Stage tools');
            for (const id of view.stage.tools) {
              const button = node('button', view.tools.find(t => t.id === id)?.name || id, 'studio-button is-secondary');
              button.type = 'button'; button.setAttribute('aria-pressed', String(id === ctx.toolId));
              button.addEventListener('click', () => { if (!disposed && id !== ctx.toolId) open(id); }); switcher.appendChild(button);
            }
            canvas.slot.appendChild(switcher);
          }
          const toolSlot = node('div'); canvas.slot.appendChild(toolSlot);
          if (ctx.toolId) studio.mountInto(toolSlot, 'tool', ctx.toolId, ctx);
          else toolSlot.appendChild(node('p', 'Nothing to make in this stage'));
          studio.mountInto(conversation.slot, 'part', 'conversation', ctx);
          studio.mountInto(assets.slot, 'part', 'assets-strip', ctx);
          studio.mountInto(stage, 'part', 'stage-bar', { spaceId, jobId, viewing: view.stage?.id || null, onStage(job) {
            if (!disposed && job.spaceId === spaceId && job.id === jobId && job.stageId !== view.job.stageId) {
              const next = job.stages.find(item => item.id === job.stageId);
              studio.navigate('work', { spaceId, jobId, stageId: job.stageId, toolId: next?.tools[0] });
            }
          } });
        } else {
          studio.mountInto(canvas.slot, 'tool', toolId, { spaceId });
          studio.mountInto(conversation.slot, 'part', 'conversation', { spaceId, toolId });
          studio.mountInto(assets.slot, 'part', 'assets-strip', { spaceId, toolId });
        }
        restoreFocus(canvas.heading);
      } });
    void model.load();
    return () => { disposed = true; model.dispose(); removeListeners(); root.remove(); };
  }
  return { createWork, render };
});
