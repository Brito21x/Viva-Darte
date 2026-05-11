/**
 * @fileoverview Rotas do Módulo de Coaching.
 * Este ficheiro mapeia os endpoints da API referentes à gestão de aulas de coaching
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
 * [PROTEGIDO: Professor] Obtém a lista de horários de disponibilidade do professor autenticado.
 * GET /api/coaching/disponibilidades
 */
router.get(
  "/disponibilidades",
  autorizar("Professor"),
  coachingController.getDisponibilidades,
);

/**
 * [PROTEGIDO: Professor] Regista um novo bloco de disponibilidade na agenda do professor.
 * POST /api/coaching/disponibilidades
 */
router.post(
  "/disponibilidades",
  autorizar("Professor"),
  coachingController.adicionarDisponibilidade,
);

/**
 * [PROTEGIDO: Professor] Remove um bloco de disponibilidade previamente configurado.
 * DELETE /api/coaching/disponibilidades/:id
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
 * [PROTEGIDO: EE] Consulta as janelas de horário que ainda se encontram livres para pedir aulas.
 * Query Params obrigatórios: idModalidade, diaSemana, data
 * GET /api/coaching/vagas
 */
router.get("/vagas", autorizar("EE"), coachingController.getVagasDisponiveis);

/**
 * [PROTEGIDO: Admin] Retorna a lista de professores que efetivamente têm disponibilidade
 * para aprovar um pedido específico que foi feito por um Encarregado de Educação.
 * GET /api/coaching/professores-disponiveis
 */
router.get(
  "/professores-disponiveis",
  autorizar("Admin"),
  coachingController.getProfessoresDisponiveisAprovacao,
);

/**
 * [PROTEGIDO: Professor] Verifica ativamente se existe algum conflito de horário/sala
 * num determinado slot antes de permitir uma ação.
 * GET /api/coaching/slot-livre
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
 * [PROTEGIDO: Professor] Obtém a agenda formatada do professor com as aulas já agendadas.
 * Query Params opcionais: dataInicio, dataFim
 * GET /api/coaching/agenda
 */
router.get("/agenda", autorizar("Professor"), coachingController.getAgenda);

/**
 * [PROTEGIDO: EE] Devolve o custo financeiro estimado para um pedido de coaching,
 * consultando dinamicamente as tabelas de preços do sistema.
 * GET /api/coaching/preco-estimado
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
 * [PROTEGIDO: EE] Submete um novo pedido de coaching para a coordenação aprovar.
 * POST /api/coaching/pedidos
 */
router.post(
  "/pedidos",
  autorizar("EE"),
  coachingController.criarPedidoCoaching,
);

/**
 * [PROTEGIDO: Admin] Lista global de pedidos de coaching pendentes de aprovação na escola.
 * GET /api/coaching/pedidos/pendentes
 */
router.get(
  "/pedidos/pendentes",
  autorizar("Admin"),
  coachingController.getPedidosPendentes,
);

/**
 * [PROTEGIDO: Professor] Lista de pedidos pendentes em que o professor autenticado
 * foi especificamente solicitado pelo Encarregado de Educação.
 * GET /api/coaching/pedidos/atribuidos-professor
 */
router.get(
  "/pedidos/atribuidos-professor",
  autorizar("Professor"),
  coachingController.getPedidosAtribuidosProfessor,
);

/**
 * [PROTEGIDO: EE] Cancela um pedido de coaching que o próprio submeteu,
 * desde que ainda esteja no estado 'Pendente'.
 * DELETE /api/coaching/pedidos/:id/pendente
 */
router.delete(
  "/pedidos/:id/pendente",
  autorizar("EE"),
  coachingController.cancelarMeuPedidoPendente,
);

/**
 * [PROTEGIDO: Admin ou EE Dono do Pedido] Consulta os detalhes completos de um pedido específico.
 * GET /api/coaching/pedidos/:id
 */
router.get(
  "/pedidos/:id",
  autorizar("Admin", "EE"),
  coachingController.getPedidoCoaching,
);

/**
 * [PROTEGIDO: Admin] A Coordenação aprova o pedido, designa a sala, o professor e finaliza o agendamento da aula.
 * POST /api/coaching/pedidos/:id/aprovar
 */
router.post(
  "/pedidos/:id/aprovar",
  autorizar("Admin"),
  coachingController.aprovarPedido,
);

/**
 * [PROTEGIDO: Admin] A Coordenação rejeita o pedido, exigindo o envio obrigatório de uma justificação.
 * POST /api/coaching/pedidos/:id/rejeitar
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
 * [PROTEGIDO: Admin] Lista de coachings agendados cuja data e hora já passaram.
 * Usado pela Coordenação para monitorizar o que falta validar e faturar.
 * GET /api/coaching/pendentes-conclusao
 */
router.get(
  "/pendentes-conclusao",
  autorizar("Admin"),
  coachingController.getPendentesConclusaoCoordenacao,
);

/**
 * [PROTEGIDO: EE ou Admin] Cancela um coaching que já se encontrava agendado/confirmado.
 * Liberta a sala e a agenda do professor.
 * DELETE /api/coaching/:id
 */
router.delete(
  "/:id",
  autorizar("EE", "Admin"),
  coachingController.cancelarCoaching,
);

/**
 * [PROTEGIDO: Professor ou EE] Confirma formalmente no sistema se a aula aconteceu
 * ou não após o horário estipulado.
 * POST /api/coaching/:id/validar
 */
router.post(
  "/:id/validar",
  autorizar("Professor", "EE"),
  coachingController.registarValidacao,
);

/**
 * [PROTEGIDO: Admin] Passo final de reconciliação: a Coordenação dá o fecho do processo
 * (define como faturável ou não realizado).
 * POST /api/coaching/:id/concluir
 */
router.post(
  "/:id/concluir",
  autorizar("Admin"),
  coachingController.concluirCoaching,
);

module.exports = router;
