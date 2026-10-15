# Website Studio recovery and delivery

## Repository state

- Repository: `https://github.com/Jaxsavvy/meridian-connect-studio-build.git`
- Base: `main` at `29a0df6`
- Working branch: `feature/tyler-website-studio-ui`
- Implementation commit: `fe02832` — persistent Website Builder foundation, verification evidence, and delivery documentation.
- Reported prior branch/commit: `feature/tyler-website-studio-ui` / `52daa2f` were not present on GitHub or in located local Git object stores at audit time.
- Reported `Website_Studio_Delivery.zip` and `Website_Studio_Publication_Guide.md`: not located.

## Recovery decision

Current `main` was cloned into a new writable task folder. Existing merged Studio, project-context, accessibility, and Asset Library work was retained. No history was reset, rewritten, or force-pushed. The missing reported commit was not fabricated or substituted.

## Reproduction

Use Node.js 24. Install the locked dependencies with `npm ci`. Run the Node tests listed in `WEBSITE_STUDIO_TEST_REPORT.md`. Launch the isolated development client with `npm run dev`; Website Studio remains unavailable in ordinary employee mode by design. Packaging uses the existing `npm run build` script and has not yet been verified for this branch.

The unsigned NSIS packaging command completed successfully. The installer was not executed or distributed, and generated `dist/` files are ignored rather than committed.

The feature branch was published successfully to `origin/feature/tyler-website-studio-ui`, and GitHub readback confirmed both implementation commits. Automated pull-request creation is blocked: the GitHub connector returned `403 Resource not accessible by integration`, and the local GitHub CLI credential is invalid. The owner can open the prepared comparison at <https://github.com/Jaxsavvy/meridian-connect-studio-build/compare/main...feature/tyler-website-studio-ui?expand=1> and select **Create pull request**, or restore pull-request permission for the connected GitHub account. No pull request is claimed as created. Final merge, installer execution, and production distribution remain outside this delivery step.
