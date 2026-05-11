/**
 * @fileoverview Rotas do Inventário, Empréstimos e Mercado de Vendas.
 * Este ficheiro mapeia os endpoints da API relacionados com a gestão física
 * das peças de vestuário/figurinos, abrangendo o catálogo geral, ciclo de
 * empréstimos, devoluções, penalizações e transações do mercado de segunda mão.
 */

const express = require("express");
const router = express.Router();

const inventarioController = require("../controllers/inventarioController");
const { autenticar, autorizar } = require("../middlewares/auth");

// ============================================================================
// MIDDLEWARE GLOBAL DA ROTA
// ============================================================================
// Aplica a verificação de token JWT a TODAS as rotas declaradas abaixo.
// Garante que o Catálogo e o Mercado são exclusivos para a comunidade escolar registada.
router.use(autenticar);

// ============================================================================
// CATÁLOGO E GESTÃO BASE DE PEÇAS
// ============================================================================

/**
 * [PROTEGIDO] Obtém a lista de todas as peças disponíveis no inventário da escola.
 * GET /api/inventario/
 */
router.get("/", inventarioController.getCatalogo);

/**
 * [PROTEGIDO] Obtém especificamente as peças que se encontram anunciadas no mercado de vendas.
 * GET /api/inventario/vendas
 */
router.get("/vendas", inventarioController.getPecasAVenda);

/**
 * [PROTEGIDO] Obtém os detalhes completos de uma peça específica e a respetiva galeria de fotografias.
 * GET /api/inventario/:id
 */
router.get("/:id", inventarioController.getPecaDetalhes);

/**
 * [PROTEGIDO] Regista uma nova peça no sistema (pode ser configurada logo para empréstimo/venda).
 * POST /api/inventario/
 */
router.post("/", inventarioController.registarPeca);

/**
 * [PROTEGIDO] Atualiza configurações operacionais da peça (estado físico, disponibilidade e localização).
 * PUT /api/inventario/:id
 */
router.put("/:id", inventarioController.atualizarEstadoPeca);

// ============================================================================
// CICLO DE EMPRÉSTIMOS
// ============================================================================

/**
 * [PROTEGIDO] Efetua um novo pedido de requisição/empréstimo de peças.
 * POST /api/inventario/emprestimos
 */
router.post("/emprestimos", inventarioController.requisitarEmprestimo);

/**
 * [PROTEGIDO] Regista a devolução física de peças, incluindo a avaliação do estado de entrega.
 * PUT /api/inventario/emprestimos/:id/devolucao
 */
router.put(
  "/emprestimos/:id/devolucao",
  inventarioController.registarDevolucao,
);

/**
 * [PROTEGIDO] Aplica multas ou penalizações financeiras a um empréstimo (ex: Atraso, Dano, Perda).
 * POST /api/inventario/emprestimos/:id/penalizacoes
 */
router.post(
  "/emprestimos/:id/penalizacoes",
  inventarioController.registarPenalizacao,
);

/**
 * [PROTEGIDO] Regista o pagamento de taxas ou multas associadas a um empréstimo.
 * PUT /api/inventario/emprestimos/:id/pagamento
 */
router.put(
  "/emprestimos/:id/pagamento",
  inventarioController.registarPagamentoEmprestimo,
);

// ============================================================================
// MERCADO DE VENDAS E EDIÇÃO AVANÇADA
// ============================================================================

/**
 * [PROTEGIDO] Promove uma peça existente no inventário para o mercado de vendas (cria anúncio).
 * POST /api/inventario/vendas
 */
router.post("/vendas", inventarioController.colocarPecaAVenda);

/**
 * [PROTEGIDO] Finaliza uma venda, registando o comprador e o método de pagamento recebido.
 * PUT /api/inventario/vendas/:id/concluir
 */
router.put("/vendas/:id/concluir", inventarioController.registarConclusaoVenda);

/**
 * [PROTEGIDO] Edição global de uma peça (altera nome, descrição, preços e substitui fotografias).
 * PUT /api/inventario/:id/editar
 */
router.put("/:id/editar", inventarioController.editarPeca);

/**
 * [PROTEGIDO] Apaga permanentemente uma peça do sistema (eliminação em cascata de histórico e fotos).
 * DELETE /api/inventario/:id
 */
router.delete("/:id", inventarioController.apagarPeca);

module.exports = router;
