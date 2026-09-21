# Clone/check the optional LiveTalking GPU runtime next to this product.
# Models and Python env stay outside git. This script does not download weights.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sibling = Join-Path (Split-Path -Parent $root) 'LiveTalking'
Write-Output "Product: $root"
Write-Output "LiveTalking: $sibling"
if (-not (Test-Path $sibling)) {
  git clone --depth 1 https://github.com/lipku/LiveTalking.git $sibling
} else {
  Write-Output 'LiveTalking already cloned.'
}
Write-Output ''
Write-Output 'Next (not run by this script):'
Write-Output '  1. Use Python 3.10/3.12, not 3.14.'
Write-Output '  2. Install CUDA PyTorch + LiveTalking requirements on that env.'
Write-Output '  3. Place wav2lip.pth and wav2lip256_avatar1 under LiveTalking models/avatars.'
Write-Output '  4. python app.py --transport webrtc --model wav2lip --avatar_id wav2lip256_avatar1'
Write-Output '  5. In V2 QA panel, set Provider to LiveTalking at http://127.0.0.1:8010'
Write-Output ''
Write-Output 'https://read-yourself.com cannot use this localhost server. See docs/avatar/livetalking.md'
