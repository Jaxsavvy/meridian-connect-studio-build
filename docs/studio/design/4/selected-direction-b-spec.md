# Command Workbench B — selected-direction specification

**Decision:** Tyler selected Command Workbench B — Operations on 2026-10-12. This document translates the approved design direction into a reviewable UI specification. It does not authorize renderer, bridge, backend, packaging, Meridian Core, Overseer, or production changes.

## Product intent

Studio should answer four questions immediately for a nontechnical employee:

1. Which project am I working in?
2. What creative work is active?
3. What decision or asset is blocking progress?
4. What is the safest next action?

The interface should feel operational without becoming a generic analytics dashboard. Creative work remains primary; metrics exist only when they explain progress, scope, or a required decision.

## Approved information architecture

| Region | Purpose | Required content | Primary action |
| --- | --- | --- | --- |
| Studio rail | Stable movement among Studio surfaces | Operations, Editor, Asset Library, States; session summary | Change Studio surface |
| Project header | Preserve project scope during every task | Project name, breadcrumb, project switcher, priority/context badge | Switch project deliberately |
| Active campaign | Explain the current production at a glance | Campaign name, short brief, assembly progress, scene/asset/review counts | Continue current creative work |
| Production board | Show only work that changes the next action | Active scenes, attachment gaps, review readiness | Open sequence |
| Latest assets | Keep recent visual material near the work | Project-scoped thumbnails and total count | Open Asset Library |
| Decision queue | Make human review needs persistent | Decision title, owner/role cue, reason, state | Review or open source material |

The decision queue remains visible on the overview because unresolved human choices are operational work, not notifications. Delivery language must never imply approval when only a draft or local save exists.

## Representative flows

### Resume creative work

`Project context → active campaign → Continue hero film → selected scene → edit → Save draft → explicit saved confirmation`

- Returning employees land on the current campaign, not a blank launcher.
- Continue opens the last meaningful creative context when that context is still valid.
- A save control must distinguish editing, saving, saved, and failed states.

### Resolve an asset gap

`Production board gap → Asset Library → filter project assets → inspect approval/version/original → place asset → return to scene`

- Asset placement is project-scoped.
- Selection and placement are separate actions.
- Original/derivative lineage and approval state remain visible before placement.

### Resolve a review decision

`Decision queue → review target → compare context → record decision → queue and campaign status update`

- Opening a review does not equal approval.
- A decision requires a named outcome and saved confirmation.
- Failed synchronization leaves the local draft visible and provides recovery.

## Component contract

| Component | Behavior requirement | Accessibility requirement |
| --- | --- | --- |
| Studio navigation | One active destination; state survives project-scoped navigation | Semantic navigation; `aria-current`; visible focus |
| Project lockup/switcher | Current project is always visible; switching warns when work is unsaved | Full accessible name for truncated project names; keyboard-operable listbox/dialog pattern |
| Campaign summary | One dominant action; metrics are descriptive, not interactive | Logical heading order; progress has a text equivalent |
| Production item | Names work and explains the next requirement | Action label includes the target, not only “Open” |
| Asset item | Separates selection from placement and exposes status/version/use | `aria-selected`; meaningful image alternative or decorative treatment as appropriate |
| Decision item | Shows subject, reason, state, and responsible role | State is expressed in text, never color alone |
| Save status | Transitions among unsaved, saving, saved, and failed | Polite status announcement; failure receives focus only when needed |
| Error/empty/loading surface | Preserves project context and offers a next action | Loading label, recovery action, and no motion dependency |

## State language

The owner confirmed this shared vocabulary for Studio and Cassy's asset surfaces on 2026-10-12. DEV-005 may expose additional implementation-specific states, but must coordinate any conflicting term rather than silently changing these meanings.

| State | Meaning | UI consequence |
| --- | --- | --- |
| Draft | Work exists but is not approved | Editable; never presented as deliverable |
| Unsaved | Local UI differs from last confirmed save | Warn before project/surface change |
| Saving | Save request is in progress | Prevent duplicate request; keep context visible |
| Saved | The configured development service confirmed persistence | Show timestamp or recent confirmation |
| Needs review | A human decision is required | Appears in the decision queue with reason |
| Approved | An authorized decision was recorded | Eligible for approved uses defined by the future service contract |
| Error | Requested data/action failed | Preserve safe local work and expose retry or alternate path |
| Original | The immutable source asset | Never overwritten by an edit or enhancement |
| Derivative | A new asset related to a preserved original | Shows parent/source identity and its own version/status |

## Desktop behavior and visual QA

| Width | Intended behavior | Review result |
| --- | --- | --- |
| 1080 px | Rail narrows; campaign remains full width; decision items become one horizontal row; production and assets remain paired | Visually checked in synthetic render; hierarchy and labels remain legible |
| 1280 px | Compact three-column operational overview | Visually checked in synthetic render; no clipping or overlap observed |
| 1440 px | Reference composition | Visually checked; selected review baseline |
| 1920 px | Content width caps to prevent excessive line length while the shell retains project context | Visually checked in synthetic render; grouping remains coherent |

Evidence:

- `renders/direction-1b-operations-1080.png`
- `renders/direction-1b-operations-1280.png`
- `renders/direction-1b-overview.png`
- `renders/direction-1b-operations-1920.png`

These are static synthetic HTML captures, not approved development-runtime or employee-runtime evidence.

## Accessibility acceptance for implementation

- Complete keyboard traversal without focus loss or hidden focus behind sticky regions.
- Visible focus ring on navigation, cards that act as controls, filters, inputs, and project switching.
- Headings form one understandable outline per surface.
- Text and essential controls meet WCAG 2.2 AA contrast after final token values are chosen.
- At 200% zoom, actions remain available without two-dimensional scrolling at the supported desktop viewport.
- Reduced-motion preference disables nonessential shimmer or transitions; loading still has text.
- Long project, campaign, scene, and asset names truncate visually but retain an accessible full name.
- Save, review, approval, and error changes are announced without relying on color.

## Confirmed integration decisions

- **Route placement:** Studio is a primary Connect destination. After entry, Studio content and actions are scoped to the selected project, and the project remains visible while moving among Operations, Editor, and Asset Library.
- **First editor slice:** the campaign/story editor shown in Direction B is the first approved Studio editor slice.
- **Shared terminology:** **Draft**, **Unsaved**, **Saving**, **Saved**, **Needs review**, **Approved**, **Error**, **Original**, and **Derivative** use the meanings in this specification across Studio and coordinated asset surfaces.

## Dependencies and evidence still pending

- [DEV-005 — Build Studio Asset Library and Upscayl component](https://github.com/Jaxsavvy/meridian-connect-studio-build/issues/8) remains open and assigned to Cassy. Its Connect-side asset adapter, worker boundary, tests, and required connector behavior are implementation dependencies; none is treated as complete or production-ready here.
- Chair 1 still owns restricted service permissions, authoritative records, shared bridge/security review, and final integration.
- Counts, progress, approvals, asset lineage, persistence, permissions, and review ownership remain synthetic until their service contracts and isolated implementation evidence are reviewed.
- The current employee runtime comparison remains pending and unverified.

This specification is the approved visual and interaction guidance for coordination. It does not authorize this task to modify shared renderer, bridge, backend, packaging, restricted services, or production systems.
