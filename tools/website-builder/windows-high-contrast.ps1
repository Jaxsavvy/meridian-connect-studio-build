# Actual OS setting on a disposable CI runner only; always restore its prior value.
$ErrorActionPreference = 'Stop'
if (!$env:GITHUB_ACTIONS -or $env:RUNNER_OS -ne 'Windows') { throw 'Only run on a disposable Windows Actions runner' }
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MeridianContrast {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct HIGHCONTRAST {
    public uint cbSize;
    public uint dwFlags;
    public IntPtr lpszDefaultScheme;
  }
  public struct Snapshot { public uint dwFlags; public string Scheme; }
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool SystemParametersInfo(uint action, uint param, ref HIGHCONTRAST value, uint flags);
  public static Snapshot Read() {
    HIGHCONTRAST value = new HIGHCONTRAST();
    value.cbSize = (uint)Marshal.SizeOf(typeof(HIGHCONTRAST));
    if (!SystemParametersInfo(0x0042, value.cbSize, ref value, 0)) throw new System.ComponentModel.Win32Exception();
    // The returned scheme pointer belongs to Windows. Never marshal it as an
    // owned string that the P/Invoke marshaller could attempt to free.
    return new Snapshot { dwFlags=value.dwFlags, Scheme=value.lpszDefaultScheme==IntPtr.Zero ? null : Marshal.PtrToStringUni(value.lpszDefaultScheme) };
  }
  public static void Write(Snapshot snapshot) {
    IntPtr scheme = snapshot.Scheme == null ? IntPtr.Zero : Marshal.StringToHGlobalUni(snapshot.Scheme);
    try {
      HIGHCONTRAST value = new HIGHCONTRAST { cbSize=(uint)Marshal.SizeOf(typeof(HIGHCONTRAST)), dwFlags=snapshot.dwFlags, lpszDefaultScheme=scheme };
      if (!SystemParametersInfo(0x0043, value.cbSize, ref value, 3)) throw new System.ComponentModel.Win32Exception();
    } finally { if (scheme != IntPtr.Zero) Marshal.FreeHGlobal(scheme); }
  }
}
'@
Write-Output 'Reading actual OS High Contrast flags'
$original = [MeridianContrast]::Read()
$record = @{ originalFlags=$original.dwFlags; mechanism='Win32 SPI_SETHIGHCONTRAST, not Chromium media emulation'; restored=$false }
$output = Join-Path $PWD 'test-output/windows-high-contrast'
New-Item -ItemType Directory -Path $output -Force | Out-Null
try {
  $enabled = $original
  $enabled.dwFlags = ($original.dwFlags -bor 1) -band (-bnot 0x1000)
  [MeridianContrast]::Write($enabled)
  Write-Output 'OS High Contrast enable call returned; verifying readback'
  $actual = [MeridianContrast]::Read()
  if (($actual.dwFlags -band 1) -ne 1) { throw 'OS High Contrast readback was not enabled' }
  $record.enabledFlags = $actual.dwFlags
  $env:MERIDIAN_REQUIRE_OS_HIGH_CONTRAST = '1'
  $env:MERIDIAN_UI_FLOW_EVIDENCE = $output
  & node_modules/.bin/electron.cmd tools/website-builder/ui-flow-smoke.cjs
  if ($LASTEXITCODE -ne 0) { throw "Actual OS Contrast Electron run exit $LASTEXITCODE" }
  $record.status = 'passed'
} finally {
  Write-Output 'Restoring original OS High Contrast flags'
  [MeridianContrast]::Write($original)
  $restored = [MeridianContrast]::Read()
  $record.restoredFlags = $restored.dwFlags
  $record.restored = $restored.dwFlags -eq $original.dwFlags
  Remove-Item Env:MERIDIAN_REQUIRE_OS_HIGH_CONTRAST -ErrorAction SilentlyContinue
  Remove-Item Env:MERIDIAN_UI_FLOW_EVIDENCE -ErrorAction SilentlyContinue
  $record | ConvertTo-Json | Set-Content (Join-Path $output 'os-setting.json')
  if (!$record.restored) { throw 'Original OS High Contrast flags did not restore' }
}
