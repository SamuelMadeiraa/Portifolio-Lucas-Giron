# Baixa as thumbnails dos projetos do Vimeo para assets/thumbs/{id}.jpg
# Uso (PowerShell, dentro da pasta do projeto):  .\baixar-thumbs.ps1
# Sem as thumbs locais o site continua funcionando — ele puxa direto do CDN do Vimeo.

$ids = @(
  '764150238','584999486','567049229','468518303','581918148','847440801','855040781',
  '952132088','639502539','924797684','412315243','924449405','535655695','567038935',
  '492201849','458179585','458174695','446616864','417766810','404624564','535644122'
)

$dest = Join-Path $PSScriptRoot 'assets\thumbs'
New-Item -ItemType Directory -Force $dest | Out-Null

foreach ($id in $ids) {
  try {
    $meta = Invoke-RestMethod "https://vimeo.com/api/oembed.json?url=https://vimeo.com/$id&width=1280"
    $url  = $meta.thumbnail_url -replace '_\d+x\d+', '_1280x720' -replace '\?.*$', ''
    Invoke-WebRequest $url -OutFile (Join-Path $dest "$id.jpg")
    Write-Host "ok   $id  $($meta.title)"
  } catch {
    Write-Warning "falhou $id — $($_.Exception.Message)"
  }
}
