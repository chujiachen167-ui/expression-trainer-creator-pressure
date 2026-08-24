[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$modelsRoot = Join-Path $projectRoot 'models'
$modelName = 'sherpa-onnx-streaming-paraformer-bilingual-zh-en'
$modelRoot = Join-Path $modelsRoot $modelName
$requiredFiles = @('encoder.int8.onnx', 'decoder.int8.onnx', 'tokens.txt')
$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $modelRoot $_)) })

if ($missingFiles.Count -eq 0) {
  Write-Output "ASR model is already ready: $modelRoot"
  exit 0
}

New-Item -ItemType Directory -Force -Path $modelsRoot | Out-Null
$downloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) 'expression-trainer-model-download'
New-Item -ItemType Directory -Force -Path $downloadRoot | Out-Null
$archivePath = Join-Path $downloadRoot "$modelName.tar.bz2"
$modelUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$modelName.tar.bz2"

Write-Output "Downloading the local bilingual ASR model..."
& curl.exe --fail --location --retry 3 --output $archivePath $modelUrl
if ($LASTEXITCODE -ne 0) { throw "Model download failed with exit code $LASTEXITCODE" }

Write-Output "Extracting the ASR model..."
& tar.exe -xf $archivePath -C $modelsRoot
if ($LASTEXITCODE -ne 0) { throw "Model extraction failed with exit code $LASTEXITCODE" }

$missingFiles = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $modelRoot $_)) })
if ($missingFiles.Count -gt 0) { throw "Model installation incomplete. Missing: $($missingFiles -join ', ')" }

Remove-Item -LiteralPath $archivePath -Force
Write-Output "ASR model ready: $modelRoot"
