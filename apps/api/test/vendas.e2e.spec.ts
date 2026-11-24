import { criarAppDeTeste, XHR } from './helpers';

let t: Awaited<ReturnType<typeof criarAppDeTeste>>;
let admin: string, gerente: string, vendedor: string, financeiro: string;
let cimento: number, piso: number;

const post = (url: string, body: unknown, cookie = vendedor) => t.http().post(url).set(XHR).set('Cookie', cookie).send(body as object);
const get = (url: string, cookie = vendedor) => t.http().get(url).set('Cookie', cookie);
const estoque = async (id: number) => (await get(`/api/produtos/${id}`, admin)).body.estoqueAtual;
const GERENTE = { login: 'gerente', senha: 'definitiva1' };

const venda = (extra: object = {}) => ({
  finalizar: true,
  itens: [{ produtoId: cimento, quantidade: 2000 }],
  pagamentos: [{ forma: 'DINHEIRO', valor: 10000 }],
  ...extra,
});

beforeAll(async () => {
  t = await criarAppDeTeste();
  admin = await t.comAdmin();
  gerente = await t.criarUsuario(admin, 'gerente', 'GERENTE');
  vendedor = await t.criarUsuario(admin, 'vendedor', 'VENDEDOR');
  financeiro = await t.criarUsuario(admin, 'fin', 'FINANCEIRO');
  const un = Object.fromEntries((await get('/api/unidades', admin)).body.map((u: { sigla: string; id: number }) => [u.sigla, u.id]));
  cimento = (await post('/api/produtos', { descricao: 'Cimento 50kg', unidadeId: un.SC, custo: 2800, precoVenda: 3990 }, admin)).body.id;
  piso = (await post('/api/produtos', { descricao: 'Piso 60x60', unidadeId: un.M2, custo: 3000, precoVenda: 5000 }, admin)).body.id;
  await post('/api/estoque/inventario', { itens: [{ produtoId: cimento, contado: 100000 }] }, admin).expect(201);
  // Limites padrão: desconto 5% e cancelamento até R$ 100,00 sem autorização.
});
afterAll(() => t.fechar());

describe('Caixa', () => {
  it('não vende com o caixa fechado', async () => {
    const r = await post('/api/vendas', venda());
    expect(r.status).toBe(400);
    expect(r.body.codigo).toBe('CAIXA_FECHADO');
  });

  it('abre o caixa com fundo de troco (uma sessão por vez)', async () => {
    await post('/api/caixa/abrir', { fundoTroco: 10000 }).expect(201);
    expect((await post('/api/caixa/abrir', { fundoTroco: 0 })).status).toBe(400);
    await post('/api/caixa/abrir', { fundoTroco: 5000 }, gerente).expect(201);
  });

  it('financeiro não opera caixa', async () => {
    expect((await post('/api/caixa/abrir', { fundoTroco: 0 }, financeiro)).status).toBe(403);
  });
});

describe('Venda', () => {
  it('usa o preço do cadastro, calcula troco e baixa o estoque', async () => {
    const r = await post('/api/vendas', venda());
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'FINALIZADA', total: 7980, troco: 2020 });
    expect(r.body.pagamentos).toEqual([expect.objectContaining({ forma: 'DINHEIRO', valor: 7980 })]);
    expect(r.body.itens[0]).not.toHaveProperty('custoUnitario'); // vendedor não vê custo
    expect(await estoque(cimento)).toBe(98000);
  });

  it('confere pagamento: falta, e troco só em dinheiro', async () => {
    expect((await post('/api/vendas', venda({ pagamentos: [{ forma: 'PIX', valor: 5000 }] }))).body.message).toMatch(/Faltam R\$\s?29,80/);
    expect((await post('/api/vendas', venda({ pagamentos: [{ forma: 'PIX', valor: 9000 }] }))).body.message).toMatch(/troco/);
  });

  it('pagamento misto: PIX + dinheiro', async () => {
    const r = await post('/api/vendas', venda({ pagamentos: [{ forma: 'PIX', valor: 5000 }, { forma: 'DINHEIRO', valor: 5000 }] }));
    expect(r.body).toMatchObject({ total: 7980, troco: 2020 });
    expect(await estoque(cimento)).toBe(96000);
  });
});

describe('Autorização do gerente', () => {
  const comDesconto = () => venda({ descontoGeral: 800 }); // 10% de R$ 79,80

  it('desconto acima do limite pede autorização, com o motivo', async () => {
    const r = await post('/api/vendas', comDesconto());
    expect(r.status).toBe(403);
    expect(r.body.codigo).toBe('AUTORIZACAO_NECESSARIA');
    expect(r.body.motivos[0]).toMatchObject({ tipo: 'DESCONTO' });
    expect(await estoque(cimento)).toBe(96000); // nada foi gravado
  });

  it('vendedor não autoriza a si mesmo; senha errada é recusada', async () => {
    expect((await post('/api/vendas', { ...comDesconto(), autorizacao: { login: 'vendedor', senha: 'definitiva1' } })).status).toBe(403);
    const errada = await post('/api/vendas', { ...comDesconto(), autorizacao: { ...GERENTE, senha: 'errada' } });
    expect(errada.status).toBe(403); // nunca 401: não pode derrubar a sessão do vendedor
    expect(errada.body.codigo).toBe('AUTORIZACAO_RECUSADA');
    expect((await get('/api/auth/eu')).status).toBe(200);
  });

  it('com a senha do gerente, a venda passa e registra quem autorizou', async () => {
    const r = await post('/api/vendas', { ...comDesconto(), autorizacao: GERENTE });
    expect(r.status).toBe(201);
    expect(r.body.total).toBe(7180);
    expect(r.body.autorizadoPor.nome).toBe('gerente');
    expect(r.body.motivosAutorizacao).toMatch(/Desconto/);
  });

  it('desconto dentro do limite não pede nada', async () => {
    expect((await post('/api/vendas', venda({ itens: [{ produtoId: cimento, quantidade: 1000, desconto: 100 }] }))).status).toBe(201);
  });

  it('venda sem estoque pede autorização e deixa o saldo negativo', async () => {
    const semEstoque = venda({ itens: [{ produtoId: piso, quantidade: 2500 }], pagamentos: [{ forma: 'DEBITO', valor: 12500 }] });
    const r = await post('/api/vendas', semEstoque);
    expect(r.status).toBe(403);
    expect(r.body.motivos[0].tipo).toBe('SEM_ESTOQUE');
    expect((await post('/api/vendas', { ...semEstoque, autorizacao: GERENTE })).status).toBe(201);
    expect(await estoque(piso)).toBe(-2500);
  });

  it('gerente vendendo não precisa digitar a própria senha', async () => {
    expect((await post('/api/vendas', venda({ descontoGeral: 800 }), gerente)).status).toBe(201);
  });
});

describe('Boleto', () => {
  let cliente: number;
  const vencimento = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const noBoleto = (c?: number) =>
    venda({ clienteId: c, itens: [{ produtoId: cimento, quantidade: 1000 }], pagamentos: [{ forma: 'BOLETO', valor: 3990, parcelas: 3, primeiroVencimento: vencimento }] });

  it('exige cliente com CPF/CNPJ', async () => {
    expect((await post('/api/vendas', noBoleto())).body.message).toMatch(/cliente/);
    const semDoc = (await post('/api/clientes', { nome: 'José da Obra' })).body.id;
    expect((await post('/api/vendas', noBoleto(semDoc))).body.message).toMatch(/CPF/);
    cliente = (await post('/api/clientes', { nome: 'Maria Construtora', documento: '529.982.247-25' })).body.id;
  });

  it('gera as parcelas, que somam o total e vencem a cada 30 dias', async () => {
    const r = await post('/api/vendas', noBoleto(cliente));
    expect(r.status).toBe(201);
    expect(r.body.boletos.map((b: { valor: number }) => b.valor)).toEqual([1330, 1330, 1330]);
    const [b1, b2] = r.body.boletos.map((b: { vencimento: string }) => new Date(b.vencimento).getTime());
    expect(Math.round((b2 - b1) / 864e5)).toBe(30);
  });

  it('financeiro dá baixa; vendedor não acessa', async () => {
    expect((await get('/api/boletos')).status).toBe(403);
    const lista = await get('/api/boletos', financeiro);
    expect(lista.body.totalAberto).toBe(3990);
    const id = lista.body.itens[0].id;
    await post(`/api/boletos/${id}/baixar`, { valorPago: 1330, pagoEm: new Date().toISOString().slice(0, 10) }, financeiro).expect(201);
    expect((await get('/api/boletos', financeiro)).body.totalAberto).toBe(2660);
  });

  it('não cancela venda com boleto já pago', async () => {
    const venda = (await get('/api/vendas?status=FINALIZADA', admin)).body.itens.find((v: { pagamentos: { forma: string }[] }) => v.pagamentos.some((p) => p.forma === 'BOLETO'));
    const r = await post(`/api/vendas/${venda.id}/cancelar`, { motivo: 'Cliente desistiu', autorizacao: GERENTE });
    expect(r.status).toBe(400);
  });
});

describe('Orçamento', () => {
  let orcamento: number;

  it('salva orçamento sem mexer em estoque nem caixa', async () => {
    const antes = await estoque(cimento);
    const r = await post('/api/vendas', { finalizar: false, itens: [{ produtoId: cimento, quantidade: 2000 }] });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('ORCAMENTO');
    expect(r.body.validoAte).toBeTruthy();
    orcamento = r.body.id;
    expect(await estoque(cimento)).toBe(antes);
  });

  it('ao virar venda dentro da validade, mantém o preço prometido', async () => {
    const p = (await get(`/api/produtos/${cimento}`, admin)).body;
    await t.http().patch(`/api/produtos/${cimento}`).set(XHR).set('Cookie', admin)
      .send({ descricao: p.descricao, unidadeId: p.unidadeId, custo: p.custo, precoVenda: 4500 }).expect(200);
    const r = await post('/api/vendas', venda({ orcamentoId: orcamento }));
    expect(r.status).toBe(201);
    expect(r.body.itens[0].precoUnitario).toBe(3990);
    expect((await get(`/api/vendas/${orcamento}`)).body.status).toBe('CONVERTIDO');
    expect((await post('/api/vendas', venda({ orcamentoId: orcamento }))).status).toBe(400);
  });
});

describe('Cancelamento', () => {
  it('até o limite, o vendedor cancela; estoque e caixa voltam', async () => {
    const v = (await post('/api/vendas', venda({ pagamentos: [{ forma: 'DINHEIRO', valor: 9000 }] }))).body;
    const antes = await estoque(cimento);
    const r = await post(`/api/vendas/${v.id}/cancelar`, { motivo: 'Cliente desistiu' });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('CANCELADA');
    expect(await estoque(cimento)).toBe(antes + 2000);
  });

  it('acima do limite, precisa do gerente', async () => {
    const v = (await post('/api/vendas', venda({ itens: [{ produtoId: cimento, quantidade: 3000 }], pagamentos: [{ forma: 'PIX', valor: 13500 }] }))).body;
    expect(v.total).toBe(13500);
    const r = await post(`/api/vendas/${v.id}/cancelar`, { motivo: 'Produto errado' });
    expect(r.status).toBe(403);
    expect(r.body.motivos[0].tipo).toBe('CANCELAMENTO');
    expect((await post(`/api/vendas/${v.id}/cancelar`, { motivo: 'Produto errado', autorizacao: GERENTE })).status).toBe(201);
  });
});

describe('Fechamento de caixa', () => {
  it('vendedor só vê as próprias vendas', async () => {
    const r = await get('/api/vendas');
    expect(r.body.itens.every((v: { vendedor: { nome: string } }) => v.vendedor.nome === 'vendedor')).toBe(true);
  });

  it('enquanto aberto, o operador não vê o valor esperado (conferência cega)', async () => {
    const r = await get('/api/caixa/atual');
    expect(r.body.sessao.status).toBe('ABERTO');
    expect(r.body.sessao).not.toHaveProperty('esperado');
  });

  it('sangria não pode passar do dinheiro em caixa', async () => {
    expect((await post('/api/caixa/movimentos', { tipo: 'SANGRIA', valor: 99999999, motivo: 'Teste' })).status).toBe(400);
    await post('/api/caixa/movimentos', { tipo: 'SANGRIA', valor: 5000, motivo: 'Depósito no banco' }).expect(201);
  });

  it('fecha comparando o informado com o esperado', async () => {
    const r = await post('/api/caixa/fechar', { informado: { DINHEIRO: 0, PIX: 0, DEBITO: 0, CREDITO: 0 }, observacao: null });
    expect(r.status).toBe(201);
    const dinheiro = r.body.fechamento.find((f: { forma: string }) => f.forma === 'DINHEIRO');
    // fundo + vendas em dinheiro (já sem troco) − venda cancelada − sangria
    const vendasDinheiro = 7980 /* simples */ + 2980 /* mista */ + 7180 /* c/ desconto */ + 3890 /* 1 SC − R$1 */ + 7980 /* orçamento */ + 9000; /* cancelada */
    expect(dinheiro.esperado).toBe(10000 + vendasDinheiro - 9000 - 5000);
    const pix = r.body.fechamento.find((f: { forma: string }) => f.forma === 'PIX');
    expect(pix.esperado).toBe(5000 + 13500 - 13500);
    expect(dinheiro.diferenca).toBe(-dinheiro.esperado);
    expect(r.body.totais.boletos).toBe(3990);
    expect((await get('/api/caixa/atual')).body).toEqual({ sessao: null });
  });
});

describe('Proteção da senha do gerente', () => {
  it('5 senhas erradas na autorização bloqueiam o gerente', async () => {
    await post('/api/caixa/abrir', { fundoTroco: 0 }).expect(201);
    for (let i = 0; i < 5; i++) await post('/api/vendas', venda({ descontoGeral: 800, autorizacao: { ...GERENTE, senha: 'chute' } }));
    const r = await post('/api/vendas', venda({ descontoGeral: 800, autorizacao: GERENTE }));
    expect(r.status).toBe(403);
    expect(r.body.message).toMatch(/bloqueado/);
  });
});
