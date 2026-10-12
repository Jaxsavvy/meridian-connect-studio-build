# Meridian Connect development instructions

- This repository is the employee desktop client. Keep Meridian Core, Team Hub, Overseer, owner-only assets, private configuration, and customer records out of it.
- Work in small, reviewable changes. Preserve existing Electron main/preload/renderer boundaries and the established Meridian visual identity.
- Treat all renderer input, project IDs, file references, and bridge requests as untrusted. Server-side services must validate identity, project membership, and permissions for every request.
- Never add secrets, private endpoints, personal filesystem paths, production data, local databases, logs, packaged builds, or generated dependencies to commits or fixtures.
- Keep `package.json` `build.files` narrow. Any new packaged file must be explicitly reviewed for employee distribution.
- Use local or synthetic data for development. Do not call paid services or live customer systems in automated checks.
- Do not change or deploy backend services from this repository. Document required API contracts and coordinate backend changes in their restricted source repositories.
- Before proposing a commit, review the exact file list, scan it for secrets and sensitive paths, and run safe static checks. Build and runtime checks require an authorized development environment.
