(function (root) {
  'use strict';

  let currentInstance = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
    }[character]));
  }

  function attr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }

  function statusClass(value) {
    return String(value || '').toLocaleLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  }

  function mount({ host, context, getProjects, onProjectSelect }) {
    if (!host || !context || !root.MeridianStudioWorkspace || !root.MeridianStudioFixtures || !root.MeridianWebsiteBuilder) {
      throw new TypeError('Studio shell dependencies are unavailable.');
    }
    if (currentInstance) currentInstance.destroy();

    let active = false;
    let pendingLeave = null;
    let viewState = null;
    let announcementTimer = null;
    let dialogReturnFocus = null;
    const adapter = root.MeridianStudioFixtures.createSyntheticAdapter();
    let websiteState = null;
    let websiteContextId = null;
    let websiteStorage;
    try {
      websiteStorage = root.localStorage;
      const probe = 'meridian.website.storage.probe';
      websiteStorage.setItem(probe, '1');
      websiteStorage.removeItem(probe);
    } catch (_) {
      websiteStorage = root.MeridianWebsiteBuilder.createMemoryStorage();
    }
    const website = root.MeridianWebsiteBuilder.createController({
      storage: websiteStorage,
      onChange(next) { websiteState = next; render(); },
    });
    const workspace = root.MeridianStudioWorkspace.createWorkspace({
      context,
      adapter,
      onChange(next) {
        viewState = next;
        const nextProjectId = next.project && next.project.id;
        if (nextProjectId !== websiteContextId) {
          websiteContextId = nextProjectId || null;
          website.selectContext(next.project);
        }
        render();
      },
    });

    function projects() {
      const items = typeof getProjects === 'function' ? getProjects() : [];
      return Array.isArray(items) ? items.filter(item => item && item.id && item.name) : [];
    }

    function restoreFocus(key, selection) {
      if (!key) return;
      const target = host.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
      if (target) {
        target.focus({ preventScroll: true });
        if (selection && typeof target.setSelectionRange === 'function') {
          target.setSelectionRange(selection.start, selection.end, selection.direction);
        }
      }
    }

    function rememberDialogReturnFocus(element = document.activeElement) {
      if (!element || typeof element.focus !== 'function') return;
      if (!host.contains(element)) {
        dialogReturnFocus = { element };
        return;
      }
      if (element.dataset && element.dataset.focusKey) {
        dialogReturnFocus = { focusKey: element.dataset.focusKey };
        return;
      }
      if (element.dataset && element.dataset.action) {
        dialogReturnFocus = { action: element.dataset.action, value: element.dataset.value || '' };
        return;
      }
      dialogReturnFocus = { id: element.id || 'studio-main' };
    }

    function restoreDialogReturnFocus() {
      const returnFocus = dialogReturnFocus;
      dialogReturnFocus = null;
      if (!returnFocus) return;
      requestAnimationFrame(() => {
        let target = returnFocus.element && returnFocus.element.isConnected ? returnFocus.element : null;
        if (!target && returnFocus.focusKey) target = host.querySelector(`[data-focus-key="${CSS.escape(returnFocus.focusKey)}"]`);
        if (!target && returnFocus.action) {
          const value = returnFocus.value ? `[data-value="${CSS.escape(returnFocus.value)}"]` : '';
          target = host.querySelector(`[data-action="${CSS.escape(returnFocus.action)}"]${value}`);
        }
        if (!target && returnFocus.id) target = host.querySelector(`#${CSS.escape(returnFocus.id)}`);
        target?.focus({ preventScroll: true });
      });
    }

    function renderNav(state, modalOpen) {
      const websiteSession = state.surface === 'website' && websiteState;
      const items = [
        ['operations', 'Operations', 'Production overview'],
        ['editor', 'Campaign editor', 'Synthetic first slice'],
        ['assets', 'Asset Library', 'Read-only interaction preview'],
        ['website', 'Website Builder', 'Persistent local projects'],
        ['states', 'States', 'Recovery patterns'],
      ];
      return `<nav class="studio-local-nav" aria-label="Studio workspace"${modalOpen ? ' inert aria-hidden="true"' : ''}>
        <p class="studio-local-nav__eyebrow">Studio workspace</p>
        ${items.map(([id, label, hint]) => `<button type="button" class="studio-local-nav__item${state.surface === id ? ' is-current' : ''}"
          data-action="surface" data-value="${id}" ${state.surface === id ? 'aria-current="page"' : ''}>
          <span>${label}</span><small>${hint}</small>
        </button>`).join('')}
        <div class="studio-session-card">
          <span>Session</span><strong>${websiteSession ? (websiteState.dirty ? 'Unsaved website changes' : 'Website saved locally') : (state.unsaved ? 'Unsaved work' : state.saveState)}</strong>
          <small>${websiteSession ? 'Project-scoped local storage' : 'Synthetic memory only'}</small>
        </div>
      </nav>`;
    }

    function renderProjectHeader(state) {
      const projectItems = projects();
      const selectedId = state.project ? state.project.id : '';
      return `<header class="studio-project-header">
        <div class="studio-project-copy">
          <span class="studio-kicker">Meridian / Connect / Studio</span>
          <h1 id="studio-title" title="${attr(state.project ? state.project.name : 'No project selected')}">${escapeHtml(state.project ? state.project.name : 'Choose a project')}</h1>
          <p>${state.project ? 'Project context remains visible across Studio surfaces.' : 'Select a project from the authenticated Connect list.'}</p>
        </div>
        <div class="studio-project-actions">
          <label for="studio-project-select">Project context</label>
          <select id="studio-project-select" data-action="project" data-focus-key="project-select" aria-describedby="studio-project-help">
            <option value="">Select a project</option>
            ${projectItems.map(project => `<option value="${attr(project.id)}"${project.id === selectedId ? ' selected' : ''}>${escapeHtml(project.name)}</option>`).join('')}
          </select>
          <small id="studio-project-help">Only projects accepted by Connect can be selected.</small>
        </div>
      </header>`;
    }

    function renderNoProject() {
      return `<section class="studio-state studio-state--empty" aria-labelledby="studio-no-project-title">
        <span class="studio-state__code">PROJECT REQUIRED</span>
        <h2 id="studio-no-project-title">Start with an authenticated project.</h2>
        <p>Studio does not create or remember a second project identity. Choose from the Connect project list above.</p>
        <button type="button" class="studio-button studio-button--secondary" data-action="focus-project">Choose project</button>
      </section>`;
    }

    function renderLoading(state) {
      return `<section class="studio-state" aria-labelledby="studio-loading-title" aria-busy="true">
        <span class="studio-loader" aria-hidden="true"></span>
        <h2 id="studio-loading-title">Loading ${escapeHtml(state.project.name)}</h2>
        <p role="status">Preparing a synthetic development workspace. No production service is being called.</p>
      </section>`;
    }

    function renderLoadError(state) {
      return `<section class="studio-state studio-state--error" aria-labelledby="studio-error-title">
        <span class="studio-state__code">ERROR</span>
        <h2 id="studio-error-title">The workspace could not be loaded.</h2>
        <p>${escapeHtml(state.error || 'Synthetic workspace load failed.')}</p>
        <button type="button" class="studio-button studio-button--primary" data-action="retry-load">Retry synthetic load</button>
      </section>`;
    }

    function renderTools(state) {
      const tools = context.snapshot().tools;
      return `<section class="studio-section studio-tools" aria-labelledby="studio-tools-title">
        <div class="studio-section-heading">
          <div><span class="studio-kicker">Capability map</span><h2 id="studio-tools-title">Nine honest entry points</h2></div>
          <p>UI presence never changes provider availability.</p>
        </div>
        <div class="studio-tool-grid">
          ${tools.map(tool => `<article class="studio-tool-card">
            <div><span class="studio-tool-card__mark" aria-hidden="true">${escapeHtml(tool.name.slice(0, 1))}</span>
              <h3>${escapeHtml(tool.name)}</h3></div>
            <span class="studio-pill studio-pill--planned">${tool.id === 'website' ? 'Development' : 'Planned'}</span>
            <p>${escapeHtml(root.MeridianStudioFixtures.TOOL_DETAILS[tool.id])}</p>
            <button type="button" class="studio-text-action" data-action="${tool.id === 'website' ? 'surface' : 'tool-detail'}" data-value="${attr(tool.id)}"
              aria-label="${tool.id === 'website' ? 'Open development Website Builder' : `View planned ${attr(tool.name)} requirements`}">${tool.id === 'website' ? 'Open builder' : 'View requirements'} <span aria-hidden="true">→</span></button>
          </article>`).join('')}
        </div>
      </section>`;
    }

    function renderOperations(state) {
      const data = state.data;
      const campaign = data.campaign;
      const reviewed = data.decisions.find(item => item.id === state.reviewedDecisionId);
      return `<div class="studio-surface" data-surface="operations">
        <section class="studio-campaign" aria-labelledby="studio-campaign-title">
          <div class="studio-campaign__copy">
            <span class="studio-kicker">Active campaign · ${escapeHtml(campaign.status)}</span>
            <h2 id="studio-campaign-title" title="${attr(campaign.name)}">${escapeHtml(campaign.name)}</h2>
            <p>${escapeHtml(campaign.brief)}</p>
            <button type="button" class="studio-button studio-button--primary" data-action="continue-campaign">Continue campaign editor</button>
          </div>
          <div class="studio-progress" aria-label="Campaign assembly ${campaign.progress} percent complete">
            <div class="studio-progress__ring" style="--progress:${campaign.progress * 3.6}deg"><strong>${campaign.progress}%</strong><span>assembly</span></div>
            <dl>
              <div><dt>Scenes</dt><dd>${campaign.scenes}</dd></div>
              <div><dt>Assets</dt><dd>${campaign.assets}</dd></div>
              <div><dt>Decisions</dt><dd>${campaign.decisions}</dd></div>
            </dl>
          </div>
        </section>

        <div class="studio-operations-grid">
          <section class="studio-section" aria-labelledby="studio-production-title">
            <div class="studio-section-heading"><div><span class="studio-kicker">Production board</span><h2 id="studio-production-title">Work that changes the next action</h2></div></div>
            <div class="studio-production-list">
              ${data.scenes.map(scene => `<article class="studio-production-item">
                <div><span class="studio-pill studio-pill--${statusClass(scene.status)}">${escapeHtml(scene.status)}</span><h3 title="${attr(scene.name)}">${escapeHtml(scene.name)}</h3><p>${escapeHtml(scene.note)}</p></div>
                <button type="button" class="studio-text-action" data-action="scene" data-value="${attr(scene.id)}" aria-label="Open ${attr(scene.name)} in campaign editor">Open scene <span aria-hidden="true">→</span></button>
              </article>`).join('')}
            </div>
          </section>

          <section class="studio-section" aria-labelledby="studio-assets-preview-title">
            <div class="studio-section-heading"><div><span class="studio-kicker">Recent assets</span><h2 id="studio-assets-preview-title">Project material</h2></div>
              <button type="button" class="studio-text-action" data-action="surface" data-value="assets" aria-label="View all ${campaign.assets} project assets">View all ${campaign.assets}</button></div>
            <div class="studio-asset-preview-grid">
              ${data.assets.slice(0, 4).map(asset => `<article class="studio-asset-preview">
                <div class="studio-asset-art studio-asset-art--${attr(asset.tone)}" role="img" aria-label="Abstract synthetic preview for ${attr(asset.name)}"><span aria-hidden="true">${escapeHtml(asset.version)}</span></div>
                <h3 title="${attr(asset.name)}">${escapeHtml(asset.name)}</h3><p>${escapeHtml(asset.type)} · ${escapeHtml(asset.status)}</p>
              </article>`).join('')}
            </div>
          </section>
        </div>

        <section class="studio-section studio-decisions" aria-labelledby="studio-decisions-title">
          <div class="studio-section-heading"><div><span class="studio-kicker">Decision queue</span><h2 id="studio-decisions-title">Human choices stay visible</h2></div><p>Opening a decision is not approval.</p></div>
          <div class="studio-decision-grid">
            ${data.decisions.map(decision => `<article class="studio-decision">
              <span class="studio-pill studio-pill--${statusClass(decision.state)}">${escapeHtml(decision.state)}</span>
              <h3>${escapeHtml(decision.title)}</h3><p>${escapeHtml(decision.reason)}</p><small>${escapeHtml(decision.owner)}</small>
              <button type="button" class="studio-button studio-button--secondary" data-action="decision" data-value="${attr(decision.id)}" aria-label="Review ${attr(decision.title)}">Review ${escapeHtml(decision.title)}</button>
            </article>`).join('')}
          </div>
          ${reviewed ? `<div class="studio-review-panel" role="region" aria-labelledby="studio-review-title">
            <div><span class="studio-kicker">Development-only review</span><h3 id="studio-review-title">${escapeHtml(reviewed.title)}</h3><p>${escapeHtml(reviewed.reason)} This outcome remains in synthetic memory only.</p></div>
            <div><button type="button" class="studio-button studio-button--secondary" data-action="resolve-decision" data-value="Changes requested">Request changes</button>
            <button type="button" class="studio-button studio-button--primary" data-action="resolve-decision" data-value="Approved">Record synthetic approval</button></div>
          </div>` : ''}
        </section>
        ${renderTools(state)}
      </div>`;
    }

    function renderEditor(state) {
      const data = state.data;
      const selected = data.scenes.find(item => item.id === state.selectedSceneId);
      return `<div class="studio-surface" data-surface="editor">
        <section class="studio-editor-heading" aria-labelledby="studio-editor-title">
          <div><span class="studio-kicker">Synthetic campaign editor · development only</span><h2 id="studio-editor-title">Build the story, keep the state honest.</h2><p>No storyboard, provider, asset, or persistence service is connected.</p></div>
          <div class="studio-save-cluster">
            <span class="studio-pill studio-pill--${statusClass(state.saveState)}">${escapeHtml(state.saveState)}</span>
            <button type="button" class="studio-button studio-button--secondary" data-action="submit-review">Submit for review</button>
            <button type="button" class="studio-button studio-button--primary" data-action="save" ${!state.unsaved || state.saveState === 'Saving' ? 'disabled' : ''}>Save synthetic draft</button>
          </div>
        </section>
        <div class="studio-editor-grid">
          <aside class="studio-scene-rail" aria-label="Campaign scenes">
            <h3>Scenes</h3>
            ${data.scenes.map(scene => `<button type="button" data-action="scene" data-value="${attr(scene.id)}" class="studio-scene${scene.id === state.selectedSceneId ? ' is-current' : ''}" ${scene.id === state.selectedSceneId ? 'aria-current="true"' : ''}>
              <span title="${attr(scene.name)}">${escapeHtml(scene.name)}</span><small>${escapeHtml(scene.duration)} · ${escapeHtml(scene.status)}</small></button>`).join('')}
          </aside>
          <form class="studio-editor-form" data-form="editor">
            <div class="studio-field"><label for="studio-scene-title">Scene title</label><input id="studio-scene-title" name="title" value="${attr(state.editor.title)}" maxlength="200" data-editor-field="title" data-focus-key="editor-title"></div>
            <div class="studio-field"><label for="studio-scene-format">Output frame</label><select id="studio-scene-format" name="format" data-editor-field="format" data-focus-key="editor-format">
              ${['16:9 landscape', '9:16 vertical', '1:1 square'].map(format => `<option${format === state.editor.format ? ' selected' : ''}>${format}</option>`).join('')}</select></div>
            <div class="studio-field studio-field--wide"><label for="studio-scene-notes">Creative direction</label><textarea id="studio-scene-notes" name="notes" rows="9" data-editor-field="notes" data-focus-key="editor-notes">${escapeHtml(state.editor.notes)}</textarea><small>Describe the scene in plain language. Synthetic memory only.</small></div>
          </form>
          <section class="studio-editor-preview" aria-labelledby="studio-preview-title">
            <div class="studio-preview-art" role="img" aria-label="Synthetic navy and blue ridgeline frame representing ${attr(selected ? selected.name : state.editor.title)}">
              <span>Development preview</span><strong>${escapeHtml(selected ? selected.duration : '00:00')}</strong>
            </div>
            <div><span class="studio-kicker">Current frame</span><h3 id="studio-preview-title" title="${attr(state.editor.title)}">${escapeHtml(state.editor.title)}</h3><p>${escapeHtml(state.editor.format)} · ${escapeHtml(state.saveState)}</p></div>
            ${state.selectedAssetId ? '<p class="studio-inline-note">A synthetic asset is staged in this scene. Save the draft to keep the local change.</p>' : ''}
          </section>
        </div>
        ${state.saveState === 'Error' ? `<div class="studio-inline-error" role="alert"><div><strong>Save failed.</strong><p>${escapeHtml(state.error)} Your edits remain in this window.</p></div><button type="button" class="studio-button studio-button--primary" data-action="save">Retry save</button></div>` : ''}
      </div>`;
    }

    function renderAssets(state) {
      const assets = workspace.filteredAssets();
      const filters = ['all', 'Original', 'Derivative', 'Needs review', 'Approved'];
      return `<div class="studio-surface" data-surface="assets">
        <section class="studio-editor-heading" aria-labelledby="studio-library-title"><div><span class="studio-kicker">Interaction preview · read only</span><h2 id="studio-library-title">Asset Library</h2><p>Cassy's writable Asset Library is deliberately not mounted. These synthetic cards demonstrate selection, filtering, lineage, and placement language only.</p></div></section>
        <section class="studio-asset-controls" aria-label="Asset filters">
          <div class="studio-field"><label for="studio-asset-search">Search project assets</label><input id="studio-asset-search" type="search" value="${attr(state.assetQuery)}" placeholder="Search name, type, or state" data-action="asset-query" data-focus-key="asset-search"></div>
          <div class="studio-filter-group" aria-label="Filter assets">
            ${filters.map(filter => `<button type="button" data-action="asset-filter" data-value="${attr(filter)}" aria-pressed="${state.assetFilter === filter}" class="studio-filter${state.assetFilter === filter ? ' is-active' : ''}">${filter === 'all' ? 'All assets' : escapeHtml(filter)}</button>`).join('')}
          </div>
        </section>
        <div class="studio-library-layout">
          <section aria-labelledby="studio-results-title"><h3 id="studio-results-title" class="studio-results-title" role="status" aria-live="polite" aria-atomic="true">${assets.length} synthetic result${assets.length === 1 ? '' : 's'}</h3>
            ${assets.length ? `<div class="studio-library-grid">${assets.map(asset => `<button type="button" class="studio-library-card${asset.id === state.selectedAssetId ? ' is-selected' : ''}" data-action="asset-select" data-value="${attr(asset.id)}" aria-pressed="${asset.id === state.selectedAssetId}" aria-label="Select ${attr(asset.name)}, ${attr(asset.type)}, ${attr(asset.status)}">
              <span class="studio-asset-art studio-asset-art--${attr(asset.tone)}" role="img" aria-label="Abstract synthetic preview for ${attr(asset.name)}"><i>${escapeHtml(asset.version)}</i></span>
              <span class="studio-library-card__copy"><strong title="${attr(asset.name)}">${escapeHtml(asset.name)}</strong><small>${escapeHtml(asset.type)} · ${escapeHtml(asset.status)}</small>${asset.parent ? `<small>Source: ${escapeHtml(asset.parent)}</small>` : ''}</span>
            </button>`).join('')}</div>` : `<div class="studio-state studio-state--compact"><h3>No matching synthetic assets.</h3><p>Clear the search or choose another filter.</p><button type="button" class="studio-button studio-button--secondary" data-action="clear-assets">Clear filters</button></div>`}
          </section>
          <aside class="studio-selection-panel" aria-labelledby="studio-selection-title"><span class="studio-kicker">Selection</span><h3 id="studio-selection-title">${state.selectedAssetId ? 'Ready to place' : 'Choose an asset'}</h3>
            <p>${state.selectedAssetId ? 'Selection is separate from placement. Placing adds an unsaved synthetic editor change.' : 'Select a project-scoped card to inspect the next action.'}</p>
            <button type="button" class="studio-button studio-button--primary" data-action="asset-place" ${state.selectedAssetId ? '' : 'disabled'}>Place selected asset in scene</button>
            <small>Originals are never overwritten. Derivatives retain visible source identity.</small>
          </aside>
        </div>
      </div>`;
    }

    function renderStates() {
      const cards = [
        ['Empty', 'No scenes yet', 'Create a development-only draft without implying service persistence.', 'Create synthetic draft', 'create-draft'],
        ['Loading', 'Work remains in context', 'Run a visible text-based loading state with motion treated as optional.', 'Simulate reload', 'retry-load'],
        ['Error', 'Recovery stays close', 'Exercise the failure and retry path while preserving project scope.', 'Simulate load error', 'simulate-load-error'],
        ['Unsaved', 'Leave decisions are explicit', 'Open the editor and create a local change to test Keep editing, Discard, and Save.', 'Create unsaved change', 'create-draft'],
      ];
      return `<div class="studio-surface" data-surface="states"><section class="studio-editor-heading"><div><span class="studio-kicker">Operational states</span><h2>Actionable under pressure.</h2><p>Each state includes a recovery action and truthful development-only language.</p></div></section>
        <div class="studio-state-grid">${cards.map(([code, title, copy, action, id]) => `<article class="studio-state-card"><span class="studio-state__code">${code}</span><h3>${title}</h3><p>${copy}</p><button type="button" class="studio-button studio-button--secondary" data-action="${id}">${action}</button></article>`).join('')}</div>
        <section class="studio-section"><div class="studio-section-heading"><div><span class="studio-kicker">Save recovery</span><h2>Failed saves preserve local work.</h2></div></div><p>Open the campaign editor, create a local edit, and trigger a deterministic synthetic save failure.</p><button type="button" class="studio-button studio-button--secondary" data-action="simulate-save-error">Simulate failed save</button></section>
      </div>`;
    }

    function renderWebsite() {
      const state = websiteState;
      if (!state || state.phase === 'no-context') return renderNoProject();
      if (state.phase !== 'editing' || !state.project) {
        return `<div class="studio-surface website-builder" data-surface="website">
          <section class="studio-editor-heading" aria-labelledby="website-builder-title"><div><span class="studio-kicker">Website Builder · local development capability</span><h2 id="website-builder-title">Create or reopen a website project.</h2><p>Projects are isolated to the selected Meridian project and saved in persistent application storage with a recovery copy.</p></div></section>
          <section class="studio-section"><div class="website-create"><div class="studio-field"><label for="website-new-name">Website project name</label><input id="website-new-name" maxlength="160" placeholder="Example: Summit Roofing website" data-focus-key="website-new-name"></div><button type="button" class="studio-button studio-button--primary" data-action="website-create">Create website project</button></div></section>
          <section class="studio-section" aria-labelledby="website-saved-title"><div class="studio-section-heading"><div><span class="studio-kicker">Saved locally</span><h2 id="website-saved-title">Reopen work</h2></div><p>${state.projects.length} saved project${state.projects.length === 1 ? '' : 's'}</p></div>
            ${state.projects.length ? `<div class="website-project-list">${state.projects.map(project => `<article><div><h3>${escapeHtml(project.name)}</h3><p>${project.pageCount} page${project.pageCount === 1 ? '' : 's'} · Updated ${escapeHtml(new Date(project.updatedAt).toLocaleString())}</p></div><button type="button" class="studio-button studio-button--secondary" data-action="website-open" data-value="${attr(project.id)}">Open project</button></article>`).join('')}</div>` : '<p>No website projects have been saved for this Meridian project.</p>'}
          </section></div>`;
      }

      const project = state.project;
      const page = project.pages.find(item => item.id === state.selectedPageId) || project.pages[0];
      return `<div class="studio-surface website-builder" data-surface="website">
        <section class="studio-editor-heading" aria-labelledby="website-builder-title"><div><span class="studio-kicker">Website Builder · ${state.dirty ? 'Unsaved changes' : 'Saved locally'}</span><h2 id="website-builder-title">${escapeHtml(project.name)}</h2><p>Brief, sitemap, content, preview, recovery, and HTML output share one project model.</p></div><div class="studio-save-cluster"><button type="button" class="studio-button studio-button--secondary" data-action="website-undo">Undo</button><button type="button" class="studio-button studio-button--secondary" data-action="website-redo">Redo</button><button type="button" class="studio-button studio-button--primary" data-action="website-save" ${state.dirty ? '' : 'disabled'}>Save project</button></div></section>
        ${state.error ? `<div class="studio-inline-error" role="alert"><div><strong>Website save or recovery failed.</strong><p>${escapeHtml(state.error)}</p></div></div>` : ''}
        <div class="website-builder-grid">
          <aside class="website-panel" aria-labelledby="website-brief-title"><span class="studio-kicker">Strategy</span><h3 id="website-brief-title">Client brief</h3>${['audience', 'goal', 'tone', 'offer'].map(field => `<div class="studio-field"><label for="website-brief-${field}">${field[0].toUpperCase()}${field.slice(1)}</label><textarea id="website-brief-${field}" rows="3" data-website-brief="${field}" data-focus-key="website-brief-${field}">${escapeHtml(project.brief[field])}</textarea></div>`).join('')}</aside>
          <section class="website-panel" aria-labelledby="website-sitemap-title"><span class="studio-kicker">Structure</span><h3 id="website-sitemap-title">Sitemap</h3><div class="website-page-list">${project.pages.map(item => `<button type="button" class="website-page${item.id === page.id ? ' is-current' : ''}" data-action="website-page" data-value="${attr(item.id)}" ${item.id === page.id ? 'aria-current="page"' : ''}><span>${escapeHtml(item.title)}</span><small>/${escapeHtml(item.slug)}</small></button>`).join('')}</div><div class="website-add-row"><label class="studio-field"><span>New page title</span><input id="website-page-name" maxlength="120" placeholder="Services"></label><button type="button" class="studio-button studio-button--secondary" data-action="website-add-page">Add page</button></div></section>
          <section class="website-panel website-page-editor" aria-labelledby="website-page-editor-title"><div class="studio-section-heading"><div><span class="studio-kicker">Page construction</span><h3 id="website-page-editor-title">Edit ${escapeHtml(page.title)}</h3></div><button type="button" class="studio-button studio-button--secondary" data-action="website-add-section">Add section</button></div>
            <div class="website-page-settings"><div class="studio-field"><label for="website-page-title">Page title</label><input id="website-page-title" value="${attr(page.title)}" data-website-page="title" data-focus-key="website-page-title"></div><div class="studio-field"><label for="website-page-slug">URL slug</label><input id="website-page-slug" value="${attr(page.slug)}" data-website-page="slug" data-focus-key="website-page-slug"></div></div>
            <div class="website-section-list">${page.sections.map((section, index) => `<article class="website-section-card"><div><span class="studio-pill">${escapeHtml(section.type)}</span><strong>Section ${index + 1}</strong></div><div class="studio-field"><label for="website-${section.id}-heading">Heading</label><input id="website-${section.id}-heading" value="${attr(section.heading)}" data-website-section="${attr(section.id)}" data-field="heading" data-focus-key="website-${attr(section.id)}-heading"></div><div class="studio-field"><label for="website-${section.id}-body">Body</label><textarea id="website-${section.id}-body" rows="4" data-website-section="${attr(section.id)}" data-field="body" data-focus-key="website-${attr(section.id)}-body">${escapeHtml(section.body)}</textarea></div><div class="studio-field"><label for="website-${section.id}-action">Action label</label><input id="website-${section.id}-action" value="${attr(section.action)}" data-website-section="${attr(section.id)}" data-field="action" data-focus-key="website-${attr(section.id)}-action"></div></article>`).join('')}</div>
          </section>
          <section class="website-panel website-preview" aria-labelledby="website-preview-title"><div class="studio-section-heading"><div><span class="studio-kicker">Actual project output</span><h3 id="website-preview-title">Responsive preview</h3></div><button type="button" class="studio-button studio-button--secondary" data-action="website-export">Download ${escapeHtml(page.slug || 'index')}.html</button></div><iframe title="Preview of ${attr(page.title)}" sandbox="" srcdoc="${attr(website.preview())}"></iframe></section>
        </div></div>`;
    }

    function renderToolDialog(state) {
      if (!state.toolDetailId) return '';
      const tool = context.snapshot().tools.find(item => item.id === state.toolDetailId);
      if (!tool) return '';
      return `<div class="studio-modal-backdrop" role="presentation"><section class="studio-modal" role="dialog" aria-modal="true" aria-labelledby="studio-tool-dialog-title">
        <span class="studio-pill studio-pill--planned">Planned</span><h2 id="studio-tool-dialog-title">${escapeHtml(tool.name)}</h2>
        <p>${escapeHtml(root.MeridianStudioFixtures.TOOL_DETAILS[tool.id])}</p><p>No provider, executable, endpoint, or paid action is available from this UI.</p>
        <button type="button" class="studio-button studio-button--primary" data-action="close-tool" data-autofocus>Close requirements</button>
      </section></div>`;
    }

    function renderLeaveDialog() {
      if (!pendingLeave) return '';
      const websiteLeave = pendingLeave.scope === 'website';
      return `<div class="studio-modal-backdrop" role="presentation"><section class="studio-modal" role="dialog" aria-modal="true" aria-labelledby="studio-leave-title" aria-describedby="studio-leave-copy">
        <span class="studio-pill studio-pill--unsaved">Unsaved</span><h2 id="studio-leave-title">Keep these ${websiteLeave ? 'website changes' : 'synthetic draft changes'}?</h2>
        <p id="studio-leave-copy">You are about to ${escapeHtml(pendingLeave.reason)}. Choose what happens to the unsaved ${websiteLeave ? 'local website project' : 'development-only'} changes.</p>
        <div class="studio-modal__actions"><button type="button" class="studio-button studio-button--secondary" data-action="keep-editing" data-autofocus>Keep editing</button>
          <button type="button" class="studio-button studio-button--secondary" data-action="discard-leave">Discard and continue</button>
          <button type="button" class="studio-button studio-button--primary" data-action="save-leave">Save then continue</button></div>
      </section></div>`;
    }

    function render() {
      if (!viewState || !host) return;
      const activeElement = host.contains(document.activeElement) ? document.activeElement : null;
      const focused = activeElement && activeElement.dataset ? activeElement.dataset.focusKey : null;
      const selection = activeElement && typeof activeElement.selectionStart === 'number' ? {
        start: activeElement.selectionStart,
        end: activeElement.selectionEnd,
        direction: activeElement.selectionDirection,
      } : null;
      let content;
      if (!viewState.project) content = renderNoProject();
      else if (viewState.phase === 'loading') content = renderLoading(viewState);
      else if (viewState.phase === 'error') content = renderLoadError(viewState);
      else if (!viewState.data) content = renderNoProject();
      else if (viewState.surface === 'editor') content = renderEditor(viewState);
      else if (viewState.surface === 'assets') content = renderAssets(viewState);
      else if (viewState.surface === 'website') content = renderWebsite();
      else if (viewState.surface === 'states') content = renderStates(viewState);
      else content = renderOperations(viewState);

      const modalOpen = Boolean(pendingLeave || viewState.toolDetailId);

      host.innerHTML = `<div class="studio-shell" aria-labelledby="studio-title">
        ${renderNav(viewState, modalOpen)}
        <div class="studio-workspace"${modalOpen ? ' inert aria-hidden="true"' : ''}><div class="studio-dev-banner"><strong>Synthetic development build</strong><span>No production services, customer data, or employee-runtime comparison.</span></div>
          ${renderProjectHeader(viewState)}
          <div class="studio-live-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(viewState.statusMessage)}</div>
          <main class="studio-main" id="studio-main" tabindex="-1">${content}</main>
        </div>${pendingLeave ? renderLeaveDialog() : renderToolDialog(viewState)}</div>`;
      host.hidden = !active;
      restoreFocus(focused, selection);
      if (pendingLeave || viewState.toolDetailId) {
        clearTimeout(announcementTimer);
        announcementTimer = setTimeout(() => host.querySelector('[data-autofocus]')?.focus(), 0);
      }
    }

    host.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button || !host.contains(button)) return;
      const action = button.dataset.action;
      const value = button.dataset.value;
      if (action === 'surface') workspace.openSurface(value);
      else if (action === 'focus-project') host.querySelector('#studio-project-select')?.focus();
      else if (action === 'retry-load') workspace.retryLoad();
      else if (action === 'continue-campaign') workspace.selectScene(viewState.data.scenes[0].id);
      else if (action === 'scene') workspace.selectScene(value);
      else if (action === 'save') await workspace.saveDraft();
      else if (action === 'submit-review') workspace.submitForReview();
      else if (action === 'asset-filter') workspace.setAssetFilter(value);
      else if (action === 'asset-select') workspace.selectAsset(value);
      else if (action === 'asset-place') workspace.placeSelectedAsset();
      else if (action === 'clear-assets') { workspace.setAssetFilter('all'); workspace.setAssetQuery(''); }
      else if (action === 'decision') workspace.openDecision(value);
      else if (action === 'resolve-decision') workspace.resolveDecision(value);
      else if (action === 'tool-detail') { rememberDialogReturnFocus(button); workspace.showToolDetail(value); }
      else if (action === 'close-tool') { workspace.closeToolDetail(); restoreDialogReturnFocus(); }
      else if (action === 'create-draft') workspace.createEmptyDraft();
      else if (action === 'simulate-load-error') workspace.simulateLoadFailure();
      else if (action === 'simulate-save-error') { workspace.openSurface('editor'); await workspace.simulateSaveFailure(); }
      else if (action === 'website-create') {
        const input = host.querySelector('#website-new-name');
        website.createProject(input && input.value.trim() ? input.value.trim() : 'Untitled website');
      }
      else if (action === 'website-open') website.openProject(value);
      else if (action === 'website-page') website.selectPage(value);
      else if (action === 'website-add-page') {
        const input = host.querySelector('#website-page-name');
        website.addPage(input && input.value.trim() ? input.value.trim() : 'New page');
      }
      else if (action === 'website-add-section') website.addSection('content');
      else if (action === 'website-save') website.save();
      else if (action === 'website-undo') website.undo();
      else if (action === 'website-redo') website.redo();
      else if (action === 'website-export') {
        const bundle = website.exportSite();
        const page = website.snapshot().project.pages.find(item => item.id === website.snapshot().selectedPageId) || website.snapshot().project.pages[0];
        const filename = page.slug ? `${page.slug}.html` : 'index.html';
        const blob = new Blob([bundle.files[filename]], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = filename; link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
      }
      else if (action === 'keep-editing') { pendingLeave = null; render(); restoreDialogReturnFocus(); }
      else if (action === 'discard-leave') {
        const callback = pendingLeave && pendingLeave.callback;
        const scope = pendingLeave && pendingLeave.scope;
        pendingLeave = null;
        dialogReturnFocus = null;
        if (scope === 'website') website.discard();
        else workspace.discardChanges();
        if (callback) callback();
      } else if (action === 'save-leave') {
        const callback = pendingLeave && pendingLeave.callback;
        const scope = pendingLeave && pendingLeave.scope;
        const saved = scope === 'website' ? website.save() : await workspace.saveDraft();
        if (saved) { pendingLeave = null; dialogReturnFocus = null; if (callback) callback(); }
      }
    });

    host.addEventListener('change', event => {
      const control = event.target;
      if (control.dataset.action === 'project' && control.value && typeof onProjectSelect === 'function') onProjectSelect(control.value);
      if (control.dataset.editorField) workspace.updateEditor(control.dataset.editorField, control.value);
      if (control.dataset.websiteBrief) website.updateBrief(control.dataset.websiteBrief, control.value);
      if (control.dataset.websitePage) website.updatePage(control.dataset.websitePage, control.value);
      if (control.dataset.websiteSection) website.updateSection(control.dataset.websiteSection, control.dataset.field, control.value);
    });

    host.addEventListener('input', event => {
      const control = event.target;
      if (control.dataset.editorField) workspace.updateEditor(control.dataset.editorField, control.value);
      if (control.dataset.action === 'asset-query') workspace.setAssetQuery(control.value);
      if (control.dataset.websiteBrief) website.updateBrief(control.dataset.websiteBrief, control.value);
      if (control.dataset.websitePage) website.updatePage(control.dataset.websitePage, control.value);
      if (control.dataset.websiteSection) website.updateSection(control.dataset.websiteSection, control.dataset.field, control.value);
    });

    host.addEventListener('keydown', event => {
      const modal = host.querySelector('.studio-modal');
      if (!modal) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (pendingLeave) { pendingLeave = null; render(); }
        else workspace.closeToolDetail();
        restoreDialogReturnFocus();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    function guardLeave(callback, reason) {
      const websiteDirty = viewState && viewState.surface === 'website' && websiteState && websiteState.dirty;
      if (!viewState || (!viewState.unsaved && !websiteDirty)) return true;
      rememberDialogReturnFocus();
      pendingLeave = { callback, reason: reason || 'leave Studio', scope: websiteDirty ? 'website' : 'studio' };
      render();
      return false;
    }

    function setActive(next) {
      active = Boolean(next);
      host.hidden = !active;
      if (active) {
        render();
        requestAnimationFrame(() => host.querySelector('#studio-main')?.focus({ preventScroll: true }));
      }
    }

    function destroy() {
      clearTimeout(announcementTimer);
      dialogReturnFocus = null;
      workspace.destroy();
      host.replaceChildren();
      currentInstance = null;
    }

    currentInstance = { guardLeave, setActive, destroy, workspace };
    render();
    return currentInstance;
  }

  root.MeridianStudioUI = Object.freeze({
    mount,
    guardLeave(callback, reason) { return currentInstance ? currentInstance.guardLeave(callback, reason) : true; },
    setActive(active) { if (currentInstance) currentInstance.setActive(active); },
    destroy() { if (currentInstance) currentInstance.destroy(); },
  });
})(globalThis);
