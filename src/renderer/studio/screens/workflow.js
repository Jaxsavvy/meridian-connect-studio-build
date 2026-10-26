'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianStudio.registerScreen('workflow', { render: api.render });
})(typeof window === 'undefined' ? null : window, function () {
  const stagesFor = (workflow, tier) => workflow.stages.filter(stage => stage.tiers.includes(tier));
  function createWorkflow({ service, spaceId, workflowId, navigate, report }) {
    let disposed = false, revision = 0, workflow = null, tier = 'standard', busy = false, people = [], picks = {};
    function show(error = '') {
      report({ state: 'ready', workflow, tier, stages: stagesFor(workflow, tier), people, picks: { ...picks }, busy, error });
    }
    // Picks only for stages the team builds; stages Jax approves always stay with him.
    const pickable = id => stagesFor(workflow, tier).some(stage => stage.id === id && stage.approver !== 'jax');
    async function load() {
      if (disposed || busy) return;
      const request = ++revision; workflow = null; report({ state: 'loading' });
      try {
        const [space, next, team] = await Promise.all([service.getSpace(spaceId), service.getWorkflow(workflowId),
          service.listPeople(workflowId)]);
        if (disposed || request !== revision) return;
        if (!space || space.id !== spaceId) throw Error('Space unavailable');
        if (!next) { report({ state: 'empty' }); return; }
        if (next.id !== workflowId) throw Error('Workflow unavailable');
        workflow = next; tier = next.tiers.some(t => t.id === 'standard') ? 'standard' : next.tiers[0]?.id;
        people = (Array.isArray(team) ? team : []).filter(person => person?.id && person.name); picks = {};
        show();
      } catch (_) {
        if (!disposed && request === revision) report({ state: 'failed', message: 'Unable to open this workflow. Check your connection and access, then try again.' });
      }
    }
    return { load,
      choose(id) {
        if (disposed || busy || !workflow?.tiers.some(t => t.id === id)) return false;
        tier = id;
        picks = Object.fromEntries(Object.entries(picks).filter(([stageId]) => pickable(stageId)));
        show(); return true;
      },
      pick(stageId, personId) {
        if (disposed || busy || !workflow || !pickable(stageId)) return false;
        if (!personId) delete picks[stageId];
        else if (people.some(person => person.id === personId)) picks[stageId] = personId;
        else return false;
        show(); return true;
      },
      async start() {
        if (disposed || busy || !workflow || !tier) return;
        busy = true; show();
        try {
          const job = await service.startJob(spaceId, workflowId, tier, { assignees: { ...picks } });
          if (disposed) return;
          if (!job?.id || job.spaceId !== spaceId || job.workflowId !== workflowId) throw Error('Unable to open this Job.');
          navigate('work', { spaceId, jobId: job.id });
        } catch (error) { if (!disposed) { busy = false; show(error.message || 'Unable to start Job. Try again.'); } }
      },
      back() { if (!disposed) navigate('space', { spaceId }); },
      dispose() { disposed = true; revision++; workflow = null; },
    };
  }
  function render(el, { spaceId, workflowId }, studio) {
    const doc = el.ownerDocument, root = doc.createElement('section');
    root.className = 'studio-workflow'; root.setAttribute('aria-label', 'Start a workflow'); el.replaceChildren(root);
    const states = doc.defaultView?.MeridianStudioScreenStates || require('./home.js').screenStates;
    const focus = states.focus(root);
    function node(tag, text, className) {
      const item = doc.createElement(tag); if (text) item.textContent = text;
      if (className) item.className = className; return item;
    }
    let listeners = [];
    function listen(item, type, fn) { item.addEventListener(type, fn); listeners.push([item, type, fn]); }
    function unlisten() { for (const [item, type, fn] of listeners) item.removeEventListener?.(type, fn); listeners = []; }
    function button(text, action) {
      const item = node('button', text, 'studio-button is-secondary'); item.type = 'button';
      listen(item, 'click', action); return item;
    }
    function picker(stage, view) {
      const label = node('label', '', 'studio-workflow-assign'), select = node('select');
      select.name = `workflow-assign-${stage.id}`; select.setAttribute('aria-label', `Who builds ${stage.name}`);
      const jax = stage.approver === 'jax';
      const options = jax ? [['jax', 'Jax']] : [['', 'Unassigned'], ...view.people.map(person => [person.id, person.name])];
      for (const [value, name] of options) { const option = node('option', name); option.value = value; select.appendChild(option); }
      select.value = jax ? 'jax' : view.picks[stage.id] || ''; select.disabled = jax || view.busy;
      if (!jax) listen(select, 'change', () => model.pick(stage.id, select.value));
      label.append(node('span', 'Built by'), select); return label;
    }
    const model = createWorkflow({ service: studio.service, spaceId, workflowId, navigate: studio.navigate,
      report(view) {
        const active = doc.activeElement?.name;
        const activeTier = active === 'workflow-tier' ? doc.activeElement.value : null;
        const activePick = String(active || '').startsWith('workflow-assign-') ? active : null;
        unlisten(); const restore = focus();
        root.replaceChildren(button('Back to Space', () => model.back()), node('h1', view.workflow?.name || 'Workflow'));
        root.setAttribute('aria-busy', String(view.state === 'loading' || !!view.busy));
        if (view.state !== 'ready') {
          root.appendChild(states.panel(doc, view.state, view.state === 'loading' ? 'Loading workflow…'
            : view.state === 'empty' ? 'This workflow is coming soon' : view.message, () => void model.load()));
          restore(); return;
        }
        const tiers = node('fieldset', '', 'studio-card'); tiers.appendChild(node('legend', 'Choose a tier'));
        let selected;
        for (const tier of view.workflow.tiers) {
          const label = node('label', '', 'studio-workflow-tier'), input = node('input');
          input.type = 'radio'; input.name = 'workflow-tier'; input.value = tier.id;
          input.checked = tier.id === view.tier; input.disabled = view.busy;
          listen(input, 'change', () => { if (input.checked) model.choose(tier.id); });
          label.append(input, node('strong', tier.name), node('span', tier.description)); tiers.appendChild(label);
          if (tier.id === activeTier) selected = input;
        }
        root.append(tiers, node('h2', 'Stages'), node('p', 'Pick who builds each stage. Stages Jax approves stay with him.'));
        const list = node('ol', '', 'studio-workflow-stages');
        for (const stage of view.stages) {
          const item = node('li', '', 'studio-card'); item.append(node('h3', stage.name), node('p', stage.goal));
          if (stage.approver === 'jax') item.appendChild(node('p', 'Jax approves', 'studio-chip'));
          const pick = picker(stage, view); item.appendChild(pick); list.appendChild(item);
          if (pick.children?.[1]?.name === activePick) selected = pick.children[1];
        }
        const start = button(view.busy ? 'Starting Job…' : 'Start job', () => void model.start());
        start.disabled = view.busy; start.className = 'studio-button is-primary'; root.append(list, start);
        if (view.error) { const error = node('p', view.error); error.setAttribute('role', 'alert'); root.appendChild(error); }
        if (selected && !selected.disabled) selected.focus?.(); else restore();
      } });
    void model.load(); return () => { model.dispose(); unlisten(); root.remove(); };
  }
  return { stagesFor, createWorkflow, render };
});
