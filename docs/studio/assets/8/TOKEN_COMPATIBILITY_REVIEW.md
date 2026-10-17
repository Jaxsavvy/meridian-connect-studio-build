# Tyler token compatibility follow-up

Reviewed Chair 2 handoff in issue #8 and PR #39 pinned 252802dcc6007a39c4550818c620aeb1ee71eabc. Concrete tokens and retained #studio-asset-client-slot/#studio-asset-client are now published; missing-Tyler-token/slot wording in older handoffs is superseded. PR #39 remains separate/unmerged and excludes PR #33.

Cassy's scoped view.css now consumes --studio-text, --studio-panel, --studio-raised, --studio-muted, --studio-line and --studio-sky, with exact published standalone fallbacks. Inter/Segoe UI/system fallback stack uses no font installation. Focus matches published #79d9ff, 3px outline with 3px offset. Control boundaries use muted rather than decorative line token so controls remain distinct. No shared CSS/shell or mount code edited.

Standalone synthetic browser computed panel #0e1b2e, text #f2f6fb, controls #13243a, border #a6b5ca and focus #79d9ff. Tab moved name to tags; viewport/scroll width both 1239. Calculated text/panel contrast 15.93:1, border/control 7.52:1, focus/panel 10.85:1. These are declared-color calculations, not whole-interface accessibility certification. Screenshot token-compatibility-preview.png. Exact CSS diff and whitespace reviewed. JavaScript unchanged; preceding 69-test result remains applicable and was not rerun for color-only edits.

Not verified: PR #33 composed with #39, inherited token overrides, actual Windows screen-reader/High Contrast, integrated modal focus/inert behavior or installed runtime. Service, OS-isolation and distribution gates remain separate. No production/customer/paid/backend use. PR #36 review stays unposted.
