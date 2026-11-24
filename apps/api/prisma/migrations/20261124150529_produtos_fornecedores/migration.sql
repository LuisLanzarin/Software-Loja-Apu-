-- CreateTable
CREATE TABLE "Unidade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fracionavel" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "margemPct" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "contato" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "prazoEntregaDias" INTEGER,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "descricao" TEXT NOT NULL,
    "descricaoBusca" TEXT NOT NULL,
    "marca" TEXT,
    "categoriaId" INTEGER,
    "unidadeId" INTEGER NOT NULL,
    "custo" INTEGER NOT NULL DEFAULT 0,
    "precoVenda" INTEGER NOT NULL DEFAULT 0,
    "margemPct" INTEGER,
    "estoqueMinimo" INTEGER NOT NULL DEFAULT 0,
    "localizacao" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Produto_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProdutoConversao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produtoId" INTEGER NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "fator" INTEGER NOT NULL,
    CONSTRAINT "ProdutoConversao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProdutoConversao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProdutoFornecedor" (
    "produtoId" INTEGER NOT NULL,
    "fornecedorId" INTEGER NOT NULL,
    "codigoFornecedor" TEXT,

    PRIMARY KEY ("produtoId", "fornecedorId"),
    CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoricoPreco" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produtoId" INTEGER NOT NULL,
    "custoAnterior" INTEGER NOT NULL,
    "custoNovo" INTEGER NOT NULL,
    "precoAnterior" INTEGER NOT NULL,
    "precoNovo" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoricoPreco_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoricoPreco_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuracao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nomeLoja" TEXT NOT NULL DEFAULT 'Minha Loja',
    "descontoMaxSemAutorizacao" INTEGER NOT NULL DEFAULT 500,
    "cancelamentoMaxSemAutorizacao" INTEGER NOT NULL DEFAULT 10000,
    "sessaoInatividadeMin" INTEGER NOT NULL DEFAULT 30,
    "impostosPct" INTEGER NOT NULL DEFAULT 600,
    "despesasFixasPct" INTEGER NOT NULL DEFAULT 1500,
    "comissaoPct" INTEGER NOT NULL DEFAULT 0,
    "margemPadraoPct" INTEGER NOT NULL DEFAULT 2000,
    "atualizadoEm" DATETIME NOT NULL
);
INSERT INTO "new_Configuracao" ("atualizadoEm", "cancelamentoMaxSemAutorizacao", "descontoMaxSemAutorizacao", "id", "nomeLoja", "sessaoInatividadeMin") SELECT "atualizadoEm", "cancelamentoMaxSemAutorizacao", "descontoMaxSemAutorizacao", "id", "nomeLoja", "sessaoInatividadeMin" FROM "Configuracao";
DROP TABLE "Configuracao";
ALTER TABLE "new_Configuracao" RENAME TO "Configuracao";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Unidade_sigla_key" ON "Unidade"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_documento_key" ON "Fornecedor"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigo_key" ON "Produto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigoBarras_key" ON "Produto"("codigoBarras");

-- CreateIndex
CREATE INDEX "Produto_descricaoBusca_idx" ON "Produto"("descricaoBusca");

-- CreateIndex
CREATE INDEX "Produto_categoriaId_idx" ON "Produto"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoConversao_produtoId_unidadeId_key" ON "ProdutoConversao"("produtoId", "unidadeId");

-- CreateIndex
CREATE INDEX "ProdutoFornecedor_fornecedorId_idx" ON "ProdutoFornecedor"("fornecedorId");

-- CreateIndex
CREATE INDEX "HistoricoPreco_produtoId_criadoEm_idx" ON "HistoricoPreco"("produtoId", "criadoEm");

-- Unidades mais comuns em materiais de construção
INSERT INTO "Unidade" ("sigla", "nome", "fracionavel") VALUES
  ('UN', 'Unidade', false),
  ('PC', 'Peça', false),
  ('CX', 'Caixa', false),
  ('SC', 'Saco', false),
  ('PCT', 'Pacote', false),
  ('RL', 'Rolo', false),
  ('BR', 'Barra', false),
  ('GL', 'Galão', false),
  ('LT', 'Lata', false),
  ('PAR', 'Par', false),
  ('M', 'Metro', true),
  ('M2', 'Metro quadrado', true),
  ('M3', 'Metro cúbico', true),
  ('KG', 'Quilo', true),
  ('L', 'Litro', true),
  ('MIL', 'Milheiro', true);
