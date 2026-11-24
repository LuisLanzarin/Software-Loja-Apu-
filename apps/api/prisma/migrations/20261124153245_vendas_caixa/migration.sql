-- CreateTable
CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "nomeBusca" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CaixaSessao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "fundoTroco" INTEGER NOT NULL,
    "abertoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" DATETIME,
    "observacao" TEXT,
    CONSTRAINT "CaixaSessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaixaMovimento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessaoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "forma" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" TEXT,
    "vendaId" INTEGER,
    "usuarioId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaixaMovimento_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "CaixaSessao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CaixaMovimento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CaixaMovimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaixaFechamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessaoId" INTEGER NOT NULL,
    "forma" TEXT NOT NULL,
    "esperado" INTEGER NOT NULL,
    "informado" INTEGER NOT NULL,
    "diferenca" INTEGER NOT NULL,
    CONSTRAINT "CaixaFechamento_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "CaixaSessao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL,
    "clienteId" INTEGER,
    "vendedorId" INTEGER NOT NULL,
    "caixaSessaoId" INTEGER,
    "orcamentoOrigemId" INTEGER,
    "subtotal" INTEGER NOT NULL,
    "descontoItens" INTEGER NOT NULL DEFAULT 0,
    "descontoGeral" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "troco" INTEGER NOT NULL DEFAULT 0,
    "validoAte" DATETIME,
    "observacoes" TEXT,
    "autorizadoPorId" INTEGER,
    "motivosAutorizacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" DATETIME,
    "canceladaEm" DATETIME,
    "canceladaPorId" INTEGER,
    "motivoCancelamento" TEXT,
    "cancelamentoAutorizadoPorId" INTEGER,
    CONSTRAINT "Venda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venda_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Venda_caixaSessaoId_fkey" FOREIGN KEY ("caixaSessaoId") REFERENCES "CaixaSessao" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venda_orcamentoOrigemId_fkey" FOREIGN KEY ("orcamentoOrigemId") REFERENCES "Venda" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venda_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Venda_canceladaPorId_fkey" FOREIGN KEY ("canceladaPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendaItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vendaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidadeSigla" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" INTEGER NOT NULL,
    "desconto" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "custoUnitario" INTEGER NOT NULL,
    CONSTRAINT "VendaItem_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendaItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendaPagamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vendaId" INTEGER NOT NULL,
    "forma" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "VendaPagamento_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContaReceber" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vendaId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "parcela" INTEGER NOT NULL,
    "totalParcelas" INTEGER NOT NULL,
    "valor" INTEGER NOT NULL,
    "vencimento" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "pagoEm" DATETIME,
    "valorPago" INTEGER,
    "baixadoPorId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContaReceber_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContaReceber_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContaReceber_baixadoPorId_fkey" FOREIGN KEY ("baixadoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "validadeOrcamentoDias" INTEGER NOT NULL DEFAULT 7,
    "atualizadoEm" DATETIME NOT NULL
);
INSERT INTO "new_Configuracao" ("atualizadoEm", "cancelamentoMaxSemAutorizacao", "comissaoPct", "descontoMaxSemAutorizacao", "despesasFixasPct", "id", "impostosPct", "margemPadraoPct", "nomeLoja", "sessaoInatividadeMin") SELECT "atualizadoEm", "cancelamentoMaxSemAutorizacao", "comissaoPct", "descontoMaxSemAutorizacao", "despesasFixasPct", "id", "impostosPct", "margemPadraoPct", "nomeLoja", "sessaoInatividadeMin" FROM "Configuracao";
DROP TABLE "Configuracao";
ALTER TABLE "new_Configuracao" RENAME TO "Configuracao";
CREATE TABLE "new_MovimentacaoEstoque" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produtoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "saldoApos" INTEGER NOT NULL,
    "custoUnitario" INTEGER NOT NULL,
    "motivo" TEXT,
    "entradaId" INTEGER,
    "vendaId" INTEGER,
    "usuarioId" INTEGER,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoEstoque_entradaId_fkey" FOREIGN KEY ("entradaId") REFERENCES "Entrada" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoEstoque_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MovimentacaoEstoque" ("criadoEm", "custoUnitario", "entradaId", "id", "motivo", "produtoId", "quantidade", "saldoApos", "tipo", "usuarioId") SELECT "criadoEm", "custoUnitario", "entradaId", "id", "motivo", "produtoId", "quantidade", "saldoApos", "tipo", "usuarioId" FROM "MovimentacaoEstoque";
DROP TABLE "MovimentacaoEstoque";
ALTER TABLE "new_MovimentacaoEstoque" RENAME TO "MovimentacaoEstoque";
CREATE INDEX "MovimentacaoEstoque_produtoId_id_idx" ON "MovimentacaoEstoque"("produtoId", "id");
CREATE INDEX "MovimentacaoEstoque_criadoEm_idx" ON "MovimentacaoEstoque"("criadoEm");
CREATE INDEX "MovimentacaoEstoque_entradaId_idx" ON "MovimentacaoEstoque"("entradaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_documento_key" ON "Cliente"("documento");

-- CreateIndex
CREATE INDEX "Cliente_nomeBusca_idx" ON "Cliente"("nomeBusca");

-- CreateIndex
CREATE INDEX "CaixaSessao_usuarioId_status_idx" ON "CaixaSessao"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "CaixaSessao_abertoEm_idx" ON "CaixaSessao"("abertoEm");

-- CreateIndex
CREATE INDEX "CaixaMovimento_sessaoId_idx" ON "CaixaMovimento"("sessaoId");

-- CreateIndex
CREATE UNIQUE INDEX "CaixaFechamento_sessaoId_forma_key" ON "CaixaFechamento"("sessaoId", "forma");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_orcamentoOrigemId_key" ON "Venda"("orcamentoOrigemId");

-- CreateIndex
CREATE INDEX "Venda_status_criadoEm_idx" ON "Venda"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "Venda_finalizadaEm_idx" ON "Venda"("finalizadaEm");

-- CreateIndex
CREATE INDEX "Venda_vendedorId_idx" ON "Venda"("vendedorId");

-- CreateIndex
CREATE INDEX "Venda_clienteId_idx" ON "Venda"("clienteId");

-- CreateIndex
CREATE INDEX "ContaReceber_status_vencimento_idx" ON "ContaReceber"("status", "vencimento");

-- CreateIndex
CREATE INDEX "ContaReceber_clienteId_idx" ON "ContaReceber"("clienteId");
