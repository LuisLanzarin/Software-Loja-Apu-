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
    "taxaServicoPct" INTEGER NOT NULL DEFAULT 1000,
    "taxaServicoPadrao" BOOLEAN NOT NULL DEFAULT true,
    "backupHora" INTEGER NOT NULL DEFAULT 21,
    "backupManterDias" INTEGER NOT NULL DEFAULT 30,
    "backupPastaExtra" TEXT,
    "atualizadoEm" DATETIME NOT NULL
);
INSERT INTO "new_Configuracao" ("atualizadoEm", "backupHora", "backupManterDias", "backupPastaExtra", "cancelamentoMaxSemAutorizacao", "comissaoPct", "descontoMaxSemAutorizacao", "despesasFixasPct", "id", "impostosPct", "margemPadraoPct", "nomeLoja", "sessaoInatividadeMin", "validadeOrcamentoDias") SELECT "atualizadoEm", "backupHora", "backupManterDias", "backupPastaExtra", "cancelamentoMaxSemAutorizacao", "comissaoPct", "descontoMaxSemAutorizacao", "despesasFixasPct", "id", "impostosPct", "margemPadraoPct", "nomeLoja", "sessaoInatividadeMin", "validadeOrcamentoDias" FROM "Configuracao";
DROP TABLE "Configuracao";
ALTER TABLE "new_Configuracao" RENAME TO "Configuracao";
CREATE TABLE "new_Venda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL,
    "clienteId" INTEGER,
    "vendedorId" INTEGER NOT NULL,
    "caixaSessaoId" INTEGER,
    "orcamentoOrigemId" INTEGER,
    "subtotal" INTEGER NOT NULL,
    "descontoItens" INTEGER NOT NULL DEFAULT 0,
    "descontoGeral" INTEGER NOT NULL DEFAULT 0,
    "taxaServico" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_Venda" ("autorizadoPorId", "caixaSessaoId", "canceladaEm", "canceladaPorId", "cancelamentoAutorizadoPorId", "clienteId", "criadoEm", "descontoGeral", "descontoItens", "finalizadaEm", "id", "motivoCancelamento", "motivosAutorizacao", "observacoes", "orcamentoOrigemId", "status", "subtotal", "total", "troco", "validoAte", "vendedorId") SELECT "autorizadoPorId", "caixaSessaoId", "canceladaEm", "canceladaPorId", "cancelamentoAutorizadoPorId", "clienteId", "criadoEm", "descontoGeral", "descontoItens", "finalizadaEm", "id", "motivoCancelamento", "motivosAutorizacao", "observacoes", "orcamentoOrigemId", "status", "subtotal", "total", "troco", "validoAte", "vendedorId" FROM "Venda";
DROP TABLE "Venda";
ALTER TABLE "new_Venda" RENAME TO "Venda";
CREATE UNIQUE INDEX "Venda_orcamentoOrigemId_key" ON "Venda"("orcamentoOrigemId");
CREATE INDEX "Venda_status_criadoEm_idx" ON "Venda"("status", "criadoEm");
CREATE INDEX "Venda_finalizadaEm_idx" ON "Venda"("finalizadaEm");
CREATE INDEX "Venda_vendedorId_idx" ON "Venda"("vendedorId");
CREATE INDEX "Venda_clienteId_idx" ON "Venda"("clienteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Unidades comuns em restaurante (só cria as que ainda não existem)
INSERT INTO "Unidade" ("sigla", "nome", "fracionavel")
SELECT v.sigla, v.nome, v.fracionavel FROM (
  SELECT 'G' AS sigla, 'Grama' AS nome, 1 AS fracionavel
  UNION ALL SELECT 'ML', 'Mililitro', 1
  UNION ALL SELECT 'FD', 'Fardo', 0
  UNION ALL SELECT 'GRF', 'Garrafa', 0
  UNION ALL SELECT 'PORC', 'Porção', 0
  UNION ALL SELECT 'DZ', 'Dúzia', 0
) AS v
WHERE NOT EXISTS (SELECT 1 FROM "Unidade" u WHERE u."sigla" = v.sigla);

-- Desativa unidades de material de construção que nenhum produto usa (continuam no banco)
UPDATE "Unidade" SET "ativo" = 0
WHERE "sigla" IN ('M', 'M2', 'M3', 'BR', 'RL', 'MIL', 'PAR')
  AND "id" NOT IN (SELECT "unidadeId" FROM "Produto")
  AND "id" NOT IN (SELECT "unidadeId" FROM "ProdutoConversao");
