/**
 * @fileoverview Rotas da Estrutura Base da Escola.
 * Este ficheiro mapeia os endpoints da API para o catálogo principal da instituição,
 * incluindo a gestão de Anos Letivos, Modalidades, Salas, Professores e Horários Regulares.
 */

const express = require("express");
const router = express.Router();

const escolaController = require("../controllers/escolaController");
const { autenticar, autorizar } = require("../middlewares/auth");

// ============================================================================
// MIDDLEWARE GLOBAL DA ROTA
// ============================================================================
// Garante que todas as rotas de catálogo escolar requerem um utilizador com sessão iniciada
router.use(autenticar);

// ============================================================================
// ANOS LETIVOS E HORÁRIOS
// ============================================================================

/**
 * [PROTEGIDO] Obtém a lista de anos letivos registados na escola.
 * GET /api/escola/anos-letivos
 */
router.get("/anos-letivos", escolaController.getAnosLetivos);

/**
 * [PROTEGIDO] Obtém a grelha de horários de aulas regulares (turmas fixas).
 * Pode receber a query string ?idAnoLetivo= para filtrar por um ano específico.
 * GET /api/escola/horarios
 */
router.get("/horarios", escolaController.getHorarios);

// ============================================================================
// MODALIDADES E SALAS (CATÁLOGO GERAL)
// ============================================================================

/**
 * [PROTEGIDO] Obtém a lista de modalidades (disciplinas/instrumentos) lecionadas.
 * GET /api/escola/modalidades
 */
router.get("/modalidades", escolaController.getModalidades);

/**
 * [PROTEGIDO] Obtém a lista de todas as salas da escola e as suas capacidades.
 * GET /api/escola/salas
 */
router.get("/salas", escolaController.getSalas);

/**
 * [PROTEGIDO] Obtém a matriz completa de compatibilidade (que salas dão para que modalidades).
 * GET /api/escola/compatibilidade
 */
router.get("/compatibilidade", escolaController.getCompatibilidade);

/**
 * [PROTEGIDO] Obtém apenas as salas adequadas/equipadas para lecionar uma modalidade específica.
 * GET /api/escola/modalidades/:id/salas
 */
router.get("/modalidades/:id/salas", escolaController.getSalasPorModalidade);

// ============================================================================
// GESTÃO DE PROFESSORES E ASSOCIAÇÕES
// ============================================================================

/**
 * [PROTEGIDO] Obtém os professores habilitados a dar uma determinada modalidade.
 * Muito utilizado no Frontend para popular a dropdown do formulário de pedidos de Coaching (US05).
 * GET /api/escola/modalidades/:id/professores
 */
router.get(
  "/modalidades/:id/professores",
  escolaController.getProfessoresPorModalidade,
);

/**
 * [PROTEGIDO: Admin] Lista todos os professores ativos no sistema.
 * Restrito à Coordenação/Administração (US11).
 * GET /api/escola/professores
 */
router.get(
  "/professores",
  autorizar("Admin"),
  escolaController.getProfessoresAtivos,
);

/**
 * [PROTEGIDO] Consulta as modalidades que um determinado professor leciona.
 * GET /api/escola/professores/:id/modalidades
 */
router.get(
  "/professores/:id/modalidades",
  escolaController.getModalidadesPorProfessor,
);

/**
 * [PROTEGIDO: Admin] Associa oficialmente um professor a uma modalidade.
 * O professor passa a ser elegível para dar essa disciplina. Restrito à Coordenação.
 * POST /api/escola/professores/:id/modalidades
 */
router.post(
  "/professores/:id/modalidades",
  autorizar("Admin"),
  escolaController.associarProfessorModalidade,
);

/**
 * [PROTEGIDO: Admin] Remove a autorização de um professor para lecionar uma modalidade.
 * DELETE /api/escola/professores/:id/modalidades/:idModalidade
 */
router.delete(
  "/professores/:id/modalidades/:idModalidade",
  autorizar("Admin"),
  escolaController.removerProfessorModalidade,
);

// Exportação do router
module.exports = router;
