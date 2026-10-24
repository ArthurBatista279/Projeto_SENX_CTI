param([string]$BackupPath)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot
$config=Get-Content -LiteralPath (Join-Path $project 'BackEnd\SenxCti.Api\appsettings.Local.json') -Raw | ConvertFrom-Json
$value=if($env:SENX_DB_CONNECTION){$env:SENX_DB_CONNECTION}else{$config.SENX_DB_CONNECTION}
$settings=[System.Data.Common.DbConnectionStringBuilder]::new()
$settings.set_ConnectionString($value)
$pg='C:\Program Files\PostgreSQL\18\bin'
if(-not $BackupPath){$BackupPath=Join-Path $PSScriptRoot ('backups\senx-antes-0.1.4-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump')}
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
  & "$pg\psql.exe" @arguments -X -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'migrations\0.1.4-acesso.sql')
  if($LASTEXITCODE -ne 0){throw 'Migração falhou; confira o erro. O backup foi preservado.'}
  Write-Output "Migração 0.1.4 aplicada. Backup: $BackupPath"
} finally {$env:PGPASSWORD=$priorPassword}
