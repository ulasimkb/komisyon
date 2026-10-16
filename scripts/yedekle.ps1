# Supabase veritabanının tam yedeğini alır: tüm tablolar (yapı + veriler) ve kullanıcı hesapları.
# Kullanım: npm run yedekle   (veya: powershell -ExecutionPolicy Bypass -File scripts\yedekle.ps1)
# Gereken: PostgreSQL 15 veya üstü komut satırı araçları (pg_dump).
# Parola her çalıştırmada sorulur; hiçbir dosyaya yazılmaz.
param(
  [string]$PoolerHost = 'aws-0-eu-central-1.pooler.supabase.com',
  [string]$ProjectRef = 'kotdnztdioyozldwygah'
)
$ErrorActionPreference = 'Stop'

$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
  $found = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
  if ($found) { $pgDump = $found.FullName }
}
if (-not $pgDump) {
  Write-Host 'pg_dump bulunamadı. PostgreSQL komut satırı araçlarını kurun: winget install PostgreSQL.PostgreSQL.17' -ForegroundColor Red
  exit 1
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
$dir = Join-Path (Split-Path $PSScriptRoot -Parent) "yedekler\$stamp"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$secure = Read-Host 'Supabase veritabanı parolası (Project Settings > Database)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$env:PGSSLMODE = 'require'

$connection = @('--host', $PoolerHost, '--port', '5432', '--username', "postgres.$ProjectRef", '--dbname', 'postgres', '--no-owner')

function Invoke-Dump([string]$description, [string[]]$arguments) {
  Write-Host "- $description..."
  & $pgDump @connection @arguments
  if ($LASTEXITCODE -ne 0) { throw "$description alınamadı (pg_dump çıkış kodu $LASTEXITCODE)." }
}

try {
  # Geri yükleme için asıl dosya: pg_restore ile tek komutta yapı + veriler.
  Invoke-Dump 'Tam yedek (yapı + veriler)' @('--schema=public', '--format=custom', '--file', (Join-Path $dir 'komisyon-public.dump'))
  # Aynı içeriğin okunabilir SQL kopyası.
  Invoke-Dump 'Okunabilir SQL kopyası' @('--schema=public', '--file', (Join-Path $dir 'komisyon-public.sql'))
  # Giriş hesapları (parola özetleri dahil): güvenli yerde saklayın.
  Invoke-Dump 'Kullanıcı hesapları' @('--data-only', '--table=auth.users', '--table=auth.identities', '--file', (Join-Path $dir 'auth-kullanicilar.sql'))

  $files = Get-ChildItem $dir | ForEach-Object { '{0,-24} {1,10:N0} bayt' -f $_.Name, $_.Length }
  Write-Host "`nYedek tamamlandı: $dir" -ForegroundColor Green
  $files | ForEach-Object { Write-Host "  $_" }
  Write-Host 'Bu klasörü bilgisayar dışında da saklayın (harici disk, kurum sunucusu vb.).'
} catch {
  Write-Host "`nYedek başarısız: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Bağlantı adresi farklıysa Supabase panelinde Connect > Session pooler bölümündeki sunucuyu -PoolerHost ile verin."
  Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
  exit 1
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
