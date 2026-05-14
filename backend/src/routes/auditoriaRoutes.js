/**
 * @fileoverview Rotas de Auditoria.
 * Mapeia o endpoint do Histórico de Atividade do painel admin.
 * Protegido por JWT e restrito ao perfil Admin/Coordenação.
 */

const express = require("express");
const router = express.Router();

const auditoriaController = require("../controllers/auditoriaController");
const { autenticar, autorizar } = require("../middlewares/auth");

/**
 * [PROTEGIDO: Admin] Lista eventos de auditoria com filtros opcionais.
 * GET /api/auditoria
 */
router.get(
  "/",
  autenticar,
  autorizar("Admin"),
  auditoriaController.listarAuditoria,
);

module.exports = router;
