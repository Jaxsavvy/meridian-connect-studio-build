# Reusable linked Website sections

DEV-006 #9 / Chair 2, local reusable-component contribution.

Make section shared adds a website-local group identity. The Shared sections
list can insert a linked copy on any page, with a distinct instance ID. Editing
heading/body/action/destination or formatting synchronizes every linked copy in
that website. One Undo reverses the entire grouped edit. Detach shared copy keeps
content while enabling independent edits; Undo/Redo can relink/detach it.

Save/reopen, checkpoints and static export preserve these copies. Rendering
uses their synchronized ordinary section content, without exported scripts or
external dependencies. Validation rejects invalid identities or divergent group
content on import/open/export. Insertion cannot reference another website and
respects the existing 100-section bound. Removing a page or section removes only
its instances. Existing copies elsewhere remain; deleting the last copy removes
that group from the catalogue. Undo can restore it during the current session.

This catalogue consists of existing instances. It is not a standalone persistent
template store, cross-website library, remote global service or header/footer
system. No backend, bridge, dependency, package or authority change.

Three model regressions cover propagation/persistence/checkpoints/formatting,
detach/Undo and divergent or foreign-group rejection. Full relevant local suite
155/155. Real UI coverage inserts across pages, propagates edits, detaches with
Undo/Redo, checks independent content and actual preview/ZIP output. Exact-source
CI and visual acceptance are pending publication. All PRs remain unmerged.
