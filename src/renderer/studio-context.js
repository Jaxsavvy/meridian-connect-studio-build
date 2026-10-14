/* Studio project identity and tool catalogue. This is client state, not authorization. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.meridianStudioContext = api.createStudioContext();
})(typeof window === 'undefined' ? null : window, function () {
  const TOOLS = Object.freeze([
    ['images', 'ChatGPT Images'],
    ['storyboard', 'Storyboard'],
    ['video', 'Video Studio'],
    ['blender', 'Blender'],
    ['krita', 'Krita'],
    ['upscayl', 'Upscayl'],
    ['website', 'Website Builder'],
    ['audio', 'Audio Studio'],
    ['files', 'Studio Files'],
  ].map(([id, name]) => Object.freeze({ id, name })));
  const PROJECT_ID = /^[A-Za-z0-9_-]{1,128}$/;

  function createStudioContext() {
    let session = 0;
    let listRequest = 0;
    let selection = 0;
    let allowed = new Map();
    let project = null;
    const listeners = new Set();

    function snapshot() {
      return {
        project: project ? { ...project } : null,
        projects: Array.from(allowed.values(), item => ({ ...item })),
        tools: TOOLS.map(({ id, name }) => ({ id, name, availability: 'planned' })),
      };
    }

    function notify() {
      for (const listener of listeners) listener(snapshot());
    }

    function clearProject() {
      if (!project) return;
      project = null;
      selection += 1;
      notify();
    }

    function beginProjectList() {
      listRequest += 1;
      return Object.freeze({ session, listRequest });
    }

    function isLatestListRequest(ticket) {
      return ticket && ticket.session === session && ticket.listRequest === listRequest;
    }

    function rejectProjectList(ticket) {
      if (!isLatestListRequest(ticket)) return false;
      const hadProjects = allowed.size > 0;
      allowed = new Map();
      if (project) clearProject();
      else if (hadProjects) notify();
      return true;
    }

    function acceptProjects(projects, ticket) {
      if (!isLatestListRequest(ticket)) return false;
      if (!Array.isArray(projects)) {
        rejectProjectList(ticket);
        return false;
      }
      const next = new Map();
      for (const item of projects) {
        if (!item || typeof item.id !== 'string' || !PROJECT_ID.test(item.id) ||
            typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200 ||
            next.has(item.id)) {
          rejectProjectList(ticket);
          return false;
        }
        next.set(item.id, { id: item.id, name: item.name });
      }
      const listChanged = next.size !== allowed.size || Array.from(next).some(([id, item]) =>
        allowed.get(id)?.name !== item.name);
      allowed = next;
      if (project) {
        const refreshed = allowed.get(project.id);
        if (!refreshed) clearProject();
        else if (refreshed.name !== project.name) {
          project = { ...refreshed };
          notify();
        } else if (listChanged) notify();
      } else if (listChanged) {
        notify();
      }
      return true;
    }

    function selectProject(projectId) {
      const next = allowed.get(projectId);
      if (!next) return false;
      if (project?.id !== next.id) {
        project = { ...next };
        selection += 1;
        notify();
      }
      return true;
    }

    function beginProjectRequest() {
      if (!project) return null;
      return Object.freeze({ session, selection, projectId: project.id });
    }

    function isCurrentRequest(ticket) {
      return Boolean(ticket && project && ticket.session === session &&
        ticket.selection === selection && ticket.projectId === project.id);
    }

    function reset() {
      session += 1;
      listRequest += 1;
      selection += 1;
      allowed = new Map();
      project = null;
      notify();
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Studio listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    return Object.freeze({ snapshot, beginProjectList, acceptProjects, rejectProjectList,
      selectProject, beginProjectRequest, isCurrentRequest, reset, subscribe });
  }

  return { createStudioContext };
});
