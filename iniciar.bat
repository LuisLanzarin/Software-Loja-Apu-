@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Gestao da Loja - NAO FECHE ESTA JANELA
call npm run db:migrate >nul
call npm start
pause
