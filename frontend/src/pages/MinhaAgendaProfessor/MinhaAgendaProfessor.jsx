import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, MapPin, Phone, Mail } from "lucide-react";
import { createPortal } from "react-dom";
import "./MinhaAgendaProfessor.css";
import logoImg from "../../assets/logo.png";
import { apiAuthFetch } from "../../services/api";

/* ─── Constantes de domínio ─────────────────────────────────────────────── */

/** Formatos de aula disponíveis para pedidos de coaching */
const FORMATOS_AULA = ["Solo", "Dueto", "Trio", "Ensemble"];

/** Durações de aula disponíveis em minutos */
const DURACOES_AULA = [30, 60, 90, 120];

/** Nomes dos meses em português para o filtro do resumo financeiro */
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Anos letivos disponíveis para seleção */
const ANOS = [2025, 2026, 2027, 2028];

/* ─── Funções utilitárias ────────────────────────────────────────────────── */

/**
 * Traduz mensagens de erro da API de coaching para português legível.
 * @param {Error|object} err - Objeto de erro
 * @param {string} fallback  - Mensagem de fallback
 * @returns {string} Mensagem traduzida
 */
function traduzErroCoaching(err, fallback) {
  const msg = String(err?.message || "").trim();
  if (!msg) return fallback;
  const low = msg.toLowerCase();
  if (
    low.includes("fora da disponibilidade") ||
    low.includes("não tem disponibilidade") ||
    low.includes("nao tem disponibilidade")
  ) {
    return "O professor não tem horário disponível nesse período.";
  }
  if (low.includes("ocorreu um erro interno") || low.includes("erro interno")) {
    return "Não foi possível concluir. Verifica se o professor tem disponibilidade nesse horário.";
  }
  return msg;
}

/**
 * Formata uma string de hora para "HH:MM", removendo os segundos.
 * @param {string|number} valor - Hora no formato "HH:MM:SS" ou similar
 * @returns {string}
 */
function formatHoraCurta(valor) {
  const s = String(valor || "").trim();
  if (!s) return "";
  const m = s.match(/(\d{2}):(\d{2})(?::\d{2})?/);
  if (m) return `${m[1]}:${m[2]}`;
  return "";
}

/**
 * Adiciona N dias a uma data.
 * @param {Date} date - Data base
 * @param {number} days - Número de dias a adicionar
 * @returns {Date}
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Retorna a segunda-feira da semana à qual pertence a data fornecida.
 * @param {Date} date
 * @returns {Date}
 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Formata uma data no formato "YYYY-MM-DD".
 * @param {Date} date
 * @returns {string}
 */
function formatYMD(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converte um valor (Date, string ISO, etc.) num objeto Date sem componente
 * de hora, para comparações de dia corretas.
 * @param {*} valor
 * @returns {Date|null}
 */
function parseDataCalendario(valor) {
  if (valor == null) return null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  const s = String(valor).split("T")[0];
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (y && mo && d) return new Date(y, mo - 1, d);
  }
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Retorna a abreviatura do dia da semana (ex: "Seg") para a data fornecida.
 * @param {*} dataAula - Data da aula
 * @returns {string|null}
 */
function diaSemanaAbrevData(dataAula) {
  const d = parseDataCalendario(dataAula);
  if (!d) return null;
  const js = d.getDay();
  const map = {
    1: "Seg",
    2: "Ter",
    3: "Qua",
    4: "Qui",
    5: "Sex",
    6: "Sáb",
    0: "Dom",
  };
  return map[js] || null;
}

/**
 * Converte um número de dia da semana (1–7) na sua abreviatura.
 * @param {number|string} diaSemana
 * @returns {string}
 */
function abrevDiaSemana(diaSemana) {
  const map = {
    1: "Seg",
    2: "Ter",
    3: "Qua",
    4: "Qui",
    5: "Sex",
    6: "Sáb",
    7: "Dom",
  };
  return map[Number(diaSemana)];
}

/**
 * Determina o estado visual (label + tom de cor) de um pedido de coaching.
 * @param {object} p - Objeto do pedido
 * @returns {{ label: string, tone: string }}
 */
function estadoPedidoVisual(p) {
  const estado = p?.estado || "";
  const estadoCoaching = p?.estado_coaching || null;

  if (estado === "Aprovado") {
    if (estadoCoaching === "Cancelado")
      return { label: "Cancelado", tone: "rejeitado" };
    return { label: estadoCoaching || "Agendado", tone: "aprovado" };
  }
  if (estado === "Cancelado") return { label: "Cancelado", tone: "rejeitado" };
  if (estado === "Rejeitado" || estado === "Rejeitado Coordenação")
    return { label: "Rejeitado pela Coordenação", tone: "rejeitado" };
  if (estado === "Rejeitado Professor")
    return { label: "Rejeitado pelo Professor", tone: "rejeitado" };
  if (estado === "Pendente Professor" || estado === "Pendente")
    return { label: "Aguarda Professor", tone: "pendente" };
  if (estado === "Pendente Coordenação")
    return { label: "Aguarda Coordenação", tone: "pendente" };
  return { label: estado || "—", tone: "pendente" };
}

/**
 * Converte uma hora de início no slot de hora inteira correspondente.
 * Exemplo: "14:35" → "14:00"
 * @param {string} horaInicio
 * @returns {string|null}
 */
function horaParaSlot(horaInicio) {
  const hhmm = formatHoraCurta(horaInicio);
  if (!hhmm) return null;
  const hh = hhmm.slice(0, 2);
  return `${hh}:00`;
}

/**
 * Converte uma string "HH:MM:SS" em minutos totais desde meia-noite.
 * @param {string} hhmmss
 * @returns {number|null}
 */
function parseTimeToMinutes(hhmmss) {
  const hhmm = formatHoraCurta(hhmmss);
  if (!hhmm) return null;
  const hh = parseInt(hhmm.slice(0, 2), 10);
  const mm = parseInt(hhmm.slice(3, 5), 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

/**
 * Converte minutos totais em string "HH:MM".
 * @param {number} mins
 * @returns {string}
 */
function minutesToHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Formata um intervalo de tempo "HH:MM - HH:MM" a partir da hora de início
 * e da duração em minutos.
 * @param {string} horaInicio
 * @param {number} duracaoMinutos
 * @returns {string}
 */
function formatIntervalo(horaInicio, duracaoMinutos) {
  const start = parseTimeToMinutes(horaInicio);
  const dur = Number(duracaoMinutos || 0);
  if (start == null || !Number.isFinite(dur)) return String(horaInicio || "");
  return `${minutesToHHMM(start)} - ${minutesToHHMM(start + dur)}`;
}

/**
 * Verifica se uma sessão de coaching já terminou com base na data, hora
 * de início e duração.
 * @param {*} dataAula
 * @param {string} horaInicio
 * @param {number} duracaoMinutos
 * @returns {boolean}
 */
function coachingJaTerminou(dataAula, horaInicio, duracaoMinutos) {
  const dia = parseDataCalendario(dataAula);
  if (!dia) return false;
  const mins = parseTimeToMinutes(horaInicio);
  if (mins == null) return false;
  const h = Math.floor(mins / 60);
  const mm = mins % 60;
  const inicio = new Date(
    dia.getFullYear(),
    dia.getMonth(),
    dia.getDate(),
    h,
    mm,
    0,
    0,
  );
  const dur = Number(duracaoMinutos || 0);
  const fim = new Date(inicio.getTime() + dur * 60000);
  return fim.getTime() <= Date.now();
}

/**
 * Converte o nome de uma modalidade numa classe CSS correspondente.
 * @param {string} modalidade
 * @returns {string}
 */
function modalidadeParaClasse(modalidade) {
  const s = String(modalidade || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("ballet")) return "ballet";
  if (s.includes("jazz")) return "jazz";
  if (s.includes("acrobat")) return "acrobatica";
  if (s.includes("acrodance")) return "acrodance";
  if (s.includes("hip")) return "hiphop";
  if (s.includes("contempor")) return "contemporaneo";
  return "ballet";
}

/**
 * Formata uma data no formato "DD/MM".
 * @param {Date|string} date
 * @returns {string}
 */
function formatDM(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Normaliza uma hora "HH:MM" para o formato "HH:MM:00" esperado pela API.
 * @param {string} hhmm
 * @returns {string}
 */
function normalizeTime(hhmm) {
  const hora = formatHoraCurta(hhmm);
  if (!hora) return String(hhmm || "").trim();
  return `${hora}:00`;
}

/* ─── Componente principal ──────────────────────────────────────────────── */

/**
 * Componente de agenda de coaching — serve tanto o professor como o
 * encarregado de educação (EE), controlado pela prop `modo`.
 *
 * Responsabilidades:
 * - Exibir a grelha semanal de slots com disponibilidades e aulas agendadas
 * - Permitir ao professor gerir as suas disponibilidades
 * - Permitir ao EE pedir e acompanhar sessões de coaching
 * - Mostrar painel de gestão (pedidos, validações, resumo financeiro)
 *
 * @param {Function} irParaLanding                - Navega para a landing page
 * @param {Function} irParaEmprestimos            - Navega para empréstimos
 * @param {Function} irParaFigurinos              - Navega para o marketplace
 * @param {Function} irParaMinhaAgendaProfessor   - Navega para agenda do professor
 * @param {Function} irParaMinhaAgendaEE          - Navega para agenda do EE
 * @param {"professor"|"ee"} modo                 - Perfil ativo do utilizador
 */
export default function MinhaAgendaProfessor({
  irParaLanding,
  irParaEmprestimos,
  irParaFigurinos,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
  irParaAgenda,
  modo = "professor",
}) {
  /* ─── Estado: dados do utilizador e agenda ─────────────────────────────── */
  const [agenda, setAgenda] = useState([]);
  const [pedidosPendentesProf, setPedidosPendentesProf] = useState([]);
  const [utilizador, setUtilizador] = useState(null);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [erroAgenda, setErroAgenda] = useState("");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  /** Controla a visibilidade do menu hamburger em mobile */
  const [menuInternoAberto, setMenuInternoAberto] = useState(false);

  /* ─── Estado: modais e painéis ──────────────────────────────────────────── */
  /** Controla a visibilidade do painel de gestão do professor */
  const [isProfMenuOpen, setIsProfMenuOpen] = useState(false);

  /* ─── Estado: disponibilidades do professor ────────────────────────────── */
  const [disponibilidades, setDisponibilidades] = useState([]);
  const [isLoadingDispo, setIsLoadingDispo] = useState(false);
  const [erroDispo, setErroDispo] = useState("");
  const [isDispoModalOpen, setIsDispoModalOpen] = useState(false);
  const [novoDiaSemana, setNovoDiaSemana] = useState(1);
  const [novoHoraInicio, setNovoHoraInicio] = useState("14:00");
  const [novoHoraFim, setNovoHoraFim] = useState("19:00");
  const [isSavingDispo, setIsSavingDispo] = useState(false);

  /* ─── Estado: filtros do resumo financeiro ─────────────────────────────── */
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedAnoLetivoId, setSelectedAnoLetivoId] = useState("");
  const [isDetalhesModalOpen, setIsDetalhesModalOpen] = useState(false);

  /* ─── Estado: modal de confirmação de execução ─────────────────────────── */
  const [modalConfirmarAula, setModalConfirmarAula] = useState({
    isOpen: false,
    aula: null,
    metodoPagamento: "Numerário",
  });

  /* ─── Estado: pesquisa de alunos externos por email ────────────────────── */
  const [emailBusca, setEmailBusca] = useState("");
  const [isBuscandoEmail, setIsBuscandoEmail] = useState(false);
  const [alunosExternos, setAlunosExternos] = useState([]);

  /* ─── Estado: alertas e toasts ─────────────────────────────────────────── */
  const [alertaExcl, setAlertaExcl] = useState({ isOpen: false, message: "" });
  const [globalToast, setGlobalToast] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, mensagem: "" });

  /* ─── Estado: modal de preço e pedido de coaching ──────────────────────── */
  const [isPrecoModalOpen, setIsPrecoModalOpen] = useState(false);
  const [precoInfo, setPrecoInfo] = useState({
    isLoading: false,
    erro: "",
    dataAula: "",
    horaInicio: "",
    formatoAula: "Solo",
    duracaoMinutos: 60,
    custoEstimado: null,
  });
  const [pedidoErro, setPedidoErro] = useState("");
  const [isSubmittingPedido, setIsSubmittingPedido] = useState(false);

  /* ─── Estado: dados dos formulários de pedido ──────────────────────────── */
  const [modalidadesPedido, setModalidadesPedido] = useState([]);
  const [anosLetivosPedido, setAnosLetivosPedido] = useState([]);
  const [professoresPedido, setProfessoresPedido] = useState([]);
  const [alunosPedido, setAlunosPedido] = useState([]);
  const [isLoadingAlunosPedido, setIsLoadingAlunosPedido] = useState(false);
  const [pedidoForm, setPedidoForm] = useState({
    idModalidade: "",
    idAnoLetivo: "",
    alunosIds: [],
    idProfessor: "",
  });
  const [minhasModalidades, setMinhasModalidades] = useState([]);

  /* ─── Constantes da grelha ──────────────────────────────────────────────── */

  /** Horas da grelha semanal (08:00 – 21:00) */
  const horas = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
  ];

  /** Abreviaturas dos dias da semana para os cabeçalhos da grelha */
  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  /* ─── Memos derivados ───────────────────────────────────────────────────── */

  /** Pedidos que ainda aguardam resposta do professor */
  const pedidosParaResponder = useMemo(() => {
    return pedidosPendentesProf.filter((p) => {
      const estLow = String(p.estado || "").toLowerCase();
      return estLow === "pendente professor" || estLow === "pendente";
    });
  }, [pedidosPendentesProf]);

  /** Determina se o utilizador atual tem perfil de Encarregado de Educação */
  const isPerfilEE = useMemo(() => {
    const perfil = String(utilizador?.perfil || "").toLowerCase();
    if (perfil.includes("ee") || perfil.includes("encarregado")) return true;
    const perfis = utilizador?.perfis;
    if (!Array.isArray(perfis)) return false;
    return perfis.some((p) => {
      if (typeof p === "string")
        return (
          p.toLowerCase().includes("ee") ||
          p.toLowerCase().includes("encarregado")
        );
      const nome = String(p?.nome || p?.perfil || "").toLowerCase();
      return nome.includes("ee") || nome.includes("encarregado");
    });
  }, [utilizador]);

  /* ─── Funções de carregamento de dados ─────────────────────────────────── */

  /** Carrega os pedidos de coaching pendentes de resposta pelo professor */
  const carregarPedidosPendentesProf = async () => {
    if (utilizador?.perfil !== "Professor") return;
    try {
      const data = await apiAuthFetch(
        "/api/coaching/professor/pedidos-pendentes",
      );
      setPedidosPendentesProf(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar pedidos pendentes:", error);
    }
  };

  useEffect(() => {
    carregarPedidosPendentesProf();
  }, [utilizador]);

  /** Flag: a agenda atual é do EE (seja por prop ou por perfil) */
  const isAgendaEE = modo === "ee" || isPerfilEE;

  /** Flag: o utilizador atual pode pedir aulas (apenas EE) */
  const podePedirAula = isAgendaEE;

  /**
   * Exibe um toast global temporário.
   * @param {string} texto - Mensagem a apresentar
   * @param {"sucesso"|"erro"} tipo - Tipo visual do toast
   */
  function mostrarToast(texto, tipo = "sucesso") {
    setGlobalToast({ texto, tipo });
    setTimeout(() => setGlobalToast(null), 5000);
  }

  /* ─── Efeitos de inicialização ──────────────────────────────────────────── */

  useEffect(() => {
    document.title = "Coaching | Viva D'arte";
  }, []);

  /** Lê o utilizador do localStorage ao montar */
  useEffect(() => {
    const userRaw = localStorage.getItem("viva_user");
    if (!userRaw) {
      setUtilizador(null);
      return;
    }
    try {
      setUtilizador(JSON.parse(userRaw));
    } catch {
      localStorage.removeItem("viva_user");
      setUtilizador(null);
    }
  }, []);

  /** Carrega as modalidades do professor autenticado */
  useEffect(() => {
    if (!utilizador || isAgendaEE) return;
    let active = true;
    async function fetchMinhasModalidades() {
      try {
        const profId = utilizador.id || utilizador.id_utilizador;
        const res = await apiAuthFetch(
          `/api/escola/professores/${profId}/modalidades`,
        );
        if (active) setMinhasModalidades(Array.isArray(res) ? res : []);
      } catch (e) {
        console.error("Erro ao carregar as minhas modalidades:", e);
      }
    }
    fetchMinhasModalidades();
    return () => {
      active = false;
    };
  }, [utilizador, isAgendaEE]);

  /** Carrega modalidades e anos letivos para o formulário de pedido */
  useEffect(() => {
    if (!utilizador) return;
    let active = true;
    async function carregarDadosPedido() {
      try {
        const [mods, anos] = await Promise.all([
          apiAuthFetch("/api/escola/modalidades"),
          apiAuthFetch("/api/escola/anos-letivos"),
        ]);
        if (!active) return;
        setModalidadesPedido(Array.isArray(mods) ? mods : []);
        const anosArray = Array.isArray(anos) ? anos : [];
        setAnosLetivosPedido(anosArray);
        if (anosArray.length > 0) {
          setSelectedAnoLetivoId(anosArray[0].id_ano_letivo);
          setPedidoForm((prev) => ({
            ...prev,
            idAnoLetivo: anosArray[0].id_ano_letivo,
          }));
        }
      } catch {
        if (!active) return;
        setModalidadesPedido([]);
        setAnosLetivosPedido([]);
      }
    }
    carregarDadosPedido();
    return () => {
      active = false;
    };
  }, [utilizador]);

  /** Carrega os alunos associados ao EE autenticado */
  useEffect(() => {
    if (!utilizador) return;
    let active = true;
    async function carregarAlunosPedido() {
      setIsLoadingAlunosPedido(true);
      try {
        const lista = await apiAuthFetch("/api/auth/me/alunos");
        if (!active) return;
        const listaArray = Array.isArray(lista) ? lista : [];
        setAlunosPedido(listaArray);
        if (listaArray.length === 1) {
          setPedidoForm((prev) => ({
            ...prev,
            alunosIds: prev.alunosIds.length
              ? prev.alunosIds
              : [listaArray[0].id_aluno],
          }));
        }
      } catch {
        if (!active) return;
        setAlunosPedido([]);
      } finally {
        if (active) setIsLoadingAlunosPedido(false);
      }
    }
    carregarAlunosPedido();
    return () => {
      active = false;
    };
  }, [utilizador]);

  /** Carrega as disponibilidades do professor (apenas para o perfil professor) */
  useEffect(() => {
    if (!utilizador) return;
    let isMounted = true;
    async function carregarDisponibilidades() {
      if (isAgendaEE) {
        setDisponibilidades([]);
        setErroDispo("");
        setIsLoadingDispo(false);
        return;
      }
      setErroDispo("");
      setIsLoadingDispo(true);
      try {
        const data = await apiAuthFetch("/api/coaching/disponibilidades");
        if (!isMounted) return;
        setDisponibilidades(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!isMounted) return;
        setDisponibilidades([]);
        setErroDispo(e?.message || "Erro ao carregar disponibilidades");
      } finally {
        if (isMounted) setIsLoadingDispo(false);
      }
    }
    carregarDisponibilidades();
    return () => {
      isMounted = false;
    };
  }, [isAgendaEE, utilizador]);

  /* ─── Carregamento da agenda semanal ───────────────────────────────────── */

  /**
   * Carrega os dados da agenda para a semana visível.
   * Para o EE: carrega os seus pedidos.
   * Para o professor: carrega a agenda + pedidos pendentes.
   */
  async function carregarAgendaSemana() {
    setIsLoadingAgenda(true);
    setErroAgenda("");
    try {
      if (isAgendaEE) {
        const meusPedidos = await apiAuthFetch(`/api/coaching/pedidos/meus`);
        setPedidosPendentesProf(Array.isArray(meusPedidos) ? meusPedidos : []);
        setAgenda([]);
      } else {
        const [dataAgenda, dataPedidos] = await Promise.all([
          apiAuthFetch(`/api/coaching/agenda`),
          apiAuthFetch(`/api/coaching/professor/pedidos-pendentes`),
        ]);
        setAgenda(Array.isArray(dataAgenda) ? dataAgenda : []);
        setPedidosPendentesProf(Array.isArray(dataPedidos) ? dataPedidos : []);
      }
    } catch (e) {
      setErroAgenda(e?.message || "Erro ao carregar agenda");
    } finally {
      setIsLoadingAgenda(false);
    }
  }

  useEffect(() => {
    if (!utilizador) return;
    carregarAgendaSemana();
  }, [utilizador, weekStart, isAgendaEE]);

  /* ─── Memos da grelha e estatísticas ───────────────────────────────────── */

  /**
   * Resumo financeiro mensal do professor:
   * aulas dadas no mês selecionado + valor total a receber.
   */
  const resumoMensal = useMemo(() => {
    const aulasDadasNoPeriodo = agenda.filter((row) => {
      if (row.estado !== "Realizado" && row.estado !== "Concluido")
        return false;
      if (
        selectedAnoLetivoId &&
        String(row.id_ano_letivo) !== String(selectedAnoLetivoId)
      )
        return false;
      const dataAula = parseDataCalendario(row.data_aula);
      if (!dataAula) return false;
      return dataAula.getMonth() === selectedMonth;
    });
    const total = aulasDadasNoPeriodo.reduce(
      (acc, row) => acc + Number(row.valor_final || 0),
      0,
    );
    return {
      aulasDadas: aulasDadasNoPeriodo.length,
      aReceber: total,
      detalhes: aulasDadasNoPeriodo,
    };
  }, [agenda, selectedMonth, selectedAnoLetivoId]);

  /**
   * Mapa "DIA|HORA" → lista de eventos (disponibilidades, aulas, pedidos)
   * para renderização na grelha semanal.
   */
  const agendaPorDiaHora = useMemo(() => {
    const map = new Map();
    const addEvent = (key, event) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    };

    const semanaInicio = weekStart;
    const semanaFim = addDays(weekStart, 6);

    function dentroSemana(dataStr) {
      const d = parseDataCalendario(dataStr);
      if (!d) return false;
      return d >= semanaInicio && d <= semanaFim;
    }

    /* Label da(s) disciplina(s) do professor */
    const labelModalidade =
      minhasModalidades.length === 1
        ? minhasModalidades[0].modalidade
        : minhasModalidades.length > 1
          ? "Várias Disciplinas"
          : "Disponível";

    /* Slots de disponibilidade do professor */
    for (const d of disponibilidades) {
      const diaName = abrevDiaSemana(d.dia_semana);
      if (!diaName) continue;
      const startHour = parseInt(
        formatHoraCurta(d.hora_inicio).split(":")[0],
        10,
      );
      const endHour = parseInt(formatHoraCurta(d.hora_fim).split(":")[0], 10);
      for (let h = startHour; h < endHour; h++) {
        const horaSlot = `${String(h).padStart(2, "0")}:00`;
        addEvent(`${diaName}|${horaSlot}`, {
          origem: "disponibilidade",
          id_disponibilidade: d.id_disponibilidade,
          modalidade: labelModalidade,
          nome_professor: utilizador?.nome || "Professor",
          hora_inicio: horaSlot,
          duracao_minutos: 60,
          formato_aula: "Livre para marcação",
          estado: "Livre",
        });
      }
    }

    /* Aulas já confirmadas da agenda */
    for (const row of agenda) {
      if (!dentroSemana(row.data_aula)) continue;
      const diaKey = diaSemanaAbrevData(row.data_aula);
      const horaSlot = horaParaSlot(row.hora_inicio);
      if (!diaKey || !horaSlot) continue;
      addEvent(`${diaKey}|${horaSlot}`, { ...row, origem: "coaching" });
    }

    /* Pedidos pendentes (do EE e do professor) */
    for (const p of pedidosPendentesProf) {
      const isFromEE = p.hasOwnProperty("estado_coaching");

      if (isFromEE) {
        const isAgendado =
          p.id_coaching &&
          p.estado_coaching &&
          p.estado_coaching !== "Cancelado";
        const diaReal = isAgendado
          ? p.data_aula_coaching
          : p.data_aula_pretendida;
        const horaReal = isAgendado
          ? p.hora_inicio_coaching
          : p.hora_inicio_pretendida;
        if (!dentroSemana(diaReal)) continue;
        const diaKey = diaSemanaAbrevData(diaReal);
        const horaSlot = horaParaSlot(horaReal);
        if (!diaKey || !horaSlot) continue;
        addEvent(`${diaKey}|${horaSlot}`, {
          origem: isAgendado ? "coaching" : "pedido_pendente",
          id_pedido_coaching: p.id_pedido_coaching,
          id_coaching: p.id_coaching,
          data_aula: diaReal,
          hora_inicio: horaReal,
          duracao_minutos: p.duracao_minutos,
          formato_aula: p.formato_aula,
          modalidade: p.modalidade,
          encarregado: utilizador?.nome || "Eu",
          alunos: p.alunos || p.nome_aluno,
          estado: isAgendado ? p.estado_coaching : p.estado,
          sala: p.nome_sala,
          nome_professor: isAgendado ? p.nome_professor_agendado : p.professor,
        });
      } else {
        const estLow = String(p.estado || "").toLowerCase();
        if (!estLow.includes("pendente")) continue;
        if (!dentroSemana(p.data_aula_pretendida)) continue;
        const diaKey = diaSemanaAbrevData(p.data_aula_pretendida);
        const horaSlot = horaParaSlot(p.hora_inicio_pretendida);
        if (!diaKey || !horaSlot) continue;
        if (
          !map.has(`${diaKey}|${horaSlot}`) ||
          !map
            .get(`${diaKey}|${horaSlot}`)
            .find((x) => x.id_pedido_coaching === p.id_pedido_coaching)
        ) {
          addEvent(`${diaKey}|${horaSlot}`, {
            origem: "pedido_pendente",
            id_pedido_coaching: p.id_pedido_coaching,
            data_aula: p.data_aula_pretendida,
            hora_inicio: p.hora_inicio_pretendida,
            duracao_minutos: p.duracao_minutos,
            formato_aula: p.formato_aula,
            modalidade: p.modalidade,
            encarregado: p.encarregado,
            alunos: p.alunos || p.nome_aluno,
            estado: p.estado,
            sala: null,
            id_coaching: null,
          });
        }
      }
    }
    return map;
  }, [
    agenda,
    pedidosPendentesProf,
    disponibilidades,
    utilizador,
    minhasModalidades,
    weekStart,
  ]);

  /** Aulas que já terminaram e ainda precisam de validação pelo professor */
  const aulasParaValidar = useMemo(() => {
    return agenda.filter(
      (a) =>
        (a.estado === "Agendado" || a.estado === "Confirmado") &&
        coachingJaTerminou(a.data_aula, a.hora_inicio, a.duracao_minutos),
    );
  }, [agenda]);

  /** Aulas futuras que ainda não foram canceladas nem realizadas */
  const proximasAulas = useMemo(() => {
    const agora = new Date();
    return agenda.filter((a) => {
      if (
        [
          "Cancelado",
          "Rejeitado",
          "Realizado",
          "Nao_Realizado",
          "Concluido",
        ].includes(a.estado)
      )
        return false;
      const dataAula = parseDataCalendario(a.data_aula);
      if (!dataAula) return false;
      const mins = parseTimeToMinutes(a.hora_inicio);
      if (mins == null) return false;
      const h = Math.floor(mins / 60);
      const mm = mins % 60;
      const fimAula = new Date(
        dataAula.getFullYear(),
        dataAula.getMonth(),
        dataAula.getDate(),
        h,
        mm,
        0,
        0,
      );
      fimAula.setMinutes(
        fimAula.getMinutes() + Number(a.duracao_minutos || 60),
      );
      return fimAula >= agora;
    });
  }, [agenda]);

  /** Pedidos aguardando decisão do professor ou da coordenação */
  const aulasAguardandoCoordenacao = useMemo(() => {
    return pedidosPendentesProf
      .filter(
        (p) =>
          p.estado === "Pendente" ||
          p.estado === "Pendente Professor" ||
          p.estado === "Pendente Coordenação",
      )
      .map((p) => ({
        ...p,
        isPedido: true,
        tipoItem: "APROVACAO",
        data_aula: p.data_aula_pretendida,
        hora_inicio: p.hora_inicio_pretendida,
        nome_sala: "A definir pela coordenação",
      }));
  }, [pedidosPendentesProf]);

  /* ─── Navegação semanal ─────────────────────────────────────────────────── */

  const irParaHoje = () => setWeekStart(getMonday(new Date()));
  const irParaSemanaAnterior = () => setWeekStart((d) => addDays(d, -7));
  const irParaSemanaSeguinte = () => setWeekStart((d) => addDays(d, 7));

  /** Label "DD/MM — DD/MM" do intervalo da semana visível */
  const semanaLabel = useMemo(() => {
    const inicio = weekStart;
    const fim = addDays(weekStart, 6);
    return `${formatDM(inicio)} — ${formatDM(fim)}`;
  }, [weekStart]);

  /* ─── Handlers de pedidos e disponibilidades ────────────────────────────── */

  /**
   * Aceita ou rejeita um pedido de coaching como professor.
   * @param {number} idPedido
   * @param {boolean} aceitar
   */
  const handleResponderPedido = async (idPedido, aceitar) => {
    try {
      await apiAuthFetch(
        `/api/coaching/professor/pedidos/${idPedido}/responder`,
        { method: "PUT", body: { aceitar } },
      );
      setAlertaExcl({
        isOpen: true,
        message: `O pedido foi ${aceitar ? "aceite e enviado para a coordenação" : "rejeitado"}.`,
      });
      carregarPedidosPendentesProf();
      carregarAgendaSemana();
    } catch (err) {
      setAlertaExcl({
        isOpen: true,
        message:
          err?.message ||
          "Ocorreu um erro ao processar a resposta. Tenta novamente.",
      });
    }
  };

  /** Guarda uma nova disponibilidade horária do professor */
  const guardarDisponibilidade = async () => {
    setErroDispo("");
    setIsSavingDispo(true);
    try {
      await apiAuthFetch("/api/coaching/disponibilidades", {
        method: "POST",
        body: {
          diaSemana: Number(novoDiaSemana),
          horaInicio: normalizeTime(novoHoraInicio),
          horaFim: normalizeTime(novoHoraFim),
        },
      });
      const data = await apiAuthFetch("/api/coaching/disponibilidades");
      setDisponibilidades(Array.isArray(data) ? data : []);
      setAlertModal({
        isOpen: true,
        mensagem: "Horário adicionado! Podes inserir o próximo.",
      });
      setNovoHoraInicio("");
      setNovoHoraFim("");
    } catch (e) {
      setErroDispo(e?.message || "Erro ao guardar disponibilidade");
    } finally {
      setIsSavingDispo(false);
    }
  };

  /**
   * Remove uma disponibilidade pelo seu ID.
   * @param {number} id
   */
  const removerDisponibilidade = async (id) => {
    if (!id) return;
    setErroDispo("");
    try {
      await apiAuthFetch(`/api/coaching/disponibilidades/${id}`, {
        method: "DELETE",
      });
      setDisponibilidades((prev) =>
        prev.filter((r) => r.id_disponibilidade !== id),
      );
      mostrarToast("Horário removido.", "sucesso");
    } catch (e) {
      setErroDispo(e?.message || "Erro ao remover disponibilidade");
    }
  };

  /**
   * Valida a realização de uma aula e regista o método de pagamento.
   * @param {object} row - Objeto da aula
   * @param {string} metodoPagamento
   */
  const validarRealizacao = async (row, metodoPagamento) => {
    if (!row?.id_coaching) return;
    try {
      await apiAuthFetch(`/api/coaching/${row.id_coaching}/validar`, {
        method: "POST",
        body: {
          estadoValidacao: "Confirmado",
          observacoes: null,
          metodoPagamento,
        },
      });
      setModalConfirmarAula({
        isOpen: false,
        aula: null,
        metodoPagamento: "Numerário",
      });
      setAlertModal({
        isOpen: true,
        mensagem: `Realização validada! Pagamento por ${metodoPagamento} registado com sucesso.`,
      });
      carregarAgendaSemana();
    } catch (e) {
      setAlertModal({
        isOpen: true,
        mensagem: e?.message || "Não foi possível validar esta aula.",
      });
    }
  };

  /**
   * Pesquisa um aluno externo pelo email do seu encarregado de educação
   * e adiciona-o à lista de participantes do pedido.
   * @param {Event} e
   */
  const buscarAlunoPorEmail = async (e) => {
    if (e) e.preventDefault();
    if (!emailBusca.trim()) return;
    setIsBuscandoEmail(true);
    try {
      const url = `/api/coaching/alunos/procurar?email=${encodeURIComponent(emailBusca.trim())}`;
      const data = await apiAuthFetch(url);
      if (data && data.length > 0) {
        const novoAluno = data[0];
        if (
          alunosExternos.find((a) =>
            a.id_aluno === Array.isArray(data)
              ? novoAluno.id_aluno
              : data.id_aluno,
          ) ||
          pedidoForm.alunosIds.includes(novoAluno.id_aluno)
        ) {
          setAlertaExcl({
            isOpen: true,
            message: "Aviso: Este aluno já está selecionado na lista.",
          });
        } else {
          setAlunosExternos([...alunosExternos, novoAluno]);
          setPedidoForm((prev) => ({
            ...prev,
            alunosIds: [...prev.alunosIds, novoAluno.id_aluno],
          }));
          setEmailBusca("");
        }
      } else {
        setAlertaExcl({
          isOpen: true,
          message: "Não foi encontrado nenhum aluno associado a este email.",
        });
      }
    } catch (err) {
      console.error(err);
      setAlertaExcl({
        isOpen: true,
        message:
          "Nenhum Encarregado de Educação encontrado com este email. Confirme se o email está correto.",
      });
    } finally {
      setIsBuscandoEmail(false);
    }
  };

  /**
   * Remove um aluno externo (convidado por email) da lista de participantes.
   * @param {number} id
   */
  const removerAlunoExterno = (id) => {
    setAlunosExternos(alunosExternos.filter((a) => a.id_aluno !== id));
    setPedidoForm((prev) => ({
      ...prev,
      alunosIds: prev.alunosIds.filter((idx) => idx !== id),
    }));
  };

  /* ─── Handlers do modal de preço / pedido ───────────────────────────────── */

  /**
   * Carrega o preço estimado da aula com os parâmetros atuais do formulário.
   */
  const carregarPrecoEstimado = async ({
    dataAula,
    horaInicio,
    formatoAula,
    duracaoMinutos,
    idModalidade = pedidoForm.idModalidade,
    idProfessor = pedidoForm.idProfessor,
  }) => {
    setPrecoInfo((p) => ({
      ...p,
      isLoading: true,
      erro: "",
      custoEstimado: null,
    }));
    try {
      const params = {
        dataAula,
        horaInicio,
        formatoAula,
        duracaoMinutos: String(duracaoMinutos),
      };
      if (idModalidade) params.idModalidade = String(idModalidade);
      if (idProfessor) params.idProfessor = String(idProfessor);
      const q = new URLSearchParams(params).toString();
      const data = await apiAuthFetch(`/api/coaching/preco-estimado?${q}`);
      setPrecoInfo((p) => ({
        ...p,
        isLoading: false,
        custoEstimado: data?.custoEstimado ?? null,
        formatoAula: data?.formatoAula || formatoAula,
        duracaoMinutos: Number(data?.duracaoMinutos || duracaoMinutos),
      }));
    } catch (e) {
      setPrecoInfo((p) => ({
        ...p,
        isLoading: false,
        erro: traduzErroCoaching(e, "Não foi possível obter o preço estimado."),
      }));
    }
  };

  /**
   * Abre o modal de pedido e carrega o preço estimado para o slot clicado.
   * @param {{ dataAulaYmd: string, horaInicio: string }} params
   */
  const verPrecoEstimado = async ({ dataAulaYmd, horaInicio }) => {
    if (!podePedirAula) return;
    setPedidoErro("");
    setPrecoInfo((p) => ({
      ...p,
      isLoading: true,
      erro: "",
      dataAula: dataAulaYmd,
      horaInicio,
      custoEstimado: null,
    }));
    setPedidoForm({
      idModalidade: "",
      idAnoLetivo:
        anosLetivosPedido.length > 0 ? anosLetivosPedido[0].id_ano_letivo : "",
      alunosIds: alunosPedido.length === 1 ? [alunosPedido[0].id_aluno] : [],
      idProfessor: "",
    });
    setProfessoresPedido([]);
    setIsPrecoModalOpen(true);
    try {
      await carregarPrecoEstimado({
        dataAula: dataAulaYmd,
        horaInicio,
        formatoAula: "Solo",
        duracaoMinutos: 60,
        idModalidade: "",
        idProfessor: "",
      });
    } catch (e) {
      setPrecoInfo((p) => ({
        ...p,
        isLoading: false,
        erro: traduzErroCoaching(e, "Não foi possível obter o preço estimado."),
      }));
    }
  };

  /** Atualiza o formato da aula e recarrega o preço estimado */
  const atualizarFormatoAula = (formatoAula) => {
    setPrecoInfo((p) => ({ ...p, formatoAula }));
    if (precoInfo.dataAula && precoInfo.horaInicio) {
      carregarPrecoEstimado({
        dataAula: precoInfo.dataAula,
        horaInicio: precoInfo.horaInicio,
        formatoAula,
        duracaoMinutos: precoInfo.duracaoMinutos || 60,
      });
    }
  };

  /** Atualiza a duração da aula e recarrega o preço estimado */
  const atualizarDuracaoAula = (duracaoMinutos) => {
    const dur = Number(duracaoMinutos);
    setPrecoInfo((p) => ({ ...p, duracaoMinutos: dur }));
    if (precoInfo.dataAula && precoInfo.horaInicio) {
      carregarPrecoEstimado({
        dataAula: precoInfo.dataAula,
        horaInicio: precoInfo.horaInicio,
        formatoAula: precoInfo.formatoAula || "Solo",
        duracaoMinutos: dur,
      });
    }
  };

  /**
   * Carrega a lista de professores disponíveis para uma modalidade.
   * @param {string|number} idModalidade
   */
  const carregarProfessoresPorModalidade = async (idModalidade) => {
    if (!idModalidade) {
      setProfessoresPedido([]);
      setPedidoForm((p) => ({ ...p, idProfessor: "" }));
      return;
    }
    try {
      const lista = await apiAuthFetch(
        `/api/escola/modalidades/${idModalidade}/professores`,
      );
      const arr = Array.isArray(lista) ? lista : [];
      setProfessoresPedido(arr);
      if (
        !arr.some(
          (p) => String(p.id_professor) === String(pedidoForm.idProfessor),
        )
      )
        setPedidoForm((prev) => ({ ...prev, idProfessor: "" }));
    } catch {
      setProfessoresPedido([]);
      setPedidoForm((p) => ({ ...p, idProfessor: "" }));
    }
  };

  /** Submete o pedido de coaching direto pelo EE */
  const submeterPedidoCoachingDireto = async () => {
    if (!podePedirAula) {
      setPedidoErro("Apenas o encarregado de educação pode pedir aulas.");
      return;
    }
    setPedidoErro("");
    const alunosIds = (pedidoForm.alunosIds || [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    if (!pedidoForm.idModalidade || !pedidoForm.idAnoLetivo) {
      setPedidoErro("Preenche a modalidade e o ano letivo.");
      return;
    }
    if (isPerfilEE && alunosIds.length === 0) {
      setPedidoErro("Seleciona pelo menos 1 aluno da tua lista.");
      return;
    }
    const formatoAtual = precoInfo.formatoAula || "Solo";
    setIsSubmittingPedido(true);
    try {
      await apiAuthFetch("/api/coaching/pedidos", {
        method: "POST",
        body: {
          idModalidade: Number(pedidoForm.idModalidade),
          idProfessor: pedidoForm.idProfessor
            ? Number(pedidoForm.idProfessor)
            : null,
          formatoAula: precoInfo.formatoAula || "Solo",
          duracaoMinutos: Number(precoInfo.duracaoMinutos || 60),
          dataAula: precoInfo.dataAula,
          horaInicio: normalizeTime(precoInfo.horaInicio),
          idAnoLetivo: Number(pedidoForm.idAnoLetivo),
          alunosIds,
        },
      });
      setIsPrecoModalOpen(false);
      setAlertModal({
        isOpen: true,
        mensagem: `Pedido de ${formatoAtual} enviado! A aguardar aprovação da coordenação.`,
      });
      carregarAgendaSemana();
    } catch (e) {
      setPedidoErro(
        traduzErroCoaching(e, "Não foi possível submeter o pedido."),
      );
    } finally {
      setIsSubmittingPedido(false);
    }
  };

  /** Faz logout do utilizador e redireciona para a landing */
  const handleLogout = () => {
    localStorage.removeItem("viva_user");
    localStorage.removeItem("viva_token");
    localStorage.removeItem("token");
    if (irParaLanding) irParaLanding();
    window.location.reload();
  };

  /* ─── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="dashboard-container">
      {/* Toast global de feedback (sucesso / erro) */}
      {globalToast && (
        <div className={`global-toast global-toast--${globalToast.tipo}`}>
          <span className="toast-icon">
            {globalToast.tipo === "sucesso" ? (
              <CheckCircle2 size={18} />
            ) : (
              <XCircle size={18} />
            )}
          </span>
          {globalToast.texto}
        </div>
      )}

      {/* ================================================================
          NAVBAR INTERNA
          ================================================================ */}
      <nav className="navbar interna" style={{ position: "relative" }}>
        {/* Marca — visível em desktop, oculta em mobile via CSS */}
        <div className="nav-brand" onClick={irParaLanding}>
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>

        {/* Links de navegação — centrados em desktop, dropdown em mobile */}
        <ul className={`nav-menu${menuInternoAberto ? " aberto" : ""}`}>
          <li>
            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault();
                setMenuInternoAberto(false);
                irParaLanding?.();
              }}
            >
              Início
            </a>
          </li>
          <li className="nav-separator">|</li>
          <li>
            <a
              href="#agenda_semana"
              onClick={(e) => {
                e.preventDefault();
                irParaAgenda?.();
              }}
            >
              Agenda
            </a>
          </li>
          <li>
            <a
              href="#agenda"
              className="special-link active"
              onClick={(e) => {
                e.preventDefault();
                setMenuInternoAberto(false);
                const user = JSON.parse(
                  localStorage.getItem("viva_user") || "{}",
                );
                if (user.tipo === "PROF" || user.role === "PROFESSOR") {
                  irParaMinhaAgendaProfessor?.();
                } else {
                  irParaMinhaAgendaEE?.();
                }
              }}
            >
              Coaching
            </a>
          </li>
          <li>
            <a
              href="#figurinos"
              onClick={(e) => {
                e.preventDefault();
                setMenuInternoAberto(false);
                irParaFigurinos?.();
              }}
            >
              Marketplace
            </a>
          </li>
        </ul>

        {/* Perfil — inline style garante posição à direita em mobile independente do CSS */}
        <div className="nav-actions nav-actions--interna">
          <div className="user-profile">
            <span className="welcome-text">
              Olá, <strong>{utilizador?.nome || ""}</strong>
            </span>
            <button className="btn-logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>

        {/* Botão hamburger — inline style garante posição à esquerda em mobile */}
        <button
          className={`hamburger-interna${menuInternoAberto ? " ativo" : ""}`}
          onClick={() => setMenuInternoAberto((prev) => !prev)}
          aria-label="Abrir menu de navegação"
          aria-expanded={menuInternoAberto}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>

      {/* ================================================================
          DASHBOARD PRINCIPAL
          Grelha semanal (esquerda) + sidebar de informação (direita).
          ================================================================ */}
      <div className="dashboard-wrapper" id="agenda">
        {/* ── Calendário semanal ── */}
        <main className="calendar-container">
          {/* Barra de navegação entre semanas */}
          <div className="calendar-nav-bar">
            <button
              className="btn-today"
              type="button"
              onClick={irParaSemanaAnterior}
            >
              ←
            </button>
            <button
              className="btn-today btn-today--hoje"
              type="button"
              onClick={irParaHoje}
            >
              Hoje
            </button>
            <span className="calendar-nav-label">{semanaLabel}</span>
            <button
              className="btn-today"
              type="button"
              onClick={irParaSemanaSeguinte}
            >
              →
            </button>
          </div>

          {/* Em mobile, este wrapper faz scroll horizontal em conjunto
              para o cabeçalho e a grelha scrollarem juntos */}
          <div className="calendar-mobile-scroll">
            {/* Cabeçalho fixo com nomes e datas dos dias — fora da área scrollável
              para ficar sticky em desktop. Em mobile é encapsulado no wrapper. */}
            <div className="calendar-days-sticky">
              <div className="time-corner"></div>
              {dias.map((dia, idx) => {
                const dataDoDia = addDays(weekStart, idx);
                return (
                  <div key={dia} className="day-sticky-cell">
                    <span className="day-label-name">{dia}</span>
                    <span className="day-label-date">
                      {formatDM(dataDoDia)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Área scrollável — apenas a grelha de horas × dias */}
            <div className="calendar-scrollable-area">
              <div className="calendar-grid-body">
                {horas.map((hora) => (
                  <React.Fragment key={hora}>
                    <div className="time-label">{hora}</div>
                    {dias.map((dia, idx) => {
                      const rows = agendaPorDiaHora.get(`${dia}|${hora}`) || [];
                      return (
                        <div
                          key={`${dia}-${idx}`}
                          className={`slot-cell ${podePedirAula && hora > "14:00" ? "is-available" : ""}`}
                          onClick={() => {
                            if (!podePedirAula) return;
                            const dataAulaYmd = formatYMD(
                              addDays(weekStart, idx),
                            );
                            verPrecoEstimado({ dataAulaYmd, horaInicio: hora });
                          }}
                          title={
                            podePedirAula
                              ? "Clique para pedir um Coaching neste horário"
                              : undefined
                          }
                        >
                          {rows.map((row, rIdx) => {
                            const classeModalidade = modalidadeParaClasse(
                              row.modalidade,
                            );

                            /* Slot de disponibilidade livre do professor */
                            if (row.origem === "disponibilidade") {
                              const listaDisciplinas =
                                minhasModalidades.length > 0
                                  ? minhasModalidades
                                      .map((m) => m.modalidade)
                                      .join(", ")
                                  : "Nenhuma disciplina associada";
                              return (
                                <div
                                  key={`disp-${rIdx}`}
                                  className={`event-block ${classeModalidade} disponibilidade-block`}
                                  onClick={(e) => e.stopPropagation()}
                                  title={`Disciplinas disponíveis: ${listaDisciplinas}`}
                                  /* cursor: help migrado para CSS via .disponibilidade-block */
                                >
                                  <div className="event-info">
                                    <span className="event-time">
                                      Livre ({row.hora_inicio})
                                    </span>
                                    <h4 className="event-title">
                                      {row.modalidade}
                                    </h4>
                                    <p className="event-student">
                                      {row.nome_professor}
                                    </p>
                                  </div>
                                </div>
                              );
                            }

                            /* Pedido pendente (aguarda professor ou coordenação) */
                            if (row.origem === "pedido_pendente") {
                              const estLow = String(row.estado).toLowerCase();
                              const isRejeitado = estLow.includes("rejeitado");
                              const isAguardaProf =
                                estLow === "pendente professor" ||
                                estLow === "pendente";
                              return (
                                <div
                                  key={`pend-${rIdx}`}
                                  className={`event-block ${classeModalidade} ${isRejeitado ? "rejeitado-block" : "pendente-coordenacao"}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title={
                                    isRejeitado
                                      ? "Este pedido foi rejeitado"
                                      : isAguardaProf
                                        ? "A aguardar resposta do professor"
                                        : "A aguardar aprovação da coordenação"
                                  }
                                >
                                  <div className="event-info">
                                    <span className="event-time">
                                      {formatIntervalo(
                                        row.hora_inicio,
                                        row.duracao_minutos,
                                      )}
                                    </span>
                                    <span
                                      className={`event-label ${isRejeitado ? "label-rejeitado" : ""}`}
                                    >
                                      {isRejeitado
                                        ? "Rejeitado"
                                        : isAguardaProf
                                          ? "Aguarda Professor"
                                          : "Aguarda Coordenação"}
                                    </span>
                                    <h4 className="event-title">
                                      {row.modalidade} ({row.formato_aula})
                                    </h4>
                                    {isAgendaEE && (
                                      <p className="event-student">
                                        Prof: {row.nome_professor || "Qualquer"}
                                      </p>
                                    )}
                                    {!isAgendaEE && (
                                      <p className="event-student">
                                        Aluno(s):{" "}
                                        {row.alunos || row.encarregado}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            /* Aula agendada / confirmada */
                            const ended = coachingJaTerminou(
                              row.data_aula,
                              row.hora_inicio,
                              row.duracao_minutos,
                            );
                            const pendente =
                              ended &&
                              (row.estado === "Agendado" ||
                                row.estado === "Confirmado");
                            return (
                              <div
                                key={`aula-${rIdx}`}
                                className={`event-block ${classeModalidade} ${pendente ? "status-pending" : ""}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="event-info">
                                  <span className="event-time">
                                    {formatIntervalo(
                                      row.hora_inicio,
                                      row.duracao_minutos,
                                    )}
                                  </span>
                                  <h4 className="event-title">
                                    {row.modalidade} ({row.formato_aula})
                                  </h4>
                                  <p className="event-student">
                                    Sala: {row.sala || "A definir"} •{" "}
                                    {isAgendaEE
                                      ? `Prof: ${row.nome_professor}`
                                      : `Aluno(s): ${row.alunos || row.encarregado}`}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          {/* end calendar-mobile-scroll */}
        </main>

        {/* ================================================================
            MODAL DE PEDIDO DE COACHING (EE)
            Permite ao EE escolher modalidade, professor, duração e alunos.
            ================================================================ */}
        {isPrecoModalOpen && (
          <div
            className="modal-overlay"
            onClick={() => setIsPrecoModalOpen(false)}
          >
            <div className="modal-modern" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Agendar Coaching</h2>
                <p>
                  {formatDM(precoInfo.dataAula)} • {precoInfo.horaInicio}
                </p>
              </div>

              {/* Resumo de preço estimado */}
              <div className="price-summary-card">
                <div className="price-info-col">
                  <span>Custo Estimado</span>
                  <strong>
                    {precoInfo.formatoAula} • {precoInfo.duracaoMinutos} min
                  </strong>
                </div>
                <div className="price-value-col">
                  {precoInfo.isLoading ? (
                    <span className="loading-text-gold">A calcular...</span>
                  ) : precoInfo.erro ? (
                    <span className="error-text-red">Indisponível</span>
                  ) : (
                    <>
                      <span className="price-tag">
                        {precoInfo.custoEstimado != null
                          ? `${Number(precoInfo.custoEstimado).toFixed(2)}`
                          : "—"}
                      </span>
                      <span className="margin-left-4">EUR</span>
                    </>
                  )}
                </div>
              </div>

              {!!precoInfo.erro && (
                <div className="modal-error-msg">{precoInfo.erro}</div>
              )}
              {!!pedidoErro && (
                <div className="modal-error-msg">{pedidoErro}</div>
              )}

              {/* Seleção de formato e duração */}
              <div className="modern-form-grid">
                <div className="form-group">
                  <label>Tipo de aula</label>
                  <select
                    className="form-control"
                    value={precoInfo.formatoAula}
                    onChange={(e) => atualizarFormatoAula(e.target.value)}
                  >
                    {FORMATOS_AULA.map((formato) => (
                      <option key={formato} value={formato}>
                        {formato}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Duração</label>
                  <select
                    className="form-control"
                    value={precoInfo.duracaoMinutos}
                    onChange={(e) => atualizarDuracaoAula(e.target.value)}
                  >
                    {DURACOES_AULA.map((duracao) => (
                      <option key={duracao} value={duracao}>
                        {duracao} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seleção de modalidade e professor */}
              <div className="modern-form-grid">
                <div className="form-group">
                  <label>Modalidade</label>
                  <select
                    className="form-control"
                    value={pedidoForm.idModalidade}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPedidoForm((p) => ({ ...p, idModalidade: id }));
                      carregarProfessoresPorModalidade(id);
                      if (precoInfo.dataAula && precoInfo.horaInicio) {
                        carregarPrecoEstimado({
                          dataAula: precoInfo.dataAula,
                          horaInicio: precoInfo.horaInicio,
                          formatoAula: precoInfo.formatoAula || "Solo",
                          duracaoMinutos: precoInfo.duracaoMinutos || 60,
                          idModalidade: id,
                          idProfessor: "",
                        });
                      }
                    }}
                  >
                    <option value="">Selecionar modalidade</option>
                    {modalidadesPedido.map((m) => (
                      <option key={m.id_modalidade} value={m.id_modalidade}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Professor</label>
                  <select
                    className="form-control"
                    value={pedidoForm.idProfessor}
                    required
                    onChange={(e) => {
                      const id = e.target.value;
                      setPedidoForm((p) => ({ ...p, idProfessor: id }));
                      if (precoInfo.dataAula && precoInfo.horaInicio) {
                        carregarPrecoEstimado({
                          dataAula: precoInfo.dataAula,
                          horaInicio: precoInfo.horaInicio,
                          formatoAula: precoInfo.formatoAula || "Solo",
                          duracaoMinutos: precoInfo.duracaoMinutos || 60,
                          idProfessor: id,
                        });
                      }
                    }}
                  >
                    <option value="" disabled>
                      Selecione um Professor
                    </option>
                    {professoresPedido.map((prof) => (
                      <option key={prof.id_professor} value={prof.id_professor}>
                        {prof.nome_professor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seleção de ano letivo */}
              <div className="form-group margin-bottom-20">
                <label>Ano Letivo</label>
                <select
                  className="form-control"
                  value={pedidoForm.idAnoLetivo}
                  onChange={(e) =>
                    setPedidoForm((p) => ({
                      ...p,
                      idAnoLetivo: e.target.value,
                    }))
                  }
                >
                  <option value="">Selecionar ano letivo</option>
                  {anosLetivosPedido.map((a) => (
                    <option key={a.id_ano_letivo} value={a.id_ano_letivo}>
                      {a.ano}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seleção de participantes */}
              <div className="form-group participantes-section">
                <label className="participantes-label">
                  Participantes da Aula ({precoInfo.formatoAula})
                </label>

                {/* Educandos do EE */}
                <div className="educandos-wrapper">
                  <span className="educandos-titulo">Meus Educandos</span>
                  <div className="alunos-pill-list">
                    {alunosPedido.map((a) => {
                      const selecionado = pedidoForm.alunosIds.includes(
                        a.id_aluno,
                      );
                      return (
                        <div
                          key={a.id_aluno}
                          onClick={() => {
                            const ids = selecionado
                              ? pedidoForm.alunosIds.filter(
                                  (i) => i !== a.id_aluno,
                                )
                              : [...pedidoForm.alunosIds, a.id_aluno];
                            setPedidoForm({ ...pedidoForm, alunosIds: ids });
                          }}
                          className={`aluno-pill ${selecionado ? "aluno-pill--selecionado" : ""}`}
                        >
                          <span>{selecionado ? "" : "+"}</span> {a.nome_aluno}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Convite de colegas (apenas para aulas em grupo) */}
                {precoInfo.formatoAula !== "Solo" && (
                  <div className="convite-colegas-box">
                    <span className="convite-titulo">Convidar Colegas</span>

                    <div className="convite-email-row">
                      <input
                        type="email"
                        className="form-control convite-input"
                        placeholder="Email do Encarregado de Educação..."
                        value={emailBusca}
                        onChange={(e) => setEmailBusca(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && buscarAlunoPorEmail(e)
                        }
                        disabled={isBuscandoEmail}
                      />
                      <button
                        type="button"
                        className="btn-dark convite-btn"
                        onClick={buscarAlunoPorEmail}
                        disabled={isBuscandoEmail}
                      >
                        {isBuscandoEmail ? "..." : "Adicionar"}
                      </button>
                    </div>

                    {/* Lista de alunos externos adicionados */}
                    {alunosExternos.length > 0 && (
                      <div className="externos-list">
                        {alunosExternos.map((al) => (
                          <div
                            key={`ext-${al.id_aluno}`}
                            className="aluno-externo-pill"
                            title={`Convidado por email — EE: ${al.nome_ee}`}
                          >
                            <span>
                              {al.nome_aluno}
                              <small className="externo-ee">
                                {" "}
                                (de {al.nome_ee})
                              </small>
                            </span>
                            <button
                              type="button"
                              className="externo-remover"
                              onClick={() => removerAlunoExterno(al.id_aluno)}
                              title="Remover participante"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-actions-footer">
                <button
                  className="btn-text"
                  type="button"
                  onClick={() => setIsPrecoModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn-gold"
                  type="button"
                  disabled={
                    precoInfo.isLoading ||
                    !!precoInfo.erro ||
                    isSubmittingPedido ||
                    alunosPedido.length === 0 ||
                    !pedidoForm.idProfessor
                  }
                  onClick={submeterPedidoCoachingDireto}
                >
                  {isSubmittingPedido ? "A processar..." : "Confirmar Pedido"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de alerta genérico */}
        {alertModal.isOpen && (
          <div
            className="modal-overlay modal-overlay-high-z"
            onClick={() => setAlertModal({ isOpen: false, mensagem: "" })}
          >
            <div
              className="alert-modal-box"
              onClick={(e) => e.stopPropagation()}
            >
              <p>{alertModal.mensagem}</p>
              <button
                className="btn-dark"
                onClick={() => setAlertModal({ isOpen: false, mensagem: "" })}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            SIDEBAR
            Professor: painel de atividade + disponibilidades.
            EE: informação + lista dos seus pedidos.
            ================================================================ */}
        <aside className="sidebar">
          {/* Vista do professor */}
          {!isAgendaEE && (
            <>
              <div className="sidebar-card activity-panel-card">
                <h3>Painel de Atividade</h3>
                <p>
                  Acede às tuas estatísticas, confirma a execução de aulas e
                  consulta as próximas marcações.
                </p>

                {aulasParaValidar.length > 0 && (
                  <div className="alert-badge">
                    Tens {aulasParaValidar.length} aula(s) para confirmar a
                    execução!
                  </div>
                )}

                {/* Badge laranja para pedidos de coaching a responder */}
                {pedidosParaResponder.length > 0 && (
                  <div className="alert-badge alert-badge--warning">
                    Tens {pedidosParaResponder.length} pedido(s) de Coaching
                    para responder!
                  </div>
                )}

                <button
                  className="btn-gold btn-gold-full"
                  onClick={() => setIsProfMenuOpen(true)}
                >
                  Abrir Painel do Professor
                </button>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-header-flex">
                  <h3>Minha Disponibilidade</h3>
                </div>
                <div className="dispo-list-hud">
                  {isLoadingDispo ? (
                    <div className="dispo-item">A carregar…</div>
                  ) : disponibilidades.length === 0 ? (
                    <div className="dispo-item">Sem horários abertos</div>
                  ) : (
                    disponibilidades.map((d) => (
                      <div key={d.id_disponibilidade} className="dispo-item">
                        <span className="dia-badge">
                          {abrevDiaSemana(d.dia_semana)}
                        </span>
                        <span className="dispo-horas">
                          {formatHoraCurta(d.hora_inicio)} -{" "}
                          {formatHoraCurta(d.hora_fim)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <button
                  className="btn-outline btn-full-margin"
                  type="button"
                  onClick={() => setIsDispoModalOpen(true)}
                >
                  Gerir Disponibilidades
                </button>
              </div>
            </>
          )}

          {/* Vista do EE */}
          {isAgendaEE && (
            <>
              <div className="sidebar-card info-card">
                <h3>Informação</h3>
                <p>
                  Para requisitar o seu coaching, por favor clique no quadrado
                  do horário pretendido na agenda.
                </p>
              </div>

              <div className="sidebar-card">
                <div className="sidebar-header-flex">
                  <h3 className="m-0">Os Meus Pedidos</h3>
                </div>
                <div className="dispo-list-hud dispo-list-hud--tall">
                  {pedidosPendentesProf.length === 0 ? (
                    <div className="empty-dispo">
                      Ainda não tem pedidos de coaching.
                    </div>
                  ) : (
                    pedidosPendentesProf.map((p) => {
                      const vis = estadoPedidoVisual(p);
                      const diaReal =
                        p.estado === "Aprovado" && p.data_aula_coaching
                          ? p.data_aula_coaching
                          : p.data_aula_pretendida;
                      const horaReal =
                        p.estado === "Aprovado" && p.hora_inicio_coaching
                          ? p.hora_inicio_coaching
                          : p.hora_inicio_pretendida;
                      return (
                        <div
                          key={p.id_pedido_coaching}
                          className={`pedido-card ${p.convidado === 1 ? "pedido-card--convidado" : ""}`}
                        >
                          <div className="pedido-card__badge-row">
                            <span
                              className={`badge-simples badge-${vis.tone}`}
                              title={vis.label}
                            >
                              <span className="pedido-card__badge-icon">
                                {vis.icon}
                              </span>
                              <span className="pedido-card__badge-label">
                                {vis.label}
                              </span>
                            </span>
                          </div>
                          <div className="pedido-card__title-block">
                            <div className="pedido-card__title">
                              {p.modalidade}
                              <span className="pedido-card__formato">
                                · {p.formato_aula}
                              </span>
                            </div>
                            <div className="pedido-card__datetime">
                              {formatDM(diaReal)} · {formatHoraCurta(horaReal)}
                            </div>
                          </div>
                          {vis.descricao && (
                            <div className="pedido-card__descricao">
                              {vis.descricao}
                            </div>
                          )}
                          {p.convidado === 1 && p.nome_submissor && (
                            <div className="pedido-card__convite">
                              Convite de {p.nome_submissor}
                            </div>
                          )}
                          {(p.alunos ||
                            p.professor ||
                            p.nome_professor_agendado) && (
                            <div className="pedido-card__detalhes">
                              {p.alunos && (
                                <>
                                  <span className="pedido-card__label">
                                    Participantes
                                  </span>
                                  <span className="pedido-card__valor">
                                    {p.alunos}
                                  </span>
                                </>
                              )}
                              {(p.professor || p.nome_professor_agendado) && (
                                <>
                                  <span className="pedido-card__label">
                                    Professor
                                  </span>
                                  <span className="pedido-card__valor">
                                    {p.nome_professor_agendado || p.professor}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ================================================================
          MODAL DE GESTÃO DE DISPONIBILIDADES (professor)
          ================================================================ */}
      {!isAgendaEE && isDispoModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsDispoModalOpen(false)}
        >
          <div className="modal-modern" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Gerir Disponibilidades</h2>
              <p>
                Define os blocos de horário em que estás disponível para dar
                Coaching.
              </p>
              {minhasModalidades.length > 0 && (
                <div className="dispo-modal-info">
                  <strong className="text-gold">As tuas disciplinas: </strong>
                  {minhasModalidades.map((m) => m.modalidade).join(", ")}
                  <div className="mt-4">
                    Os alunos podem escolher qualquer uma destas modalidades
                    para os teus horários livres.
                    <strong>
                      {" "}
                      Assim que um aluno marcar uma aula, o sistema bloqueia-te
                      e ficas logo indisponível para as outras modalidades nessa
                      hora!
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {!!erroDispo && <div className="modal-error-msg">{erroDispo}</div>}

            {/* Formulário de nova disponibilidade */}
            <div className="dispo-form-grid grid-align-end">
              <div className="form-group full-mobile">
                <label>Dia da Semana</label>
                <select
                  className="form-control"
                  value={novoDiaSemana}
                  onChange={(e) => setNovoDiaSemana(Number(e.target.value))}
                >
                  <option value={1}>Segunda-feira</option>
                  <option value={2}>Terça-feira</option>
                  <option value={3}>Quarta-feira</option>
                  <option value={4}>Quinta-feira</option>
                  <option value={5}>Sexta-feira</option>
                  <option value={6}>Sábado</option>
                  <option value={7}>Domingo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Hora Início</label>
                <input
                  className="form-control"
                  type="time"
                  value={novoHoraInicio}
                  onChange={(e) => setNovoHoraInicio(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Hora Fim</label>
                <input
                  className="form-control"
                  type="time"
                  value={novoHoraFim}
                  onChange={(e) => setNovoHoraFim(e.target.value)}
                />
              </div>
            </div>

            <button
              className="btn-add-dispo"
              type="button"
              disabled={isSavingDispo}
              onClick={guardarDisponibilidade}
            >
              {isSavingDispo ? "A guardar..." : "+ Adicionar Novo Horário"}
            </button>

            {/* Lista de horários já registados */}
            <div className="horarios-list-container">
              <h3>Horários Registados</h3>
              <div className="horarios-scroll-area">
                {(disponibilidades || []).length === 0 ? (
                  <div className="empty-dispo">
                    Ainda não registaste nenhuma disponibilidade.
                    <br />
                    Adiciona horários acima.
                  </div>
                ) : (
                  (disponibilidades || []).map((d) => (
                    <div key={d.id_disponibilidade} className="horario-row">
                      <div className="horario-text">
                        <span className="dia-tag">
                          {abrevDiaSemana(d.dia_semana)}
                        </span>
                        <span className="hora-tag">
                          {formatHoraCurta(d.hora_inicio)} -{" "}
                          {formatHoraCurta(d.hora_fim)}
                        </span>
                      </div>
                      <button
                        className="btn-remove-dispo"
                        type="button"
                        onClick={() =>
                          removerDisponibilidade(d.id_disponibilidade)
                        }
                      >
                        Remover
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-actions-footer">
              <button
                className="btn-text"
                type="button"
                onClick={() => setIsDispoModalOpen(false)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          PAINEL DE GESTÃO DO PROFESSOR
          Pedidos, validações, próximas marcações e resumo financeiro.
          ================================================================ */}
      {isProfMenuOpen && (
        <div className="modal-overlay" onClick={() => setIsProfMenuOpen(false)}>
          <div
            className="modal-modern modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Painel de Gestão</h2>
            </div>

            <div className="prof-dashboard-grid">
              {/* ── Coluna esquerda: Pedidos + Validações ── */}
              <div className="prof-dashboard-col">
                {/* Pedidos de coaching para responder */}
                <div className="prof-panel-section">
                  <h3>
                    <svg
                      viewBox="0 0 24 24"
                      className="section-icon section-icon--warning"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Pedidos de Coaching
                  </h3>
                  {aulasAguardandoCoordenacao.length === 0 ? (
                    <div className="empty-state-text">
                      Nada pendente ou a aguardar revisão.
                    </div>
                  ) : (
                    aulasAguardandoCoordenacao.map((item, idx) => {
                      const estLow = String(item.estado || "").toLowerCase();
                      const aguardaProf =
                        estLow === "pendente professor" ||
                        estLow === "pendente";
                      return (
                        <div
                          key={idx}
                          className={`aula-item-modern ${aguardaProf ? "aula-item-modern--needs-action" : "aula-item-modern--pending-ee"}`}
                        >
                          <div className="aula-item-badge-row">
                            {aguardaProf ? (
                              <span className="badge-simples badge-pendente">
                                Aguarda a tua decisão
                              </span>
                            ) : (
                              <span className="badge-simples badge-aprovado">
                                Aceite — Aguarda Coordenação
                              </span>
                            )}
                          </div>
                          <div className="aula-item-title-block">
                            <div className="aula-item-title">
                              {item.modalidade}
                              <span className="aula-item-formato">
                                · {item.formato_aula}
                              </span>
                            </div>
                            <div className="aula-item-datetime">
                              {formatDM(item.data_aula)} ·{" "}
                              {formatHoraCurta(item.hora_inicio)}
                            </div>
                          </div>
                          {(item.alunos || item.nome_ee) && (
                            <div className="aula-item-detalhes">
                              {item.alunos && (
                                <>
                                  <span className="aula-item-label">
                                    Participantes
                                  </span>
                                  <span className="aula-item-valor">
                                    {item.alunos}
                                  </span>
                                </>
                              )}
                              {item.nome_ee && (
                                <>
                                  <span className="aula-item-label">
                                    Encarregado
                                  </span>
                                  <span className="aula-item-valor">
                                    {item.nome_ee}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          {aguardaProf ? (
                            <div className="pending-action-buttons">
                              <button
                                type="button"
                                className="btn-gold"
                                onClick={() =>
                                  handleResponderPedido(
                                    item.id_pedido_coaching,
                                    true,
                                  )
                                }
                              >
                                Aceitar
                              </button>
                              <button
                                type="button"
                                className="btn-outline btn-outline--danger"
                                onClick={() =>
                                  handleResponderPedido(
                                    item.id_pedido_coaching,
                                    false,
                                  )
                                }
                              >
                                Rejeitar
                              </button>
                            </div>
                          ) : (
                            <div className="pending-warning-text">
                              Aceitaste este pedido. A aguardar aprovação da
                              coordenação…
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Confirmar execução de aulas */}
                <div className="prof-panel-section prof-panel-section--mt">
                  <h3>
                    <svg
                      viewBox="0 0 24 24"
                      className="section-icon alert-icon"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4l3 3" />
                    </svg>
                    Confirmar a Execução da aula
                  </h3>
                  {aulasParaValidar.length === 0 ? (
                    <div className="empty-state-text">
                      Não tens aulas pendentes. Bom trabalho!
                    </div>
                  ) : (
                    aulasParaValidar.map((aula) => (
                      <div
                        key={aula.id_coaching}
                        className="aula-item-modern needs-validation"
                      >
                        <div className="aula-item-header">
                          <span className="aula-item-title">
                            {aula.modalidade}
                          </span>
                          <span className="aula-item-format">
                            {aula.formato_aula}
                          </span>
                        </div>
                        <div className="aula-item-details">
                          <div className="aula-detail-row">
                            <svg
                              viewBox="0 0 24 24"
                              className="detail-icon"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect
                                x="3"
                                y="4"
                                width="18"
                                height="18"
                                rx="2"
                                ry="2"
                              />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {formatDM(aula.data_aula)}
                          </div>
                          <div className="aula-detail-row">
                            <svg
                              viewBox="0 0 24 24"
                              className="detail-icon"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {formatHoraCurta(aula.hora_inicio)}
                          </div>
                        </div>
                        <button
                          className="btn-validate-modern"
                          onClick={() =>
                            setModalConfirmarAula({
                              isOpen: true,
                              aula,
                              metodoPagamento: "Numerário",
                            })
                          }
                        >
                          Confirmar Execução e Pagamento
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Coluna direita: Próximas Marcações + Resumo Financeiro ── */}
              <div className="prof-dashboard-col">
                {/* Próximas aulas agendadas */}
                <div className="prof-panel-section">
                  <h3>
                    <svg
                      viewBox="0 0 24 24"
                      className="section-icon"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                    </svg>
                    Próximas Marcações
                  </h3>
                  {proximasAulas.length === 0 ? (
                    <div className="empty-state-text">
                      Sem aulas futuras agendadas.
                    </div>
                  ) : (
                    proximasAulas.map((aula) => (
                      <div
                        key={`prox-${aula.id_coaching}`}
                        className="aula-item-modern"
                      >
                        <div className="aula-item-header">
                          <span className="aula-item-title">
                            {aula.modalidade}
                          </span>
                          <span className="aula-item-format">
                            {aula.formato_aula}
                          </span>
                        </div>
                        <div className="aula-item-details">
                          <div className="aula-detail-row">
                            <svg
                              viewBox="0 0 24 24"
                              className="detail-icon"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            Sala: {aula.sala || "A definir"}
                          </div>
                          <div className="aula-detail-row">
                            <svg
                              viewBox="0 0 24 24"
                              className="detail-icon"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect
                                x="3"
                                y="4"
                                width="18"
                                height="18"
                                rx="2"
                                ry="2"
                              />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {formatDM(aula.data_aula)} às{" "}
                            {formatHoraCurta(aula.hora_inicio)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Resumo financeiro mensal */}
                <div className="prof-panel-section prof-panel-section--mt">
                  <div className="resumo-header">
                    <div className="resumo-title-wrap">
                      <svg
                        viewBox="0 0 24 24"
                        className="resumo-icon"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 21H3V3m18 8l-6-6-4 4-4-4" />
                      </svg>
                      <h3 className="resumo-title">Resumo Financeiro</h3>
                    </div>
                    <div className="resumo-filters">
                      <select
                        value={selectedMonth}
                        onChange={(e) =>
                          setSelectedMonth(Number(e.target.value))
                        }
                        className="filter-select"
                      >
                        {MESES.map((mes, idx) => (
                          <option key={idx} value={idx}>
                            {mes}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedAnoLetivoId}
                        onChange={(e) => setSelectedAnoLetivoId(e.target.value)}
                        className="filter-select"
                      >
                        <option value="">Ano Letivo</option>
                        {anosLetivosPedido.map((ano) => (
                          <option
                            key={ano.id_ano_letivo}
                            value={ano.id_ano_letivo}
                          >
                            {ano.ano}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="prof-stat-cards">
                    <div className="prof-stat-card">
                      <span>Aulas Dadas</span>
                      <strong>{resumoMensal.aulasDadas}</strong>
                    </div>
                    <div
                      className="prof-stat-card highlight prof-stat-card--clickable"
                      onClick={() => setIsDetalhesModalOpen(true)}
                    >
                      <span>A Receber</span>
                      <strong>{resumoMensal.aReceber.toFixed(2)}€</strong>
                      <span className="stat-card-hint">Ver detalhes ↗</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal de detalhes de faturação */}
              {isDetalhesModalOpen && (
                <div
                  className="modal-overlay modal-overlay-high-z"
                  onClick={() => setIsDetalhesModalOpen(false)}
                >
                  <div
                    className="modal-modern modal-modern--sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="modal-header">
                      <h2>Detalhes de Faturação</h2>
                      <p>
                        Mês de{" "}
                        {new Date().toLocaleString("pt-PT", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="horarios-list-container horarios-list-container--modal">
                      {resumoMensal.detalhes.length === 0 ? (
                        <div className="empty-state-text">
                          Nenhuma aula confirmada este mês.
                        </div>
                      ) : (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Modalidade</th>
                              <th className="text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumoMensal.detalhes.map((aula) => (
                              <tr key={aula.id_coaching} className="table-row">
                                <td className="table-cell">
                                  {formatDM(aula.data_aula)} às{" "}
                                  {formatHoraCurta(aula.hora_inicio)}
                                </td>
                                <td className="table-cell">
                                  {aula.modalidade} <br />
                                  <small className="text-muted">
                                    {aula.formato_aula}
                                  </small>
                                </td>
                                <td className="table-cell text-right">
                                  <strong>
                                    {Number(aula.valor_final || 0).toFixed(2)}€
                                  </strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div className="modal-actions-footer">
                      <button
                        className="btn-text"
                        onClick={() => setIsDetalhesModalOpen(false)}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions-footer">
              <button
                className="btn-text"
                type="button"
                onClick={() => setIsProfMenuOpen(false)}
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          FOOTER
          ================================================================ */}
      <footer className="main-footer">
        <div className="footer-container">
          <div className="footer-column">
            <h3>Contacto</h3>
            <ul className="footer-info">
              <li>
                <MapPin
                  size={14}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />{" "}
                Rua das Artes, nº 123, Braga
              </li>
              <li>
                <Phone
                  size={14}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />{" "}
                +351 000 000 000
              </li>
              <li>
                <Mail
                  size={14}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />{" "}
                geral@vivadarte.pt
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <h3>Links Rápidos</h3>
            <ul className="footer-links">
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    irParaLanding();
                  }}
                >
                  Página Inicial
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <h3>Redes Sociais</h3>
            <div className="social-icons-only">
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="social-svg"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="social-svg"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-line"></div>
          <p>&copy; 2026 Viva D'arte. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* ================================================================
          MODAL DE CONFIRMAÇÃO DE EXECUÇÃO E PAGAMENTO
          ================================================================ */}
      {modalConfirmarAula.isOpen && (
        <div
          className="modal-overlay modal-overlay-high-z"
          onClick={() =>
            setModalConfirmarAula({
              isOpen: false,
              aula: null,
              metodoPagamento: "Numerário",
            })
          }
        >
          <div
            className="modal-modern modal-modern--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Confirmar Execução</h2>
              <p>
                Confirma que a aula foi dada e indica o método de pagamento.
              </p>
            </div>
            {/* gridTemplateColumns: "1fr" migrado para .modern-form-grid--single no CSS */}
            <div className="modern-form-grid modern-form-grid--single">
              <div className="form-group">
                <label>Método de Pagamento *</label>
                <select
                  className="form-control"
                  value={modalConfirmarAula.metodoPagamento}
                  onChange={(e) =>
                    setModalConfirmarAula({
                      ...modalConfirmarAula,
                      metodoPagamento: e.target.value,
                    })
                  }
                >
                  <option value="Numerário">Numerário (Dinheiro vivo)</option>
                  <option value="MBWay">MBWay</option>
                  <option value="Transferência">Transferência Bancária</option>
                  <option value="Multibanco">Multibanco</option>
                </select>
              </div>
            </div>
            {/* marginTop: "20px" migrado para .modal-actions-footer--mt no CSS */}
            <div className="modal-actions-footer modal-actions-footer--mt">
              <button
                className="btn-text"
                onClick={() =>
                  setModalConfirmarAula({
                    isOpen: false,
                    aula: null,
                    metodoPagamento: "Numerário",
                  })
                }
              >
                Cancelar
              </button>
              <button
                className="btn-gold"
                onClick={() =>
                  validarRealizacao(
                    modalConfirmarAula.aula,
                    modalConfirmarAula.metodoPagamento,
                  )
                }
              >
                Confirmar e Liquidar Fatura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          MODAL DE ALERTA DO SISTEMA (alertaExcl)
          Todos os estilos inline migrados para .modal-alerta-* no CSS.
          ================================================================ */}
      {alertaExcl.isOpen && (
        <div className="modal-alerta-overlay">
          <div className="modal-alerta-box">
            <h3 className="modal-alerta-titulo">Aviso do Sistema</h3>
            <p className="modal-alerta-mensagem">{alertaExcl.message}</p>
            <button
              type="button"
              className="btn-gold modal-alerta-btn"
              onClick={() => setAlertaExcl({ isOpen: false, message: "" })}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
