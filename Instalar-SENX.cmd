@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0Instalar-SENX.ps1"
set "SENX_RESULT=%ERRORLEVEL%"
echo.
if not "%SENX_RESULT%"=="0" echo A operacao nao foi concluida. Confira a mensagem acima.
pause
exit /b %SENX_RESULT%
