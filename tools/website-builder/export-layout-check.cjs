'use strict';
// Exercise generated HTML in Chromium; no provider, app preload or filesystem bridge.
const { BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { join } = require('node:path');
const Model = require('../../src/renderer/studio-ui/website-builder.js');
async function checkExportLayout(evidence) {
  const controller=Model.createController({storage:Model.createMemoryStorage()});
  controller.selectContext({id:'synthetic-layout',name:'Synthetic layout'});
  controller.createProject('W'.repeat(160));
  const home=controller.snapshot().selectedPageId;
  controller.addPage('N'.repeat(120));
  const target=controller.snapshot().selectedPageId;
  controller.selectPage(home);
  const section=controller.snapshot().project.pages[0].sections[0].id;
  controller.updateSection(section,'heading','H'.repeat(200));
  controller.updateSection(section,'body','B'.repeat(8000));
  controller.updateSection(section,'action','A'.repeat(200));
  controller.updateSection(section,'actionPageId',target);
  const html=controller.exportSite().files['index.html'];
  const browser=new BrowserWindow({width:1008,height:800,show:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const observed=[];
  try {
    await browser.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
    for(const [width,zoom] of [[375,1],[768,1],[1440,1],[1008,2]]) {
      browser.setContentSize(width,800);browser.webContents.setZoomFactor(zoom);
      await new Promise(resolve=>setTimeout(resolve,120));
      const result=await browser.webContents.executeJavaScript(`({width:innerWidth,scroll:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,headingVisible:document.querySelector('h1').getBoundingClientRect().right<=innerWidth+1,actionFits:document.querySelector('.action').getBoundingClientRect().right<=innerWidth+1,action:document.querySelector('.action').getAttribute('href'),noScripts:document.scripts.length===0})`);
      observed.push({requestedWidth:width,zoom,...result});
      assert.ok(result.scroll<=result.width+1 && result.bodyScroll<=result.width+1,'Export overflow: '+JSON.stringify(result));
      assert.equal(result.headingVisible,true);assert.equal(result.actionFits,true);assert.equal(result.noScripts,true);
      assert.equal(result.action,Model.pageFilename(controller.snapshot().project.pages.find(p=>p.id===target)));
      if(width===375)await fs.writeFile(join(evidence,'30-export-long-content-phone.png'),(await browser.webContents.capturePage()).toPNG());
    }
    await fs.writeFile(join(evidence,'export-layout.json'),JSON.stringify({status:'passed',websiteNameLength:160,headingLength:200,bodyLength:8000,actionLength:200,observed,limits:'Synthetic static export rendering, no deployment or device touch interaction'},null,2));
  } finally { browser.destroy(); }
}
module.exports={checkExportLayout};
