/**
 * @fileoverview Controlador de Gestão de Coaching.
 * @description Implementa as User Stories RF04 a RF16 (Disponibilidades, Aprovação de Coordenação,
 * Submissão de Pedidos EE, Cálculo de Preços, Validações de conflitos).
 */

const coachingModel = require("../models/coachingModel");
const precoCoachingModel = require("../models/precoCoachingModel");
const { utilizadorTemPerfil } = require("../middlewares/auth");
const { registarAuditoria } = require("../helpers/auditoriaHelper");

const DATA_REF_COMPARACAO_HORAS = "2026-01-01";
const MSG_SEM_DISPONIBILIDADE =
  "O professor não tem horário disponível nesse período.";
const FORMATOS_AULA_VALIDOS = ["Solo", "Dueto", "Trio", "Ensemble"];
const DURACOES_AULA_VALIDAS = [30, 60, 90, 120];
const ESTADOS_VALIDACAO_VALIDOS = ["Confirmado", "Nao_Realizado"];
const ESTADOS_FINAIS_VALIDOS = ["Realizado", "Nao_Realizado"];

/**
 * @function normalizarHoraSqlTime
 * @description Normaliza uma string ou data para o formato de hora SQL (HH:MM:SS).
 * @param {Date|string} valor - O valor da hora a normalizar.
 * @returns {string|null} A hora formatada ou null se for inválida.
 */
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

/**
 * @function validarFormatoAula
 * @description Valida se o formato da aula está entre os permitidos.
 * @param {string} formatoAula - O formato da aula.
 * @returns {string|null} Mensagem de erro ou null se for válido.
 */
function validarFormatoAula(formatoAula) {
  return FORMATOS_AULA_VALIDOS.includes(formatoAula)
    ? null
    : `Formato inválido. Valores aceites: ${FORMATOS_AULA_VALIDOS.join(", ")}.`;
}

/**
 * @function validarDuracaoAula
 * @description Valida se a duração da aula está entre as permitidas.
 * @param {number|string} duracaoMinutos - A duração em minutos.
 * @returns {string|null} Mensagem de erro ou null se for válida.
 */
function validarDuracaoAula(duracaoMinutos) {
  return DURACOES_AULA_VALIDAS.includes(Number(duracaoMinutos))
    ? null
    : `Duração inválida. Valores aceites: ${DURACOES_AULA_VALIDAS.join(", ")} minutos.`;
}

/**
 * @function parseDateParts
 * @description Extrai a data ignorando potenciais problemas de fuso horário.
 * @param {Date|string} dataValor - A data a extrair.
 * @returns {Date|null} O objeto Date gerado ou null se for inválido.
 */
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

/**
 * @function diaSemanaPrecoFromDateValue
 * @description Determina o tipo de dia da semana para cálculo de preço (1 para dia útil, 2 para fim-de-semana).
 * @param {Date|string} dataValor - A data a avaliar.
 * @returns {number} 1 ou 2.
 */
function diaSemanaPrecoFromDateValue(dataValor) {
  const dt = parseDateParts(dataValor);
  if (!dt) return 1;
  const day = dt.getDay();
  return [0, 6].includes(day) ? 2 : 1;
}

/**
 * @function diaSemanaCoachingFromDateValue
 * @description Converte o dia da semana padrão do JS (0-6) para o modelo de BD (1-7 onde 7 é Domingo).
 * @param {Date|string} dataValor - A data a converter.
 * @returns {number} O dia da semana de 1 a 7.
 */
function diaSemanaCoachingFromDateValue(dataValor) {
  const dt = parseDateParts(dataValor);
  if (!dt) return 1;
  const day = dt.getDay();
  return day === 0 ? 7 : day;
}

/**
 * @function instanteInicioCoaching
 * @description Cria um objeto Date combinado com a data e a hora de início.
 * @param {Object} cab - Objeto com os detalhes do coaching.
 * @param {Date|string} cab.data_aula - A data da aula.
 * @param {Date|string} cab.hora_inicio - A hora de início.
 * @returns {Date|null} O Date exato de início.
 */
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

/**
 * @function instanteFimCoaching
 * @description Calcula a hora final de uma aula com base na hora de início e duração.
 * @param {Object} cab - Objeto do coaching (com data, hora_inicio e duracao_minutos).
 * @returns {Date|null} O Date exato de fim.
 */
function instanteFimCoaching(cab) {
  const inicio = instanteInicioCoaching(cab);
  if (!inicio) return null;
  const dur = Number(cab.duracao_minutos);
  const minutos = Number.isFinite(dur) && dur > 0 ? dur : 60;
  return new Date(inicio.getTime() + minutos * 60000);
}

/**
 * @function duracaoSlotMinutos
 * @description Calcula a duração em minutos entre duas horas (strings).
 * @param {string} horaInicio - A hora inicial.
 * @param {string} horaFim - A hora final.
 * @returns {number} Duração do slot em minutos.
 */
function duracaoSlotMinutos(horaInicio, horaFim) {
  const t0 = new Date(`${DATA_REF_COMPARACAO_HORAS}T${horaInicio}`).getTime();
  const t1 = new Date(`${DATA_REF_COMPARACAO_HORAS}T${horaFim}`).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;
  return Math.round((t1 - t0) / 60000);
}

/**
 * @function instanteHoraReferencia
 * @description Obtém um timestamp (milissegundos) para uma hora específica, usando uma data base.
 * @param {string} horaValor - A hora a converter.
 * @returns {number|null} Timestamp ou null em caso de erro.
 */
function instanteHoraReferencia(horaValor) {
  const horaNorm = normalizarHoraSqlTime(horaValor);
  if (!horaNorm) return null;
  const t = new Date(`${DATA_REF_COMPARACAO_HORAS}T${horaNorm}`).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * @async
 * @function adicionarDisponibilidade
 * @description  Adiciona uma disponibilidade de horário para o professor autenticado.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Confirmação de registo ou erro de conflito.
 */
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

/**
 * @async
 * @function getDisponibilidades
 * @description Obtém a lista de todas as disponibilidades do professor atual.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Lista de disponibilidades.
 */
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

/**
 * @async
 * @function removerDisponibilidade
 * @description Remove um registo de disponibilidade do professor atual pelo seu ID.
 * @param {import('express').Request} req - O pedido Express (com id nos parâmetros).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Confirmação de remoção.
 */
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

/**
 * @async
 * @function getPrecoEstimado
 * @description Calcula o custo estimado de uma aula de coaching em função de formato, dia, duração, etc.
 * @param {import('express').Request} req - O pedido Express (query string).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response>} O preço estimado e detalhes de cálculo.
 */
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

    if (custoEstimado == null) {
      const precoBaseHora = 35.0;
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

/**
 * @async
 * @function getSlotLivre
 * @description Verifica se um professor tem slot livre na sua agenda no instante solicitado.
 * @param {import('express').Request} req - O pedido Express (query params).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response>} Objeto indicando se está livre.
 */
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

/**
 * @async
 * @function getVagasDisponiveis
 * @description  Retorna as vagas disponíveis cruzando disponibilidades gerais de professores com ocupações.
 * @param {import('express').Request} req - O pedido Express (query parameters).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Lista de slots de horários vagos.
 */
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

/**
 * @async
 * @function getProfessoresDisponiveisAprovacao
 * @description Filtra que professores com a modalidade requerida têm disponibilidade para a janela de tempo pedida (Coordenação).
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Array de professores livres.
 */
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

/**
 * @async
 * @function getAgenda
 * @description Obtém a agenda de coachings marcados para o professor logado num intervalo de tempo.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} A lista de coachings (agenda).
 */
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

/**
 * @async
 * @function criarPedidoCoaching
 * @description (RF05/RF06) Permite a um EE submeter um pedido de coaching com registo de custo estimado.
 * @param {import('express').Request} req - O pedido Express (body com alunosIds, idModalidade, etc.).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Resultado da criação (ID do pedido submetido).
 */
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

    if (custoEstimado == null) {
      const precoBaseHora = 35.0;
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

    registarAuditoria(req, {
      tipo: "COACHING_PEDIR",
      descricao: `Pedido de coaching #${idPedido} — ${formatoAula} (${duracaoMinutos}min) em ${dataAula} ${horaInicio}`,
      entidadeTipo: "PEDIDO_COACHING",
      entidadeId: idPedido,
      dadosExtra: {
        formatoAula,
        duracaoMinutos,
        dataAula,
        horaInicio,
        custoEstimado,
      },
    });

    return res.status(201).json({
      mensagem: "Pedido submetido com sucesso.",
      idPedido,
      custoEstimado,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function getPedidoCoaching
 * @description Consulta um pedido de coaching pelo seu ID.
 * @param {import('express').Request} req - O pedido Express (id params).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Os detalhes do pedido.
 */
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

/**
 * @async
 * @function listarMeusPedidosCoaching
 * @description Lista os pedidos de coaching realizados pelo Encarregado de Educação autenticado.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Array com os pedidos do EE.
 */
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

/**
 * @async
 * @function cancelarMeuPedidoPendente
 * @description Cancela um pedido de coaching efetuado pelo EE, caso ainda se encontre "Pendente".
 * @param {import('express').Request} req - O pedido Express (id params).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Mensagem de sucesso ou erro (se já não estiver Pendente).
 */
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

/**
 * @async
 * @function getPedidosPendentes
 * @description (RF07) Coordenação acede à listagem de pedidos que aguardam aprovação.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Array de pedidos Pendentes.
 */
async function getPedidosPendentes(req, res, next) {
  try {
    const pedidos = await coachingModel.getPedidosPendentes();
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function getPedidosAtribuidosProfessor
 * @description Lista os pedidos ou aulas atribuídos ao professor logado.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Array de pedidos.
 */
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

/**
 * @async
 * @function aprovarPedido
 * @description (RF09/RF10) Coordenação aprova o pedido, valida disponibilidade e agenda o coaching na BD, lançando faturação se aplicável.
 * @param {import('express').Request} req - O pedido Express (body com idSala, idProfessor, valorFinal).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Mensagem de sucesso (e idCoaching) ou mensagem de conflito.
 */
async function aprovarPedido(req, res, next) {
  try {
    const idValidador = req.utilizador.id;
    const idPedido = parseInt(req.params.id, 10);
    const { idSala, idProfessor, valorFinal } = req.body;

    const pedido = await coachingModel.getPedidoCoachingPorId(idPedido);
    const estadosAprovaveis = ["Pendente", "Pendente Coordenação"];
    if (!pedido || !estadosAprovaveis.includes(pedido.estado))
      return res
        .status(409)
        .json({
          mensagem: "Pedido não está pronto para aprovação ou não encontrado.",
        });

    let horaInicio = null;
    if (pedido.hora_inicio_pretendida) {
      if (pedido.hora_inicio_pretendida instanceof Date) {
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
    try {
      const faturacaoModel = require("../models/faturacaoModel");
      const idEE =
        pedido.id_encarregado ||
        pedido.UTILIZADORid_utilizador ||
        pedido.id_utilizador;
      const idAno = pedido.ANO_LETIVOid_ano_letivo || 1;
      if (idEE) {
        await faturacaoModel.adicionarLinhaFaturaMensal(
          idEE,
          Number(String(valorFinal).replace(",", ".")),
          `Coaching ${pedido.modalidade}`,
          pedido.data_aula_pretendida,
          idAno,
        );
      }
    } catch (errFatura) {
      console.error("Erro ao gerar fatura pendente:", errFatura);
    }

    registarAuditoria(req, {
      tipo: "COACHING_APROVAR",
      descricao: `Pedido #${idPedido} aprovado e agendado (coaching #${idCoaching})`,
      entidadeTipo: "COACHING",
      entidadeId: idCoaching,
      dadosExtra: {
        idPedido,
        idProfessor: parseInt(idProfessor, 10),
        idSala: parseInt(idSala, 10),
        valorFinal: Number(String(valorFinal).replace(",", ".")),
      },
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

/**
 * @async
 * @function rejeitarPedido
 * @description (RF08) Coordenação ou Professor rejeita um pedido de coaching com justificação.
 * @param {import('express').Request} req - O pedido Express (body com justificacao).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Confirmação de rejeição.
 */
async function rejeitarPedido(req, res, next) {
  try {
    if (!req.body.justificacao)
      return res
        .status(400)
        .json({ mensagem: "A justificação é obrigatória." });
    const idPedido = parseInt(req.params.id, 10);
    await coachingModel.rejeitarPedidoCoaching(idPedido);

    registarAuditoria(req, {
      tipo: "COACHING_REJEITAR",
      descricao: `Pedido #${idPedido} rejeitado: ${req.body.justificacao}`,
      entidadeTipo: "PEDIDO_COACHING",
      entidadeId: idPedido,
      dadosExtra: { justificacao: req.body.justificacao },
    });

    return res.status(200).json({ mensagem: "Pedido rejeitado." });
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function cancelarCoaching
 * @description (RF14) Cancela uma marcação de coaching, aplicando regras de bloqueio para EE após a hora.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Confirmação do cancelamento.
 */
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

    registarAuditoria(req, {
      tipo: "COACHING_CANCELAR",
      descricao: `Coaching #${idCoaching} cancelado`,
      entidadeTipo: "COACHING",
      entidadeId: idCoaching,
    });

    return res.status(200).json({ mensagem: "Coaching cancelado." });
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function registarValidacao
 * @description (RF15/RF20) Professor ou EE validam se a aula ocorreu ou não. Liquida fatura se indicado.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Resposta de sucesso.
 */
async function registarValidacao(req, res, next) {
  try {
    const idCoaching = parseInt(req.params.id, 10);
    const { estadoValidacao, observacoes, metodoPagamento } = req.body;

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
      estadoValidacao,
      observacoes || null,
    );
    if (
      estadoValidacao === "Confirmado" &&
      tipoValidador === "Professor" &&
      metodoPagamento &&
      String(metodoPagamento).trim() !== ""
    ) {
      try {
        const pool = await require("../config/db").poolPromise;
        const sql = require("mssql");
        const cabResult = await pool
          .request()
          .input("IdCoaching", sql.Int, idCoaching).query(`
            SELECT
              c.data_aula,
              c.ANO_LETIVOid_ano_letivo AS id_ano_letivo,
              pc.UTILIZADORid_utilizador AS id_ee
            FROM COACHING c
            INNER JOIN PEDIDO_COACHING pc
              ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
            WHERE c.id_coaching = @IdCoaching;
          `);

        if (cabResult.recordset.length > 0) {
          const row = cabResult.recordset[0];
          const dataAula = new Date(row.data_aula);
          const idEE = row.id_ee;
          const idAnoLetivo = row.id_ano_letivo || 1;

          if (idEE && !Number.isNaN(dataAula.getTime())) {
            const faturaResult = await pool
              .request()
              .input("UserId", sql.Int, idEE)
              .input("Ano", sql.Int, dataAula.getFullYear())
              .input("Mes", sql.Int, dataAula.getMonth() + 1)
              .input("IdAnoLetivo", sql.Int, idAnoLetivo).query(`
                SELECT TOP 1 id_faturacao
                FROM FATURACAO_MENSAL
                WHERE UTILIZADORid_utilizador = @UserId
                  AND ano = @Ano
                  AND mes = @Mes
                  AND ANO_LETIVOid_ano_letivo = @IdAnoLetivo
                  AND estado_pagamento = 'Pendente'
                ORDER BY id_faturacao DESC;
              `);

            if (faturaResult.recordset.length > 0) {
              const idFatura = faturaResult.recordset[0].id_faturacao;
              const faturacaoModel = require("../models/faturacaoModel");
              await faturacaoModel.registarPagamento(
                idFatura,
                String(metodoPagamento).trim(),
              );
              console.log(
                `Fatura #${idFatura} marcada como Paga (${metodoPagamento}) — coaching #${idCoaching}.`,
              );
            } else {
              console.warn(
                `Sem fatura pendente para EE=${idEE} em ${dataAula.getMonth() + 1}/${dataAula.getFullYear()} (coaching #${idCoaching}).`,
              );
            }
          }
        }
      } catch (errFatura) {
        console.error(
          "Erro ao registar pagamento automático da aula",
          errFatura,
        );
      }
    }

    registarAuditoria(req, {
      tipo: "COACHING_VALIDAR",
      descricao: `Coaching #${idCoaching} validado por ${tipoValidador} — estado: ${estadoValidacao}${metodoPagamento ? `, método: ${metodoPagamento}` : ""}`,
      entidadeTipo: "COACHING",
      entidadeId: idCoaching,
      dadosExtra: {
        estadoValidacao,
        tipoValidador,
        metodoPagamento: metodoPagamento || null,
        observacoes: observacoes || null,
      },
    });

    return res.status(201).json({ mensagem: "Validação registada." });
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function getPendentesConclusaoCoordenacao
 * @description Obtém a lista de coachings cuja hora final já passou, que exigem conclusão da Coordenação.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Array de coachings aguardando fechamento.
 */
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

/**
 * @async
 * @function listarHistorico
 * @description Obtém o histórico geral de coachings finalizados para listagens administrativas.
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Array do histórico.
 */
async function listarHistorico(req, res, next) {
  try {
    const lista = await coachingModel.getHistoricoGeralCoachings();
    return res.status(200).json(lista);
  } catch (error) {
    next(error);
  }
}

/**
 * @async
 * @function concluirCoaching
 * @description (RF16) Coordenação valida o estado final e tranca o coaching (Realizado/Não_Realizado).
 * @param {import('express').Request} req - O pedido Express (com estadoFinal no body).
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Confirmação de conclusão.
 */
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

/**
 * @async
 * @function agendarDiretoAdmin
 * @description Permite a um Administrador ou Coordenação forçar o agendamento de um coaching direto na agenda (mesmo sem pedido prévio EE).
 * @param {import('express').Request} req - O pedido Express.
 * @param {import('express').Response} res - A resposta Express.
 * @param {import('express').NextFunction} next - Função de propagação de erro.
 * @returns {Promise<import('express').Response|void>} Mensagem de sucesso ou conflito.
 */
async function agendarDiretoAdmin(req, res, next) {
  try {
    const idValidador = req.utilizador.id;
    const {
      idEncarregado,
      idModalidade,
      idProfessor,
      idSala,
      dataAula,
      horaInicio,
      duracaoMinutos,
      formatoAula,
      valorFinal,
      idAnoLetivo,
    } = req.body;

    const pool = await require("../config/db").poolPromise;

    let idAluno = null;
    try {
      const alunoRes = await pool
        .request()
        .input("IdEE", require("mssql").Int, Number(idEncarregado)).query(`
          SELECT TOP 1 ALUNOid_aluno AS id_aluno 
          FROM ENCARREGADO_ALUNO 
          WHERE UTILIZADORid_utilizador = @IdEE;
        `);

      if (alunoRes && alunoRes.recordset && alunoRes.recordset.length > 0) {
        idAluno = alunoRes.recordset[0].id_aluno;
      }
    } catch (errAluno) {
      console.log("Aviso: Erro ao buscar aluno associado:", errAluno.message);
    }

    const coachingModel = require("../models/coachingModel");
    const idPedido = await coachingModel.criarPedidoCoaching(
      {
        formatoAula,
        duracaoMinutos: Number(duracaoMinutos),
        dataAula,
        horaInicio,
        custoEstimado: Number(valorFinal),
        idEncarregado: Number(idEncarregado),
        idAnoLetivo: Number(idAnoLetivo),
        idModalidade: Number(idModalidade),
        idProfessor: Number(idProfessor),
      },
      idAluno ? [idAluno] : [],
      { skipAlunoValidation: true },
    );

    function diaSemanaCoachingFromDateValue(dataValor) {
      const dt = new Date(dataValor);
      const day = dt.getDay();
      return day === 0 ? 7 : day;
    }

    const idCoaching = await coachingModel.aprovarEAgendarCoaching({
      idPedido,
      formatoAula,
      duracaoMinutos: Number(duracaoMinutos),
      numeroParticipantes: idAluno ? 1 : 0,
      dataAula,
      horaInicio: `${horaInicio}:00`,
      diaSemanaCoaching: diaSemanaCoachingFromDateValue(dataAula),
      idProfessor: Number(idProfessor),
      idAnoLetivo: Number(idAnoLetivo),
      idModalidade: Number(idModalidade),
      idSala: Number(idSala),
      valorFinal: Number(valorFinal),
      idValidador,
    });

    try {
      const faturacaoModel = require("../models/faturacaoModel");
      if (idEncarregado) {
        await faturacaoModel.adicionarLinhaFaturaMensal(
          Number(idEncarregado),
          Number(valorFinal),
          "Coaching Agendado (Direto)",
          dataAula,
          Number(idAnoLetivo),
        );
      }
    } catch (errFatura) {
      console.error("Erro ao gerar fatura pendente:", errFatura);
    }

    return res
      .status(201)
      .json({ mensagem: "Agendamento forçado com sucesso.", idCoaching });
  } catch (error) {
    if (error.message && error.message.includes("Conflito")) {
      return res.status(409).json({ mensagem: error.message });
    }
    next(error);
  }
}

async function procurarAlunoPorEmailEE(req, res, next) {
  try {
    const { email } = req.query;

    if (!email) {
      return res
        .status(400)
        .json({ mensagem: "O email é obrigatório para a pesquisa." });
    }

    const alunos = await coachingModel.getAlunoPorEmailEE(email);

    if (alunos.length === 0) {
      return res
        .status(404)
        .json({ mensagem: "Nenhum aluno encontrado para este email." });
    }

    return res.status(200).json(alunos);
  } catch (error) {
    next(error);
  }
}

async function listarPedidosParaProfessor(req, res, next) {
  try {
    const idUtilizador = req.utilizador?.id || req.utilizador?.id_utilizador;
    const pedidos =
      await coachingModel.getPedidosPendentesProfessor(idUtilizador);
    return res.status(200).json(pedidos);
  } catch (error) {
    next(error);
  }
}

async function responderPedidoProfessor(req, res, next) {
  try {
    const idUtilizador = req.utilizador?.id || req.utilizador?.id_utilizador;
    const idPedido = req.params.id;
    const { aceitar } = req.body; // true = aceita, false = rejeita

    const novoEstado = await coachingModel.responderPedidoProfessor(
      idPedido,
      idUtilizador,
      aceitar,
    );
    return res.status(200).json({
      mensagem: `Pedido marcado como ${novoEstado}`,
      estado: novoEstado,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @module coachingController
 */
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
  agendarDiretoAdmin,
  procurarAlunoPorEmailEE,
  listarPedidosParaProfessor,
  responderPedidoProfessor,
};
