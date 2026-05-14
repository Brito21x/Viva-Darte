/**
 * @fileoverview Modelo de Dados para Faturação Mensal.
 * Responsável por todas as interações com a tabela FATURACAO_MENSAL da base de dados.
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

/**
 * Obtém a lista de faturas mensais com filtros opcionais.
 * @param {Object} filtros - { ano, mes, estado }
 */
async function getFaturas({ ano, mes, estado } = {}) {
  try {
    const pool = await poolPromise;
    const request = pool.request();

    let condicoes = [];

    if (ano && !isNaN(Number(ano))) {
      condicoes.push("f.ano = @Ano");
      request.input("Ano", sql.Int, parseInt(ano));
    }
    if (mes && !isNaN(Number(mes))) {
      condicoes.push("f.mes = @Mes");
      request.input("Mes", sql.Int, parseInt(mes));
    }
    if (estado && String(estado).trim() !== "") {
      condicoes.push("f.estado_pagamento = @Estado");
      request.input("Estado", sql.VarChar(50), String(estado).trim());
    }

    const where =
      condicoes.length > 0 ? "WHERE " + condicoes.join(" AND ") : "";

    const query = `
      SELECT
        f.id_faturacao,
        f.ano,
        f.mes,
        f.data_geracao,
        f.total,
        f.metodo_pagamento,
        f.data_pagamento,
        f.estado_pagamento,
        f.UTILIZADORid_utilizador,
        f.ANO_LETIVOid_ano_letivo,
        u.nome AS nome_utilizador,
        u.email AS email_utilizador
      FROM FATURACAO_MENSAL f
      LEFT JOIN UTILIZADOR u ON f.UTILIZADORid_utilizador = u.id_utilizador
      ${where}
      ORDER BY f.ano DESC, f.mes DESC, f.id_faturacao DESC;
    `;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getFaturas):", error);
    throw error;
  }
}

/**
 * Obtém o detalhe de uma única fatura pelo seu ID.
 * @param {number} idFaturacao
 */
async function getFaturaPorId(idFaturacao) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdFaturacao", sql.Int, idFaturacao).query(`
        SELECT
          f.id_faturacao, f.ano, f.mes, f.data_geracao,
          f.total, f.metodo_pagamento, f.data_pagamento,
          f.estado_pagamento, f.UTILIZADORid_utilizador,
          u.nome AS nome_utilizador, u.email AS email_utilizador
        FROM FATURACAO_MENSAL f
        LEFT JOIN UTILIZADOR u ON f.UTILIZADORid_utilizador = u.id_utilizador
        WHERE f.id_faturacao = @IdFaturacao;
      `);
    return result.recordset[0] || null;
  } catch (error) {
    console.error("Erro no Modelo (getFaturaPorId):", error);
    throw error;
  }
}

/**
 * Regista o pagamento de uma fatura (atualiza estado, método e data).
 * @param {number} idFaturacao
 * @param {string} metodoPagamento
 */
async function registarPagamento(idFaturacao, metodoPagamento) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdFaturacao", sql.Int, idFaturacao)
      .input("Metodo", sql.VarChar(100), metodoPagamento || "MBWay").query(`
        UPDATE FATURACAO_MENSAL
        SET
          estado_pagamento = 'Pago',
          metodo_pagamento  = @Metodo,
          data_pagamento    = GETDATE()
        WHERE id_faturacao = @IdFaturacao;
      `);
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error("Erro no Modelo (registarPagamento):", error);
    throw error;
  }
}

/**
 * Cancela uma fatura (altera estado para 'Cancelado').
 * @param {number} idFaturacao
 */
async function cancelarFatura(idFaturacao) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdFaturacao", sql.Int, idFaturacao).query(`
        UPDATE FATURACAO_MENSAL
        SET estado_pagamento = 'Cancelado'
        WHERE id_faturacao = @IdFaturacao
          AND estado_pagamento != 'Pago';
      `);
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error("Erro no Modelo (cancelarFatura):", error);
    throw error;
  }
}

/**
 * Resumo/totais agrupados por estado (para os StatCards do dashboard).
 */
async function getResumoFaturacao({ ano, mes } = {}) {
  try {
    const pool = await poolPromise;
    const request = pool.request();
    let condicoes = [];
    if (ano && !isNaN(Number(ano))) {
      condicoes.push("ano = @Ano");
      request.input("Ano", sql.Int, parseInt(ano));
    }
    if (mes && !isNaN(Number(mes))) {
      condicoes.push("mes = @Mes");
      request.input("Mes", sql.Int, parseInt(mes));
    }
    const where =
      condicoes.length > 0 ? "WHERE " + condicoes.join(" AND ") : "";
    const result = await request.query(`
      SELECT
        COUNT(*) AS total_faturas,
        SUM(total) AS valor_total,
        SUM(CASE WHEN estado_pagamento = 'Pago'     THEN total ELSE 0 END) AS valor_pago,
        SUM(CASE WHEN estado_pagamento = 'Pendente' THEN total ELSE 0 END) AS valor_pendente,
        COUNT(CASE WHEN estado_pagamento = 'Pago'     THEN 1 END) AS qtd_pagas,
        COUNT(CASE WHEN estado_pagamento = 'Pendente' THEN 1 END) AS qtd_pendentes,
        COUNT(CASE WHEN estado_pagamento = 'Cancelado'THEN 1 END) AS qtd_canceladas
      FROM FATURACAO_MENSAL ${where};
    `);
    return result.recordset[0] || {};
  } catch (error) {
    console.error("Erro no Modelo (getResumoFaturacao):", error);
    throw error;
  }
}

/**
 * Adiciona o valor de uma aula de coaching à fatura mensal do utilizador (RF18).
 * Deve ser chamada no coachingController quando a aula passa a "Realizado" ou "Confirmado".
 */

async function adicionarLinhaFaturaMensal(
  idUtilizador,
  valor,
  descricao,
  dataAula,
  idAnoLetivo = 1,
) {
  try {
    const pool = await poolPromise;
    const data = new Date(dataAula);
    const ano = data.getFullYear();
    const mes = data.getMonth() + 1; // 1 a 12

    // 1. Verifica se já existe uma fatura pendente para este utilizador neste mês e ano letivo
    let faturaResult = await pool
      .request()
      .input("UserId", sql.Int, idUtilizador)
      .input("Ano", sql.Int, ano)
      .input("Mes", sql.Int, mes)
      .input("IdAnoLetivo", sql.Int, idAnoLetivo).query(`
        SELECT id_faturacao FROM FATURACAO_MENSAL 
        WHERE UTILIZADORid_utilizador = @UserId AND ano = @Ano AND mes = @Mes 
          AND ANO_LETIVOid_ano_letivo = @IdAnoLetivo AND estado_pagamento = 'Pendente'
      `);

    let idFaturacao;

    // 2. Se não existe, cria a fatura do mês JÁ COM O ANO LETIVO
    if (faturaResult.recordset.length === 0) {
      const insertResult = await pool
        .request()
        .input("UserId", sql.Int, idUtilizador)
        .input("Ano", sql.Int, ano)
        .input("Mes", sql.Int, mes)
        .input("IdAnoLetivo", sql.Int, idAnoLetivo).query(`
          INSERT INTO FATURACAO_MENSAL (ano, mes, data_geracao, total, estado_pagamento, UTILIZADORid_utilizador, ANO_LETIVOid_ano_letivo)
          OUTPUT inserted.id_faturacao
          VALUES (@Ano, @Mes, GETDATE(), 0, 'Pendente', @UserId, @IdAnoLetivo);
        `);
      idFaturacao = insertResult.recordset[0].id_faturacao;
    } else {
      idFaturacao = faturaResult.recordset[0].id_faturacao;
    }

    // 3. Adiciona o valor ao total da fatura
    await pool
      .request()
      .input("IdFaturacao", sql.Int, idFaturacao)
      .input("Valor", sql.Decimal(10, 2), valor).query(`
        UPDATE FATURACAO_MENSAL 
        SET total = total + @Valor 
        WHERE id_faturacao = @IdFaturacao;
      `);

    return true;
  } catch (error) {
    console.error("Erro ao gerar/atualizar fatura (RF18):", error);
    throw error;
  }
}

/**
 * Obtém todas as regras de preço da TABELA_PRECO
 */
async function getTabelaPrecos() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT id_preco, formato_aula, duracao_minutos, dia_semana, preco, ativo
      FROM TABELA_PRECO
      ORDER BY 
        CASE formato_aula
          WHEN 'Solo' THEN 1
          WHEN 'Dueto' THEN 2
          WHEN 'Trio' THEN 3
          WHEN 'Ensemble' THEN 4
          ELSE 5
        END,
        duracao_minutos ASC
    `);
    return result.recordset;
  } catch (error) {
    console.error("Erro ao carregar TABELA_PRECO:", error);
    throw error;
  }
}

/**
 * Função utilitária para o RF18:
 * Obtém o preço exato para ser usado no momento do Agendamento (Custo Estimado)
 */
async function consultarPrecoAula(formato, duracao, diaSemana) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Formato", sql.VarChar, formato)
      .input("Duracao", sql.Int, duracao)
      .input("Dia", sql.Int, diaSemana).query(`
        SELECT TOP 1 preco 
        FROM TABELA_PRECO
        WHERE formato_aula = @Formato 
          AND duracao_minutos = @Duracao 
          AND dia_semana = @Dia
          AND ativo = 1
      `);

    if (result.recordset.length > 0) {
      return result.recordset[0].preco;
    }
    return null; // Caso não encontre preço configurado
  } catch (error) {
    console.error("Erro ao consultar preço:", error);
    throw error;
  }
}

async function atualizarPreco(idPreco, preco, ativo) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdPreco", sql.Int, idPreco)
      .input("Preco", sql.Decimal(10, 2), preco)
      .input("Ativo", sql.Bit, ativo ? 1 : 0).query(`
        UPDATE TABELA_PRECO
        SET preco = @Preco, ativo = @Ativo
        WHERE id_preco = @IdPreco
      `);

    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error("Erro ao atualizar TABELA_PRECO:", error);
    throw error;
  }
}

module.exports = {
  getFaturas,
  getFaturaPorId,
  registarPagamento,
  cancelarFatura,
  getResumoFaturacao,
  adicionarLinhaFaturaMensal,
  getTabelaPrecos,
  consultarPrecoAula,
  atualizarPreco,
};
