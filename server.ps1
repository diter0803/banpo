$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4173
$prefix = "http://127.0.0.1:$port/"
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".mp3" = "audio/mpeg"
  ".svg" = "image/svg+xml"
  ".wasm" = "application/wasm"
  ".task" = "application/octet-stream"
}

function Resolve-RequestPath([string]$urlPath) {
  $decoded = [Uri]::UnescapeDataString($urlPath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($decoded)) { $decoded = "index.html" }
  if ($decoded.StartsWith("materials/")) { $decoded = "public/$decoded" }
  $candidate = [IO.Path]::GetFullPath((Join-Path $root $decoded))
  $safeRoot = [IO.Path]::GetFullPath($root)
  if (-not $candidate.StartsWith($safeRoot)) { return $null }
  return $candidate
}

try {
  $listener.Start()
  Write-Host ""
  Write-Host "  Banpo Particle Lab is running" -ForegroundColor DarkYellow
  Write-Host "  $prefix" -ForegroundColor Cyan
  Write-Host "  Keep this window open. Press Ctrl+C to stop." -ForegroundColor DarkGray
  Write-Host ""
  try { Start-Process $prefix } catch {}

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while (($line = $reader.ReadLine()) -ne $null -and $line -ne "") {}

      $urlPath = "/"
      if ($requestLine -match "^[A-Z]+\s+([^\s]+)") {
        $urlPath = ([Uri]("http://localhost" + $Matches[1])).AbsolutePath
      }
      $path = Resolve-RequestPath $urlPath

      if ($path -and (Test-Path -LiteralPath $path -PathType Leaf)) {
        $body = [IO.File]::ReadAllBytes($path)
        $extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
        $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
        $status = "200 OK"
      } else {
        $body = [Text.Encoding]::UTF8.GetBytes("404 - Not found")
        $contentType = "text/plain; charset=utf-8"
        $status = "404 Not Found"
      }

      $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $stream.Flush()
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
