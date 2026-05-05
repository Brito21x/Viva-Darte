const inventarioModel = require('../models/inventarioModel');

// ============================================================================
// US20, US21 / RF21 — LISTAR CATÁLOGO DE PEÇAS
// GET /api/inventario
// ============================================================================
async function getCatalogo(req, res, next) {
    try {
        const pecas = await inventarioModel.getCatalogoPecas();
        return res.status(200).json(pecas);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US21 / RF21 — DETALHE DE UMA PEÇA (inclui todas as fotos)
// GET /api/inventario/:id
// ============================================================================
async function getPecaDetalhes(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);

        if (isNaN(idPeca)) {
            return res.status(400).json({ mensagem: 'ID de peça inválido.' });
        }

        const peca = await inventarioModel.getPecaDetalhes(idPeca);

        if (!peca) {
            return res.status(404).json({ mensagem: 'Peça não encontrada.' });
        }

        return res.status(200).json(peca);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US22 / RF22 — REGISTAR NOVA PEÇA
// POST /api/inventario
// Body: { nome, descricao, tamanho, estado, origem, localizacao,
//         disponivelEmprestimo, disponivelVenda, idCategoria }
// ============================================================================
async function registarPeca(req, res, next) {
    try {
        const idUtilizador = req.utilizador.id;
        const {
            nome,
            descricao,
            tamanho,
            estado,
            origem,
            localizacao,
            disponivelEmprestimo,
            disponivelVenda,
            idCategoria
        } = req.body;

        if (!nome || !estado || !idCategoria) {
            return res.status(400).json({ mensagem: 'Nome, estado e idCategoria são obrigatórios.' });
        }

        const estadosValidos = ['Novo', 'Bom', 'Usado', 'Danificado'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({
                mensagem: `Estado inválido. Valores aceites: ${estadosValidos.join(', ')}.`
            });
        }

        const idPeca = await inventarioModel.registarNovaPeca({
            nome,
            descricao: descricao || null,
            tamanho: tamanho || null,
            estado,
            origem: origem || null,
            localizacao: localizacao || null,
            disponivelEmprestimo: disponivelEmprestimo ?? false,
            disponivelVenda: disponivelVenda ?? false,
            idUtilizador,
            idCategoria: parseInt(idCategoria)
        });

        return res.status(201).json({
            mensagem: 'Peça registada com sucesso.',
            idPeca
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US22 / RF22 — ATUALIZAR ESTADO E DISPONIBILIDADE DE UMA PEÇA
// PUT /api/inventario/:id
// Body: { estado, disponivelEmprestimo, disponivelVenda, localizacao }
// ============================================================================
async function atualizarEstadoPeca(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);
        const { estado, disponivelEmprestimo, disponivelVenda, localizacao } = req.body;

        if (isNaN(idPeca)) {
            return res.status(400).json({ mensagem: 'ID de peça inválido.' });
        }

        if (!estado) {
            return res.status(400).json({ mensagem: 'Estado é obrigatório.' });
        }

        const sucesso = await inventarioModel.atualizarEstadoPeca(idPeca, {
            estado,
            disponivelEmprestimo: disponivelEmprestimo ?? false,
            disponivelVenda: disponivelVenda ?? false,
            localizacao: localizacao || null
        });

        if (!sucesso) {
            return res.status(404).json({ mensagem: 'Peça não encontrada.' });
        }

        return res.status(200).json({ mensagem: 'Peça atualizada com sucesso.' });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US23 / RF23 — REQUISITAR EMPRÉSTIMO
// POST /api/inventario/emprestimos
// Body: { dataInicio, dataFim, observacoes, itens: [{ idPeca, estadoEntrega }] }
// ============================================================================
async function requisitarEmprestimo(req, res, next) {
    try {
        const idUtilizador = req.utilizador.id;
        const { dataInicio, dataFim, observacoes, itens } = req.body;

        if (!dataInicio || !dataFim) {
            return res.status(400).json({ mensagem: 'dataInicio e dataFim são obrigatórios.' });
        }

        if (!Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ mensagem: 'É necessário indicar pelo menos uma peça.' });
        }

        if (new Date(dataFim) <= new Date(dataInicio)) {
            return res.status(400).json({ mensagem: 'A data de fim deve ser posterior à data de início.' });
        }

        for (const item of itens) {
            if (!item.idPeca || !item.estadoEntrega) {
                return res.status(400).json({ mensagem: 'Cada item deve ter idPeca e estadoEntrega.' });
            }
        }

        const idEmprestimo = await inventarioModel.requisitarEmprestimo(
            { dataInicio, dataFim, observacoes: observacoes || null, idUtilizador },
            itens.map(i => ({ idPeca: parseInt(i.idPeca), estadoEntrega: i.estadoEntrega }))
        );

        return res.status(201).json({
            mensagem: 'Empréstimo requisitado com sucesso.',
            idEmprestimo
        });
    } catch (error) {
        if (error.message.includes('não está disponível')) {
            return res.status(409).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US24 / RF24 — REGISTAR DEVOLUÇÃO DE EMPRÉSTIMO
// PUT /api/inventario/emprestimos/:id/devolucao
// Body: { estadoFinal, observacoes, itens: [{ idPeca, estadoDevolucao }] }
// ============================================================================
async function registarDevolucao(req, res, next) {
    try {
        const idEmprestimo = parseInt(req.params.id);
        const { estadoFinal, observacoes, itens } = req.body;

        if (isNaN(idEmprestimo)) {
            return res.status(400).json({ mensagem: 'ID de empréstimo inválido.' });
        }

        if (!estadoFinal) {
            return res.status(400).json({ mensagem: 'estadoFinal é obrigatório.' });
        }

        if (!Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ mensagem: 'É necessário indicar o estado de devolução de cada peça.' });
        }

        for (const item of itens) {
            if (!item.idPeca || !item.estadoDevolucao) {
                return res.status(400).json({ mensagem: 'Cada item deve ter idPeca e estadoDevolucao.' });
            }
        }

        await inventarioModel.registarDevolucaoEmprestimo(
            idEmprestimo,
            estadoFinal,
            observacoes || null,
            itens.map(i => ({ idPeca: parseInt(i.idPeca), estadoDevolucao: i.estadoDevolucao }))
        );

        return res.status(200).json({ mensagem: 'Devolução registada com sucesso.' });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US25 / RF24 — REGISTAR PENALIZAÇÃO (Coordenação ou Responsável)
// POST /api/inventario/emprestimos/:id/penalizacoes
// Body: { idPeca, tipo, valor, descricao }
// tipo: 'Atraso' | 'Dano' | 'Perda'
// ============================================================================
async function registarPenalizacao(req, res, next) {
    try {
        const idEmprestimo = parseInt(req.params.id);
        const { idPeca, tipo, valor, descricao } = req.body;

        if (isNaN(idEmprestimo)) {
            return res.status(400).json({ mensagem: 'ID de empréstimo inválido.' });
        }

        if (!idPeca || !tipo || valor === undefined) {
            return res.status(400).json({ mensagem: 'idPeca, tipo e valor são obrigatórios.' });
        }

        const tiposValidos = ['Atraso', 'Dano', 'Perda'];
        if (!tiposValidos.includes(tipo)) {
            return res.status(400).json({
                mensagem: `Tipo inválido. Valores aceites: ${tiposValidos.join(', ')}.`
            });
        }

        if (Number(valor) <= 0) {
            return res.status(400).json({ mensagem: 'O valor da penalização deve ser positivo.' });
        }

        const idPenalizacao = await inventarioModel.registarPenalizacao({
            tipo,
            valor: parseFloat(valor),
            descricao: descricao || null,
            idPeca: parseInt(idPeca),
            idEmprestimo
        });

        return res.status(201).json({
            mensagem: 'Penalização registada com sucesso.',
            idPenalizacao
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US26 / RF25 — REGISTAR PAGAMENTO DE EMPRÉSTIMO (Coordenação ou Responsável)
// PUT /api/inventario/emprestimos/:id/pagamento
// Body: { valor, metodoPagamento, estadoPagamento }
// ============================================================================
async function registarPagamentoEmprestimo(req, res, next) {
    try {
        const idEmprestimo = parseInt(req.params.id);
        const { valor, metodoPagamento, estadoPagamento } = req.body;

        if (isNaN(idEmprestimo)) {
            return res.status(400).json({ mensagem: 'ID de empréstimo inválido.' });
        }

        if (valor === undefined || !metodoPagamento || !estadoPagamento) {
            return res.status(400).json({ mensagem: 'valor, metodoPagamento e estadoPagamento são obrigatórios.' });
        }

        const sucesso = await inventarioModel.atualizarPagamentoEmprestimo(
            idEmprestimo,
            parseFloat(valor),
            metodoPagamento,
            estadoPagamento
        );

        if (!sucesso) {
            return res.status(404).json({ mensagem: 'Empréstimo não encontrado.' });
        }

        return res.status(200).json({ mensagem: 'Pagamento do empréstimo registado com sucesso.' });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US27 / RF26 — LISTAR PEÇAS À VENDA
// GET /api/inventario/vendas
// ============================================================================
async function getPecasAVenda(req, res, next) {
    try {
        const pecas = await inventarioModel.getPecasAVenda();
        return res.status(200).json(pecas);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US27 / RF26 — COLOCAR PEÇA À VENDA
// POST /api/inventario/vendas
// Body: { idPeca, preco }
// ============================================================================
async function colocarPecaAVenda(req, res, next) {
    try {
        const idVendedor = req.utilizador.id;
        const { idPeca, preco } = req.body;

        if (!idPeca || preco === undefined) {
            return res.status(400).json({ mensagem: 'idPeca e preco são obrigatórios.' });
        }

        if (Number(preco) <= 0) {
            return res.status(400).json({ mensagem: 'O preço deve ser um valor positivo.' });
        }

        const idVenda = await inventarioModel.colocarPecaAVenda(
            parseInt(idPeca),
            parseFloat(preco),
            idVendedor
        );

        return res.status(201).json({
            mensagem: 'Peça colocada à venda com sucesso.',
            idVenda
        });
    } catch (error) {
        if (error.message.includes('não está disponível') || error.message.includes('já está anunciada') || error.message.includes('não encontrada')) {
            return res.status(409).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US28 / RF26 — REGISTAR CONCLUSÃO DE VENDA (Responsável)
// PUT /api/inventario/vendas/:id/concluir
// Body: { idComprador, metodoPagamento }
// ============================================================================
async function registarConclusaoVenda(req, res, next) {
    try {
        const idVenda = parseInt(req.params.id);
        const { idComprador, metodoPagamento } = req.body;

        if (isNaN(idVenda)) {
            return res.status(400).json({ mensagem: 'ID de venda inválido.' });
        }

        if (!idComprador || !metodoPagamento) {
            return res.status(400).json({ mensagem: 'idComprador e metodoPagamento são obrigatórios.' });
        }

        await inventarioModel.registarConclusaoVenda(
            idVenda,
            parseInt(idComprador),
            metodoPagamento
        );

        return res.status(200).json({ mensagem: 'Venda concluída com sucesso.' });
    } catch (error) {
        if (error.message.includes('não encontrada') || error.message.includes('não está disponível')) {
            return res.status(400).json({ mensagem: error.message });
        }
        next(error);
    }
}

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
    registarConclusaoVenda
};