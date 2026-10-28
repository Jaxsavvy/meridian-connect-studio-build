/* Build runner, part 1 (#246): the prompt that has Claude Code build a client's site from the house starter kit and the
 * bundle the client approved at Design lock (Website Build Pipeline: One System, step 7). Until the server runs it,
 * someone pastes it into Claude Code. Core lane, pure: repoName(), buildPrompt() and checkLinks() (#252). */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianBuildPrompt = api;
})(typeof window === 'undefined' ? null : window, function () {
  const KIT = 'Jaxsavvy/bv-site-starter', OWNER = 'Jaxsavvy';

  /** The client site's repo name: "site-" plus the business name in lower case, e.g. "site-sample-roofing-co". */
  function repoName(name) {
    const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
    return `site-${slug || 'client'}`;
  }

  /** The Claude Code prompt. bundleFile: the bundle's name in the project folder; images: [{ id, name, use }];
   *  version: the design version the client approved. */
  function buildPrompt(bundle, { bundleFile, images = [], version = 1 } = {}) {
    const name = bundle.business.name, repo = repoName(name);
    const pages = bundle.pages.map(p => `${p.name} (${p.path}): ${p.chapters.map(c => c.layout).join(', ')}`);
    const layouts = [...new Set(bundle.pages.flatMap(p => p.chapters.map(c => c.layout)))];
    return [
      `You are building the website for "${name}" from Breakthrough Ventures' house starter kit (${KIT}) and a design the client already approved (design version ${version}). Nothing is left to decide: build exactly what the bundle says.`,
      '',
      `1. Make the repo: gh repo create ${OWNER}/${repo} --private --template ${KIT} --clone ; then cd ${repo}`,
      '2. Read its AGENTS.md and README.md first, and follow them exactly.',
      `3. Put the bundle in: copy "${bundleFile}" from the client's project folder to src/bundle/site.json, replacing the sample.`,
      `4. Images: the bundle file lists ${images.length} in "images" (${images.length ? images.map(a => `${a.id}: ${a.use}`).join('; ') : 'none'}). Put each in public/images/, named by its id. Until Meridian hands them over by itself, ask Jax for the files. A section whose image you don't have yet uses its no-photo design, and the PR lists what's missing.`,
      `5. Build every page, in order: ${pages.join(' | ')}. Each chapter uses the kit's component for its layout (${layouts.join(', ')}). Words come only from chapter.words, style numbers only from bundle.style. If a layout has no component yet, stop and say which.`,
      '6. Check: npm run build ; npm run check:size ; one h1 per page ; works at 360 px with no sideways scroll ; reduced motion respected.',
      '7. Open a PR into main saying what you built and anything missing. Do not publish or deploy: Jax decides when a site goes live.',
      '',
      'Never invent words, numbers, reviews or prices. Never add secrets or .env files. Explain each command in one plain sentence before running it.',
    ].join('\n');
  }

  /** Part 2 (#252): a build's links. pr: a pull request in the client's repo; preview: an https://….pages.dev link
   *  (Cloudflare Pages), or empty until Cloudflare is connected. Throws a plain message on anything else. */
  function checkLinks(links, repo) {
    const l = links && typeof links === 'object' ? links : {};
    const pr = typeof l.pr === 'string' ? l.pr.trim().replace(/\/$/, '') : '';
    const preview = typeof l.preview === 'string' ? l.preview.trim() : '';
    if (!new RegExp(`^https://github\\.com/${OWNER}/${repo}/pull/[1-9][0-9]{0,6}$`).test(pr)) {
      throw new Error(`Paste the pull request link from ${OWNER}/${repo}, like https://github.com/${OWNER}/${repo}/pull/1.`);
    }
    if (preview) {
      let url = null;
      try { url = new URL(preview); } catch (_) { /* refused below */ }
      if (!url || url.protocol !== 'https:' || url.username || url.password || !/(^|\.)pages\.dev$/.test(url.hostname) || preview.length > 300) {
        throw new Error('The preview link must be an https://….pages.dev link from Cloudflare Pages.');
      }
    }
    return { pr, preview };
  }

  return Object.freeze({ KIT, repoName, buildPrompt, checkLinks });
});
