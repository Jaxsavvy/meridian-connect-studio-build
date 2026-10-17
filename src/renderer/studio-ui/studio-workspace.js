(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeridianStudioWorkspace = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const SURFACES = new Set(['operations', 'editor', 'assets', 'website', 'handoff', 'states']);

  const DEVELOPMENT_JOB_SCENARIOS = Object.freeze(['queued','running','failed','uncertain','denied','cost-denied','revoked']);
  const JOB_COPY = Object.freeze({
    idle: ['No job scenario loaded', 'Choose a development-only scenario. No job is submitted.'],
    queued: ['Synthetic job queued', 'Waiting to start. No provider or job service is connected.'],
    running: ['Synthetic job running', 'Progress is a fixture value, not a provider estimate.'],
    cancelling: ['Cancellation requested', 'Cancellation is not confirmed. The job may still complete; do not submit a duplicate.'],
    cancelled: ['Synthetic cancellation confirmed', 'The simulated outcome is known. Existing work remains unchanged.'],
    completed: ['Synthetic completion recorded', 'This fixture creates no output asset or service record.'],
    failed: ['Synthetic attempt failed', 'Failure or a not-started outcome is known. Retry is explicit and bounded.'],
    uncertain: ['Completion unknown', 'Reconcile the recorded outcome before retrying, to avoid duplicate work.'],
    denied: ['Project action denied', 'No simulated job was submitted. Request project access through the owner.'],
    'cost-denied': ['Spending approval missing', 'No simulated job was submitted. A local control cannot grant spending approval.'],
    revoked: ['Project access revoked', 'Project output is unavailable. Actual session or membership loss clears scoped client state.'],
    unavailable: ['Job state unavailable', 'Unknown states stay closed. Authoritative job services are not connected.'],
  });

  function developmentJobPresentation(job) {
    const known = job?.developmentOnly === true && typeof job.status === 'string' && Object.hasOwn(JOB_COPY, job.status);
    const status = !job ? 'idle' : known ? job.status : 'unavailable';
    const allowed = known && job.permission === 'allowed';
    const attempt = Number.isSafeInteger(job?.attempt) ? job.attempt : 0;
    return {
      status, title: JOB_COPY[status][0], detail: JOB_COPY[status][1],
      progress: known && Number.isFinite(job.progress) ? Math.min(100,Math.max(0,job.progress)) : null,
      canCancel: allowed && ['queued','running'].includes(status),
      canConfirmCancel: allowed && status === 'cancelling',
      canReconcile: allowed && status === 'uncertain',
      canRetry: allowed && job.completionKnown === true && ['failed','cancelled'].includes(status) && attempt > 0 && attempt < 3,
      canExport: false,
      retryReason: status === 'uncertain' ? 'Check the outcome before retrying.' : attempt >= 3 ? 'Three synthetic attempts reached; no automatic retry.' : !allowed ? 'Project/spending authority is unavailable.' : 'Retry requires a known failed or cancelled outcome.',
    };
  }

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
    let editSequence = 0;
    let draftCounter = 0;
    let developmentJobCounter = 0;
    let developmentRequestCounter = 0;
    let developmentJobTicket = null;
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
      developmentJob: null,
    };

    function emit() {
      if (!destroyed) onChange(snapshot());
    }

    function snapshot() {
      return copy(state);
    }

    async function loadProject(project) {
      developmentJobTicket = null;
      saveSequence += 1;
      editSequence += 1;
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
        developmentJob: null,
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
            format: firstScene?.format || '16:9 landscape',
            notes: firstScene ? firstScene.note : '',
            assetIds: firstScene ? copy(firstScene.assetIds || []) : [],
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
      saveSequence += 1;
      editSequence += 1;
      state = {
        ...state,
        surface: 'editor',
        selectedSceneId: scene.id,
        editor: { title: scene.name, format: scene.format || '16:9 landscape', notes: scene.note, assetIds: copy(scene.assetIds || []) },
        unsaved: false,
        saveState: scene.status === 'Saved' ? 'Saved' : 'Draft',
        statusMessage: `${scene.name} opened in the synthetic editor.`,
      };
      emit();
      return true;
    }

    function updateEditor(field, value) {
      if (!['title', 'format', 'notes'].includes(field) || !state.project) return false;
      editSequence += 1;
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
      const editingVersion = editSequence;
      const payload = { projectId: ticket.projectId, sceneId: state.selectedSceneId || `scene-local-${++draftCounter}`, editor: copy(state.editor) };
      state = { ...state, saveState: 'Saving', error: null, statusMessage: 'Saving synthetic draft…' };
      emit();
      try {
        const result = await adapter.save(payload);
        if (destroyed || sequence !== saveSequence || !context.isCurrentRequest(ticket)) return false;
        const savedScene = { id: payload.sceneId, name: payload.editor.title, note: payload.editor.notes, format: payload.editor.format, assetIds: copy(payload.editor.assetIds || []), duration: '00:00', status: 'Saved' };
        const exists = state.data.scenes.some(scene => scene.id === payload.sceneId);
        const scenes = exists ? state.data.scenes.map(scene => scene.id === payload.sceneId ? { ...scene, ...savedScene, duration: scene.duration } : scene) : [...state.data.scenes, savedScene];
        const changedDuringSave = editingVersion !== editSequence;
        state = { ...state, data: { ...state.data, scenes }, selectedSceneId: payload.sceneId,
          unsaved: changedDuringSave, saveState: changedDuringSave ? 'Unsaved' : 'Saved',
          statusMessage: changedDuringSave ? 'Earlier synthetic edit saved; newer changes still need saving.' : `Synthetic draft saved at ${new Date(result.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` };
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
      saveSequence += 1;
      editSequence += 1;
      const scene = state.data && state.data.scenes.find(item => item.id === state.selectedSceneId);
      state = {
        ...state,
        editor: {
          title: scene ? scene.name : 'Untitled synthetic scene',
          format: scene?.format || '16:9 landscape',
          notes: scene ? scene.note : '',
          assetIds: scene ? copy(scene.assetIds || []) : [],
        },
        unsaved: false,
        saveState: scene?.status === 'Saved' ? 'Saved' : 'Draft',
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
      editSequence += 1;
      state = { ...state, editor: { ...state.editor, assetIds: [...new Set([...(state.editor.assetIds || []), asset.id])] }, surface: 'editor', unsaved: true, saveState: 'Unsaved', statusMessage: `${asset.name} placed in the synthetic scene. Save the draft to keep this local change.` };
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

    function simulateDevelopmentJob(scenario) {
      if (destroyed || !DEVELOPMENT_JOB_SCENARIOS.includes(scenario) || !state.project || state.data?.developmentOnly !== true) return false;
      const ticket = context.beginProjectRequest();
      if (!ticket) return false;
      const allowed = !['denied','cost-denied','revoked'].includes(scenario);
      developmentJobTicket = ticket;
      state = { ...state, developmentJob: {
        developmentOnly: true, id: `synthetic-job-${++developmentJobCounter}`, projectId: state.project.id,
        requestId: allowed ? `synthetic-request-${++developmentRequestCounter}` : null,
        scenario, status: scenario, permission: allowed ? 'allowed' : scenario,
        attempt: allowed ? 1 : 0, completionKnown: !['queued','running','uncertain'].includes(scenario),
        progress: scenario === 'queued' ? 0 : scenario === 'running' ? 45 : null,
      }, statusMessage: 'Development-only job scenario loaded. No service or provider was called.' };
      emit();return true;
    }

    function currentDevelopmentJob() {
      return !destroyed && state.data?.developmentOnly === true && context.isCurrentRequest(developmentJobTicket) ? state.developmentJob : null;
    }

    function requestDevelopmentCancel() {
      const job = currentDevelopmentJob();
      if (!job || !developmentJobPresentation(job).canCancel) return false;
      state = { ...state, developmentJob: { ...job, status: 'cancelling', completionKnown: false }, statusMessage: 'Synthetic cancellation requested; outcome is not yet confirmed.' };
      emit();return true;
    }

    function resolveDevelopmentJob(requestId, outcome) {
      const job = currentDevelopmentJob();
      if (!job || !requestId || requestId !== job.requestId || job.permission !== 'allowed' || !['queued','running','cancelling','uncertain'].includes(job.status)) return false;
      if (!['completed','failed','cancelled','not-started'].includes(outcome) || (outcome === 'cancelled' && job.status !== 'cancelling') || (outcome === 'not-started' && job.status !== 'uncertain')) return false;
      const status = outcome === 'not-started' ? 'failed' : outcome;
      state = { ...state, developmentJob: { ...job, status, completionKnown: true, progress: status === 'completed' ? 100 : null }, statusMessage: 'Synthetic outcome recorded. No output was registered or downloaded.' };
      emit();return true;
    }

    function retryDevelopmentJob() {
      const job = currentDevelopmentJob();
      if (!job || !developmentJobPresentation(job).canRetry) return false;
      developmentJobTicket = context.beginProjectRequest();
      state = { ...state, developmentJob: { ...job, attempt: job.attempt + 1, requestId: `synthetic-request-${++developmentRequestCounter}`, status: 'queued', completionKnown: false, progress: 0 }, statusMessage: 'Synthetic retry queued once. No real job was submitted.' };
      emit();return true;
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
      saveSequence += 1;
      editSequence += 1;
      state = {
        ...state,
        surface: 'editor',
        editor: { title: 'Untitled synthetic scene', format: '16:9 landscape', notes: '', assetIds: [] },
        selectedSceneId: null,
        unsaved: true,
        saveState: 'Unsaved',
        statusMessage: 'New synthetic draft created. It has not been saved.',
      };
      emit();
    }

    function destroy() {
      developmentJobTicket = null;
      state = { ...state, developmentJob: null };
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
      simulateSaveFailure, retryLoad, createEmptyDraft, simulateDevelopmentJob, requestDevelopmentCancel, resolveDevelopmentJob, retryDevelopmentJob, destroy });
  }

  return Object.freeze({ createWorkspace, DEVELOPMENT_JOB_SCENARIOS, developmentJobPresentation });
});
