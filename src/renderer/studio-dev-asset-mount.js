/* DEV-020: development-gated Connect-to-Asset-Library view adapter.
 * No standalone project selection, live IPC, Upscayl or employee-mode enablement.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeridianStudioAssetMount = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  function mount({ container, context, deps }) {
    if (!container || !context || !deps ||
        !deps.host?.createAssetHost || !deps.transport?.createDevelopmentTransport ||
        !deps.view?.mount || !deps.asset?.Controller ||
        !deps.adapter?.ServiceAdapter || !deps.synthetic?.SyntheticService) {
      throw new TypeError('Development Asset Library dependencies are unavailable.');
    }

    let disposed = false;
    let listener = null;
    let lifecycle = null;
    const transport = deps.transport.createDevelopmentTransport({
      context, SyntheticService: deps.synthetic.SyntheticService,
    });
    const assetHost = deps.host.createAssetHost({
      context,
      Controller: deps.asset.Controller,
      ServiceAdapter: deps.adapter.ServiceAdapter,
      transport,
      onChange(state) { if (!disposed && listener) listener(state); },
    });
    const controller = {
      get projects() { return context.snapshot().projects; },
      get generation() { return assetHost.generation; },
      get onChange() { return listener; },
      set onChange(value) { listener = value; },
      snapshot: () => assetHost.snapshot(),
      search: filters => assetHost.search(filters),
      selectAsset: id => assetHost.selectAsset(id),
      save: (method, input) => assetHost.save(method, input),
      reloadAsset: id => assetHost.reloadAsset(id),
      download: input => assetHost.download(input),
      // Cassy's view disposes after a revocation too. No selected scope is not an error.
      cancel() { try { return assetHost.cancel(); } catch { return false; } },
      // Connect owns the session; never clear global auth from a component.
      signOut() {},
    };
    try {
      lifecycle = deps.view.mount(container, controller, {
        hostOwned: true,
        enhance: null,
        bannerText: 'SYNTHETIC DEVELOPMENT ONLY — memory-only assets. No production service or Upscayl is connected.',
      });
    } catch (error) {
      assetHost.dispose();
      throw error;
    }

    return Object.freeze({
      prepareLeave: () => disposed ? Promise.resolve(false) : lifecycle.prepareLeave(),
      clearContext() { if (!disposed) lifecycle.clearContext(); },
      dispose() {
        if (disposed) return;
        disposed = true;
        lifecycle();
        assetHost.dispose();
        transport.dispose?.();
      },
    });
  }
  return Object.freeze({ mount });
});
