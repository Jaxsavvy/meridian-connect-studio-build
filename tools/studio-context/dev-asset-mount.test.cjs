'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const { createStudioContext } = require('../../src/renderer/studio-context');
const { createAssetHost } = require('../../src/renderer/studio-asset-host');
const { createDevelopmentTransport } = require('../../src/renderer/studio-dev-asset-transport');
const { mount } = require('../../src/renderer/studio-dev-asset-mount');
const { Controller } = require('../../src/renderer/studio-assets/controller');
const { ServiceAdapter } = require('../../src/renderer/studio-assets/service-adapter');
const { SyntheticService } = require('../../src/renderer/studio-assets/synthetic-service');

const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const context = createStudioContext();
  context.acceptProjects([{id:'a',name:'Example A'},{id:'b',name:'Example B'}], context.beginProjectList());
  let controller, options, disposal = 0, pendingDecision = true, lastState;
  const fakeView = {
    mount(element, facade, config) {
      assert.equal(element.id, 'assets');
      controller = facade;
      options = config;
      controller.onChange = state => { lastState = state; };
      const disposer = () => { disposal++; controller.cancel(); controller.onChange = () => {}; };
      disposer.prepareLeave = () => Promise.resolve(pendingDecision);
      disposer.clearContext = () => controller.signOut();
      return disposer;
    }
  };
  const lifecycle = mount({
    container: { id: 'assets' }, context,
    deps: {
      host: { createAssetHost }, transport: { createDevelopmentTransport },
      view: fakeView, asset: { Controller }, adapter: { ServiceAdapter },
      synthetic: { SyntheticService },
    },
  });
  return { context, lifecycle, options, controller:()=>controller, state:()=>lastState,
    decide: decision => {pendingDecision=decision;}, disposed:()=>disposal };
}

test('development asset mount uses host-owned UI and disables native upscale', () => {
  const f=fixture();
  assert.equal(f.options.hostOwned,true);
  assert.equal(f.options.enhance,null);
  assert.match(f.options.bannerText,/SYNTHETIC DEVELOPMENT ONLY/);
  assert.match(f.options.bannerText,/No production service or Upscayl/);
  assert.deepEqual(f.controller().projects.map(p=>p.id),['a','b']);
  f.lifecycle.dispose();
  assert.equal(f.disposed(),1);
  f.lifecycle.dispose();
  assert.equal(f.disposed(),1);
});
test('mount facade can write through accepted Connect scope, but not another project',async()=>{
  const f=fixture();
  assert.equal(f.controller().snapshot().project,null);
  f.context.selectProject('a');
  await flush();
  const row=await f.controller().save('import', {
    filename:'sample.txt',mediaType:'text/plain',
    bytes:new TextEncoder().encode('synthetic only'),idempotencyKey:'facade-synthetic'
  });
  assert.equal(row.projectId,'a');
  assert.equal(f.controller().snapshot().assets.length,1);
  f.context.selectProject('b');
  await flush();
  assert.equal(f.controller().snapshot().assets.length,0);
  assert.equal(f.controller().snapshot().project?.id,'b');
  const records=await f.controller().search({});
  assert.deepEqual(records,[]);
  f.lifecycle.dispose();
});
test('accepted revocation drops asset scope; external leave decision can cancel',async()=>{
  const f=fixture();
  f.context.selectProject('a');
  await flush();
  f.decide(false);
  assert.equal(await f.lifecycle.prepareLeave(),false);
  f.decide(true);
  assert.equal(await f.lifecycle.prepareLeave(),true);
  const generation=f.controller().generation;
  f.context.acceptProjects([{id:'b',name:'Example B'}],f.context.beginProjectList());
  assert.equal(f.controller().snapshot().project,null);
  assert.ok(f.controller().generation>generation);
  assert.equal(f.state().project,null);
  f.lifecycle.dispose();
});
test('gate and shell use development-only loader and preserve existing standalone read-only fallback',()=>{
  const fs=require('node:fs');
  const app=fs.readFileSync('src/renderer/app.js','utf8');
  const shell=fs.readFileSync('src/renderer/studio-ui/studio-shell.js','utf8');
  assert.match(app,/if \(!isDevelopment\) return false/);
  assert.match(app,/studio-dev-asset-mount\.js/);
  assert.match(app,/studio-assets\/view\.css/);
  // project-workspace.js intentionally rebinds the legacy selectProject symbol.
  // Studio must retain the original Connect handler for both initial and approved callbacks.
  assert.match(app,/const selectStudioConnectProject = selectProject/);
  assert.match(app,/onProjectSelect: projectId => selectStudioConnectProject\(projectId\)/);
  assert.match(app,/guardLeave\(\(\) => selectStudioConnectProject\(projectId, \{ skipStudioGuard: true \}\)/);
  assert.match(shell,/context\.snapshot\(\)\.projects/);
  assert.match(shell,/lifecycle\.prepareLeave/);
  assert.match(shell,/continueAfterAssetGuard/);
  assert.match(shell,/studio-asset-client-slot/);
  assert.match(shell,/renderAssets\(viewState\)/);
  assert.doesNotMatch(shell,/StudioAssetView\.mount/);
});
