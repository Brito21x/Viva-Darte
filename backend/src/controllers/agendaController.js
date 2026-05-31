/**
 * @fileoverview Controlador para a Agenda de Aulas.
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");
const agendaModel = require("../models/agendaModel");
const { utilizadorTemPerfil } = require("../middlewares/auth");

async function getAgendaAulas(req, res, next) {
  try {
    const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;
    const perfis = req.utilizador.perfis || [];

    let horarios = [];

    // Lógica para Professor
    if (utilizadorTemPerfil(perfis, "Professor")) {
      horarios = await agendaModel.getHorariosPorProfessor(idUtilizador);
    }
    // Lógica para Encarregado de Educação
    else if (utilizadorTemPerfil(perfis, "EE")) {
      horarios = await agendaModel.getHorariosPorEncarregado(idUtilizador);
    } else {
      return res
        .status(403)
        .json({ mensagem: "Acesso não autorizado a esta agenda." });
    }

    return res.status(200).json(horarios);
  } catch (error) {
    next(error);
  }
}

async function inscreverAlunoModalidade(req, res, next) {
  try {
    const { idAluno, idModalidade } = req.body;
    if (!idAluno || !idModalidade) {
      return res.status(400).json({ mensagem: "Dados em falta." });
    }

    const pool = await poolPromise;

    const existe = await pool
      .request()
      .input("IdAluno", sql.Int, idAluno)
      .input("IdModalidade", sql.Int, idModalidade).query(`
        SELECT 1 FROM ALUNO_MODALIDADE
        WHERE ALUNOid_aluno = @IdAluno AND MODALIDADEid_modalidade = @IdModalidade
      `);

    if (existe.recordset.length > 0) {
      return res
        .status(409)
        .json({ mensagem: "Já está inscrito nesta modalidade." });
    }

    await pool
      .request()
      .input("IdAluno", sql.Int, idAluno)
      .input("IdModalidade", sql.Int, idModalidade).query(`
        INSERT INTO ALUNO_MODALIDADE (ALUNOid_aluno, MODALIDADEid_modalidade)
        VALUES (@IdAluno, @IdModalidade)
      `);

    return res
      .status(201)
      .json({ mensagem: "Inscrição efetuada com sucesso." });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAgendaAulas,
  inscreverAlunoModalidade,
};
