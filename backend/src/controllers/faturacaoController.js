/**
 * @fileoverview Controlador de Faturação Mensal.
 * Gere os endpoints de consulta, registo de pagamento e cancelamento de faturas.
 *
 * ROTAS (registar no ficheiro de rotas do Express):
 *   GET    /api/faturacao              → listar faturas (filtros: ?ano=&mes=&estado=)
 *   GET    /api/faturacao/resumo       → totais/estatísticas
 *   GET    /api/faturacao/:id          → detalhe de uma fatura
 *   PUT    /api/faturacao/:id/pagamento → marcar como paga
 *   PUT    /api/faturacao/:id/cancelar  → cancelar fatura
 */

const faturacaoModel = require("../models/faturacaoModel");
const { registarAuditoria } = require("../helpers/auditoriaHelper");

// ============================================================================
// LISTAGEM E DETALHE
// ============================================================================

/**
 * GET /api/faturacao
 * Lista faturas com filtros opcionais por ano, mês e estado de pagamento.
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
 * GET /api/faturacao/resumo
 * Devolve totais agregados para os StatCards do dashboard.
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
 * GET /api/faturacao/:id
 * Detalhe completo de uma fatura específica.
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
 * PUT /api/faturacao/:id/pagamento
 * Marca a fatura como paga e regista o método e data de pagamento.
 * Body: { metodoPagamento: string }
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
 * PUT /api/faturacao/:id/cancelar
 * Cancela uma fatura (apenas se estiver Pendente).
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

async function listarPrecos(req, res, next) {
  try {
    const precos = await faturacaoModel.getTabelaPrecos();
    return res.status(200).json(precos);
  } catch (error) {
    next(error);
  }
}

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
 * GET /api/faturacao/:id/linhas
 * Devolve o detalhe de uma fatura: cabeçalho + lista de aulas (coachings)
 * que a compõem (modalidade, data, hora, professor, sala, valor).
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
