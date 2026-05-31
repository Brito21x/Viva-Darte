/**
 * @fileoverview Rotas da Agenda de Aulas Regulares.
 */

const express = require("express");
const router = express.Router();
const agendaController = require("../controllers/agendaController");
const { autenticar } = require("../middlewares/auth");

router.use(autenticar);

/** GET /api/agenda — agenda geral baseada no perfil */
router.get("/", agendaController.getAgendaAulas);

/** GET /api/agenda/educandos — educandos do EE autenticado */
router.get("/educandos", agendaController.getEducandosDoEE);

/** GET /api/agenda/alunos/:idAluno/modalidades — modalidades em que o aluno está inscrito */
router.get(
  "/alunos/:idAluno/modalidades",
  agendaController.getModalidadesDoAluno,
);

/** POST /api/agenda/alunos/modalidades — inscrever aluno numa modalidade */
router.post("/alunos/modalidades", agendaController.inscreverAlunoModalidade);

/** DELETE /api/agenda/alunos/modalidades — remover inscrição de aluno */
router.delete("/alunos/modalidades", agendaController.removerModalidadeAluno);

module.exports = router;
