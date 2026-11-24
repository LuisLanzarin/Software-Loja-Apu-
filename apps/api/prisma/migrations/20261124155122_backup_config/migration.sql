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
    "backupHora" INTEGER NOT NULL DEFAULT 21,
    "backupManterDias" INTEGER NOT NULL DEFAULT 30,
    "backupPastaExtra" TEXT,
    "atualizadoEm" DATETIME NOT NULL
);
INSERT INTO "new_Configuracao" ("atualizadoEm", "cancelamentoMaxSemAutorizacao", "comissaoPct", "descontoMaxSemAutorizacao", "despesasFixasPct", "id", "impostosPct", "margemPadraoPct", "nomeLoja", "sessaoInatividadeMin", "validadeOrcamentoDias") SELECT "atualizadoEm", "cancelamentoMaxSemAutorizacao", "comissaoPct", "descontoMaxSemAutorizacao", "despesasFixasPct", "id", "impostosPct", "margemPadraoPct", "nomeLoja", "sessaoInatividadeMin", "validadeOrcamentoDias" FROM "Configuracao";
DROP TABLE "Configuracao";
ALTER TABLE "new_Configuracao" RENAME TO "Configuracao";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
