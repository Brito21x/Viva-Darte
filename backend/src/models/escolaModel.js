/**
 * @fileoverview Modelo de Dados para a Estrutura da Escola.
 * @description Responsável por todas as interações com a base de dados SQL Server referentes
 * ao catálogo de recursos fixos da escola: Anos Letivos, Modalidades (disciplinas),
 * Salas, Professores, respetivas compatibilidades/associações e horários regulares.
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ============================================================================
// 1. GESTÃO DO CALENDÁRIO LETIVO
// ============================================================================

/**
 * @async
 * @function getAnosLetivos
 * @description Obtém a lista de anos letivos registados na base de dados.
 * A listagem é devolvida por ordem decrescente (do mais recente para o mais antigo).
 * @returns {Promise<Array<Object>>} Array de objetos com os anos letivos (ex: {id_ano_letivo, ano}).
 * @throws {Error} Lança o erro caso a query à base de dados falhe.
 */
async function getAnosLetivos() {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT 
                id_ano_letivo, 
                ano 
            FROM ANO_LETIVO
            ORDER BY ano DESC;
        `;
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getAnosLetivos):", error);
    throw error;
  }
}

// ============================================================================
// 2. CATÁLOGO DE RECURSOS (SALAS E MODALIDADES)
// ============================================================================

/**
 * @async
 * @function getModalidadesAtivas
 * @description Obtém a lista de todas as modalidades (disciplinas ou instrumentos) ativas no sistema.
 * @returns {Promise<Array<Object>>} Array de modalidades ativas ordenadas alfabeticamente.
 * @throws {Error} Falha de query à base de dados.
 */
async function getModalidadesAtivas() {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT 
                id_modalidade, 
                nome 
            FROM MODALIDADE 
            WHERE ativo = 1
            ORDER BY nome ASC;
        `;
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getModalidadesAtivas):", error);
    throw error;
  }
}

/**
 * @async
 * @function getSalas
 * @description Obtém o catálogo de salas físicas disponíveis na escola e as respetivas capacidades máximas.
 * @returns {Promise<Array<Object>>} Array de salas ordenadas alfabeticamente.
 * @throws {Error} Falha de consulta.
 */
async function getSalas() {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT 
                id_sala, 
                nome, 
                capacidade_maxima 
            FROM SALA
            ORDER BY nome ASC;
        `;
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getSalas):", error);
    throw error;
  }
}

// ============================================================================
// 3. MATRIZES DE CRUZAMENTO (REGRAS FÍSICAS E HUMANAS)
// ============================================================================

/**
 * @async
 * @function getCompatibilidadeSalasModalidades
 * @description Retorna o mapa geral de quais salas estão equipadas e são compatíveis com quais modalidades.
 * Essencial para o sistema validar se uma aula pode ou não decorrer num determinado espaço físico.
 * @returns {Promise<Array<Object>>} Array detalhado das compatibilidades Sala ↔ Modalidade.
 * @throws {Error} Lança erros propagados na bd.
 */
async function getCompatibilidadeSalasModalidades() {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT 
                s.id_sala,
                s.nome AS nome_sala,
                s.capacidade_maxima,
                m.id_modalidade,
                m.nome AS modalidade_permitida
            FROM SALA s
            JOIN SALA_MODALIDADE sm ON s.id_sala = sm.SALAid_sala
            JOIN MODALIDADE m ON sm.MODALIDADEid_modalidade = m.id_modalidade
            WHERE m.ativo = 1
            ORDER BY s.nome ASC, m.nome ASC;
        `;
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error(
      "Erro no Modelo (getCompatibilidadeSalasModalidades):",
      error,
    );
    throw error;
  }
}

/**
 * @async
 * @function getSalasPorModalidade
 * @description Retorna especificamente as salas compatíveis com uma dada modalidade.
 * Usado para preencher a dropdown de salas na interface de aprovação de pedidos de Coaching.
 * @param {number} idModalidade - O ID da modalidade a verificar.
 * @returns {Promise<Array<Object>>} Os registos correspondentes à compatibilidade pretendida.
 * @throws {Error} Erros de processamento DB.
 */
async function getSalasPorModalidade(idModalidade) {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT 
                s.id_sala,
                s.nome AS nome_sala,
                s.capacidade_maxima
            FROM SALA s
            JOIN SALA_MODALIDADE sm ON s.id_sala = sm.SALAid_sala
            WHERE sm.MODALIDADEid_modalidade = @IdModalidade
            ORDER BY s.nome ASC;
        `;
    const result = await pool
      .request()
      .input("IdModalidade", sql.Int, idModalidade)
      .query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getSalasPorModalidade):", error);
    throw error;
  }
}

/**
 * @async
 * @function getModalidadesPorProfessor
 * @description Retorna as modalidades que um professor específico está apto e autorizado a lecionar.
 * @param {number} idProfessor - O ID do utilizador (professor) cujo catálogo de disciplinas queremos extrair.
 * @returns {Promise<Array<Object>>} A lista das respetivas modalidades.
 * @throws {Error} Caso a extração de dados falhe.
 */
async function getModalidadesPorProfessor(idProfessor) {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT 
                m.id_modalidade,
                m.nome AS modalidade
            FROM UTILIZADOR u
            JOIN PROFESSOR_MODALIDADE pm ON u.id_utilizador = pm.UTILIZADORid_utilizador
            JOIN MODALIDADE m ON pm.MODALIDADEid_modalidade = m.id_modalidade
            WHERE u.id_utilizador = @IdProfessor 
              AND u.ativo = 1 
              AND m.ativo = 1
            ORDER BY m.nome ASC;
        `;
    const result = await pool
      .request()
      .input("IdProfessor", sql.Int, idProfessor)
      .query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getModalidadesPorProfessor):", error);
    throw error;
  }
}

/**
 * @async
 * @function getProfessoresAtivos
 * @description Lista todos os utilizadores ativos no sistema que possuem o perfil de "Professor".
 * Utilizado primariamente para os painéis de administração e associação livre de modalidades (US11).
 * @returns {Promise<Array<Object>>} Array com a informação básica do utilizador.
 * @throws {Error} Em caso de falha na query mssql.
 */
async function getProfessoresAtivos() {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT DISTINCT
                u.id_utilizador AS id_professor,
                u.nome AS nome_professor
            FROM UTILIZADOR u
            JOIN UTILIZADOR_PERFIL up ON up.UTILIZADORid_utilizador = u.id_utilizador
            JOIN PERFIL p ON p.id_perfil = up.PERFILid_perfil
            WHERE p.nome LIKE '%Prof%'
              AND u.ativo = 1
            ORDER BY u.nome ASC;
        `;
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getProfessoresAtivos):", error);
    throw error;
  }
}

/**
 * @async
 * @function getProfessoresPorModalidade
 * @description Retorna exclusivamente os professores explicitamente associados e aptos a lecionar uma modalidade.
 * (Aplica a US05 + US11/RF13). Não apresenta professores sem vínculo direto à disciplina requerida.
 * @param {number} idModalidade - O ID da modalidade escolhida (ex: selecionada pelo Encarregado de Educação).
 * @returns {Promise<Array<Object>>} O catálogo de docentes disponíveis para esta via.
 * @throws {Error} Erros de processamento DB.
 */
async function getProfessoresPorModalidade(idModalidade) {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT 
                u.id_utilizador AS id_professor,
                u.nome AS nome_professor
            FROM UTILIZADOR u
            JOIN UTILIZADOR_PERFIL up ON up.UTILIZADORid_utilizador = u.id_utilizador
            JOIN PERFIL p ON p.id_perfil = up.PERFILid_perfil
            INNER JOIN PROFESSOR_MODALIDADE pm
                ON pm.UTILIZADORid_utilizador = u.id_utilizador
               AND pm.MODALIDADEid_modalidade = @IdModalidade
            WHERE p.nome LIKE '%Prof%'
              AND u.ativo = 1
            ORDER BY u.nome ASC;
        `;
    const result = await pool
      .request()
      .input("IdModalidade", sql.Int, idModalidade)
      .query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getProfessoresPorModalidade):", error);
    throw error;
  }
}

/**
 * @async
 * @function associarProfessorModalidade
 * @description Associa oficialmente um professor a uma modalidade, permitindo que ele passe a lecioná-la. (US11 / RF13)
 * Utiliza o comando 'MERGE' (Upsert) para garantir de forma segura que não há inserção de duplicados na BD.
 * @param {number} idProfessor - O identificador do docente.
 * @param {number} idModalidade - O identificador da disciplina.
 * @returns {Promise<boolean>} Devolve true caso a associação decorra com êxito.
 * @throws {Error} Lança erro caso a combinação já exista e nenhuma linha seja afetada.
 */
async function associarProfessorModalidade(idProfessor, idModalidade) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdProfessor", sql.Int, idProfessor)
      .input("IdModalidade", sql.Int, idModalidade).query(`
                /* O MERGE verifica se a associação já existe. Se não existir, faz o INSERT. */
                MERGE PROFESSOR_MODALIDADE AS t
                USING (SELECT @IdProfessor AS id_p, @IdModalidade AS id_m) AS s
                ON t.UTILIZADORid_utilizador = s.id_p AND t.MODALIDADEid_modalidade = s.id_m
                WHEN NOT MATCHED THEN
                    INSERT (UTILIZADORid_utilizador, MODALIDADEid_modalidade)
                    VALUES (s.id_p, s.id_m);
            `);

    const ra = result.rowsAffected || [];
    const totalAfetadas = (Array.isArray(ra) ? ra : [ra]).reduce(
      (acc, n) => acc + (Number(n) || 0),
      0,
    );

    if (totalAfetadas < 1) {
      throw new Error("Este professor já está associado a esta modalidade.");
    }

    return true;
  } catch (error) {
    console.error("Erro no Modelo (associarProfessorModalidade):", error);
    throw error;
  }
}

/**
 * @async
 * @function removerProfessorModalidade
 * @description Remove a autorização de lecionação de uma modalidade para um determinado professor.
 * @param {number} idProfessor - O ID do utilizador em causa.
 * @param {number} idModalidade - O ID da modalidade a remover.
 * @returns {Promise<boolean>} Devolve true se a desassociação ocorreu.
 * @throws {Error} Caso encontre limitações de DB.
 */
async function removerProfessorModalidade(idProfessor, idModalidade) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdProfessor", sql.Int, idProfessor)
      .input("IdModalidade", sql.Int, idModalidade).query(`
                DELETE FROM PROFESSOR_MODALIDADE 
                WHERE UTILIZADORid_utilizador = @IdProfessor 
                  AND MODALIDADEid_modalidade = @IdModalidade;
            `);

    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error("Erro no Modelo (removerProfessorModalidade):", error);
    throw error;
  }
}

/**
 * @async
 * @function getHorariosPorAnoLetivo
 * @description Extrai a grelha de horários de aulas regulares (turmas fixas da escola).
 * Pode ser filtrada opcionalmente por um ano letivo específico.
 * @param {number|null} [idAnoLetivo=null] - O ID do ano letivo de filtro (opcional).
 * @returns {Promise<Array<Object>>} A matriz de horários construída.
 * @throws {Error} Caso não seja possível executar a extração na DB.
 */
async function getHorariosPorAnoLetivo(idAnoLetivo = null) {
  try {
    const pool = await poolPromise;
    const request = pool.request();

    let filtroAno = "";
    if (idAnoLetivo != null && !Number.isNaN(Number(idAnoLetivo))) {
      filtroAno = "AND h.ANO_LETIVOid_ano_letivo = @IdAnoLetivo";
      request.input("IdAnoLetivo", sql.Int, parseInt(idAnoLetivo, 10));
    }

    const query = `
            SELECT 
                h.id_horario,
                h.dia_semana,
                h.hora_inicio,
                h.hora_fim,
                h.ativo,
                h.UTILIZADORid_utilizador AS id_professor,
                h.ALUNOid_aluno AS id_aluno,
                h.MODALIDADEid_modalidade AS id_modalidade,
                h.SALAid_sala AS id_sala,
                h.ANO_LETIVOid_ano_letivo AS id_ano_letivo,
                prof.nome AS nome_professor,
                al.nome AS nome_aluno,
                m.nome AS modalidade,
                s.nome AS sala
            FROM HORARIO h
            JOIN UTILIZADOR prof ON h.UTILIZADORid_utilizador = prof.id_utilizador
            JOIN ALUNO al ON h.ALUNOid_aluno = al.id_aluno
            JOIN MODALIDADE m ON h.MODALIDADEid_modalidade = m.id_modalidade
            JOIN SALA s ON h.SALAid_sala = s.id_sala
            WHERE h.ativo = 1 ${filtroAno}
            ORDER BY h.dia_semana, h.hora_inicio;
        `;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Erro no Modelo (getHorariosPorAnoLetivo):", error);
    throw error;
  }
}
async function getHorarios() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      h.id_horario, 
      h.dia_semana, 
      CONVERT(VARCHAR(5), h.hora_inicio, 108) AS hora_inicio, 
      CONVERT(VARCHAR(5), h.hora_fim, 108) AS hora_fim,
      h.MODALIDADEid_modalidade,
      h.UTILIZADORid_utilizador,
      h.SALAid_sala,
      m.nome AS modalidade,
      u.nome AS professor,
      s.nome AS sala
    FROM HORARIO h
    LEFT JOIN MODALIDADE m ON h.MODALIDADEid_modalidade = m.id_modalidade
    LEFT JOIN UTILIZADOR u ON h.UTILIZADORid_utilizador = u.id_utilizador
    LEFT JOIN SALA s ON h.SALAid_sala = s.id_sala
    WHERE h.ativo = 1
    ORDER BY h.dia_semana ASC, h.hora_inicio ASC
  `);
  return result.recordset;
}

async function criarHorario(dados) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("Dia", sql.Int, dados.dia_semana)
    .input("Inicio", sql.VarChar, dados.hora_inicio)
    .input("Fim", sql.VarChar, dados.hora_fim)
    .input("IdMod", sql.Int, dados.idModalidade)
    .input("IdProf", sql.Int, dados.idProfessor)
    .input("IdSala", sql.Int, dados.idSala).query(`
      INSERT INTO HORARIO (dia_semana, hora_inicio, hora_fim, MODALIDADEid_modalidade, UTILIZADORid_utilizador, SALAid_sala, ativo)
      VALUES (@Dia, @Inicio, @Fim, @IdMod, @IdProf, @IdSala, 1)
    `);
  return true;
}

async function atualizarHorario(id, dados) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("Id", sql.Int, id)
    .input("Dia", sql.Int, dados.dia_semana)
    .input("Inicio", sql.VarChar, dados.hora_inicio)
    .input("Fim", sql.VarChar, dados.hora_fim)
    .input("IdMod", sql.Int, dados.idModalidade)
    .input("IdProf", sql.Int, dados.idProfessor)
    .input("IdSala", sql.Int, dados.idSala).query(`
      UPDATE HORARIO 
      SET dia_semana = @Dia, hora_inicio = @Inicio, hora_fim = @Fim, 
          MODALIDADEid_modalidade = @IdMod, UTILIZADORid_utilizador = @IdProf, 
          SALAid_sala = @IdSala
      WHERE id_horario = @Id
    `);
  return true;
}

async function apagarHorario(id) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("Id", sql.Int, id)
    .query(`DELETE FROM HORARIO WHERE id_horario = @Id`);
  return true;
}
/**
 * @module escolaModel
 */
module.exports = {
  getAnosLetivos,
  getModalidadesAtivas,
  getSalas,
  getCompatibilidadeSalasModalidades,
  getSalasPorModalidade,
  getModalidadesPorProfessor,
  getProfessoresAtivos,
  getProfessoresPorModalidade,
  associarProfessorModalidade,
  removerProfessorModalidade,
  getHorariosPorAnoLetivo,
  getHorarios,
  criarHorario,
  atualizarHorario,
  apagarHorario,
};
