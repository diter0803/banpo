$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$docs = Join-Path $root "docs"
$safeRoot = [IO.Path]::GetFullPath($root)
$safeDocs = [IO.Path]::GetFullPath($docs)

if (-not $safeDocs.StartsWith($safeRoot)) {
  throw "The docs directory is outside the project root. Stopped."
}

if (Test-Path -LiteralPath $docs) {
  Remove-Item -LiteralPath $docs -Recurse -Force
}

New-Item -ItemType Directory -Path $docs | Out-Null

$items = @(
  "index.html",
  "src",
  "public"
)

foreach ($item in $items) {
  $source = Join-Path $root $item
  $target = Join-Path $docs $item
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing required publish item: $item"
  }
  Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

New-Item -ItemType File -Path (Join-Path $docs ".nojekyll") -Force | Out-Null

Write-Host ""
Write-Host "GitHub Pages package generated:" -ForegroundColor DarkYellow
Write-Host "  $docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Use these GitHub repository settings:" -ForegroundColor DarkGray
Write-Host "  Source: Deploy from a branch" -ForegroundColor DarkGray
Write-Host "  Branch: main / docs" -ForegroundColor DarkGray
Write-Host ""
