/**
 * @fileoverview Helper de Auditoria.
 * Wrapper sobre `auditoriaModel.registar` que extrai automaticamente o IP,
 * o User-Agent e o ID do utilizador autenticado a partir do `req` do Express.
 *
 * Uso típico nos controllers:
 *
 *   await registarAuditoria(req, {
 *     tipo: 'PECA_CRIAR',
 *     descricao: `Peça '${nome}' adicionada ao inventário`,
 *     entidadeTipo: 'PECA',
 *     entidadeId: idPeca,
 *   });
 *
 * Esta função NUNCA atira exceções — falhas de auditoria são silenciosamente
 * registadas em consola para não impedir o fluxo principal.
 */

const auditoriaModel = require("../models/auditoriaModel");

/**
 * Extrai o IP do cliente respeitando proxies/load-balancers comuns.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function obterIp(req) {
  try {
    if (!req) return null;
    // Header preferencial atrás de proxies (X-Forwarded-For pode ter lista)
    const xff = req.headers?.["x-forwarded-for"];
    if (xff) {
      const primeiro = String(xff).split(",")[0].trim();
      if (primeiro) return primeiro;
    }
    return req.ip || req.connection?.remoteAddress || null;
  } catch {
    return null;
  }
}

/**
 * Regista um evento de auditoria.
 * @param {import('express').Request|null} req - Request do Express (ou null para eventos do sistema)
 * @param {Object} evento
 * @param {string} evento.tipo
 * @param {string} [evento.descricao]
 * @param {number|null} [evento.idUtilizador] - Se omitido, tenta usar req.utilizador?.id
 * @param {string} [evento.entidadeTipo]
 * @param {number|null} [evento.entidadeId]
 * @param {Object|null} [evento.dadosExtra]
 */
async function registarAuditoria(req, evento) {
  try {
    if (!evento || !evento.tipo) return;

    const idUtilizador =
      evento.idUtilizador != null
        ? evento.idUtilizador
        : req?.utilizador?.id || null;

    await auditoriaModel.registar({
      tipo: evento.tipo,
      descricao: evento.descricao || null,
      idUtilizador,
      ip: obterIp(req),
      userAgent: req?.headers?.["user-agent"]
        ? String(req.headers["user-agent"]).slice(0, 300)
        : null,
      entidadeTipo: evento.entidadeTipo || null,
      entidadeId: evento.entidadeId || null,
      dadosExtra: evento.dadosExtra || null,
    });
  } catch (error) {
    // Auditoria nunca deve quebrar o fluxo principal
    console.error("[registarAuditoria] Falha:", error.message);
  }
}

module.exports = {
  registarAuditoria,
  obterIp,
};
