/**
 * @fileoverview Modelo de Dados para Faturação Mensal.
 * @description Responsável por todas as interações com a tabela FATURACAO_MENSAL da base de dados.
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

/**
 * @async
 * @function getFaturas
 * @description Obtém a lista de faturas mensais com base em filtros opcionais (ano, mês e estado).
 * @param {Object} [filtros={}] - Objeto com os filtros de pesquisa.
 * @param {string|number} [filtros.ano] - O ano a filtrar.
 * @param {string|number} [filtros.mes] - O mês a filtrar.
 * @param {string} [filtros.estado] - O estado do pagamento (ex: 'Pendente', 'Pago', 'Cancelado').
 * @returns {Promise<Array<Object>>} Devolve um array de faturas.
 * @throws {Error} Propaga qualquer erro de execução na base de dados.
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
 * @async
 * @function getFaturaPorId
 * @description Obtém o detalhe de uma única fatura através do seu ID.
 * @param {number} idFaturacao - O identificador da fatura.
 * @returns {Promise<Object|null>} Os dados da fatura ou null se não encontrada.
 * @throws {Error} Propaga erro em caso de falha na DB.
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
 * @async
 * @function registarPagamento
 * @description Regista o pagamento de uma fatura, atualizando o seu estado, método e a data de liquidação.
 * @param {number} idFaturacao - O ID da fatura a pagar.
 * @param {string} metodoPagamento - O método utilizado (ex: 'MBWay', 'Transferência').
 * @returns {Promise<boolean>} Retorna true caso a fatura tenha sido atualizada com sucesso.
 * @throws {Error} Propaga erro em caso de falha.
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
 * @async
 * @function cancelarFatura
 * @description Cancela uma fatura (altera o estado para 'Cancelado') desde que esta não esteja já paga.
 * @param {number} idFaturacao - O ID da fatura a cancelar.
 * @returns {Promise<boolean>} Devolve true se a fatura foi cancelada com sucesso.
 * @throws {Error} Em caso de erro na query.
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
 * @async
 * @function getResumoFaturacao
 * @description Gera um resumo com os totais agregados por estado (útil para os StatCards do painel de administração).
 * @param {Object} [filtros={}] - Filtros opcionais de ano e mês.
 * @param {string|number} [filtros.ano] - O ano letivo a contabilizar.
 * @param {string|number} [filtros.mes] - O mês a contabilizar.
 * @returns {Promise<Object>} Devolve as estatísticas geradas ou um objeto vazio.
 * @throws {Error} Caso ocorra uma falha de base de dados.
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
 * @async
 * @function adicionarLinhaFaturaMensal
 * @description Cria uma fatura individual para uma aula de coaching (RF18).
 * A partir de agora cada aula gera a sua própria fatura (1 fatura = 1 aula),
 * em vez de agregar todas as aulas do mês na mesma fatura.
 * * NOTA: o nome da função mantém-se "adicionarLinhaFaturaMensal" para evitar
 * refatorização noutros locais (coachingController), mas o comportamento mudou:
 * já NÃO procura/agrega — efetua sempre um INSERT.
 *
 * @param {number} idUtilizador - O ID do encarregado de educação ou responsável.
 * @param {number} valor - O montante total a cobrar.
 * @param {string} descricao - A descrição da linha/fatura.
 * @param {Date|string} dataAula - A data de realização da aula para apurar o mês/ano fiscais.
 * @param {number} [idAnoLetivo=1] - O ID do ano letivo de referência.
 * @returns {Promise<number>} Devolve o ID da fatura acabada de criar.
 * @throws {Error} Falha de processamento ou inserção.
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
 * @async
 * @function getTabelaPrecos
 * @description Obtém todas as regras de preço configuradas na TABELA_PRECO ordenadas pela prioridade e formato.
 * @returns {Promise<Array<Object>>} As regras de preços atuais.
 * @throws {Error} Falha na extração dos preços.
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
 * @async
 * @function consultarPrecoAula
 * @description Função utilitária para o RF18: Obtém o preço exato para ser usado no momento do Agendamento (Custo Estimado).
 * @param {string} formato - O formato da aula (ex: 'Solo', 'Dueto').
 * @param {number} duracao - A duração pretendida em minutos.
 * @param {number} diaSemana - O indicador do tipo de dia da semana.
 * @returns {Promise<number|null>} Retorna o preço formatado ou null se não configurado.
 * @throws {Error} Erro de conectividade com a BD.
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

/**
 * @async
 * @function atualizarPreco
 * @description Atualiza as características (valor ou atividade) de uma dada regra de preço.
 * @param {number} idPreco - O ID da regra.
 * @param {number} preco - O novo montante tarifário.
 * @param {boolean} ativo - Define se a regra se mantém ativa ou descontinuada.
 * @returns {Promise<boolean>} True se atualizou algum registo.
 * @throws {Error} Propaga falhas de consulta.
 */
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
 * @async
 * @function getLinhasDaFatura
 * @description Devolve a(s) aula(s) que compõem uma fatura específica.
 * Como NÃO há FK direta entre FATURACAO_MENSAL e COACHING, a ligação é inferida cronologicamente.
 * * Algoritmo:
 * 1) Carrega todas as faturas do mesmo EE/ano/mês ordenadas por id_faturacao ASC.
 * 2) Carrega todas as aulas (não-canceladas) do mesmo EE/ano/mês ordenadas por id ASC.
 * 3) Faz "matching" sequencial: para cada fatura, na ordem em que foram criadas,
 * tenta encontrar uma aula ainda não atribuída cujo valor_final = total da fatura.
 * - Se houver match exato → essa fatura tem 1 aula (caso novo, 1-para-1)
 * - Se não houver match exato → a fatura "absorve" todas as aulas que ainda restarem (caso legacy).
 * 4) Devolve a lista correspondente à fatura pedida.
 *
 * @param {number} idFaturacao - O ID da fatura de pesquisa.
 * @returns {Promise<{fatura: Object, linhas: Array, modoIndividual: boolean}|null>} Retorna a fatura, os itens (coachings) e se é unifaturada.
 * @throws {Error} Falha algorítmica ou de base de dados.
 */
async function getLinhasDaFatura(idFaturacao) {
  try {
    const pool = await poolPromise;

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

    const atribuidas = new Set();
    const mapaFaturaAulas = new Map();

    const cmpValor = (a, b) =>
      Math.round(Number(a) * 100) === Math.round(Number(b) * 100);

    for (let i = 0; i < todasFaturas.length; i++) {
      const f = todasFaturas[i];
      const isUltima = i === todasFaturas.length - 1;

      const candidata = aulas.find(
        (a) =>
          !atribuidas.has(a.id_coaching) && cmpValor(a.valor_final, f.total),
      );

      if (candidata) {
        atribuidas.add(candidata.id_coaching);
        mapaFaturaAulas.set(f.id_faturacao, [candidata]);
      } else if (isUltima) {
        const restantes = aulas.filter((a) => !atribuidas.has(a.id_coaching));
        restantes.forEach((a) => atribuidas.add(a.id_coaching));
        mapaFaturaAulas.set(f.id_faturacao, restantes);
      } else {
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

/**
 * @module faturacaoModel
 */
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
