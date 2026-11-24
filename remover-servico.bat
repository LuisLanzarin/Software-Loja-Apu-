@echo off
chcp 65001 >nul
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  echo Execute como ADMINISTRADOR ^(botao direito, "Executar como administrador"^).
  pause
  exit /b 1
)
node scripts\servico.cjs remover
netsh advfirewall firewall delete rule name="Gestao da Loja" >nul 2>&1
pause
