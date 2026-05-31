/**
 * @fileoverview Controlador para a Agenda de Aulas.
 */

const agendaModel = require("../models/agendaModel");
const { utilizadorTemPerfil } = require("../middlewares/auth");

async function getAgendaAulasComCoaching(req, res, next) {
  try {
    const idUtilizador = req.utilizador.id_utilizador || req.utilizador.id;
    const perfis = req.utilizador.perfis || [];

    let horarios = [];
    let coachings = [];

    if (utilizadorTemPerfil(perfis, "Professor")) {
      horarios = await agendaModel.getHorariosPorProfessor(idUtilizador);
      coachings = await agendaModel.getCoachingsPorProfessor(idUtilizador);
    } else if (
      utilizadorTemPerfil(perfis, "EE") ||
      utilizadorTemPerfil(perfis, "Encarregado de Educação") ||
      utilizadorTemPerfil(perfis, "Encarregado")
    ) {
      horarios = await agendaModel.getHorariosPorEncarregado(idUtilizador);
      coachings = await agendaModel.getCoachingsPorEncarregado(idUtilizador);
    } else {
      return res
        .status(403)
        .json({ mensagem: "Acesso não autorizado a esta agenda." });
    }

    // Mapeamento seguro: converte a data "YYYY-MM-DD" para dia da semana
    const coachingsMarcados = coachings.map((c) => {
      const dataObj = new Date(c.data_aula);
      const diaJS = dataObj.getDay(); // 0 = Domingo, 1 = Segunda ... 6 = Sábado
      const diaApp = diaJS === 0 ? 7 : diaJS; // A app espera: 1=Seg ... 7=Dom

      return {
        ...c,
        dia_semana: diaApp,
        tipo: "coaching",
      };
    });

    const horariosMarcados = horarios.map((h) => ({ ...h, tipo: "aula" }));

    // Junta as aulas normais e os coachings e devolve
    return res.status(200).json([...horariosMarcados, ...coachingsMarcados]);
  } catch (error) {
    next(error);
  }
}

async function getEducandosDoEE(req, res, next) {
  try {
    const idEE = req.utilizador.id_utilizador || req.utilizador.id;
    const educandos = await agendaModel.getEducandosPorEE(idEE);
    return res.status(200).json(educandos);
  } catch (error) {
    next(error);
  }
}

async function getModalidadesDoAluno(req, res, next) {
  try {
    const { idAluno } = req.params;
    const modalidades = await agendaModel.getModalidadesDoAluno(
      Number(idAluno),
    );
    return res.status(200).json(modalidades);
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

    const jaInscrito = await agendaModel.verificarInscricao(
      Number(idAluno),
      Number(idModalidade),
    );

    if (jaInscrito) {
      return res
        .status(409)
        .json({ mensagem: "Já está inscrito nesta modalidade." });
    }

    await agendaModel.inscreverAluno(Number(idAluno), Number(idModalidade));

    return res
      .status(201)
      .json({ mensagem: "Inscrição efetuada com sucesso." });
  } catch (error) {
    next(error);
  }
}

async function removerModalidadeAluno(req, res, next) {
  try {
    const { idAluno, idModalidade } = req.body;
    if (!idAluno || !idModalidade) {
      return res.status(400).json({ mensagem: "Dados em falta." });
    }

    await agendaModel.removerInscricao(Number(idAluno), Number(idModalidade));

    return res
      .status(200)
      .json({ mensagem: "Inscrição removida com sucesso." });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAgendaAulas: getAgendaAulasComCoaching,
  getEducandosDoEE,
  getModalidadesDoAluno,
  inscreverAlunoModalidade,
  removerModalidadeAluno,
};
