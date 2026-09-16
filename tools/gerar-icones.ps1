<#
  Gera os ícones do site e a imagem de compartilhamento.
  Rode de novo se a marca mudar:
    powershell -ExecutionPolicy Bypass -File tools/gerar-icones.ps1

  Cria na raiz do site:
    favicon.ico (16/32/48), apple-touch-icon.png (180),
    icon-192.png, icon-512.png, icon-maskable-512.png
  e em assets/og/:
    lucas-giron.jpg (1200 × 630, para Google, WhatsApp, redes)
#>
param(
  [string]$Root   = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$Accent = '#B6FF00',
  [string]$OnAccent = '#0A0A0A',
  [string]$Ink    = '#080A08',
  [string]$Paper  = '#EEF3EA',
  [string]$Name1  = 'LUCAS',
  [string]$Name2  = 'GIRON',
  [string]$Role   = 'MOTION DESIGNER  ·  ANIMADOR GRÁFICO',
  [string]$Place  = 'FLORIANÓPOLIS — SC',
  [string]$Domain = 'LUCASGIRON.COM.BR'
)
Add-Type -AssemblyName System.Drawing

$accentC = [System.Drawing.ColorTranslator]::FromHtml($Accent)
$inkC    = [System.Drawing.ColorTranslator]::FromHtml($Ink)
$paperC  = [System.Drawing.ColorTranslator]::FromHtml($Paper)
$onC     = [System.Drawing.ColorTranslator]::FromHtml($OnAccent)

function Get-Font([float]$px, [string[]]$names) {
  foreach ($n in $names) {
    $f = New-Object System.Drawing.Font($n, $px, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    if ($f.Name -eq $n) { return $f }
    $f.Dispose()
  }
  New-Object System.Drawing.Font('Arial', $px, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
}
$HEAVY = @('Arial Black', 'Segoe UI Black', 'Impact')
$MONO  = @('Consolas', 'Lucida Console', 'Courier New')

function New-Surface([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  return $bmp, $g
}

# texto como contorno vetorial: centraliza pela caixa real das letras
function Add-TextPath($path, [string]$text, [string[]]$fonts, [float]$px) {
  $f = Get-Font $px $fonts
  $path.AddString($text, $f.FontFamily, [int]$f.Style, $px, (New-Object System.Drawing.PointF(0, 0)), [System.Drawing.StringFormat]::GenericTypographic)
  $f.Dispose()
}

function Get-Png([int]$size, [double]$pad) {
  # quadrado na cor de destaque com "LG" — o mesmo logo do menu
  $bmp, $g = New-Surface $size $size
  $g.Clear([System.Drawing.Color]::Transparent)
  $inset = [int][math]::Round($size * $pad)
  $box = $size - 2 * $inset
  $g.FillRectangle((New-Object System.Drawing.SolidBrush($accentC)), $inset, $inset, $box, $box)

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-TextPath $path 'LG' $HEAVY ([float]($box * 0.62))
  $b = $path.GetBounds()
  $scale = [math]::Min(($box * 0.70) / $b.Width, ($box * 0.52) / $b.Height)
  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate($size / 2, $size / 2)
  $m.Scale($scale, $scale)
  $m.Translate(-($b.X + $b.Width / 2), -($b.Y + $b.Height / 2))
  $path.Transform($m)
  $g.FillPath((New-Object System.Drawing.SolidBrush($onC)), $path)
  $g.Dispose()

  $ms = New-Object IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return , $ms.ToArray()
}

function Save-Ico([object[]]$entries, [string]$file) {
  # ICO com PNG embutido (aceito por todos os navegadores atuais)
  $ms = New-Object IO.MemoryStream
  $w = New-Object IO.BinaryWriter($ms)
  $w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$entries.Count)
  $offset = 6 + 16 * $entries.Count
  foreach ($e in $entries) {
    $dim = if ($e.Size -ge 256) { 0 } else { $e.Size }
    $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
    $w.Write([UInt16]1); $w.Write([UInt16]32)
    $w.Write([UInt32]$e.Bytes.Length); $w.Write([UInt32]$offset)
    $offset += $e.Bytes.Length
  }
  foreach ($e in $entries) { $w.Write($e.Bytes) }
  $w.Flush()
  [IO.File]::WriteAllBytes($file, $ms.ToArray())
}

# ── ícones ────────────────────────────────────────────
$ico = foreach ($s in 16, 32, 48) { [pscustomobject]@{ Size = $s; Bytes = (Get-Png $s 0) } }
Save-Ico $ico (Join-Path $Root 'favicon.ico')
[IO.File]::WriteAllBytes((Join-Path $Root 'apple-touch-icon.png'), (Get-Png 180 0))
[IO.File]::WriteAllBytes((Join-Path $Root 'icon-192.png'), (Get-Png 192 0))
[IO.File]::WriteAllBytes((Join-Path $Root 'icon-512.png'), (Get-Png 512 0))
# "maskable": margem de segurança para Android recortar em círculo
[IO.File]::WriteAllBytes((Join-Path $Root 'icon-maskable-512.png'), (Get-Png 512 0.12))

# ── imagem de compartilhamento 1200 × 630 ─────────────
$W = 1200; $H = 630; $L = 84
$bmp, $g = New-Surface $W $H
$g.Clear($inkC)

# brilho na cor de destaque, embaixo à direita
$glow = New-Object System.Drawing.Drawing2D.GraphicsPath
$glow.AddEllipse(560, 250, 900, 700)
$pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($glow)
$pgb.CenterColor = [System.Drawing.Color]::FromArgb(120, $accentC)
$pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $accentC))
$g.FillPath($pgb, $glow)

# linhas de TV
$scan = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 0, 0, 0), 1)
for ($y = 0; $y -lt $H; $y += 3) { $g.DrawLine($scan, 0, $y, $W, $y) }

# topo: logo + domínio
$g.FillRectangle((New-Object System.Drawing.SolidBrush($accentC)), $L, 62, 54, 54)
$mark = New-Object System.Drawing.Drawing2D.GraphicsPath
Add-TextPath $mark 'LG' $HEAVY 30
$mb = $mark.GetBounds()
$mm = New-Object System.Drawing.Drawing2D.Matrix
$mm.Translate($L + 27 - ($mb.X + $mb.Width / 2), 89 - ($mb.Y + $mb.Height / 2))
$mark.Transform($mm)
$g.FillPath((New-Object System.Drawing.SolidBrush($onC)), $mark)
$monoF = Get-Font 22 $MONO
$dim = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, $paperC))
$g.DrawString($Domain, $monoF, $dim, $L + 76, 75)

# nome: linha 1 cheia, linha 2 vazada (como no site)
function Get-Line([string]$text, [float]$px, [float]$x, [float]$top) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-TextPath $p $text $HEAVY $px
  $b = $p.GetBounds()
  $t = New-Object System.Drawing.Drawing2D.Matrix
  $t.Translate($x - $b.X, $top - $b.Y)
  $p.Transform($t)
  return $p
}
$line1 = Get-Line $Name1 176 $L 168
$line2 = Get-Line $Name2 176 $L 330
$g.FillPath((New-Object System.Drawing.SolidBrush($paperC)), $line1)
$outline = New-Object System.Drawing.Pen($paperC, 3)
$outline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawPath($outline, $line2)

# rodapé: profissão, cidade e barra de destaque
$roleF = Get-Font 26 $MONO
$g.DrawString($Role, $roleF, (New-Object System.Drawing.SolidBrush($accentC)), $L, 520)
$g.DrawString($Place, $monoF, $dim, $L, 560)
$g.FillRectangle((New-Object System.Drawing.SolidBrush($accentC)), 0, $H - 8, $W, 8)
$g.Dispose()

$ogDir = Join-Path $Root 'assets\og'
New-Item -ItemType Directory -Force -Path $ogDir | Out-Null
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
$bmp.Save((Join-Path $ogDir 'lucas-giron.jpg'), $enc, $ep)
$bmp.Dispose()

Get-ChildItem (Join-Path $Root 'favicon.ico'), (Join-Path $Root '*.png'), (Join-Path $ogDir '*.jpg') |
  ForEach-Object { '{0,-24} {1,8:N0} bytes' -f $_.Name, $_.Length }
