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
 * Cria uma fatura individual para uma aula de coaching (RF18).
 * A partir de agora cada aula gera a sua própria fatura (1 fatura = 1 aula),
 * em vez de agregar todas as aulas do mês na mesma fatura.
 *
 * NOTA: o nome da função mantém-se "adicionarLinhaFaturaMensal" para evitar
 * refactor noutros locais (coachingController), mas o comportamento mudou:
 * já NÃO procura/agrega — sempre faz INSERT.
 *
 * Devolve o id da fatura criada.
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

    // Cria SEMPRE uma fatura nova para esta aula (sem agregação mensal).
    const insertResult = await pool
      .request()
      .input("UserId", sql.Int, idUtilizador)
      .input("Ano", sql.Int, ano)
      .input("Mes", sql.Int, mes)
      .input("IdAnoLetivo", sql.Int, idAnoLetivo)
      .input("Valor", sql.Decimal(10, 2), valor).query(`
        INSERT INTO FATURACAO_MENSAL
          (ano, mes, data_geracao, total, estado_pagamento,
           UTILIZADORid_utilizador, ANO_LETIVOid_ano_letivo)
        OUTPUT inserted.id_faturacao
        VALUES
          (@Ano, @Mes, GETDATE(), @Valor, 'Pendente',
           @UserId, @IdAnoLetivo);
      `);

    return insertResult.recordset[0].id_faturacao;
  } catch (error) {
    console.error("Erro ao gerar fatura individual (RF18):", error);
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

/**
 * Devolve a(s) aula(s) que compõem uma fatura específica.
 *
 * Como NÃO há FK direta entre FATURACAO_MENSAL e COACHING, a ligação é inferida.
 * Algoritmo:
 *   1) Carrega todas as faturas do mesmo EE/ano/mês ordenadas por id_faturacao ASC.
 *   2) Carrega todas as aulas (não-canceladas) do mesmo EE/ano/mês ordenadas por id ASC.
 *   3) Faz "matching" sequencial: para cada fatura, na ordem em que foram criadas,
 *      tenta encontrar uma aula ainda não atribuída cujo valor_final = total da fatura.
 *      - Se houver match exato → essa fatura tem 1 aula (caso novo, 1-para-1)
 *      - Se não houver match exato → a fatura "absorve" todas as aulas que ainda restarem
 *        (caso legacy: fatura agregada antiga com várias aulas).
 *   4) Devolve a lista correspondente à fatura pedida.
 *
 * @param {number} idFaturacao
 * @returns {Promise<{fatura: Object, linhas: Array, modoIndividual: boolean}|null>}
 */
async function getLinhasDaFatura(idFaturacao) {
  try {
    const pool = await poolPromise;

    // 1) Cabeçalho da fatura pedida
    const cab = await pool.request().input("Id", sql.Int, idFaturacao).query(`
      SELECT f.id_faturacao, f.ano, f.mes, f.total, f.estado_pagamento,
             f.metodo_pagamento, f.data_pagamento, f.data_geracao,
             f.UTILIZADORid_utilizador AS id_ee,
             f.ANO_LETIVOid_ano_letivo AS id_ano_letivo,
             u.nome AS nome_utilizador, u.email AS email_utilizador
      FROM FATURACAO_MENSAL f
      LEFT JOIN UTILIZADOR u ON f.UTILIZADORid_utilizador = u.id_utilizador
      WHERE f.id_faturacao = @Id;
    `);

    const fatura = cab.recordset[0];
    if (!fatura) return null;

    // 2) Todas as faturas do EE para o mesmo mês/ano letivo (ordem cronológica)
    const todasFaturasRes = await pool
      .request()
      .input("IdEE", sql.Int, fatura.id_ee)
      .input("Ano", sql.Int, fatura.ano)
      .input("Mes", sql.Int, fatura.mes)
      .input("IdAnoLetivo", sql.Int, fatura.id_ano_letivo || 1).query(`
        SELECT id_faturacao, total
        FROM FATURACAO_MENSAL
        WHERE UTILIZADORid_utilizador = @IdEE
          AND ano = @Ano AND mes = @Mes
          AND ANO_LETIVOid_ano_letivo = @IdAnoLetivo
        ORDER BY id_faturacao ASC;
      `);
    const todasFaturas = todasFaturasRes.recordset;

    // 3) Todas as aulas do EE no mesmo mês/ano letivo (ordem cronológica)
    const aulasRes = await pool
      .request()
      .input("IdEE", sql.Int, fatura.id_ee)
      .input("Ano", sql.Int, fatura.ano)
      .input("Mes", sql.Int, fatura.mes)
      .input("IdAnoLetivo", sql.Int, fatura.id_ano_letivo || 1).query(`
        SELECT
          c.id_coaching,
          c.data_aula,
          c.hora_inicio,
          c.duracao_minutos,
          c.formato_aula,
          c.numero_participantes,
          c.estado AS estado_coaching,
          c.valor_final,
          m.nome AS modalidade,
          s.nome AS sala,
          prof.id_utilizador AS id_professor,
          prof.nome          AS nome_professor,
          pc.data_pedido,
          pc.custo_estimado,
          (
            SELECT TOP 1 v.estado_validacao
            FROM VALIDACAO_COACHING v
            WHERE v.COACHINGid_coaching = c.id_coaching
              AND v.tipo_validador = 'Professor'
            ORDER BY v.data_validacao DESC
          ) AS validacao_professor,
          (
            SELECT TOP 1 v.observacoes
            FROM VALIDACAO_COACHING v
            WHERE v.COACHINGid_coaching = c.id_coaching
              AND v.tipo_validador = 'Professor'
            ORDER BY v.data_validacao DESC
          ) AS observacoes_professor,
          (
            SELECT TOP 1 v.data_validacao
            FROM VALIDACAO_COACHING v
            WHERE v.COACHINGid_coaching = c.id_coaching
              AND v.tipo_validador = 'Professor'
            ORDER BY v.data_validacao DESC
          ) AS data_validacao_professor
        FROM COACHING c
        INNER JOIN PEDIDO_COACHING pc
          ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
        LEFT JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
        LEFT JOIN SALA       s ON c.SALAid_sala            = s.id_sala
        LEFT JOIN UTILIZADOR prof ON c.UTILIZADORid_utilizador = prof.id_utilizador
        WHERE pc.UTILIZADORid_utilizador = @IdEE
          AND YEAR(c.data_aula)  = @Ano
          AND MONTH(c.data_aula) = @Mes
          AND c.ANO_LETIVOid_ano_letivo = @IdAnoLetivo
          AND c.estado <> 'Cancelado'
        ORDER BY c.id_coaching ASC;
      `);
    const aulas = aulasRes.recordset;

    // 4) Matching: percorre faturas em ordem; cada uma "fica" com aulas.
    const atribuidas = new Set(); // ids de aulas já atribuídas
    const mapaFaturaAulas = new Map(); // idFatura -> [aulas]

    // Função utilitária: aproxima floats em cêntimos para comparar com tolerância
    const cmpValor = (a, b) =>
      Math.round(Number(a) * 100) === Math.round(Number(b) * 100);

    for (let i = 0; i < todasFaturas.length; i++) {
      const f = todasFaturas[i];
      const isUltima = i === todasFaturas.length - 1;

      // Tenta encontrar uma aula com valor_final igual ao total da fatura
      const candidata = aulas.find(
        (a) =>
          !atribuidas.has(a.id_coaching) && cmpValor(a.valor_final, f.total),
      );

      if (candidata) {
        atribuidas.add(candidata.id_coaching);
        mapaFaturaAulas.set(f.id_faturacao, [candidata]);
      } else if (isUltima) {
        // Última fatura sem match exato — absorve todas as aulas restantes (caso legacy agregado).
        const restantes = aulas.filter((a) => !atribuidas.has(a.id_coaching));
        restantes.forEach((a) => atribuidas.add(a.id_coaching));
        mapaFaturaAulas.set(f.id_faturacao, restantes);
      } else {
        // Sem match e não é a última: deixa vazia (pode ser fatura cancelada ou ajuste manual)
        mapaFaturaAulas.set(f.id_faturacao, []);
      }
    }

    const linhas = mapaFaturaAulas.get(fatura.id_faturacao) || [];

    return {
      fatura,
      linhas,
      modoIndividual: linhas.length === 1,
    };
  } catch (error) {
    console.error("Erro no Modelo (getLinhasDaFatura):", error);
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
  getLinhasDaFatura,
};
