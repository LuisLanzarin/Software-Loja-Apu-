@echo off
chcp 65001 >nul
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  echo Este arquivo precisa ser executado como ADMINISTRADOR.
  echo Clique com o botao direito nele e escolha "Executar como administrador".
  pause
  exit /b 1
)
if not exist apps\api\dist\main.js (
  echo Execute primeiro o instalar.bat.
  pause
  exit /b 1
)
echo == Liberando a porta 3000 no Firewall (para os outros PCs da loja) ==
netsh advfirewall firewall delete rule name="Gestao da Loja" >nul 2>&1
netsh advfirewall firewall add rule name="Gestao da Loja" dir=in action=allow protocol=TCP localport=3000 profile=private,domain
echo == Instalando o servico do Windows ==
node scripts\servico.cjs instalar
echo.
echo Pronto. O sistema agora inicia sozinho quando o computador liga.
echo Acesse http://localhost:3000 neste PC.
pause
