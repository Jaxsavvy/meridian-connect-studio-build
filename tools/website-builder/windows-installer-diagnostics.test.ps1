$ErrorActionPreference = 'Stop'
# Explicit fixture paths prevent environment defaults being evaluated in local tests.
. "$PSScriptRoot/windows-installer-diagnostics.ps1" -PackageDirectory 'synthetic-package' -InstallDirectory 'synthetic-install' -EvidenceDirectory 'synthetic-evidence'
function Assert-True($value, $message) { if (!$value) { throw $message } }
$xml = '<Event><EventData><Data Name="AppName">Meridian-Connect-Setup-0.2.12.exe</Data><Data Name="ModuleName">ntdll.dll</Data><Data Name="ExceptionCode">c0000005</Data><Data Name="FaultingOffset">000000001234abcd</Data><Data Name="AppPath">X:\SYNTHETIC_PRIVATE\installer.exe</Data><Data Name="CommandLine">SYNTHETIC_SECRET</Data></EventData></Event>'
$safe = ConvertTo-SafeCrashEvent $xml
Assert-True ($safe.module -eq 'ntdll.dll' -and $safe.exceptionCode -eq 'c0000005') 'Meaningful crash fields were lost'
Assert-True (($safe | ConvertTo-Json) -notmatch 'SYNTHETIC_PRIVATE|SYNTHETIC_SECRET|AppPath|CommandLine') 'Private fields leaked'
$unsafe = ConvertTo-SafeCrashEvent ($xml.Replace('ntdll.dll','C:\private\module.dll').Replace('c0000005','arbitrary contents').Replace('000000001234abcd','private offset'))
Assert-True ($unsafe.module -eq 'unavailable' -and $unsafe.exceptionCode -eq 'unavailable' -and $unsafe.faultingOffset -eq 'unavailable') 'Unexpected data was accepted'
Assert-True ($null -eq (ConvertTo-SafeCrashEvent ($xml.Replace('Meridian-Connect-Setup-0.2.12.exe','OtherApplication.exe')))) 'Unrelated application included'
Assert-True ($null -eq (ConvertTo-SafeCrashEvent ($xml.Replace('Meridian-Connect-Setup-0.2.12.exe','C:\private\Meridian-Connect-Setup-0.2.12.exe')))) 'Application path included'
Assert-True ($null -eq (ConvertTo-SafeCrashEvent '<Event><EventData /></Event>')) 'Missing data was accepted'
Write-Output 'INSTALLER_DIAGNOSTIC_FIXTURES_PASSED (6 cases)'

# Exercise control flow without launching an executable or reading Windows events.
$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('meridian-installer-fixtures-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot | Out-Null
$env:GITHUB_ENV = Join-Path $fixtureRoot 'github-env.txt'
$script:fakeExit = -1073741819
$script:fakePresent = $false
$script:fakeLaunches = 0
function Get-ChildItem { return [pscustomobject]@{FullName='synthetic-installer.exe'; Length=1234} }
function Get-FileHash { return [pscustomobject]@{Hash=('a' * 64)} }
function git { return ('b' * 40) }
function Start-Process { $script:fakeLaunches++; return [pscustomobject]@{ExitCode=$script:fakeExit} }
function Test-Path { return $script:fakePresent }
function Get-Process { return @() }
function Get-WinEvent { throw 'PRIVATE_RAW_QUERY_MESSAGE' }
$EvidenceDirectory = Join-Path $fixtureRoot 'failure'
$failed = $false
try { Invoke-InstallerDiagnostic } catch { $failed = $_.Exception.Message -eq 'Installer exit -1073741819' }
$report = Get-Content (Join-Path $EvidenceDirectory 'results.json') -Raw | ConvertFrom-Json
Assert-True ($failed -and $report.exitCode -eq -1073741819 -and $report.result -eq 'failed' -and $script:fakeLaunches -eq 1) 'Failure/retry semantics changed'
Assert-True (($report | ConvertTo-Json -Depth 6) -notmatch 'PRIVATE_RAW_QUERY_MESSAGE') 'Raw diagnostic query leaked'
$script:fakeExit = 0
$EvidenceDirectory = Join-Path $fixtureRoot 'missing'
$failed = $false
try { Invoke-InstallerDiagnostic } catch { $failed = $_.Exception.Message -eq 'Installed executable missing' }
Assert-True $failed 'Missing executable accepted'
$script:fakePresent = $true
$EvidenceDirectory = Join-Path $fixtureRoot 'success'
Invoke-InstallerDiagnostic
$report = Get-Content (Join-Path $EvidenceDirectory 'results.json') -Raw | ConvertFrom-Json
Assert-True ($report.result -eq 'passed' -and $report.executablePresent -and (Get-Content $env:GITHUB_ENV -Raw).Contains('MERIDIAN_INSTALLED_EXE=')) 'Successful installation handoff lost'
Write-Output 'INSTALLER_DIAGNOSTIC_CONTROL_FLOW_PASSED (3 cases; no executable launched)'
