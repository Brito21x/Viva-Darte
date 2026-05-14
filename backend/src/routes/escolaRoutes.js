/**
 * @fileoverview Rotas da Estrutura Base da Escola.
 * @description Este ficheiro mapeia os endpoints da API para o catálogo principal da instituição,
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
 * @route GET /api/escola/anos-letivos
 * @description Obtém a lista de anos letivos registados na escola.
 * @access Protegido
 */
router.get("/anos-letivos", escolaController.getAnosLetivos);

/**
 * @route GET /api/escola/horarios
 * @description Obtém a grelha de horários de aulas regulares (turmas fixas). Pode ser filtrada por ?idAnoLetivo=.
 * @access Protegido
 */
router.get("/horarios", escolaController.getHorarios);

// ============================================================================
// MODALIDADES E SALAS (CATÁLOGO GERAL)
// ============================================================================

/**
 * @route GET /api/escola/modalidades
 * @description Obtém a lista de modalidades (disciplinas/instrumentos) lecionadas e ativas.
 * @access Protegido
 */
router.get("/modalidades", escolaController.getModalidades);

/**
 * @route GET /api/escola/salas
 * @description Obtém a lista de todas as salas da escola e as suas capacidades máximas.
 * @access Protegido
 */
router.get("/salas", escolaController.getSalas);

/**
 * @route GET /api/escola/compatibilidade
 * @description Obtém a matriz completa de compatibilidade (que salas dão para lecionar que modalidades).
 * @access Protegido
 */
router.get("/compatibilidade", escolaController.getCompatibilidade);

/**
 * @route GET /api/escola/modalidades/:id/salas
 * @description Obtém apenas as salas adequadas/equipadas para lecionar uma modalidade específica.
 * @access Protegido
 */
router.get("/modalidades/:id/salas", escolaController.getSalasPorModalidade);

// ============================================================================
// GESTÃO DE PROFESSORES E ASSOCIAÇÕES
// ============================================================================

/**
 * @route GET /api/escola/modalidades/:id/professores
 * @description Obtém os professores habilitados a dar uma determinada modalidade (usado no dropdown de pedidos de coaching).
 * @access Protegido
 */
router.get(
  "/modalidades/:id/professores",
  escolaController.getProfessoresPorModalidade,
);

/**
 * @route GET /api/escola/professores
 * @description Lista todos os professores ativos no sistema (Restrito à Coordenação).
 * @access Protegido (Admin)
 */
router.get(
  "/professores",
  autorizar("Admin"),
  escolaController.getProfessoresAtivos,
);

/**
 * @route GET /api/escola/professores/:id/modalidades
 * @description Consulta as modalidades que um determinado professor leciona.
 * @access Protegido
 */
router.get(
  "/professores/:id/modalidades",
  escolaController.getModalidadesPorProfessor,
);

/**
 * @route POST /api/escola/professores/:id/modalidades
 * @description Associa oficialmente um professor a uma modalidade, tornando-o elegível para dar a disciplina.
 * @access Protegido (Admin)
 */
router.post(
  "/professores/:id/modalidades",
  autorizar("Admin"),
  escolaController.associarProfessorModalidade,
);

/**
 * @route DELETE /api/escola/professores/:id/modalidades/:idModalidade
 * @description Remove a autorização de um professor para lecionar uma modalidade.
 * @access Protegido (Admin)
 */
router.delete(
  "/professores/:id/modalidades/:idModalidade",
  autorizar("Admin"),
  escolaController.removerProfessorModalidade,
);

/**
 * @module escolaRoutes
 */
module.exports = router;
