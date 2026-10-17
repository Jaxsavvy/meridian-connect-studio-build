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

  function mount({ host, context, getProjects, onProjectSelect, assetMount = null, assetDeps = null }) {
    if (!host || !context || !root.MeridianStudioWorkspace || !root.MeridianStudioFixtures || !root.MeridianWebsiteBuilder) {
      throw new TypeError('Studio shell dependencies are unavailable.');
    }
    if (currentInstance) currentInstance.destroy();

    let active = false;
    let pendingLeave = null;
    let viewState = null;
    let announcementTimer = null;
    let dialogReturnFocus = null;
    let assetTransitionPending = false;
    let executingApprovedTransition = false;
    let assetLifecycle = null;
    let assetContainer = null;
    let renderedLocation = null;
    const adapter = root.MeridianStudioFixtures.createSyntheticAdapter();
    let websiteState = null;
    let websiteContextId = null;
    let websiteStorage;
    let websiteStoragePersistent = false;
    let websiteStep = 'brief';
    let websiteProjectId = null;
    let websiteDevice = 'desktop';
    let checkpointRemovalId = null;
    let dragging = null;
    const websiteSteps = [
      { id: 'brief', label: 'Brief', hint: 'Define the audience and outcome' },
      { id: 'pages', label: 'Pages', hint: 'Organize the site' },
      { id: 'edit', label: 'Edit', hint: 'Shape the selected page' },
      { id: 'preview', label: 'Preview', hint: 'Check pages and download the site' },
    ];
    try {
      websiteStorage = root.localStorage;
      const probe = 'meridian.website.storage.probe';
      websiteStorage.setItem(probe, '1');
      websiteStorage.removeItem(probe);
      websiteStoragePersistent = true;
    } catch (_) {
      websiteStorage = root.MeridianWebsiteBuilder.createMemoryStorage();
    }
    const website = root.MeridianWebsiteBuilder.createController({
      storage: websiteStorage,
      onChange(next) {
        const nextId = next.project && next.project.id;
        if (nextId !== websiteProjectId) {
          websiteProjectId = nextId || null;
          websiteStep = 'brief';
          websiteDevice = 'desktop';
          checkpointRemovalId = null; dragging = null;
        }
        websiteState = next;
        render();
      },
    });
    const workspace = root.MeridianStudioWorkspace.createWorkspace({
      context,
      adapter,
      onChange(next) {
        viewState = next;
        const nextProjectId = next.project && next.project.id;
        if (nextProjectId !== websiteContextId) {
          pendingLeave = null;
          dialogReturnFocus = null;
          websiteContextId = nextProjectId || null;
          website.selectContext(next.project);
        }
        render();
      },
    });

    if (assetMount && assetDeps) {
      assetContainer = document.createElement('div');
      assetContainer.id = 'studio-asset-client';
      assetLifecycle = assetMount.mount({ container: assetContainer, context, deps: assetDeps });
    }

    function continueAfterAssetGuard(callback) {
      if (assetTransitionPending) return;
      if (!assetLifecycle) { if (callback) callback(); return; }
      const lifecycle = assetLifecycle;
      const ticket = context.beginProjectRequest();
      assetTransitionPending = true;
      Promise.resolve().then(() => lifecycle.prepareLeave()).then(allowed => {
        assetTransitionPending = false;
        if (allowed && lifecycle === assetLifecycle && (!ticket || context.isCurrentRequest(ticket))) {
          // A confirmed host transition may re-enter guardLeave synchronously.
          // The approval is valid only for that callback, never a later navigation.
          if (callback) setTimeout(() => {
            if (lifecycle !== assetLifecycle || (ticket && !context.isCurrentRequest(ticket))) return;
            executingApprovedTransition = true;
            try { callback(); } finally { executingApprovedTransition = false; }
          }, 0);
        }
      }).catch(error => {
        assetTransitionPending = false;
        console.error('Studio Asset Library transition failed.', error);
      });
    }

    function projects() {
      // Use only the accepted Connect context list: cached panel data may contain revoked projects.
      const items = context.snapshot().projects;
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
        ['assets', 'Asset Library', assetLifecycle ? 'Writable synthetic development client' : 'Read-only interaction preview'],
        ['website', 'Website Builder', 'Website projects'],
          ['handoff', 'Review & handoff', 'Readiness and service boundaries'],
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
        <section class="studio-section" aria-labelledby="studio-current-work-title">
          <div class="studio-section-heading"><div><span class="studio-kicker">Selected project</span><h2 id="studio-current-work-title">Continue your work</h2></div><p>Website drafts stay on this device. Campaign scenes and assets are synthetic.</p></div>
          <div class="studio-decision-grid">
            <article class="studio-decision"><h3>Website projects</h3><p>${websiteState ? websiteState.projects.length : 0} local website projects in this project.</p><button type="button" class="studio-button studio-button--primary" data-action="surface" data-value="website">${websiteState && websiteState.project ? 'Continue website' : 'Create or reopen website'}</button></article>
            <article class="studio-decision"><h3>Storyboard draft</h3><p>${data.scenes.length} synthetic scenes. Save a scene before copying its content into an open website.</p><button type="button" class="studio-button studio-button--secondary" data-action="continue-campaign">Continue storyboard draft</button></article>
            <article class="studio-decision"><h3>Review readiness</h3><p>${data.decisions.filter(item => item.state === 'Needs review').length} synthetic decisions awaiting a choice.</p><button type="button" class="studio-button studio-button--secondary" data-action="surface" data-value="handoff">Review handoff readiness</button></article>
          </div>
        </section>
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
              <div><dt>Scenes</dt><dd>${data.scenes.length}</dd></div>
              <div><dt>Synthetic assets</dt><dd>${data.assets.length}</dd></div>
              <div><dt>Decisions</dt><dd>${data.decisions.length}</dd></div>
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
              <button type="button" class="studio-text-action" data-action="surface" data-value="assets">Open project Asset Library</button></div>
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
            ${(state.editor.assetIds || []).length ? `<p class="studio-inline-note">${state.unsaved ? 'Synthetic reference placement has unsaved changes.' : 'Synthetic reference placement saved for this session.'}</p>` : ''}
          </section>
        </div>
        ${state.saveState === 'Error' ? `<div class="studio-inline-error" role="alert"><div><strong>Save failed.</strong><p>${escapeHtml(state.error)} Your edits remain in this window.</p></div><button type="button" class="studio-button studio-button--primary" data-action="save">Retry save</button></div>` : ''}
        <section class="studio-section" aria-labelledby="studio-scene-material-title"><div class="studio-section-heading"><div><span class="studio-kicker">Storyboard material · synthetic only</span><h3 id="studio-scene-material-title">Stage a reference, then place it</h3></div><p>These fixture references are separate from the mounted Asset Library. Originals and versions stay unchanged.</p></div>
          <div class="studio-local-actions">${data.assets.map(asset => `<button type="button" class="studio-button studio-button--secondary" data-action="asset-select" data-value="${attr(asset.id)}" aria-pressed="${asset.id === state.selectedAssetId}">${escapeHtml(asset.name)} · ${escapeHtml(asset.version)}</button>`).join('')}</div>
          <p>${(state.editor.assetIds || []).length} synthetic references placed in this scene.</p>
          <button type="button" class="studio-button studio-button--secondary" data-action="asset-place" ${state.selectedAssetId ? '' : 'disabled'}>Place selected synthetic reference</button>
          <button type="button" class="studio-button studio-button--secondary" data-action="scene-to-website" ${websiteState && websiteState.project ? '' : 'disabled'}>Copy scene into open website</button>
          <p>Open or create a website first. This copies scene text into a new local page with its source scene recorded; no media service or live storyboard is connected.</p>
        </section>
      </div>`;
    }

    function renderHandoff(state) {
      return `<section class="studio-surface studio-section" data-surface="handoff" aria-labelledby="studio-handoff-title">
        <span class="studio-kicker">Review &amp; handoff · development only</span><h2 id="studio-handoff-title">Check what is ready to hand over</h2>
        <dl><div><dt>Project</dt><dd>${escapeHtml(state.project.name)}</dd></div><div><dt>Campaign draft</dt><dd>${state.unsaved ? 'Unsaved changes' : escapeHtml(state.saveState)} · synthetic session memory</dd></div><div><dt>Website</dt><dd>${websiteState && websiteState.project ? escapeHtml(websiteState.project.name) + (websiteState.dirty ? ' · Unsaved changes' : websiteStoragePersistent ? ' · Saved locally' : ' · Session only') : 'No website open'}</dd></div></dl>
        ${renderWebsiteReadiness()}
        <h3>Before sending for review</h3><ul><li>Save the local website and synthetic draft.</li><li>Inspect each page in Preview and verify source references.</li><li>Have an authorized reviewer accept the exact revision through the approved service when it is connected.</li></ul>
        <p role="note">Review submission, approval, approved-version export and publishing are unavailable. Reviewer policy and authoritative revision services are not connected. The synthetic decision queue is a UI demonstration.</p>
        <div class="studio-local-actions"><button type="button" class="studio-button studio-button--secondary" disabled>Submit to reviewer — unavailable</button><button type="button" class="studio-button studio-button--secondary" disabled>Approve revision — unavailable</button><button type="button" class="studio-button studio-button--secondary" disabled>Publish website — unavailable</button></div>
        <p>Preview HTML/ZIP downloads remain local drafts, not approved publication.</p><button type="button" class="studio-button studio-button--secondary" data-action="surface" data-value="website">Open website workspace</button>
      </section>`;
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

    function renderDevelopmentJobs(state) {
      if (state.data?.developmentOnly !== true) return '<section class="studio-section"><h3>Job services unavailable</h3><p>No development job fixture is loaded.</p></section>';
      const job = state.developmentJob;
      const view = root.MeridianStudioWorkspace.developmentJobPresentation(job);
      const scenarios = root.MeridianStudioWorkspace.DEVELOPMENT_JOB_SCENARIOS;
      return `<section class="studio-section studio-job-patterns" aria-labelledby="studio-job-pattern-title"><span class="studio-kicker">Development-only recovery patterns</span><h2 id="studio-job-pattern-title">Job and permission recovery</h2><p>No job or provider service is connected. These controls change synthetic state only; they cannot grant project access, spending approval or output rights.</p>
        <div class="website-add-row"><label class="studio-field"><span>Synthetic job scenario</span><select id="studio-job-scenario" data-focus-key="studio-job-scenario">${scenarios.map(scenario => `<option value="${scenario}"${scenario === (job?.scenario || 'running') ? ' selected' : ''}>${escapeHtml(scenario.replaceAll('-',' '))}</option>`).join('')}</select></label><button type="button" class="studio-button studio-button--secondary" data-action="job-scenario-load">Load synthetic scenario</button></div>
        <div class="studio-job-status" data-job-status="${view.status}" data-job-project="${attr(state.project?.id || '')}" data-job-attempt="${job?.attempt || 0}" data-job-request="${attr(job?.requestId || '')}" role="status" aria-live="polite" aria-atomic="true"><h3 id="studio-job-state-title" tabindex="-1">${escapeHtml(view.title)}</h3><p>${escapeHtml(view.detail)}</p>${job ? `<p>Project-scoped fixture · attempt ${job.attempt} of at most 3</p>` : ''}${['queued','running','cancelling','uncertain','completed'].includes(view.status) ? `<progress max="100"${view.progress === null ? '' : ` value="${view.progress}"`} aria-label="${attr(view.title)}"></progress><p>${view.progress === null ? 'No reliable progress estimate.' : `${view.progress}% synthetic progress`}</p>` : ''}</div>
        <div class="website-item-actions" role="group" aria-label="Synthetic job recovery actions">${view.canCancel ? '<button type="button" class="studio-button studio-button--secondary" data-action="job-cancel">Request simulated cancellation</button>' : ''}${view.canConfirmCancel ? '<button type="button" class="studio-button studio-button--secondary" data-action="job-resolve" data-value="cancelled">Confirm simulated cancellation</button><button type="button" class="studio-button studio-button--secondary" data-action="job-resolve" data-value="completed">Simulate completion arriving first</button>' : ''}${view.canReconcile ? '<button type="button" class="studio-button studio-button--secondary" data-action="job-resolve" data-value="not-started">Simulate confirmed not started</button><button type="button" class="studio-button studio-button--secondary" data-action="job-resolve" data-value="completed">Simulate already completed</button>' : ''}<button type="button" class="studio-button studio-button--secondary" data-action="job-retry" ${view.canRetry ? '' : 'disabled'} aria-describedby="studio-job-retry-reason">Retry synthetic job</button><button type="button" class="studio-button studio-button--secondary" disabled aria-describedby="studio-job-output-reason">Service output unavailable</button></div>
        <p id="studio-job-retry-reason">${view.canRetry ? 'A known failed or cancelled fixture can be retried explicitly. No automatic retry.' : escapeHtml(view.retryReason)}</p><p id="studio-job-output-reason">No output asset is created, registered, approved or downloaded by this state exercise.</p></section>`;
    }

    function focusDevelopmentJob() {
      const heading = host.querySelector('#studio-job-state-title');
      heading?.focus({ preventScroll: true });heading?.scrollIntoView({ block: 'start' });
    }

    function renderStates(state) {
      const cards = [
        ['Empty', 'No scenes yet', 'Create a development-only draft without implying service persistence.', 'Create synthetic draft', 'create-draft'],
        ['Loading', 'Work remains in context', 'Run a visible text-based loading state with motion treated as optional.', 'Simulate reload', 'retry-load'],
        ['Error', 'Recovery stays close', 'Exercise the failure and retry path while preserving project scope.', 'Simulate load error', 'simulate-load-error'],
        ['Unsaved', 'Leave decisions are explicit', 'Open the editor and create a local change to test Keep editing, Discard, and Save.', 'Create unsaved change', 'create-draft'],
      ];
      return `<div class="studio-surface" data-surface="states"><section class="studio-editor-heading"><div><span class="studio-kicker">Operational states</span><h2>Actionable under pressure.</h2><p>Each state includes a recovery action and truthful development-only language.</p></div></section>
        ${renderDevelopmentJobs(state)}<div class="studio-state-grid">${cards.map(([code, title, copy, action, id]) => `<article class="studio-state-card"><span class="studio-state__code">${code}</span><h3>${title}</h3><p>${copy}</p><button type="button" class="studio-button studio-button--secondary" data-action="${id}">${action}</button></article>`).join('')}</div>
        <section class="studio-section"><div class="studio-section-heading"><div><span class="studio-kicker">Save recovery</span><h2>Failed saves preserve local work.</h2></div></div><p>Open the campaign editor, create a local edit, and trigger a deterministic synthetic save failure.</p><button type="button" class="studio-button studio-button--secondary" data-action="simulate-save-error">Simulate failed save</button></section>
      </div>`;
    }

    function openWebsiteStep(step) {
      if (!websiteSteps.some(item => item.id === step)) return;
      websiteStep = step;
      render();
      requestAnimationFrame(() => {
        const heading = host.querySelector('[data-website-panel="' + step + '"] h3');
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView({ block: 'start' });
      });
    }

    function renderWebsiteReadiness() {
      const ready = website.readiness();
      return `<section class="website-local-readiness" aria-labelledby="website-readiness-title"><h3 id="website-readiness-title">Local draft checks — not approval</h3>
        ${ready.websiteOpen ? `<ul>${ready.checks.map(check => `<li data-readiness="${check.id}"><strong>${check.passed ? 'Checked' : 'Needs attention'}:</strong> ${escapeHtml(check.label)}</li>`).join('')}</ul>` : '<p>Open a website to check its local draft.</p>'}
        <p>${escapeHtml(ready.limit)}</p></section>`;
    }

    function renderCheckpointRemoval(checkpoint) {
      const id = attr(checkpoint.id);
      return checkpointRemovalId === checkpoint.id ? `<div class="website-checkpoint-confirm" role="group" aria-label="Remove checkpoint ${attr(checkpoint.label)}"><p>Remove “${escapeHtml(checkpoint.label)}” from this device? This cannot be undone. The saved website and current edits stay unchanged.</p><div class="website-item-actions"><button type="button" class="studio-button studio-button--secondary" data-action="website-checkpoint-cancel" data-value="${id}">Keep checkpoint</button><button type="button" class="studio-button studio-button--secondary" data-action="website-checkpoint-confirm" data-value="${id}">Permanently remove checkpoint</button></div></div>` : `<button type="button" class="studio-button studio-button--secondary" data-action="website-checkpoint-remove" data-value="${id}" aria-label="Remove checkpoint ${attr(checkpoint.label)}">Remove checkpoint…</button>`;
    }

    function renderWebsiteCheckpoints(state) {
      return `<section class="website-checkpoints" aria-labelledby="website-checkpoints-title"><h3 id="website-checkpoints-title" tabindex="-1">Saved checkpoints on this device</h3>
        <p>Save the project first. A checkpoint keeps a local draft snapshot, not an approved version. Up to 10 checkpoints are kept; existing ones are never automatically removed. ${websiteStoragePersistent ? 'No team sync or service backup.' : 'Session-only storage: checkpoints will be lost when this window reloads.'}</p>
        <div class="website-add-row"><label class="studio-field"><span>Checkpoint label</span><input id="website-checkpoint-label" maxlength="120" placeholder="Before review" data-focus-key="website-checkpoint-label"></label><button type="button" class="studio-button studio-button--secondary" data-action="website-checkpoint-create" ${state.dirty || state.checkpoints.length >= 10 ? 'disabled' : ''}>Create saved checkpoint</button></div>
        <p>Save or discard current edits before restoring. Restore creates an unsaved draft; Undo reverses it. The saved primary stays unchanged until Save project.</p>
        ${state.checkpoints.length ? `<ol>${state.checkpoints.map(checkpoint => `<li><div><strong>${escapeHtml(checkpoint.label)}</strong><span>Saved revision ${checkpoint.revision} · ${checkpoint.pageCount} pages · ${escapeHtml(checkpoint.createdAt)}</span></div><button type="button" class="studio-button studio-button--secondary" data-action="website-checkpoint-restore" data-value="${attr(checkpoint.id)}" ${state.dirty ? 'disabled' : ''}>Restore ${escapeHtml(checkpoint.label)}</button>${renderCheckpointRemoval(checkpoint)}</li>`).join('')}</ol>` : '<p>No saved checkpoints for this website.</p>'}</section>`;
    }

    function renderWebsiteStyles(project) {
      return `<fieldset class="website-global-styles"><legend>Website-wide style</legend><p>Applies to every page. Check text contrast in preview.</p>
        <div class="studio-field"><label for="website-design-accent">Accent color</label><input type="color" id="website-design-accent" value="${attr(/^#[0-9a-f]{6}$/i.test(project.design?.accent) ? project.design.accent : '#1f6fd6')}" data-website-design="accent" data-focus-key="website-design-accent"></div>
        <div class="studio-field"><label for="website-design-font">Font family</label><select id="website-design-font" data-website-design="font" data-focus-key="website-design-font">${[['system-ui', 'System sans serif'], ['serif', 'Serif'], ['monospace', 'Monospace']].map(([id, label]) => `<option value="${id}"${project.design?.font === id ? ' selected' : ''}>${label}</option>`).join('')}</select></div></fieldset>`;
    }

    function renderWebsitePageActions(project, page) {
      const siblings = project.pages.filter(item => (item.parentPageId || '') === (page.parentPageId || ''));
      const index = siblings.findIndex(item => item.id === page.id);
      const parents = root.MeridianWebsiteBuilder.pageParentOptions(project, page.id);
      return `<div class="website-item-actions" role="group" aria-label="Manage selected page: ${attr(page.title)}">
        <button type="button" class="studio-button studio-button--secondary" data-action="website-move-page-up" data-value="${attr(page.id)}" ${index === 0 ? 'disabled' : ''}>Move page up</button>
        <button type="button" class="studio-button studio-button--secondary" data-action="website-move-page-down" data-value="${attr(page.id)}" ${index === siblings.length - 1 ? 'disabled' : ''}>Move page down</button>
        <button type="button" class="studio-button studio-button--secondary" data-action="website-remove-page" data-value="${attr(page.id)}" ${project.pages.length === 1 || !page.slug ? 'disabled' : ''}>Remove selected page</button></div>
        <p>Move controls reorder pages within the same parent. Removing a parent moves its children up one level. Undo restores the hierarchy; page URLs stay unchanged.</p>
        <label class="studio-field"><span>Navigation parent</span><select id="website-page-parent" data-website-page="parentPageId" data-focus-key="website-page-parent" ${!page.slug ? 'disabled' : ''} aria-describedby="website-page-parent-help"><option value="">Top level</option>${parents.map(parent => `<option value="${attr(parent.id)}"${parent.id === page.parentPageId ? ' selected' : ''}>${escapeHtml(parent.title)} · /${escapeHtml(parent.slug)}</option>`).join('')}</select></label><p id="website-page-parent-help">Up to three levels. The home page stays at the top level. Cycles and moves that would nest descendants too deeply are unavailable.</p>`;
    }

    function renderWebsiteBody(section, index) {
      const id = attr(section.id), formatted = section.bodyFormat === 'formatted';
      return `<div class="studio-field"><label for="website-${id}-body-format">Body style</label><select id="website-${id}-body-format" data-website-section="${id}" data-field="bodyFormat" data-focus-key="website-${id}-body-format"><option value="plain"${formatted ? '' : ' selected'}>Plain text</option><option value="formatted"${formatted ? ' selected' : ''}>Formatted text</option></select></div>
        ${formatted ? `<div class="website-text-tools" role="group" aria-label="Format body in section ${index + 1}">${[['bold','Insert bold'],['italic','Insert italic'],['bullets','Bullet list'],['numbered','Numbered list']].map(([command,label]) => `<button type="button" class="studio-button studio-button--secondary" data-action="website-format-text" data-command="${command}" data-value="${id}" data-focus-key="website-${id}-${command}">${label}</button>`).join('')}</div>` : ''}
        <div class="studio-field"><label for="website-${id}-body">Body</label><textarea id="website-${id}-body" rows="5" maxlength="8000" data-website-section="${id}" data-field="body" data-focus-key="website-${id}-body" aria-describedby="website-${id}-format-help">${escapeHtml(section.body)}</textarea><small id="website-${id}-format-help">${formatted ? 'Select text, then choose a formatting button. **Bold**, *italic*, - bullet items and 1. numbered items appear in preview and downloads. Use blank lines for paragraphs. HTML and links stay plain text.' : 'Plain text keeps formatting markers literal. Choose Formatted text to add emphasis and lists.'} Up to 8,000 characters.</small></div>`;
    }

    function renderWebsiteSectionActions(section, index, length) {
      return `<div class="website-item-actions" role="group" aria-label="Manage section ${index + 1}">
        <button type="button" class="studio-button studio-button--secondary website-drag-handle" draggable="true" data-action="website-drag-help" data-drag-kind="section" data-drag-id="${attr(section.id)}" data-focus-key="drag-section-${attr(section.id)}" aria-label="Drag section ${index + 1}; activate for keyboard move controls" aria-describedby="website-section-drag-help">Drag section</button>
        <button type="button" class="studio-button studio-button--secondary" data-action="website-move-section-up" data-value="${attr(section.id)}" ${index === 0 ? 'disabled' : ''}>Move up</button>
        <button type="button" class="studio-button studio-button--secondary" data-action="website-move-section-down" data-value="${attr(section.id)}" ${index === length - 1 ? 'disabled' : ''}>Move down</button>
        <button type="button" class="studio-button studio-button--secondary" data-action="website-remove-section" data-value="${attr(section.id)}">Remove section</button><button type="button" class="studio-button studio-button--secondary" data-action="${section.sharedId ? 'website-detach-shared' : 'website-make-shared'}" data-value="${attr(section.id)}">${section.sharedId ? 'Detach shared copy' : 'Make section shared'}</button></div>`;
    }

    function renderSharedSectionLibrary(project) {
      const groups = root.MeridianWebsiteBuilder.sharedSections(project);
      return `<section class="website-shared-library" aria-labelledby="website-shared-title"><h4 id="website-shared-title">Shared sections</h4><p>Make a section shared to reuse it on other pages. Content edits update every linked copy in this website. Detach a copy to edit it independently.</p><div class="website-add-row"><label class="studio-field"><span>Shared section</span><select id="website-shared-section" ${groups.length ? '' : 'disabled'}>${groups.length ? groups.map(group => `<option value="${attr(group.id)}">${escapeHtml(group.label)} · ${group.copies} linked ${group.copies === 1 ? 'copy' : 'copies'}</option>`).join('') : '<option value="">No shared sections yet</option>'}</select></label><button type="button" class="studio-button studio-button--secondary" data-action="website-add-shared" ${groups.length ? '' : 'disabled'}>Insert linked section</button></div></section>`;
    }

    function renderWebsitePreviewSelector(project, page) {
      return `<p>Local draft output, not an approved release. ZIP contains all pages with relative navigation. Inside preview, navigation is display only; choose a page below.</p>
        <label class="studio-field"><span>Preview page</span><select id="website-preview-page" data-website-preview-page data-focus-key="website-preview-page">${project.pages.map(item => `<option value="${attr(item.id)}"${item.id === page.id ? ' selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></label>`;
    }

    function renderWebsite() {
      const state = websiteState;
      if (!state || state.phase === 'no-context') return renderNoProject();
      if (state.phase !== 'editing' || !state.project) {
        return `<div class="studio-surface website-builder" data-surface="website">
          <section class="studio-editor-heading" aria-labelledby="website-builder-title"><div><span class="studio-kicker">Website Builder · local development capability</span><h2 id="website-builder-title">Create or reopen a website project.</h2><p>${websiteStoragePersistent ? 'Websites are saved in this app on this device, with a recovery copy. Team sync is not connected.' : 'Storage is unavailable. Websites are session only and will be lost when this window reloads.'}</p></div></section>
          ${state.error ? `<p class="studio-inline-error" role="alert">${escapeHtml(state.error)}. Try again when local storage is available.</p>` : ''}
          <section class="studio-section"><div class="website-create"><div class="studio-field"><label for="website-new-name">Website project name</label><input id="website-new-name" maxlength="160" placeholder="Example: Summit Roofing website" data-focus-key="website-new-name"></div><button type="button" class="studio-button studio-button--primary" data-action="website-create">Create website project</button></div></section>
          <section class="studio-section" aria-labelledby="website-saved-title"><div class="studio-section-heading"><div><span class="studio-kicker">${websiteStoragePersistent ? 'Saved in this app' : 'Session only'}</span><h2 id="website-saved-title">Reopen work</h2></div><p>${state.projects.length} saved project${state.projects.length === 1 ? '' : 's'}</p></div>
            ${state.projects.length ? `<div class="website-project-list">${state.projects.map(project => `<article><div><h3>${escapeHtml(project.name)}</h3><p>${project.pageCount} page${project.pageCount === 1 ? '' : 's'} · Updated ${escapeHtml(new Date(project.updatedAt).toLocaleString())}</p></div><button type="button" class="studio-button studio-button--secondary" data-action="website-open" data-value="${attr(project.id)}">Open project</button></article>`).join('')}</div>` : state.unavailableProjects?.length ? '<p>No readable website projects were found. Saved records needing recovery are listed below.</p>' : '<p>No website projects have been saved for this Meridian project.</p>'}
          ${state.unavailableProjects?.length ? `<section class="studio-inline-error" aria-labelledby="website-recovery-title"><div><h3 id="website-recovery-title" tabindex="-1">Saved websites need recovery</h3><p>${state.unavailableProjects.length} local website record${state.unavailableProjects.length === 1 ? '' : 's'} could not be opened. The saved records have been kept. Retrying checks the same saved copies; it does not replace them with a new website.</p>${state.unavailableProjects.map((item, index) => `<button type="button" class="studio-button studio-button--secondary" data-action="website-open" data-value="${attr(item.id)}" aria-label="Retry recovery for saved website ${index + 1}">Retry recovery ${index + 1}</button>`).join('')}</div></section>` : ''}
          </section></div>`;
      }

      const project = state.project;
      const stepIndex = websiteSteps.findIndex(item => item.id === websiteStep);
      const step = websiteSteps[stepIndex];
      const saveLabel = state.error ? 'Action needs attention' : state.dirty ? 'Unsaved changes' : websiteStoragePersistent ? 'Saved in this app' : 'Session only';
      const saveHelp = state.error ? 'Your current edits remain here. Review the action message and try again.' : websiteStoragePersistent ? 'Local to this app on this device. Team sync is not connected.' : 'Storage is unavailable. Keep this window open; session changes will be lost on reload.';

      const page = project.pages.find(item => item.id === state.selectedPageId) || project.pages[0];
      return `<div class="studio-surface website-builder" data-surface="website">
        <section class="studio-editor-heading" aria-labelledby="website-builder-title"><div><span class="studio-kicker">Website Builder</span><h2 id="website-builder-title">${escapeHtml(project.name)}</h2><p>One website, four focused steps. Return to any step without losing your current edits.</p></div><div class="studio-save-cluster"><button type="button" class="studio-button studio-button--secondary" data-action="website-list">All websites</button><button type="button" class="studio-button studio-button--secondary" data-action="website-undo">Undo</button><button type="button" class="studio-button studio-button--secondary" data-action="website-redo">Redo</button><button type="button" class="studio-button studio-button--secondary" data-action="website-save-copy" title="Save your current edits as a new website on this device">Save separate copy</button><button type="button" class="studio-button studio-button--primary" data-action="website-save" ${state.dirty ? '' : 'disabled'}>Save project</button></div></section>
        ${state.error ? `<div class="studio-inline-error" role="alert"><div><strong>Website action needs attention.</strong><p>${escapeHtml(state.error)}</p></div></div>` : ''}
        <div class="website-flow-status" role="status" aria-live="polite" tabindex="-1"><strong class="website-save-state${state.dirty ? ' is-dirty' : ''}">${escapeHtml(saveLabel)}</strong><span>${escapeHtml(saveHelp)}</span><span>${escapeHtml(state.status)}</span></div>
        <nav class="website-flow-nav" aria-label="Website workflow">
          ${websiteSteps.map((item, index) => `<button type="button" data-action="website-step" data-value="${item.id}" ${item.id === websiteStep ? 'aria-current="step"' : ''}><span class="website-flow-number" aria-hidden="true">${index + 1}</span><span><strong>${item.label}</strong><small>${item.hint}</small></span></button>`).join('')}
        </nav>
        <div class="website-step-heading"><span class="studio-kicker">Step ${stepIndex + 1} of ${websiteSteps.length}</span><p>${step.id === 'brief' ? 'Start with who this website serves and what it should achieve.' : step.id === 'pages' ? 'Choose a page to work on, or add the next page your site needs.' : step.id === 'edit' ? 'Edit the selected page. Use Pages to move to a different page.' : 'Choose any page to preview at different widths. Download one HTML page or the whole static website.'}</p></div>
        <div class="website-builder-grid website-guided-grid">
          <aside class="website-panel website-brief-panel" data-website-panel="brief" ${websiteStep === 'brief' ? '' : 'hidden'} aria-labelledby="website-brief-title"><span class="studio-kicker">Strategy</span><h3 id="website-brief-title" tabindex="-1">Client brief</h3>${['audience', 'goal', 'tone', 'offer'].map(field => `<div class="studio-field"><label for="website-brief-${field}">${field[0].toUpperCase()}${field.slice(1)}</label><textarea id="website-brief-${field}" rows="3" data-website-brief="${field}" data-focus-key="website-brief-${field}">${escapeHtml(project.brief[field])}</textarea></div>`).join('')}${renderWebsiteStyles(project)}</aside>
          <section class="website-panel" data-website-panel="pages" ${websiteStep === 'pages' ? '' : 'hidden'} aria-labelledby="website-sitemap-title"><span class="studio-kicker">Structure</span><h3 id="website-sitemap-title" tabindex="-1">Sitemap</h3><p id="website-page-drag-help">Drag pages above or below siblings. To change groups, choose Navigation parent. Move page controls support keyboard reordering.</p><div class="website-page-list">${root.MeridianWebsiteBuilder.navigationRows(project).map(item => `<button type="button" draggable="true" data-drag-kind="page" data-drag-id="${attr(item.id)}" data-drop-kind="page" data-drop-id="${attr(item.id)}" aria-describedby="website-page-drag-help" data-depth="${item.depth}" style="--page-depth:${item.depth}" class="website-page${item.id === page.id ? ' is-current' : ''}" data-action="website-page" data-focus-key="website-page-${attr(item.id)}" data-value="${attr(item.id)}" ${item.id === page.id ? 'aria-current="page"' : ''}><span>${escapeHtml(item.title)}</span><small>/${escapeHtml(item.slug)} · Level ${item.depth + 1}</small></button>`).join('')}</div>${renderWebsitePageActions(project, page)}<div class="website-add-row"><label class="studio-field"><span>New page title</span><input id="website-page-name" maxlength="120" placeholder="Services"></label><button type="button" class="studio-button studio-button--secondary" data-action="website-add-page">Add page</button></div></section>
          <section class="website-panel website-page-editor" data-website-panel="edit" ${websiteStep === 'edit' ? '' : 'hidden'} aria-labelledby="website-page-editor-title"><div class="studio-section-heading"><div><span class="studio-kicker">Page construction</span><h3 id="website-page-editor-title" tabindex="-1">Edit ${escapeHtml(page.title)}</h3></div><div class="website-add-row"><label class="studio-field"><span>Section type</span><select id="website-section-type"><option value="content">Content</option><option value="hero">Hero</option><option value="features">Features</option><option value="cta">Call to action</option></select></label><button type="button" class="studio-button studio-button--secondary" data-action="website-add-section">Add section</button></div></div>
            <div class="website-page-settings"><div class="studio-field"><label for="website-page-title">Page title</label><input id="website-page-title" value="${attr(page.title)}" data-website-page="title" data-focus-key="website-page-title"></div><div class="studio-field"><label for="website-page-slug">URL slug</label><input id="website-page-slug" value="${attr(page.slug)}" ${!page.slug ? 'readonly aria-describedby="website-home-url-help"' : ''} data-website-page="slug" data-focus-key="website-page-slug"></div></div>${!page.slug ? '<p id="website-home-url-help">The home page opens at index.html. Its URL stays empty.</p>' : ''}
            ${renderSharedSectionLibrary(project)}<p id="website-section-drag-help">Drag a section above or below another section in this page. Move up and Move down provide the same ordering controls from the keyboard.</p><div class="website-section-list">${page.sections.map((section, index) => `<article class="website-section-card" data-drop-kind="section" data-drop-id="${attr(section.id)}"><div><span class="studio-pill">${escapeHtml(section.type)}</span><strong>Section ${index + 1}</strong>${section.sharedId ? '<span class="studio-pill">Shared</span>' : ''}</div>${renderWebsiteSectionActions(section, index, page.sections.length)}<div class="studio-field"><label for="website-${section.id}-heading">Heading</label><input id="website-${section.id}-heading" value="${attr(section.heading)}" data-website-section="${attr(section.id)}" data-field="heading" data-focus-key="website-${attr(section.id)}-heading"></div>${renderWebsiteBody(section, index)}<div class="studio-field"><label for="website-${section.id}-action">Action label</label><input id="website-${section.id}-action" value="${attr(section.action)}" data-website-section="${attr(section.id)}" data-field="action" data-focus-key="website-${attr(section.id)}-action"></div><div class="studio-field"><label for="website-${attr(section.id)}-action-destination">Action destination</label><select id="website-${attr(section.id)}-action-destination" data-website-section="${attr(section.id)}" data-field="actionPageId" data-focus-key="website-${attr(section.id)}-action-destination" aria-describedby="website-${attr(section.id)}-action-help"><option value="">Choose a page</option>${project.pages.map(target => `<option value="${attr(target.id)}"${target.id === section.actionPageId ? ' selected' : ''}>${escapeHtml(target.title)}</option>`).join('')}</select><small id="website-${attr(section.id)}-action-help">${section.action && !section.actionPageId ? 'Choose a destination to include this action in preview and downloads.' : 'Links follow the selected page even if its URL changes. Preview shows actions without opening links.'}</small></div></article>`).join('')}</div>
          </section>
          <section class="website-panel website-preview" data-website-panel="preview" ${websiteStep === 'preview' ? '' : 'hidden'} aria-labelledby="website-preview-title"><div class="studio-section-heading"><div><span class="studio-kicker">Actual project output</span><h3 id="website-preview-title" tabindex="-1">Responsive preview</h3></div><button type="button" class="studio-button studio-button--secondary" data-action="website-export">Download ${escapeHtml(root.MeridianWebsiteBuilder.pageFilename(page))}</button><button type="button" class="studio-button studio-button--secondary" data-action="website-export-archive">Download whole website (.zip)</button></div>${renderWebsitePreviewSelector(project, page)}<div class="website-device-bar" role="group" aria-label="Preview width">${[['desktop', 'Desktop'], ['tablet', 'Tablet'], ['phone', 'Phone']].map(([id, label]) => `<button type="button" class="studio-button studio-button--secondary" data-action="website-device" data-value="${id}" aria-pressed="${websiteDevice === id}">${label}</button>`).join('')}<span>${websiteDevice === 'desktop' ? 'Fits the workspace' : websiteDevice === 'tablet' ? '768 px target · fits available space' : '375 px target · fits available space'}</span></div><div class="website-preview-stage"><iframe class="website-device-${websiteDevice}" title="Preview of ${attr(page.title)}" sandbox="" srcdoc="${attr(website.preview())}"></iframe></div>${renderWebsiteCheckpoints(state)}</section>
        </div>
        <footer class="website-flow-footer"><span>${escapeHtml(page.title)} · ${project.pages.length} page${project.pages.length === 1 ? '' : 's'} in this website</span><div>${stepIndex > 0 ? `<button type="button" class="studio-button studio-button--secondary" data-action="website-step" data-value="${websiteSteps[stepIndex - 1].id}">Back to ${websiteSteps[stepIndex - 1].label}</button>` : ''}${stepIndex < websiteSteps.length - 1 ? `<button type="button" class="studio-button studio-button--primary" data-action="website-step" data-value="${websiteSteps[stepIndex + 1].id}">Continue to ${websiteSteps[stepIndex + 1].label}</button>` : '<button type="button" class="studio-button studio-button--primary" data-action="website-step" data-value="edit">Return to editing</button>'}</div></footer></div>`;
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
      const location = `${viewState.project ? viewState.project.id : ''}:${viewState.surface}:${websiteState && websiteState.project ? websiteState.project.id : ''}`;
      const oldWorkspace = host.querySelector('.studio-workspace');
      const scrollTop = location === renderedLocation && oldWorkspace ? oldWorkspace.scrollTop : 0;
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
      else if (viewState.surface === 'assets') content = assetLifecycle
        ? '<section class="studio-surface" data-surface="assets"><div id="studio-asset-client-slot"></div></section>'
        : renderAssets(viewState);
      else if (viewState.surface === 'website') content = renderWebsite();
      else if (viewState.surface === 'handoff') content = renderHandoff(viewState);
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
      if (assetContainer && viewState.surface === 'assets') {
        host.querySelector('#studio-asset-client-slot')?.appendChild(assetContainer);
      }
      const nextWorkspace = host.querySelector('.studio-workspace');
      if (nextWorkspace) nextWorkspace.scrollTop = scrollTop;
      renderedLocation = location;
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
      if (action === 'surface' && value !== viewState.surface) requestTransition(() => workspace.openSurface(value), 'change Studio workspace');
      else if (action === 'focus-project') host.querySelector('#studio-project-select')?.focus();
      else if (action === 'retry-load') workspace.retryLoad();
      else if (action === 'job-scenario-load') { workspace.simulateDevelopmentJob(host.querySelector('#studio-job-scenario')?.value);focusDevelopmentJob(); }
      else if (action === 'job-cancel') { workspace.requestDevelopmentCancel();focusDevelopmentJob(); }
      else if (action === 'job-resolve') { workspace.resolveDevelopmentJob(viewState.developmentJob?.requestId,value);focusDevelopmentJob(); }
      else if (action === 'job-retry') { workspace.retryDevelopmentJob();focusDevelopmentJob(); }

      else if (action === 'continue-campaign') requestTransition(() => viewState.data.scenes[0] ? workspace.selectScene(viewState.data.scenes[0].id) : workspace.createEmptyDraft(), 'open the storyboard draft');
      else if (action === 'scene') requestTransition(() => workspace.selectScene(value), 'open another scene');
      else if (action === 'scene-to-website') requestTransition(() => {
        if (!viewState.project || !websiteState || !websiteState.project) return;
        if (website.addScenePage({ projectId: viewState.project.id, sceneId: viewState.selectedSceneId, title: viewState.editor.title, notes: viewState.editor.notes })) {
          workspace.openSurface('website'); openWebsiteStep('edit');
        }
      }, 'copy this scene into the open website');
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
      else if (action === 'website-step') openWebsiteStep(value);
      else if (action === 'website-device' && ['desktop', 'tablet', 'phone'].includes(value)) {
        websiteDevice = value;
        render();
        host.querySelector('[data-action="website-device"][data-value="' + value + '"]')?.focus({ preventScroll: true });
      }
      else if (action === 'website-list') {
        if (guardLeave(() => website.close(), 'return to saved websites')) website.close();
      }
      else if (action === 'website-open') website.openProject(value);
      else if (action === 'website-page') website.selectPage(value);
      else if (action === 'website-add-page') {
        const input = host.querySelector('#website-page-name');
        website.addPage(input && input.value.trim() ? input.value.trim() : 'New page');
      }
      else if (action === 'website-add-section') website.addSection(host.querySelector('#website-section-type')?.value || 'content');
      else if (action === 'website-add-shared') {
        if (website.addSharedSection(host.querySelector('#website-shared-section')?.value || '')) {
          const heading = host.querySelector('.website-section-card:last-child [data-field=heading]');
          heading?.focus({ preventScroll: true });heading?.scrollIntoView({ block: 'nearest' });
        }
      }
      else if (action === 'website-make-shared' || action === 'website-detach-shared') {
        if (action === 'website-make-shared') website.makeSectionShared(value);
        else website.detachSection(value);
        root.document.getElementById(`website-${value}-heading`)?.focus({ preventScroll: true });
      }

      else if (['website-move-page-up', 'website-move-page-down', 'website-remove-page'].includes(action)) {
        if (action === 'website-remove-page') website.removePage(value);
        else website.movePage(value, action.endsWith('-up') ? -1 : 1);
        host.querySelector('#website-sitemap-title')?.focus({ preventScroll: true });
      }
      else if (['website-move-section-up', 'website-move-section-down', 'website-remove-section'].includes(action)) {
        if (action === 'website-remove-section') website.removeSection(value);
        else website.moveSection(value, action.endsWith('-up') ? -1 : 1);
        host.querySelector('#website-page-editor-title')?.focus({ preventScroll: true });
      }
      else if (action === 'website-format-text') {
        const field = root.document.getElementById(`website-${value}-body`);
        if (!field || !host.contains(field)) return;
        const start = field.selectionStart, end = field.selectionEnd, length = field.value.length;
        if (website.formatSectionText(value, button.dataset.command, start, end)) {
          const next = root.document.getElementById(`website-${value}-body`);
          next?.focus({ preventScroll: true });
          next?.setSelectionRange(start, Math.min(next.value.length, end + next.value.length - length));
          next?.scrollIntoView({ block: 'nearest' });
        }
      }
      else if (action === 'website-drag-help') {
        const control = button.closest('.website-item-actions')?.querySelector('[data-action^="website-move-section"]:not([disabled])');
        (control || host.querySelector('#website-page-editor-title'))?.focus({ preventScroll: true });
        const status = host.querySelector('.studio-live-status');
        if (status) status.textContent = 'Use Move up or Move down to reorder this section from the keyboard.';
      }
      else if (action === 'website-save') website.save();
      else if (action === 'website-save-copy') {
        if (website.saveSeparateCopy()) {
          const status = host.querySelector('.website-flow-status');
          status?.focus({ preventScroll: true }); status?.scrollIntoView({ block: 'start' });
        }
      }
      else if (action === 'website-undo') website.undo();
      else if (action === 'website-redo') website.redo();
      else if (action === 'website-checkpoint-create') {
        website.createCheckpoint(host.querySelector('#website-checkpoint-label')?.value || '');
        host.querySelector('#website-checkpoints-title')?.focus({ preventScroll: true });
      }
      else if (action === 'website-checkpoint-remove') {
        checkpointRemovalId = value; render();
        host.querySelector('[data-action=website-checkpoint-cancel]')?.focus();
      }
      else if (action === 'website-checkpoint-cancel') {
        checkpointRemovalId = null; render();
        [...host.querySelectorAll('[data-action=website-checkpoint-remove]')].find(item => item.dataset.value === value)?.focus({ preventScroll: true });
      }
      else if (action === 'website-checkpoint-confirm') {
        if (checkpointRemovalId !== value) return;
        if (website.removeCheckpoint(value)) checkpointRemovalId = null;
        render();host.querySelector('#website-checkpoints-title')?.focus({ preventScroll: true });
      }
      else if (action === 'website-checkpoint-restore') {
        website.restoreCheckpoint(value);
        host.querySelector('#website-checkpoints-title')?.focus({ preventScroll: true });
      }
      else if (action === 'website-export-archive') {
        const archive = website.exportArchive();
        if (!archive) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([archive.bytes], { type: 'application/zip' }));
        link.download = archive.name; link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }
      else if (action === 'website-export') {
        const bundle = website.exportSite();
        const page = website.snapshot().project.pages.find(item => item.id === website.snapshot().selectedPageId) || website.snapshot().project.pages[0];
        const filename = root.MeridianWebsiteBuilder.pageFilename(page);
        const blob = new Blob([bundle.files[filename]], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = filename; link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
      }
      else if (action === 'keep-editing') { pendingLeave = null; render(); restoreDialogReturnFocus(); }
      else if (action === 'discard-leave') {
        const callback = pendingLeave && pendingLeave.callback;
        const scope = pendingLeave && pendingLeave.scope;
        const reason = pendingLeave && pendingLeave.reason;
        const discarded = scope === 'website' ? website.discard() : (workspace.discardChanges(), true);
        if (!discarded) return;
        pendingLeave = null;
        dialogReturnFocus = null;
        render();
        if (callback) requestTransition(callback, reason);
      } else if (action === 'save-leave') {
        const callback = pendingLeave && pendingLeave.callback;
        const scope = pendingLeave && pendingLeave.scope;
        const reason = pendingLeave && pendingLeave.reason;
        const saved = scope === 'website' ? website.save() : await workspace.saveDraft();
        if (saved) {
          pendingLeave = null;
          dialogReturnFocus = null;
          render();
          if (callback) requestTransition(callback, reason);
        }
      }
    });

    function clearDropTargets() {
      host.querySelectorAll('.website-drop-target').forEach(item => { item.classList.remove('website-drop-target'); delete item.dataset.dropPlacement; });
    }

    function dropTarget(event) {
      const target = event.target.closest('[data-drop-kind]');
      if (!dragging || !target || !host.contains(target) || !websiteState?.project || dragging.website !== websiteState.project.id || dragging.context !== websiteContextId || target.dataset.dropKind !== dragging.kind) return null;
      if (dragging.kind === 'section' && dragging.page !== websiteState.selectedPageId) return null;
      if (dragging.kind === 'page') {
        const pages = websiteState.project.pages;
        const from = pages.find(page => page.id === dragging.id), to = pages.find(page => page.id === target.dataset.dropId);
        if (!from || !to || (from.parentPageId || '') !== (to.parentPageId || '')) return null;
      }
      return target;
    }

    host.addEventListener('dragstart', event => {
      const source = event.target.closest('[data-drag-kind]');
      if (!source || !host.contains(source) || !websiteState?.project || !['page','section'].includes(source.dataset.dragKind)) return;
      dragging = { kind: source.dataset.dragKind, id: source.dataset.dragId, context: websiteContextId, website: websiteState.project.id, page: websiteState.selectedPageId };
      if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'Meridian local reorder'); }
      const status = host.querySelector('.studio-live-status');
      if (status) status.textContent = 'Drag above or below another item in the same group. Move controls are also available from the keyboard.';
    });
    host.addEventListener('dragover', event => {
      const target = dropTarget(event);
      clearDropTargets();
      if (!target) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      target.classList.add('website-drop-target');
      const bounds = target.getBoundingClientRect();
      target.dataset.dropPlacement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    });
    host.addEventListener('drop', event => {
      const target = dropTarget(event), source = dragging;
      // Ignore transferred content. Only an active in-shell drag can reorder.
      if (event.target.closest('[data-drop-kind]') && !event.target.closest('input,textarea,select')) event.preventDefault();
      if (!target) { dragging = null; clearDropTargets(); return; }
      event.preventDefault();
      const bounds = target.getBoundingClientRect();
      const placement = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
      const targetId = target.dataset.dropId;
      dragging = null; clearDropTargets();
      if (source.kind === 'page') website.movePageTo(source.id, targetId, placement);
      else website.moveSectionTo(source.id, targetId, placement);
      const control = [...host.querySelectorAll('[data-drag-kind]')].find(item => item.dataset.dragKind === source.kind && item.dataset.dragId === source.id);
      control?.focus({ preventScroll: true }); control?.scrollIntoView({ block: 'nearest' });
    });
    host.addEventListener('dragend', () => {
      dragging = null; clearDropTargets();
      const status = host.querySelector('.studio-live-status');
      if (status) status.textContent = websiteState?.status || viewState.statusMessage;
    });

    host.addEventListener('change', event => {
      const control = event.target;
      if (control.dataset.action === 'project' && control.value && typeof onProjectSelect === 'function') {
        onProjectSelect(control.value);
      }
      if (control.dataset.editorField) workspace.updateEditor(control.dataset.editorField, control.value);
      if (control.dataset.websiteBrief) website.updateBrief(control.dataset.websiteBrief, control.value);
      if (control.dataset.websitePage) website.updatePage(control.dataset.websitePage, control.value);
      if (control.dataset.websiteSection) website.updateSection(control.dataset.websiteSection, control.dataset.field, control.value);
      if (control.dataset.websiteDesign) website.updateDesign(control.dataset.websiteDesign, control.value);
      if (control.dataset && Object.hasOwn(control.dataset, 'websitePreviewPage')) website.selectPage(control.value);
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

    function requestTransition(callback, reason) {
      if (guardLeave(callback, reason)) callback();
    }

    function guardLeave(callback, reason) {
      if (executingApprovedTransition) return true;
      if (pendingLeave || assetTransitionPending) return false;
      const websiteDirty = websiteState && websiteState.dirty;
      if (!viewState || (!viewState.unsaved && !websiteDirty)) {
        if (!assetLifecycle) return true;
        continueAfterAssetGuard(callback);
        return false;
      }
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
      dragging = null;
      clearTimeout(announcementTimer);
      dialogReturnFocus = null;
      workspace.destroy();
      assetLifecycle?.dispose();
      assetLifecycle = null;
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
