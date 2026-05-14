/**
 * @fileoverview Rotas do Inventário, Empréstimos e Mercado de Vendas.
 * @description Este ficheiro mapeia os endpoints da API relacionados com a gestão física
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
 * @route GET /api/inventario/
 * @description Obtém a lista de todas as peças disponíveis no inventário da escola.
 * @access Protegido
 */
router.get("/", inventarioController.getCatalogo);

/**
 * @route GET /api/inventario/vendas
 * @description Obtém especificamente as peças que se encontram anunciadas no mercado de vendas.
 * @access Protegido
 */
router.get("/vendas", inventarioController.getPecasAVenda);

/**
 * @route GET /api/inventario/:id
 * @description Obtém os detalhes completos de uma peça específica e a respetiva galeria de fotografias.
 * @access Protegido
 */
router.get("/:id", inventarioController.getPecaDetalhes);

/**
 * @route POST /api/inventario/
 * @description Regista uma nova peça no sistema (pode ser configurada logo para empréstimo/venda).
 * @access Protegido
 */
router.post("/", inventarioController.registarPeca);

/**
 * @route PUT /api/inventario/:id
 * @description Atualiza configurações operacionais da peça (estado físico, disponibilidade e localização).
 * @access Protegido
 */
router.put("/:id", inventarioController.atualizarEstadoPeca);

// ============================================================================
// CICLO DE EMPRÉSTIMOS
// ============================================================================

/**
 * @route POST /api/inventario/emprestimos
 * @description Efetua um novo pedido de requisição/empréstimo de peças.
 * @access Protegido
 */
router.post("/emprestimos", inventarioController.requisitarEmprestimo);

/**
 * @route PUT /api/inventario/emprestimos/:id/devolucao
 * @description Regista a devolução física de peças, incluindo a avaliação do estado final de entrega.
 * @access Protegido
 */
router.put(
  "/emprestimos/:id/devolucao",
  inventarioController.registarDevolucao,
);

/**
 * @route POST /api/inventario/emprestimos/:id/penalizacoes
 * @description Aplica multas ou penalizações financeiras a um empréstimo (ex: Atraso, Dano, Perda).
 * @access Protegido
 */
router.post(
  "/emprestimos/:id/penalizacoes",
  inventarioController.registarPenalizacao,
);

/**
 * @route PUT /api/inventario/emprestimos/:id/pagamento
 * @description Regista o pagamento de taxas ou multas associadas a um empréstimo em curso/fechado.
 * @access Protegido
 */
router.put(
  "/emprestimos/:id/pagamento",
  inventarioController.registarPagamentoEmprestimo,
);

// ============================================================================
// MERCADO DE VENDAS E EDIÇÃO AVANÇADA
// ============================================================================

/**
 * @route POST /api/inventario/vendas
 * @description Promove uma peça existente no inventário para o mercado de vendas (cria anúncio).
 * @access Protegido
 */
router.post("/vendas", inventarioController.colocarPecaAVenda);

/**
 * @route PUT /api/inventario/vendas/:id/concluir
 * @description Finaliza uma venda, registando o comprador e o método de pagamento recebido da transação.
 * @access Protegido
 */
router.put("/vendas/:id/concluir", inventarioController.registarConclusaoVenda);

/**
 * @route PUT /api/inventario/:id/editar
 * @description Edição global de uma peça (altera nome, descrição, preços e substitui fotografias).
 * @access Protegido
 */
router.put("/:id/editar", inventarioController.editarPeca);

/**
 * @route DELETE /api/inventario/:id
 * @description Apaga permanentemente uma peça do sistema (eliminação em cascata de histórico de uso e fotos).
 * @access Protegido
 */
router.delete("/:id", inventarioController.apagarPeca);

/**
 * @module inventarioRoutes
 */
module.exports = router;
