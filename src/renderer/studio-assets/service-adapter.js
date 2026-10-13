(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudioAssetService = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  // Host-injected named transport; no token handling, endpoints or bridge privileges here.
  class ServiceAdapter {
    constructor(transport) {
      if (!transport || typeof transport.request !== 'function') throw new TypeError('Named asset transport required');
      this.transport = transport; this.mode = 'service';
    }
    async call(operation, input) {
      const { signal, ...payload } = input;
      if (signal?.aborted) throw Object.assign(new Error('CANCELLED'), {code:'CANCELLED'});
      const result = await this.transport.request(operation, structuredClone(payload), {signal});
      if (signal?.aborted) throw Object.assign(new Error('CANCELLED'), {code:'CANCELLED'});
      return result;
    }
    list(input) { return this.call('asset.list',input); }
    import(input) { return this.call('asset.import',input); }
    metadata(input) { return this.call('asset.metadata',input); }
    download(input) { return this.call('asset.download',input); }
    review(input) { return this.call('asset.submit-review',input); }
  }
  return { ServiceAdapter };
});
