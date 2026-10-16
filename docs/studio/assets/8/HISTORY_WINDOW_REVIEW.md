# History display window clarification

Chair 3 UI correction from the PR #36 compatibility review: metadata history now labels the displayed last-ten window versus available-event count and warns that earlier changes may not be included. Omitted history and an explicitly empty supplied array have distinct messages. Neither is described as complete authoritative audit.

Two fake-DOM tests cover 10-of-11 rendering and missing-versus-empty labels. Combined asset/worker/native/view/paging/host suite: 67 pass. Browser synthetic save/expanded history shows the count/warning; history-window-preview.png. Syntax and exact diff checks pass. This does not implement historyCursor, history pages or review-history rendering; those still require agreed v1 adapter mapping. PR #36 and the unposted draft review unchanged; no shared code, live service or packaging changes.
