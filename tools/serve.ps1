# Tiny static server for local testing (PowerShell 7): pwsh -NoProfile -File tools/serve.ps1 -Root . -Port 8791
param([string]$Root, [int]$Port = 8791)
$types = @{ '.html'='text/html'; '.js'='text/javascript'; '.css'='text/css'; '.json'='application/json'; '.png'='image/png'; '.svg'='image/svg+xml'; '.md'='text/plain' }
$l = [System.Net.HttpListener]::new()
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
while ($l.IsListening) {
  try {
    $c = $l.GetContext()
    $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if ($p -eq '' -or $p.EndsWith('/')) { $p += 'index.html' }
    $f = Join-Path $Root $p
    $c.Response.Headers.Add('Cache-Control', 'no-store')
    if (Test-Path $f -PathType Leaf) {
      $b = [IO.File]::ReadAllBytes($f)
      $ext = [IO.Path]::GetExtension($f)
      $c.Response.ContentType = $types[$ext] ?? 'application/octet-stream'
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    } else { $c.Response.StatusCode = 404 }
    $c.Response.Close()
  } catch { }
}
