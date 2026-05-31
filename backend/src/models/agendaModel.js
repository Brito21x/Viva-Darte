/**
 * @fileoverview Modelo de Dados para a Agenda Geral de Aulas.
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

/**
 * @async
 * @function getHorariosPorEncarregado
 * @description Obtém os horários gerais das modalidades em que os educandos de um EE estão inscritos.
 * @param {number} idEE - ID do Encarregado de Educação.
 */
async function getHorariosPorEncarregado(idEE) {
  const pool = await poolPromise;
  const result = await pool.request().input("IdEE", sql.Int, idEE).query(`
      SELECT DISTINCT
        h.id_horario, h.dia_semana, h.hora_inicio, h.hora_fim, 
        m.id_modalidade, m.nome AS modalidade, 
        s.nome AS sala, 
        prof.nome AS professor,
        a.id_aluno, a.nome AS nome_aluno
      FROM HORARIO h
      JOIN MODALIDADE m ON h.MODALIDADEid_modalidade = m.id_modalidade
      LEFT JOIN SALA s ON h.SALAid_sala = s.id_sala
      LEFT JOIN UTILIZADOR prof ON h.UTILIZADORid_utilizador = prof.id_utilizador
      -- Assume-se uma tabela que liga o Aluno à Modalidade (Inscrição)
      JOIN ALUNO_MODALIDADE am ON am.MODALIDADEid_modalidade = m.id_modalidade
      JOIN ALUNO a ON am.ALUNOid_aluno = a.id_aluno
      JOIN ENCARREGADO_ALUNO ea ON ea.ALUNOid_aluno = a.id_aluno
      WHERE ea.UTILIZADORid_utilizador = @IdEE AND h.ativo = 1
      ORDER BY h.dia_semana ASC, h.hora_inicio ASC;
    `);
  return result.recordset;
}

/**
 * @async
 * @function getHorariosPorProfessor
 * @description Obtém os horários das turmas alocadas a um professor na tabela HORARIO.
 * @param {number} idProfessor - ID do Professor.
 */
async function getHorariosPorProfessor(idProfessor) {
  const pool = await poolPromise;
  const result = await pool.request().input("IdProfessor", sql.Int, idProfessor)
    .query(`
      SELECT 
        h.id_horario, h.dia_semana, h.hora_inicio, h.hora_fim, 
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

module.exports = {
  getHorariosPorEncarregado,
  getHorariosPorProfessor,
};
