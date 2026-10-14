document.addEventListener('DOMContentLoaded',()=>{
  const views=[...document.querySelectorAll('.view')];
  const nav=[...document.querySelectorAll('[data-view-target]')];
  function openView(id){views.forEach(v=>v.classList.toggle('active',v.dataset.view===id));nav.forEach(b=>{const on=b.dataset.viewTarget===id;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false')});document.querySelector('[data-page-title]')?.replaceChildren(document.createTextNode(id==='overview'?'Studio overview':id==='editor'?'Campaign editor':id==='assets'?'Asset Library':'State gallery'))}
  nav.forEach(b=>b.addEventListener('click',()=>openView(b.dataset.viewTarget)));
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{b.parentElement.querySelectorAll('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active')}));
  document.querySelectorAll('.asset').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.asset').forEach(x=>x.setAttribute('aria-selected','false'));a.setAttribute('aria-selected','true');const n=a.dataset.name||a.querySelector('b')?.textContent||'Asset';document.querySelectorAll('[data-selected-asset]').forEach(x=>x.textContent=n);showToast(`${n} selected for this project`)}));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>showToast(b.dataset.action)));
  document.querySelectorAll('[data-editor]').forEach(e=>e.addEventListener('input',()=>{document.querySelectorAll('[data-save-state]').forEach(x=>{x.textContent='Unsaved changes';x.classList.add('unsaved')})}));
  document.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-save-state]').forEach(x=>{x.textContent='Saved just now';x.classList.remove('unsaved')});showToast('Draft saved to synthetic project')}));
  document.querySelectorAll('[data-open-assets]').forEach(b=>b.addEventListener('click',()=>openView('assets')));
  function showToast(text){const t=document.querySelector('.toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2200)}
});
