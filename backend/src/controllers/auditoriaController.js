/**
 * @fileoverview Controlador de Auditoria.
 * Expõe os eventos registados na tabela LOG_ATIVIDADE para o painel admin
 * (tab "Histórico"). Apenas utilizadores com perfil Admin/Coordenação têm acesso.
 */

const auditoriaModel = require("../models/auditoriaModel");

/**
 * GET /api/auditoria
 * Lista eventos de auditoria com filtros opcionais.
 *
 * Query string aceita:
 *   - tipo        (string)   ex: LOGIN, PECA_CRIAR
 *   - utilizador  (string)   pesquisa parcial em nome/email
 *   - desde       (date)     formato YYYY-MM-DD
 *   - ate         (date)     formato YYYY-MM-DD
 *   - limite      (int)      máximo de registos (default 500, hard cap 2000)
 */
async function listarAuditoria(req, res, next) {
  try {
    const { tipo, utilizador, desde, ate, limite } = req.query;
    const eventos = await auditoriaModel.listar({
      tipo,
      utilizador,
      desde,
      ate,
      limite,
    });
    return res.status(200).json(eventos);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listarAuditoria,
};
