/**
 * @fileoverview Controlador da Escola.
 * Responsável por gerir e fornecer dados base estruturais da escola, tais como
 * Anos Letivos, Modalidades, Salas, Professores e as respetivas associações e horários.
 */

const escolaModel = require("../models/escolaModel");

// ============================================================================
// ANOS LETIVOS
// ============================================================================

/**
 * Obtém a lista de todos os anos letivos configurados no sistema.
 * GET /api/escola/anos-letivos
 */
async function getAnosLetivos(req, res, next) {
  try {
    const anos = await escolaModel.getAnosLetivos();
    return res.status(200).json(anos);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// MODALIDADES
// ============================================================================

/**
 * Obtém a lista de modalidades (disciplinas/instrumentos) atualmente ativas.
 * GET /api/escola/modalidades
 */
async function getModalidades(req, res, next) {
  try {
    const modalidades = await escolaModel.getModalidadesAtivas();
    return res.status(200).json(modalidades);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// SALAS E COMPATIBILIDADES
// ============================================================================

/**
 * Obtém a lista de todas as salas da escola (com as suas capacidades).
 * GET /api/escola/salas
 */
async function getSalas(req, res, next) {
  try {
    const salas = await escolaModel.getSalas();
    return res.status(200).json(salas);
  } catch (error) {
    next(error);
  }
}

/**
 * Obtém a matriz completa de compatibilidade entre as salas e as modalidades.
 * Útil para saber globalmente que salas estão equipadas para que aulas.
 * GET /api/escola/compatibilidade
 */
async function getCompatibilidade(req, res, next) {
  try {
    const compatibilidade =
      await escolaModel.getCompatibilidadeSalasModalidades();
    return res.status(200).json(compatibilidade);
  } catch (error) {
    next(error);
  }
}

/**
 * Obtém apenas as salas adequadas/compatíveis para lecionar uma modalidade específica.
 * Usado habitualmente no formulário de aprovação de aulas pela Coordenação.
 * GET /api/escola/modalidades/:id/salas
 */
async function getSalasPorModalidade(req, res, next) {
  try {
    const idModalidade = parseInt(req.params.id);

    if (isNaN(idModalidade)) {
      return res.status(400).json({ mensagem: "ID de modalidade inválido." });
    }

    const salas = await escolaModel.getSalasPorModalidade(idModalidade);
    return res.status(200).json(salas);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GESTÃO DE PROFESSORES E ASSOCIAÇÕES
// ============================================================================

/**
 * US11 — Obtém a lista de todos os professores com estado ativo no sistema.
 * Útil para o painel de Administração ou Coordenação.
 * GET /api/escola/professores
 */
async function getProfessoresAtivos(req, res, next) {
  try {
    const lista = await escolaModel.getProfessoresAtivos();
    return res.status(200).json(lista);
  } catch (error) {
    next(error);
  }
}

/**
 * US05 — Obtém os professores habilitados a lecionar uma determinada modalidade.
 * Muito utilizado para popular as dropdowns aquando da submissão de um pedido de coaching pelo EE.
 * GET /api/escola/modalidades/:id/professores
 */
async function getProfessoresPorModalidade(req, res, next) {
  try {
    const idModalidade = parseInt(req.params.id);

    if (isNaN(idModalidade)) {
      return res.status(400).json({ mensagem: "ID de modalidade inválido." });
    }

    const professores =
      await escolaModel.getProfessoresPorModalidade(idModalidade);
    return res.status(200).json(professores);
  } catch (error) {
    next(error);
  }
}

/**
 * Obtém as modalidades que um professor específico está apto a lecionar.
 * GET /api/escola/professores/:id/modalidades
 */
async function getModalidadesPorProfessor(req, res, next) {
  try {
    const idProfessor = parseInt(req.params.id);

    if (isNaN(idProfessor)) {
      return res.status(400).json({ mensagem: "ID de professor inválido." });
    }

    const modalidades =
      await escolaModel.getModalidadesPorProfessor(idProfessor);
    return res.status(200).json(modalidades);
  } catch (error) {
    next(error);
  }
}

/**
 * US11 / RF13 — Associa uma nova modalidade a um professor (Coordenação).
 * Permite definir que o professor tem competência para dar aulas a essa disciplina.
 * POST /api/escola/professores/:id/modalidades
 * Body: { idModalidade }
 */
async function associarProfessorModalidade(req, res, next) {
  try {
    const idProfessor = parseInt(req.params.id);
    const { idModalidade } = req.body;

    // Validação de dados de entrada
    if (isNaN(idProfessor) || !idModalidade) {
      return res
        .status(400)
        .json({ mensagem: "ID de professor e idModalidade são obrigatórios." });
    }

    await escolaModel.associarProfessorModalidade(
      idProfessor,
      parseInt(idModalidade),
    );

    return res
      .status(201)
      .json({ mensagem: "Modalidade associada ao professor com sucesso." });
  } catch (error) {
    // Trata conflitos caso a associação já exista na base de dados
    if (
      error.message.includes("já existe") ||
      error.message.includes("já está associado")
    ) {
      return res.status(409).json({ mensagem: error.message });
    }
    next(error);
  }
}

/**
 * Remove a associação entre um professor e uma modalidade (Coordenação).
 * O professor deixa de estar disponível para lecionar essa disciplina.
 * DELETE /api/escola/professores/:id/modalidades/:idModalidade
 */
async function removerProfessorModalidade(req, res, next) {
  try {
    const idProfessor = parseInt(req.params.id);
    const idModalidade = parseInt(req.params.idModalidade);

    // Validação de IDs passados nos parâmetros da rota
    if (isNaN(idProfessor) || isNaN(idModalidade)) {
      return res.status(400).json({ mensagem: "IDs inválidos." });
    }

    const sucesso = await escolaModel.removerProfessorModalidade(
      idProfessor,
      idModalidade,
    );

    // Se a base de dados não afetar nenhuma linha, significa que o vínculo não existia
    if (!sucesso) {
      return res.status(404).json({ mensagem: "Associação não encontrada." });
    }

    return res
      .status(200)
      .json({ mensagem: "Associação removida com sucesso." });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// HORÁRIOS REGULARES
// ============================================================================

/**
 * Obtém os horários regulares de aulas (turmas fixas) da escola.
 * Permite filtrar por um Ano Letivo específico via query string.
 * GET /api/escola/horarios?idAnoLetivo=
 */
async function getHorarios(req, res, next) {
  try {
    const { idAnoLetivo } = req.query;

    // Parsing flexível para lidar com parâmetros nulos, vazios ou indefinidos
    const id =
      idAnoLetivo !== undefined && idAnoLetivo !== "" && idAnoLetivo != null
        ? parseInt(idAnoLetivo, 10)
        : null;

    // Se foi enviado um valor mas não é numérico, devolve erro
    if (idAnoLetivo !== undefined && idAnoLetivo !== "" && Number.isNaN(id)) {
      return res.status(400).json({ mensagem: "idAnoLetivo inválido." });
    }

    const horarios = await escolaModel.getHorariosPorAnoLetivo(id);
    return res.status(200).json(horarios);
  } catch (error) {
    next(error);
  }
}

// Exportação das funções do controlador
module.exports = {
  getAnosLetivos,
  getModalidades,
  getSalas,
  getCompatibilidade,
  getSalasPorModalidade,
  getProfessoresAtivos,
  getProfessoresPorModalidade,
  getModalidadesPorProfessor,
  associarProfessorModalidade,
  removerProfessorModalidade,
  getHorarios,
};
