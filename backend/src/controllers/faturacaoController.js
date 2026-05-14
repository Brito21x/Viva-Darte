/**
 * @fileoverview Controlador de Faturação Mensal.
 * @description Gere os endpoints de consulta, registo de pagamento e cancelamento de faturas.
 *
 * ROTAS
 * GET    /api/faturacao               → listar faturas
 * GET    /api/faturacao/resumo        → totais/estatísticas
 * GET    /api/faturacao/:id           → detalhe de uma fatura
 * GET    /api/faturacao/:id/linhas    → detalhe das linhas da fatura
 * PUT    /api/faturacao/:id/pagamento → marcar como paga
 * PUT    /api/faturacao/:id/cancelar  → cancelar fatura
 * GET    /api/faturacao/precos        → listar tabela de preços
 * PUT    /api/faturacao/precos/:id    → atualizar regra de preço
 */

const faturacaoModel = require("../models/faturacaoModel");
const { registarAuditoria } = require("../helpers/auditoriaHelper");

// ============================================================================
// LISTAGEM E DETALHE
// ============================================================================

/**
 * @async
 * @function getFaturas
 * @description Lista faturas com filtros opcionais por ano, mês e estado de pagamento.
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {Object} req.query - A query string da rota.
 * @param {string|number} [req.query.ano] - O ano para filtrar as faturas.
 * @param {string|number} [req.query.mes] - O mês para filtrar as faturas.
 * @param {string} [req.query.estado] - O estado de pagamento (ex: 'Pendente', 'Pago', 'Cancelado').
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Devolve um array de objetos correspondentes às faturas.
 */
async function getFaturas(req, res, next) {
  try {
    const { ano, mes, estado } = req.query;
    const faturas = await faturacaoModel.getFaturas({ ano, mes, estado });
    return res.status(200).json(faturas);
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function getResumo
 * @description Devolve totais agregados para popular os StatCards do dashboard.
 * @param {import('express').Request} req - O objeto do pedido (request).
 * @param {Object} req.query - A query string para filtrar o resumo.
 * @param {string|number} [req.query.ano] - O ano a considerar no resumo.
 * @param {string|number} [req.query.mes] - O mês a considerar no resumo.
 * @param {import('express').Response} res - O objeto da resposta (response).
 * @param {import('express').NextFunction} next - A função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Devolve um objeto com os totais/estatísticas.
 */
async function getResumo(req, res, next) {
  try {
    const { ano, mes } = req.query;
    const resumo = await faturacaoModel.getResumoFaturacao({ ano, mes });
    return res.status(200).json(resumo);
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function getFaturaPorId
 * @description Obtém o detalhe completo de uma fatura específica através do seu ID.
 * @param {import('express').Request} req - O objeto do pedido (request).
 * @param {string} req.params.id - O ID da fatura.
 * @param {import('express').Response} res - O objeto da resposta (response).
 * @param {import('express').NextFunction} next - A função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Devolve os dados da fatura ou um erro de não encontrada.
 */
async function getFaturaPorId(req, res, next) {
  try {
    const idFaturacao = parseInt(req.params.id);
    if (isNaN(idFaturacao)) {
      return res.status(400).json({ mensagem: "ID de fatura inválido." });
    }

    const fatura = await faturacaoModel.getFaturaPorId(idFaturacao);
    if (!fatura) {
      return res.status(404).json({ mensagem: "Fatura não encontrada." });
    }
    return res.status(200).json(fatura);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// AÇÕES
// ============================================================================

/**
 * @async
 * @function registarPagamento
 * @description Marca uma fatura como paga e regista o método e data de pagamento. Aciona a auditoria.
 * @param {import('express').Request} req - O pedido do Express.
 * @param {string} req.params.id - O ID da fatura a pagar.
 * @param {Object} req.body - O corpo do pedido.
 * @param {string} req.body.metodoPagamento - O método utilizado para pagamento (ex: 'Transferência Bancária', 'MBWAY').
 * @param {import('express').Response} res - A resposta do Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Mensagem de sucesso ou erro (se já estiver paga/cancelada).
 */
async function registarPagamento(req, res, next) {
  try {
    const idFaturacao = parseInt(req.params.id);
    const { metodoPagamento } = req.body;

    if (isNaN(idFaturacao)) {
      return res.status(400).json({ mensagem: "ID de fatura inválido." });
    }
    if (!metodoPagamento || String(metodoPagamento).trim() === "") {
      return res
        .status(400)
        .json({ mensagem: "O método de pagamento é obrigatório." });
    }

    // Verificar se a fatura existe e se já não está paga
    const fatura = await faturacaoModel.getFaturaPorId(idFaturacao);
    if (!fatura) {
      return res.status(404).json({ mensagem: "Fatura não encontrada." });
    }
    if (fatura.estado_pagamento === "Pago") {
      return res
        .status(409)
        .json({ mensagem: "Esta fatura já se encontra paga." });
    }
    if (fatura.estado_pagamento === "Cancelado") {
      return res
        .status(409)
        .json({ mensagem: "Não é possível pagar uma fatura cancelada." });
    }

    const sucesso = await faturacaoModel.registarPagamento(
      idFaturacao,
      metodoPagamento.trim(),
    );
    if (!sucesso) {
      return res
        .status(500)
        .json({ mensagem: "Não foi possível atualizar a fatura." });
    }

    registarAuditoria(req, {
      tipo: "FATURA_PAGAR",
      descricao: `Fatura #${idFaturacao} marcada como Paga (${metodoPagamento.trim()}) — ${fatura.nome_utilizador || "Utilizador #" + fatura.UTILIZADORid_utilizador}`,
      entidadeTipo: "FATURA",
      entidadeId: idFaturacao,
      dadosExtra: {
        metodoPagamento: metodoPagamento.trim(),
        total: Number(fatura.total) || 0,
        ano: fatura.ano,
        mes: fatura.mes,
      },
    });

    return res
      .status(200)
      .json({ mensagem: "Pagamento registado com sucesso." });
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function cancelarFatura
 * @description Cancela uma fatura (apenas aplicável se a mesma estiver "Pendente"). Aciona a auditoria.
 * @param {import('express').Request} req - O pedido do Express.
 * @param {string} req.params.id - O ID da fatura a cancelar.
 * @param {import('express').Response} res - A resposta do Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Mensagem de sucesso ou erro (se já estiver paga).
 */
async function cancelarFatura(req, res, next) {
  try {
    const idFaturacao = parseInt(req.params.id);
    if (isNaN(idFaturacao)) {
      return res.status(400).json({ mensagem: "ID de fatura inválido." });
    }

    const fatura = await faturacaoModel.getFaturaPorId(idFaturacao);
    if (!fatura) {
      return res.status(404).json({ mensagem: "Fatura não encontrada." });
    }
    if (fatura.estado_pagamento === "Pago") {
      return res
        .status(409)
        .json({ mensagem: "Não é possível cancelar uma fatura já paga." });
    }

    const sucesso = await faturacaoModel.cancelarFatura(idFaturacao);
    if (!sucesso) {
      return res
        .status(500)
        .json({ mensagem: "Não foi possível cancelar a fatura." });
    }

    registarAuditoria(req, {
      tipo: "FATURA_CANCELAR",
      descricao: `Fatura #${idFaturacao} cancelada — ${fatura.nome_utilizador || "Utilizador #" + fatura.UTILIZADORid_utilizador}`,
      entidadeTipo: "FATURA",
      entidadeId: idFaturacao,
      dadosExtra: {
        total: Number(fatura.total) || 0,
        ano: fatura.ano,
        mes: fatura.mes,
      },
    });

    return res.status(200).json({ mensagem: "Fatura cancelada com sucesso." });
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function listarPrecos
 * @description Lista a tabela com todas as regras de preços configuradas no sistema.
 * @param {import('express').Request} req - O pedido do Express.
 * @param {import('express').Response} res - A resposta do Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Array com os preços.
 */
async function listarPrecos(req, res, next) {
  try {
    const precos = await faturacaoModel.getTabelaPrecos();
    return res.status(200).json(precos);
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function atualizarRegraPreco
 * @description Atualiza um valor ou o estado ativo de uma regra de preço existente.
 * @param {import('express').Request} req - O pedido do Express.
 * @param {string} req.params.id - O ID da regra de preço a atualizar.
 * @param {Object} req.body - O corpo do pedido.
 * @param {number} [req.body.preco] - O novo valor da regra de preço.
 * @param {boolean} [req.body.ativo] - O novo estado ativo/inativo da regra.
 * @param {import('express').Response} res - A resposta do Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Mensagem de sucesso ou erro.
 */
async function atualizarRegraPreco(req, res, next) {
  try {
    const idPreco = parseInt(req.params.id);
    const { preco, ativo } = req.body;

    if (isNaN(idPreco)) {
      return res.status(400).json({ mensagem: "ID de regra inválido." });
    }

    const sucesso = await faturacaoModel.atualizarPreco(idPreco, preco, ativo);

    if (sucesso) {
      return res
        .status(200)
        .json({ mensagem: "Preço atualizado com sucesso!" });
    } else {
      return res
        .status(404)
        .json({ mensagem: "Regra de preço não encontrada." });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function getLinhasFatura
 * @description Devolve o detalhe de uma fatura específica: o cabeçalho mais a lista de aulas (coachings)
 * que a compõem (modalidade, data, hora, professor, sala, valor faturado).
 * @param {import('express').Request} req - O pedido do Express.
 * @param {string} req.params.id - O ID da fatura.
 * @param {import('express').Response} res - A resposta do Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Devolve o objeto da fatura e as respetivas linhas de detalhe.
 */
async function getLinhasFatura(req, res, next) {
  try {
    const idFaturacao = parseInt(req.params.id);
    if (isNaN(idFaturacao)) {
      return res.status(400).json({ mensagem: "ID de fatura inválido." });
    }

    const detalhe = await faturacaoModel.getLinhasDaFatura(idFaturacao);
    if (!detalhe) {
      return res.status(404).json({ mensagem: "Fatura não encontrada." });
    }
    return res.status(200).json(detalhe);
  } catch (error) {
    next(error);
  }
}

/**
 * @module faturacaoController
 */
module.exports = {
  getFaturas,
  getResumo,
  getFaturaPorId,
  registarPagamento,
  cancelarFatura,
  listarPrecos,
  atualizarRegraPreco,
  getLinhasFatura,
};
