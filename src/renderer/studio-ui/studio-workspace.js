(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeridianStudioWorkspace = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const SURFACES = new Set(['operations', 'editor', 'assets', 'states']);

  function copy(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function createWorkspace({ context, adapter, onChange = () => {} }) {
    if (!context || typeof context.subscribe !== 'function') throw new TypeError('Studio context required.');
    if (!adapter || typeof adapter.load !== 'function' || typeof adapter.save !== 'function') {
      throw new TypeError('Studio workspace adapter required.');
    }

    let destroyed = false;
    let loadSequence = 0;
    let saveSequence = 0;
    let state = {
      surface: 'operations',
      phase: 'idle',
      project: null,
      data: null,
      selectedSceneId: null,
      selectedAssetId: null,
      assetFilter: 'all',
      assetQuery: '',
      editor: { title: '', format: '16:9 landscape', notes: '' },
      unsaved: false,
      saveState: 'Draft',
      statusMessage: 'Select an authenticated project to begin.',
      error: null,
      reviewedDecisionId: null,
      toolDetailId: null,
    };

    function emit() {
      if (!destroyed) onChange(snapshot());
    }

    function snapshot() {
      return copy(state);
    }

    async function loadProject(project) {
      const sequence = ++loadSequence;
      const ticket = context.beginProjectRequest();
      state = {
        ...state,
        phase: project ? 'loading' : 'idle',
        project: project ? { ...project } : null,
        data: null,
        selectedSceneId: null,
        selectedAssetId: null,
        assetFilter: 'all',
        assetQuery: '',
        editor: { title: '', format: '16:9 landscape', notes: '' },
        unsaved: false,
        saveState: 'Draft',
        error: null,
        reviewedDecisionId: null,
        toolDetailId: null,
        statusMessage: project ? `Loading synthetic Studio workspace for ${project.name}.` : 'Select an authenticated project to begin.',
      };
      emit();
      if (!project || !ticket) return false;
      try {
        const data = await adapter.load(project);
        if (destroyed || sequence !== loadSequence || !context.isCurrentRequest(ticket)) return false;
        const firstScene = data.scenes[0] || null;
        state = {
          ...state,
          phase: data.scenes.length || data.assets.length ? 'ready' : 'empty',
          data,
          selectedSceneId: firstScene ? firstScene.id : null,
          editor: {
            title: firstScene ? firstScene.name : 'Untitled synthetic scene',
            format: '16:9 landscape',
            notes: firstScene ? firstScene.note : '',
          },
          saveState: 'Draft',
          statusMessage: 'Synthetic development workspace loaded. No production service is connected.',
        };
        emit();
        return true;
      } catch (error) {
        if (destroyed || sequence !== loadSequence || !context.isCurrentRequest(ticket)) return false;
        state = { ...state, phase: 'error', error: error.message || 'Workspace load failed.', statusMessage: 'Studio could not load this synthetic workspace.' };
        emit();
        return false;
      }
    }

    const unsubscribe = context.subscribe(next => {
      const nextId = next.project && next.project.id;
      if (nextId !== (state.project && state.project.id)) loadProject(next.project);
    });

    function openSurface(surface) {
      if (!SURFACES.has(surface)) return false;
      state = { ...state, surface, toolDetailId: null, statusMessage: `${surface[0].toUpperCase()}${surface.slice(1)} opened.` };
      emit();
      return true;
    }

    function selectScene(sceneId) {
      const scene = state.data && state.data.scenes.find(item => item.id === sceneId);
      if (!scene) return false;
      state = {
        ...state,
        surface: 'editor',
        selectedSceneId: scene.id,
        editor: { title: scene.name, format: '16:9 landscape', notes: scene.note },
        unsaved: false,
        saveState: scene.status === 'Saved' ? 'Saved' : 'Draft',
        statusMessage: `${scene.name} opened in the synthetic editor.`,
      };
      emit();
      return true;
    }

    function updateEditor(field, value) {
      if (!['title', 'format', 'notes'].includes(field) || !state.project) return false;
      state = {
        ...state,
        editor: { ...state.editor, [field]: String(value) },
        unsaved: true,
        saveState: 'Unsaved',
        error: null,
        statusMessage: 'Unsaved synthetic changes.',
      };
      emit();
      return true;
    }

    async function saveDraft() {
      const ticket = context.beginProjectRequest();
      if (!ticket || !state.unsaved || state.saveState === 'Saving') return false;
      const sequence = ++saveSequence;
      const payload = { projectId: ticket.projectId, sceneId: state.selectedSceneId, editor: copy(state.editor) };
      state = { ...state, saveState: 'Saving', error: null, statusMessage: 'Saving synthetic draft…' };
      emit();
      try {
        const result = await adapter.save(payload);
        if (destroyed || sequence !== saveSequence || !context.isCurrentRequest(ticket)) return false;
        state = { ...state, unsaved: false, saveState: 'Saved', statusMessage: `Synthetic draft saved at ${new Date(result.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` };
        emit();
        return true;
      } catch (error) {
        if (destroyed || sequence !== saveSequence || !context.isCurrentRequest(ticket)) return false;
        state = { ...state, unsaved: true, saveState: 'Error', error: error.message || 'Draft save failed.', statusMessage: 'Save failed. Your synthetic changes are still in this window.' };
        emit();
        return false;
      }
    }

    function discardChanges() {
      const scene = state.data && state.data.scenes.find(item => item.id === state.selectedSceneId);
      state = {
        ...state,
        editor: {
          title: scene ? scene.name : 'Untitled synthetic scene',
          format: '16:9 landscape',
          notes: scene ? scene.note : '',
        },
        unsaved: false,
        saveState: 'Draft',
        error: null,
        statusMessage: 'Unsaved synthetic changes discarded.',
      };
      emit();
    }

    function submitForReview() {
      if (state.unsaved || state.saveState === 'Saving') {
        state = { ...state, statusMessage: 'Save the draft before submitting it for review.' };
        emit();
        return false;
      }
      state = { ...state, saveState: 'Needs review', statusMessage: 'Development-only review state recorded locally. No service was called.' };
      emit();
      return true;
    }

    function setAssetFilter(filter) {
      if (!['all', 'Original', 'Derivative', 'Needs review', 'Approved'].includes(filter)) return false;
      state = { ...state, assetFilter: filter, statusMessage: `Asset filter changed to ${filter}.` };
      emit();
      return true;
    }

    function setAssetQuery(query) {
      state = { ...state, assetQuery: String(query), statusMessage: 'Asset results updated.' };
      emit();
    }

    function filteredAssets() {
      if (!state.data) return [];
      const query = state.assetQuery.trim().toLocaleLowerCase();
      return state.data.assets.filter(asset => {
        const matchesFilter = state.assetFilter === 'all' || asset.type === state.assetFilter || asset.status === state.assetFilter;
        const matchesQuery = !query || `${asset.name} ${asset.type} ${asset.status}`.toLocaleLowerCase().includes(query);
        return matchesFilter && matchesQuery;
      });
    }

    function selectAsset(assetId) {
      if (!state.data || !state.data.assets.some(asset => asset.id === assetId)) return false;
      state = { ...state, selectedAssetId: state.selectedAssetId === assetId ? null : assetId, statusMessage: `${assetId} selection updated. Placement is a separate action.` };
      emit();
      return true;
    }

    function placeSelectedAsset() {
      const asset = state.data && state.data.assets.find(item => item.id === state.selectedAssetId);
      if (!asset) {
        state = { ...state, statusMessage: 'Select a synthetic asset before placing it.' };
        emit();
        return false;
      }
      state = { ...state, surface: 'editor', unsaved: true, saveState: 'Unsaved', statusMessage: `${asset.name} placed in the synthetic scene. Save the draft to keep this local change.` };
      emit();
      return true;
    }

    function openDecision(decisionId) {
      if (!state.data || !state.data.decisions.some(item => item.id === decisionId)) return false;
      state = { ...state, reviewedDecisionId: decisionId, statusMessage: 'Synthetic decision details opened. Opening is not approval.' };
      emit();
      return true;
    }

    function resolveDecision(outcome) {
      if (!['Approved', 'Changes requested'].includes(outcome) || !state.reviewedDecisionId) return false;
      const decisions = state.data.decisions.map(item => item.id === state.reviewedDecisionId ? { ...item, state: outcome } : item);
      state = { ...state, data: { ...state.data, decisions }, reviewedDecisionId: null, statusMessage: `${outcome} recorded in synthetic memory only. No authoritative review service was called.` };
      emit();
      return true;
    }

    function showToolDetail(toolId) {
      state = { ...state, toolDetailId: toolId, statusMessage: 'Planned tool details opened.' };
      emit();
    }

    function closeToolDetail() {
      state = { ...state, toolDetailId: null };
      emit();
    }

    function simulateLoadFailure() {
      if (typeof adapter.failNext === 'function') adapter.failNext('load');
      return loadProject(state.project);
    }

    function simulateSaveFailure() {
      if (typeof adapter.failNext === 'function') adapter.failNext('save');
      if (!state.unsaved) updateEditor('notes', state.editor.notes + ' Synthetic recovery check.');
      return saveDraft();
    }

    function retryLoad() {
      return loadProject(state.project);
    }

    function createEmptyDraft() {
      state = {
        ...state,
        surface: 'editor',
        editor: { title: 'Untitled synthetic scene', format: '16:9 landscape', notes: '' },
        selectedSceneId: null,
        unsaved: true,
        saveState: 'Unsaved',
        statusMessage: 'New synthetic draft created. It has not been saved.',
      };
      emit();
    }

    function destroy() {
      destroyed = true;
      loadSequence += 1;
      saveSequence += 1;
      unsubscribe();
    }

    const initial = context.snapshot();
    if (initial.project) loadProject(initial.project);
    else emit();

    return Object.freeze({ snapshot, openSurface, selectScene, updateEditor, saveDraft, discardChanges,
      submitForReview, setAssetFilter, setAssetQuery, filteredAssets, selectAsset, placeSelectedAsset,
      openDecision, resolveDecision, showToolDetail, closeToolDetail, simulateLoadFailure,
      simulateSaveFailure, retryLoad, createEmptyDraft, destroy });
  }

  return Object.freeze({ createWorkspace });
});
