const faturacaoModel = require('../models/faturacaoModel');
const utilizadorModel = require('../models/utilizadorModel');

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
// US15 / RF17 — CRIAR / ATUALIZAR / DESATIVAR PREÇO (Coordenação)
// POST /api/faturacao/precos
// PUT /api/faturacao/precos/:idPreco
// DELETE /api/faturacao/precos/:idPreco (desativa ativo=0)
// ============================================================================
async function criarPreco(req, res, next) {
    try {
        const {
            formatoAula,
            duracaoMinutos,
            diaSemana,
            preco,
            idModalidade,
            idProfessor,
            ativo
        } = req.body;

        if (!formatoAula || duracaoMinutos == null || diaSemana == null || preco === undefined) {
            return res.status(400).json({
                mensagem: 'formatoAula, duracaoMinutos, diaSemana e preco são obrigatórios.'
            });
        }

        const idPreco = await faturacaoModel.criarRegistoPreco({
            formatoAula,
            duracaoMinutos: parseInt(duracaoMinutos, 10),
            diaSemana: parseInt(diaSemana, 10),
            preco: parseFloat(preco),
            idModalidade: idModalidade != null ? parseInt(idModalidade, 10) : null,
            idProfessor: idProfessor != null ? parseInt(idProfessor, 10) : null,
            ativo
        });

        return res.status(201).json({ mensagem: 'Preço criado com sucesso.', idPreco });
    } catch (error) {
        next(error);
    }
}

async function atualizarPreco(req, res, next) {
    try {
        const idPreco = parseInt(req.params.idPreco, 10);
        if (Number.isNaN(idPreco)) {
            return res.status(400).json({ mensagem: 'ID de preço inválido.' });
        }

        const {
            formatoAula,
            duracaoMinutos,
            diaSemana,
            preco,
            idModalidade,
            idProfessor,
            ativo
        } = req.body;

        if (!formatoAula || duracaoMinutos == null || diaSemana == null || preco === undefined) {
            return res.status(400).json({
                mensagem: 'formatoAula, duracaoMinutos, diaSemana e preco são obrigatórios.'
            });
        }

        const ok = await faturacaoModel.atualizarRegistoPreco(idPreco, {
            formatoAula,
            duracaoMinutos: parseInt(duracaoMinutos, 10),
            diaSemana: parseInt(diaSemana, 10),
            preco: parseFloat(preco),
            idModalidade: idModalidade != null ? parseInt(idModalidade, 10) : null,
            idProfessor: idProfessor != null ? parseInt(idProfessor, 10) : null,
            ativo
        });

        if (!ok) {
            return res.status(404).json({ mensagem: 'Preço não encontrado.' });
        }

        return res.status(200).json({ mensagem: 'Preço atualizado com sucesso.' });
    } catch (error) {
        next(error);
    }
}

async function desativarPreco(req, res, next) {
    try {
        const idPreco = parseInt(req.params.idPreco, 10);
        if (Number.isNaN(idPreco)) {
            return res.status(400).json({ mensagem: 'ID de preço inválido.' });
        }

        const ok = await faturacaoModel.desativarRegistoPreco(idPreco);
        if (!ok) {
            return res.status(404).json({ mensagem: 'Preço não encontrado.' });
        }

        return res.status(200).json({ mensagem: 'Preço desativado com sucesso.' });
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

        if (Number(mes) < 1 || Number(mes) > 12) {
            return res.status(400).json({ mensagem: 'Mês deve ser entre 1 e 12.' });
        }

        const idsEE = await utilizadorModel.listarIdsEncarregadosEducacao();
        const resultados = [];
        let geradas = 0;
        let semConsumo = 0;
        let erros = 0;

        for (const idUtilizador of idsEE) {
            try {
                const idFaturacao = await faturacaoModel.gerarFaturacaoMensal(
                    parseInt(mes, 10),
                    parseInt(ano, 10),
                    idUtilizador,
                    parseInt(idAnoLetivo, 10)
                );
                if (idFaturacao === null) {
                    semConsumo += 1;
                    resultados.push({ idUtilizador, resultado: 'sem_consumo' });
                } else {
                    geradas += 1;
                    resultados.push({ idUtilizador, resultado: 'gerada', idFaturacao });
                }
            } catch (e) {
                erros += 1;
                resultados.push({
                    idUtilizador,
                    resultado: 'erro',
                    mensagem: e.message || 'Erro desconhecido'
                });
            }
        }

        return res.status(200).json({
            mensagem: `Processados ${idsEE.length} encarregados: ${geradas} fatura(s) gerada(s), ${semConsumo} sem consumo, ${erros} erro(s).`,
            total_encarregados: idsEE.length,
            faturas_geradas: geradas,
            sem_consumo: semConsumo,
            erros,
            detalhes: resultados
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
            faturas = await faturacaoModel.getFaturacao(null, mes, ano);
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
        const idUtilizador = parseInt(req.params.id, 10);
        const perfis = req.utilizador.perfis || [];

        if (Number.isNaN(idUtilizador)) {
            return res.status(400).json({ mensagem: 'ID de utilizador inválido.' });
        }

        if (!perfis.includes('Admin') && idUtilizador !== req.utilizador.id) {
            return res.status(403).json({
                mensagem: 'Só pode consultar o histórico do próprio utilizador.'
            });
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
    criarPreco,
    atualizarPreco,
    desativarPreco,
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