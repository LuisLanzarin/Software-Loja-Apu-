import { criarAppDeTeste, XHR } from './helpers';

let t: Awaited<ReturnType<typeof criarAppDeTeste>>;
let admin: string, financeiro: string, vendedor: string;
let un: Record<string, number>;
let piso: number, cimento: number, fornecedor: number;

const post = (url: string, body: unknown, cookie = admin) => t.http().post(url).set(XHR).set('Cookie', cookie).send(body as object);
const get = (url: string, cookie = admin) => t.http().get(url).set('Cookie', cookie);
const produto = async (id: number) => (await get(`/api/produtos/${id}`)).body;

beforeAll(async () => {
  t = await criarAppDeTeste();
  admin = await t.comAdmin();
  financeiro = await t.criarUsuario(admin, 'fin', 'FINANCEIRO');
  vendedor = await t.criarUsuario(admin, 'vend', 'VENDEDOR');
  un = Object.fromEntries((await get('/api/unidades')).body.map((u: { sigla: string; id: number }) => [u.sigla, u.id]));
  fornecedor = (await post('/api/fornecedores', { razaoSocial: 'Fornecedor Teste' })).body.id;
  piso = (await post('/api/produtos', {
    descricao: 'Piso 60x60', unidadeId: un.M2, custo: 0, precoVenda: 5000, estoqueMinimo: 30000,
    conversoes: [{ unidadeId: un.CX, fator: 2500 }],
  })).body.id;
  cimento = (await post('/api/produtos', { descricao: 'Cimento 50kg', unidadeId: un.SC, custo: 0, precoVenda: 3990 })).body.id;
});
afterAll(() => t.fechar());

describe('Entrada de mercadoria', () => {
  let primeira: number;

  it('converte caixas em m², rateia o frete e calcula o custo médio', async () => {
    const r = await post('/api/entradas', {
      fornecedorId: fornecedor, numeroNota: '1234', frete: 1000,
      itens: [
        { produtoId: piso, unidadeId: un.CX, quantidade: 10000, custoUnitario: 7500 }, // 10 CX × R$ 75
        { produtoId: cimento, unidadeId: un.SC, quantidade: 20000, custoUnitario: 2800 }, // 20 SC × R$ 28
      ],
    }, financeiro);
    expect(r.status).toBe(201);
    primeira = r.body.entrada.id;
    expect(r.body.entrada.totalNota).toBe(132000);
    const [i1, i2] = r.body.entrada.itens;
    expect(i1).toMatchObject({ quantidadeEstoque: 25000, custoTotal: 75572, custoMedioDepois: 3023 });
    expect(i2).toMatchObject({ quantidadeEstoque: 20000, custoTotal: 56428, custoMedioDepois: 2821 });
    expect((await produto(piso)).estoqueAtual).toBe(25000);
    expect((await produto(piso)).custo).toBe(3023);
  });

  it('avisa quando o novo custo derruba a margem abaixo da desejada', async () => {
    const r = await post('/api/entradas', { itens: [{ produtoId: cimento, unidadeId: un.SC, quantidade: 1000, custoUnitario: 3500 }] });
    expect(r.body.alertasMargem.map((a: { id: number }) => a.id)).toContain(cimento);
  });

  it('vincula o fornecedor ao produto automaticamente', async () => {
    expect((await produto(piso)).fornecedores[0].fornecedorId).toBe(fornecedor);
  });

  it('segunda compra mais cara: média ponderada; cancelar desfaz saldo e custo', async () => {
    const r = await post('/api/entradas', { itens: [{ produtoId: piso, unidadeId: un.CX, quantidade: 4000, custoUnitario: 8500 }] });
    expect((await produto(piso))).toMatchObject({ estoqueAtual: 35000, custo: 3131 });

    expect((await post(`/api/entradas/${r.body.entrada.id}/cancelar`, { motivo: 'Nota lançada errada' }, financeiro)).status).toBe(403);
    const c = await post(`/api/entradas/${r.body.entrada.id}/cancelar`, { motivo: 'Nota lançada errada' });
    expect(c.status).toBe(201);
    expect(c.body.status).toBe('CANCELADA');
    expect((await produto(piso))).toMatchObject({ estoqueAtual: 25000, custo: 3023 });
    expect((await post(`/api/entradas/${r.body.entrada.id}/cancelar`, { motivo: 'De novo' })).status).toBe(400);
  });

  it('recusa unidade sem conversão e quantidade quebrada em produto inteiro', async () => {
    const semConv = await post('/api/entradas', { itens: [{ produtoId: cimento, unidadeId: un.CX, quantidade: 1000, custoUnitario: 100 }] });
    expect(semConv.status).toBe(400);
    expect(semConv.body.message).toMatch(/conversão/);
    const quebrado = await post('/api/entradas', { itens: [{ produtoId: cimento, unidadeId: un.SC, quantidade: 1500, custoUnitario: 100 }] });
    expect(quebrado.status).toBe(400);
  });

  it('não cancela entrada cujo material já saiu do estoque', async () => {
    const e = await post('/api/entradas', { itens: [{ produtoId: piso, unidadeId: un.M2, quantidade: 5000, custoUnitario: 3000 }] });
    await post('/api/estoque/ajustes', { produtoId: piso, tipo: 'PERDA', quantidade: 30000, motivo: 'Teste de saída total' }).expect(201);
    const c = await post(`/api/entradas/${e.body.entrada.id}/cancelar`, { motivo: 'Tentativa' });
    expect(c.status).toBe(400);
    expect(c.body.message).toMatch(/insuficiente/);
    expect((await produto(piso)).estoqueAtual).toBe(0); // nada mudou
    await post('/api/estoque/ajustes', { produtoId: piso, tipo: 'AJUSTE_ENTRADA', quantidade: 25000, motivo: 'Volta ao cenário' }).expect(201);
  });

  it('vendedor não lança entradas', async () => {
    expect((await get('/api/entradas', vendedor)).status).toBe(403);
  });
});

describe('Ajustes e inventário', () => {
  it('não deixa o estoque ficar negativo por ajuste', async () => {
    const r = await post('/api/estoque/ajustes', { produtoId: piso, tipo: 'AJUSTE_SAIDA', quantidade: 30000, motivo: 'Teste' });
    expect(r.status).toBe(400);
  });

  it('registra perda com motivo; financeiro não pode ajustar', async () => {
    const r = await post('/api/estoque/ajustes', { produtoId: piso, tipo: 'PERDA', quantidade: 2500, motivo: 'Caixa quebrada na descarga' });
    expect(r.body).toMatchObject({ saldoAntes: 25000, saldoDepois: 22500 });
    expect((await post('/api/estoque/ajustes', { produtoId: piso, tipo: 'PERDA', quantidade: 1000, motivo: 'x x x' }, financeiro)).status).toBe(403);
  });

  it('inventário lança só as diferenças', async () => {
    const saldoCimento = (await produto(cimento)).estoqueAtual;
    const r = await post('/api/estoque/inventario', {
      itens: [{ produtoId: piso, contado: 22500 }, { produtoId: cimento, contado: saldoCimento - 2000 }],
      observacao: 'Contagem de novembro',
    });
    expect(r.status).toBe(201);
    expect(r.body.diferencas).toHaveLength(1);
    expect(r.body.diferencas[0]).toMatchObject({ produtoId: cimento, diferenca: -2000 });
    expect((await produto(cimento)).estoqueAtual).toBe(saldoCimento - 2000);
  });

  it('o saldo é sempre a soma das movimentações', async () => {
    const movs = (await get(`/api/estoque/movimentacoes?produtoId=${piso}`)).body.itens as { quantidade: number; saldoApos: number }[];
    expect(movs.reduce((a, m) => a + m.quantidade, 0)).toBe((await produto(piso)).estoqueAtual);
    expect(movs[0].saldoApos).toBe((await produto(piso)).estoqueAtual);
  });

  it('vendedor vê saldo e movimentações, mas não o custo', async () => {
    const movs = await get(`/api/estoque/movimentacoes?produtoId=${piso}`, vendedor);
    expect(movs.status).toBe(200);
    expect(movs.body.itens[0]).not.toHaveProperty('custoUnitario');
    const resumo = await get('/api/estoque/resumo', vendedor);
    expect(resumo.body.valorEstoque).toBeUndefined();
  });

  it('filtra produtos abaixo do estoque mínimo', async () => {
    const r = await get('/api/produtos?estoque=abaixo_minimo');
    expect(r.body.itens.map((p: { id: number }) => p.id)).toEqual([piso]);
    const resumo = (await get('/api/estoque/resumo')).body;
    expect(resumo.abaixoMinimo).toBe(1);
    expect(resumo.valorEstoque).toBeGreaterThan(0);
  });
});
