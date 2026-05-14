/**
 * @fileoverview Rotas do Módulo de Coaching.
 * @description Este ficheiro mapeia os endpoints da API referentes à gestão de aulas de coaching
 * (marcações extra-curriculares). Centraliza a proteção de rotas através da injeção
 * de middlewares de autenticação e de autorização baseada em perfis (RBAC - Role-Based Access Control).
 */

const express = require("express");
const router = express.Router();

const coachingController = require("../controllers/coachingController");
const { autenticar, autorizar } = require("../middlewares/auth");

// ============================================================================
// MIDDLEWARE GLOBAL DA ROTA
// ============================================================================
// Aplica a verificação de token JWT a TODAS as rotas declaradas abaixo.
// Impede imediatamente acessos anónimos.
router.use(autenticar);

// ============================================================================
// DISPONIBILIDADES (Exclusivo Professor)
// ============================================================================

/**
 * @route GET /api/coaching/disponibilidades
 * @description Obtém a lista de horários de disponibilidade do professor autenticado.
 * @access Protegido (Professor)
 */
router.get(
  "/disponibilidades",
  autorizar("Professor"),
  coachingController.getDisponibilidades,
);

/**
 * @route POST /api/coaching/disponibilidades
 * @description Regista um novo bloco de disponibilidade na agenda do professor.
 * @access Protegido (Professor)
 */
router.post(
  "/disponibilidades",
  autorizar("Professor"),
  coachingController.adicionarDisponibilidade,
);

/**
 * @route DELETE /api/coaching/disponibilidades/:id
 * @description Remove um bloco de disponibilidade previamente configurado.
 * @access Protegido (Professor)
 */
router.delete(
  "/disponibilidades/:id",
  autorizar("Professor"),
  coachingController.removerDisponibilidade,
);

// ============================================================================
// CONSULTA DE VAGAS E DISPONIBILIDADE
// ============================================================================

/**
 * @route GET /api/coaching/vagas
 * @description Consulta as janelas de horário que ainda se encontram livres para pedir aulas.
 * @access Protegido (Encarregado de Educação)
 */
router.get("/vagas", autorizar("EE"), coachingController.getVagasDisponiveis);

/**
 * @route GET /api/coaching/professores-disponiveis
 * @description Retorna a lista de professores que efetivamente têm disponibilidade para aprovar um pedido específico.
 * @access Protegido (Admin)
 */
router.get(
  "/professores-disponiveis",
  autorizar("Admin"),
  coachingController.getProfessoresDisponiveisAprovacao,
);

/**
 * @route GET /api/coaching/slot-livre
 * @description Verifica ativamente se existe algum conflito de horário/sala num determinado slot antes de permitir uma ação.
 * @access Protegido (Professor)
 */
router.get(
  "/slot-livre",
  autorizar("Professor"),
  coachingController.getSlotLivre,
);

// ============================================================================
// AGENDAS E PREÇOS
// ============================================================================

/**
 * @route GET /api/coaching/agenda
 * @description Obtém a agenda formatada do professor com as aulas já agendadas. (Query Params opcionais: dataInicio, dataFim).
 * @access Protegido (Professor)
 */
router.get("/agenda", autorizar("Professor"), coachingController.getAgenda);

/**
 * @route GET /api/coaching/preco-estimado
 * @description Devolve o custo financeiro estimado para um pedido de coaching, consultando dinamicamente as tabelas de preços do sistema.
 * @access Protegido (Encarregado de Educação)
 */
router.get(
  "/preco-estimado",
  autorizar("EE"),
  coachingController.getPrecoEstimado,
);

// ============================================================================
// GESTÃO DE PEDIDOS DE COACHING
// ============================================================================

/**
 * @route POST /api/coaching/pedidos
 * @description Submete um novo pedido de coaching para a coordenação aprovar.
 * @access Protegido (Encarregado de Educação)
 */
router.post(
  "/pedidos",
  autorizar("EE"),
  coachingController.criarPedidoCoaching,
);

/**
 * @route GET /api/coaching/pedidos/pendentes
 * @description Lista global de pedidos de coaching pendentes de aprovação na escola.
 * @access Protegido (Admin)
 */
router.get(
  "/pedidos/pendentes",
  autorizar("Admin"),
  coachingController.getPedidosPendentes,
);

/**
 * @route GET /api/coaching/pedidos/meus
 * @description Lista o histórico de pedidos submetidos pelo encarregado de educação.
 * @access Protegido (Encarregado de Educação)
 */
router.get(
  "/pedidos/meus",
  autorizar("EE"),
  coachingController.listarMeusPedidosCoaching,
);

/**
 * @route GET /api/coaching/pedidos/atribuidos-professor
 * @description Lista de pedidos pendentes em que o professor autenticado foi especificamente solicitado.
 * @access Protegido (Professor)
 */
router.get(
  "/pedidos/atribuidos-professor",
  autorizar("Professor"),
  coachingController.getPedidosAtribuidosProfessor,
);

/**
 * @route DELETE /api/coaching/pedidos/:id/pendente
 * @description Cancela um pedido de coaching submetido, desde que ainda esteja no estado 'Pendente'.
 * @access Protegido (Encarregado de Educação)
 */
router.delete(
  "/pedidos/:id/pendente",
  autorizar("EE"),
  coachingController.cancelarMeuPedidoPendente,
);

/**
 * @route GET /api/coaching/pedidos/:id
 * @description Consulta os detalhes completos de um pedido específico.
 * @access Protegido (Admin, Encarregado de Educação)
 */
router.get(
  "/pedidos/:id",
  autorizar("Admin", "EE"),
  coachingController.getPedidoCoaching,
);

/**
 * @route POST /api/coaching/pedidos/:id/aprovar
 * @description A Coordenação aprova o pedido, designa a sala, o professor e finaliza o agendamento da aula.
 * @access Protegido (Admin)
 */
router.post(
  "/pedidos/:id/aprovar",
  autorizar("Admin"),
  coachingController.aprovarPedido,
);

/**
 * @route POST /api/coaching/pedidos/:id/rejeitar
 * @description A Coordenação rejeita o pedido, exigindo o envio obrigatório de uma justificação.
 * @access Protegido (Admin)
 */
router.post(
  "/pedidos/:id/rejeitar",
  autorizar("Admin"),
  coachingController.rejeitarPedido,
);

// ============================================================================
// VALIDAÇÃO E CONCLUSÃO (AULAS REALIZADAS)
// ============================================================================

/**
 * @route GET /api/coaching/pendentes-conclusao
 * @description Lista de coachings agendados cuja data e hora já passaram (monitorização).
 * @access Protegido (Admin)
 */
router.get(
  "/pendentes-conclusao",
  autorizar("Admin"),
  coachingController.getPendentesConclusaoCoordenacao,
);

/**
 * @route DELETE /api/coaching/:id
 * @description Cancela um coaching que já se encontrava agendado/confirmado, libertando a sala e agenda.
 * @access Protegido (Admin, Encarregado de Educação)
 */
router.delete(
  "/:id",
  autorizar("EE", "Admin"),
  coachingController.cancelarCoaching,
);

/**
 * @route POST /api/coaching/:id/validar
 * @description Confirma formalmente no sistema se a aula aconteceu ou não após o horário estipulado.
 * @access Protegido (Professor, Encarregado de Educação)
 */
router.post(
  "/:id/validar",
  autorizar("Professor", "EE"),
  coachingController.registarValidacao,
);

/**
 * @route POST /api/coaching/:id/concluir
 * @description Passo final de reconciliação: a Coordenação dá o fecho do processo definindo se foi faturável ou não.
 * @access Protegido (Admin)
 */
router.post(
  "/:id/concluir",
  autorizar("Admin"),
  coachingController.concluirCoaching,
);

/**
 * @route GET /api/coaching/historico
 * @description Obtém o histórico geral e listagem completa dos coachings finalizados para registo.
 * @access Protegido (Admin)
 */
router.get(
  "/historico",
  autorizar("Admin"),
  coachingController.listarHistorico,
);

/**
 * @route POST /api/coaching/agendar-admin
 * @description Permite à coordenação forçar um agendamento direto na agenda sem pedido prévio pelo EE.
 * @access Protegido (Admin)
 */
router.post(
  "/agendar-admin",
  autorizar("Admin"),
  coachingController.agendarDiretoAdmin,
);

/**
 * @module coachingRoutes
 */
module.exports = router;
