/**
 * @fileoverview Controlador de Inventário (Peças, Empréstimos e Vendas).
 * Este ficheiro gere o catálogo de peças, requisições de empréstimo, devoluções,
 * penalizações por danos/atrasos e o mercado de vendas da escola.
 */

const inventarioModel = require("../models/inventarioModel");
const { registarAuditoria } = require("../helpers/auditoriaHelper");

// ============================================================================
// CATÁLOGO E DETALHES DE PEÇAS
// ============================================================================

/**
 * Obtém a lista completa de peças disponíveis no catálogo do inventário.
 * GET /api/inventario/catalogo
 */
async function getCatalogo(req, res, next) {
  try {
    return res.status(200).json(await inventarioModel.getCatalogoPecas());
  } catch (error) {
    next(error);
  }
}

/**
 * Obtém os detalhes completos de uma peça específica, incluindo as suas fotografias.
 * GET /api/inventario/pecas/:id
 */
async function getPecaDetalhes(req, res, next) {
  try {
    const idPeca = parseInt(req.params.id);

    // Validação básica do parâmetro da rota
    if (isNaN(idPeca)) {
      return res.status(400).json({ mensagem: "ID de peça inválido." });
    }

    const peca = await inventarioModel.getPecaDetalhes(idPeca);

    if (!peca) {
      return res
        .status(404)
        .json({ mensagem: "Peça não encontrada no sistema." });
    }

    return res.status(200).json(peca);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GESTÃO DO INVENTÁRIO
// ============================================================================

/**
 * Regista uma nova peça no inventário do sistema.
 * Configura automaticamente a peça para empréstimo e/ou venda consoante os parâmetros submetidos.
 * POST /api/inventario/pecas
 */
async function registarPeca(req, res, next) {
  try {
    const {
      nome,
      descricao,
      tamanho,
      estado,
      idCategoria,
      fotos,
      valor_dia,
      metodos_pagamento,
      disponivelVenda,
    } = req.body;

    // Identifica o utilizador (criador/dono da peça) através do token JWT
    const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;

    // Lógica de negócio: Deteção inteligente do tipo de transação (Empréstimo ou Venda)
    // Se tem um "valor ao dia", é porque está disponível para empréstimo/aluguer.
    const isEmprestimo = valor_dia !== undefined && valor_dia !== "";
    // Está para venda se explicitly dito, ou se não for para empréstimo.
    const isVenda =
      disponivelVenda === true || disponivelVenda === "true" || !isEmprestimo;

    // Processamento e normalização dos métodos de pagamento para formato em string separada por vírgulas
    const metodosStr =
      metodos_pagamento &&
      Array.isArray(metodos_pagamento) &&
      metodos_pagamento.length > 0
        ? metodos_pagamento.join(",")
        : "MBWay";

    // Guarda a peça principal na base de dados e obtém o ID gerado
    const idPeca = await inventarioModel.registarNovaPeca({
      nome,
      descricao,
      tamanho,
      estado,
      idUtilizador,
      idCategoria: parseInt(idCategoria) || 1, // Fallback para categoria geral caso não enviada
      isEmprestimo,
      isVenda,
      valor_dia: parseFloat(valor_dia || 0),
      metodosStr,
    });

    // Se existirem fotografias submetidas, faz o registo em lote das mesmas
    if (fotos && Array.isArray(fotos) && fotos.length > 0) {
      try {
        await inventarioModel.registarFotosPeca(idPeca, fotos);
      } catch (e) {
        // Apenas logamos o erro, não falhamos a resposta HTTP se a peça já foi criada
        console.error("Aviso: Falha ao guardar as fotografias da peça", e);
      }
    }

    // Auditoria: nova peça no inventário
    registarAuditoria(req, {
      tipo: "PECA_CRIAR",
      descricao: `Peça "${nome}" registada (${isVenda ? "venda" : ""}${isVenda && isEmprestimo ? " + " : ""}${isEmprestimo ? "empréstimo" : ""})`,
      entidadeTipo: "PECA",
      entidadeId: idPeca,
      dadosExtra: { nome, tamanho, estado, isVenda, isEmprestimo },
    });

    return res
      .status(201)
      .json({ mensagem: "Peça guardada com sucesso!", idPeca });
  } catch (error) {
    next(error);
  }
}

/**
 * Atualiza o estado físico de conservação, a disponibilidade comercial e a localização da peça.
 * PUT /api/inventario/pecas/:id/estado
 */
async function atualizarEstadoPeca(req, res, next) {
  try {
    const idPeca = parseInt(req.params.id);
    const { estado, disponivelEmprestimo, disponivelVenda, localizacao } =
      req.body;

    if (isNaN(idPeca)) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    const sucesso = await inventarioModel.atualizarEstadoPeca(idPeca, {
      estado,
      disponivelEmprestimo: disponivelEmprestimo ?? false,
      disponivelVenda: disponivelVenda ?? false,
      localizacao: localizacao || null,
    });

    if (!sucesso) {
      return res.status(404).json({ mensagem: "Peça não encontrada." });
    }
    return res
      .status(200)
      .json({ mensagem: "Estado da peça atualizado com sucesso." });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// EMPRÉSTIMOS E DEVOLUÇÕES
// ============================================================================

/**
 * Regista uma nova requisição de empréstimo ou aluguer de peças por parte de um utilizador.
 * POST /api/inventario/emprestimos
 */
async function requisitarEmprestimo(req, res, next) {
  try {
    const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;
    const { dataInicio, dataFim, observacoes, metodoPagamento, itens } =
      req.body;

    // Validação estrita: Um empréstimo precisa obrigatoriamente de ter peças associadas
    if (!itens || itens.length === 0) {
      return res.status(400).json({
        mensagem: "É necessário indicar a peça que pretende requisitar.",
      });
    }

    // Para simplificação de contexto atual, assume a primeira peça do array
    // (A arquitetura suporta expansão para múltiplos itens no futuro)
    const idPeca = parseInt(itens[0].idPeca);
    const estadoEntrega = itens[0].estadoEntrega;

    // Agrupa todos os dados e delega a transação para o Model
    await inventarioModel.requisitarEmprestimo({
      idPeca,
      dataInicio,
      dataFim,
      observacoes,
      metodoPagamento,
      estadoEntrega,
      idUtilizador,
    });

    // Auditoria: empréstimo solicitado
    registarAuditoria(req, {
      tipo: "EMPRESTIMO_PEDIR",
      descricao: `Empréstimo solicitado para peça #${idPeca} (${dataInicio} → ${dataFim})`,
      entidadeTipo: "PECA",
      entidadeId: idPeca,
      dadosExtra: { dataInicio, dataFim, metodoPagamento, estadoEntrega },
    });

    return res
      .status(200)
      .json({ mensagem: "Solicitação de empréstimo enviada com sucesso!" });
  } catch (error) {
    // Tratamento de peças não encontradas ou indisponíveis
    if (error.message.includes("não encontrada")) {
      return res.status(404).json({ mensagem: error.message });
    }
    next(error);
  }
}

/**
 * Regista a devolução de um empréstimo em curso, avaliando o estado final com que as peças foram entregues.
 * POST /api/inventario/emprestimos/:id/devolucao
 */
async function registarDevolucao(req, res, next) {
  try {
    const idEmprestimo = parseInt(req.params.id);
    const { estadoFinal, observacoes, itens } = req.body;

    if (isNaN(idEmprestimo)) {
      return res.status(400).json({ mensagem: "ID de empréstimo inválido." });
    }
    if (!estadoFinal) {
      return res
        .status(400)
        .json({ mensagem: "O estado final do empréstimo é obrigatório." });
    }

    // Garante que o estado de devolução de todos os itens envolvidos foi reportado corretamente
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({
        mensagem:
          "É necessário indicar o estado de devolução de cada peça associada.",
      });
    }

    for (const item of itens) {
      if (!item.idPeca || !item.estadoDevolucao) {
        return res.status(400).json({
          mensagem:
            "Cada item deve ter o respetivo idPeca e estadoDevolucao preenchidos.",
        });
      }
    }

    await inventarioModel.registarDevolucaoEmprestimo(
      idEmprestimo,
      estadoFinal,
      observacoes || null,
      itens.map((i) => ({
        idPeca: parseInt(i.idPeca),
        estadoDevolucao: i.estadoDevolucao,
      })),
    );

    // Auditoria: devolução registada
    registarAuditoria(req, {
      tipo: "EMPRESTIMO_DEVOLVER",
      descricao: `Devolução do empréstimo #${idEmprestimo} (estado: ${estadoFinal})`,
      entidadeTipo: "EMPRESTIMO",
      entidadeId: idEmprestimo,
      dadosExtra: { estadoFinal, totalItens: itens.length },
    });

    return res
      .status(200)
      .json({ mensagem: "Devolução registada com sucesso." });
  } catch (error) {
    next(error);
  }
}

/**
 * Aplica uma penalização (multa monetária) associada a um empréstimo (Atraso, Dano ou Perda).
 * Exclusivo para perfis de Coordenação/Administração.
 * POST /api/inventario/emprestimos/:id/penalizacao
 */
async function registarPenalizacao(req, res, next) {
  try {
    const idEmprestimo = parseInt(req.params.id);
    const { idPeca, tipo, valor, descricao } = req.body;

    if (isNaN(idEmprestimo)) {
      return res.status(400).json({ mensagem: "ID de empréstimo inválido." });
    }
    if (!idPeca || !tipo || valor === undefined) {
      return res.status(400).json({
        mensagem:
          "idPeca, tipo de penalização e valor são parâmetros obrigatórios.",
      });
    }

    // Validação estrita dos tipos de penalização previstos na base de dados
    const tiposValidos = ["Atraso", "Dano", "Perda"];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        mensagem: `Tipo inválido. Valores aceites: ${tiposValidos.join(", ")}.`,
      });
    }

    // Validação da regra de negócio: Multas não podem ter valores negativos nem nulos
    if (Number(valor) <= 0) {
      return res.status(400).json({
        mensagem:
          "O valor financeiro da penalização deve ser um número positivo.",
      });
    }

    const idPenalizacao = await inventarioModel.registarPenalizacao({
      tipo,
      valor: parseFloat(valor),
      descricao: descricao || null,
      idPeca: parseInt(idPeca),
      idEmprestimo,
    });

    return res
      .status(201)
      .json({ mensagem: "Penalização aplicada com sucesso.", idPenalizacao });
  } catch (error) {
    next(error);
  }
}

/**
 * Atualiza o estado do pagamento referente aos custos de um empréstimo.
 * PUT /api/inventario/emprestimos/:id/pagamento
 */
async function registarPagamentoEmprestimo(req, res, next) {
  try {
    const idEmprestimo = parseInt(req.params.id);
    const { valor, metodoPagamento, estadoPagamento } = req.body;

    if (isNaN(idEmprestimo)) {
      return res.status(400).json({ mensagem: "ID de empréstimo inválido." });
    }
    if (valor === undefined || !metodoPagamento || !estadoPagamento) {
      return res.status(400).json({
        mensagem:
          "O valor, método de pagamento e o estado do pagamento são obrigatórios.",
      });
    }

    const sucesso = await inventarioModel.atualizarPagamentoEmprestimo(
      idEmprestimo,
      parseFloat(valor),
      metodoPagamento,
      estadoPagamento,
    );

    if (!sucesso) {
      return res.status(404).json({ mensagem: "Empréstimo não encontrado." });
    }

    return res.status(200).json({
      mensagem: "Pagamento do empréstimo atualizado e registado com sucesso.",
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// MERCADO DE VENDAS
// ============================================================================

/**
 * Lista todas as peças que se encontram atualmente marcadas como disponíveis para venda direta.
 * GET /api/inventario/vendas
 */
async function getPecasAVenda(req, res, next) {
  try {
    return res.status(200).json(await inventarioModel.getPecasAVenda());
  } catch (error) {
    next(error);
  }
}

/**
 * Coloca uma peça do catálogo à venda, definindo um preço comercial.
 * POST /api/inventario/vendas
 */
async function colocarPecaAVenda(req, res, next) {
  try {
    const idVendedor = req.utilizador.id || req.utilizador.id_utilizador;
    const { idPeca, preco, nomePeca, condicaoPeca, metodosPagamento } =
      req.body;

    if (!idPeca || preco === undefined) {
      return res
        .status(400)
        .json({ mensagem: "Faltam dados obrigatórios para criar a venda." });
    }
    if (Number(preco) <= 0) {
      return res
        .status(400)
        .json({ mensagem: "O preço de venda deve ser superior a zero." });
    }

    // Processa os métodos de pagamento em string para gravação na BD, com fallback padrão
    const metodosStr =
      metodosPagamento &&
      Array.isArray(metodosPagamento) &&
      metodosPagamento.length > 0
        ? metodosPagamento.join(",")
        : "MBWay,Transferência,Numerário";

    const idVenda = await inventarioModel.colocarPecaAVenda(
      parseInt(idPeca),
      parseFloat(preco),
      idVendedor,
      nomePeca,
      condicaoPeca,
      metodosStr,
    );

    registarAuditoria(req, {
      tipo: "VENDA_COLOCAR",
      descricao: `Peça "${nomePeca || `#${idPeca}`}" colocada à venda por ${Number(preco).toFixed(2)}€`,
      entidadeTipo: "VENDA",
      entidadeId: idVenda,
      dadosExtra: { idPeca: parseInt(idPeca), preco: parseFloat(preco) },
    });

    return res
      .status(201)
      .json({ mensagem: "Peça colocada à venda com sucesso.", idVenda });
  } catch (error) {
    next(error);
  }
}

/**
 * Edita todos os detalhes e metadados de uma peça de forma faseada.
 * Atualiza os dados base, os dados de venda e substitui a galeria de fotografias.
 * PUT /api/inventario/pecas/:id
 */
async function editarPeca(req, res, next) {
  try {
    const idPeca = parseInt(req.params.id);
    const { nome, descricao, tamanho, estado, preco, fotos, metodosPagamento } =
      req.body;

    if (isNaN(idPeca)) {
      return res.status(400).json({ mensagem: "ID de peça inválido." });
    }
    if (preco !== undefined && Number(preco) <= 0) {
      return res.status(400).json({ mensagem: "O preço definido é inválido." });
    }

    const metodosStr =
      metodosPagamento &&
      Array.isArray(metodosPagamento) &&
      metodosPagamento.length > 0
        ? metodosPagamento.join(",")
        : "MBWay,Transferência,Numerário";

    // Atualização faseada para garantir a integridade da transação modular
    // 1. Dados físicos e genéricos
    await inventarioModel.atualizarDadosCompletosPeca(idPeca, {
      nome,
      descricao,
      tamanho,
      estado,
    });

    // 2. Dados comerciais (se um novo preço foi submetido)
    if (preco !== undefined) {
      await inventarioModel.atualizarDadosVenda(
        idPeca,
        parseFloat(preco),
        nome,
        estado,
        metodosStr,
      );
    }

    // 3. Galeria de Imagens (substituição total caso seja enviada uma nova array)
    if (fotos && Array.isArray(fotos)) {
      await inventarioModel.atualizarFotosPeca(idPeca, fotos);
    }

    registarAuditoria(req, {
      tipo: "PECA_EDITAR",
      descricao: `Peça #${idPeca}${nome ? ` ("${nome}")` : ""} editada`,
      entidadeTipo: "PECA",
      entidadeId: idPeca,
      dadosExtra: { nome, tamanho, estado, preco },
    });

    return res
      .status(200)
      .json({ mensagem: "Os dados da peça foram atualizados com sucesso." });
  } catch (error) {
    next(error);
  }
}

/**
 * Apaga uma peça do catálogo de forma definitiva e irreversível do sistema.
 * DELETE /api/inventario/pecas/:id
 */
async function apagarPeca(req, res, next) {
  try {
    const idPeca = parseInt(req.params.id);
    if (isNaN(idPeca)) {
      return res.status(400).json({ mensagem: "ID de peça inválido." });
    }

    const sucesso = await inventarioModel.eliminarPecaCompleta(idPeca);

    if (!sucesso) {
      return res
        .status(404)
        .json({ mensagem: "A peça que tentou apagar não foi encontrada." });
    }

    registarAuditoria(req, {
      tipo: "PECA_APAGAR",
      descricao: `Peça #${idPeca} eliminada do inventário`,
      entidadeTipo: "PECA",
      entidadeId: idPeca,
    });

    return res
      .status(200)
      .json({ mensagem: "Peça removida do inventário com sucesso." });
  } catch (error) {
    next(error);
  }
}

/**
 * Regista o fecho formal de uma venda de uma peça, transferindo a posse lógica no sistema.
 * POST /api/inventario/vendas/:id/conclusao
 */
async function registarConclusaoVenda(req, res, next) {
  try {
    const idVenda = parseInt(req.params.id);
    const { idComprador, metodoPagamento } = req.body;

    if (isNaN(idVenda) || !idComprador) {
      return res.status(400).json({
        mensagem: "Os dados submetidos são inválidos ou insuficientes.",
      });
    }

    await inventarioModel.registarConclusaoVenda(
      idVenda,
      parseInt(idComprador),
      metodoPagamento,
    );

    registarAuditoria(req, {
      tipo: "VENDA_CONCLUIR",
      descricao: `Venda #${idVenda} concluída (comprador: ${idComprador}, método: ${metodoPagamento || "—"})`,
      entidadeTipo: "VENDA",
      entidadeId: idVenda,
      dadosExtra: { idComprador, metodoPagamento },
    });

    return res
      .status(200)
      .json({ mensagem: "A venda foi concluída e fechada com sucesso." });
  } catch (error) {
    next(error);
  }
}

// Exportação global dos métodos para utilização nas respetivas rotas do Express
module.exports = {
  getCatalogo,
  getPecaDetalhes,
  registarPeca,
  atualizarEstadoPeca,
  requisitarEmprestimo,
  registarDevolucao,
  registarPenalizacao,
  registarPagamentoEmprestimo,
  getPecasAVenda,
  colocarPecaAVenda,
  editarPeca,
  apagarPeca,
  registarConclusaoVenda,
};
