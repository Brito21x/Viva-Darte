const coachingModel = require('../models/coachingModel');
const faturacaoModel = require('../models/faturacaoModel');

/** Data fixa só para parsear horas (`time`) como instante; a duração depende só da diferença entre horas. */
const DATA_REF_COMPARACAO_HORAS = '2026-01-01';

/** Evita bugs de timezone com strings `YYYY-MM-DD` (interpretação UTC vs local). */
function parseDateParts(dataValor) {
    if (!dataValor) return null;
    const s =
        dataValor instanceof Date
            ? `${dataValor.getFullYear()}-${String(dataValor.getMonth() + 1).padStart(2, '0')}-${String(
                  dataValor.getDate()
              ).padStart(2, '0')}`
            : String(dataValor).split('T')[0];
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function diaSemanaPrecoFromDateValue(dataValor) {
    const dt = parseDateParts(dataValor);
    if (!dt) return 1;
    const day = dt.getDay();
    return [0, 6].includes(day) ? 2 : 1;
}

function diaSemanaCoachingFromDateValue(dataValor) {
    const dt = parseDateParts(dataValor);
    if (!dt) return 1;
    const day = dt.getDay();
    return day === 0 ? 7 : day;
}

/** Início da aula no fuso local (data_aula + hora_inicio). */
function instanteInicioCoaching({ data_aula, hora_inicio }) {
    const d = data_aula instanceof Date ? new Date(data_aula) : parseDateParts(data_aula);
    if (!d) return null;
    let hh = 0;
    let mm = 0;
    let ss = 0;
    if (hora_inicio instanceof Date) {
        hh = hora_inicio.getHours();
        mm = hora_inicio.getMinutes();
        ss = hora_inicio.getSeconds();
    } else if (hora_inicio != null) {
        const m = String(hora_inicio).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (m) {
            hh = parseInt(m[1], 10);
            mm = parseInt(m[2], 10);
            ss = m[3] ? parseInt(m[3], 10) : 0;
        }
    }
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, ss);
}

/** Fim previsto da aula (início + duração; fallback 60 min). */
function instanteFimCoaching(cab) {
    const inicio = instanteInicioCoaching(cab);
    if (!inicio) return null;
    const dur = Number(cab.duracao_minutos);
    const minutos = Number.isFinite(dur) && dur > 0 ? dur : 60;
    return new Date(inicio.getTime() + minutos * 60000);
}

/** Duração em minutos de um intervalo hora_inicio → hora_fim (mesmo dia). */
function duracaoSlotMinutos(horaInicio, horaFim) {
    const t0 = new Date(`${DATA_REF_COMPARACAO_HORAS}T${horaInicio}`).getTime();
    const t1 = new Date(`${DATA_REF_COMPARACAO_HORAS}T${horaFim}`).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;
    return Math.round((t1 - t0) / 60000);
}

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
// GET /api/coaching/vagas?idModalidade=&diaSemana=&data=&idProfessor=&duracaoMinutos=
// ============================================================================
async function getVagasDisponiveis(req, res, next) {
    try {
        const { idModalidade, diaSemana, data, idProfessor, duracaoMinutos } = req.query;

        if (!idModalidade || !diaSemana || !data) {
            return res.status(400).json({ mensagem: 'idModalidade, diaSemana e data são obrigatórios.' });
        }

        const idProfFiltro =
            idProfessor !== undefined && idProfessor !== '' && idProfessor != null
                ? parseInt(idProfessor, 10)
                : null;
        if (idProfessor !== undefined && idProfessor !== '' && Number.isNaN(idProfFiltro)) {
            return res.status(400).json({ mensagem: 'idProfessor inválido.' });
        }

        const resultado = await coachingModel.getDisponibilidadeEfetiva(
            parseInt(idModalidade, 10),
            parseInt(diaSemana, 10),
            data,
            idProfFiltro
        );

        // Calcular slots livres: disponibilidades sem ocupação sobreposta
        const { disponibilidades, ocupacoes } = resultado;

        let vagasLivres = disponibilidades.map(d => {
            const horaInicioMs = new Date(`${DATA_REF_COMPARACAO_HORAS}T${d.hora_inicio}`).getTime();
            const horaFimMs = new Date(`${DATA_REF_COMPARACAO_HORAS}T${d.hora_fim}`).getTime();

            const ocupado = ocupacoes.some(o => {
                if (o.id_professor !== d.id_professor) return false;
                const oInicio = new Date(`${DATA_REF_COMPARACAO_HORAS}T${o.hora_inicio}`).getTime();
                const durMin = Number(o.duracao_minutos);
                const oFim = oInicio + (Number.isFinite(durMin) && durMin > 0 ? durMin * 60000 : 60000);
                return oInicio < horaFimMs && oFim > horaInicioMs;
            });

            return { ...d, disponivel: !ocupado };
        });

        const durReq =
            duracaoMinutos !== undefined && duracaoMinutos !== '' && duracaoMinutos != null
                ? parseInt(duracaoMinutos, 10)
                : null;
        if (durReq != null) {
            if (Number.isNaN(durReq) || durReq < 1) {
                return res.status(400).json({ mensagem: 'duracaoMinutos inválido.' });
            }
            vagasLivres = vagasLivres.filter(
                d => duracaoSlotMinutos(d.hora_inicio, d.hora_fim) >= durReq
            );
        }

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
        const diaSemanaPreco = diaSemanaPrecoFromDateValue(dataAula);

        const custoEstimado = await faturacaoModel.calcularCustoAutomatico(
            formatoAula,
            Number(duracaoMinutos),
            diaSemanaPreco,
            parseInt(idModalidade),
            idProfessor ? parseInt(idProfessor) : null
        );

        if (custoEstimado === null || custoEstimado === undefined) {
            return res.status(404).json({
                mensagem: 'Não foi encontrada tabela de preços para esta combinação (formato, duração, dia, modalidade/professor).'
            });
        }

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
// GET /api/coaching/pedidos/:id — detalhe de um pedido (Coordenação ou EE dono do pedido)
// ============================================================================
async function getPedidoCoaching(req, res, next) {
    try {
        const idPedido = parseInt(req.params.id, 10);
        if (Number.isNaN(idPedido)) {
            return res.status(400).json({ mensagem: 'ID de pedido inválido.' });
        }

        const pedido = await coachingModel.getPedidoCoachingPorId(idPedido);
        if (!pedido) {
            return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
        }

        const perfis = req.utilizador.perfis || [];
        const isAdmin = perfis.includes('Admin');
        const isDonoEE =
            perfis.includes('EE') && pedido.UTILIZADORid_utilizador === req.utilizador.id;

        if (!isAdmin && !isDonoEE) {
            return res.status(403).json({ mensagem: 'Sem permissão para consultar este pedido.' });
        }

        return res.status(200).json(pedido);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US05 / RF06 — LISTAR OS MEUS PEDIDOS DE COACHING (EE)
// GET /api/coaching/pedidos/meus
// ============================================================================
async function listarMeusPedidosCoaching(req, res, next) {
    try {
        const pedidos = await coachingModel.getPedidosPorEncarregado(req.utilizador.id);
        return res.status(200).json(pedidos);
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US05 / RF06 — CANCELAR PEDIDO PENDENTE (EE, apenas os seus)
// DELETE /api/coaching/pedidos/:id/pendente
// ============================================================================
async function cancelarMeuPedidoPendente(req, res, next) {
    try {
        const idPedido = parseInt(req.params.id, 10);
        if (Number.isNaN(idPedido)) {
            return res.status(400).json({ mensagem: 'ID de pedido inválido.' });
        }

        const resultado = await coachingModel.cancelarPedidoPendenteEncarregado(
            idPedido,
            req.utilizador.id
        );

        if (resultado === 'cancelado') {
            return res.status(200).json({ mensagem: 'Pedido cancelado com sucesso.' });
        }
        if (resultado === 'nao_encontrado') {
            return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
        }
        return res.status(409).json({
            mensagem: 'Só é possível cancelar pedidos no estado Pendente.'
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
// Body: { idSala, idProfessor, valorFinal } — restantes campos vêm do pedido na BD
// ============================================================================
async function aprovarPedido(req, res, next) {
    try {
        const idValidador = req.utilizador.id;
        const idPedido = parseInt(req.params.id, 10);
        const { idSala, idProfessor, valorFinal } = req.body;

        if (Number.isNaN(idPedido)) {
            return res.status(400).json({ mensagem: 'ID de pedido inválido.' });
        }

        if (!idSala || !idProfessor || valorFinal === undefined) {
            return res.status(400).json({ mensagem: 'idSala, idProfessor e valorFinal são obrigatórios.' });
        }

        const pedido = await coachingModel.getPedidoCoachingPorId(idPedido);
        if (!pedido) {
            return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
        }
        if (pedido.estado !== 'Pendente') {
            return res.status(409).json({ mensagem: 'Este pedido já não está pendente de aprovação.' });
        }

        const formatoAula = pedido.formato_aula;
        const duracaoMinutos = pedido.duracao_minutos;
        const numeroParticipantes = pedido.numero_participantes;
        const dataAula = pedido.data_aula_pretendida;
        const horaInicio = pedido.hora_inicio_pretendida;
        const idAnoLetivo = pedido.ANO_LETIVOid_ano_letivo;
        const idModalidade = pedido.MODALIDADEid_modalidade;

        if (
            !formatoAula ||
            duracaoMinutos == null ||
            numeroParticipantes == null ||
            !dataAula ||
            !horaInicio ||
            idAnoLetivo == null ||
            idModalidade == null
        ) {
            return res.status(500).json({
                mensagem: 'Pedido na BD incompleto. Contacte o administrador.'
            });
        }

        const numPart = Number(numeroParticipantes);
        if (!Number.isFinite(numPart) || numPart < 1) {
            return res.status(400).json({ mensagem: 'numero_participantes do pedido é inválido.' });
        }

        const diaSemanaCoaching = diaSemanaCoachingFromDateValue(dataAula);

        const idCoaching = await coachingModel.aprovarEAgendarCoaching({
            idPedido,
            formatoAula,
            duracaoMinutos: Number(duracaoMinutos),
            numeroParticipantes: numPart,
            dataAula,
            horaInicio,
            diaSemanaCoaching,
            idProfessor: parseInt(idProfessor, 10),
            idAnoLetivo: parseInt(idAnoLetivo, 10),
            idModalidade: parseInt(idModalidade, 10),
            idSala: parseInt(idSala, 10),
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
        const idPedido = parseInt(req.params.id, 10);
        const { justificacao } = req.body;

        if (!justificacao) {
            return res.status(400).json({ mensagem: 'Justificação é obrigatória para rejeitar um pedido.' });
        }

        const sucesso = await coachingModel.rejeitarPedidoCoaching(idPedido);

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
        const idCoaching = parseInt(req.params.id, 10);
        const perfis = req.utilizador.perfis || [];

        if (Number.isNaN(idCoaching)) {
            return res.status(400).json({ mensagem: 'ID de coaching inválido.' });
        }

        const cab = await coachingModel.getCoachingCabecalhoCancelamento(idCoaching);
        if (!cab) {
            return res.status(404).json({ mensagem: 'Coaching não encontrado.' });
        }
        if (cab.estado === 'Cancelado') {
            return res.status(400).json({ mensagem: 'Este coaching já está cancelado.' });
        }

        if (perfis.includes('EE') && !perfis.includes('Admin')) {
            const autorizado = await coachingModel.coachingPertenceAEncarregado(
                idCoaching,
                req.utilizador.id
            );
            if (!autorizado) {
                return res.status(403).json({
                    mensagem: 'Só pode cancelar marcações de coachings associados à sua conta.'
                });
            }

            const inicioAula = instanteInicioCoaching(cab);
            if (!inicioAula) {
                return res.status(400).json({ mensagem: 'Dados de data/hora do coaching inválidos.' });
            }

            if (inicioAula.getTime() <= Date.now()) {
                return res.status(400).json({
                    mensagem: 'Não é possível cancelar uma aula cuja data e hora já passaram.'
                });
            }
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
        const idCoaching = parseInt(req.params.id, 10);
        const { estadoValidacao, observacoes } = req.body;

        if (Number.isNaN(idCoaching)) {
            return res.status(400).json({ mensagem: 'ID de coaching inválido.' });
        }

        const estadosValidos = ['Confirmado', 'Nao_Realizado'];
        if (!estadosValidos.includes(estadoValidacao)) {
            return res.status(400).json({
                mensagem: `Estado inválido. Valores aceites: ${estadosValidos.join(', ')}.`
            });
        }

        const cab = await coachingModel.getCoachingCabecalhoCancelamento(idCoaching);
        if (!cab) {
            return res.status(404).json({ mensagem: 'Coaching não encontrado.' });
        }

        const estadosQuePermitemValidar = ['Agendado', 'Confirmado'];
        if (!estadosQuePermitemValidar.includes(cab.estado)) {
            return res.status(400).json({
                mensagem: 'Só é possível validar coachings agendados ou confirmados.'
            });
        }

        const fimAula = instanteFimCoaching(cab);
        if (!fimAula || fimAula.getTime() > Date.now()) {
            return res.status(400).json({
                mensagem: 'Só é possível validar aulas já terminadas (após a data e hora previstas).'
            });
        }

        // Determinar tipo de validador com base no perfil do utilizador autenticado
        let tipoValidador;
        if (perfis.includes('Professor')) {
            const ok = await coachingModel.coachingPertenceAProfessorAtivo(
                idCoaching,
                req.utilizador.id
            );
            if (!ok) {
                return res.status(403).json({
                    mensagem: 'Só pode validar coachings em que é o professor titular.'
                });
            }
            tipoValidador = 'Professor';
        } else if (perfis.includes('EE')) {
            const ok = await coachingModel.coachingPertenceAEncarregado(
                idCoaching,
                req.utilizador.id
            );
            if (!ok) {
                return res.status(403).json({
                    mensagem: 'Só pode validar coachings associados aos seus pedidos.'
                });
            }
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
        const idCoaching = parseInt(req.params.id, 10);
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
        if (error.message && error.message.includes('Coaching não encontrado')) {
            return res.status(404).json({ mensagem: error.message });
        }
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
    getPedidoCoaching,
    listarMeusPedidosCoaching,
    cancelarMeuPedidoPendente,
    getPedidosPendentes,
    aprovarPedido,
    rejeitarPedido,
    cancelarCoaching,
    registarValidacao,
    concluirCoaching
};