const inventarioModel = require('../models/inventarioModel');

// ============================================================================
// US20, US21 / RF21 — LISTAR CATÁLOGO DE PEÇAS
// GET /api/inventario
// ============================================================================
async function getCatalogo(req, res, next) {
    try { return res.status(200).json(await inventarioModel.getCatalogoPecas()); } catch (error) { next(error); }
}

// ============================================================================
// US21 / RF21 — DETALHE DE UMA PEÇA (inclui todas as fotos)
// GET /api/inventario/:id
// ============================================================================
async function getPecaDetalhes(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);
        if (isNaN(idPeca)) return res.status(400).json({ mensagem: 'ID de peça inválido.' });
        const peca = await inventarioModel.getPecaDetalhes(idPeca);
        if (!peca) return res.status(404).json({ mensagem: 'Peça não encontrada.' });
        return res.status(200).json(peca);
    } catch (error) { next(error); }
}

// ============================================================================
// US22 / RF22 — REGISTAR NOVA PEÇA
// POST /api/inventario
// Body: { nome, descricao, tamanho, estado, origem, localizacao,
//         disponivelEmprestimo, disponivelVenda, idCategoria }
// ============================================================================
// inventarioController.js
async function registarPeca(req, res, next) {
    try {
        const { nome, descricao, tamanho, estado, idCategoria, fotos } = req.body;
        const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;
        const idPeca = await inventarioModel.registarNovaPeca({
            nome, descricao, tamanho, estado, idUtilizador, 
            idCategoria: parseInt(idCategoria), disponivelVenda: true 
        });
        if (fotos && Array.isArray(fotos) && fotos.length > 0) {
            try { await inventarioModel.registarFotosPeca(idPeca, fotos); } catch (e) { console.error("Aviso fotos:", e); }
        }
        return res.status(201).json({ mensagem: 'Guardado com sucesso!', idPeca });
    } catch (error) { next(error); }
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
        if (isNaN(idPeca)) return res.status(400).json({ mensagem: 'ID inválido.' });
        const sucesso = await inventarioModel.atualizarEstadoPeca(idPeca, {
            estado, disponivelEmprestimo: disponivelEmprestimo ?? false,
            disponivelVenda: disponivelVenda ?? false, localizacao: localizacao || null
        });
        if (!sucesso) return res.status(404).json({ mensagem: 'Peça não encontrada.' });
        return res.status(200).json({ mensagem: 'Atualizada com sucesso.' });
    } catch (error) { next(error); }
}

// ============================================================================
// US23 / RF23 — REQUISITAR EMPRÉSTIMO
// POST /api/inventario/emprestimos
// Body: { dataInicio, dataFim, observacoes, itens: [{ idPeca, estadoEntrega }] }
// ============================================================================
async function requisitarEmprestimo(req, res, next) {
    try {
        const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;
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
    try { return res.status(200).json(await inventarioModel.getPecasAVenda()); } catch (error) { next(error); }
}

// ============================================================================
// US27 / RF26 — COLOCAR PEÇA À VENDA
// POST /api/inventario/vendas
// Body: { idPeca, preco }
// ============================================================================
async function colocarPecaAVenda(req, res, next) {
    try {
        const idVendedor = req.utilizador.id || req.utilizador.id_utilizador;
        const { idPeca, preco, nomePeca, condicaoPeca, metodosPagamento } = req.body;

        if (!idPeca || preco === undefined) return res.status(400).json({ mensagem: 'Faltam dados.' });
        if (Number(preco) <= 0) return res.status(400).json({ mensagem: 'Preço inválido.' });

        const metodosStr = (metodosPagamento && Array.isArray(metodosPagamento) && metodosPagamento.length > 0)
            ? metodosPagamento.join(',') 
            : 'MBWay,Transferência,Numerário';

        const idVenda = await inventarioModel.colocarPecaAVenda(parseInt(idPeca), parseFloat(preco), idVendedor, nomePeca, condicaoPeca, metodosStr);
        return res.status(201).json({ mensagem: 'Sucesso.', idVenda });
    } catch (error) { next(error); }
}

async function editarPeca(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);
        const { nome, descricao, tamanho, estado, preco, fotos, metodosPagamento } = req.body;
        
        if (isNaN(idPeca)) return res.status(400).json({ mensagem: 'ID inválido.' });
        if (preco !== undefined && Number(preco) <= 0) return res.status(400).json({ mensagem: 'Preço inválido.' });

        const metodosStr = (metodosPagamento && Array.isArray(metodosPagamento) && metodosPagamento.length > 0)
            ? metodosPagamento.join(',') 
            : 'MBWay,Transferência,Numerário';

        await inventarioModel.atualizarDadosCompletosPeca(idPeca, { nome, descricao, tamanho, estado });
        if (preco !== undefined) await inventarioModel.atualizarDadosVenda(idPeca, parseFloat(preco), nome, estado, metodosStr);
        if (fotos && Array.isArray(fotos)) await inventarioModel.atualizarFotosPeca(idPeca, fotos);

        return res.status(200).json({ mensagem: 'Sucesso.' });
    } catch (error) { next(error); }
}

// APAGAR PRODUTO
async function apagarPeca(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);
        if (isNaN(idPeca)) return res.status(400).json({ mensagem: 'ID inválido.' });
        const sucesso = await inventarioModel.eliminarPecaCompleta(idPeca);
        if (!sucesso) return res.status(404).json({ mensagem: 'Não encontrada.' });
        return res.status(200).json({ mensagem: 'Removido com sucesso.' });
    } catch (error) { next(error); }
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
        if (isNaN(idVenda) || !idComprador) return res.status(400).json({ mensagem: 'Dados inválidos.' });

        await inventarioModel.registarConclusaoVenda(idVenda, parseInt(idComprador), metodoPagamento);
        return res.status(200).json({ mensagem: 'Sucesso.' });
    } catch (error) { next(error); }
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
    editarPeca, 
    apagarPeca, 
    registarConclusaoVenda
};