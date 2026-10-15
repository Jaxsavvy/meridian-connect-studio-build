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
    if (!host || !context || !root.MeridianStudioWorkspace || !root.MeridianStudioFixtures) {
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
    const adapter = root.MeridianStudioFixtures.createSyntheticAdapter();
    const workspace = root.MeridianStudioWorkspace.createWorkspace({
      context,
      adapter,
      onChange(next) {
        viewState = next;
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
      const items = [
        ['operations', 'Operations', 'Production overview'],
        ['editor', 'Campaign editor', 'Synthetic first slice'],
        ['assets', 'Asset Library', assetLifecycle ? 'Writable synthetic development client' : 'Read-only interaction preview'],
        ['states', 'States', 'Recovery patterns'],
      ];
      return `<nav class="studio-local-nav" aria-label="Studio workspace"${modalOpen ? ' inert aria-hidden="true"' : ''}>
        <p class="studio-local-nav__eyebrow">Studio workspace</p>
        ${items.map(([id, label, hint]) => `<button type="button" class="studio-local-nav__item${state.surface === id ? ' is-current' : ''}"
          data-action="surface" data-value="${id}" ${state.surface === id ? 'aria-current="page"' : ''}>
          <span>${label}</span><small>${hint}</small>
        </button>`).join('')}
        <div class="studio-session-card">
          <span>Session</span><strong>${state.unsaved ? 'Unsaved work' : state.saveState}</strong>
          <small>Synthetic memory only</small>
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
            <span class="studio-pill studio-pill--planned">Planned</span>
            <p>${escapeHtml(root.MeridianStudioFixtures.TOOL_DETAILS[tool.id])}</p>
            <button type="button" class="studio-text-action" data-action="tool-detail" data-value="${attr(tool.id)}"
              aria-label="View planned ${attr(tool.name)} requirements">View requirements <span aria-hidden="true">→</span></button>
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
      return `<div class="studio-modal-backdrop" role="presentation"><section class="studio-modal" role="dialog" aria-modal="true" aria-labelledby="studio-leave-title" aria-describedby="studio-leave-copy">
        <span class="studio-pill studio-pill--unsaved">Unsaved</span><h2 id="studio-leave-title">Keep this synthetic draft?</h2>
        <p id="studio-leave-copy">You are about to ${escapeHtml(pendingLeave.reason)}. Choose what happens to the unsaved development-only changes.</p>
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
      else if (viewState.surface === 'assets') content = assetLifecycle
        ? '<section class="studio-surface" data-surface="assets"><div id="studio-asset-client-slot"></div></section>'
        : renderAssets(viewState);
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
      if (action === 'surface') {
        if (viewState.surface === 'assets' && value !== 'assets' && assetLifecycle) {
          continueAfterAssetGuard(() => workspace.openSurface(value));
        } else workspace.openSurface(value);
      }
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
      else if (action === 'keep-editing') { pendingLeave = null; render(); restoreDialogReturnFocus(); }
      else if (action === 'discard-leave') {
        const callback = pendingLeave && pendingLeave.callback;
        pendingLeave = null;
        dialogReturnFocus = null;
        workspace.discardChanges();
        render();
        if (callback) continueAfterAssetGuard(callback);
      } else if (action === 'save-leave') {
        const callback = pendingLeave && pendingLeave.callback;
        const saved = await workspace.saveDraft();
        if (saved) {
          pendingLeave = null;
          dialogReturnFocus = null;
          render();
          if (callback) continueAfterAssetGuard(callback);
        }
      }
    });

    host.addEventListener('change', event => {
      const control = event.target;
      if (control.dataset.editorField) workspace.updateEditor(control.dataset.editorField, control.value);
    });

    host.addEventListener('input', event => {
      const control = event.target;
      if (control.dataset.editorField) workspace.updateEditor(control.dataset.editorField, control.value);
      if (control.dataset.action === 'asset-query') workspace.setAssetQuery(control.value);
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
      if (executingApprovedTransition) return true;
      if (pendingLeave || assetTransitionPending) return false;
      if (!viewState || !viewState.unsaved) {
        if (!assetLifecycle) return true;
        continueAfterAssetGuard(callback);
        return false;
      }
      rememberDialogReturnFocus();
      pendingLeave = { callback, reason: reason || 'leave Studio' };
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
