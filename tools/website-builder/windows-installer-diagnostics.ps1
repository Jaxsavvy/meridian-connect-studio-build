param(
  [string]$PackageDirectory = (Join-Path $env:RUNNER_TEMP 'meridian-package'),
  [string]$InstallDirectory = (Join-Path $env:RUNNER_TEMP 'meridian-installed'),
  [string]$EvidenceDirectory = 'test-output/windows-installer'
)
$ErrorActionPreference = 'Stop'

function ConvertTo-SafeCrashEvent {
  param([string]$EventXml)
  # Never return event messages, full paths, command lines, account or machine names.
  [xml]$document = $EventXml
  $fields = @{}
  foreach ($datum in $document.Event.EventData.Data) {
    $fields[[string]$datum.Name] = [string]$datum.InnerText
  }
  $app = [string]$fields['AppName']
  if ($app -notmatch '^Meridian-Connect-Setup-[0-9][0-9A-Za-z.\-]{0,64}\.exe$') { return $null }
  $module = [string]$fields['ModuleName']
  if ($module -notmatch '^[A-Za-z0-9_.\-]{1,100}$') { $module = 'unavailable' }
  $code = [string]$fields['ExceptionCode']
  if ($code -notmatch '^(0x)?[0-9a-fA-F]{8}$') { $code = 'unavailable' }
  $offset = [string]$fields['FaultingOffset']
  if ($offset -notmatch '^(0x)?[0-9a-fA-F]{1,16}$') { $offset = 'unavailable' }
  return [ordered]@{ eventId = 1000; application = $app; module = $module; exceptionCode = $code; faultingOffset = $offset }
}

function Invoke-InstallerDiagnostic {
  $installers = @(Get-ChildItem -LiteralPath $PackageDirectory -Filter 'Meridian-Connect-Setup-*.exe' -File)
  if ($installers.Count -ne 1) { throw 'Expected exactly one disposable installer' }
  $installer = $installers[0]
  $started = [DateTime]::UtcNow
  $report = [ordered]@{
    schema = 'meridian.installer-diagnostic.v1'
    sourceCommit = ((git rev-parse HEAD) -join '').Trim()
    sourceTree = ((git rev-parse 'HEAD^{tree}') -join '').Trim()
    installer = [ordered]@{ sha256 = (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); bytes = $installer.Length }
    startedUtc = $started.ToString('o')
    finishedUtc = $null
    exitCode = $null
    executablePresent = $false
    crashEvents = @()
    eventQuery = 'not attempted'
    result = 'not completed'
    limits = 'Disposable unsigned Windows CI. No crash event is not proof of no crash. No retries, dumps, raw event messages or policy changes.'
  }
  New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
  try {
    $process = Start-Process -FilePath $installer.FullName -ArgumentList "/S /D=$InstallDirectory" -WindowStyle Hidden -Wait -PassThru
    $report.exitCode = $process.ExitCode
    $exe = Join-Path $InstallDirectory 'Meridian Connect.exe'
    $report.executablePresent = Test-Path -LiteralPath $exe
    $report.result = if ($process.ExitCode -eq 0 -and $report.executablePresent) { 'passed' } else { 'failed' }
    if ($process.ExitCode -ne 0) { throw "Installer exit $($process.ExitCode)" }
    if (!$report.executablePresent) { throw 'Installed executable missing' }
    Get-Process -Name 'Meridian Connect' -ErrorAction SilentlyContinue | Stop-Process -Force
    "MERIDIAN_INSTALLED_EXE=$exe" >> $env:GITHUB_ENV
  } finally {
    $report.finishedUtc = [DateTime]::UtcNow.ToString('o')
    try {
      # Bounded query; only matching installer application events enter the report.
      $events = @(Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1000; StartTime=$started.ToLocalTime()} -MaxEvents 30 -ErrorAction Stop)
      $safe = @($events | ForEach-Object { ConvertTo-SafeCrashEvent $_.ToXml() } | Where-Object { $null -ne $_ })
      $report.crashEvents = $safe
      $report.eventQuery = 'completed'
    } catch {
      $report.eventQuery = 'unavailable or no matching events'
    }
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'results.json') -Encoding utf8
  }
}

if ($MyInvocation.InvocationName -ne '.') { Invoke-InstallerDiagnostic }
