/**
 * @fileoverview Controlador de Inventário (Peças, Empréstimos e Vendas).
 * @description Este ficheiro gere o catálogo de peças, requisições de empréstimo, devoluções,
 * penalizações por danos/atrasos e o mercado de vendas da escola.
 */

const inventarioModel = require("../models/inventarioModel");
const { registarAuditoria } = require("../helpers/auditoriaHelper");

// ============================================================================
// CATÁLOGO E DETALHES DE PEÇAS
// ============================================================================

/**
 * @async
 * @function getCatalogo
 * @description Obtém a lista completa de peças disponíveis no catálogo do inventário. (GET /api/inventario/catalogo)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve o array com o catálogo de peças.
 */
async function getCatalogo(req, res, next) {
  try {
    return res.status(200).json(await inventarioModel.getCatalogoPecas());
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function getPecaDetalhes
 * @description Obtém os detalhes completos de uma peça específica, incluindo as suas fotografias. (GET /api/inventario/pecas/:id)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID da peça a consultar.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve o objeto com os detalhes da peça ou uma mensagem de erro.
 */
async function getPecaDetalhes(req, res, next) {
  try {
    const idPeca = parseInt(req.params.id);

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
 * @async
 * @function registarPeca
 * @description Regista uma nova peça no inventário do sistema.
 * Configura automaticamente a peça para empréstimo e/ou venda consoante os parâmetros submetidos. (POST /api/inventario/pecas)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {Object} req.body - O corpo do pedido.
 * @param {string} req.body.nome - O nome da peça.
 * @param {string} req.body.descricao - A descrição da peça.
 * @param {string} req.body.tamanho - O tamanho da peça.
 * @param {string} req.body.estado - O estado de conservação da peça.
 * @param {number|string} [req.body.idCategoria] - O ID da categoria da peça.
 * @param {Array<string>} [req.body.fotos] - Array com os URLs ou base64 das fotografias da peça.
 * @param {number|string} [req.body.valor_dia] - O valor cobrado por dia (para empréstimos).
 * @param {Array<string>} [req.body.metodos_pagamento] - Os métodos de pagamento aceites.
 * @param {boolean|string} [req.body.disponivelVenda] - Indica se a peça está disponível para venda.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem de sucesso e o ID da nova peça.
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
      metodosPagamento,
      metodos_pagamento,
      disponivelVenda,
    } = req.body;

    const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;

    const isEmprestimo = req.body.disponibilidade === "Emprestimo";
    const isVenda = req.body.disponibilidade === "Venda";

    const metodosSelect = metodosPagamento || metodos_pagamento;
    const metodosStr =
      metodosSelect && Array.isArray(metodosSelect) && metodosSelect.length > 0
        ? metodosSelect.join(",")
        : "MBWay";

    const preco = req.body.preco;

    const idPeca = await inventarioModel.registarNovaPeca({
      nome,
      descricao,
      tamanho,
      estado,
      idUtilizador,
      idCategoria: parseInt(idCategoria) || 1,
      isEmprestimo: isEmprestimo,
      isVenda: isVenda,
      valor_dia: parseFloat(req.body.preco || 0),
      preco: parseFloat(preco || 0),
      metodosStr,
    });

    if (fotos && Array.isArray(fotos) && fotos.length > 0) {
      try {
        await inventarioModel.registarFotosPeca(idPeca, fotos);
      } catch (e) {
        console.error("Aviso: Falha ao guardar as fotografias da peça", e);
      }
    }

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
 * @async
 * @function atualizarEstadoPeca
 * @description Atualiza o estado físico de conservação, a disponibilidade comercial e a localização da peça. (PUT /api/inventario/pecas/:id/estado)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID da peça a atualizar.
 * @param {Object} req.body - O corpo do pedido.
 * @param {string} req.body.estado - O novo estado da peça.
 * @param {boolean} [req.body.disponivelEmprestimo] - A nova disponibilidade para empréstimo.
 * @param {boolean} [req.body.disponivelVenda] - A nova disponibilidade para venda.
 * @param {string} [req.body.localizacao] - A nova localização física da peça.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem de sucesso ou erro caso não seja encontrada.
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
      localizacao: null,
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
 * @async
 * @function requisitarEmprestimo
 * @description Regista uma nova requisição de empréstimo ou aluguer de peças por parte de um utilizador. (POST /api/inventario/emprestimos)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {Object} req.body - O corpo do pedido.
 * @param {string} req.body.dataInicio - A data de início do empréstimo.
 * @param {string} req.body.dataFim - A data de fim do empréstimo.
 * @param {string} [req.body.observacoes] - Notas ou observações do pedido.
 * @param {string} req.body.metodoPagamento - O método escolhido para pagar.
 * @param {Array<{idPeca: number|string, estadoEntrega: string}>} req.body.itens - As peças incluídas na requisição.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem de sucesso ou erro (ex: peça indisponível).
 */
async function requisitarEmprestimo(req, res, next) {
  try {
    const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;
    const { dataInicio, dataFim, observacoes, metodoPagamento, itens } =
      req.body;

    if (!itens || itens.length === 0) {
      return res.status(400).json({
        mensagem: "É necessário indicar a peça que pretende requisitar.",
      });
    }

    const idPeca = parseInt(itens[0].idPeca);
    const estadoEntrega = itens[0].estadoEntrega;

    await inventarioModel.requisitarEmprestimo({
      idPeca,
      dataInicio,
      dataFim,
      observacoes,
      metodoPagamento,
      estadoEntrega,
      idUtilizador,
    });

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
 * @async
 * @function registarDevolucao
 * @description Regista a devolução de um empréstimo em curso, avaliando o estado final com que as peças foram entregues. (POST /api/inventario/emprestimos/:id/devolucao)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID do empréstimo a devolver.
 * @param {Object} req.body - O corpo do pedido.
 * @param {string} req.body.estadoFinal - O estado em que o empréstimo foi finalizado.
 * @param {string} [req.body.observacoes] - Notas ou observações sobre a devolução.
 * @param {Array<{idPeca: number|string, estadoDevolucao: string}>} req.body.itens - As peças a devolver e os respetivos estados.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem confirmando o registo da devolução.
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
 * @async
 * @function registarPenalizacao
 * @description Aplica uma penalização (multa monetária) associada a um empréstimo (Atraso, Dano ou Perda).
 * Exclusivo para perfis de Coordenação/Administração. (POST /api/inventario/emprestimos/:id/penalizacao)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID do empréstimo.
 * @param {Object} req.body - O corpo do pedido.
 * @param {number|string} req.body.idPeca - O ID da peça à qual se aplica a multa.
 * @param {string} req.body.tipo - O tipo da penalização (Atraso, Dano ou Perda).
 * @param {number|string} req.body.valor - O montante da penalização.
 * @param {string} [req.body.descricao] - Notas ou descrição do motivo da penalização.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem confirmando a multa e o respetivo ID.
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
 * @async
 * @function registarPagamentoEmprestimo
 * @description Atualiza o estado do pagamento referente aos custos de um empréstimo. (PUT /api/inventario/emprestimos/:id/pagamento)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID do empréstimo a atualizar o pagamento.
 * @param {Object} req.body - O corpo do pedido.
 * @param {number|string} req.body.valor - O valor total do pagamento.
 * @param {string} req.body.metodoPagamento - O método utilizado para liquidar o empréstimo.
 * @param {string} req.body.estadoPagamento - O novo estado do pagamento.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem confirmando a alteração.
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
 * @async
 * @function getPecasAVenda
 * @description Lista todas as peças que se encontram atualmente marcadas como disponíveis para venda direta. (GET /api/inventario/vendas)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve o array com as peças à venda.
 */
async function getPecasAVenda(req, res, next) {
  try {
    return res.status(200).json(await inventarioModel.getPecasAVenda());
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function colocarPecaAVenda
 * @description Coloca uma peça do catálogo à venda, definindo um preço comercial. (POST /api/inventario/vendas)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {Object} req.body - O corpo do pedido.
 * @param {number|string} req.body.idPeca - O ID da peça a disponibilizar.
 * @param {number|string} req.body.preco - O preço estabelecido para a venda.
 * @param {string} [req.body.nomePeca] - O nome da peça (opcional).
 * @param {string} [req.body.condicaoPeca] - A condição da peça para a venda.
 * @param {Array<string>} [req.body.metodosPagamento] - Os métodos de pagamento aceites.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve o ID da nova venda e uma mensagem de sucesso.
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
 * @async
 * @function editarPeca
 * @description Edita todos os detalhes e metadados de uma peça de forma faseada.
 * Atualiza os dados base, os dados de venda e substitui a galeria de fotografias. (PUT /api/inventario/pecas/:id)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID da peça a ser alterada.
 * @param {Object} req.body - O corpo do pedido.
 * @param {string} req.body.nome - O novo nome da peça.
 * @param {string} req.body.descricao - A nova descrição.
 * @param {string} req.body.tamanho - O novo tamanho.
 * @param {string} req.body.estado - O novo estado físico.
 * @param {number|string} [req.body.preco] - O novo preço da venda.
 * @param {Array<string>} [req.body.fotos] - Array com os URLs/base64 das novas imagens da peça.
 * @param {Array<string>} [req.body.metodosPagamento] - Os novos métodos de pagamento.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem a indicar que os dados foram guardados.
 */
async function editarPeca(req, res, next) {
  try {
    const idPeca = parseInt(req.params.id);
    const {
      nome,
      descricao,
      tamanho,
      estado,
      preco,
      fotos,
      metodosPagamento,
      metodosPagamentoEmprestimo,
      disponivelVenda,
      disponivelEmprestimo,
      valor_dia,
    } = req.body;

    if (isNaN(idPeca)) {
      return res.status(400).json({ mensagem: "ID de peça inválido." });
    }

    const isVenda = disponivelVenda === true || disponivelVenda === "true";
    const isEmp =
      disponivelEmprestimo === true || disponivelEmprestimo === "true";

    // CORREÇÃO: Apenas validar se o preço de venda é > 0 SE a peça for para venda
    if (isVenda && preco !== undefined && preco !== null && preco !== "") {
      if (Number(preco) <= 0) {
        return res
          .status(400)
          .json({ mensagem: "O preço definido é inválido." });
      }
    }

    // CORREÇÃO: Apenas validar se o preço de empréstimo é > 0 SE a peça for para empréstimo
    if (
      isEmp &&
      valor_dia !== undefined &&
      valor_dia !== null &&
      valor_dia !== ""
    ) {
      if (Number(valor_dia) <= 0) {
        return res
          .status(400)
          .json({ mensagem: "O preço diário definido é inválido." });
      }
    }

    const metodosStr =
      Array.isArray(metodosPagamento) && metodosPagamento.length > 0
        ? metodosPagamento.join(",")
        : "MBWay";

    const metodosStrEmprestimo = req.body.metodosStrEmprestimo || metodosStr;

    await inventarioModel.atualizarDadosCompletosPeca(idPeca, {
      nome,
      descricao,
      tamanho,
      estado,
      preco: preco && preco !== "" ? parseFloat(preco) : 0,
      valor_dia: valor_dia && valor_dia !== "" ? parseFloat(valor_dia) : 0,
      disponivelVenda: isVenda,
      disponivelEmprestimo: isEmp,
      metodosStr,
      metodosStrEmprestimo,
      idUtilizador: req.utilizador.id || req.utilizador.id_utilizador,
    });

    if (fotos && Array.isArray(fotos) && fotos.length > 0) {
      await inventarioModel.atualizarFotosPeca(idPeca, fotos);
    }

    registarAuditoria(req, {
      tipo: "PECA_EDITAR",
      descricao: `Peça #${idPeca}${nome ? ` ("${nome}")` : ""} editada`,
      entidadeTipo: "PECA",
      entidadeId: idPeca,
      dadosExtra: { nome, tamanho, estado, preco, valor_dia },
    });

    return res
      .status(200)
      .json({ mensagem: "Os dados da peça foram atualizados com sucesso." });
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function apagarPeca
 * @description Apaga uma peça do catálogo de forma definitiva e irreversível do sistema. (DELETE /api/inventario/pecas/:id)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID da peça a apagar.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem confirmando a remoção da peça.
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
 * @async
 * @function registarConclusaoVenda
 * @description Regista o fecho formal de uma venda de uma peça, transferindo a posse lógica no sistema. (POST /api/inventario/vendas/:id/conclusao)
 * @param {import('express').Request} req - O objeto do pedido (request) do Express.
 * @param {string} req.params.id - O ID da venda a concluir.
 * @param {Object} req.body - O corpo do pedido.
 * @param {number|string} req.body.idComprador - O ID do utilizador que comprou a peça.
 * @param {string} req.body.metodoPagamento - O método utilizado no pagamento.
 * @param {import('express').Response} res - O objeto da resposta (response) do Express.
 * @param {import('express').NextFunction} next - A função para invocar o próximo middleware.
 * @returns {Promise<import('express').Response|void>} Devolve uma mensagem confirmando a transferência.
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

async function getPedidosEmprestimo(req, res, next) {
  try {
    const idPeca = parseInt(req.params.id);
    if (isNaN(idPeca))
      return res.status(400).json({ mensagem: "ID inválido." });

    const pedidos = await inventarioModel.getPedidosEmprestimoPeca(idPeca);
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

async function alterarEstadoReserva(req, res, next) {
  try {
    const idEmprestimo = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(idEmprestimo) || !status) {
      return res.status(400).json({ mensagem: "Dados inválidos." });
    }

    const sucesso = await inventarioModel.atualizarEstadoReserva(
      idEmprestimo,
      status,
    );
    if (sucesso) {
      return res
        .status(200)
        .json({ mensagem: "Estado atualizado com sucesso." });
    } else {
      return res.status(404).json({ mensagem: "Reserva não encontrada." });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * @module inventarioController
 */
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
  getPedidosEmprestimo,
  alterarEstadoReserva,
};
