# Saved website recovery catalogue

DEV-006 #9 follow-up to the full build audit. Fresh #33/#36/#38/#39 heads were
unchanged. Two further failures reproduced against e89c0cf:

- A missing index plus a pending-only/backup-only website is invisible, although
  open(id) could recover it if its ID were known. Discover candidate identities
  from every primary/backup/pending key, deduplicate, then validate on open.
- All malformed candidates silently disappear from list(), making the UI claim
  no websites were saved. Keep the readable list contract, expose separate
  project-scoped unavailable identities, and show an explicit retained-record
  warning with retry. Never infer deletion, invent a draft or remove the record.

Preserve existing valid IDs that themselves end in .pending/.backup: use the
stored ID only when its encoded key matches a primary/recovery candidate;
malformed content still falls back to its scoped filename identity. Another
website's substituted record cannot satisfy open's expected-identity validation.
No saved names/content are guessed from malformed bytes.

174 relevant local tests pass. The new mounted renderer flow creates a synthetic
pending-only record outside the index, opens it, corrupts all candidates, checks
warning/retry visibility at200%, verifies failed retry preserves bytes, restores
the fixture and retries successfully. Its cleanup removes only test fixture
records; the application adds no delete or automatic repair operation. Runtime
acceptance is pending until recorded below. All PRs remain unmerged.
