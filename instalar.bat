@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo == Instalando dependencias ==
call npm ci || goto erro
if not exist apps\api\.env copy apps\api\.env.example apps\api\.env >nul
echo == Compilando o sistema ==
call npm run build || goto erro
echo == Preparando o banco de dados ==
call npm run db:migrate || goto erro
echo.
echo Instalacao concluida. Para abrir o sistema, execute iniciar.bat
pause
exit /b 0
:erro
echo.
echo ERRO na instalacao. Veja as mensagens acima.
pause
exit /b 1
