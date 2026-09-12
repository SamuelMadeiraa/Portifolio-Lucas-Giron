<#
  Servidor local de desenvolvimento.
  Serve o site e imita a API da Vercel (/api/*) para testar o painel
  sem Node e sem nuvem. Os dados locais ficam em .dev-data/ (fora do deploy).

  Uso:   powershell -ExecutionPolicy Bypass -File tools/dev-server.ps1
  Site:  http://localhost:5500/        Painel: http://localhost:5500/admin/
  Senha local do painel: "admin" (ou o valor da variável ADMIN_PASSWORD).
#>
param(
  [int]$Port = 5500,
  [string]$Password = $(if ($env:ADMIN_PASSWORD) { $env:ADMIN_PASSWORD } else { 'admin' })
)

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Data = Join-Path $Root '.dev-data'
New-Item -ItemType Directory -Force -Path (Join-Path $Data 'uploads'), (Join-Path $Data 'versions') | Out-Null

$Cfg = @{
  Root     = $Root
  Uploads  = Join-Path $Data 'uploads'
  Versions = Join-Path $Data 'versions'
  Content  = Join-Path $Data 'content.json'
  Auth     = Join-Path $Data 'auth.json'
  Password = $Password
  Session  = [guid]::NewGuid().ToString('N')   # sessão vale enquanto o servidor estiver rodando
}

# Cada requisição roda em paralelo (um vídeo carregando não trava o resto)
$Handler = {
  param($ctx, $Cfg)

  $Utf8  = New-Object System.Text.UTF8Encoding $false
  $Types = @{
    '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8'
    '.json'='application/json; charset=utf-8'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'
    '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.png'='image/png'; '.webp'='image/webp'; '.gif'='image/gif'; '.avif'='image/avif'
    '.mp4'='video/mp4'; '.m4v'='video/mp4'; '.webm'='video/webm'; '.mov'='video/quicktime'
  }

  function Send-Bytes([int]$status, [byte[]]$bytes, [string]$type, $headers) {
    $res = $ctx.Response
    $res.StatusCode = $status
    $res.ContentType = $type
    if ($headers) { foreach ($k in $headers.Keys) { $res.AddHeader($k, $headers[$k]) } }
    $res.ContentLength64 = $bytes.Length
    if ($bytes.Length) { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
  }
  function Send-Json([int]$status, $obj, $headers) {
    if (-not $headers) { $headers = @{} }
    $headers['Cache-Control'] = 'no-store'
    Send-Bytes $status $Utf8.GetBytes((ConvertTo-Json -InputObject $obj -Depth 10 -Compress)) 'application/json; charset=utf-8' $headers
  }
  function Read-Text {
    $sr = New-Object IO.StreamReader($ctx.Request.InputStream, $Utf8)
    try { $sr.ReadToEnd() } finally { $sr.Dispose() }
  }
  function Read-Json { try { Read-Text | ConvertFrom-Json } catch { $null } }
  function Hash-Pw([string]$pw) {
    $sha = [Security.Cryptography.SHA256]::Create()
    ([BitConverter]::ToString($sha.ComputeHash($Utf8.GetBytes("giron:$pw"))) -replace '-', '').ToLower()
  }
  function Current-Hash {
    if (Test-Path $Cfg.Auth) { (Get-Content $Cfg.Auth -Raw -Encoding UTF8 | ConvertFrom-Json).hash }
    else { Hash-Pw $Cfg.Password }
  }
  function File-Info($f, $urlBase, $pathBase) {
    [ordered]@{ url = "$urlBase/$($f.Name)"; pathname = "$pathBase/$($f.Name)"; size = $f.Length; uploadedAt = $f.LastWriteTimeUtc.ToString('o') }
  }

  function Serve-Static([string]$rel) {
    $segs = @($rel -split '/' | Where-Object { $_ })
    # nada de arquivos ocultos (.env, .vercel...) — exceto os dados locais
    if (@($segs | Where-Object { $_.StartsWith('.') -and $_ -ne '.dev-data' }).Count) { return Send-Json 404 @{ error = 'not found' } }
    $file = [IO.Path]::GetFullPath((Join-Path $Cfg.Root ($segs -join '\')))
    if (-not $file.StartsWith($Cfg.Root)) { return Send-Json 404 @{ error = 'not found' } }
    if (Test-Path $file -PathType Container) {
      $idx = Join-Path $file 'index.html'
      # na Vercel a home é montada pela função /api/page a partir de page.html
      if (-not (Test-Path $idx -PathType Leaf)) { $idx = Join-Path $file 'page.html' }
      $file = $idx
    }
    if (-not (Test-Path $file -PathType Leaf)) { return Send-Json 404 @{ error = 'not found' } }

    $type = $Types[[IO.Path]::GetExtension($file).ToLower()]
    if (-not $type) { $type = 'application/octet-stream' }
    $res = $ctx.Response
    $fs = [IO.File]::Open($file, 'Open', 'Read', 'ReadWrite')
    try {
      $len = $fs.Length; $start = 0; $end = $len - 1; $status = 200
      $range = $ctx.Request.Headers['Range']
      if ($range -match '^bytes=(\d*)-(\d*)$') {
        if ($Matches[1]) {
          $start = [long]$Matches[1]
          if ($Matches[2]) { $end = [Math]::Min([long]$Matches[2], $len - 1) }
        } elseif ($Matches[2]) {
          $start = [Math]::Max(0, $len - [long]$Matches[2])
        }
        if ($start -ge $len) {
          $res.AddHeader('Content-Range', "bytes */$len")
          return Send-Bytes 416 ([byte[]]@()) 'text/plain' $null
        }
        $status = 206
        $res.AddHeader('Content-Range', "bytes $start-$end/$len")
      }
      $res.StatusCode = $status
      $res.ContentType = $type
      $res.AddHeader('Accept-Ranges', 'bytes')
      $res.AddHeader('Cache-Control', 'no-store')   # sempre a versão mais nova durante o desenvolvimento
      $count = $end - $start + 1
      $res.ContentLength64 = $count
      [void]$fs.Seek($start, 'Begin')
      $buf = New-Object byte[] 65536
      while ($count -gt 0) {
        $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $count))
        if ($n -le 0) { break }
        $res.OutputStream.Write($buf, 0, $n)
        $count -= $n
      }
    } finally { $fs.Dispose() }
  }

  # recria as pastas caso .dev-data tenha sido apagada com o servidor rodando
  if (-not (Test-Path $Cfg.Uploads))  { New-Item -ItemType Directory -Force -Path $Cfg.Uploads  | Out-Null }
  if (-not (Test-Path $Cfg.Versions)) { New-Item -ItemType Directory -Force -Path $Cfg.Versions | Out-Null }

  $method = $ctx.Request.HttpMethod
  $path   = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  $route  = "$method $path"
  $c      = $ctx.Request.Cookies['giron_session']
  $authed = [bool]($c -and $c.Value -eq $Cfg.Session)

  try {
    if ($route -eq 'GET /api/me') {
      $upd = $null
      if (Test-Path $Cfg.Auth) { $upd = (Get-Content $Cfg.Auth -Raw -Encoding UTF8 | ConvertFrom-Json).updatedAt }
      Send-Json 200 @{ authed = $authed; storage = 'local'; configured = @{ password = $true; blob = $true }; passwordUpdatedAt = $upd }
    }
    elseif ($route -eq 'POST /api/login') {
      $b = Read-Json
      if ($b -and (Hash-Pw "$($b.password)") -eq (Current-Hash)) {
        Send-Json 200 @{ ok = $true } @{ 'Set-Cookie' = "giron_session=$($Cfg.Session); Path=/; HttpOnly; SameSite=Strict" }
      } else {
        Start-Sleep -Milliseconds 600
        Send-Json 401 @{ error = 'Senha incorreta.' }
      }
    }
    elseif ($route -eq 'DELETE /api/login') {
      Send-Json 200 @{ ok = $true } @{ 'Set-Cookie' = 'giron_session=; Path=/; Max-Age=0' }
    }
    elseif ($route -eq 'GET /api/content') {
      if (Test-Path $Cfg.Content) { Send-Bytes 200 ([IO.File]::ReadAllBytes($Cfg.Content)) 'application/json; charset=utf-8' @{ 'Cache-Control' = 'no-store' } }
      else { Send-Json 404 @{ error = 'empty' } }
    }
    elseif ($path.StartsWith('/api/') -and -not $authed) {
      Send-Json 401 @{ error = 'Não autorizado' }
    }
    elseif ($route -eq 'PUT /api/content') {
      $text = (Read-Text).Trim()
      $obj = $null
      try { $obj = $text | ConvertFrom-Json } catch {}
      # não deixa publicar por cima de uma versão mais nova (outra aba / outro aparelho)
      $base = $ctx.Request.Headers['X-Base-Saved-At']
      $cur = ''
      if (Test-Path $Cfg.Content) {
        $m = [regex]::Matches([IO.File]::ReadAllText($Cfg.Content, $Utf8), '"savedAt":"([^"]*)"')
        if ($m.Count) { $cur = $m[$m.Count - 1].Groups[1].Value }
      }
      if (-not $obj -or $null -eq $obj.projects -or -not $text.EndsWith('}')) {
        Send-Json 400 @{ error = 'JSON inválido.' }
      } elseif ($null -ne $base -and $cur -and $base -ne $cur) {
        Send-Json 409 @{ error = 'conflict'; savedAt = $cur }
      } else {
        $saved = (Get-Date).ToUniversalTime().ToString('o')
        # a última chave vence no JSON.parse → savedAt novo sobrepõe o antigo
        $text = $text.Substring(0, $text.Length - 1) + ',"savedAt":"' + $saved + '"}'
        [IO.File]::WriteAllText($Cfg.Content, $text, $Utf8)
        [IO.File]::WriteAllText((Join-Path $Cfg.Versions (($saved -replace '[:.]', '-') + '.json')), $text, $Utf8)
        Get-ChildItem $Cfg.Versions -Filter *.json | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force
        Send-Json 200 @{ ok = $true; savedAt = $saved }
      }
    }
    elseif ($route -eq 'GET /api/versions') {
      $list = @(Get-ChildItem $Cfg.Versions -Filter *.json | Sort-Object LastWriteTime -Descending | ForEach-Object { File-Info $_ '/.dev-data/versions' 'site/versions' })
      Send-Json 200 @{ versions = $list }
    }
    elseif ($route -eq 'GET /api/media') {
      $list = @(Get-ChildItem $Cfg.Uploads -File | ForEach-Object { File-Info $_ '/.dev-data/uploads' 'media' })
      Send-Json 200 @{ files = $list }
    }
    elseif ($route -eq 'DELETE /api/media') {
      $b = Read-Json; $n = 0
      foreach ($u in @($b.urls)) {
        if ("$u" -like '/.dev-data/uploads/*') {
          $f = Join-Path $Cfg.Uploads (Split-Path "$u" -Leaf)
          if (Test-Path $f -PathType Leaf) { Remove-Item $f -Force; $n++ }
        }
      }
      Send-Json 200 @{ ok = $true; deleted = $n }
    }
    elseif ($route -eq 'POST /api/password') {
      $b = Read-Json
      $cur = "$($b.current)"; $next = "$($b.next)"
      if ((Hash-Pw $cur) -ne (Current-Hash)) {
        Start-Sleep -Milliseconds 600
        Send-Json 403 @{ error = 'A senha atual está errada.' }
      } elseif ($next.Length -lt 8) {
        Send-Json 400 @{ error = 'A nova senha precisa de pelo menos 8 caracteres.' }
      } elseif ($next -eq $cur) {
        Send-Json 400 @{ error = 'A nova senha é igual à atual.' }
      } else {
        $upd = (Get-Date).ToUniversalTime().ToString('o')
        [IO.File]::WriteAllText($Cfg.Auth, (ConvertTo-Json -InputObject ([ordered]@{ hash = (Hash-Pw $next); updatedAt = $upd }) -Compress), $Utf8)
        Send-Json 200 @{ ok = $true; updatedAt = $upd }
      }
    }
    elseif ($route -eq 'PUT /api/dev-upload') {
      $name = [IO.Path]::GetFileName("$($ctx.Request.QueryString['name'])")
      $base = [IO.Path]::GetFileNameWithoutExtension($name) -replace '[^a-zA-Z0-9_-]', '-'
      $ext  = [IO.Path]::GetExtension($name).ToLower() -replace '[^a-z0-9.]', ''
      if (-not $base) { $base = 'arquivo' }
      $leaf = "$base-$([guid]::NewGuid().ToString('N').Substring(0, 8))$ext"
      $fs = [IO.File]::Create((Join-Path $Cfg.Uploads $leaf))
      try { $ctx.Request.InputStream.CopyTo($fs) } finally { $fs.Dispose() }
      Send-Json 200 @{ url = "/.dev-data/uploads/$leaf"; pathname = "media/$leaf" }
    }
    elseif ($path.StartsWith('/api/')) {
      Send-Json 404 @{ error = "Rota $route não existe no servidor local." }
    }
    elseif ($method -eq 'GET') {
      Serve-Static $path
    }
    else {
      Send-Json 405 @{ error = 'Método não suportado.' }
    }
  } catch {
    [Console]::WriteLine("ERRO $route : $($_.Exception.Message)")
    try { $ctx.Response.StatusCode = 500 } catch {}
  } finally {
    try { $ctx.Response.Close() } catch {}
  }
  [Console]::WriteLine("$route -> $($ctx.Response.StatusCode)")
}

$pool = [RunspaceFactory]::CreateRunspacePool(1, 12)
$pool.Open()
$jobs = New-Object System.Collections.ArrayList

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
[Console]::WriteLine("Site:   http://localhost:$Port/")
[Console]::WriteLine("Painel: http://localhost:$Port/admin/   (senha: $Password)")

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $ps = [PowerShell]::Create()
  $ps.RunspacePool = $pool
  [void]$ps.AddScript($Handler).AddArgument($ctx).AddArgument($Cfg)
  [void]$jobs.Add(@{ ps = $ps; h = $ps.BeginInvoke() })
  foreach ($j in @($jobs)) {
    if ($j.h.IsCompleted) {
      try { [void]$j.ps.EndInvoke($j.h) } catch {}
      $j.ps.Dispose()
      $jobs.Remove($j)
    }
  }
}
