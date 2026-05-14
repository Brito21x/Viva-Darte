/**
 * @fileoverview Modelo de Dados para o Log de Atividade (Auditoria).
 * Responsável por gravar e consultar a tabela LOG_ATIVIDADE, que regista
 * todas as ações relevantes do sistema (logins, alterações, compras, etc.)
 * para auditoria pela Coordenação no painel administrativo.
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

/**
 * Regista um novo evento de auditoria.
 * Esta função é chamada por um helper (`registarAuditoria`) a partir dos
 * controllers da aplicação. Todas as falhas são apanhadas internamente
 * para que NUNCA quebrem o fluxo principal do utilizador.
 *
 * @param {Object} evento
 * @param {string} evento.tipo            - Código do evento (ex: 'LOGIN', 'PECA_CRIAR')
 * @param {string} [evento.descricao]     - Texto legível para o painel admin
 * @param {number|null} [evento.idUtilizador] - ID do utilizador que despoletou a ação
 * @param {string} [evento.ip]            - Endereço IP de origem
 * @param {string} [evento.userAgent]     - User-Agent do browser/cliente
 * @param {string} [evento.entidadeTipo]  - Tipo da entidade afetada (PECA, COACHING, ...)
 * @param {number|null} [evento.entidadeId] - ID da entidade afetada
 * @param {Object|null} [evento.dadosExtra] - Payload adicional (será stringificado em JSON)
 */
async function registar({
  tipo,
  descricao = null,
  idUtilizador = null,
  ip = null,
  userAgent = null,
  entidadeTipo = null,
  entidadeId = null,
  dadosExtra = null,
}) {
  try {
    if (!tipo) return; // Sem tipo não regista
    const pool = await poolPromise;
    const dadosExtraStr =
      dadosExtra && typeof dadosExtra === "object"
        ? JSON.stringify(dadosExtra).slice(0, 3500) // segurança contra payloads enormes
        : dadosExtra
          ? String(dadosExtra).slice(0, 3500)
          : null;

    await pool
      .request()
      .input("Tipo", sql.VarChar(50), tipo)
      .input("Descricao", sql.NVarChar(500), descricao || null)
      .input(
        "IdUtilizador",
        sql.Int,
        idUtilizador && !Number.isNaN(Number(idUtilizador))
          ? Number(idUtilizador)
          : null,
      )
      .input("Ip", sql.VarChar(45), ip || null)
      .input("UserAgent", sql.NVarChar(300), userAgent || null)
      .input("EntidadeTipo", sql.VarChar(50), entidadeTipo || null)
      .input(
        "EntidadeId",
        sql.Int,
        entidadeId && !Number.isNaN(Number(entidadeId))
          ? Number(entidadeId)
          : null,
      )
      .input("DadosExtra", sql.NVarChar(sql.MAX), dadosExtraStr).query(`
        INSERT INTO LOG_ATIVIDADE
          (tipo, descricao, UTILIZADORid_utilizador, ip, user_agent,
           entidade_tipo, entidade_id, dados_extra, data_hora)
        VALUES
          (@Tipo, @Descricao, @IdUtilizador, @Ip, @UserAgent,
           @EntidadeTipo, @EntidadeId, @DadosExtra, GETDATE());
      `);
  } catch (error) {
    // Falhas de auditoria nunca devem propagar ao utilizador
    console.error("[Auditoria] Falha a registar evento:", error.message);
  }
}

/**
 * Consulta os eventos de auditoria com filtros opcionais.
 * Usado pela tab "Histórico" do painel admin.
 *
 * @param {Object} filtros
 * @param {string} [filtros.tipo]        - Filtra por tipo exato (LOGIN, PECA_CRIAR, ...)
 * @param {string} [filtros.utilizador]  - Pesquisa texto em nome/email
 * @param {string} [filtros.desde]       - ISO date (YYYY-MM-DD)
 * @param {string} [filtros.ate]         - ISO date (YYYY-MM-DD)
 * @param {number} [filtros.limite]     - Máx de registos (default 500, hard cap 2000)
 */
async function listar({ tipo, utilizador, desde, ate, limite = 500 } = {}) {
  try {
    const pool = await poolPromise;
    const request = pool.request();

    const condicoes = [];

    if (tipo && String(tipo).trim() !== "") {
      condicoes.push("l.tipo = @Tipo");
      request.input("Tipo", sql.VarChar(50), String(tipo).trim());
    }

    if (utilizador && String(utilizador).trim() !== "") {
      condicoes.push("(u.nome LIKE @Util OR u.email LIKE @Util)");
      request.input(
        "Util",
        sql.NVarChar(200),
        `%${String(utilizador).trim()}%`,
      );
    }

    if (desde && String(desde).trim() !== "") {
      condicoes.push("l.data_hora >= @Desde");
      request.input("Desde", sql.DateTime, new Date(desde));
    }

    if (ate && String(ate).trim() !== "") {
      // Inclui o dia inteiro do "ate"
      const dataAte = new Date(ate);
      dataAte.setHours(23, 59, 59, 999);
      condicoes.push("l.data_hora <= @Ate");
      request.input("Ate", sql.DateTime, dataAte);
    }

    const limiteSeguro = Math.min(
      Math.max(parseInt(limite, 10) || 500, 1),
      2000,
    );

    const where =
      condicoes.length > 0 ? "WHERE " + condicoes.join(" AND ") : "";

    const query = `
      SELECT TOP ${limiteSeguro}
        l.id_log               AS id_audit,
        l.tipo,
        l.descricao,
        l.UTILIZADORid_utilizador AS id_utilizador,
        l.ip,
        l.user_agent,
        l.entidade_tipo,
        l.entidade_id,
        l.dados_extra,
        l.data_hora,
        u.nome                 AS nome_utilizador,
        u.email                AS email_utilizador
      FROM LOG_ATIVIDADE l
      LEFT JOIN UTILIZADOR u ON l.UTILIZADORid_utilizador = u.id_utilizador
      ${where}
      ORDER BY l.data_hora DESC, l.id_log DESC;
    `;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (Auditoria.listar):", error);
    throw error;
  }
}

module.exports = {
  registar,
  listar,
};
