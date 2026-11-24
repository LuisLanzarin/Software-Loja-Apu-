@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Gestao da Loja - NAO FECHE ESTA JANELA
rem Para uso sem o servico do Windows. Com o servico instalado, nao e preciso.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERRO] O Node.js nao foi encontrado.
  echo Instale a versao 22 LTS em https://nodejs.org e abra este arquivo de novo.
  pause
  exit /b 1
)
if not exist apps\api\dist\main.js (
  echo [ERRO] O sistema ainda nao foi instalado.
  echo Execute primeiro o instalar.bat e espere aparecer "Instalacao concluida".
  pause
  exit /b 1
)

echo Iniciando o sistema... o navegador abre sozinho em alguns segundos.
echo Deixe esta janela aberta enquanto usar o sistema.
echo.
rem Abre o navegador quando o sistema responder (tenta por ate 60 segundos).
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/saude | Out-Null; Start-Process 'http://localhost:3000'; break}catch{Start-Sleep 1}}"

:inicio
node apps\api\dist\main.js
rem Codigo 3 = o sistema pediu para reiniciar (ex.: restauracao de backup).
if %errorlevel%==3 (
  echo Reiniciando...
  timeout /t 2 /nobreak >nul
  goto inicio
)
echo.
echo [ATENCAO] O sistema parou. Se apareceu uma mensagem de erro acima, tire um print desta janela.
echo Pressione uma tecla para tentar iniciar de novo.
pause >nul
goto inicio
