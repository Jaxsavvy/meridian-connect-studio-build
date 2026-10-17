# Long-name download correction

PR #33 client fix for the reviewed 160-character boundary. Controller now derives the download suggestion from validated asset metadata and the exact selected version via Model.exportName. It no longer revalidates the completed filename against the display-name stem limit or trusts a transport-supplied filename. A 160-unit name plus __v1.txt correctly yields 168 units; original filename/hash remain unchanged. No destination path is granted and the future host-owned OS save flow remains separate.

The Display name input now has maxLength=160, matching current Model.text JavaScript UTF-16 code-unit behavior. Three new tests cover the full long-name download and 161-unit rejection, malicious transport filename ignoring, emoji boundary/suffix, and input property. Combined suite 65 pass; controller/view syntax and exact diff checks pass. No browser/native OS filename/installed runtime or screen-reader acceptance is claimed.

PR #36 service-side generated filename policy and cross-language Unicode counting still need agreement. No PR #36 edits or review comments posted. User's drafted review remains unposted. Existing DEV-003 local work preserved; no shared bridge, source, backend or packaging changes.
