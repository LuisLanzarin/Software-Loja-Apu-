# Gestão da Loja

Sistema local de controle de vendas, estoque e caixa para uma loja de materiais de construção.
Roda em um computador da loja e é acessado pelo navegador (até ~4 PCs na rede local).

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 22 + NestJS 11 |
| Banco | SQLite (arquivo `apps/api/data/loja.db`) via Prisma 7 |
| Frontend | React 19 + Vite + Tailwind CSS 4 + TanStack Query |
| Segurança | Argon2id, sessão em cookie httpOnly/SameSite=Strict, CSRF, Helmet, rate limit |

Convenções do banco: **dinheiro em centavos** e **quantidades em milésimos** (inteiros), percentuais em pontos-base (1% = 100).

## Instalação no Windows (PC principal)

1. Instale o [Node.js 22 LTS](https://nodejs.org) (versão "LTS", opções padrão).
2. Copie esta pasta para o PC, por exemplo `C:\GestaoLoja`.
3. Dê dois cliques em **`instalar.bat`** e espere terminar.
4. Clique com o botão direito em **`instalar-servico.bat`** → **Executar como administrador**.
   O sistema passa a iniciar sozinho quando o computador liga e libera a porta 3000 no Firewall.
5. Abra `http://localhost:3000`. Na primeira vez, cadastre o nome da loja e o administrador.

**Outros PCs da loja:** abra no navegador `http://IP-DO-PC-PRINCIPAL:3000`.
O IP aparece no log em `logs\` (ou rode `ipconfig` no PC principal). Vale fixar esse IP no roteador.

**Sem o serviço:** dá para usar `iniciar.bat` (a janela precisa ficar aberta).
**Remover o serviço:** `remover-servico.bat` como administrador.

### Atualizar para uma nova versão

1. Pare o serviço (`remover-servico.bat`) ou feche o `iniciar.bat`.
2. Substitua os arquivos pela nova versão, **mantendo** `apps\api\data\`, `apps\api\.env` e `backups\`.
3. Rode `instalar.bat` e depois `instalar-servico.bat`. As mudanças no banco são aplicadas sozinhas.

### Backup

- Automático todo dia a partir das 21h (configurável). Se o PC estava desligado, faz ao ligar.
- Ficam em `backups\` e, se configurada, numa **pasta extra** (pen drive, Google Drive ou OneDrive):
  configure em **Backup**, no menu do administrador.
- Cada backup é verificado depois de criado. Os dos últimos 30 dias são mantidos, e os 7 mais recentes nunca são apagados.
- **Restaurar:** menu Backup → Restaurar. Antes, o sistema guarda uma cópia do banco atual e depois reinicia sozinho.
- Para restaurar um backup trazido de outro lugar, copie o arquivo `loja_....db` para a pasta `backups\` e ele aparece na lista.

## Desenvolvimento

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:migrate
npm run dev        # API em :3000 e telas em :5173 (com recarga automática)
npm test           # testes de ponta a ponta da API
```

Alterou o `schema.prisma`? Rode `npm run db:migrate:dev -w api -- --name descricao`.

## Formação de preço

Markup divisor: `preço = custo ÷ (1 − impostos − despesas fixas − comissão − margem)`.
A margem desejada vem do produto; se estiver em branco, da categoria; senão, a padrão da loja.
Exemplo: custo R$ 30,00, 8% + 12% + 2% e margem 15% → R$ 47,62, que deixa exatamente 15% líquidos.

## Estoque

- O saldo nunca é editado direto: toda alteração é uma **movimentação** (compra, perda, ajuste, inventário, venda),
  gravada na mesma transação que atualiza o saldo. O saldo é sempre a soma das movimentações.
- **Custo médio ponderado** recalculado a cada entrada, já com frete, despesas e desconto rateados pelo valor dos itens.
- Notas em unidade de compra (CX, RL…) são convertidas para a unidade de venda pelo fator do cadastro.
- Cancelar uma entrada desfaz o saldo e o custo, e só é permitido se o material ainda estiver em estoque.

## Vendas e caixa

- O preço vem sempre do cadastro (ou do orçamento, dentro da validade); a tela não consegue mandar outro preço.
- **Pedem a senha do gerente:** desconto acima do limite, venda sem estoque e cancelamento acima do valor configurado.
  Gerente/Admin vendendo não precisam digitar a própria senha. A autorização fica registrada na venda e na auditoria,
  e senha errada conta para o bloqueio do gerente.
- Pagamento misto (dinheiro, PIX, débito, crédito parcelado, boleto). Troco só no dinheiro.
- Boleto exige cliente com CPF/CNPJ e gera as parcelas a receber. O sistema não emite o boleto no banco.
- Fechamento com **conferência cega**: o operador informa o que contou antes de ver o valor do sistema.
- Comprovante não fiscal para impressora de bobina (80 mm) ou A4.

## Relatórios

- **Fechamento de vendas** por dia, semana ou mês: faturamento, descontos, custo, lucro bruto, margem, ticket médio,
  formas de pagamento, vendedores e cancelamentos. O "resultado estimado" desconta os percentuais da formação de preço.
- **Curva ABC** de produtos (A = itens até 80% do faturamento acumulado, B = até 95%, C = o resto) e resultado por categoria.
- **Caixas**: diferenças de conferência por operador e forma de pagamento.
- Tudo exporta para Excel (CSV). O custo usado é o custo médio **no momento da venda**.

## Perfis

| Permissão | Vendedor | Financeiro | Gerente | Admin |
|---|:-:|:-:|:-:|:-:|
| Consultar produtos e preço de venda | ✅ | ✅ | ✅ | ✅ |
| Ver custo, margem e fornecedores | | ✅ | ✅ | ✅ |
| Cadastrar produtos, fornecedores, categorias e unidades | | ✅ | ✅ | ✅ |
| Formação de preço e reajuste em lote | | ✅ | ✅ | ✅ |
| Consultar saldo e movimentações de estoque | ✅ | ✅ | ✅ | ✅ |
| Lançar entrada de mercadoria | | ✅ | ✅ | ✅ |
| Ajustes, perdas, inventário e cancelar entrada | | | ✅ | ✅ |
| Vender, fazer orçamento e operar o próprio caixa | ✅ | | ✅ | ✅ |
| Ver vendas e caixas de todos | | ✅ | ✅ | ✅ |
| Cadastrar clientes | ✅ | ✅ | ✅ | ✅ |
| Dar baixa em boletos | | ✅ | ✅ | ✅ |
| Relatórios | | ✅ | ✅ | ✅ |
| Backup e restauração | | | | ✅ |
| Autorizar desconto/cancelamento acima do limite | | | ✅ | ✅ |
| Editar configurações | | | ✅ | ✅ |
| Ver auditoria | | | ✅ | ✅ |
| Gerenciar usuários | | | | ✅ |

A matriz fica em `apps/api/src/common/permissoes.ts`.

## Etapas

- [x] 1. Login, usuários, perfis, configurações e auditoria
- [x] 2. Produtos, fornecedores e formação de preço
- [x] 3. Entrada de mercadoria e controle de estoque
- [x] 4. Vendas, orçamentos e caixa
- [x] 5. Relatórios de fechamento, backup automático e instalação como serviço do Windows
