# Boundary and installer investigation — October 18

Read-only investigation. Restricted main/preload/packaging and other-chair code unchanged.

## External URLs

Current reviewed source main.js:622 forwards renderer app:open-external values
to shell.openExternal; :745 checks http(s) for browser-open, but :749 forwards
new-window targets without that check. This remains a static boundary finding;
no OS handler or live record was invoked. Proposed Chair1 correction: parse a
string URL centrally, restrict to agreed http/https schemes, bound input and
validate sender/window identity for every route, including new-window events.
Test rejected types, file/javascript/custom schemes, malformed URLs and foreign
senders, plus valid https and redirects. Exact allowed policy is an owner decision.

## Request normalization — corrected in published test inputs

Current recheck: PR36 `d2fffe0beb7501eb45f667a99693e140ec246685` rejects the160-unit U+0344
input after NFC expands it to320 units, with INVALID_REQUEST. Cassy
`69dbc7b688ed94823d082ee400833db1feb3f28c` adds the corresponding component
normalized text bound and regressions. This supersedes the open-defect claim
below for these public test/client inputs. It does not prove mounted service
normalization, body-digest or policy acceptance. Restricted source unchanged.

### Historical reproduction

Reproduced against exact PR36 ed17ef68 (test-only module evaluated in isolation):
files.metadata accepts a name of U+0344 repeated160 times; NFC yields320 UTF-16
units, while the response/component limit is160. bodyDigest accepted the payload.
The text helper validates length before normalization. Proposed correction: agree
canonical form with service, normalize/trim once, validate final representation
for emptiness, length and controls, and digest that same representation. Cover
name/tag/import/description bounds and canonical-equivalent retry bodies. Owner/
Cassy must approve contract semantics; this review does not patch their reference.

## Installer reliability

Issue28 retains recurring NSIS installation exit -1073741819 (0xC0000005),
including sourcee665915 run39054433545 attempt1. Exactly one same-source retry
passed installed source/startup/keyboard/gating. Newer published final workflows
pass; intermittent failure remains unresolved. A successful retry proves neither
a root cause nor a fix. Next owner diagnostic: retain exact installer digest,
runner image/OS, installer logs and Windows crash module/event evidence from a
failed run; compare with same-source success before choosing a packaging change.
Do not install over an employee application or infer the failing module from the
exit code alone. No installer execution or package modification in this step.

## Continuation readback

The app:open-external/new-window URL paths remain as recorded after a fresh
source read; no handler was invoked. Proposed rejection cases cover non-string,
file/javascript/custom schemes, malformed URLs and foreign sender/window scope;
valid HTTPS and expected redirects need positive tests under an owner-approved
policy. Renderer filtering is insufficient.

Latest verified prior f665d64 Windows installation passed on first attempt.
Issue28 still records earlier -1073741819 failures; neither current logs nor
available inputs identify the crash module/root cause. Preserve runner image,
installer digest/log, crash event/dump and same-source success/failure pairs
before proposing package changes. No new package modification or local employee
installation was attempted. The investigation/preparation item is complete;
those owner-scoped corrections and reliability acceptance remain open.
