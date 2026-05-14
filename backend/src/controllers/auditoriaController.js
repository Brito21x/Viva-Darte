/**
 * @fileoverview Controlador de Auditoria.
 * @description Expõe os eventos registados na tabela LOG_ATIVIDADE para o painel de administração
 * (separador "Histórico"). Apenas utilizadores com perfil de Administração ou Coordenação têm acesso.
 */

const auditoriaModel = require("../models/auditoriaModel");

/**
 * @async
 * @function listarAuditoria
 * @description Lista os eventos de auditoria com base em filtros opcionais.
 * * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {Object} req.query - Os parâmetros enviados na query string do pedido.
 * @param {string} [req.query.tipo] - O tipo de evento a filtrar (ex: LOGIN, PECA_CRIAR).
 * @param {string} [req.query.utilizador] - A pesquisa parcial por nome ou e-mail do utilizador.
 * @param {string} [req.query.desde] - A data inicial para o filtro (formato YYYY-MM-DD).
 * @param {string} [req.query.ate] - A data final para o filtro (formato YYYY-MM-DD).
 * @param {string|number} [req.query.limite] - O limite máximo de registos a devolver (por omissão é 500, com um limite máximo rígido de 2000).
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware (utilizada para encaminhamento de erros).
 * * @returns {Promise<import('express').Response|void>} Devolve o estado 200 acompanhado do JSON com os eventos encontrados, ou encaminha o erro para o tratador de erros global.
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

/**
 * @module auditoriaController
 */
module.exports = {
  listarAuditoria,
};
