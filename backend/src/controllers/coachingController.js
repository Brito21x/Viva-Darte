/**
 * @fileoverview Controlador de Gestão de Coaching.
 * Implementa as User Stories RF04 a RF16 (Disponibilidades, Aprovação de Coordenação,
 * Submissão de Pedidos EE, Cálculo de Preços, Validações de conflitos).
 */

const coachingModel = require("../models/coachingModel");
const precoCoachingModel = require("../models/precoCoachingModel");
const { utilizadorTemPerfil } = require("../middlewares/auth");

const DATA_REF_COMPARACAO_HORAS = "2026-01-01";
const MSG_SEM_DISPONIBILIDADE =
  "O professor não tem horário disponível nesse período.";
const FORMATOS_AULA_VALIDOS = ["Solo", "Dueto", "Trio", "Ensemble"];
const DURACOES_AULA_VALIDAS = [30, 60, 90, 120];
const ESTADOS_VALIDACAO_VALIDOS = ["Confirmado", "Nao_Realizado"];
const ESTADOS_FINAIS_VALIDOS = ["Realizado", "Nao_Realizado"];

function normalizarHoraSqlTime(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const hh = String(valor.getUTCHours()).padStart(2, "0");
    const mm = String(valor.getUTCMinutes()).padStart(2, "0");
    const ss = String(valor.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  const s = String(valor ?? "").trim();
  if (!s) return null;
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    const hh = String(m24[1]).padStart(2, "0");
    const mm = m24[2];
    const ss = m24[3] ?? "00";
    return `${hh}:${mm}:${ss}`;
  }
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!m12) return null;
  let hh = parseInt(m12[1], 10);
  const mm = m12[2];
  const ampm = m12[3].toUpperCase();
  if (ampm === "PM" && hh < 12) hh += 12;
  if (ampm === "AM" && hh === 12) hh = 0;
  return `${String(hh).padStart(2, "0")}:${mm}:00`;
}

function validarFormatoAula(formatoAula) {
  return FORMATOS_AULA_VALIDOS.includes(formatoAula)
    ? null
    : `Formato inválido. Valores aceites: ${FORMATOS_AULA_VALIDOS.join(", ")}.`;
}

function validarDuracaoAula(duracaoMinutos) {
  return DURACOES_AULA_VALIDAS.includes(Number(duracaoMinutos))
    ? null
    : `Duração inválida. Valores aceites: ${DURACOES_AULA_VALIDAS.join(", ")} minutos.`;
}

function parseDateParts(dataValor) {
  if (!dataValor) return null;
  const s =
    dataValor instanceof Date
      ? `${dataValor.getFullYear()}-${String(dataValor.getMonth() + 1).padStart(2, "0")}-${String(dataValor.getDate()).padStart(2, "0")}`
      : String(dataValor).split("T")[0];
  const [y, m, d] = s.split("-").map(Number);
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

function instanteInicioCoaching({ data_aula, hora_inicio }) {
  const d =
    data_aula instanceof Date ? new Date(data_aula) : parseDateParts(data_aula);
  if (!d) return null;
  let hh = 0,
    mm = 0,
    ss = 0;
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

function instanteFimCoaching(cab) {
  const inicio = instanteInicioCoaching(cab);
  if (!inicio) return null;
  const dur = Number(cab.duracao_minutos);
  const minutos = Number.isFinite(dur) && dur > 0 ? dur : 60;
  return new Date(inicio.getTime() + minutos * 60000);
}

function duracaoSlotMinutos(horaInicio, horaFim) {
  const t0 = new Date(`${DATA_REF_COMPARACAO_HORAS}T${horaInicio}`).getTime();
  const t1 = new Date(`${DATA_REF_COMPARACAO_HORAS}T${horaFim}`).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;
  return Math.round((t1 - t0) / 60000);
}

function instanteHoraReferencia(horaValor) {
  const horaNorm = normalizarHoraSqlTime(horaValor);
  if (!horaNorm) return null;
  const t = new Date(`${DATA_REF_COMPARACAO_HORAS}T${horaNorm}`).getTime();
  return Number.isFinite(t) ? t : null;
}

// RF11. O sistema deve permitir ao professor definir e atualizar a sua disponibilidade.
async function adicionarDisponibilidade(req, res, next) {
  try {
    const idProfessor = req.utilizador.id;
    const { diaSemana, horaInicio, horaFim } = req.body;
    if (!diaSemana || !horaInicio || !horaFim)
      return res.status(400).json({
        mensagem: "diaSemana, horaInicio e horaFim são obrigatórios.",
      });
    if (Number(diaSemana) < 1 || Number(diaSemana) > 7)
      return res.status(400).json({
        mensagem: "diaSemana deve ser entre 1 (Segunda) e 7 (Domingo).",
      });

    const hIni = normalizarHoraSqlTime(horaInicio);
    const hFim = normalizarHoraSqlTime(horaFim);
    if (!hIni || !hFim)
      return res.status(400).json({ mensagem: "Horas inválidas." });

    await coachingModel.adicionarDisponibilidadeProfessor({
      diaSemana: Number(diaSemana),
      horaInicio: hIni,
      horaFim: hFim,
      idProfessor,
    });
    return res
      .status(201)
      .json({ mensagem: "Disponibilidade registada com sucesso." });
  } catch (error) {
    if (
      error.message.includes("sobrepõe") ||
      error.message.includes("posterior")
    )
      return res.status(409).json({ mensagem: error.message });
    next(error);
  }
}

async function getDisponibilidades(req, res, next) {
  try {
    const disponibilidades = await coachingModel.getDisponibilidadesProfessor(
      req.utilizador.id,
    );
    return res.status(200).json(disponibilidades);
  } catch (error) {
    next(error);
  }
}

async function removerDisponibilidade(req, res, next) {
  try {
    const sucesso = await coachingModel.removerDisponibilidadeProfessor(
      parseInt(req.params.id),
      req.utilizador.id,
    );
    if (!sucesso)
      return res
        .status(404)
        .json({ mensagem: "Disponibilidade não encontrada." });
    return res
      .status(200)
      .json({ mensagem: "Disponibilidade removida com sucesso." });
  } catch (error) {
    next(error);
  }
}

// RF18. Calcular automaticamente o custo dos coachings
async function getPrecoEstimado(req, res, next) {
  try {
    const {
      dataAula,
      horaInicio,
      formatoAula,
      duracaoMinutos,
      idModalidade,
      idProfessor,
    } = req.query;
    if (!dataAula || !horaInicio)
      return res
        .status(400)
        .json({ mensagem: "dataAula e horaInicio são obrigatórios." });
    const formato = formatoAula || "Solo";
    const dur =
      duracaoMinutos != null && duracaoMinutos !== ""
        ? parseInt(duracaoMinutos, 10)
        : 60;

    const erroFormato = validarFormatoAula(formato);
    if (erroFormato) return res.status(400).json({ mensagem: erroFormato });

    const hIni = normalizarHoraSqlTime(horaInicio);
    if (!hIni)
      return res.status(400).json({ mensagem: "horaInicio inválida." });

    let custoEstimado = await precoCoachingModel.calcularCustoAutomatico(
      formato,
      dur,
      diaSemanaPrecoFromDateValue(dataAula),
      idModalidade ? parseInt(idModalidade, 10) : null,
      idProfessor ? parseInt(idProfessor, 10) : null,
    );

    // Se a BD não tiver um preço genérico para esta configuração, forçamos para 0€ em vez de crashar!
    if (custoEstimado == null) {
      const precoBaseHora = 35.0; // Valor base por hora (Solo)
      custoEstimado = (dur / 60) * precoBaseHora;

      // Acréscimos realistas pelo formato
      if (formato === "Dueto") custoEstimado += 10;
      if (formato === "Trio") custoEstimado += 15;
      if (formato === "Ensemble") custoEstimado += 25;
    }

    return res.status(200).json({
      dataAula: String(dataAula).split("T")[0],
      horaInicio: String(horaInicio).trim(),
      formatoAula: formato,
      duracaoMinutos: dur,
      diaSemanaPreco: diaSemanaPrecoFromDateValue(dataAula),
      custoEstimado,
    });
  } catch (error) {
    return res.status(500).json({ mensagem: error?.message });
  }
}

// RF10 (Auxiliar) - Verificar Slot Livre
async function getSlotLivre(req, res, next) {
  try {
    const { dataAula, horaInicio, duracaoMinutos } = req.query;
    if (!dataAula || !horaInicio) {
      return res
        .status(400)
        .json({ mensagem: "dataAula e horaInicio são obrigatórios." });
    }

    const dur =
      duracaoMinutos != null && duracaoMinutos !== ""
        ? parseInt(duracaoMinutos, 10)
        : 60;
    if (Number.isNaN(dur) || dur <= 0)
      return res.status(400).json({ mensagem: "duracaoMinutos inválida." });

    const hIni = normalizarHoraSqlTime(horaInicio);
    if (!hIni)
      return res.status(400).json({ mensagem: "horaInicio inválida." });

    const dataParts = parseDateParts(dataAula);
    if (!dataParts)
      return res.status(400).json({ mensagem: "dataAula inválida." });

    const diaSemanaCoaching = diaSemanaCoachingFromDateValue(dataAula);
    const r = await coachingModel.verificarSlotLivreProfessor({
      idProfessor: req.utilizador.id,
      dataAula: dataParts,
      horaInicio: hIni,
      duracaoMinutos: dur,
      diaSemanaCoaching,
    });

    return res.status(200).json(r);
  } catch (error) {
    return res
      .status(500)
      .json({ mensagem: error?.message || "Ocorreu um erro interno." });
  }
}

// RF04. Consultar vagas disponíveis por modalidade, professor, dia e duração.
async function getVagasDisponiveis(req, res, next) {
  try {
    const { idModalidade, data, idProfessor, duracaoMinutos, idAnoLetivo } =
      req.query;
    if (!idModalidade || !data)
      return res
        .status(400)
        .json({ mensagem: "idModalidade e data são obrigatórios." });

    const idAnoParsed = idAnoLetivo ? parseInt(idAnoLetivo, 10) : null;
    const idProfFiltro = idProfessor ? parseInt(idProfessor, 10) : null;
    const diaExato = diaSemanaCoachingFromDateValue(data);

    const { disponibilidades, ocupacoes } =
      await coachingModel.getDisponibilidadeEfetiva(
        parseInt(idModalidade, 10),
        diaExato,
        data,
        idProfFiltro,
        idAnoParsed,
      );

    let vagasLivres = disponibilidades.map((d) => {
      const horaInicioMs = new Date(
        `${DATA_REF_COMPARACAO_HORAS}T${d.hora_inicio}`,
      ).getTime();
      const horaFimMs = new Date(
        `${DATA_REF_COMPARACAO_HORAS}T${d.hora_fim}`,
      ).getTime();
      const ocupado = ocupacoes.some((o) => {
        if (o.id_professor !== d.id_professor) return false;
        const oInicio = new Date(
          `${DATA_REF_COMPARACAO_HORAS}T${o.hora_inicio}`,
        ).getTime();
        const durMin = Number(o.duracao_minutos);
        const oFim =
          oInicio +
          (Number.isFinite(durMin) && durMin > 0 ? durMin * 60000 : 60000);
        return oInicio < horaFimMs && oFim > horaInicioMs;
      });
      return { ...d, disponivel: !ocupado };
    });

    const durReq = duracaoMinutos ? parseInt(duracaoMinutos, 10) : null;
    if (durReq != null)
      vagasLivres = vagasLivres.filter(
        (d) => duracaoSlotMinutos(d.hora_inicio, d.hora_fim) >= durReq,
      );

    return res.status(200).json(vagasLivres);
  } catch (error) {
    next(error);
  }
}

async function getProfessoresDisponiveisAprovacao(req, res, next) {
  try {
    const { idModalidade, dataAula, horaInicio, duracaoMinutos, idAnoLetivo } =
      req.query;
    const duracao = parseInt(duracaoMinutos, 10);
    const inicioPedido = instanteHoraReferencia(horaInicio);
    const fimPedido = inicioPedido + duracao * 60000;
    const disponibilidade = await coachingModel.getDisponibilidadeEfetiva(
      parseInt(idModalidade, 10),
      diaSemanaCoachingFromDateValue(dataAula),
      dataAula,
      null,
      idAnoLetivo ? parseInt(idAnoLetivo, 10) : null,
    );

    const professores = new Map();
    for (const disp of disponibilidade.disponibilidades || []) {
      const inicioDisp = instanteHoraReferencia(disp.hora_inicio);
      const fimDisp = instanteHoraReferencia(disp.hora_fim);
      if (inicioDisp > inicioPedido || fimDisp < fimPedido) continue;

      const ocupado = (disponibilidade.ocupacoes || []).some((ocupacao) => {
        if (Number(ocupacao.id_professor) !== Number(disp.id_professor))
          return false;
        const inicioOcup = instanteHoraReferencia(ocupacao.hora_inicio);
        const fimOcup =
          inicioOcup + (Number(ocupacao.duracao_minutos) || 60) * 60000;
        return inicioOcup < fimPedido && fimOcup > inicioPedido;
      });

      if (!ocupado)
        professores.set(Number(disp.id_professor), {
          id_professor: disp.id_professor,
          nome_professor: disp.nome_professor,
        });
    }
    return res.status(200).json([...professores.values()]);
  } catch (error) {
    next(error);
  }
}

// RF12. Permitir ao professor consultar a sua agenda de coachings.
async function getAgenda(req, res, next) {
  try {
    const agenda = await coachingModel.getAgendaProfessor(
      req.utilizador.id,
      req.query.dataInicio || null,
      req.query.dataFim || null,
    );
    return res.status(200).json(agenda);
  } catch (error) {
    next(error);
  }
}

// RF05 / RF06. Submeter pedidos de coaching e registar com custo estimado.
async function criarPedidoCoaching(req, res, next) {
  try {
    const idEncarregado = req.utilizador.id;
    const isEE = utilizadorTemPerfil(req.utilizador.perfis || [], "EE");
    const {
      idModalidade,
      idProfessor,
      formatoAula,
      duracaoMinutos,
      dataAula,
      horaInicio,
      idAnoLetivo,
      alunosIds,
    } = req.body;

    if (!isEE)
      return res.status(403).json({ mensagem: "Apenas EE pode pedir aulas." });
    if (!idProfessor) {
      return res
        .status(400)
        .json({ mensagem: "A seleção de um professor é obrigatória." });
    }

    if (!Array.isArray(alunosIds) || alunosIds.length === 0)
      return res.status(400).json({ mensagem: "Indicar pelo menos um aluno." });

    if (idProfessor) {
      const temDisponibilidade =
        await coachingModel.professorTemDisponibilidadeNoSlot({
          idProfessor: parseInt(idProfessor, 10),
          dataAula,
          horaInicio,
          duracaoMinutos: Number(duracaoMinutos),
          diaSemanaCoaching: diaSemanaCoachingFromDateValue(dataAula),
        });
      if (!temDisponibilidade)
        return res.status(409).json({ mensagem: MSG_SEM_DISPONIBILIDADE });
    }

    let custoEstimado = await precoCoachingModel.calcularCustoAutomatico(
      formatoAula,
      Number(duracaoMinutos),
      diaSemanaPrecoFromDateValue(dataAula),
      parseInt(idModalidade),
      idProfessor ? parseInt(idProfessor) : null,
    );

    // Se a BD não tiver um preço genérico para esta configuração, forçamos para 0€ em vez de crashar!
    if (custoEstimado == null) {
      const precoBaseHora = 35.0; // Valor base por hora (Solo)
      custoEstimado = (Number(duracaoMinutos) / 60) * precoBaseHora;

      if (formatoAula === "Dueto") custoEstimado += 10;
      if (formatoAula === "Trio") custoEstimado += 15;
      if (formatoAula === "Ensemble") custoEstimado += 25;
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
        idProfessor: idProfessor ? parseInt(idProfessor) : null,
      },
      alunosIds.map(Number),
      { skipAlunoValidation: false },
    );
    return res.status(201).json({
      mensagem: "Pedido submetido com sucesso.",
      idPedido,
      custoEstimado,
    });
  } catch (error) {
    next(error);
  }
}

async function getPedidoCoaching(req, res, next) {
  try {
    const pedido = await coachingModel.getPedidoCoachingPorId(
      parseInt(req.params.id, 10),
    );
    if (!pedido)
      return res.status(404).json({ mensagem: "Pedido não encontrado." });
    return res.status(200).json(pedido);
  } catch (error) {
    next(error);
  }
}

async function listarMeusPedidosCoaching(req, res, next) {
  try {
    const pedidos = await coachingModel.getPedidosPorEncarregado(
      req.utilizador.id,
    );
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

async function cancelarMeuPedidoPendente(req, res, next) {
  try {
    const resultado = await coachingModel.cancelarPedidoPendenteEncarregado(
      parseInt(req.params.id, 10),
      req.utilizador.id,
    );
    if (resultado === "cancelado")
      return res.status(200).json({ mensagem: "Pedido cancelado." });
    return res
      .status(409)
      .json({ mensagem: "Só é possível cancelar pedidos no estado Pendente." });
  } catch (error) {
    next(error);
  }
}

// RF07. Coordenação consulta pedidos pendentes.
async function getPedidosPendentes(req, res, next) {
  try {
    const pedidos = await coachingModel.getPedidosPendentes();
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

async function getPedidosAtribuidosProfessor(req, res, next) {
  try {
    const pedidos =
      await coachingModel.getPedidosAtribuidosAoProfessorNoPeriodo(
        req.utilizador.id,
        req.query.dataInicio,
        req.query.dataFim,
      );
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

// RF09, RF10. Coordenação aprova, valida conflitos e cria aula.
async function aprovarPedido(req, res, next) {
  try {
    const idValidador = req.utilizador.id;
    const idPedido = parseInt(req.params.id, 10);
    const { idSala, idProfessor, valorFinal } = req.body;

    const pedido = await coachingModel.getPedidoCoachingPorId(idPedido);
    if (!pedido || pedido.estado !== "Pendente")
      return res
        .status(409)
        .json({ mensagem: "Pedido não pendente ou não encontrado." });

    let horaInicio = null;
    if (pedido.hora_inicio_pretendida) {
      if (pedido.hora_inicio_pretendida instanceof Date) {
        // Lê a hora explicitamente em UTC para evitar que o fuso horário (WEST) some +1 hora
        const hh = String(pedido.hora_inicio_pretendida.getUTCHours()).padStart(
          2,
          "0",
        );
        const mm = String(
          pedido.hora_inicio_pretendida.getUTCMinutes(),
        ).padStart(2, "0");
        horaInicio = `${hh}:${mm}:00`;
      } else {
        const mHora = String(pedido.hora_inicio_pretendida).match(
          /(\d{2}):(\d{2})/,
        );
        horaInicio = mHora ? `${mHora[1]}:${mHora[2]}:00` : null;
      }
    }
    const diaSemanaCoaching = diaSemanaCoachingFromDateValue(
      pedido.data_aula_pretendida,
    );

    const temDisponibilidade =
      await coachingModel.professorTemDisponibilidadeNoSlot({
        idProfessor: parseInt(idProfessor, 10),
        dataAula: pedido.data_aula_pretendida,
        horaInicio,
        duracaoMinutos: Number(pedido.duracao_minutos),
        diaSemanaCoaching,
      });
    if (!temDisponibilidade)
      return res.status(409).json({ mensagem: MSG_SEM_DISPONIBILIDADE });

    const idCoaching = await coachingModel.aprovarEAgendarCoaching({
      idPedido,
      formatoAula: pedido.formato_aula,
      duracaoMinutos: Number(pedido.duracao_minutos),
      numeroParticipantes: Number(pedido.numero_participantes),
      dataAula: pedido.data_aula_pretendida,
      horaInicio,
      diaSemanaCoaching,
      idProfessor: parseInt(idProfessor, 10),
      idAnoLetivo: parseInt(pedido.ANO_LETIVOid_ano_letivo, 10),
      idModalidade: parseInt(pedido.MODALIDADEid_modalidade, 10),
      idSala: parseInt(idSala, 10),
      valorFinal: Number(String(valorFinal).replace(",", ".")),
      idValidador,
    });
    return res.status(201).json({ mensagem: "Coaching agendado.", idCoaching });
  } catch (error) {
    if (
      error.message.includes("Conflito") ||
      error.message.includes("Compatibilidade")
    )
      return res.status(409).json({ mensagem: error.message });
    next(error);
  }
}

// RF08. Rejeitar pedidos de coaching com justificação.
async function rejeitarPedido(req, res, next) {
  try {
    if (!req.body.justificacao)
      return res
        .status(400)
        .json({ mensagem: "A justificação é obrigatória." });
    await coachingModel.rejeitarPedidoCoaching(parseInt(req.params.id, 10));
    return res.status(200).json({ mensagem: "Pedido rejeitado." });
  } catch (error) {
    next(error);
  }
}

// RF14. Cancelar marcações.
async function cancelarCoaching(req, res, next) {
  try {
    const idCoaching = parseInt(req.params.id, 10);
    const cab =
      await coachingModel.getCoachingCabecalhoCancelamento(idCoaching);
    if (!cab || cab.estado === "Cancelado")
      return res
        .status(400)
        .json({ mensagem: "Coaching inválido ou já cancelado." });

    if (
      utilizadorTemPerfil(req.utilizador.perfis || [], "EE") &&
      !utilizadorTemPerfil(req.utilizador.perfis || [], "Admin")
    ) {
      const inicioAula = instanteInicioCoaching(cab);
      if (inicioAula.getTime() <= Date.now())
        return res
          .status(400)
          .json({ mensagem: "Não pode cancelar aula após a hora." });
    }
    await coachingModel.cancelarCoaching(idCoaching);
    return res.status(200).json({ mensagem: "Coaching cancelado." });
  } catch (error) {
    next(error);
  }
}

// RF15. Confirmar a realização da aula.
async function registarValidacao(req, res, next) {
  try {
    const idCoaching = parseInt(req.params.id, 10);

    const tipoValidador = utilizadorTemPerfil(
      req.utilizador.perfis || [],
      "Professor",
    )
      ? "Professor"
      : "EncarregadoEducacao";
    await coachingModel.registarValidacaoAula(
      idCoaching,
      req.utilizador.id,
      tipoValidador,
      req.body.estadoValidacao,
      req.body.observacoes || null,
    );
    return res.status(201).json({ mensagem: "Validação registada." });
  } catch (error) {
    next(error);
  }
}

async function getPendentesConclusaoCoordenacao(req, res, next) {
  try {
    const lista = await coachingModel.listarCoachingsAbertosParaCoordenacao();
    const agora = Date.now();
    const filtrada = lista.filter(
      (row) => instanteFimCoaching(row)?.getTime() <= agora,
    );
    return res.status(200).json(filtrada);
  } catch (error) {
    next(error);
  }
}

async function listarHistorico(req, res, next) {
  try {
    const lista = await coachingModel.getHistoricoGeralCoachings();
    return res.status(200).json(lista);
  } catch (error) {
    next(error);
  }
}

// RF16. Coordenação valida a conclusão.
async function concluirCoaching(req, res, next) {
  try {
    await coachingModel.concluirCoachingPelaCoordenacao(
      parseInt(req.params.id, 10),
      req.utilizador.id,
      req.body.estadoFinal,
      req.body.observacoes || null,
    );
    return res
      .status(200)
      .json({ mensagem: `Marcado como ${req.body.estadoFinal}.` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  adicionarDisponibilidade,
  getPrecoEstimado,
  getSlotLivre,
  getDisponibilidades,
  removerDisponibilidade,
  getVagasDisponiveis,
  getProfessoresDisponiveisAprovacao,
  getAgenda,
  criarPedidoCoaching,
  getPedidoCoaching,
  listarMeusPedidosCoaching,
  cancelarMeuPedidoPendente,
  getPedidosPendentes,
  getPedidosAtribuidosProfessor,
  aprovarPedido,
  rejeitarPedido,
  cancelarCoaching,
  registarValidacao,
  getPendentesConclusaoCoordenacao,
  concluirCoaching,
  listarHistorico,
};
