# Explicit external synthetic-test staging; downloads only pinned official artifacts.
# Does not install, launch, package or grant Connect access to Upscayl.
$ErrorActionPreference = 'Stop'
$taskStage = Join-Path $env:TEMP 'meridian-dev005-upscayl-20251207'
New-Item -ItemType Directory -Force $taskStage,(Join-Path $taskStage 'models') | Out-Null
$taskItems = @(
  @{name='upscayl-bin-20251207-174704-windows.zip';url='https://github.com/upscayl/upscayl-ncnn/releases/download/20251207-174704/upscayl-bin-20251207-174704-windows.zip';hash='1f0f65c5d2ade866555e2ac467d35952c35a47080a4060fe56a1ab028f67258a'},
  @{name='models/upscayl-lite-4x.bin';url='https://raw.githubusercontent.com/upscayl/upscayl/4f39acfc6f88260d105920a64deff8431d5e1544/resources/models/upscayl-lite-4x.bin';hash='85ee266b632a765a725425ba6a5620c088c8aa2939a03063b2d83b3462724cc1'},
  @{name='models/upscayl-lite-4x.param';url='https://raw.githubusercontent.com/upscayl/upscayl/4f39acfc6f88260d105920a64deff8431d5e1544/resources/models/upscayl-lite-4x.param';hash='22174924330297357434ad21ed0af7f4b820008d2a502b492754d130d4142714'}
)
foreach($taskItem in $taskItems) {
  $taskPath = Join-Path $taskStage $taskItem.name
  if(-not(Test-Path -LiteralPath $taskPath)) { Invoke-WebRequest -UseBasicParsing -Uri $taskItem.url -OutFile $taskPath -TimeoutSec 60 }
  if((Get-FileHash -LiteralPath $taskPath -Algorithm SHA256).Hash.ToLower() -ne $taskItem.hash) { throw "Pin mismatch: $($taskItem.name)" }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip = Join-Path $taskStage 'upscayl-bin-20251207-174704-windows.zip'
$taskDestination = Join-Path $taskStage 'cli'
$taskArchive = [IO.Compression.ZipFile]::OpenRead($taskZip)
try {
  foreach($taskEntry in $taskArchive.Entries) {
    $taskTarget = [IO.Path]::GetFullPath((Join-Path $taskDestination $taskEntry.FullName))
    if(-not $taskTarget.StartsWith(($taskDestination+[IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe archive entry' }
  }
} finally { $taskArchive.Dispose() }
Expand-Archive -LiteralPath $taskZip -DestinationPath $taskDestination -Force
$taskExe = Join-Path $taskDestination 'upscayl-bin-20251207-174704-windows/upscayl-bin.exe'
if((Get-FileHash -LiteralPath $taskExe -Algorithm SHA256).Hash.ToLower() -ne '294d31be8f29d047c0d91a8dcd5e739616ece56bce3188ac688f9a52d70abe60') { throw 'Executable pin mismatch' }
Write-Output 'Official Upscayl CLI and lite 4x model staged outside Git; all pins match. No process launched.'
