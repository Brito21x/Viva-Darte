const coachingModel = require('../models/coachingModel');
const faturacaoModel = require('../models/faturacaoModel');

// ============================================================================
// US09 / RF11 — ADICIONAR DISPONIBILIDADE (Professor)
// POST /api/coaching/disponibilidades
// Body: { diaSemana, horaInicio, horaFim }
// diaSemana: 1 = Seg-Qui | 2 = Sáb-Dom
// ============================================================================
async function adicionarDisponibilidade(req, res, next) {
    try {
        const idProfessor = req.utilizador.id;
        const { diaSemana, horaInicio, horaFim } = req.body;

        if (!diaSemana || !horaInicio || !horaFim) {
            return res.status(400).json({ mensagem: 'diaSemana, horaInicio e horaFim são obrigatórios.' });
        }

        if (![1, 2].includes(Number(diaSemana))) {
            return res.status(400).json({ mensagem: 'diaSemana deve ser 1 (Seg-Qui) ou 2 (Sáb-Dom).' });
        }

        await coachingModel.adicionarDisponibilidadeProfessor({
            diaSemana: Number(diaSemana),
            horaInicio,
            horaFim,
            idProfessor
        });

        return res.status(201).json({ mensagem: 'Disponibilidade registada com sucesso.' });
    } catch (error) {
        if (error.message.includes('sobrepõe') || error.message.includes('posterior')) {
            return res.status(409).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US09 / RF11 — LISTAR DISPONIBILIDADES DO PROFESSOR AUTENTICADO
// GET /api/coaching/disponibilidades
// ============================================================================
async function getDisponibilidades(req, res, next) {
    try {
        const idProfessor = req.utilizador.id;
        const disponibilidades = await coachingModel.getDisponibilidadesProfessor(idProfessor);
        return res.status(200).json(disponibilidades);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US09 / RF11 — REMOVER DISPONIBILIDADE (Professor — apenas as suas próprias)
// DELETE /api/coaching/disponibilidades/:id
// ============================================================================
async function removerDisponibilidade(req, res, next) {
    try {
        const idProfessor = req.utilizador.id;
        const idDisponibilidade = parseInt(req.params.id);

        if (isNaN(idDisponibilidade)) {
            return res.status(400).json({ mensagem: 'ID de disponibilidade inválido.' });
        }

        const sucesso = await coachingModel.removerDisponibilidadeProfessor(idDisponibilidade, idProfessor);

        if (!sucesso) {
            return res.status(404).json({ mensagem: 'Disponibilidade não encontrada ou sem permissão.' });
        }

        return res.status(200).json({ mensagem: 'Disponibilidade removida com sucesso.' });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US04 / RF04 — CONSULTAR VAGAS DISPONÍVEIS (EE)
// GET /api/coaching/vagas?idModalidade=1&diaSemana=1&data=2025-10-15
// ============================================================================
async function getVagasDisponiveis(req, res, next) {
    try {
        const { idModalidade, diaSemana, data } = req.query;

        if (!idModalidade || !diaSemana || !data) {
            return res.status(400).json({ mensagem: 'idModalidade, diaSemana e data são obrigatórios.' });
        }

        const resultado = await coachingModel.getDisponibilidadeEfetiva(
            parseInt(idModalidade),
            parseInt(diaSemana),
            data
        );

        // Calcular slots livres: disponibilidades sem ocupação sobreposta
        const { disponibilidades, ocupacoes } = resultado;

        const vagasLivres = disponibilidades.map(d => {
            const horaInicioMs = new Date(`1970-01-01T${d.hora_inicio}`).getTime();
            const horaFimMs = new Date(`1970-01-01T${d.hora_fim}`).getTime();

            const ocupado = ocupacoes.some(o => {
                if (o.id_professor !== d.id_professor) return false;
                const oInicio = new Date(`1970-01-01T${o.hora_inicio}`).getTime();
                const oFim = oInicio + o.duracao_minutos * 60000;
                return oInicio < horaFimMs && oFim > horaInicioMs;
            });

            return { ...d, disponivel: !ocupado };
        });

        return res.status(200).json(vagasLivres);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US10 / RF12 — AGENDA DO PROFESSOR AUTENTICADO
// GET /api/coaching/agenda?dataInicio=2025-10-01&dataFim=2025-10-31
// ============================================================================
async function getAgenda(req, res, next) {
    try {
        const idProfessor = req.utilizador.id;
        const { dataInicio, dataFim } = req.query;

        const agenda = await coachingModel.getAgendaProfessor(idProfessor, dataInicio || null, dataFim || null);
        return res.status(200).json(agenda);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US05 / RF05, RF06 — SUBMETER PEDIDO DE COACHING (EE)
// POST /api/coaching/pedidos
// Body: { idModalidade, idProfessor, formatoAula, duracaoMinutos, dataAula,
//         horaInicio, idAnoLetivo, alunosIds: [] }
// idProfessor pode ser null = "qualquer disponível"
// ============================================================================
async function criarPedidoCoaching(req, res, next) {
    try {
        const idEncarregado = req.utilizador.id;
        const {
            idModalidade,
            idProfessor,
            formatoAula,
            duracaoMinutos,
            dataAula,
            horaInicio,
            idAnoLetivo,
            alunosIds
        } = req.body;

        // Validações de campos obrigatórios
        if (!idModalidade || !formatoAula || !duracaoMinutos || !dataAula || !horaInicio || !idAnoLetivo) {
            return res.status(400).json({
                mensagem: 'idModalidade, formatoAula, duracaoMinutos, dataAula, horaInicio e idAnoLetivo são obrigatórios.'
            });
        }

        if (!Array.isArray(alunosIds) || alunosIds.length === 0) {
            return res.status(400).json({ mensagem: 'É necessário indicar pelo menos um aluno participante.' });
        }

        const formatosValidos = ['Solo', 'Dueto', 'Trio', 'Ensemble'];
        if (!formatosValidos.includes(formatoAula)) {
            return res.status(400).json({
                mensagem: `Formato inválido. Valores aceites: ${formatosValidos.join(', ')}.`
            });
        }

        const duracoesValidas = [30, 60, 90, 120];
        if (!duracoesValidas.includes(Number(duracaoMinutos))) {
            return res.status(400).json({
                mensagem: `Duração inválida. Valores aceites: ${duracoesValidas.join(', ')} minutos.`
            });
        }

        // Calcular custo estimado automaticamente (US16 / RF18)
        // NOTA: Aqui mantemos o cálculo 1 ou 2, porque a TABELA_PRECO usa esta lógica (Dia Útil vs Fim de Semana)
        const dataObj = new Date(dataAula);
        const diaSemanaPreco = [0, 6].includes(dataObj.getDay()) ? 2 : 1; 

        const custoEstimado = await faturacaoModel.calcularCustoAutomatico(
            formatoAula,
            Number(duracaoMinutos),
            diaSemanaPreco,
            parseInt(idModalidade),
            idProfessor ? parseInt(idProfessor) : null
        );

        const idPedido = await coachingModel.criarPedidoCoaching(
            {
                formatoAula,
                duracaoMinutos: Number(duracaoMinutos),
                dataAula,
                horaInicio,
                custoEstimado,
                idEncarregado,
                idAnoLetivo: parseInt(idAnoLetivo),
                idModalidade: parseInt(idModalidade),
                idProfessor: idProfessor ? parseInt(idProfessor) : null
            },
            alunosIds.map(Number)
        );

        return res.status(201).json({
            mensagem: 'Pedido de coaching submetido com sucesso.',
            idPedido,
            custoEstimado
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US06 / RF07 — LISTAR PEDIDOS PENDENTES (Coordenação)
// GET /api/coaching/pedidos/pendentes
// ============================================================================
async function getPedidosPendentes(req, res, next) {
    try {
        const pedidos = await coachingModel.getPedidosPendentes();
        return res.status(200).json(pedidos);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US07, US08 / RF08, RF09, RF10 — APROVAR PEDIDO E AGENDAR COACHING (Coordenação)
// POST /api/coaching/pedidos/:id/aprovar
// Body: { idSala, idProfessor, valorFinal }
// ============================================================================
async function aprovarPedido(req, res, next) {
    try {
        const idValidador = req.utilizador.id;
        const idPedido = parseInt(req.params.id);
        const { idSala, idProfessor, valorFinal } = req.body;

        if (!idSala || !idProfessor || valorFinal === undefined) {
            return res.status(400).json({ mensagem: 'idSala, idProfessor e valorFinal são obrigatórios.' });
        }

        const {
            formatoAula,
            duracaoMinutos,
            numeroParticipantes,
            dataAula,
            horaInicio,
            idAnoLetivo,
            idModalidade
        } = req.body;

        if (!formatoAula || !duracaoMinutos || !dataAula || !horaInicio || !idAnoLetivo || !idModalidade) {
            return res.status(400).json({
                mensagem: 'Dados do coaching incompletos. Verifique formatoAula, duracaoMinutos, dataAula, horaInicio, idAnoLetivo e idModalidade.'
            });
        }

        // --- CÁLCULO DO DIA DA SEMANA REAL (1 a 7) ---
        // A tabela HORARIO usa os dias reais da semana para as aulas regulares
        const dataObj = new Date(dataAula);
        let diaSemanaCoaching = dataObj.getDay();
        // O getDay() de JavaScript devolve 0 para Domingo. Convertemos para 7 para bater certo com a lógica.
        diaSemanaCoaching = diaSemanaCoaching === 0 ? 7 : diaSemanaCoaching;

        const idCoaching = await coachingModel.aprovarEAgendarCoaching({
            idPedido,
            formatoAula,
            duracaoMinutos: Number(duracaoMinutos),
            numeroParticipantes: Number(numeroParticipantes),
            dataAula,
            horaInicio,
            diaSemanaCoaching, // Enviamos a propriedade que o model agora exige para validar conflitos!
            idProfessor: parseInt(idProfessor),
            idAnoLetivo: parseInt(idAnoLetivo),
            idModalidade: parseInt(idModalidade),
            idSala: parseInt(idSala),
            valorFinal: parseFloat(valorFinal),
            idValidador
        });

        return res.status(201).json({
            mensagem: 'Pedido aprovado e coaching agendado com sucesso.',
            idCoaching
        });
    } catch (error) {
        if (error.message.includes('Conflito')) {
            return res.status(409).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US07 / RF08 — REJEITAR PEDIDO (Coordenação)
// POST /api/coaching/pedidos/:id/rejeitar
// Body: { justificacao }
// ============================================================================
async function rejeitarPedido(req, res, next) {
    try {
        const idPedido = parseInt(req.params.id);
        const { justificacao } = req.body;

        if (!justificacao) {
            return res.status(400).json({ mensagem: 'Justificação é obrigatória para rejeitar um pedido.' });
        }

        const sucesso = await coachingModel.rejeitarPedidoCoaching(idPedido, justificacao);

        if (!sucesso) {
            return res.status(404).json({ mensagem: 'Pedido não encontrado ou já não está pendente.' });
        }

        return res.status(200).json({ mensagem: 'Pedido rejeitado com sucesso.' });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US12 / RF14 — CANCELAR COACHING (EE ou Coordenação)
// DELETE /api/coaching/:id
// ============================================================================
async function cancelarCoaching(req, res, next) {
    try {
        const idCoaching = parseInt(req.params.id);

        if (isNaN(idCoaching)) {
            return res.status(400).json({ mensagem: 'ID de coaching inválido.' });
        }

        await coachingModel.cancelarCoaching(idCoaching);

        return res.status(200).json({ mensagem: 'Coaching cancelado com sucesso.' });
    } catch (error) {
        if (error.message.includes('cancelado') || error.message.includes('encontrado')) {
            return res.status(400).json({ mensagem: error.message });
        }
        next(error);
    }
}

// ============================================================================
// US13 / RF15 — CONFIRMAR REALIZAÇÃO DA AULA (Professor ou EE)
// POST /api/coaching/:id/validar
// Body: { estadoValidacao, observacoes }
// estadoValidacao: 'Confirmado' | 'Nao_Realizado'
// ============================================================================
async function registarValidacao(req, res, next) {
    try {
        const idUtilizador = req.utilizador.id;
        const perfis = req.utilizador.perfis || [];
        const idCoaching = parseInt(req.params.id);
        const { estadoValidacao, observacoes } = req.body;

        const estadosValidos = ['Confirmado', 'Nao_Realizado'];
        if (!estadosValidos.includes(estadoValidacao)) {
            return res.status(400).json({
                mensagem: `Estado inválido. Valores aceites: ${estadosValidos.join(', ')}.`
            });
        }

        // Determinar tipo de validador com base no perfil do utilizador autenticado
        let tipoValidador;
        if (perfis.includes('Professor')) {
            tipoValidador = 'Professor';
        } else if (perfis.includes('EE')) {
            tipoValidador = 'EncarregadoEducacao';
        } else {
            return res.status(403).json({ mensagem: 'Sem permissão para validar esta aula.' });
        }

        await coachingModel.registarValidacaoAula(
            idCoaching,
            idUtilizador,
            tipoValidador,
            estadoValidacao,
            observacoes || null
        );

        return res.status(201).json({ mensagem: 'Validação registada com sucesso.' });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US14 / RF16 — CONCLUSÃO FINAL PELA COORDENAÇÃO (resolve divergências)
// POST /api/coaching/:id/concluir
// Body: { estadoFinal, observacoes }
// estadoFinal: 'Realizado' | 'Nao_Realizado'
// ============================================================================
async function concluirCoaching(req, res, next) {
    try {
        const idCoordenador = req.utilizador.id;
        const idCoaching = parseInt(req.params.id);
        const { estadoFinal, observacoes } = req.body;

        const estadosValidos = ['Realizado', 'Nao_Realizado'];
        if (!estadosValidos.includes(estadoFinal)) {
            return res.status(400).json({
                mensagem: `Estado final inválido. Valores aceites: ${estadosValidos.join(', ')}.`
            });
        }

        await coachingModel.concluirCoachingPelaCoordenacao(
            idCoaching,
            idCoordenador,
            estadoFinal,
            observacoes || null
        );

        return res.status(200).json({ mensagem: `Coaching marcado como "${estadoFinal}" com sucesso.` });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    adicionarDisponibilidade,
    getDisponibilidades,
    removerDisponibilidade,
    getVagasDisponiveis,
    getAgenda,
    criarPedidoCoaching,
    getPedidosPendentes,
    aprovarPedido,
    rejeitarPedido,
    cancelarCoaching,
    registarValidacao,
    concluirCoaching
};