'use strict';
const { app, BrowserWindow, nativeTheme } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const root = join(__dirname, '../..');
const evidence = process.env.MERIDIAN_UI_FLOW_EVIDENCE || join(root, 'ui-flow-evidence');
const requireOSHighContrast = process.env.MERIDIAN_REQUIRE_OS_HIGH_CONTRAST === '1';
const compositionMode = process.env.MERIDIAN_ASSET_COMPOSITION === '1';
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('force-color-profile', 'srgb');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(window, selector) {
  for (let i = 0; i < 160; i++) {
    if (await window.webContents.executeJavaScript('Boolean(document.querySelector(' + JSON.stringify(selector) + '))')) return;
    await pause(50);
  }
  throw Error('Missing ' + selector);
}
async function click(window, selector) {
  await waitFor(window, selector);
  await window.webContents.executeJavaScript('document.querySelector(' + JSON.stringify(selector) + ').focus(); document.querySelector(' + JSON.stringify(selector) + ').click()');
  await pause(80);
}
async function capture(window, name) {
  window.webContents.invalidate();
  await Promise.race([window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'), pause(8000).then(() => { throw Error('Capture frame wait timed out: ' + name); })]);
  await pause(180);
  await window.webContents.capturePage();
  await pause(120);
  const image = await window.webContents.capturePage();
  await fs.writeFile(join(evidence, name + '.png'), image.toPNG());
}
async function until(window, condition) {
  for (let i = 0; i < 160; i++) {
    if (await window.webContents.executeJavaScript(condition)) return;
    await pause(50);
  }
  throw Error('Condition timed out: ' + condition);
}
async function rendererDrag(window, kind, sourceId, targetId, placement, captureName) {
  const input={kind,sourceId,targetId,placement};
  const over=await window.webContents.executeJavaScript(`(() => {
    const input=${JSON.stringify(input)};
    const source=[...document.querySelectorAll('[data-drag-kind]')].find(item=>item.dataset.dragKind===input.kind&&item.dataset.dragId===input.sourceId);
    const target=[...document.querySelectorAll('[data-drop-kind]')].find(item=>item.dataset.dropKind===input.kind&&item.dataset.dropId===input.targetId);
    source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer()}));
    target.scrollIntoView({block:'start'});const bounds=target.getBoundingClientRect();
    const event=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer(),clientY:input.placement==='before'?bounds.top+2:bounds.bottom-2});
    target.dispatchEvent(event);return {accepted:event.defaultPrevented,indicator:target.dataset.dropPlacement};
  })()`);
  assert.equal(over.accepted,true);assert.equal(over.indicator,placement);
  await capture(window,captureName);
  return window.webContents.executeJavaScript(`(() => {
    const input=${JSON.stringify(input)};
    const target=[...document.querySelectorAll('[data-drop-kind]')].find(item=>item.dataset.dropKind===input.kind&&item.dataset.dropId===input.targetId);
    const bounds=target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer(),clientY:input.placement==='before'?bounds.top+2:bounds.bottom-2}));
    return {focusedKind:document.activeElement.dataset.dragKind,focusedId:document.activeElement.dataset.dragId,indicators:document.querySelectorAll('.website-drop-target').length};
  })()`);
}
async function jobRecoveryVisible(window) {
  return window.webContents.executeJavaScript(`(() => {
    const heading=document.querySelector('#studio-job-state-title').getBoundingClientRect();
    const controls=document.querySelector('.studio-job-status').nextElementSibling.getBoundingClientRect();
    const workspace=document.querySelector('.studio-workspace').getBoundingClientRect();
    return heading.top>=workspace.top-1 && controls.bottom<=workspace.bottom+1;
  })()`);
}
async function metrics(window) {
  return window.webContents.executeJavaScript('(' + (() => ({
    visiblePanels: [...document.querySelectorAll('[data-website-panel]')].filter(panel => !panel.hidden && getComputedStyle(panel).display !== 'none').map(panel => panel.dataset.websitePanel),
    currentStep: document.querySelector('.website-flow-nav [aria-current="step"]')?.dataset.value,
    focusedId: document.activeElement?.id,
    usableHeight: document.querySelector('.studio-workspace').clientHeight >= innerHeight * .5,
    focusedHeadingVisible: (() => { const h=document.activeElement?.getBoundingClientRect(); const w=document.querySelector('.studio-workspace').getBoundingClientRect(); return h && h.top >= w.top && h.bottom <= w.bottom; })(),
    fits: ['.studio-workspace', '.studio-main', '.website-builder'].every(selector => {
      const el = document.querySelector(selector);
      return el && el.scrollWidth <= el.clientWidth + 1;
    }),
    unlabeledControls: [...document.querySelectorAll('.website-builder :is(input,select,textarea)')].filter(el => !(el.getAttribute('aria-label') || el.closest('label') || document.querySelector('label[for="' + el.id + '"]'))).length,
    saveText: document.querySelector('.website-flow-status')?.textContent,
    audience: document.querySelector('#website-brief-audience')?.value,
    frameSandbox: document.querySelector('.website-preview iframe')?.getAttribute('sandbox'),
  })).toString() + ')()');
}

app.whenReady().then(async () => {
  let window;
  try {
    if (requireOSHighContrast) {
      assert.equal(process.platform, 'win32');
      assert.equal(nativeTheme.shouldUseHighContrastColors, true, 'Actual Windows High Contrast must be enabled before launch');
    }
    await fs.mkdir(evidence, { recursive: true });
    app.setPath('userData', await fs.mkdtemp(join(tmpdir(), 'meridian-ui-flow-')));
    window = new BrowserWindow({
      width: 1440, height: 1000, show: true, backgroundColor: '#07101d',
      webPreferences: {
        preload: join(root, 'docs/studio/design/9/runtime-preload.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false,
        additionalArguments: ['--studio-evidence-mode=development'],
      },
    });
    window.webContents.on('console-message', (_event, _level, message) => console.log('Synthetic renderer:', message));
    await window.loadFile(join(root, 'src/renderer/index.html'));
    if (requireOSHighContrast) assert.equal(await window.webContents.executeJavaScript("matchMedia('(forced-colors: active)').matches"), true, 'Actual OS colors must reach the renderer before any emulation');
    await waitFor(window, '#projectsMasterList .project-item');
    await pause(500);
    await window.webContents.executeJavaScript("switchView('studio')");
    await waitFor(window, '#studio-current-work-title');
    await capture(window, '00-project-overview');
    await click(window, '[data-action="surface"][data-value="website"]');
    await waitFor(window, '#website-new-name');
    await window.webContents.executeJavaScript("document.querySelector('#website-new-name').value = 'Northstar Website — UI Flow Review'");
    await click(window, '[data-action="website-create"]');
    let result = await metrics(window);
    assert.deepEqual(result.visiblePanels, ['brief']);
    assert.equal(result.currentStep, 'brief');
    assert.equal(result.unlabeledControls, 0);
    await capture(window, '01-brief-1440');
    await window.webContents.executeJavaScript("const input = document.querySelector('#website-brief-audience'); input.value = 'Independent local businesses'; input.dispatchEvent(new Event('input', { bubbles: true }));");
    const renameCheck=await window.webContents.executeJavaScript(`(() => {
      const context=window.meridianStudioContext, before=context.snapshot();
      const renamed=before.projects.map(project=>project.id===before.project.id?{...project,name:'Renamed synthetic project'}:project);
      context.acceptProjects(renamed,context.beginProjectList());
      const observed={title:document.querySelector('#studio-title').textContent,audience:document.querySelector('#website-brief-audience').value,dirty:document.querySelector('.website-flow-status').textContent.includes('Unsaved changes')};
      context.acceptProjects(before.projects,context.beginProjectList());
      return observed;
    })()`);
    assert.equal(renameCheck.title,'Renamed synthetic project');assert.equal(renameCheck.audience,'Independent local businesses');assert.equal(renameCheck.dirty,true);
    await fs.writeFile(join(evidence,'project-rename.json'),JSON.stringify({status:'passed',acceptedNameRefresh:true,unsavedWebsiteRetained:true,originalNameRestored:true},null,2));
    for (const [step, heading] of [['pages', 'website-sitemap-title'], ['edit', 'website-page-editor-title'], ['preview', 'website-preview-title']]) {
      await click(window, '.website-flow-nav [data-value="' + step + '"]');
      result = await metrics(window);
      assert.deepEqual(result.visiblePanels, [step]);
      assert.equal(result.currentStep, step);
      assert.equal(result.focusedId, heading);
      assert.equal(result.focusedHeadingVisible, true);
      assert.equal(result.audience, 'Independent local businesses');
      assert.match(result.saveText, /Unsaved changes/);
      assert.equal(result.fits, true);
      if (step === 'edit') {
        const retainedScroll = await window.webContents.executeJavaScript(`(() => {
          const field=document.querySelector('[data-website-section][data-field="body"]');
          field.focus(); field.scrollIntoView({block:'center'});
          const before=document.querySelector('.studio-workspace').scrollTop;
          field.value += ' Runtime edit retained.'; field.dispatchEvent(new Event('input',{bubbles:true}));
          return {before,after:document.querySelector('.studio-workspace').scrollTop,focused:document.activeElement.dataset.field};
        })()`);
        assert.ok(retainedScroll.before > 0);
        assert.ok(Math.abs(retainedScroll.before-retainedScroll.after) <= 2);
        assert.equal(retainedScroll.focused,'body');
      }
      await capture(window, '02-' + step + '-1440');
    }
    // Actual renderer controls and a real Electron download, not model-only evidence.
    await click(window, '.website-flow-nav [data-value="brief"]');
    await window.webContents.executeJavaScript(`(() => {
      const accent=document.querySelector('#website-design-accent'); accent.value='#16715a'; accent.dispatchEvent(new Event('change',{bubbles:true}));
      const font=document.querySelector('#website-design-font'); font.value='serif'; font.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await capture(window, '10-global-styles');
    await click(window, '.website-flow-nav [data-value="pages"]');
    await window.webContents.executeJavaScript("document.querySelector('#website-page-name').value='Services'");
    await click(window, '[data-action="website-add-page"]');
    // Boundary regression through actual mounted controls; Undo restores the fixture.
    const boundedName = 'q'.repeat(120);
    for (let i=0;i<2;i++) {
      await window.webContents.executeJavaScript(`document.querySelector('#website-page-name').value=${JSON.stringify(boundedName)}`);
      await click(window,'[data-action="website-add-page"]');
    }
    await click(window,'.website-flow-nav [data-value="edit"]');
    const boundedSlug=await window.webContents.executeJavaScript("document.querySelector('#website-page-slug').value");
    assert.equal(boundedSlug.length,120);assert.ok(boundedSlug.endsWith('-2'));
    await click(window,'[data-action="website-save"]');
    assert.equal((await metrics(window)).saveText.includes('Unsaved'),false);
    await capture(window,'29-bounded-page-url');
    await click(window,'[data-action="website-undo"]');
    await click(window,'[data-action="website-undo"]');
    await click(window,'.website-flow-nav [data-value="pages"]');
    const boundedServicesId=await window.webContents.executeJavaScript("document.querySelector('.website-page.is-current').dataset.value");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('.website-page')].find(el=>el.querySelector('small').textContent.startsWith('/ ·')).click()");
    await click(window,'.website-flow-nav [data-value="edit"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-page-slug').readOnly && document.querySelector('#website-home-url-help').textContent.includes('index.html')"),true);
    await click(window,'.website-flow-nav [data-value="pages"]');
    await click(window,`[data-action="website-page"][data-value="${boundedServicesId}"]`);
    await fs.writeFile(join(evidence,'bounded-page-url.json'),JSON.stringify({status:'passed',duplicateTitleLength:120,uniqueSlugLength:boundedSlug.length,saveSucceeded:true,homeEntryReadOnly:true},null,2));
    await click(window, '[data-action="website-move-page-up"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-page span').textContent"), 'Services');
    await click(window, '[data-action="website-remove-page"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.website-page').length"), 1);
    await click(window, '[data-action="website-undo"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.website-page').length"), 2);
    await window.webContents.executeJavaScript("document.querySelector('[data-website-panel=pages] .website-item-actions').scrollIntoView({block:'center'})");
    await capture(window, '11-page-management');
    const servicesId=await window.webContents.executeJavaScript("document.querySelector('.website-page[aria-current=page]').dataset.value");
    const homeId=await window.webContents.executeJavaScript("[...document.querySelectorAll('.website-page')].find(button=>button.querySelector('span').textContent==='Home').dataset.value");
    const pageDrop=await rendererDrag(window,'page',servicesId,homeId,'after','21-page-drop-indicator');
    assert.equal(pageDrop.focusedId,servicesId);assert.equal(pageDrop.indicators,0);
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-page span').textContent"),'Home');
    await click(window,'[data-action="website-undo"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-page span').textContent"),'Services');

    await window.webContents.executeJavaScript("document.querySelector('#website-page-name').value='Repairs'");
    await click(window,'[data-action="website-add-page"]');
    const repairsId=await window.webContents.executeJavaScript("document.querySelector('.website-page[aria-current=page]').dataset.value");
    await window.webContents.executeJavaScript(`(() => {const control=document.querySelector('#website-page-parent');control.focus();control.value=${JSON.stringify(servicesId)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert.equal(await window.webContents.executeJavaScript('document.activeElement.id'),'website-page-parent');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-page[aria-current=page]').dataset.depth"),'1');
    await window.webContents.executeJavaScript("document.querySelector('#website-page-name').value='Emergency'");
    await click(window,'[data-action="website-add-page"]');
    const emergencyId=await window.webContents.executeJavaScript("document.querySelector('.website-page[aria-current=page]').dataset.value");
    await window.webContents.executeJavaScript(`(() => {const control=document.querySelector('#website-page-parent');control.value=${JSON.stringify(repairsId)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-page[aria-current=page]').dataset.depth"),'2');
    await click(window,`[data-action="website-page"][data-value="${servicesId}"]`);
    const parentOptions=await window.webContents.executeJavaScript("[...document.querySelector('#website-page-parent').options].map(option=>option.value)");
    assert.ok(!parentOptions.includes(repairsId)&&!parentOptions.includes(emergencyId));
    await click(window,'[data-action="website-remove-page"]');
    assert.equal(await window.webContents.executeJavaScript(`document.querySelector('[data-action="website-page"][data-value="${repairsId}"]').dataset.depth`),'0');
    await click(window,'[data-action="website-undo"]');
    await click(window,`[data-action="website-page"][data-value="${emergencyId}"]`);await click(window,'[data-action="website-remove-page"]');
    await click(window,`[data-action="website-page"][data-value="${repairsId}"]`);await click(window,'[data-action="website-remove-page"]');
    await click(window,`[data-action="website-page"][data-value="${servicesId}"]`);
    await window.webContents.executeJavaScript(`(() => {const control=document.querySelector('#website-page-parent');control.value=${JSON.stringify(homeId)};control.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.website-page-list').scrollIntoView({block:'start'});})()`);
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.website-page').length"),2);
    await capture(window,'20-nested-page-navigation');
    await fs.writeFile(join(evidence,'nested-navigation.json'),JSON.stringify({status:'passed',threeLevels:true,cyclesExcluded:true,removePromotesChildren:true,undoRestoresHierarchy:true,focusRetained:true,finalParent:homeId,finalChild:servicesId},null,2));

    await click(window, '.website-flow-nav [data-value="edit"]');
    await window.webContents.executeJavaScript("document.querySelector('#website-section-type').value='cta'");
    await click(window, '[data-action="website-add-section"]');
    await click(window, '.website-section-card:last-child [data-action="website-move-section-up"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-section-card .studio-pill').textContent"), 'cta');
    await click(window, '.website-section-card:first-child [data-action="website-remove-section"]');
    await click(window, '[data-action="website-undo"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('.website-section-card').length"), 2);
    await window.webContents.executeJavaScript("document.querySelector('.website-section-card').scrollIntoView({block:'start'})");
    await capture(window, '12-section-management');
    const sectionIds=await window.webContents.executeJavaScript("[...document.querySelectorAll('.website-section-card')].map(item=>item.dataset.dropId)");
    await window.webContents.executeJavaScript("document.querySelector('[data-drag-kind=section]').focus()");
    window.focus();window.webContents.focus();
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});window.webContents.sendInputEvent({type:'char',keyCode:'\r'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
    await until(window,"document.activeElement.dataset.action==='website-move-section-down'");

    const sectionDrop=await rendererDrag(window,'section',sectionIds[0],sectionIds[1],'after','22-section-drop-indicator');
    assert.equal(sectionDrop.focusedId,sectionIds[0]);assert.equal(sectionDrop.focusedKind,'section');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-section-card .studio-pill').textContent"),'content');
    await click(window,'[data-action="website-undo"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-section-card .studio-pill').textContent"),'cta');
    const externalDrop=await window.webContents.executeJavaScript(`(() => {
      const target=document.querySelector('.website-section-card');const before=[...document.querySelectorAll('.website-section-card')].map(item=>item.dataset.dropId).join();
      const transfer=new DataTransfer();transfer.setData('text/plain','foreign page or file');target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
      return before===[...document.querySelectorAll('.website-section-card')].map(item=>item.dataset.dropId).join();
    })()`);
    assert.equal(externalDrop,true);
    await fs.writeFile(join(evidence,'drag-reorder.json'),JSON.stringify({status:'passed',pageDrop,sectionDrop,externalDropIgnored:externalDrop,undoRestoresOrder:true,keyboardMoveControls:true,method:'Constructed renderer DragEvent sequence through real mounted handlers; not OS pointer/auto-scroll acceptance'},null,2));

    // Opt-in text formatting through real controls, including native Enter activation.
    await window.webContents.executeJavaScript(`(() => {
      const mode=document.querySelector('[data-field=bodyFormat]');mode.value='formatted';mode.dispatchEvent(new Event('change',{bubbles:true}));
      const body=document.querySelector('textarea[data-field=body]');body.value=${JSON.stringify('Clear words\n\nFirst benefit\nSecond benefit\n\n<script>unsafe()</script>')};body.dispatchEvent(new Event('input',{bubbles:true}));
      const next=document.querySelector('textarea[data-field=body]');next.focus();next.setSelectionRange(0,5);
      document.querySelector('[data-command=bold]').focus();
    })()`);
    window.focus(); window.webContents.focus();
    await pause(100);
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});
    window.webContents.sendInputEvent({type:'char',keyCode:'\r'});
    window.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
    try { await until(window,"document.querySelector('textarea[data-field=body]').value.startsWith('**Clear**')"); }
    catch (error) {
      const diagnostic=await window.webContents.executeJavaScript("({body:document.querySelector('textarea[data-field=body]')?.value,focus:document.activeElement?.outerHTML,error:document.querySelector('.website-builder .studio-inline-error')?.textContent,mode:document.querySelector('[data-field=bodyFormat]')?.value})");
      await fs.writeFile(join(evidence,'formatting-failure.json'),JSON.stringify(diagnostic,null,2));
      console.error('Formatting keyboard diagnostic',diagnostic);throw error;
    }
    assert.equal(await window.webContents.executeJavaScript("document.activeElement.dataset.field"),'body');
    for (const [command,selected] of [['italic','words'],['bullets','First benefit\nSecond benefit']]) {
      await window.webContents.executeJavaScript(`(() => {const body=document.querySelector('textarea[data-field=body]');const start=body.value.indexOf(${JSON.stringify(selected)});body.focus();body.setSelectionRange(start,start+${selected.length});})()`);
      await click(window,`[data-command="${command}"]`);
      assert.equal(await window.webContents.executeJavaScript('document.activeElement.dataset.field'),'body');
    }
    const formattedBody=await window.webContents.executeJavaScript("document.querySelector('textarea[data-field=body]').value");
    assert.match(formattedBody, /^\*\*Clear\*\* \*words\*/);
    assert.match(formattedBody, /- First benefit\n- Second benefit/);
    await click(window,'[data-action="website-undo"]');
    assert.doesNotMatch(await window.webContents.executeJavaScript("document.querySelector('textarea[data-field=body]').value"),/- First benefit/);
    await click(window,'[data-action="website-redo"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('textarea[data-field=body]').value"),formattedBody);
    await window.webContents.executeJavaScript("document.querySelector('.website-text-tools').scrollIntoView({block:'start'})");
    await capture(window,'17-formatted-text-editor');
    await fs.writeFile(join(evidence,'formatted-text.json'),JSON.stringify({status:'passed',nativeEnter:true,focusReturnedToBody:true,undoRedo:true,body:formattedBody,limits:'Opt-in plain-text formatting; no HTML, links or scripts accepted'},null,2));
    // Real page destination controls replace the old nonexistent #contact target.
    const destination=await window.webContents.executeJavaScript(`(() => {
      const select=document.querySelector('[data-field=actionPageId]');
      const target=[...select.options].find(option=>option.textContent.includes('Home'));
      select.value=target.value;select.dispatchEvent(new Event('change',{bubbles:true}));
      return target.value;
    })()`);
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('[data-field=actionPageId]').value"),destination);
    await window.webContents.executeJavaScript("document.querySelector('[data-field=actionPageId]').scrollIntoView({block:'center'})");
    await capture(window,'18-action-destination');
    await click(window,'.website-section-card:first-child [data-action="website-make-shared"]');
    const sharedId=await window.webContents.executeJavaScript("document.querySelector('#website-shared-section').value");
    assert.ok(sharedId);
    await click(window,'.website-flow-nav [data-value="pages"]');
    await click(window,`[data-action="website-page"][data-value="${homeId}"]`);
    await click(window,'.website-flow-nav [data-value="edit"]');
    await click(window,'[data-action="website-add-shared"]');
    assert.equal(await window.webContents.executeJavaScript('document.activeElement.dataset.field'),'heading');
    await window.webContents.executeJavaScript(`(() => {
      const heading=document.querySelector('.website-section-card:last-child [data-field=heading]');heading.value='Shared invitation';heading.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('.website-shared-library').scrollIntoView({block:'start'});
    })()`);
    assert.match(await window.webContents.executeJavaScript("document.querySelector('#website-shared-section').selectedOptions[0].textContent"),/2 linked copies/);
    await capture(window,'23-shared-section-library');
    await window.webContents.executeJavaScript("document.querySelector('.website-section-card:last-child .website-item-actions').scrollIntoView({block:'start'})");
    await capture(window,'24-linked-section-controls');
    await click(window,'.website-section-card:last-child [data-action="website-detach-shared"]');
    assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('.website-section-card:last-child [data-action=website-make-shared]'))"),true);
    await click(window,'[data-action="website-undo"]');
    assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('.website-section-card:last-child [data-action=website-detach-shared]'))"),true);
    await click(window,'[data-action="website-redo"]');
    await window.webContents.executeJavaScript(`(() => {
      const heading=document.querySelector('.website-section-card:last-child [data-field=heading]');heading.value='Independent invitation';heading.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await click(window,'.website-flow-nav [data-value="pages"]');
    await click(window,`[data-action="website-page"][data-value="${servicesId}"]`);
    await click(window,'.website-flow-nav [data-value="edit"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-section-card:first-child [data-field=heading]').value"),'Shared invitation');
    await fs.writeFile(join(evidence,'shared-sections.json'),JSON.stringify({status:'passed',sharedId,linkedEditPropagates:true,insertFocus:true,detachIndependent:true,detachUndoRedo:true,limits:'Linked sections within this website; catalogue consists of existing linked instances, not a separate global service'},null,2));



    await click(window, '.website-flow-nav [data-value="preview"]');
    const previewPages = await window.webContents.executeJavaScript("[...document.querySelector('#website-preview-page').options].map(o=>({id:o.value,title:o.textContent}))");
    for (const page of previewPages) {
      await window.webContents.executeJavaScript(`(() => { const control=document.querySelector('#website-preview-page'); control.focus(); control.value=${JSON.stringify(page.id)}; control.dispatchEvent(new Event('change',{bubbles:true})); })()`);
      const preview = await window.webContents.executeJavaScript("({html:document.querySelector('.website-preview iframe').srcdoc,sandbox:document.querySelector('.website-preview iframe').getAttribute('sandbox'),focused:document.activeElement.id})");
      assert.equal(preview.sandbox, '');
      assert.equal(preview.focused, 'website-preview-page');
      assert.ok(preview.html.includes('<title>' + page.title));
      assert.ok(preview.html.includes('--accent:#16715a'));
      assert.ok(preview.html.includes('Georgia,serif'));
      if(page.title==='Services') assert.match(preview.html,/Shared invitation/);
      if(page.title==='Home') assert.match(preview.html,/Independent invitation/);
      assert.ok(!preview.html.includes('href="index.html"') && !preview.html.includes('href="services.html"'));
    }
    const formattedPreview=await window.webContents.executeJavaScript("[...document.querySelector('#website-preview-page').options].find(x=>x.textContent==='Services').value");
    await window.webContents.executeJavaScript(`(() => {const control=document.querySelector('#website-preview-page');control.value=${JSON.stringify(formattedPreview)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const formattedHTML=await window.webContents.executeJavaScript("document.querySelector('.website-preview iframe').srcdoc");
    assert.match(formattedHTML,/<strong>Clear<\/strong> <em>words<\/em>/);
    assert.match(formattedHTML,/<ul><li>First benefit<\/li><li>Second benefit<\/li><\/ul>/);
    assert.match(formattedHTML,/&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);
    assert.doesNotMatch(formattedHTML,/<script>/);
    assert.match(formattedHTML,/<span class="action">Contact us<\/span>/);
    assert.doesNotMatch(formattedHTML,/href="#contact"/);
    assert.match(formattedHTML,/<span>Home<\/span><ul><li><span aria-current="page">Services<\/span>/);
    const download = new Promise((resolve, reject) => {
      const timer=setTimeout(()=>reject(Error('ZIP download timed out')),15000);
      window.webContents.session.once('will-download', (_event,item) => {
        const target=join(evidence,'synthetic-website.zip'); item.setSavePath(target);
        item.once('done',(_event,state)=>{clearTimeout(timer);state==='completed'?resolve({target,name:item.getFilename()}):reject(Error('ZIP download '+state));});
      });
    });
    await click(window, '[data-action="website-export-archive"]');
    const downloaded=await download;
    const zip=await fs.readFile(downloaded.target);
    assert.equal(zip.readUInt32LE(0),0x04034b50);
    assert.equal(zip.readUInt16LE(zip.length-12),2);
    assert.match(zip.toString('utf8'),/href="services.html"/);
    assert.match(zip.toString('utf8'),/href="index.html"/);
    assert.match(zip.toString('utf8'),/<strong>Clear<\/strong> <em>words<\/em>/);
    assert.doesNotMatch(zip.toString('utf8'),/<script>/);
    assert.match(zip.toString('utf8'),/<a class="action" href="index.html">Contact us<\/a>/);
    assert.doesNotMatch(zip.toString('utf8'),/href="#contact"/);
    assert.match(zip.toString('utf8'),/Shared invitation/);assert.match(zip.toString('utf8'),/Independent invitation/);
    assert.match(zip.toString('utf8'),/<a href="index.html">Home<\/a><ul><li><a href="services.html" aria-current="page">Services<\/a>/);
    await fs.writeFile(join(evidence,'website-management.json'),JSON.stringify({status:'passed',previewPages,download:{name:downloaded.name,bytes:zip.length,sha256:require('node:crypto').createHash('sha256').update(zip).digest('hex')},sandbox:'',globalStyle:{accent:'#16715a',font:'serif'},verified:['page reorder/remove/undo','section type/reorder/remove/undo','every preview page','actual ZIP download']},null,2));
    await capture(window, '13-multipage-preview');
    // Device-local checkpoints and real storage-failure recovery; no service approval.
    await click(window,'[data-action="website-save"]');
    await window.webContents.executeJavaScript("document.querySelector('#website-checkpoint-label').value='Before local review'");
    await click(window,'[data-action="website-checkpoint-create"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-action=website-checkpoint-restore]').length"),1);
    const checkpointFailure = await window.webContents.executeJavaScript(`(() => {
      const original=Storage.prototype.setItem;
      try {
        Storage.prototype.setItem=function(key,value){if(key.startsWith('meridian.website-checkpoints.'))throw Error('Synthetic checkpoint quota');return original.call(this,key,value);};
        document.querySelector('[data-action=website-checkpoint-create]').click();
        return {error:document.querySelector('.website-builder .studio-inline-error').textContent,count:document.querySelectorAll('[data-action=website-checkpoint-restore]').length};
      } finally { Storage.prototype.setItem=original; }
    })()`);
    assert.match(checkpointFailure.error,/Synthetic checkpoint quota/);assert.equal(checkpointFailure.count,1);
    await window.webContents.executeJavaScript("document.querySelector('#website-checkpoint-label').value='Retry checkpoint'");
    await click(window,'[data-action="website-checkpoint-create"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-action=website-checkpoint-restore]').length"),2);
    await window.webContents.executeJavaScript("document.querySelector('#website-checkpoint-label').value='Temporary removable checkpoint'");
    await click(window,'[data-action="website-checkpoint-create"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-action=website-checkpoint-restore]').length"),3);
    await click(window,'[data-action="website-checkpoint-remove"]');
    assert.equal(await window.webContents.executeJavaScript('document.activeElement.dataset.action'),'website-checkpoint-cancel');
    await click(window,'[data-action="website-checkpoint-cancel"]');
    assert.equal(await window.webContents.executeJavaScript('document.activeElement.dataset.action'),'website-checkpoint-remove');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-action=website-checkpoint-restore]').length"),3);
    await click(window,'[data-action="website-checkpoint-remove"]');
    await window.webContents.executeJavaScript("document.querySelector('.website-checkpoint-confirm').scrollIntoView({block:'center'})");
    await capture(window,'19-checkpoint-removal');
    const removeFailure=await window.webContents.executeJavaScript(`(() => {
      const original=Storage.prototype.setItem;
      try {
        Storage.prototype.setItem=function(key,value){if(key.startsWith('meridian.website-checkpoints.'))throw Error('Synthetic removal failure');return original.call(this,key,value);};
        document.querySelector('[data-action=website-checkpoint-confirm]').click();
        return {error:document.querySelector('.website-builder .studio-inline-error').textContent,count:document.querySelectorAll('[data-action=website-checkpoint-restore]').length};
      } finally { Storage.prototype.setItem=original; }
    })()`);
    assert.match(removeFailure.error,/Synthetic removal failure/);assert.equal(removeFailure.count,3);
    await click(window,'[data-action="website-checkpoint-confirm"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-action=website-checkpoint-restore]').length"),2);
    assert.equal(await window.webContents.executeJavaScript('document.activeElement.id'),'website-checkpoints-title');
    await fs.writeFile(join(evidence,'checkpoint-removal.json'),JSON.stringify({status:'passed',cancelRetainsCheckpoint:true,removeFailure,retryCount:2,focusRestored:true},null,2));
    await window.webContents.executeJavaScript("document.querySelector('.website-checkpoints').scrollIntoView({block:'center'})");
    await capture(window,'15-local-checkpoints');
    await click(window,'.website-flow-nav [data-value="brief"]');
    await window.webContents.executeJavaScript(`(() => { const field=document.querySelector('#website-brief-audience');field.value='Changed after checkpoint';field.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    const saveFailure = await window.webContents.executeJavaScript(`(() => {
      const original=Storage.prototype.setItem;
      try {
        Storage.prototype.setItem=function(key,value){if(key.startsWith('meridian.website.')&&!key.endsWith('.pending')&&!key.endsWith('.backup')&&!key.endsWith('.index'))throw Error('Synthetic primary quota');return original.call(this,key,value);};
        document.querySelector('[data-action=website-save]').click();
        return {error:document.querySelector('.website-builder .studio-inline-error').textContent,audience:document.querySelector('#website-brief-audience').value,dirty:document.querySelector('.website-save-state').textContent};
      } finally { Storage.prototype.setItem=original; }
    })()`);
    assert.match(saveFailure.error,/Synthetic primary quota/);assert.equal(saveFailure.audience,'Changed after checkpoint');assert.equal(saveFailure.dirty,'Action needs attention');
    await window.webContents.executeJavaScript("document.querySelector('.website-builder .studio-inline-error').scrollIntoView({block:'center'})");
    await capture(window,'16-website-save-failure');
    await click(window,'[data-action="website-save"]');
    await click(window,'.website-flow-nav [data-value="preview"]');
    await click(window,'[data-action="website-checkpoint-restore"]');
    assert.equal((await metrics(window)).audience,'Independent local businesses');
    assert.match((await metrics(window)).saveText,/Unsaved changes/);
    await click(window,'[data-action="website-undo"]');assert.equal((await metrics(window)).audience,'Changed after checkpoint');
    await click(window,'[data-action="website-redo"]');assert.equal((await metrics(window)).audience,'Independent local businesses');
    await fs.writeFile(join(evidence,'checkpoint-review.json'),JSON.stringify({status:'passed',checkpointCount:2,checkpointFailure,saveFailure,restoredAsUnsaved:true,undoRedo:true,limits:'Device-local synthetic draft snapshots, never authoritative review or approval'},null,2));
    await click(window, '[data-action="website-device"][data-value="phone"]');
    assert.equal((await metrics(window)).frameSandbox, '');
    const phoneWidth = await window.webContents.executeJavaScript("document.querySelector('.website-preview iframe').getBoundingClientRect().width");
    assert.ok(phoneWidth <= 376);
    await capture(window, '03-phone-preview');
    await click(window, '[data-action="website-list"]');
    await waitFor(window, '#studio-leave-title');
    assert.equal(await window.webContents.executeJavaScript("document.activeElement.dataset.action"), 'keep-editing');
    await window.webContents.executeJavaScript(`(() => {
      document.querySelector('[data-action="save-leave"]').focus();
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
    })()`);
    assert.equal(await window.webContents.executeJavaScript("document.activeElement.dataset.action"), 'keep-editing');
    await click(window, '[data-action="keep-editing"]');
    assert.equal((await metrics(window)).audience, 'Independent local businesses');

    // Exercise the composed Website -> mounted Assets -> Website guards in the
    // real renderer, not a shell-only or mocked Asset client.
    await window.webContents.executeJavaScript(`(() => {
      const input=document.querySelector('#website-brief-audience');
      input.value='Combined guard retained content'; input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await click(window, '[data-action="surface"][data-value="assets"]');
    await waitFor(window, '#studio-leave-title');
    const modalFocus = await window.webContents.executeJavaScript("document.activeElement.dataset.action");
    assert.equal(modalFocus, 'keep-editing');
    await click(window, '[data-action="keep-editing"]');
    assert.equal((await metrics(window)).audience, 'Combined guard retained content');
    await click(window, '[data-action="surface"][data-value="assets"]');
    await click(window, '[data-action="save-leave"]');
    await waitFor(window, '#studio-asset-client input[type="file"]');
    await window.webContents.executeJavaScript(`(() => {
      const file=document.querySelector('#studio-asset-client input[type="file"]');
      const transfer=new DataTransfer(); transfer.items.add(new File(['synthetic integration'],'integration-notes.txt',{type:'text/plain'}));
      file.files=transfer.files; file.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await click(window, '#studio-asset-client ul li button');
    await waitFor(window, '#studio-asset-client [data-focus="name"]');
    if (compositionMode) {
      const tokens = await window.webContents.executeJavaScript(`(() => {
        const host=document.querySelector('#studio-asset-client');const field=host.querySelector('[data-focus=name]');
        return {color:getComputedStyle(host).color,panel:getComputedStyle(host).backgroundColor,border:getComputedStyle(field).borderTopColor,font:getComputedStyle(host).fontFamily,
          forcedColors:matchMedia('(forced-colors:active)').matches,continuationHelper:typeof StudioAssetModel.assertContinuation,
          resultCount:[...host.querySelectorAll('[role=status]')].some(el=>el.textContent==='1 matching asset.')};
      })()`);
      assert.equal(tokens.continuationHelper,'function');
      assert.equal(tokens.resultCount,true);
      if (!tokens.forcedColors) {
        assert.equal(tokens.color,'rgb(242, 246, 251)');
        assert.equal(tokens.panel,'rgb(14, 27, 46)');
        assert.equal(tokens.border,'rgb(166, 181, 202)');
      }
      assert.match(tokens.font,/Inter/);
      await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [data-focus=name]').focus()");
      window.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});
      window.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});
      await pause(80);
      assert.equal(await window.webContents.executeJavaScript('document.activeElement.dataset.focus'),'tags');
      await fs.writeFile(join(evidence,'composition-tokens.json'),JSON.stringify(tokens,null,2));
      await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [data-focus=name]').scrollIntoView({block:'center'})");
      await capture(window,'14-composed-asset-tokens');
    }
    await window.webContents.executeJavaScript(`(() => {
      const input=document.querySelector('#studio-asset-client [data-focus="name"]');
      input.value='UNSAVED COMBINED ASSET'; input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await click(window, '[data-action="surface"][data-value="website"]');
    await waitFor(window, '#studio-asset-client [aria-label="Unsaved host transition"]');
    const warningVisible = await window.webContents.executeJavaScript(`(() => {
      const warning=document.querySelector('#studio-asset-client [aria-label="Unsaved host transition"]');warning.scrollIntoView({block:'center'});
      const bounds=warning.getBoundingClientRect(),workspace=document.querySelector('.studio-workspace').getBoundingClientRect();
      return {text:warning.textContent,visible:bounds.top>=workspace.top && bounds.bottom<=innerHeight,
        controls:[...warning.querySelectorAll('button')].map(button=>({text:button.textContent,disabled:button.disabled}))};
    })()`);
    assert.equal(warningVisible.visible,true,'Actual composed warning must fit before capture');
    assert.match(warningVisible.text,/Unsaved asset metadata/);
    assert.deepEqual(warningVisible.controls.map(control=>control.text),['Keep editing','Discard changes and leave']);
    assert.ok(warningVisible.controls.every(control=>!control.disabled));
    await capture(window, '05-composed-asset-warning');
    if (compositionMode) {
      await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"] button').focus()");
      window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});
      window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
      await until(window,"!document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"]')");
      assert.equal(await window.webContents.executeJavaScript('document.activeElement.dataset.focus'),'name');
      assert.equal(await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [data-focus=name]').value"),'UNSAVED COMBINED ASSET');
      await click(window,'[data-action="surface"][data-value="website"]');
      await waitFor(window,'#studio-asset-client [aria-label="Unsaved host transition"]');
      await fs.writeFile(join(evidence,'composition-keyboard.json'),JSON.stringify({actualTab:'name to tags',actualEscape:'inline warning cancelled, dirty value retained, focus name',source:'Pinned composition manifest in test-output/composition/inputs.json',limits:'Not Narrator speech; not a modal/inert claim'},null,2));
    }
    await window.webContents.executeJavaScript("[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Keep editing').click()");
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#studio-asset-client [data-focus=name]').value"), 'UNSAVED COMBINED ASSET');
    await click(window, '[data-action="surface"][data-value="website"]');
    await until(window, "Boolean(document.querySelector('#studio-asset-client [aria-label=\"Unsaved host transition\"]'))");
    await window.webContents.executeJavaScript("[...document.querySelectorAll('#studio-asset-client button')].find(x=>x.textContent==='Discard changes and leave').click()");
    await waitFor(window, '#website-brief-audience');
    assert.equal((await metrics(window)).audience, 'Combined guard retained content');

    await click(window, '[data-action="surface"][data-value="editor"]');
    await waitFor(window, '#studio-scene-title');
    await window.webContents.executeJavaScript(`(() => {
      const input=document.querySelector('#studio-scene-title');
      input.value='Combined scene proof'; input.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await click(window, '[data-action="asset-select"][data-value="asset-ridge"]');
    await click(window, '[data-action="asset-place"]');
    await click(window, '[data-action="save"]');
    await until(window, "[...document.querySelectorAll('.studio-save-cluster .studio-pill')].some(x=>x.textContent==='Saved')");
    await window.webContents.executeJavaScript(`(() => {
      const field=document.querySelector('#studio-scene-format');field.value='9:16 vertical';field.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await click(window, '[data-action="save"]');
    await until(window, "[...document.querySelectorAll('.studio-save-cluster .studio-pill')].some(x=>x.textContent==='Saved')");
    await window.webContents.executeJavaScript(`(() => {
      const field=document.querySelector('#studio-scene-format');field.value='1:1 square';field.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await click(window, '[data-action="surface"][data-value="operations"]');
    await waitFor(window, '#studio-leave-title');
    await click(window, '[data-action="discard-leave"]');
    await click(window, '[data-action="surface"][data-value="editor"]');
    await waitFor(window, '#studio-scene-format');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#studio-scene-format').value"),'9:16 vertical');
    await fs.writeFile(join(evidence,'scene-format.json'),JSON.stringify({status:'passed',saved:'9:16 vertical',discarded:'1:1 square',restored:'9:16 vertical'},null,2));
    await click(window,'[data-action="submit-review"]');
    await until(window,"[...document.querySelectorAll('.studio-save-cluster .studio-pill')].some(item=>item.textContent==='Needs review')");
    const reviewedScene=await window.webContents.executeJavaScript("document.querySelector('[data-action=scene][aria-current]')?.dataset.value || document.querySelector('[data-action=scene].is-current')?.dataset.value || document.querySelector('[data-action=scene]').dataset.value");
    const otherScene=await window.webContents.executeJavaScript("[...document.querySelectorAll('[data-action=scene]')].find(item=>item.dataset.value!=="+JSON.stringify(reviewedScene)+").dataset.value");
    await click(window,`[data-action="scene"][data-value="${otherScene}"]`);
    await click(window,`[data-action="scene"][data-value="${reviewedScene}"]`);
    assert.equal(await window.webContents.executeJavaScript("[...document.querySelectorAll('.studio-save-cluster .studio-pill')].some(item=>item.textContent==='Needs review')"),true);
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#studio-scene-format').value"),'9:16 vertical');
    await fs.writeFile(join(evidence,'scene-review-state.json'),JSON.stringify({status:'passed',localReviewSurvivesReopen:true,frameRetained:true,limits:'Synthetic memory only; no authoritative review submission'},null,2));
    await capture(window, '06-storyboard-material');
    await click(window, '[data-action="scene-to-website"]');
    await waitFor(window, '#website-page-editor-title');
    assert.equal((await metrics(window)).currentStep, 'edit');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-page-title').value"), 'Combined scene proof');
    await click(window, '[data-action="website-save"]');
    await click(window, '[data-action="surface"][data-value="handoff"]');
    await waitFor(window, '#studio-handoff-title');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-surface=handoff] button:disabled').length"), 3);
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-readiness]').length"),5);
    await capture(window, '07-review-handoff');
    await click(window, '[data-action="surface"][data-value="website"]');
    await click(window, '[data-action="website-save"]');
    assert.match((await metrics(window)).saveText, /Saved in this app/);
    await click(window, '[data-action="website-list"]');
    await click(window, '[data-action="website-open"]');
    assert.equal((await metrics(window)).currentStep, 'brief');
    assert.equal((await metrics(window)).audience, 'Combined guard retained content');
    assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[data-action=website-checkpoint-restore]').length"),2);

    await click(window,'[data-action="surface"][data-value="states"]');
    await waitFor(window,'#studio-job-scenario');
    await window.webContents.executeJavaScript("document.querySelector('#studio-job-scenario').value='uncertain'");
    await click(window,'[data-action="job-scenario-load"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('[data-action=job-retry]').disabled"),true);
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.studio-job-status progress').hasAttribute('value')"),false);
    assert.equal(await jobRecoveryVisible(window),true,'Recovery state and controls fit: 26-job-unknown-completion');
    await capture(window,'26-job-unknown-completion');
    const firstRequest=await window.webContents.executeJavaScript("document.querySelector('.studio-job-status').dataset.jobRequest");
    await click(window,'[data-action="job-resolve"][data-value="not-started"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.studio-job-status').dataset.jobStatus"),'failed');
    await click(window,'[data-action="job-retry"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.studio-job-status').dataset.jobAttempt"),'2');
    assert.notEqual(await window.webContents.executeJavaScript("document.querySelector('.studio-job-status').dataset.jobRequest"),firstRequest);
    await click(window,'[data-action="job-cancel"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.studio-job-status').dataset.jobStatus"),'cancelling');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('[data-action=job-retry]').disabled"),true);
    assert.equal(await jobRecoveryVisible(window),true,'Recovery state and controls fit: 27-job-cancellation-pending');
    await capture(window,'27-job-cancellation-pending');
    await click(window,'[data-action="job-resolve"][data-value="completed"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.studio-job-status').dataset.jobStatus"),'completed');
    for(const scenario of ['denied','cost-denied','revoked']) {
      await window.webContents.executeJavaScript(`document.querySelector('#studio-job-scenario').value=${JSON.stringify(scenario)}`);
      await click(window,'[data-action="job-scenario-load"]');
      const blocked=await window.webContents.executeJavaScript("({status:document.querySelector('.studio-job-status').dataset.jobStatus,retry:document.querySelector('[data-action=job-retry]').disabled,cancel:!!document.querySelector('[data-action=job-cancel]'),resolve:!!document.querySelector('[data-action=job-resolve]')})");
      assert.equal(blocked.status,scenario);assert.equal(blocked.retry,true);assert.equal(blocked.cancel,false);assert.equal(blocked.resolve,false);
      if(scenario==='denied') {assert.equal(await jobRecoveryVisible(window),true,'Denied state and reason fit');await capture(window,'28-job-action-denied');}
    }
    const jobProject=await window.webContents.executeJavaScript("document.querySelector('#studio-project-select').value");
    const otherJobProject=await window.webContents.executeJavaScript("[...document.querySelector('#studio-project-select').options].find(option=>option.value&&option.value!==document.querySelector('#studio-project-select').value).value");
    await window.webContents.executeJavaScript(`(() => {const control=document.querySelector('#studio-project-select');control.value=${JSON.stringify(otherJobProject)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await until(window,`document.querySelector('.studio-job-status')?.dataset.jobStatus==='idle' && document.querySelector('.studio-job-status')?.dataset.jobProject===${JSON.stringify(otherJobProject)}`);
    await window.webContents.executeJavaScript(`(() => {const control=document.querySelector('#studio-project-select');control.value=${JSON.stringify(jobProject)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await until(window,`document.querySelector('.studio-job-status')?.dataset.jobStatus==='idle' && document.querySelector('.studio-job-status')?.dataset.jobProject===${JSON.stringify(jobProject)}`);
    await fs.writeFile(join(evidence,'job-recovery-states.json'),JSON.stringify({status:'passed',unknownBlocksRetry:true,reconciliationBeforeRetry:true,newAttemptIdentity:true,cancelWaitsForOutcome:true,completionRace:true,deniedActionsBlocked:true,projectSwitchClears:true,limits:'Development-only state exercise, no service calls or real permission/job authority'},null,2));
    await click(window,'[data-action="surface"][data-value="website"]');
    await waitFor(window,'#website-new-name');
    await click(window,'[data-action="website-open"]');
    await click(window,'.website-flow-nav [data-value="pages"]');
    await click(window,`[data-action="website-page"][data-value="${servicesId}"]`);
    await click(window,'.website-flow-nav [data-value="edit"]');
    const originalPage=await window.webContents.executeJavaScript("({title:document.querySelector('#website-page-title').value,slug:document.querySelector('#website-page-slug').value})");
    await window.webContents.executeJavaScript(`(() => {
      const title=document.querySelector('#website-page-title');title.value='P'.repeat(120);title.dispatchEvent(new Event('input',{bubbles:true}));
      const slug=document.querySelector('#website-page-slug');slug.value='s'.repeat(120);slug.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    window.setSize(1280, 900);
    window.webContents.setZoomFactor(2);
    await pause(200);
    for (const step of ['brief', 'pages', 'edit', 'preview']) {
      await click(window, '.website-flow-nav [data-value="' + step + '"]');
      if (!(await metrics(window)).fits) {
        const overflow=await window.webContents.executeJavaScript("[...document.querySelectorAll('.website-builder,.website-builder *')].filter(el=>getComputedStyle(el).display!=='none'&&el.clientWidth>0&&el.scrollWidth>el.clientWidth+1).map(el=>({tag:el.tagName,id:el.id,class:el.className,width:el.clientWidth,scroll:el.scrollWidth,text:el.textContent.slice(0,160)})).slice(0,20)");
        await fs.writeFile(join(evidence,'long-label-overflow.json'),JSON.stringify({step,overflow},null,2));console.error('Long-label overflow',overflow);
      }
      assert.equal((await metrics(window)).fits, true, '200% fit: ' + step);
      assert.equal((await metrics(window)).usableHeight, true, '200% usable editor height: ' + step);
      assert.equal((await metrics(window)).focusedHeadingVisible, true, '200% focused heading visible: ' + step);
      if(step==='pages') await capture(window,'25-long-page-labels-200pct');
    }
    await capture(window, '04-preview-200pct');
    await fs.writeFile(join(evidence,'long-page-labels.json'),JSON.stringify({status:'passed',titleLength:120,slugLength:120,zoom:2,allStepsFit:true},null,2));
    await click(window,'.website-flow-nav [data-value="edit"]');
    await window.webContents.executeJavaScript(`(() => {
      const title=document.querySelector('#website-page-title');title.value=${JSON.stringify(originalPage.title)};title.dispatchEvent(new Event('input',{bubbles:true}));
      const slug=document.querySelector('#website-page-slug');slug.value=${JSON.stringify(originalPage.slug)};slug.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    await click(window,'[data-action="website-save"]');
    await click(window,'.website-flow-nav [data-value="preview"]');

    window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}, {name:'forced-colors',value:'active'}] });
    const media = await window.webContents.executeJavaScript("({reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,forcedColors:matchMedia('(forced-colors: active)').matches})");
    assert.equal(media.reducedMotion, true); assert.equal(media.forcedColors, true);
    await capture(window, '08-emulated-forced-colors');
    window.webContents.debugger.detach();
    const employee = new BrowserWindow({width:1440,height:1000,show:true,webPreferences:{preload:join(root,'docs/studio/design/9/runtime-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false,backgroundThrottling:false,additionalArguments:['--studio-evidence-mode=employee']}});
    await employee.loadFile(join(root,'src/renderer/index.html'));
    await waitFor(employee,'#projectsMasterList .project-item');
    await employee.webContents.executeJavaScript("switchView('studio')");
    const employeeGate = await employee.webContents.executeJavaScript(`({disabled:document.querySelector('#nav-studio-link').disabled,hidden:document.querySelector('#studioCenter').hidden,syntheticLoaded:[...document.scripts].some(s=>s.src.includes('studio-ui/studio-shell.js'))})`);
    assert.equal(employeeGate.disabled,true); assert.equal(employeeGate.hidden,true); assert.equal(employeeGate.syntheticLoaded,false);
    await capture(employee,'09-employee-unavailable'); employee.destroy();
    await fs.writeFile(join(evidence, 'results.json'), JSON.stringify({ status: 'passed', osHighContrast: { required: requireOSHighContrast, enabled: nativeTheme.shouldUseHighContrastColors }, media, employeeGate, lastMetrics: await metrics(window), verified: ['four panels', 'focus after navigation', 'modal keyboard wrapping', 'unsaved edits retained', 'phone width', 'sandbox preserved', 'dirty list guard', 'save/list/reopen', 'Website/Assets composed guards', 'synthetic scene references', 'scene-to-page provenance', 'unavailable authoritative handoff', 'all steps at 200%', 'emulated forced colors/reduced motion', 'employee gate'] }, null, 2));
    // Simulate an already committed write from another window through its local record.
    await click(window,'.website-flow-nav [data-value="brief"]');
    const conflictOriginal=await window.webContents.executeJavaScript(`(() => {
      const key=Object.keys(localStorage).find(key=>key.startsWith('meridian.website.')&&!key.endsWith('.index')&&!key.endsWith('.backup')&&!key.endsWith('.pending'));
      const record=JSON.parse(localStorage.getItem(key));record.revision++;record.brief.goal='Newer external-window goal';localStorage.setItem(key,JSON.stringify(record));
      const field=document.querySelector('#website-brief-goal');field.value='Keep my separate copy';field.dispatchEvent(new Event('input',{bubbles:true}));return {key,id:record.id};
    })()`);
    await click(window,'[data-action="website-save"]');
    assert.match(await window.webContents.executeJavaScript("document.querySelector('.website-builder').textContent"),/changed elsewhere/);
    await click(window,'[data-action="website-save-copy"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-brief-goal').value"),'Keep my separate copy');
    assert.match((await metrics(window)).saveText,/Separate website copy saved/);
    const copyCheck=await window.webContents.executeJavaScript(`(() => {
      const original=JSON.parse(localStorage.getItem(${JSON.stringify(conflictOriginal.key)}));
      const copies=Object.keys(localStorage).filter(key=>key.startsWith('meridian.website.')&&!key.endsWith('.index')&&!key.endsWith('.backup')&&!key.endsWith('.pending')).map(key=>JSON.parse(localStorage.getItem(key))).filter(record=>record.id!==${JSON.stringify(conflictOriginal.id)});
      return {originalGoal:original.brief.goal,copies:copies.length,copyGoal:copies[0]?.brief.goal,identityDistinct:copies[0]?.id!==original.id};
    })()`);
    assert.equal(copyCheck.originalGoal,'Newer external-window goal');assert.equal(copyCheck.copyGoal,'Keep my separate copy');assert.equal(copyCheck.copies,1);assert.equal(copyCheck.identityDistinct,true);
    assert.equal(await window.webContents.executeJavaScript("(() => {const r=document.querySelector('.website-flow-status').getBoundingClientRect(),w=document.querySelector('.studio-workspace').getBoundingClientRect();return document.activeElement.classList.contains('website-flow-status')&&r.top>=w.top-1&&r.bottom<=w.bottom+1;})()"),true,'Copy outcome must be focused and visible');
    await capture(window,'31-separate-copy-saved');
    await fs.writeFile(join(evidence,'separate-copy.json'),JSON.stringify({status:'passed',...copyCheck,limits:'Observed committed local change is simulated; not atomic cross-process CAS'},null,2));
    const recoveryFixture=await window.webContents.executeJavaScript(`(() => {
      const original=JSON.parse(localStorage.getItem(${JSON.stringify(conflictOriginal.key)}));
      const record={...original,id:'website-recovery-evidence',name:'Recovery-only synthetic website'};
      const key='meridian.website.'+encodeURIComponent(record.meridianProjectId)+'.'+encodeURIComponent(record.id);
      localStorage.setItem(key+'.pending',JSON.stringify(record));return {key,record};
    })()`);
    await click(window,'[data-action="website-list"]');
    await click(window,'[data-action="website-open"][data-value="website-recovery-evidence"]');
    assert.match(await window.webContents.executeJavaScript("document.querySelector('#website-builder-title').textContent"),/Recovery-only/);
    await window.webContents.executeJavaScript(`for(const suffix of ['', '.backup','.pending'])localStorage.setItem(${JSON.stringify(recoveryFixture.key)}+suffix,'{malformed')`);
    await click(window,'[data-action="website-list"]');
    await waitFor(window,'#website-recovery-title');
    await click(window,'[data-action="website-open"][data-value="website-recovery-evidence"]');
    assert.equal(await window.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(recoveryFixture.key)})`),'{malformed');
    assert.equal(await window.webContents.executeJavaScript("document.activeElement.dataset.value"),'website-recovery-evidence','Failed recovery retains retry focus');
    await window.webContents.executeJavaScript("const heading=document.querySelector('#website-recovery-title');heading.focus({preventScroll:true});heading.closest('section').scrollIntoView({block:'start'})");
    assert.equal(await window.webContents.executeJavaScript("(() => {const r=document.querySelector('#website-recovery-title').closest('section').getBoundingClientRect(),w=document.querySelector('.studio-workspace').getBoundingClientRect();return r.top>=w.top-1&&r.bottom<=w.bottom+1;})()"),true,'Retained-record warning and retry must be visible');
    await capture(window,'32-retained-record-recovery');
    await window.webContents.executeJavaScript(`localStorage.setItem(${JSON.stringify(recoveryFixture.key)},${JSON.stringify(JSON.stringify(recoveryFixture.record))})`);
    await click(window,'[data-action="website-open"][data-value="website-recovery-evidence"]');
    assert.match(await window.webContents.executeJavaScript("document.querySelector('#website-builder-title').textContent"),/Recovery-only/);
    // Recovery must remain readable when all storage writes are rejected.
    await window.webContents.executeJavaScript(`(() => {
      const key=${JSON.stringify(recoveryFixture.key)},record=${JSON.stringify(recoveryFixture.record)};
      localStorage.setItem(key+'.backup',JSON.stringify(record));localStorage.setItem(key,'{broken');localStorage.removeItem(key+'.pending');
      window.__recoveryStorageWrite=Storage.prototype.setItem;window.__recoveryWriteAttempts=0;
      Storage.prototype.setItem=function(){window.__recoveryWriteAttempts++;throw new Error('Synthetic storage full');};
    })()`);
    try {
      await click(window,'[data-action="website-list"]');
      await click(window,'[data-action="website-open"][data-value="website-recovery-evidence"]');
      assert.match((await metrics(window)).saveText,/recovery copy/);
      assert.equal(await window.webContents.executeJavaScript('window.__recoveryWriteAttempts'),0,'Catalogue/open must not write recovery records');
      assert.equal(await window.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(recoveryFixture.key)})`),'{broken');
      await window.webContents.executeJavaScript("const status=document.querySelector('.website-flow-status');status.focus({preventScroll:true});status.scrollIntoView({block:'start'});");
      assert.equal(await window.webContents.executeJavaScript("(() => {const r=document.querySelector('.website-flow-status').getBoundingClientRect(),w=document.querySelector('.studio-workspace').getBoundingClientRect();return r.top>=w.top-1&&r.bottom<=w.bottom+1;})()"),true,'Recovery message must be visibly captured');
      await capture(window,'33-write-blocked-recovery');
      await window.webContents.executeJavaScript("const field=document.querySelector('#website-brief-goal');field.value='Retain recovered edits while storage is full';field.dispatchEvent(new Event('input',{bubbles:true}));");
      await click(window,'[data-action="website-save"]');
      assert.match((await metrics(window)).saveText,/Save failed/);
      assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-brief-goal').value"),'Retain recovered edits while storage is full');
    } finally {
      await window.webContents.executeJavaScript('Storage.prototype.setItem=window.__recoveryStorageWrite;delete window.__recoveryStorageWrite;delete window.__recoveryWriteAttempts');
    }
    await click(window,'[data-action="website-save"]');
    assert.match((await metrics(window)).saveText,/Website saved in this app on this device/);
    const explicitRecoverySave=await window.webContents.executeJavaScript(`(() => {
      const key=${JSON.stringify(recoveryFixture.key)};return {primaryGoal:JSON.parse(localStorage.getItem(key)).brief.goal,backup:JSON.parse(localStorage.getItem(key+'.backup'))};
    })()`);
    assert.equal(explicitRecoverySave.primaryGoal,'Retain recovered edits while storage is full');
    assert.deepEqual(explicitRecoverySave.backup,recoveryFixture.record);
    await fs.writeFile(join(evidence,'write-blocked-recovery.json'),JSON.stringify({status:'passed',catalogueAndOpenWriteAttempts:0,recoveryMessageVisible:true,originalBytesKept:true,failedSaveRetainsEdits:true,explicitRetrySaves:true,validatedBackupPreserved:true,limits:'Synthetic write rejection in mounted renderer; not physical disk exhaustion'},null,2));
    const copyRetryBefore=await window.webContents.executeJavaScript(`(() => {
      const repo=window.MeridianWebsiteBuilder.createRepository(localStorage,${JSON.stringify(recoveryFixture.record.meridianProjectId)});
      const before=repo.list().map(item=>item.id),source=localStorage.getItem(${JSON.stringify(recoveryFixture.key)});
      window.__copyRetryStorageWrite=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key.endsWith('.index'))throw new Error('Synthetic index failure');return window.__copyRetryStorageWrite.call(this,key,value);};
      return {before,source};
    })()`);
    let retainedCopy;
    try {
      await click(window,'[data-action="website-save-copy"]');
      assert.match((await metrics(window)).saveText,/Separate copy could not be saved/);
      retainedCopy=await window.webContents.executeJavaScript(`(() => {
        const repo=window.MeridianWebsiteBuilder.createRepository(localStorage,${JSON.stringify(recoveryFixture.record.meridianProjectId)});
        return repo.list().filter(item=>!${JSON.stringify(copyRetryBefore.before)}.includes(item.id)).map(item=>item.id);
      })()`);
      assert.equal(retainedCopy.length,1,'A partially written copy has one retained identity');
      await window.webContents.executeJavaScript("(() => {const field=document.querySelector('#website-brief-tone');field.value='Retained after partial copy failure';field.dispatchEvent(new Event('input',{bubbles:true}));})()");
    } finally {
      await window.webContents.executeJavaScript('Storage.prototype.setItem=window.__copyRetryStorageWrite;delete window.__copyRetryStorageWrite');
    }
    await click(window,'[data-action="website-save-copy"]');
    assert.match((await metrics(window)).saveText,/Separate website copy saved/);
    const copyRetryAfter=await window.webContents.executeJavaScript(`(() => {
      const repo=window.MeridianWebsiteBuilder.createRepository(localStorage,${JSON.stringify(recoveryFixture.record.meridianProjectId)});
      return {newIds:repo.list().filter(item=>!${JSON.stringify(copyRetryBefore.before)}.includes(item.id)).map(item=>item.id),copy:repo.open(${JSON.stringify(retainedCopy?.[0])}),source:localStorage.getItem(${JSON.stringify(recoveryFixture.key)})};
    })()`);
    assert.deepEqual(copyRetryAfter.newIds,retainedCopy);assert.equal(copyRetryAfter.source,copyRetryBefore.source);
    assert.equal(copyRetryAfter.copy.brief.tone,'Retained after partial copy failure');
    await capture(window,'34-copy-retry-saved');
    await fs.writeFile(join(evidence,'copy-retry-idempotency.json'),JSON.stringify({status:'passed',oneRetainedIdentity:true,retryReusesIdentity:true,newEditsIncluded:true,originalBytesUnchanged:true,limits:'Synthetic index write failure in mounted development UI; session-local retry identity'},null,2));
    await window.webContents.executeJavaScript(`(() => {const key='meridian.website.'+encodeURIComponent(${JSON.stringify(recoveryFixture.record.meridianProjectId)})+'.'+encodeURIComponent(${JSON.stringify(retainedCopy?.[0])});for(const suffix of ['', '.backup','.pending'])localStorage.removeItem(key+suffix);})()`);
    await window.webContents.executeJavaScript(`for(const suffix of ['', '.backup','.pending'])localStorage.removeItem(${JSON.stringify(recoveryFixture.key)}+suffix)`);
    await click(window,'[data-action="website-list"]');
    assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('#website-recovery-title'))"),false);
    await fs.writeFile(join(evidence,'retained-record-recovery.json'),JSON.stringify({status:'passed',pendingOnlyDiscovered:true,malformedRecordVisible:true,failedRetryPreservesRecord:true,failedRetryFocusRetained:true,repairedRetryOpens:true,warningClearsAfterRemoval:true,limits:'Synthetic local-storage fixture; no automatic repair or data deletion by application'},null,2));
    await click(window,'[data-action="website-open"][data-value="'+conflictOriginal.id+'"]');
    const catalogueBytes=await window.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(conflictOriginal.key)})`);
    await window.webContents.executeJavaScript("window.__catalogueStorageKey=Storage.prototype.key;Storage.prototype.key=function(){throw new Error('Synthetic enumeration denied');};void 0;");
    try {
      await click(window,'[data-action="website-list"]');
      await waitFor(window,'#website-catalogue-retry');
      assert.doesNotMatch(await window.webContents.executeJavaScript("document.querySelector('.website-builder').textContent"),/No website projects have been saved|0 saved projects/);
      await click(window,'#website-catalogue-retry');
      assert.equal(await window.webContents.executeJavaScript('document.activeElement.id'),'website-catalogue-retry');
      await window.webContents.executeJavaScript("(() => {const heading=document.querySelector('#website-catalogue-title');heading.focus({preventScroll:true});heading.closest('section').scrollIntoView({block:'start'});})()");
      assert.equal(await window.webContents.executeJavaScript("(() => {const r=document.querySelector('#website-catalogue-title').closest('section').getBoundingClientRect(),w=document.querySelector('.studio-workspace').getBoundingClientRect();return r.top>=w.top-1&&r.bottom<=w.bottom+1;})()"),true,'Catalogue warning and retry must be visible');
      await capture(window,'35-catalogue-access-retry');
    } finally {
      await window.webContents.executeJavaScript('Storage.prototype.key=window.__catalogueStorageKey;delete window.__catalogueStorageKey');
    }
    await click(window,'#website-catalogue-retry');
    assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('#website-catalogue-title'))"),false);
    assert.equal(await window.webContents.executeJavaScript('document.activeElement.id'),'website-saved-title');
    assert.equal(await window.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(conflictOriginal.key)})`),catalogueBytes);
    await fs.writeFile(join(evidence,'catalogue-access-retry.json'),JSON.stringify({status:'passed',listingFailureVisible:true,noFalseEmptyClaim:true,failedRetryFocusRetained:true,retryAfterStorageReturn:true,savedHeadingFocused:true,originalBytesUnchanged:true,limits:'Synthetic Storage.key denial; no actual storage permission changed'},null,2));
    await click(window,'[data-action="surface"][data-value="editor"]');
    await waitFor(window,'#studio-scene-notes');
    await window.webContents.executeJavaScript("(() => {const field=document.querySelector('#studio-scene-notes');field.value='Keep editing after the save acknowledgement';field.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click(window,'[data-action="surface"][data-value="states"]');
    await waitFor(window,'#studio-leave-title');
    await window.webContents.executeJavaScript("document.querySelector('[data-action=save-leave]').click();document.querySelector('[data-action=keep-editing]').click();void 0;");
    await until(window,"Boolean(document.querySelector('[data-surface=editor] .studio-pill--saved'))");
    assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('#studio-leave-title'))"),false);
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#studio-scene-notes').value"),'Keep editing after the save acknowledgement');
    await capture(window,'36-keep-editing-save-acknowledgement');
    await window.webContents.executeJavaScript("(() => {const field=document.querySelector('#studio-scene-notes');field.value='Protect the newer leave choice';field.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click(window,'[data-action="surface"][data-value="states"]');
    await window.webContents.executeJavaScript("document.querySelector('[data-action=save-leave]').click();document.querySelector('[data-action=keep-editing]').click();document.querySelector('[data-action=surface][data-value=operations]').click();void 0;");
    await until(window,"Boolean(document.querySelector('[data-surface=editor] .studio-pill--saved'))");
    assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('#studio-leave-title'))"),true,'Old acknowledgement cannot clear the newer leave dialog');
    await click(window,'[data-action="discard-leave"]');
    await until(window,"Boolean(document.querySelector('[data-surface=operations]'))");
    await fs.writeFile(join(evidence,'leave-save-race.json'),JSON.stringify({status:'passed',cancelledNavigationNotRevived:true,savedNotesRetained:true,newerDialogNotCleared:true,newTargetUsedAfterExplicitChoice:true,limits:'Synthetic adapter save acknowledgements in mounted renderer; no service write'},null,2));
    await click(window,'[data-action="surface"][data-value="website"]');
    await waitFor(window,'[data-action="website-open"][data-value="'+conflictOriginal.id+'"]');
    await click(window,'[data-action="website-open"][data-value="'+conflictOriginal.id+'"]');
    const identityFixture=await window.webContents.executeJavaScript(`(() => {
      const original=JSON.parse(localStorage.getItem(${JSON.stringify(conflictOriginal.key)}));
      const record={...original,id:'website-identity-escape-evidence',name:'Escaped identity synthetic draft'};
      record.pages[0].sections[0].id='section" data-meridian-identity-probe="present';
      const key='meridian.website.'+encodeURIComponent(record.meridianProjectId)+'.'+encodeURIComponent(record.id);
      localStorage.setItem(key,JSON.stringify(record));return {key,id:record.id,sectionId:record.pages[0].sections[0].id};
    })()`);
    await click(window,'[data-action="website-list"]');
    await click(window,'[data-action="website-open"][data-value="'+identityFixture.id+'"]');
    await click(window,'.website-flow-nav [data-value="edit"]');
    assert.equal(await window.webContents.executeJavaScript("Boolean(document.querySelector('[data-meridian-identity-probe]'))"),false,'Stored identity cannot create an HTML attribute');
    assert.equal(await window.webContents.executeJavaScript(`Boolean(document.getElementById('website-'+${JSON.stringify(identityFixture.sectionId)}+'-heading'))`),true);
    assert.equal(await window.webContents.executeJavaScript(`Boolean(document.getElementById('website-'+${JSON.stringify(identityFixture.sectionId)}+'-action'))`),true);
    await fs.writeFile(join(evidence,'section-identity-escape.json'),JSON.stringify({status:'passed',noInjectedAttribute:true,headingIdRetained:true,actionIdRetained:true,limits:'Inert synthetic identity attribute probe; no executable payload'},null,2));
    await window.webContents.executeJavaScript(`for(const suffix of ['', '.backup','.pending'])localStorage.removeItem(${JSON.stringify(identityFixture.key)}+suffix)`);
    await click(window,'[data-action="website-list"]');
    await click(window,'[data-action="website-open"][data-value="'+conflictOriginal.id+'"]');
    const presentationFixture=await window.webContents.executeJavaScript(`(() => {
      const source=JSON.parse(localStorage.getItem(${JSON.stringify(conflictOriginal.key)}));
      const record={...source,id:'website-presentation-evidence',name:'Validated synthetic presentation'};
      const key='meridian.website.'+encodeURIComponent(record.meridianProjectId)+'.'+encodeURIComponent(record.id);
      localStorage.setItem(key+'.backup',JSON.stringify(record));
      const broken={...record,design:{accent:{toString:1},font:{toString:1}},updatedAt:{toString:1}};
      const raw=JSON.stringify(broken);localStorage.setItem(key,raw);return {key,id:record.id,record,raw};
    })()`);
    await click(window,'[data-action="website-list"]');
    await click(window,'[data-action="website-open"][data-value="'+presentationFixture.id+'"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-design-font').value"),presentationFixture.record.design.font);
    assert.equal(await window.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(presentationFixture.key)})`),presentationFixture.raw);
    const legacyBytes=await window.webContents.executeJavaScript(`(() => {
      const record=${JSON.stringify(presentationFixture.record)};delete record.design;const raw=JSON.stringify(record);
      localStorage.setItem(${JSON.stringify(presentationFixture.key)},raw);localStorage.removeItem(${JSON.stringify(presentationFixture.key)}+'.backup');return raw;
    })()`);
    await click(window,'[data-action="website-list"]');
    await click(window,'[data-action="website-open"][data-value="'+presentationFixture.id+'"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-design-font').value"),'system-ui');
    assert.equal(await window.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(presentationFixture.key)})`),legacyBytes);
    await click(window,'.website-flow-nav [data-value="edit"]');
    await window.webContents.executeJavaScript("(() => {const field=document.querySelector('#website-design-accent');field.value='#16715a';field.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await click(window,'[data-action="website-save"]');
    const persistedDesign=await window.webContents.executeJavaScript(`JSON.parse(localStorage.getItem(${JSON.stringify(presentationFixture.key)})).design`);
    assert.deepEqual(persistedDesign,{accent:'#16715a',font:'system-ui'});
    await fs.writeFile(join(evidence,'saved-presentation-validation.json'),JSON.stringify({status:'passed',malformedStylesAndDateRecover:true,corruptPrimaryBytesUnchanged:true,legacyMissingStylesDefaultedInMemory:true,legacyBytesUnchangedUntilSave:true,explicitStyleSaveWorks:true,limits:'Synthetic retained-record shapes; timestamp validation checks types and bounds, not calendar correctness'},null,2));
    await window.webContents.executeJavaScript(`for(const suffix of ['', '.backup','.pending'])localStorage.removeItem(${JSON.stringify(presentationFixture.key)}+suffix)`);
    await click(window,'[data-action="website-list"]');
    window.setSize(1440,1000); window.webContents.setZoomFactor(1); await pause(180);
    // Checkpoint read failures remain retryable without replacing saved bytes.
    await window.webContents.executeJavaScript("document.querySelector('#website-new-name').value='Audit checkpoint recovery'");
    await click(window,'[data-action="website-create"]');
    await click(window,'.website-flow-nav [data-value="preview"]');
    await window.webContents.executeJavaScript("document.querySelector('#website-checkpoint-label').value='Before synthetic read failure'");
    await click(window,'[data-action="website-checkpoint-create"]');
    const checkpointFixture=await window.webContents.executeJavaScript("(()=>{for(const key of Object.keys(localStorage)){try{const p=JSON.parse(localStorage.getItem(key));if(p?.schema==='meridian.website-project.v1'&&p.name==='Audit checkpoint recovery'){const historyKey='meridian.website-checkpoints.'+encodeURIComponent(p.meridianProjectId)+'.'+encodeURIComponent(p.id);const raw=localStorage.getItem(historyKey);if(raw){localStorage.setItem(historyKey,'null');return {id:p.id,historyKey,raw,project:p};}}}catch(_){}}throw Error('Missing synthetic checkpoint fixture')})()");
    await click(window,'[data-action="website-list"]');
    await click(window,'[data-action="website-open"][data-value="'+checkpointFixture.id+'"]');
    await window.webContents.executeJavaScript("(()=>{const f=document.querySelector('#website-brief-audience');f.value='Retain audience during checkpoint retry';f.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click(window,'[data-action="website-jump"][data-value="checkpoints"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-shortcuts').textContent.includes('unavailable')"),true);
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-checkpoints').textContent.includes('No saved checkpoints')"),false);
    await click(window,'[data-action="website-checkpoint-retry"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-brief-audience').value"),'Retain audience during checkpoint retry');
    await capture(window,'37-checkpoint-history-retry-warning');
    window.setSize(1280,900);window.webContents.setZoomFactor(2);await pause(180);
    await window.webContents.executeJavaScript("document.querySelector('[data-action=website-checkpoint-retry]').focus()");
    assert.equal(await window.webContents.executeJavaScript("(()=>{const r=document.activeElement.getBoundingClientRect(),b=document.querySelector('.website-workbar').getBoundingClientRect(),w=document.querySelector('.studio-workspace').getBoundingClientRect();return r.top>=b.bottom-1&&r.bottom<=w.bottom+1})()"),true,'Retry keyboard focus stays visible at200%');
    await capture(window,'37b-checkpoint-retry-focus-200pct');
    window.setSize(1440,1000);window.webContents.setZoomFactor(1);await pause(180);
    await window.webContents.executeJavaScript('localStorage.setItem('+JSON.stringify(checkpointFixture.historyKey)+','+JSON.stringify(checkpointFixture.raw)+')');
    await click(window,'[data-action="website-checkpoint-retry"]');
    assert.equal(await window.webContents.executeJavaScript("document.activeElement.id"),'website-checkpoints-title');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-shortcuts').textContent.includes('Saved checkpoints (1)')"),true);
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-brief-audience').value"),'Retain audience during checkpoint retry');
    assert.equal(await window.webContents.executeJavaScript('localStorage.getItem('+JSON.stringify(checkpointFixture.historyKey)+')'),checkpointFixture.raw);
    await capture(window,'38-checkpoint-history-recovered');
    await fs.writeFile(join(evidence,'checkpoint-history-retry.json'),JSON.stringify({status:'passed',malformedHistoryReported:true,noFalseEmptyHistory:true,failedRetryRetainsEdits:true,repairedHistoryFound:true,focusedHeading:true,retainedHistoryBytesUnchanged:true,limits:'Synthetic local history fault and explicit fixture repair; no service recovery'},null,2));
    await click(window,'[data-action="website-save"]');
    const collision=await window.webContents.executeJavaScript('(()=>{const source='+JSON.stringify(checkpointFixture.project)+';const parent={...source,id:"website-alias-audit",name:"Alias parent"},child={...source,id:"website-alias-audit.backup",name:"Alias child"};const prefix="meridian.website."+encodeURIComponent(source.meridianProjectId)+".";const entries=[[prefix+parent.id,JSON.stringify(parent)],[prefix+child.id,JSON.stringify(child)]];for(const [key,raw]of entries)localStorage.setItem(key,raw);return {parentId:parent.id,entries};})()');
    await click(window,'[data-action="website-list"]');
    await click(window,'[data-action="website-open"][data-value="'+collision.parentId+'"]');
    await window.webContents.executeJavaScript("(()=>{const f=document.querySelector('#website-brief-goal');f.value='Preserve aliased draft edits';f.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click(window,'[data-action="website-save"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('.website-builder').textContent.includes('overlaps another saved website')"),true);
    for(const [key,raw]of collision.entries)assert.equal(await window.webContents.executeJavaScript('localStorage.getItem('+JSON.stringify(key)+')'),raw);
    await window.webContents.executeJavaScript("document.querySelector('.website-builder .studio-inline-error').scrollIntoView({block:'center'})");
    await capture(window,'39-website-recovery-key-conflict');
    await click(window,'[data-action="website-save-copy"]');
    assert.equal(await window.webContents.executeJavaScript("document.querySelector('#website-brief-goal').value"),'Preserve aliased draft edits');
    for(const [key,raw]of collision.entries)assert.equal(await window.webContents.executeJavaScript('localStorage.getItem('+JSON.stringify(key)+')'),raw);
    await fs.writeFile(join(evidence,'recovery-key-alias.json'),JSON.stringify({status:'passed',conflictingSaveRejected:true,bothRetainedWebsitesUnchanged:true,separateCopyPreservesEdits:true,limits:'Synthetic legacy recovery-key collision; no cross-process atomicity or service authority'},null,2));

    await require('./export-layout-check.cjs').checkExportLayout(evidence);
    console.log('UI_FLOW_SMOKE_PASSED');
    app.exit(0);
  } catch (error) {
    if (window) await capture(window, 'failure').catch(() => {});
    console.error(error.stack || String(error));
    app.exit(1);
  }
});
