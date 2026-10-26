# Merge production OSS licenses from all web apps into shared/legal/oss-licenses.bundle.json
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outPath = Join-Path $root 'web\shared\legal\oss-licenses.bundle.json'
$apps = @('buyer-web', 'vendor-portal', 'delivery-portal', 'super-admin')
$merged = @{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  apps        = @{}
}

foreach ($app in $apps) {
  $dir = Join-Path $root "web\$app"
  if (-not (Test-Path (Join-Path $dir 'package.json'))) { continue }
  Push-Location $dir
  try {
    $tmp = Join-Path $env:TEMP "hlm-lic-$app.json"
    npx --yes license-checker --production --json 2>$null | Set-Content -Path $tmp -Encoding utf8
    if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -lt 4) { continue }
    $raw = Get-Content $tmp -Raw | ConvertFrom-Json
    $list = @()
    foreach ($prop in $raw.PSObject.Properties) {
      $entry = $prop.Value
      $n = if ($entry.name) { $entry.name } else { $prop.Name }
      $v = if ($entry.version) { $entry.version } else { '' }
      $lic = if ($entry.licenses) { $entry.licenses } else { 'UNKNOWN' }
      $repo = if ($entry.repository) { $entry.repository } else { '' }
      $list += @{
        name       = $n
        version    = $v
        license    = $lic
        repository = $repo
      }
    }
    $merged.apps[$app] = ($list | Sort-Object name)
  }
  finally {
    Pop-Location
  }
}

$merged | ConvertTo-Json -Depth 6 | Set-Content -Path $outPath -Encoding utf8
Write-Host "Wrote $($merged.apps.Count) app license lists to $outPath"
