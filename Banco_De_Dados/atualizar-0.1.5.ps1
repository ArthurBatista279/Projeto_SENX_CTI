param([string]$BackupPath, [string]$PostgresBin='C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot
$value=$env:SENX_DB_CONNECTION
if(-not $value){
  $configPath=Join-Path $project 'BackEnd\SenxCti.Api\appsettings.Local.json'
  if(-not (Test-Path -LiteralPath $configPath)){throw 'Configure SENX_DB_CONNECTION no ambiente ou no arquivo privado da API.'}
  $config=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  $value=$config.SENX_DB_CONNECTION
}
if(-not $value){throw 'Configuração de conexão ausente.'}
$settings=[System.Data.Common.DbConnectionStringBuilder]::new()
$settings.set_ConnectionString($value)
$pg=$PostgresBin
if(-not $BackupPath){$BackupPath=Join-Path $PSScriptRoot ('backups\senx-antes-0.1.5-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump')}
if(Test-Path -LiteralPath $BackupPath){throw 'O backup já existe; escolha um novo caminho.'}
New-Item -ItemType Directory -Path (Split-Path ([IO.Path]::GetFullPath($BackupPath))) -Force | Out-Null
$priorPassword=$env:PGPASSWORD
try {
  $env:PGPASSWORD=[string]$settings.get_Item('Password')
  $arguments=@('-h',[string]$settings.get_Item('Host'),'-p',[string]$settings.get_Item('Port'),'-U',[string]$settings.get_Item('Username'),'-d',[string]$settings.get_Item('Database'),'-w')
  & "$pg\pg_dump.exe" @arguments -Fc -f $BackupPath
  if($LASTEXITCODE -ne 0){throw 'Backup falhou; migração cancelada.'}
  & "$pg\pg_restore.exe" -l $BackupPath | Out-Null
  if($LASTEXITCODE -ne 0){throw 'O arquivo de backup não pôde ser lido; migração cancelada.'}
  & "$pg\psql.exe" @arguments -X -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'migrations\0.1.5-entrega.sql')
  if($LASTEXITCODE -ne 0){throw 'Migração falhou; confira o erro. O backup foi preservado.'}
  Write-Output "Migração 0.1.5 aplicada. Backup: $BackupPath"
} finally {$env:PGPASSWORD=$priorPassword}
