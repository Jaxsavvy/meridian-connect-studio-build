'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('space', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  function groupTools(tools) {
    return ['workflow', 'tool'].map(kind => ({ kind, tools: tools.filter(tool => tool.kind === kind)
      .map(tool => ({ ...tool, disabled: tool.state !== 'available' })) }));
  }
  function recentAssets(assets, spaceId) {
    return assets.filter(a => a.spaceId === spaceId && !a.trashed).reverse()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 6);
  }
  function progress(value) { return Math.min(100, Math.max(0, Number(value) || 0)); }
  function createSpace({ service, spaceId, navigate, report }) {
    let disposed = false, revision = 0, tools = [], jobs = [];
    async function load() {
      if (disposed) return;
      const request = ++revision;
      tools = []; jobs = [];
      report({ state: 'loading' });
      try {
        const [space, catalog, assets] = await Promise.all([
          service.getSpace(spaceId), service.listTools(), service.listAssets(spaceId),
        ]);
        if (disposed || revision !== request) return;
        if (!space || space.id !== spaceId) throw Error('Space unavailable');
        tools = catalog; jobs = space.jobs || [];
        report({ state: 'ready', space, groups: groupTools(tools), assets: recentAssets(assets, spaceId) });
      } catch (_) {
        if (!disposed && revision === request) report({ state: 'failed',
          message: 'Unable to open this Space. Check your connection and access, then try again.' });
      }
    }
    const off = service.on((event, detail) => {
      if (event === 'spaces-changed' || (['assets-changed', 'jobs-changed'].includes(event) && detail?.spaceId === spaceId)) void load();
    });
    return { load,
      back() { if (!disposed) navigate('home'); },
      open(toolId) {
        const tool = tools.find(t => t.id === toolId && t.state === 'available');
        if (disposed || !tool) return false;
        navigate(tool.kind === 'workflow' ? 'workflow' : 'work',
          tool.kind === 'workflow' ? { spaceId, workflowId: toolId } : { spaceId, toolId }); return true;
      },
      openJob(jobId) {
        const job = jobs.find(item => item.id === jobId && item.workflowId);
        if (disposed || !job) return false;
        // Pitch deck Jobs open the Pitch Deck page; every other Job keeps the Job screen.
        navigate(job.workflowId === 'pitch-deck' ? 'pitch-deck' : 'job', { spaceId, jobId }); return true;
      },
      dispose() { disposed = true; revision++; tools = []; jobs = []; off(); },
    };
  }
  function render(el, { spaceId }, studio) {
    const doc = el.ownerDocument;
    const root = doc.createElement('section'); root.className = 'studio-space';
    root.setAttribute('aria-label', 'Space home'); el.replaceChildren(root);
    function node(tag, text, className) {
      const item = doc.createElement(tag);
      if (text) item.textContent = text;
      if (className) item.className = className;
      return item;
    }
    function button(label, action, className = 'studio-button is-secondary') {
      const item = node('button', label, className); item.type = 'button';
      item.addEventListener('click', action); return item;
    }
    function section(title) {
      const item = node('section', '', 'studio-card'); item.setAttribute('aria-label', title);
      item.appendChild(node('h2', title)); root.appendChild(item); return item;
    }
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    let panelController = null;
    function closeMove() { panelController?.abort(); panelController = null; }
    const model = createSpace({ service: studio.service, spaceId, navigate: studio.navigate,
      report(view) {
        const restoreFocus = focus();
        closeMove();
        root.replaceChildren(button('Back to Studio', () => model.back()), node('h1', view.space?.name || 'Space'));
        root.setAttribute('aria-busy', String(view.state === 'loading'));
        if (view.state !== 'ready') {
          root.appendChild(states.panel(doc, view.state, view.state === 'loading' ? 'Loading Space…' : view.message,
            () => void model.load()));
          restoreFocus(); return;
        }
        const { space, assets, groups } = view;
        const dnaCard = section('Project DNA');
        if (space.type !== 'client') dnaCard.appendChild(node('p', "Sandboxes don't need Project DNA"));
        else if (!space.dna) dnaCard.appendChild(node('p', 'Project DNA has not been added yet.'));
        else {
          const dna = space.dna;
          if (dna.status === 'draft') dnaCard.appendChild(node('span', 'Draft, waiting on Jax', 'studio-chip'));
          for (const [label, value] of [['Brief', dna.brief], ['Fonts', (dna.fonts || []).join(', ')],
            ['Voice', dna.voice], ['Audience', dna.audience]]) dnaCard.appendChild(node('p', `${label}: ${value || 'Not set'}`));
          const colors = node('div', '', 'studio-space-colors');
          for (const color of dna.colors || []) {
            const label = node('label', color, 'studio-space-color');
            // A native disabled color input displays service data without inline styling.
            if (/^#[0-9a-f]{6}$/i.test(color)) {
              const swatch = node('input'); swatch.type = 'color'; swatch.value = color;
              swatch.disabled = true; swatch.setAttribute('aria-label', `Brand color ${color}`); label.appendChild(swatch);
            }
            colors.appendChild(label);
          }
          dnaCard.appendChild(colors);
        }
        const jobs = section('Active Jobs');
        if (!space.jobs?.length) jobs.appendChild(states.panel(doc, 'empty', 'No active Jobs in this Space.'));
        for (const job of space.jobs || []) {
          const item = node('article'), heading = node('h3');
          if (job.id && job.workflowId) heading.appendChild(button(job.name, () => model.openJob(job.id)));
          else heading.textContent = job.name;
          item.append(heading, node('p', job.stage));
          const bar = node('progress'); bar.max = 100; bar.value = progress(job.progress);
          bar.setAttribute('aria-label', `${job.name} progress`); bar.textContent = `${bar.value}%`;
          item.append(bar, node('span', `${bar.value}%`)); jobs.appendChild(item);
        }
        const recent = section('Recent assets');
        if (!assets.length) recent.appendChild(states.panel(doc, 'empty', 'No assets in this Space yet.'));
        const list = node('div', '', 'studio-space-assets');
        for (const asset of assets) {
          const figure = node('figure');
          if (asset.kind === 'image' && asset.url) {
            const image = node('img'); image.src = asset.url; image.alt = asset.name; image.loading = 'lazy';
            image.addEventListener('error', () => { image.replaceWith(node('p', 'Preview unavailable')); }, { once: true });
            figure.appendChild(image);
          }
          figure.appendChild(node('figcaption', asset.name));
          if (space.type.startsWith('sandbox')) {
            const panel = node('div');
            const move = button('Move to client', () => {
              closeMove(); panelController = new AbortController();
              studio.mountInto(panel, 'part', 'move-to-client', { spaceId, assetId: asset.id, signal: panelController.signal,
                onDone() { closeMove(); move.focus?.(); } });
            });
            figure.append(move, panel);
          }
          list.appendChild(figure);
        }
        recent.appendChild(list);
        for (const group of groups) {
          const row = section(group.kind === 'workflow' ? 'Start a workflow' : 'Open a tool');
          if (!group.tools.length) row.appendChild(states.panel(doc, 'empty', 'Nothing available yet.'));
          const tiles = node('div', '', 'studio-space-tiles');
          for (const tool of group.tools) {
            const tile = button('', () => model.open(tool.id), `studio-tile${tool.disabled ? ' is-coming-soon' : ''}`);
            tile.appendChild(node('span', tool.name)); tile.disabled = tool.disabled;
            if (tool.disabled) tile.appendChild(node('span', 'Coming soon', 'studio-chip'));
            tiles.appendChild(tile);
          }
          row.appendChild(tiles);
        }
        restoreFocus();
      } });
    void model.load();
    return () => { closeMove(); model.dispose(); root.remove(); };
  }
  return { groupTools, recentAssets, progress, createSpace, render };
});
