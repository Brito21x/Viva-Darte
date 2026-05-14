/**
 * @fileoverview Controlador da Escola.
 * @description Responsável por gerir e fornecer dados base estruturais da escola, tais como
 * Anos Letivos, Modalidades, Salas, Professores e as respetivas associações e horários.
 */

const escolaModel = require("../models/escolaModel");

// ============================================================================
// ANOS LETIVOS
// ============================================================================

/**
 * @async
 * @function getAnosLetivos
 * @description Obtém a lista de todos os anos letivos configurados no sistema. (GET /api/escola/anos-letivos)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve o array com os anos letivos.
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
 * @async
 * @function getModalidades
 * @description Obtém a lista de modalidades (disciplinas/instrumentos) atualmente ativas. (GET /api/escola/modalidades)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve o array com as modalidades ativas.
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
 * @async
 * @function getSalas
 * @description Obtém a lista de todas as salas da escola (com as suas capacidades). (GET /api/escola/salas)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve o array com as salas.
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
 * @async
 * @function getCompatibilidade
 * @description Obtém a matriz completa de compatibilidade entre as salas e as modalidades.
 * Útil para saber globalmente que salas estão equipadas para que aulas. (GET /api/escola/compatibilidade)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve a lista com as compatibilidades.
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
 * @async
 * @function getSalasPorModalidade
 * @description Obtém apenas as salas adequadas/compatíveis para lecionar uma modalidade específica.
 * Usado habitualmente no formulário de aprovação de aulas pela Coordenação. (GET /api/escola/modalidades/:id/salas)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID da modalidade a filtrar.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve o array de salas compatíveis ou uma mensagem de erro.
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
 * @async
 * @function getProfessoresAtivos
 * @description US11 — Obtém a lista de todos os professores com estado ativo no sistema.
 * Útil para o painel de Administração ou Coordenação. (GET /api/escola/professores)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve a lista de professores ativos.
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
 * @async
 * @function getProfessoresPorModalidade
 * @description US05 — Obtém os professores habilitados a lecionar uma determinada modalidade.
 * Muito utilizado para popular as dropdowns aquando da submissão de um pedido de coaching pelo EE. (GET /api/escola/modalidades/:id/professores)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID da modalidade pretendida.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve a lista de professores ou uma mensagem de erro.
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
 * @async
 * @function getModalidadesPorProfessor
 * @description Obtém as modalidades que um professor específico está apto a lecionar. (GET /api/escola/professores/:id/modalidades)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID do professor a consultar.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve a lista de modalidades associadas ao professor.
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
 * @async
 * @function associarProfessorModalidade
 * @description US11 / RF13 — Associa uma nova modalidade a um professor (Coordenação).
 * Permite definir que o professor tem competência para dar aulas a essa disciplina. (POST /api/escola/professores/:id/modalidades)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID do professor.
 * @param {Object} req.body - O corpo do pedido.
 * @param {number|string} req.body.idModalidade - O ID da modalidade a associar.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem de sucesso ou erro (ex: conflito).
 */
async function associarProfessorModalidade(req, res, next) {
  try {
    const idProfessor = parseInt(req.params.id);
    const { idModalidade } = req.body;

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
 * @async
 * @function removerProfessorModalidade
 * @description Remove a associação entre um professor e uma modalidade (Coordenação).
 * O professor deixa de estar disponível para lecionar essa disciplina. (DELETE /api/escola/professores/:id/modalidades/:idModalidade)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID do professor.
 * @param {string} req.params.idModalidade - O ID da modalidade a remover.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem de sucesso ou erro caso não exista.
 */
async function removerProfessorModalidade(req, res, next) {
  try {
    const idProfessor = parseInt(req.params.id);
    const idModalidade = parseInt(req.params.idModalidade);

    if (isNaN(idProfessor) || isNaN(idModalidade)) {
      return res.status(400).json({ mensagem: "IDs inválidos." });
    }

    const sucesso = await escolaModel.removerProfessorModalidade(
      idProfessor,
      idModalidade,
    );

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
 * @async
 * @function getHorarios
 * @description Obtém os horários regulares de aulas (turmas fixas) da escola.
 * Permite filtrar por um Ano Letivo específico via query string. (GET /api/escola/horarios?idAnoLetivo=)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {Object} req.query - Os parâmetros enviados na query string do pedido.
 * @param {string} [req.query.idAnoLetivo] - O ID do ano letivo para filtrar os horários.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve a lista de horários.
 */
async function getHorarios(req, res, next) {
  try {
    const { idAnoLetivo } = req.query;

    const id =
      idAnoLetivo !== undefined && idAnoLetivo !== "" && idAnoLetivo != null
        ? parseInt(idAnoLetivo, 10)
        : null;

    if (idAnoLetivo !== undefined && idAnoLetivo !== "" && Number.isNaN(id)) {
      return res.status(400).json({ mensagem: "idAnoLetivo inválido." });
    }

    const horarios = await escolaModel.getHorariosPorAnoLetivo(id);
    return res.status(200).json(horarios);
  } catch (error) {
    next(error);
  }
}

/**
 * @module escolaController
 */
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
