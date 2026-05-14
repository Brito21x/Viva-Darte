/**
 * @fileoverview Rotas de Auditoria.
 * @description Mapeia o endpoint do Histórico de Atividade do painel admin.
 * Protegido por JWT e restrito ao perfil Admin/Coordenação.
 */

const express = require("express");
const router = express.Router();

const auditoriaController = require("../controllers/auditoriaController");
const { autenticar, autorizar } = require("../middlewares/auth");

/**
 * @route GET /api/auditoria
 * @description Lista eventos de auditoria com filtros opcionais (tipo, utilizador, datas).
 * @access Protegido (Requer token JWT e perfil Admin)
 */
router.get(
  "/",
  autenticar,
  autorizar("Admin"),
  auditoriaController.listarAuditoria,
);

/**
 * @module auditoriaRoutes
 */
module.exports = router;
