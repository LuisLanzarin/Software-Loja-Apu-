import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { criarAppDeTeste, XHR } from './helpers';

let t: Awaited<ReturnType<typeof criarAppDeTeste>>;
let admin: string, vendedor: string;
let p1: number, p2: number, p3: number;
const hoje = new Date().toLocaleDateString('sv-SE');
const semanaPassada = new Date(Date.now() - 6 * 864e5).toLocaleDateString('sv-SE');

const post = (url: string, body: unknown, cookie = admin) => t.http().post(url).set(XHR).set('Cookie', cookie).send(body as object);
const get = (url: string, cookie = admin) => t.http().get(url).set('Cookie', cookie);
const vender = (itens: object[], extra: object = {}, cookie = admin) =>
  post('/api/vendas', { finalizar: true, itens, pagamentos: [{ forma: 'PIX', valor: 9_999_999 }].slice(0, 0), ...extra }, cookie);

beforeAll(async () => {
  t = await criarAppDeTeste();
  admin = await t.comAdmin();
  vendedor = await t.criarUsuario(admin, 'vendedor', 'VENDEDOR');
  const un = Object.fromEntries((await get('/api/unidades')).body.map((u: { sigla: string; id: number }) => [u.sigla, u.id]));
  // custo / preço: p1 R$ 10 / R$ 20 · p2 R$ 30 / R$ 40 · p3 R$ 1 / R$ 2
  p1 = (await post('/api/produtos', { descricao: 'Produto A', unidadeId: un.UN, custo: 1000, precoVenda: 2000 })).body.id;
  p2 = (await post('/api/produtos', { descricao: 'Produto B', unidadeId: un.UN, custo: 3000, precoVenda: 4000 })).body.id;
  p3 = (await post('/api/produtos', { descricao: 'Produto C', unidadeId: un.UN, custo: 100, precoVenda: 200 })).body.id;
  await post('/api/estoque/inventario', { itens: [p1, p2, p3].map((produtoId) => ({ produtoId, contado: 1_000_000 })) }).expect(201);
  await post('/api/caixa/abrir', { fundoTroco: 0 }).expect(201);
  await post('/api/caixa/abrir', { fundoTroco: 0 }, vendedor).expect(201);

  // Venda 1 (admin): 10 A = R$ 200, dinheiro
  await vender([{ produtoId: p1, quantidade: 10000 }], { pagamentos: [{ forma: 'DINHEIRO', valor: 20000 }] }).expect(201);
  // Venda 2 (vendedor): 2 B + 1 C = R$ 82, desconto de R$ 2 na venda, débito
  await vender([{ produtoId: p2, quantidade: 2000 }, { produtoId: p3, quantidade: 1000 }], { descontoGeral: 200, pagamentos: [{ forma: 'DEBITO', valor: 8000 }] }, vendedor).expect(201);
  // Venda 3 (admin), depois cancelada: não entra no faturamento
  const v3 = (await vender([{ produtoId: p1, quantidade: 1000 }], { pagamentos: [{ forma: 'PIX', valor: 2000 }] })).body;
  await post(`/api/vendas/${v3.id}/cancelar`, { motivo: 'Teste de cancelamento' }).expect(201);
});
afterAll(() => t.fechar());

describe('Relatório de vendas', () => {
  it('soma faturamento, custo e lucro bruto só das vendas finalizadas', async () => {
    const r = await get(`/api/relatorios/vendas?de=${hoje}&ate=${hoje}`);
    expect(r.status).toBe(200);
    expect(r.body.totais).toMatchObject({
      quantidade: 2,
      faturamento: 20000 + 8000,
      custo: 10000 + 6000 + 100,
      lucroBruto: 28000 - 16100,
      descontos: 200,
      ticketMedio: 14000,
      canceladas: 1,
      valorCancelado: 2000,
    });
  });

  it('mostra os dias sem venda (zerados) e agrupa por semana e mês', async () => {
    const dias = (await get(`/api/relatorios/vendas?de=${semanaPassada}&ate=${hoje}&agrupar=dia`)).body.periodos;
    expect(dias).toHaveLength(7);
    expect(dias.filter((d: { faturamento: number }) => d.faturamento > 0)).toHaveLength(1);
    const mes = (await get(`/api/relatorios/vendas?de=${hoje}&ate=${hoje}&agrupar=mes`)).body.periodos;
    expect(mes).toHaveLength(1);
    expect(mes[0].rotulo).toMatch(/\d{4}/);
  });

  it('separa por forma de pagamento e por vendedor', async () => {
    const r = (await get(`/api/relatorios/vendas?de=${hoje}&ate=${hoje}`)).body;
    expect(r.formasPagamento).toEqual([{ forma: 'DINHEIRO', valor: 20000 }, { forma: 'DEBITO', valor: 8000 }]);
    expect(r.vendedores.map((v: { nome: string; faturamento: number }) => [v.nome, v.faturamento])).toEqual([['Admin', 20000], ['vendedor', 8000]]);
  });

  it('recusa período inválido ou maior que 1 ano', async () => {
    expect((await get(`/api/relatorios/vendas?de=${hoje}&ate=2020-01-01`)).status).toBe(400);
    expect((await get('/api/relatorios/vendas?de=2020-01-01&ate=2026-01-01')).status).toBe(400);
  });

  it('vendedor não acessa relatórios', async () => {
    expect((await get(`/api/relatorios/vendas?de=${hoje}&ate=${hoje}`, vendedor)).status).toBe(403);
  });
});

describe('Curva ABC de produtos', () => {
  it('rateia o desconto da venda entre os itens: a soma bate com o faturamento', async () => {
    const r = (await get(`/api/relatorios/produtos?de=${hoje}&ate=${hoje}`)).body;
    expect(r.totalFaturamento).toBe(28000);
    expect(r.produtos.reduce((a: number, p: { faturamento: number }) => a + p.faturamento, 0)).toBe(28000);
  });

  it('classifica A/B/C pelo faturamento acumulado', async () => {
    const r = (await get(`/api/relatorios/produtos?de=${hoje}&ate=${hoje}`)).body;
    expect(r.produtos.map((p: { descricao: string; classe: string }) => [p.descricao, p.classe])).toEqual([
      ['Produto A', 'A'], // começa em 0% (vai até 71%)
      ['Produto B', 'A'], // começa em 71% < 80%: é o item que cruza a linha dos 80%, ainda conta como A
      ['Produto C', 'C'], // começa em 99% ≥ 95%
    ]);
    expect(r.produtos[0]).toMatchObject({ quantidade: 10000, custo: 10000, lucroBruto: 10000, margemBruta: 5000 });
  });
});

describe('Relatório de caixas', () => {
  it('lista os caixas do período com as diferenças', async () => {
    await post('/api/caixa/fechar', { informado: { DINHEIRO: 19000, PIX: 0, DEBITO: 0, CREDITO: 0 } }).expect(201);
    const r = (await get(`/api/relatorios/caixas?de=${hoje}&ate=${hoje}`)).body;
    expect(r.sessoes).toHaveLength(2);
    expect(r.abertos).toBe(1);
    expect(r.porForma.DINHEIRO).toMatchObject({ esperado: 20000, informado: 19000, diferenca: -1000 });
  });
});

describe('Taxa de serviço nos relatórios', () => {
  it('fica fora do faturamento e do lucro, mas aparece separada', async () => {
    // 1 A = R$ 20,00 de consumo + 10% = R$ 22,00 pagos
    const v = await vender([{ produtoId: p1, quantidade: 1000 }], { cobrarTaxaServico: true, pagamentos: [{ forma: 'PIX', valor: 2200 }] }, vendedor);
    expect(v.body.total).toBe(2200);
    const r = (await get(`/api/relatorios/vendas?de=${hoje}&ate=${hoje}`)).body;
    expect(r.totais).toMatchObject({ quantidade: 3, faturamento: 28000 + 2000, taxaServico: 200, lucroBruto: 30000 - 17100 });
    const abc = (await get(`/api/relatorios/produtos?de=${hoje}&ate=${hoje}`)).body;
    expect(abc.totalFaturamento).toBe(30000);
  });
});

describe('Backup', () => {
  let nome: string;

  it('só o administrador gerencia backups', async () => {
    expect((await get('/api/backup', vendedor)).status).toBe(403);
  });

  it('faz backup manual verificado e permite baixar', async () => {
    const r = await post('/api/backup', {});
    expect(r.status).toBe(201);
    nome = r.body.nome;
    expect(nome).toMatch(/^loja_.*_manual\.db$/);
    expect((await get('/api/backup')).body.arquivos.map((a: { nome: string }) => a.nome)).toContain(nome);
    const d = await get(`/api/backup/arquivos/${nome}`);
    expect(d.status).toBe(200);
    expect(d.headers['content-disposition']).toContain(nome);
  });

  it('não deixa acessar arquivos fora da pasta de backup', async () => {
    expect((await get('/api/backup/arquivos/..%2F..%2Fdata%2Floja.db')).status).toBe(400);
    expect((await post('/api/backup/restaurar', { nome: '../teste.db', confirmacao: 'RESTAURAR' })).status).toBe(400);
  });

  it('exige digitar RESTAURAR', async () => {
    expect((await post('/api/backup/restaurar', { nome, confirmacao: 'sim' })).status).toBe(400);
  });

  it('restaura: guarda uma cópia de segurança e, ao reiniciar, volta o banco do backup', async () => {
    const { BackupService } = await import('../src/backup/backup.service');
    const servico = t.app.get(BackupService);
    const sair = jest.fn();
    servico.sair = sair;

    // Depois do backup, cadastra um produto novo — ele deve sumir com a restauração.
    await post('/api/produtos', { descricao: 'Criado depois do backup', unidadeId: (await get(`/api/produtos/${p1}`)).body.unidadeId, custo: 1, precoVenda: 2 }).expect(201);

    const r = await post('/api/backup/restaurar', { nome, confirmacao: 'RESTAURAR' });
    expect(r.status).toBe(201);
    expect(r.body.copiaDeSeguranca).toMatch(/antes-restauracao/);
    await new Promise((ok) => setTimeout(ok, 1700));
    expect(sair).toHaveBeenCalled();

    // Simula o reinício: fecha o app e aplica a restauração pendente, como o main.ts faz.
    await t.app.close();
    const { aplicarRestauracaoPendente } = await import('../src/backup/arquivos');
    const msgs: string[] = [];
    aplicarRestauracaoPendente((m) => msgs.push(m));
    expect(msgs[0]).toMatch(/restaurado/);
    const db = new Database(process.env.DATABASE_URL!.replace('file:', ''), { readonly: true });
    const n = db.prepare("SELECT count(*) AS n FROM Produto WHERE descricao = 'Criado depois do backup'").get() as { n: number };
    db.close();
    expect(n.n).toBe(0);
    expect(existsSync(`${t.pasta}/backups`)).toBe(true);
  });
});
