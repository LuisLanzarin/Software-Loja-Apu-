import { gtinValido } from '../src/common/gtin';
import { margemReal, precoSugerido } from '../src/common/precificacao';
import { cnpjValido, cpfValido, normalizarBusca } from '../src/common/texto';

const par = { impostosPct: 800, despesasFixasPct: 1200, comissaoPct: 200 };

describe('Formação de preço (markup divisor)', () => {
  it('custo R$ 30,00 com 8% + 12% + 2% + margem 15% → R$ 47,62', () => {
    expect(precoSugerido(3000, 1500, par)).toBe(4762);
  });

  it('o preço sugerido devolve exatamente a margem desejada', () => {
    const preco = precoSugerido(3000, 1500, par)!;
    expect(margemReal(3000, preco, par)).toBe(1500);
  });

  it('detecta prejuízo (margem negativa)', () => {
    expect(margemReal(3000, 3000, par)).toBe(-2200);
  });

  it('não calcula preço quando os percentuais somam 100% ou mais', () => {
    expect(precoSugerido(3000, 7800, par)).toBeNull();
  });
});

describe('Documentos', () => {
  it('valida CNPJ numérico', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
  });
  it('valida CNPJ alfanumérico (padrão da Receita a partir de 07/2026)', () => {
    expect(cnpjValido('12ABC34501DE35')).toBe(true);
    expect(cnpjValido('12ABC34501DE36')).toBe(false);
  });
  it('valida CPF', () => {
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('52998224726')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
  });
});

describe('Código de barras', () => {
  it('aceita EAN-13 e EAN-8 válidos e recusa dígito errado', () => {
    expect(gtinValido('7891000315507')).toBe(true);
    expect(gtinValido('7891000315508')).toBe(false);
    expect(gtinValido('96385074')).toBe(true);
    expect(gtinValido('123')).toBe(false);
  });
});

describe('Busca', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(normalizarBusca('  Cimento  CP-II  Água ')).toBe('cimento cp-ii agua');
  });
});

import { custoMedio, custoMedioAposEstorno, ratear } from '../src/estoque/calculos';

describe('Estoque: custo médio ponderado', () => {
  it('pondera pelo saldo: 25 a R$ 30,23 + 10 a R$ 34,00 → R$ 31,31', () => {
    expect(custoMedio(25000, 3023, 10000, 3400)).toBe(3131);
  });
  it('estoque zerado ou negativo: vale o custo da nova compra', () => {
    expect(custoMedio(0, 3000, 5000, 3500)).toBe(3500);
    expect(custoMedio(-2000, 3000, 5000, 3500)).toBe(3500);
  });
  it('estorno desfaz o efeito da entrada no custo', () => {
    expect(custoMedioAposEstorno(35000, 3131, 10000, 34000, 3023)).toBe(3023);
    expect(custoMedioAposEstorno(10000, 3400, 10000, 34000, 2900)).toBe(2900);
  });
});

describe('Estoque: rateio de frete e desconto', () => {
  it('distribui proporcionalmente e a soma bate exatamente', () => {
    const r = ratear([75000, 56000], 1000);
    expect(r).toEqual([572, 428]);
    expect(ratear([333, 333, 334], 100).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('desconto (valor negativo) também é rateado', () => {
    expect(ratear([5000, 5000], -1001).reduce((a, b) => a + b, 0)).toBe(-1001);
  });
});
