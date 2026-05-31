/**
 * @fileoverview Controlador para a Agenda de Aulas.
 */

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

module.exports = {
  getAgendaAulas,
};
