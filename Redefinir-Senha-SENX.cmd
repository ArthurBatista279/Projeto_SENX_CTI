@echo off
setlocal
cd /d "%~dp0"
set "ASPNETCORE_ENVIRONMENT=Development"
echo SENX - Redefinir senha de uma conta neste computador
echo Feche o servidor SENX deste computador antes de continuar.
dotnet run --project "%~dp0BackEnd\SenxCti.Api" --no-launch-profile -- --reset-password
set "SENX_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %SENX_RESULT%
