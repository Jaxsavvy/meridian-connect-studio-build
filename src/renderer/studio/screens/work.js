'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('work', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  function createWork({ service, spaceId, toolId, navigate, report }) {
    let disposed = false, revision = 0;
    return {
      async load() {
        if (disposed) return;
        const request = ++revision;
        report({ state: 'loading' });
        try {
          const [space, tools] = await Promise.all([service.getSpace(spaceId), service.listTools()]);
          if (disposed || request !== revision) return;
          if (!space || space.id !== spaceId) throw Error('Space unavailable');
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
  function render(el, { spaceId, toolId }, studio) {
    const doc = el.ownerDocument;
    const root = doc.createElement('section'); root.className = 'studio-work';
    root.setAttribute('aria-label', 'Studio Work view'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    let backButton;
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
    const model = createWork({ service: studio.service, spaceId, toolId, navigate: studio.navigate,
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
        const stage = node('section', '', 'studio-work-stage-bar'); stage.hidden = true;
        stage.setAttribute('aria-label', 'Workflow stage'); root.appendChild(stage);
        const canvas = region('studio-work-canvas-heading', `${view.tool.name} canvas`, 'studio-work-canvas studio-card');
        const conversation = region('studio-work-conversation-heading', 'Meridian Studio', 'studio-work-conversation studio-card');
        const assets = region('studio-work-assets-heading', 'Space assets', 'studio-work-assets studio-card');
        studio.mountInto(canvas.slot, 'tool', toolId, { spaceId });
        studio.mountInto(conversation.slot, 'part', 'conversation', { spaceId, toolId });
        studio.mountInto(assets.slot, 'part', 'assets-strip', { spaceId, toolId });
        restoreFocus(canvas.heading);
      } });
    void model.load();
    return () => { model.dispose(); removeListeners(); root.remove(); };
  }
  return { createWork, render };
});
