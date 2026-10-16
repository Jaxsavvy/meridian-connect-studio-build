# Upscayl pinned development artifacts and real evidence

On 2026-10-12, Cassy requested implementing Upscayl and sourcing the missing artifacts while Tyler completes his build. Official artifacts were downloaded to temporary development storage outside the repository. No installer was run and no binaries/models/generated output were added to Git or Electron packaging. Owner distribution and integrated isolation-policy acceptance are not claimed.

## Provenance and pins

CLI: [official upscayl-ncnn release 20251207-174704](https://github.com/upscayl/upscayl-ncnn/releases/tag/20251207-174704). Windows ZIP SHA-256 matched GitHub's published release digest. Model: [Upscayl v2.15.0 resources](https://github.com/upscayl/upscayl/tree/4f39acfc6f88260d105920a64deff8431d5e1544/resources/models), pinned to commit `4f39acfc6f88260d105920a64deff8431d5e1544`. Both downloaded model Git blob IDs matched the pinned tree.

| Artifact | SHA-256 |
| --- | --- |
| Windows CLI ZIP | `1f0f65c5d2ade866555e2ac467d35952c35a47080a4060fe56a1ab028f67258a` |
| Extracted upscayl-bin.exe | `294d31be8f29d047c0d91a8dcd5e739616ece56bce3188ac688f9a52d70abe60` |
| upscayl-lite-4x.bin | `85ee266b632a765a725425ba6a5620c088c8aa2939a03063b2d83b3462724cc1` |
| upscayl-lite-4x.param | `22174924330297357434ad21ed0af7f4b820008d2a502b492754d130d4142714` |

Model Git blob IDs: `.bin` `e0a8b6ca061931284832a67cdd4112d94a7c98a0`; `.param` `221234ab0dc2641a11038f3682669ded6ba9e6d6`. SHA-256 values pin these inspected bytes; upstream ZIP digest establishes release integrity, not a security audit or signing guarantee. No auto-update or model substitution is allowed by the runner.

## License inventory

The downloaded release includes AGPLv3 [backend license](https://github.com/upscayl/upscayl-ncnn/blob/20251207-174704/LICENSE). The model source repository carries [AGPLv3](https://github.com/upscayl/upscayl/blob/4f39acfc6f88260d105920a64deff8431d5e1544/LICENSE) and a [Real-ESRGAN BSD-3-Clause notice](https://github.com/upscayl/upscayl/blob/4f39acfc6f88260d105920a64deff8431d5e1544/Real-ESRGAN_LICENSE.txt). Original license files remain with the external development bundle. Model-specific provenance and any redistribution/source/notice obligations require owner review before packaging; this inventory does not assert that every weight is covered solely by the Real-ESRGAN notice.

## Implemented native boundary

`src/studio-assets/native-runner.js` launches the pinned CLI with an argument array, shell disabled, hidden window, reduced environment and exclusive per-job input/output paths. It verifies executable, model and parameter hashes before launch; fixes model/scale/tile/thread/output options; rejects existing outputs, path substitution and symlinks; limits captured diagnostics; supports cancellation/timeout and removes cancelled partial output after process closure. Windows cancellation requests tree termination, falling back to the launched child's process handle. Actual test used direct-child termination; descendant-tree containment is not yet independently verified.

`src/studio-assets/png.js` verifies PNG chunk CRCs, IHDR dimensions, complete bounded decompression and scanline filters. Supports non-interlaced 8-bit grayscale/RGB/grayscale-alpha/RGBA PNG; rejects unsupported bit depth, palette-only or interlaced images. It is not a general image/media scanner. Runner validates output before success because upstream can return zero without an output.

Isolation classification is explicitly **process-scoped**, not OS-enforced. Native runner does not restrict OS network/file privileges or enforce GPU/memory quotas. The existing `UpscaleWorker` OS-isolation gate still rejects this runner for integrated use; it was not weakened or labeled sandboxed. Real CLI checks run through a separate synthetic-only development harness under the tool's default execution restrictions. Approved host sandbox integration remains Chair 1 coordination work.

## Real synthetic results

Device: NVIDIA GeForce GTX 1650, driver `32.0.15.9597`; real CLI selected this Vulkan device. A CRC-valid synthetic 32x32 RGB PNG was enlarged to 128x128 using lite 4x, tile 32 and threads 1:1:1. Exit code 0, fully decoded output, approximately 2.16 seconds on the final success check (first cold run about 3.81 seconds). This is one tiny fixture, not a general performance benchmark.

- Input hash: `4343babd21841bda7085802658893a322c705cfab1ef3cfa9bbb39b8f87f7eea`.
- Output hash: `27df3c9a998933e98971ece02e1d0f03122476f631b94c5b59fee922a7e61d58`.
- Original unchanged. Actual output registered as a separate derivative version in the **synthetic adapter**; repeated registration by the same job key yielded the same version and two total versions. This does not verify server persistence/permissions.
- Cancellation: launched CLI stopped via direct child handle, around 475 ms; no partial output retained and original unchanged. No derivative registered.
- Timeout: 100 ms runner budget produced PROCESS_TIMEOUT after actual launch, preserved original and removed output.
- Corrupt bytes: upstream exit code 0 with no output; runner rejected OUTPUT_MISSING. A zero process code alone is insufficient evidence.
- Missing input and mismatched model hash rejected before invocation.

Input/output and raw development diagnostics are retained only in external temporary staging. Human inspection found the expected enlargement with softened boundaries; quality is not acceptance for real artwork.

## Runnable synthetic UI with the real CLI

`node docs/studio/assets/8/native-demo.cjs` serves `http://127.0.0.1:8769/` using a strict static-file allowlist and a visibly synthetic memory fixture transport. It verifies artifact pins on startup. Only the generated seed PNG and its derivatives can be enhanced; arbitrary file imports are denied by the fixture host, not merely hidden in the UI. No Connect credentials, authoritative service, or shared bridge are used.

Browser evidence: selected project A/original, invoked **Upscale as new version**, observed Running then Succeeded, selected a separate draft derivative and visible parent/source identity. Two intentionally separate successful job IDs produced v2 and v3; a subsequent cancelled job stayed cancelled and a fresh list still showed three total versions. No cancelled version was published. [Native test preview](native-preview.png) shows selected derivative and cancelled later job state. Real process cancellation was also independently verified by the CLI harness. This runnable development preview is not Tyler's finished layout or a packaged Connect build.

## Reproduce explicitly

```powershell
& docs/studio/assets/8/stage-upscayl.ps1
node docs/studio/assets/8/upscayl-smoke.cjs
node docs/studio/assets/8/upscayl-failures.cjs
```

Staging validates pins and archive paths; it does not install or launch. Smoke/failure scripts explicitly invoke the staged official binary on synthetic inputs only. Do not run them automatically in CI, against customer files, or through an unapproved production host. Owner must review artifact licensing, OS isolation/resource controls, shared IPC and final package behavior before integration/distribution.
