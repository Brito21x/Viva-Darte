/**
 * @fileoverview Rotas da Agenda de Aulas Regulares.
 */

const express = require("express");
const router = express.Router();
const agendaController = require("../controllers/agendaController");
const { autenticar } = require("../middlewares/auth");

router.use(autenticar);

/**
 * @route GET /api/agenda
 * @description Obtém a agenda geral de aulas baseada no perfil.
 */
router.get("/", agendaController.getAgendaAulas);

module.exports = router;
