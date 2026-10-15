# Inline leave-guard keyboard continuation

DEV-005: Escape bubbling from a control inside either inline unsaved host-transition or local project-switch warning now cancels that transition, retains draft/project and returns editing focus to the name field. The event is consumed so it cannot also trigger a surrounding shell action.

Two fake-DOM regressions verify cancellation, event consumption, retained project/draft and restored name focus. Combined asset/host suite: 57 passed; view syntax and diff checks passed. No new browser/native keyboard run or screen-reader claim. The inline warning remains nonmodal; no focus trapping, initial dialog focus, inert background or exact external-invoker restoration is claimed. Those require shared mounting/modal ownership coordination with Jax/Tyler. No shared source, backend, IPC or packaging changed.
