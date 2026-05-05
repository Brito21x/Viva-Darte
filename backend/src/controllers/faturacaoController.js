const faturacaoModel = require('../models/faturacaoModel');

// ============================================================================
// US15 / RF17 — CONSULTAR TABELA DE PREÇOS (Coordenação)
// GET /api/faturacao/precos
// ============================================================================
async function getTabelaPrecos(req, res, next) {
    try {
        const precos = await faturacaoModel.getTabelaPrecos();
        return res.status(200).json(precos);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US16 / RF18 — CALCULAR CUSTO ESTIMADO DE UM COACHING
// GET /api/faturacao/calcular?formato=Solo&duracao=60&diaSemana=1&idModalidade=1&idProfessor=2
// ============================================================================
async function calcularCusto(req, res, next) {
    try {
        const { formato, duracao, diaSemana, idModalidade, idProfessor } = req.query;

        if (!formato || !duracao || !diaSemana) {
            return res.status(400).json({ mensagem: 'formato, duracao e diaSemana são obrigatórios.' });
        }

        const preco = await faturacaoModel.calcularCustoAutomatico(
            formato,
            parseInt(duracao),
            parseInt(diaSemana),
            idModalidade ? parseInt(idModalidade) : null,
            idProfessor ? parseInt(idProfessor) : null
        );

        if (preco === null) {
            return res.status(404).json({
                mensagem: 'Não foi encontrado nenhum preço para os parâmetros indicados.'
            });
        }

        return res.status(200).json({ preco });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US17 / RF18 — GERAR FATURAÇÃO MENSAL (Coordenação)
// POST /api/faturacao/gerar
// Body: { mes, ano, idUtilizador, idAnoLetivo }
// ============================================================================
async function gerarFaturacao(req, res, next) {
    try {
        const { mes, ano, idUtilizador, idAnoLetivo } = req.body;

        if (!mes || !ano || !idUtilizador || !idAnoLetivo) {
            return res.status(400).json({ mensagem: 'mes, ano, idUtilizador e idAnoLetivo são obrigatórios.' });
        }

        if (Number(mes) < 1 || Number(mes) > 12) {
            return res.status(400).json({ mensagem: 'Mês deve ser entre 1 e 12.' });
        }

        const idFaturacao = await faturacaoModel.gerarFaturacaoMensal(
            parseInt(mes),
            parseInt(ano),
            parseInt(idUtilizador),
            parseInt(idAnoLetivo)
        );

        if (idFaturacao === null) {
            return res.status(200).json({
                mensagem: 'Não há consumo registado para este utilizador neste período. Nenhuma fatura gerada.'
            });
        }

        return res.status(201).json({
            mensagem: 'Faturação gerada com sucesso.',
            idFaturacao
        });
    } catch (error) {
        if (error.message.includes('Já existe')) {
            return res.status(409).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US17 / RF18 — GERAR FATURAÇÃO MENSAL PARA TODOS OS EE (Coordenação — batch)
// POST /api/faturacao/gerar-todos
// Body: { mes, ano, idAnoLetivo }
// ============================================================================
async function gerarFaturacaoTodos(req, res, next) {
    try {
        const { mes, ano, idAnoLetivo } = req.body;

        if (!mes || !ano || !idAnoLetivo) {
            return res.status(400).json({ mensagem: 'mes, ano e idAnoLetivo são obrigatórios.' });
        }

        // TODO: Obter lista de todos os EEs e iterar.
        // Esta implementação é um placeholder para integração futura com utilizadorModel.
        // Recomenda-se chamar listarTodosUtilizadores() filtrando por perfil 'EE'
        // e chamar gerarFaturacaoMensal() para cada um.

        return res.status(501).json({
            mensagem: 'Endpoint em desenvolvimento. Use POST /api/faturacao/gerar para gerar individualmente.'
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US18, US19 / RF19, RF20 — CONSULTAR FATURAÇÃO
// GET /api/faturacao                    → todas (Contabilidade)
// GET /api/faturacao/minha              → só do EE autenticado
// ============================================================================
async function getFaturacao(req, res, next) {
    try {
        const faturas = await faturacaoModel.getFaturacao(null);
        return res.status(200).json(faturas);
    } catch (error) {
        next(error);
    }
}

async function getMinhaFaturacao(req, res, next) {
    try {
        const idUtilizador = req.utilizador.id;
        const faturas = await faturacaoModel.getFaturacao(idUtilizador);
        return res.status(200).json(faturas);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US18 / RF19 — EXPORTAR FATURAÇÃO (Contabilidade)
// GET /api/faturacao/exportar?mes=10&ano=2025
// Devolve JSON estruturado pronto para exportação CSV/Excel no frontend.
// ============================================================================
async function exportarFaturacao(req, res, next) {
    try {
        const { mes, ano } = req.query;

        let faturas;
        if (mes && ano) {
            // Filtrar por mês e ano específicos
            faturas = await faturacaoModel.getFaturacao(null);
            faturas = faturas.filter(
                f => f.mes === parseInt(mes) && f.ano === parseInt(ano)
            );
        } else {
            faturas = await faturacaoModel.getFaturacao(null);
        }

        // Estruturar para exportação
        const exportData = faturas.map(f => ({
            id: f.id_faturacao,
            cliente: f.cliente,
            email: f.email_cliente,
            ano_letivo: f.ano_letivo_nome,
            mes: f.mes,
            ano: f.ano,
            valor_total: f.total,
            estado_pagamento: f.estado_pagamento || 'Pendente',
            metodo_pagamento: f.metodo_pagamento || '-',
            data_pagamento: f.data_pagamento || '-',
            data_geracao: f.data_geracao
        }));

        // Header para download CSV no browser
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
            total_registos: exportData.length,
            dados: exportData
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US19 / RF20 — REGISTAR PAGAMENTO DE FATURA (Coordenação / Contabilidade)
// PUT /api/faturacao/:id/pagar
// Body: { metodoPagamento }
// ============================================================================
async function registarPagamento(req, res, next) {
    try {
        const idFaturacao = parseInt(req.params.id);
        const { metodoPagamento } = req.body;

        if (isNaN(idFaturacao)) {
            return res.status(400).json({ mensagem: 'ID de faturação inválido.' });
        }

        if (!metodoPagamento) {
            return res.status(400).json({ mensagem: 'metodoPagamento é obrigatório.' });
        }

        const metodosValidos = ['Transferência', 'MBWay', 'Numerário', 'Cheque', 'Débito Direto'];
        if (!metodosValidos.includes(metodoPagamento)) {
            return res.status(400).json({
                mensagem: `Método de pagamento inválido. Valores aceites: ${metodosValidos.join(', ')}.`
            });
        }

        const sucesso = await faturacaoModel.registarPagamentoFatura(idFaturacao, metodoPagamento);

        if (!sucesso) {
            return res.status(404).json({
                mensagem: 'Fatura não encontrada ou já se encontra paga.'
            });
        }

        return res.status(200).json({ mensagem: 'Pagamento registado com sucesso.' });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US29 / RF27 — HISTÓRICO DE ATIVIDADES DO UTILIZADOR AUTENTICADO
// GET /api/faturacao/historico
// ============================================================================
async function getHistorico(req, res, next) {
    try {
        const idUtilizador = req.utilizador.id;
        const historico = await faturacaoModel.getHistoricoAtividades(idUtilizador);
        return res.status(200).json(historico);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US29 / RF27 — HISTÓRICO DE ATIVIDADES DE UM UTILIZADOR ESPECÍFICO (Admin/Coordenação)
// GET /api/faturacao/historico/:id
// ============================================================================
async function getHistoricoUtilizador(req, res, next) {
    try {
        const idUtilizador = parseInt(req.params.id);

        if (isNaN(idUtilizador)) {
            return res.status(400).json({ mensagem: 'ID de utilizador inválido.' });
        }

        const historico = await faturacaoModel.getHistoricoAtividades(idUtilizador);
        return res.status(200).json(historico);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US30 / RF28 — RELATÓRIO MENSAL POR PROFESSOR (Administração)
// GET /api/faturacao/relatorio?mes=10&ano=2025
// ============================================================================
async function getRelatorio(req, res, next) {
    try {
        const { mes, ano } = req.query;

        if (!mes || !ano) {
            return res.status(400).json({ mensagem: 'mes e ano são obrigatórios.' });
        }

        if (Number(mes) < 1 || Number(mes) > 12) {
            return res.status(400).json({ mensagem: 'Mês deve ser entre 1 e 12.' });
        }

        const relatorio = await faturacaoModel.getRelatorioAulasProfessor(
            parseInt(mes),
            parseInt(ano)
        );

        return res.status(200).json({
            mes: parseInt(mes),
            ano: parseInt(ano),
            dados: relatorio,
            total_aulas: relatorio.reduce((acc, r) => acc + r.total_aulas, 0),
            total_receita: relatorio.reduce((acc, r) => acc + Number(r.total_receita_gerada), 0)
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getTabelaPrecos,
    calcularCusto,
    gerarFaturacao,
    gerarFaturacaoTodos,
    getFaturacao,
    getMinhaFaturacao,
    exportarFaturacao,
    registarPagamento,
    getHistorico,
    getHistoricoUtilizador,
    getRelatorio
};