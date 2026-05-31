/**
 * @fileoverview Modelo de Dados para a Agenda Geral de Aulas.
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

async function getHorariosPorEncarregado(idEE) {
  const pool = await poolPromise;
  const result = await pool.request().input("IdEE", sql.Int, idEE).query(`
      SELECT DISTINCT
        h.id_horario, h.dia_semana,
        CONVERT(VARCHAR(5), h.hora_inicio, 108) AS hora_inicio,
        CONVERT(VARCHAR(5), h.hora_fim, 108) AS hora_fim,
        m.id_modalidade, m.nome AS modalidade,
        s.nome AS sala,
        prof.nome AS professor,
        a.id_aluno, a.nome AS nome_aluno
      FROM HORARIO h
      JOIN MODALIDADE m ON h.MODALIDADEid_modalidade = m.id_modalidade
      LEFT JOIN SALA s ON h.SALAid_sala = s.id_sala
      LEFT JOIN UTILIZADOR prof ON h.UTILIZADORid_utilizador = prof.id_utilizador
      JOIN ENCARREGADO_ALUNO ea ON ea.UTILIZADORid_utilizador = @IdEE
      JOIN ALUNO a ON a.id_aluno = ea.ALUNOid_aluno
      JOIN ALUNO_MODALIDADE am ON am.ALUNOid_aluno = a.id_aluno
                               AND am.MODALIDADEid_modalidade = m.id_modalidade
      WHERE h.ativo = 1
      ORDER BY h.dia_semana ASC, hora_inicio ASC;
    `);
  return result.recordset;
}

async function getHorariosPorProfessor(idProfessor) {
  const pool = await poolPromise;
  const result = await pool.request().input("IdProfessor", sql.Int, idProfessor)
    .query(`
      SELECT
        h.id_horario, h.dia_semana,
        CONVERT(VARCHAR(5), h.hora_inicio, 108) AS hora_inicio,
        CONVERT(VARCHAR(5), h.hora_fim, 108) AS hora_fim,
        m.id_modalidade, m.nome AS modalidade,
        s.nome AS sala,
        prof.nome AS professor
      FROM HORARIO h
      JOIN MODALIDADE m ON h.MODALIDADEid_modalidade = m.id_modalidade
      LEFT JOIN SALA s ON h.SALAid_sala = s.id_sala
      LEFT JOIN UTILIZADOR prof ON h.UTILIZADORid_utilizador = prof.id_utilizador
      WHERE h.UTILIZADORid_utilizador = @IdProfessor AND h.ativo = 1
      ORDER BY h.dia_semana ASC, h.hora_inicio ASC;
    `);
  return result.recordset;
}

async function getEducandosPorEE(idEE) {
  const pool = await poolPromise;
  const result = await pool.request().input("IdEE", sql.Int, idEE).query(`
      SELECT a.id_aluno, a.nome
      FROM ALUNO a
      JOIN ENCARREGADO_ALUNO ea ON ea.ALUNOid_aluno = a.id_aluno
      WHERE ea.UTILIZADORid_utilizador = @IdEE AND a.ativo = 1
    `);
  return result.recordset;
}

async function getModalidadesDoAluno(idAluno) {
  const pool = await poolPromise;
  const result = await pool.request().input("IdAluno", sql.Int, idAluno).query(`
      SELECT m.id_modalidade, m.nome
      FROM MODALIDADE m
      JOIN ALUNO_MODALIDADE am ON am.MODALIDADEid_modalidade = m.id_modalidade
      WHERE am.ALUNOid_aluno = @IdAluno
      ORDER BY m.nome ASC;
    `);
  return result.recordset;
}

async function verificarInscricao(idAluno, idModalidade) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdAluno", sql.Int, idAluno)
    .input("IdModalidade", sql.Int, idModalidade).query(`
      SELECT 1 FROM ALUNO_MODALIDADE
      WHERE ALUNOid_aluno = @IdAluno AND MODALIDADEid_modalidade = @IdModalidade
    `);
  return result.recordset.length > 0;
}

async function inscreverAluno(idAluno, idModalidade) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("IdAluno", sql.Int, idAluno)
    .input("IdModalidade", sql.Int, idModalidade).query(`
      INSERT INTO ALUNO_MODALIDADE (ALUNOid_aluno, MODALIDADEid_modalidade)
      VALUES (@IdAluno, @IdModalidade)
    `);
}

async function removerInscricao(idAluno, idModalidade) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("IdAluno", sql.Int, idAluno)
    .input("IdModalidade", sql.Int, idModalidade).query(`
      DELETE FROM ALUNO_MODALIDADE
      WHERE ALUNOid_aluno = @IdAluno AND MODALIDADEid_modalidade = @IdModalidade
    `);
}

async function getCoachingsPorEncarregado(idEE) {
  const pool = await poolPromise;

  const result = await pool.request().input("IdEE", sql.Int, idEE).query(`
      SELECT DISTINCT
        c.id_coaching,
        CONVERT(VARCHAR(5), c.hora_inicio, 108) AS hora_inicio,
        CONVERT(VARCHAR(5), DATEADD(MINUTE, c.duracao_minutos, c.hora_inicio), 108) AS hora_fim,
        m.id_modalidade, m.nome AS modalidade,
        prof.nome AS professor,
        s.nome AS sala,
        c.estado,
        CONVERT(VARCHAR(10), c.data_aula, 120) AS data_aula
      FROM COACHING c
      JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
      JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
      LEFT JOIN UTILIZADOR prof ON c.UTILIZADORid_utilizador = prof.id_utilizador
      LEFT JOIN SALA s ON c.SALAid_sala = s.id_sala
      
      -- LIGAÇÃO AOS CONVITES DO ALUNO
      LEFT JOIN PEDIDO_COACHING_PARTICIPANTE pcp ON pcp.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
      LEFT JOIN ENCARREGADO_ALUNO ea_convidado ON ea_convidado.ALUNOid_aluno = pcp.ALUNOid_aluno AND ea_convidado.UTILIZADORid_utilizador = @IdEE

      -- O WHERE ACEITA SE FORES O DONO DO PEDIDO OU SE O TEU EDUCANDO FOR PARTICIPANTE
      WHERE (pc.UTILIZADORid_utilizador = @IdEE OR ea_convidado.UTILIZADORid_utilizador = @IdEE)
        AND c.estado IN ('Agendado', 'Confirmado')
        
      -- CORREÇÃO AQUI: Retirado o "c." do ORDER BY. Agora o SQL Server não dá erro!
      ORDER BY data_aula ASC, hora_inicio ASC;
    `);

  return result.recordset;
}

async function getCoachingsPorProfessor(idProfessor) {
  const pool = await poolPromise;
  // Sem restrições de datas para o Professor também! (Convites para o professor aparecem sempre)
  const result = await pool.request().input("IdProfessor", sql.Int, idProfessor)
    .query(`
      SELECT
        c.id_coaching,
        CONVERT(VARCHAR(5), c.hora_inicio, 108) AS hora_inicio,
        CONVERT(VARCHAR(5), DATEADD(MINUTE, c.duracao_minutos, c.hora_inicio), 108) AS hora_fim,
        m.id_modalidade, m.nome AS modalidade,
        prof.nome AS professor,
        s.nome AS sala,
        c.estado,
        CONVERT(VARCHAR(10), c.data_aula, 120) AS data_aula
      FROM COACHING c
      JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
      LEFT JOIN UTILIZADOR prof ON c.UTILIZADORid_utilizador = prof.id_utilizador
      LEFT JOIN SALA s ON c.SALAid_sala = s.id_sala
      WHERE c.UTILIZADORid_utilizador = @IdProfessor
        AND c.estado IN ('Agendado', 'Confirmado')
      ORDER BY c.data_aula ASC, c.hora_inicio ASC;
    `);
  return result.recordset;
}

module.exports = {
  getHorariosPorEncarregado,
  getHorariosPorProfessor,
  getEducandosPorEE,
  getCoachingsPorEncarregado,
  getCoachingsPorProfessor,
  getModalidadesDoAluno,
  verificarInscricao,
  inscreverAluno,
  removerInscricao,
};
