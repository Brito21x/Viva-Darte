const express = require("express");
const router = express.Router();
const faturacaoCtrl = require("../controllers/faturacaoController");
const { autenticar, autorizar } = require("../middlewares/auth");

router.get("/faturacao", autenticar, faturacaoCtrl.getFaturas);
router.get("/faturacao/resumo", autenticar, faturacaoCtrl.getResumo);

router.get("/faturacao/precos", autenticar, faturacaoCtrl.listarPrecos);
router.put(
  "/faturacao/precos/:id",
  autenticar,
  faturacaoCtrl.atualizarRegraPreco,
);
router.get("/faturacao/:id", autenticar, faturacaoCtrl.getFaturaPorId);
router.get("/faturacao/:id/linhas", autenticar, faturacaoCtrl.getLinhasFatura);
router.put(
  "/faturacao/:id/pagamento",
  autenticar,
  faturacaoCtrl.registarPagamento,
);
router.put("/faturacao/:id/cancelar", autenticar, faturacaoCtrl.cancelarFatura);

module.exports = router;
