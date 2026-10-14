/* Connect-owned project binding for the isolated DEV-005 asset controller. */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MeridianStudioAssetHost = factory();
})(typeof window === 'undefined' ? null : window, function () {
  const OPERATIONS = new Set([
    'asset.list', 'asset.import', 'asset.metadata', 'asset.download', 'asset.submit-review',
  ]);

  function fail(code) {
    return Object.assign(new Error(code), { code });
  }

  function createAssetHost({ context, Controller, ServiceAdapter, transport, onChange = () => {} }) {
    if (!context || typeof context.snapshot !== 'function' ||
        typeof context.subscribe !== 'function' ||
        typeof context.beginProjectRequest !== 'function' ||
        typeof context.isCurrentRequest !== 'function' ||
        typeof Controller !== 'function' || typeof ServiceAdapter !== 'function' ||
        typeof onChange !== 'function') {
      throw new TypeError('Studio context, asset controller and service adapter are required.');
    }
    if (transport !== undefined && (!transport || typeof transport.request !== 'function')) {
      throw new TypeError('Approved named transport must implement request.');
    }

    let disposed = false;
    let selectedId = null;
    let selectedName = null;
    function namedSnapshot(state) {
      if (state.project?.id === selectedId) state.project.name = selectedName;
      return state;
    }
    const scopedTransport = {
      mode: transport?.mode === 'synthetic' ? 'synthetic' : 'service',
      async request(operation, payload, options) {
        if (!OPERATIONS.has(operation)) throw fail('INVALID_OPERATION');
        const ticket = context.beginProjectRequest();
        if (disposed || !ticket || payload?.projectId !== ticket.projectId) {
          throw fail('PROJECT_DENIED');
        }
        if (!transport) throw fail('SERVICE_UNAVAILABLE');
        const result = await transport.request(operation, payload, options);
        if (disposed || !context.isCurrentRequest(ticket)) throw fail('CANCELLED');
        return result;
      },
    };
    const service = new ServiceAdapter(scopedTransport);
    const controller = new Controller({
      service,
      projects: [],
      onChange: state => { if (!disposed) onChange(namedSnapshot(state)); },
    });

    function sync() {
      if (disposed) return;
      const state = context.snapshot();
      const projects = Array.isArray(state.projects) ? state.projects : [];
      controller.projects = projects.map(({ id, name }) => ({ id, name }));
      const selected = state.project && projects.find(item => item.id === state.project.id);
      if (!selected) {
        if (selectedId !== null) {
          selectedId = null;
          selectedName = null;
          controller.signOut();
          controller.projects = projects.map(({ id, name }) => ({ id, name }));
        }
        return;
      }
      if (selected.id !== selectedId) {
        selectedId = selected.id;
        selectedName = selected.name;
        // Controller clears old scope and aborts its requests synchronously.
        void controller.selectProject(selected.id);
      } else if (selected.name !== selectedName) {
        selectedName = selected.name;
        onChange(namedSnapshot(controller.snapshot()));
      }
    }

    const unsubscribe = context.subscribe(sync);
    sync();

    function requireScope() {
      if (disposed) throw fail('DISPOSED');
      const current = context.snapshot().project;
      if (!current || current.id !== selectedId || controller.snapshot().project?.id !== current.id) {
        throw fail('NO_PROJECT');
      }
    }

    return Object.freeze({
      snapshot: () => namedSnapshot(controller.snapshot()),
      search(filters) { requireScope(); return controller.search(filters); },
      selectAsset(id) { requireScope(); return controller.selectAsset(id); },
      save(method, input) { requireScope(); return controller.save(method, input); },
      download(input) { requireScope(); return controller.download(input); },
      cancel() { requireScope(); return controller.cancel(); },
      dispose() {
        if (disposed) return;
        unsubscribe();
        controller.signOut();
        disposed = true;
      },
    });
  }

  return { createAssetHost };
});
