# Static client evidence

Inspected sanitized branch `feature/studio-assets`, baseline `cd6bf77cd30265e056b72b32b53e49463abf7f40`, matching remote main at inspection. These observations establish source behavior, not successful service execution.

| Source | Code-confirmed client behavior | Not established |
| --- | --- | --- |
| `src/renderer/app.js:371` | `selectProject` finds a project from the loaded list, sets current project and requests its files through preload. | Server membership and tenant isolation. |
| `src/renderer/project-workspace.js:255`, `:588` | Files, Deliverables and Storyboards tabs exist. Files requests `/api/projects/{id}/files`, filters sections locally, displays name/section/size/updated, uploads to selected section and downloads by name/section. Late Files responses are checked against workspace project/tab. | Immutable IDs, atomic upload, version lineage, retry deduplication, storage format. |
| `src/renderer/project-workspace.js:762` | Deliverables requests a project list and posts title/body/status edits; deletion uses a separate action route. | Asset-version attachment or server review authorization. |
| `src/renderer/storyboard.js:19`, `:139`, `:368` | Routes derive from selected project; storyboard state is reused only for matching project. Delete confirmation says frames stay in project folder. | Actual retention after deletion; original preservation or asset registration. UI wording is not server evidence. |
| `src/preload.js:61` | Named IPC bridge exposes workspace requests, project uploads/downloads and image helpers. | Safe main-process validation for a future asset job or process launch. |
| `src/api.js:175` | Workspace helper restricts route families to projects/tasks/chat-hub and uses GET or POST; selected Storyboard actions have longer timeouts. | Fine-grained resource permission enforcement. |
| `src/api.js:189`, `:257` | Storyboard image helper guards route shape; uploads send bytes and bearer authorization. | Image safety, limits, model rights, job isolation. |
| `src/api.js:275`, `:293` | Project upload reads whole local file, sends basename and section with bytes; download returns a buffered response. Both attach bearer auth and return errors/offline flags. | Streaming/resumable transfers, checksum verification or collision semantics. |

Existing filename/section calls cannot be treated as the proposed asset API. Preserve them until Chair 1 defines migration. A route regex, selected project or hidden button is never evidence of server authorization. No live endpoints, client files, backend source, or installed production app were consulted.

Required future adapters: map legacy Files references to canonical project/asset/version IDs through an approved server mapping; represent Deliverable attachments and Storyboard panel inputs as explicit version references. Never infer identity from matching filenames or hashes across projects.
