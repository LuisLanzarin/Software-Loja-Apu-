-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produtoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "saldoApos" INTEGER NOT NULL,
    "custoUnitario" INTEGER NOT NULL,
    "motivo" TEXT,
    "entradaId" INTEGER,
    "usuarioId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoEstoque_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "Entrada" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entrada" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornecedorId" INTEGER,
    "numeroNota" TEXT,
    "dataEmissao" DATETIME,
    "frete" INTEGER NOT NULL DEFAULT 0,
    "outrasDespesas" INTEGER NOT NULL DEFAULT 0,
    "desconto" INTEGER NOT NULL DEFAULT 0,
    "totalProdutos" INTEGER NOT NULL,
    "totalNota" INTEGER NOT NULL,
    "observacoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FINALIZADA',
    "usuarioId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladaEm" DATETIME,
    "canceladaPorId" INTEGER,
    "motivoCancelamento" TEXT,
    CONSTRAINT "Entrada_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Entrada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Entrada_canceladaPorId_fkey" FOREIGN KEY ("canceladaPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntradaItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entradaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "unidadeId" INTEGER NOT NULL,
    "fator" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "custoUnitario" INTEGER NOT NULL,
    "quantidadeEstoque" INTEGER NOT NULL,
    "custoTotal" INTEGER NOT NULL,
    "custoMedioAntes" INTEGER NOT NULL,
    "custoMedioDepois" INTEGER NOT NULL,
    CONSTRAINT "EntradaItem_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "Entrada" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntradaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntradaItem_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Produto" (
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
    "estoqueAtual" INTEGER NOT NULL DEFAULT 0,
    "localizacao" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Produto_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Produto" ("ativo", "atualizadoEm", "categoriaId", "codigo", "codigoBarras", "criadoEm", "custo", "descricao", "descricaoBusca", "estoqueMinimo", "id", "localizacao", "marca", "margemPct", "observacoes", "precoVenda", "unidadeId") SELECT "ativo", "atualizadoEm", "categoriaId", "codigo", "codigoBarras", "criadoEm", "custo", "descricao", "descricaoBusca", "estoqueMinimo", "id", "localizacao", "marca", "margemPct", "observacoes", "precoVenda", "unidadeId" FROM "Produto";
DROP TABLE "Produto";
ALTER TABLE "new_Produto" RENAME TO "Produto";
CREATE UNIQUE INDEX "Produto_codigo_key" ON "Produto"("codigo");
CREATE UNIQUE INDEX "Produto_codigoBarras_key" ON "Produto"("codigoBarras");
CREATE INDEX "Produto_descricaoBusca_idx" ON "Produto"("descricaoBusca");
CREATE INDEX "Produto_categoriaId_idx" ON "Produto"("categoriaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_produtoId_id_idx" ON "MovimentacaoEstoque"("produtoId", "id");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_criadoEm_idx" ON "MovimentacaoEstoque"("criadoEm");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_entradaId_idx" ON "MovimentacaoEstoque"("entradaId");

-- CreateIndex
CREATE INDEX "Entrada_criadoEm_idx" ON "Entrada"("criadoEm");

-- CreateIndex
CREATE INDEX "Entrada_fornecedorId_idx" ON "Entrada"("fornecedorId");
