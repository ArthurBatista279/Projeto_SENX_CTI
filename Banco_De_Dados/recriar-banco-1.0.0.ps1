param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z][a-zA-Z0-9_]{0,62}$')][string]$Database,
  [switch]$Reset,
  [string]$ConfirmReset,
  [Security.SecureString]$AdminPassword,
  [string]$PostgresBin='C:\Program Files\PostgreSQL\18\bin'
)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot
if($Database -in @('postgres','template0','template1')){throw 'Banco de sistema nao e um destino permitido.'}
if($Reset -and $ConfirmReset -cne $Database){throw 'Para apagar os dados SENX, informe -Reset -ConfirmReset NOME_EXATO_DO_BANCO.'}
$value=$env:SENX_DB_CONNECTION
if(-not $value){
  $private=Join-Path $project 'BackEnd\SenxCti.Api\appsettings.Local.json'
  if(Test-Path -LiteralPath $private){$value=(Get-Content -LiteralPath $private -Raw|ConvertFrom-Json).SENX_DB_CONNECTION}
}
if(-not $value){throw 'Configure SENX_DB_CONNECTION. A conexao nunca e impressa.'}
$settings=[System.Data.Common.DbConnectionStringBuilder]::new()
$settings.set_ConnectionString($value)
if(-not $AdminPassword){$AdminPassword=Read-Host 'Senha inicial de admin@senx.com (12+ caracteres, ate 72 bytes UTF-8)' -AsSecureString}
$bcrypt=Join-Path $project 'BackEnd\SenxCti.Api\bin\Debug\net10.0\BCrypt-Net-Next.dll'
if(-not(Test-Path -LiteralPath $bcrypt)){throw 'Compile primeiro: dotnet build BackEnd/Projeto.SENX.CTI.slnx'}
Add-Type -Path $bcrypt
$credential=[PSCredential]::new('admin',$AdminPassword)
$plain=$credential.GetNetworkCredential().Password
if($plain.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($plain) -gt 72){throw 'Senha invalida: minimo 12 caracteres, maximo 72 bytes UTF-8.'}
$seedHash=[BCrypt.Net.BCrypt]::HashPassword($plain,12)
$plain=$null
$credential=$null
$tools=@('psql.exe','pg_dump.exe','pg_restore.exe')
foreach($tool in $tools){if(-not(Test-Path -LiteralPath (Join-Path $PostgresBin $tool))){throw "Ferramenta PostgreSQL ausente: $tool"}}
$priorPassword=$env:PGPASSWORD
$priorHash=$env:SENX_ADMIN_HASH
$names=@('Alerta','Analise','Assunto','ClienteUsuario','Criterio','DadosCliente','Equipe','Ligacao','LigacaoAssunto','Registro','Resultado','Usuario','__EFMigrationsHistory','RevisaoHumana','Relatorio')
try {
  $env:PGPASSWORD=if($settings.ContainsKey('Password')){[string]$settings.get_Item('Password')}else{''}
  $env:SENX_ADMIN_HASH=$seedHash
  $port=if($settings.ContainsKey('Port')){[string]$settings.get_Item('Port')}else{''}
  if(-not $port){$port='5432'}
  $arguments=@('-h',[string]$settings.get_Item('Host'),'-p',$port,'-U',[string]$settings.get_Item('Username'),'-d',$Database,'-w')
  $query="SELECT count(*) FROM pg_tables WHERE schemaname='public';"
  $count=& "$PostgresBin\psql.exe" @arguments -X -A -t -v ON_ERROR_STOP=1 -c $query
  if($LASTEXITCODE -ne 0){throw 'Destino indisponivel. Crie previamente um banco vazio com seu administrador PostgreSQL.'}
  if([int]$count -gt 0 -and -not $Reset){throw 'Banco nao esta vazio. Nada alterado; reset exige -Reset -ConfirmReset NOME_EXATO_DO_BANCO.'}
  $quotedNames=($names|ForEach-Object{"'$_'"}) -join ','
  $other=& "$PostgresBin\psql.exe" @arguments -X -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ($quotedNames);"
  if($LASTEXITCODE -ne 0 -or [int]$other -gt 0){throw 'Destino possui outras tabelas. Recriacao recusada para preservar dados fora da SENX.'}
  if($Reset){
    $backup=Join-Path $PSScriptRoot ('backups\senx-antes-1.0.0-'+$Database+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump')
    if(Test-Path -LiteralPath $backup){throw 'Backup ja existe; tente novamente em outro instante.'}
    New-Item -ItemType Directory -Path (Split-Path $backup) -Force|Out-Null
    & "$PostgresBin\pg_dump.exe" @arguments -Fc -f $backup
    if($LASTEXITCODE -ne 0){throw 'Backup falhou. Nenhuma tabela removida.'}
    & "$PostgresBin\pg_restore.exe" -l $backup|Out-Null
    if($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $backup).Length -eq 0){throw 'Backup invalido. Nenhuma tabela removida.'}
    $tables=($names|ForEach-Object{'public."'+$_+'"'}) -join ','
    # Uma transacao cobre remocao, DDL e seed; qualquer falha restaura o estado anterior.
    & "$PostgresBin\psql.exe" @arguments -X --single-transaction -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS $tables;" -f (Join-Path $PSScriptRoot 'senx-1.0.0-limpo.sql')
  } else {
    & "$PostgresBin\psql.exe" @arguments -X --single-transaction -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'senx-1.0.0-limpo.sql')
  }
  if($LASTEXITCODE -ne 0){throw 'Recriacao falhou; transacao revertida. Backup preservado, se solicitado.'}
  $verify='SELECT count(*)=1 AND bool_and("Perfil"=''Administrador'' AND "Ativo" AND "Senha" LIKE ''$2%'') FROM public."Usuario"; SELECT count(*)=1 FROM public."Equipe"; SELECT count(*)=1 FROM public."DadosCliente"; SELECT count(*)=3 FROM public."Criterio";'
  $checks=& "$PostgresBin\psql.exe" @arguments -X -A -t -v ON_ERROR_STOP=1 -c $verify
  if($LASTEXITCODE -ne 0 -or @($checks|Where-Object{$_ -ne 't'}).Count -gt 0){throw 'Schema aplicado, mas a verificacao do seed falhou. Inspecione o banco.'}
  Write-Output "Schema 1.0.0.0 e seed verificados em $Database. Login: admin@senx.com; senha definida nesta execucao."
  if($Reset){Write-Output "Backup anterior preservado em $backup"}
} finally {
  $env:PGPASSWORD=$priorPassword
  $env:SENX_ADMIN_HASH=$priorHash
  $seedHash=$null
}

