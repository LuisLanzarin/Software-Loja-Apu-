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

1. Instale o [Node.js 22 LTS](https://nodejs.org).
2. Copie esta pasta para o PC (ex.: `C:\GestaoLoja`).
3. Execute `instalar.bat`.
4. Execute `iniciar.bat` e acesse `http://localhost:3000`.
5. Na primeira vez, o sistema pede o nome da loja e cria o usuário administrador.

**Outros PCs:** a janela do `iniciar.bat` mostra o endereço (ex.: `http://192.168.0.10:3000`).
Abra esse endereço no navegador dos outros computadores. Se não abrir, libere a porta 3000 no Firewall do Windows do PC principal.

> Por enquanto, faça backup copiando `apps\api\data\` com o sistema fechado. O backup automático vem na etapa 5.

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

## Perfis

| Permissão | Vendedor | Financeiro | Gerente | Admin |
|---|:-:|:-:|:-:|:-:|
| Consultar produtos e preço de venda | ✅ | ✅ | ✅ | ✅ |
| Ver custo, margem e fornecedores | | ✅ | ✅ | ✅ |
| Cadastrar produtos, fornecedores, categorias e unidades | | ✅ | ✅ | ✅ |
| Formação de preço e reajuste em lote | | ✅ | ✅ | ✅ |
| Autorizar desconto/cancelamento acima do limite | | | ✅ | ✅ |
| Editar configurações | | | ✅ | ✅ |
| Ver auditoria | | | ✅ | ✅ |
| Gerenciar usuários | | | | ✅ |

A matriz fica em `apps/api/src/common/permissoes.ts`.

## Etapas

- [x] 1. Login, usuários, perfis, configurações e auditoria
- [x] 2. Produtos, fornecedores e formação de preço
- [ ] 3. Entrada de mercadoria e controle de estoque
- [ ] 4. Vendas, orçamentos e caixa
- [ ] 5. Relatórios de fechamento, backup automático e instalação como serviço do Windows
