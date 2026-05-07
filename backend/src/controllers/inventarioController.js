/**
 * Controlador de Inventário (Peças, Empréstimos e Vendas)
 * Este ficheiro gere o catálogo de peças, requisições de empréstimo, devoluções,
 * penalizações e o mercado de vendas.
 */

const inventarioModel = require('../models/inventarioModel');

// ============================================================================
// CATÁLOGO E DETALHES DE PEÇAS 
// ============================================================================

async function getCatalogo(req, res, next) {
    try { 
        return res.status(200).json(await inventarioModel.getCatalogoPecas()); 
    } catch (error) { next(error); }
}

/**
 * Obtém os detalhes completos de uma peça específica, incluindo as suas fotos.
 */
async function getPecaDetalhes(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);
        
        // Validação básica do parâmetro da rota
        if (isNaN(idPeca)) return res.status(400).json({ mensagem: 'ID de peça inválido.' });
        
        const peca = await inventarioModel.getPecaDetalhes(idPeca);
        if (!peca) return res.status(404).json({ mensagem: 'Peça não encontrada.' });
        
        return res.status(200).json(peca);
    } catch (error) { next(error); }
}

// ============================================================================
// GESTÃO DO INVENTÁRIO 
// ============================================================================

/**
 * Regista uma nova peça no inventário do sistema.
 * Suporta configuração automática para empréstimo e/ou venda.
 */
async function registarPeca(req, res, next) {
    try {
        const { nome, descricao, tamanho, estado, idCategoria, fotos, valor_dia, metodos_pagamento, disponivelVenda } = req.body;
        
        // Identifica o utilizador que está a registar a peça 
        const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;

        // Lógica de negócio: Deteção inteligente do tipo de transação (Empréstimo ou Venda)
        const isEmprestimo = valor_dia !== undefined && valor_dia !== '';
        const isVenda = disponivelVenda === true || disponivelVenda === 'true' || !isEmprestimo;

        // Processamento dos métodos de pagamento
        const metodosStr = (metodos_pagamento && Array.isArray(metodos_pagamento) && metodos_pagamento.length > 0)
            ? metodos_pagamento.join(',')
            : 'MBWay';

        // Guarda a peça principal na base de dados
        const idPeca = await inventarioModel.registarNovaPeca({
            nome, descricao, tamanho, estado, idUtilizador,
            idCategoria: parseInt(idCategoria) || 1,
            isEmprestimo, isVenda,
            valor_dia: parseFloat(valor_dia || 0),
            metodosStr
        });

        // Se existirem fotos submetidas, faz o registo em lote
        if (fotos && Array.isArray(fotos) && fotos.length > 0) {
            try { 
                await inventarioModel.registarFotosPeca(idPeca, fotos); 
            } catch (e) { 
                console.error("Aviso: Falha ao guardar fotos", e); 
            }
        }

        return res.status(201).json({ mensagem: 'Guardado com sucesso!', idPeca });
    } catch (error) { next(error); }
}

/**
 * Atualiza o estado físico, disponibilidade e localização de uma peça existente.
 */
async function atualizarEstadoPeca(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);
        const { estado, disponivelEmprestimo, disponivelVenda, localizacao } = req.body;
        
        if (isNaN(idPeca)) return res.status(400).json({ mensagem: 'ID inválido.' });
        
        const sucesso = await inventarioModel.atualizarEstadoPeca(idPeca, {
            estado, 
            disponivelEmprestimo: disponivelEmprestimo ?? false,
            disponivelVenda: disponivelVenda ?? false, 
            localizacao: localizacao || null
        });
        
        if (!sucesso) return res.status(404).json({ mensagem: 'Peça não encontrada.' });
        return res.status(200).json({ mensagem: 'Atualizada com sucesso.' });
    } catch (error) { next(error); }
}

// ============================================================================
// EMPRÉSTIMOS E DEVOLUÇÕES 
// ============================================================================

/**
 * Regista uma nova requisição de empréstimo de peças.
 */
async function requisitarEmprestimo(req, res, next) {
    try {
        const idUtilizador = req.utilizador.id || req.utilizador.id_utilizador;
        const { dataInicio, dataFim, observacoes, metodoPagamento, itens } = req.body;

        // Validação: Um empréstimo precisa obrigatoriamente de itens
        if (!itens || itens.length === 0) {
            return res.status(400).json({ mensagem: 'É necessário indicar a peça.' });
        }

        // Para simplificação, assume a primeira peça do array (pode ser expandido para múltiplos itens)
        const idPeca = parseInt(itens[0].idPeca);
        const estadoEntrega = itens[0].estadoEntrega;

        // Agrupa todos os dados e envia para o Model processar
        await inventarioModel.requisitarEmprestimo({
            idPeca, dataInicio, dataFim, observacoes, metodoPagamento, estadoEntrega, idUtilizador
        });

        return res.status(200).json({ mensagem: 'Solicitação enviada com sucesso!' });
    } catch (error) { 
        if (error.message.includes('não encontrada')) {
            return res.status(404).json({ mensagem: error.message });
        }
        next(error); 
    }
}

/**
 * Regista a devolução de um empréstimo em curso, avaliando o estado final das peças.
 */
async function registarDevolucao(req, res, next) {
    try {
        const idEmprestimo = parseInt(req.params.id);
        const { estadoFinal, observacoes, itens } = req.body;

        if (isNaN(idEmprestimo)) return res.status(400).json({ mensagem: 'ID de empréstimo inválido.' });
        if (!estadoFinal) return res.status(400).json({ mensagem: 'estadoFinal é obrigatório.' });

        // Garante que o estado de devolução de todos os itens envolvidos foi reportado
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
    } catch (error) { next(error); }
}

/**
 * Aplica uma penalização (multa) associada a um empréstimo (Atraso, Dano ou Perda).
 * Exclusivo para perfis de Coordenação/Responsáveis.
 */
async function registarPenalizacao(req, res, next) {
    try {
        const idEmprestimo = parseInt(req.params.id);
        const { idPeca, tipo, valor, descricao } = req.body;

        if (isNaN(idEmprestimo)) return res.status(400).json({ mensagem: 'ID de empréstimo inválido.' });
        if (!idPeca || !tipo || valor === undefined) return res.status(400).json({ mensagem: 'idPeca, tipo e valor são obrigatórios.' });

        // Validação estrita dos tipos de penalização previstos no sistema
        const tiposValidos = ['Atraso', 'Dano', 'Perda'];
        if (!tiposValidos.includes(tipo)) {
            return res.status(400).json({ mensagem: `Tipo inválido. Valores aceites: ${tiposValidos.join(', ')}.` });
        }

        // Validação da regra de negócio: Multas não podem ser negativas nem nulas
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

        return res.status(201).json({ mensagem: 'Penalização registada com sucesso.', idPenalizacao });
    } catch (error) { next(error); }
}

/**
 * Atualiza o estado de pagamento de um empréstimo.
 */
async function registarPagamentoEmprestimo(req, res, next) {
    try {
        const idEmprestimo = parseInt(req.params.id);
        const { valor, metodoPagamento, estadoPagamento } = req.body;

        if (isNaN(idEmprestimo)) return res.status(400).json({ mensagem: 'ID de empréstimo inválido.' });
        if (valor === undefined || !metodoPagamento || !estadoPagamento) {
            return res.status(400).json({ mensagem: 'valor, metodoPagamento e estadoPagamento são obrigatórios.' });
        }

        const sucesso = await inventarioModel.atualizarPagamentoEmprestimo(
            idEmprestimo, parseFloat(valor), metodoPagamento, estadoPagamento
        );

        if (!sucesso) return res.status(404).json({ mensagem: 'Empréstimo não encontrado.' });
        
        return res.status(200).json({ mensagem: 'Pagamento do empréstimo registado com sucesso.' });
    } catch (error) { next(error); }
}

// ============================================================================
// MERCADO DE VENDAS 
// ============================================================================

/**
 * Lista todas as peças atualmente com status de disponíveis para venda.
 */
async function getPecasAVenda(req, res, next) {
    try { 
        return res.status(200).json(await inventarioModel.getPecasAVenda()); 
    } catch (error) { next(error); }
}

/**
 * Coloca uma peça do catálogo à venda
 */
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

/**
 * Edita todos os detalhes de uma peça, incluindo o seu status de venda e fotos.
 */
async function editarPeca(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);
        const { nome, descricao, tamanho, estado, preco, fotos, metodosPagamento } = req.body;
        
        if (isNaN(idPeca)) return res.status(400).json({ mensagem: 'ID inválido.' });
        if (preco !== undefined && Number(preco) <= 0) return res.status(400).json({ mensagem: 'Preço inválido.' });

        const metodosStr = (metodosPagamento && Array.isArray(metodosPagamento) && metodosPagamento.length > 0)
            ? metodosPagamento.join(',') 
            : 'MBWay,Transferência,Numerário';

        // Atualização faseada: Dados base, dados de venda e galeria de fotos
        await inventarioModel.atualizarDadosCompletosPeca(idPeca, { nome, descricao, tamanho, estado });
        if (preco !== undefined) await inventarioModel.atualizarDadosVenda(idPeca, parseFloat(preco), nome, estado, metodosStr);
        if (fotos && Array.isArray(fotos)) await inventarioModel.atualizarFotosPeca(idPeca, fotos);

        return res.status(200).json({ mensagem: 'Sucesso.' });
    } catch (error) { next(error); }
}

/**
 * Apaga uma peça do catálogo de forma definitiva.
 */
async function apagarPeca(req, res, next) {
    try {
        const idPeca = parseInt(req.params.id);
        if (isNaN(idPeca)) return res.status(400).json({ mensagem: 'ID inválido.' });
        
        const sucesso = await inventarioModel.eliminarPecaCompleta(idPeca);
        if (!sucesso) return res.status(404).json({ mensagem: 'Não encontrada.' });
        
        return res.status(200).json({ mensagem: 'Removido com sucesso.' });
    } catch (error) { next(error); }
}

/**
 * Regista o fecho de uma venda, marcando a transação como concluída.
 */
async function registarConclusaoVenda(req, res, next) {
    try {
        const idVenda = parseInt(req.params.id);
        const { idComprador, metodoPagamento } = req.body;
        
        if (isNaN(idVenda) || !idComprador) return res.status(400).json({ mensagem: 'Dados inválidos.' });

        await inventarioModel.registarConclusaoVenda(idVenda, parseInt(idComprador), metodoPagamento);
        return res.status(200).json({ mensagem: 'Sucesso.' });
    } catch (error) { next(error); }
}

// Exportação dos métodos para utilização nas rotas
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