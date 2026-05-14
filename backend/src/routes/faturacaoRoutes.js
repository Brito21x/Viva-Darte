/**
 * @fileoverview Rotas de Faturação Mensal.
 * @description Define os endpoints para consulta de faturas, registo de pagamentos manuais e cancelamentos.
 */

const express = require("express");
const router = express.Router();
const faturacaoCtrl = require("../controllers/faturacaoController");
const { autenticar, autorizar } = require("../middlewares/auth");

/**
 * @route GET /api/faturacao/faturacao
 * @description Lista faturas com filtros opcionais de ano, mês e estado de pagamento.
 * @access Protegido
 */
router.get("/faturacao", autenticar, faturacaoCtrl.getFaturas);

/**
 * @route GET /api/faturacao/faturacao/resumo
 * @description Devolve os totais agregados e contagens estatísticas para os StatCards do dashboard.
 * @access Protegido
 */
router.get("/faturacao/resumo", autenticar, faturacaoCtrl.getResumo);

/**
 * @route GET /api/faturacao/faturacao/precos
 * @description Lista a tabela com todas as regras e tarifários de preços configurados no sistema.
 * @access Protegido
 */
router.get("/faturacao/precos", autenticar, faturacaoCtrl.listarPrecos);

/**
 * @route PUT /api/faturacao/faturacao/precos/:id
 * @description Atualiza o valor de uma regra de preço ou altera o seu estado (ativo/inativo).
 * @access Protegido
 */
router.put(
  "/faturacao/precos/:id",
  autenticar,
  faturacaoCtrl.atualizarRegraPreco,
);

/**
 * @route GET /api/faturacao/faturacao/:id
 * @description Consulta o cabeçalho e detalhe base de uma fatura específica.
 * @access Protegido
 */
router.get("/faturacao/:id", autenticar, faturacaoCtrl.getFaturaPorId);

/**
 * @route GET /api/faturacao/faturacao/:id/linhas
 * @description Devolve o detalhe aprofundado de uma fatura, incluindo a lista de aulas (coachings) associadas.
 * @access Protegido
 */
router.get("/faturacao/:id/linhas", autenticar, faturacaoCtrl.getLinhasFatura);

/**
 * @route PUT /api/faturacao/faturacao/:id/pagamento
 * @description Marca uma fatura como paga, registando o método e a data de pagamento.
 * @access Protegido
 */
router.put(
  "/faturacao/:id/pagamento",
  autenticar,
  faturacaoCtrl.registarPagamento,
);

/**
 * @route PUT /api/faturacao/faturacao/:id/cancelar
 * @description Cancela formalmente uma fatura do sistema (se ainda estiver no estado Pendente).
 * @access Protegido
 */
router.put("/faturacao/:id/cancelar", autenticar, faturacaoCtrl.cancelarFatura);

/**
 * @module faturacaoRoutes
 */
module.exports = router;
