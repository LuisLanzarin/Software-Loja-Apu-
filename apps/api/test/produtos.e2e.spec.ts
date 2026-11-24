import { criarAppDeTeste, XHR } from './helpers';

let t: Awaited<ReturnType<typeof criarAppDeTeste>>;
let admin: string;
let vendedor: string;
let un: Record<string, number>;

beforeAll(async () => {
  t = await criarAppDeTeste();
  admin = await t.comAdmin();
  vendedor = await t.criarUsuario(admin, 'vendedor', 'VENDEDOR');
  const unidades = (await t.http().get('/api/unidades').set('Cookie', admin)).body as { id: number; sigla: string }[];
  un = Object.fromEntries(unidades.map((u) => [u.sigla, u.id]));
  // Parâmetros conhecidos: 8% + 12% + 2%, margem padrão 15%
  await t.http().put('/api/configuracao/precificacao').set(XHR).set('Cookie', admin)
    .send({ impostosPct: 800, despesasFixasPct: 1200, comissaoPct: 200, margemPadraoPct: 1500 }).expect(200);
});
afterAll(() => t.fechar());

const post = (url: string, body: unknown, cookie = admin) => t.http().post(url).set(XHR).set('Cookie', cookie).send(body as object);
const patch = (url: string, body: unknown, cookie = admin) => t.http().patch(url).set(XHR).set('Cookie', cookie).send(body as object);
const get = (url: string, cookie = admin) => t.http().get(url).set('Cookie', cookie);

const piso = (extra: object = {}) => ({
  descricao: 'Piso Cerâmico Bege 60x60',
  unidadeId: un.M2,
  custo: 3000,
  precoVenda: 4762,
  estoqueMinimo: 20000,
  conversoes: [{ unidadeId: un.CX, fator: 2500 }],
  ...extra,
});

describe('Fornecedores', () => {
  it('recusa CNPJ inválido e aceita válido (com máscara)', async () => {
    expect((await post('/api/fornecedores', { razaoSocial: 'X', documento: '11.222.333/0001-82' })).status).toBe(400);
    const r = await post('/api/fornecedores', { razaoSocial: 'Cerâmica Bela Ltda', documento: '11.222.333/0001-81', uf: 'sp' });
    expect(r.status).toBe(201);
    expect(r.body.documento).toBe('11222333000181');
    expect(r.body.uf).toBe('SP');
  });

  it('não deixa cadastrar o mesmo CNPJ duas vezes', async () => {
    expect((await post('/api/fornecedores', { razaoSocial: 'Outra', documento: '11222333000181' })).status).toBe(409);
  });

  it('vendedor não acessa fornecedores', async () => {
    expect((await get('/api/fornecedores', vendedor)).status).toBe(403);
  });
});

describe('Produtos', () => {
  let id: number;
  let categoriaId: number;

  it('cadastra com código automático, conversão de unidade e cálculo de margem', async () => {
    const forn = (await get('/api/fornecedores')).body[0];
    const r = await post('/api/produtos', piso({ fornecedores: [{ fornecedorId: forn.id, codigoFornecedor: 'PB-6060' }] }));
    expect(r.status).toBe(201);
    id = r.body.id;
    expect(r.body.codigo).toBe('000001');
    expect(r.body.precoSugerido).toBe(4762);
    expect(r.body.margemReal).toBe(1500);
    expect(r.body.conversoes[0]).toMatchObject({ fator: 2500, unidade: { sigla: 'CX' } });
  });

  it('busca sem acento, por pedaços de palavra e pelo código', async () => {
    const porPalavra = await get('/api/produtos?q=ceramico 60x');
    expect(porPalavra.body.itens.map((p: { id: number }) => p.id)).toEqual([id]);
    expect((await get('/api/produtos?q=000001')).body.total).toBe(1);
    expect((await get('/api/produtos?q=porcelanato')).body.total).toBe(0);
  });

  it('vendedor vê o preço, mas não o custo, a margem nem os fornecedores', async () => {
    const lista = await get('/api/produtos', vendedor);
    expect(lista.status).toBe(200);
    expect(lista.body.itens[0].precoVenda).toBe(4762);
    for (const campo of ['custo', 'margemReal', 'precoSugerido', 'fornecedores']) {
      expect(lista.body.itens[0]).not.toHaveProperty(campo);
    }
    const um = await get(`/api/produtos/${id}`, vendedor);
    expect(um.body).not.toHaveProperty('custo');
    expect(um.body).not.toHaveProperty('fornecedores');
    expect((await post('/api/produtos', piso({ descricao: 'Outro' }), vendedor)).status).toBe(403);
    expect((await get(`/api/produtos/${id}/historico-precos`, vendedor)).status).toBe(403);
  });

  it('valida código de barras, duplicidade e conversões', async () => {
    expect((await post('/api/produtos', piso({ codigoBarras: '7891000315508' }))).status).toBe(400);
    expect((await post('/api/produtos', piso({ codigoBarras: '7891000315507' }))).status).toBe(201);
    const dup = await post('/api/produtos', piso({ descricao: 'Duplicado', codigoBarras: '7891000315507' }));
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(/Piso Cerâmico/);
    const conv = await post('/api/produtos', piso({ conversoes: [{ unidadeId: un.M2, fator: 1000 }] }));
    expect(conv.status).toBe(400);
  });

  it('não aceita estoque mínimo quebrado em produto vendido por unidade', async () => {
    const r = await post('/api/produtos', { descricao: 'Martelo', unidadeId: un.UN, custo: 2000, precoVenda: 3500, estoqueMinimo: 1500 });
    expect(r.status).toBe(400);
  });

  it('a margem da categoria vale quando o produto não tem a sua', async () => {
    const cat = await post('/api/categorias', { nome: 'Pisos', margemPct: 2500 });
    expect(cat.status).toBe(201);
    categoriaId = cat.body.id;
    const r = await patch(`/api/produtos/${id}`, piso({ categoriaId: cat.body.id }));
    expect(r.body.margemEfetiva).toBe(2500);
    // 3000 / (1 - 0,47) = 5660,38
    expect(r.body.precoSugerido).toBe(5660);
  });

  it('registra histórico quando o preço muda', async () => {
    await patch(`/api/produtos/${id}`, piso({ categoriaId, precoVenda: 4990 }));
    const h = await get(`/api/produtos/${id}/historico-precos`);
    expect(h.body[0]).toMatchObject({ precoAnterior: 4762, precoNovo: 4990, motivo: 'Alteração no cadastro' });
    expect(h.body.at(-1).motivo).toBe('Cadastro do produto');
  });
});

describe('Reajuste em lote', () => {
  it('simula sem gravar e depois aplica +10% no custo recalculando pela margem desejada', async () => {
    const cat = (await get('/api/categorias')).body.find((c: { nome: string }) => c.nome === 'Pisos');
    const corpo = { categoriaId: cat.id, tipo: 'CUSTO_PERCENTUAL_SUGERIDO', percentual: 1000 };

    const sim = await post('/api/produtos/reajuste/simular', corpo);
    expect(sim.status).toBe(201);
    expect(sim.body.itens).toHaveLength(1);
    expect(sim.body.itens[0]).toMatchObject({ custoAntes: 3000, custoDepois: 3300 });
    const antes = (await get('/api/produtos?q=000001')).body.itens[0];
    expect(antes.custo).toBe(3000);

    await post('/api/produtos/reajuste/aplicar', corpo).expect(201);
    const depois = (await get('/api/produtos?q=000001')).body.itens[0];
    expect(depois.custo).toBe(3300);
    expect(depois.margemReal).toBe(depois.margemEfetiva);
  });

  it('"mesmo %" sobe custo e preço juntos e preserva a margem atual', async () => {
    const antes = (await get('/api/produtos?q=000001')).body.itens[0];
    const cat = (await get('/api/categorias')).body.find((c: { nome: string }) => c.nome === 'Pisos');
    await post('/api/produtos/reajuste/aplicar', { categoriaId: cat.id, tipo: 'CUSTO_PERCENTUAL', percentual: 800 }).expect(201);
    const depois = (await get('/api/produtos?q=000001')).body.itens[0];
    expect(depois.custo).toBe(Math.round(antes.custo * 1.08));
    expect(depois.precoVenda).toBe(Math.round(antes.precoVenda * 1.08));
    expect(Math.abs(depois.margemReal - antes.margemReal)).toBeLessThanOrEqual(1);
  });

  it('vendedor não pode reajustar', async () => {
    expect((await post('/api/produtos/reajuste/simular', { tipo: 'PRECO_SUGERIDO' }, vendedor)).status).toBe(403);
  });
});

describe('Parâmetros de preço', () => {
  it('recusa percentuais que somam 100% ou mais', async () => {
    const r = await t.http().put('/api/configuracao/precificacao').set(XHR).set('Cookie', admin)
      .send({ impostosPct: 3000, despesasFixasPct: 3000, comissaoPct: 2000, margemPadraoPct: 2000 });
    expect(r.status).toBe(400);
  });

  it('vendedor não recebe os parâmetros de preço na configuração', async () => {
    const r = await get('/api/configuracao', vendedor);
    expect(r.body).not.toHaveProperty('impostosPct');
    expect(r.body).toHaveProperty('descontoMaxSemAutorizacao');
  });
});
