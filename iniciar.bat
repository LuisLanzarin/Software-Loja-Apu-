@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Gestao da Loja - NAO FECHE ESTA JANELA
rem Para uso sem o servico do Windows. Com o servico instalado, nao e preciso.
:inicio
node apps\api\dist\main.js
rem Codigo 3 = o sistema pediu para reiniciar (ex.: restauracao de backup).
if %errorlevel%==3 (
  echo Reiniciando...
  timeout /t 2 /nobreak >nul
  goto inicio
)
echo.
echo O sistema parou. Feche esta janela ou pressione uma tecla para iniciar de novo.
pause >nul
goto inicio
