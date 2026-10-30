param([switch]$Verificar)
$ErrorActionPreference='Stop'
$project=$PSScriptRoot
$configPath=Join-Path $project 'BackEnd\SenxCti.Api\appsettings.Local.json'
$oldPassword=$env:PGPASSWORD
$oldEnvironment=$env:ASPNETCORE_ENVIRONMENT
$oldConnection=$env:SENX_DB_CONNECTION
function Read-Default([string]$Label,[string]$Default){
  $answer=Read-Host "$Label [$Default]"
  if([string]::IsNullOrWhiteSpace($answer)){return $Default}
  return $answer.Trim()
}
function Read-Secret([string]$Label){
  $secure=Read-Host $Label -AsSecureString
  $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)}
  finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer);$secure.Dispose()}
}
function Sql([string]$Database,[string]$User,[string]$Query){
  $output=& $psql -h $server -p $port -U $User -d $Database -w -X -A -t -v ON_ERROR_STOP=1 -c $Query
  if($LASTEXITCODE -ne 0){throw 'Falha no PostgreSQL. Nenhuma etapa seguinte foi executada.'}
  return ($output -join "`n").Trim()
}
function Check-Tools {
  if(-not(Get-Command dotnet -ErrorAction SilentlyContinue)){throw 'Instale o .NET 10 SDK: https://dotnet.microsoft.com/download/dotnet/10.0 . Depois abra o instalador novamente.'}
  $sdks=& dotnet --list-sdks
  if(-not($sdks -match '^10\.0\.\d+ ')){throw 'Instale um .NET 10 SDK estavel. Somente o Runtime nao e suficiente.'}
  $script:pgBin=$null
  $candidate=Join-Path $env:ProgramFiles 'PostgreSQL\18\bin'
  if(Test-Path (Join-Path $candidate 'psql.exe')){$script:pgBin=$candidate}
  if(-not $script:pgBin){
    $command=Get-Command psql.exe -ErrorAction SilentlyContinue
    if($command){$script:pgBin=Split-Path $command.Source}
  }
  if(-not $script:pgBin){throw 'Instale PostgreSQL 18 com Command Line Tools: https://www.postgresql.org/download/windows/ .'}
  foreach($tool in @('psql.exe','pg_dump.exe','pg_restore.exe')){
    if(-not(Test-Path (Join-Path $script:pgBin $tool))){throw "Ferramenta ausente: $tool"}
  }
  $script:psql=Join-Path $script:pgBin 'psql.exe'
  $version=& $script:psql --version
  if($version -notmatch '\b18\.'){throw 'Use as ferramentas PostgreSQL 18 para importar o dump SENX.'}
  foreach($file in @('Banco_De_Dados\senx.sql','Banco_De_Dados\migrations\0.1.4-acesso.sql','Banco_De_Dados\migrations\0.1.5-entrega.sql','BackEnd\SenxCti.Api\SenxCti.Api.csproj')){
    if(-not(Test-Path (Join-Path $project $file))){throw "Projeto incompleto. Arquivo ausente: $file"}
  }
}
function Start-Senx {
  if(-not(Test-Path -LiteralPath $configPath)){throw 'Prepare esta maquina pela opcao 1 primeiro.'}
  $local=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if(-not $local.SENX_DB_CONNECTION){throw 'Configuracao de banco ausente no arquivo privado.'}
  $env:SENX_DB_CONNECTION=$local.SENX_DB_CONNECTION
  $env:ASPNETCORE_ENVIRONMENT='Development'
  & dotnet restore (Join-Path $project 'BackEnd\SenxCti.Api\SenxCti.Api.csproj')
  if($LASTEXITCODE -ne 0){throw 'Falha ao restaurar dependencias. Confira sua conexao com a internet.'}
  Write-Host "`nAbra http://localhost:5080 . Mantenha esta janela aberta; Ctrl+C encerra o site."
  & dotnet run --project (Join-Path $project 'BackEnd\SenxCti.Api') --no-restore --no-launch-profile -- --urls http://localhost:5080
  if($LASTEXITCODE -ne 0){throw 'O servidor foi encerrado. Confira as mensagens acima e se a porta 5080 esta ocupada.'}
}
try {
  Set-Location -LiteralPath $project
  Write-Host 'SENX - Preparar maquina e iniciar o sistema'
  Check-Tools
  if($Verificar){Write-Host 'OK: projeto, .NET 10 SDK e ferramentas PostgreSQL 18 encontrados.';exit 0}
  Write-Host '1 - Preparar banco/configuracao e iniciar'
  Write-Host '2 - Somente iniciar (maquina ja preparada)'
  $choice=Read-Default 'Opcao' '1'
  if($choice -eq '2'){Start-Senx;exit 0}
  if($choice -ne '1'){throw 'Opcao invalida.'}
  Write-Host 'O PostgreSQL precisa estar instalado e com o servico ativo. Senhas nao aparecem ao digitar.'
  $server=Read-Default 'Servidor PostgreSQL' 'localhost'
  $port=Read-Default 'Porta' '5432'
  if($port -notmatch '^\d+$' -or [int]$port -lt 1 -or [int]$port -gt 65535){throw 'Porta invalida.'}
  $database=Read-Default 'Nome do banco' 'senx'
  if($database -notmatch '^[a-z][a-z0-9_]{0,62}$' -or $database -in @('postgres','template0','template1')){throw 'Use um nome de banco como senx ou senx_cti. Bancos do sistema nao podem ser usados.'}
  $adminUser=Read-Default 'Usuario administrador do PostgreSQL' 'postgres'
  $env:PGPASSWORD=Read-Secret "Senha PostgreSQL de $adminUser"
  [void](Sql 'postgres' $adminUser 'SELECT 1')
  $role=Sql 'postgres' $adminUser "SELECT count(*) FROM pg_roles WHERE rolname='senx_app'"
  if($role -eq '0'){
    [void](Sql 'postgres' $adminUser 'CREATE ROLE senx_app LOGIN')
    Write-Host 'Crie e confirme agora a senha do usuario senx_app:'
    & $psql -h $server -p $port -U $adminUser -d postgres -w -X -v ON_ERROR_STOP=1 -c '\password senx_app'
    if($LASTEXITCODE -ne 0){throw 'Nao foi possivel definir a senha. O usuario pode ter sido criado; na proxima tentativa, defina sua senha no SQL Shell.'}
  }else{Write-Host 'Usuario senx_app ja existe. A senha dele nao sera alterada.'}
  $exists=Sql 'postgres' $adminUser "SELECT count(*) FROM pg_database WHERE datname='$database'"
  if($exists -eq '0'){
    [void](Sql 'postgres' $adminUser "CREATE DATABASE `"$database`" OWNER senx_app")
    Write-Host "Banco $database criado."
  }else{Write-Host "Banco $database ja existe; verificando o conteudo antes de importar."}
  $appPassword=Read-Secret 'Senha de senx_app (a definida para a aplicacao)'
  $env:PGPASSWORD=$appPassword
  [void](Sql $database 'senx_app' 'SELECT 1')
  $objects=[int](Sql $database 'senx_app' "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')")
  if($objects -eq 0){
    Write-Host 'Banco vazio. Importando o dump em transacao unica...'
    & $psql -h $server -p $port -U senx_app -d $database -w -X -v ON_ERROR_STOP=1 --single-transaction -f (Join-Path $project 'Banco_De_Dados\senx.sql')
    if($LASTEXITCODE -ne 0){throw 'Importacao falhou. A transacao foi revertida; nao continue manualmente sem conferir o erro.'}
  }else{
    $required=[int](Sql $database 'senx_app' "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Equipe','Usuario','DadosCliente','Ligacao','Analise','Assunto','LigacaoAssunto','Criterio','Resultado','Alerta','Registro')")
    if($required -ne 11){throw 'Banco existente nao corresponde a uma instalacao SENX completa. Nada sera importado ou apagado. Solicite revisao da estrutura.'}
    Write-Host 'Estrutura SENX existente: importacao ignorada; dados preservados.'
    if((Read-Host 'Aplicar as migracoes com backup neste banco existente? Digite SIM') -cne 'SIM'){throw 'Atualizacao cancelada antes das migracoes.'}
  }
  $backupDirectory=Join-Path $project 'Banco_De_Dados\backups'
  [void](New-Item -ItemType Directory -Path $backupDirectory -Force)
  $backup=Join-Path $backupDirectory ('senx-instalador-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N')+'.dump')
  & (Join-Path $pgBin 'pg_dump.exe') -h $server -p $port -U senx_app -d $database -w -Fc -f $backup
  if($LASTEXITCODE -ne 0){throw 'Backup falhou. Migracoes canceladas.'}
  & (Join-Path $pgBin 'pg_restore.exe') -l $backup | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Backup nao pode ser lido. Migracoes canceladas.'}
  foreach($migration in @('0.1.4-acesso.sql','0.1.5-entrega.sql')){
    & $psql -h $server -p $port -U senx_app -d $database -w -X -v ON_ERROR_STOP=1 -f (Join-Path $project "Banco_De_Dados\migrations\$migration")
    if($LASTEXITCODE -ne 0){throw "Falha na migracao $migration. Backup preservado; etapas seguintes canceladas."}
  }
  $settings=New-Object System.Data.Common.DbConnectionStringBuilder
  $settings['Host']=$server;$settings['Port']=$port;$settings['Database']=$database
  $settings['Username']='senx_app';$settings['Password']=$appPassword
  if(Test-Path -LiteralPath $configPath){
    $local=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $local | Add-Member -MemberType NoteProperty -Name SENX_DB_CONNECTION -Value $settings.ConnectionString -Force
  }else{$local=[pscustomobject]@{SENX_DB_CONNECTION=$settings.ConnectionString}}
  $local | ConvertTo-Json -Depth 32 | Set-Content -LiteralPath $configPath -Encoding UTF8
  $env:SENX_DB_CONNECTION=$settings.ConnectionString
  $env:ASPNETCORE_ENVIRONMENT='Development'
  Write-Host "Preparacao concluida. Backup: $backup"
  Write-Host 'Configuracao privada salva. Nao compartilhe appsettings.Local.json ou backups.'
  if((Read-Default 'Iniciar o site agora? S/N' 'S') -match '^[sS]$'){Start-Senx}
}catch {
  Write-Host ("ERRO: "+$_.Exception.Message) -ForegroundColor Red
  exit 1
}finally {
  $env:PGPASSWORD=$oldPassword
  $env:ASPNETCORE_ENVIRONMENT=$oldEnvironment
  $env:SENX_DB_CONNECTION=$oldConnection
  $appPassword=$null
}
