/**
 * Instala/remove o sistema como SERVIÇO DO WINDOWS: inicia sozinho quando o
 * computador liga (mesmo sem ninguém logado) e é reiniciado se cair.
 *
 * Uso (em um prompt "Executar como administrador"):
 *   node scripts/servico.cjs instalar
 *   node scripts/servico.cjs remover
 *   node scripts/servico.cjs reiniciar
 * Normalmente chamado pelos arquivos instalar-servico.bat / remover-servico.bat.
 */
const path = require('node:path');
const fs = require('node:fs');

if (process.platform !== 'win32') {
  console.error('Este script é só para Windows.');
  process.exit(1);
}

const { Service } = require('node-windows');
const raiz = path.resolve(__dirname, '..');
const api = path.join(raiz, 'apps', 'api');
const script = path.join(api, 'dist', 'main.js');
const logs = path.join(raiz, 'logs');

const svc = new Service({
  name: 'GestaoLoja',
  description: 'Gestão da Loja: vendas, estoque e caixa (http://localhost:3000)',
  script,
  workingDirectory: api,
  logpath: logs,
  // Reinicia sempre que o processo sair (inclusive após restaurar um backup).
  wait: 2,
  grow: 0.25,
  maxRestarts: 20,
  abortOnError: false,
});

const acao = process.argv[2];
svc.on('install', () => {
  console.log('Serviço instalado. Iniciando...');
  svc.start();
});
svc.on('alreadyinstalled', () => console.log('O serviço já estava instalado. Use "reiniciar" para reiniciá-lo.'));
svc.on('invalidinstallation', () => console.error('Instalação inválida: remova o serviço e instale de novo.'));
svc.on('start', () => console.log('Serviço em execução. Acesse http://localhost:3000'));
svc.on('stop', () => console.log('Serviço parado.'));
svc.on('uninstall', () => console.log('Serviço removido. O sistema não inicia mais sozinho.'));
svc.on('error', (e) => console.error('Erro:', e));

if (acao === 'instalar') {
  if (!fs.existsSync(script)) {
    console.error('O sistema ainda não foi compilado. Rode instalar.bat primeiro.');
    process.exit(1);
  }
  fs.mkdirSync(logs, { recursive: true });
  svc.install();
} else if (acao === 'remover') {
  svc.uninstall();
} else if (acao === 'reiniciar') {
  svc.restart();
} else {
  console.log('Uso: node scripts/servico.cjs instalar | remover | reiniciar');
  process.exit(1);
}
