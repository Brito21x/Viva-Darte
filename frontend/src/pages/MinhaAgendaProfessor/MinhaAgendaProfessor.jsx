import React, { useEffect, useMemo, useState } from "react";
import "./MinhaAgendaProfessor.css";
import logoImg from "../../assets/logo.png";
import { apiAuthFetch } from "../../services/api";

const FORMATOS_AULA = ["Solo", "Dueto", "Trio", "Ensemble"];
const DURACOES_AULA = [30, 60, 90, 120];

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
const ANOS = [2025, 2026, 2027, 2028];

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

function formatHoraCurta(valor) {
  const s = String(valor || "").trim();
  if (!s) return "";
  const m = s.match(/(\d{2}):(\d{2})(?::\d{2})?/);
  if (m) return `${m[1]}:${m[2]}`;
  return "";
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatYMD(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

function horaParaSlot(horaInicio) {
  const hhmm = formatHoraCurta(horaInicio);
  if (!hhmm) return null;
  const hh = hhmm.slice(0, 2);
  return `${hh}:00`;
}

function parseTimeToMinutes(hhmmss) {
  const hhmm = formatHoraCurta(hhmmss);
  if (!hhmm) return null;
  const hh = parseInt(hhmm.slice(0, 2), 10);
  const mm = parseInt(hhmm.slice(3, 5), 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function minutesToHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function formatIntervalo(horaInicio, duracaoMinutos) {
  const start = parseTimeToMinutes(horaInicio);
  const dur = Number(duracaoMinutos || 0);
  if (start == null || !Number.isFinite(dur)) return String(horaInicio || "");
  return `${minutesToHHMM(start)} - ${minutesToHHMM(start + dur)}`;
}

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

function formatDM(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function normalizeTime(hhmm) {
  const hora = formatHoraCurta(hhmm);
  if (!hora) return String(hhmm || "").trim();
  return `${hora}:00`;
}

export default function MinhaAgendaProfessor({
  irParaLanding,
  irParaEmprestimos,
  irParaVendaFigurinos,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
  modo = "professor",
}) {
  const [agenda, setAgenda] = useState([]);
  const [pedidosPendentesProf, setPedidosPendentesProf] = useState([]);
  const [utilizador, setUtilizador] = useState(null);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [erroAgenda, setErroAgenda] = useState("");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  // ESTADO DO PAINEL DO PROFESSOR
  const [isProfMenuOpen, setIsProfMenuOpen] = useState(false);

  const [disponibilidades, setDisponibilidades] = useState([]);
  const [isLoadingDispo, setIsLoadingDispo] = useState(false);
  const [erroDispo, setErroDispo] = useState("");
  const [isDispoModalOpen, setIsDispoModalOpen] = useState(false);
  const [novoDiaSemana, setNovoDiaSemana] = useState(1);
  const [novoHoraInicio, setNovoHoraInicio] = useState("14:00");
  const [novoHoraFim, setNovoHoraFim] = useState("19:00");
  const [isSavingDispo, setIsSavingDispo] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedAnoLetivoId, setSelectedAnoLetivoId] = useState("");
  const [isDetalhesModalOpen, setIsDetalhesModalOpen] = useState(false);

  const [globalToast, setGlobalToast] = useState(null);

  const [alertModal, setAlertModal] = useState({ isOpen: false, mensagem: "" });

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

  // --- Constantes derivadas do estado ---
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
  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  // --- Memos derivados ---
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

  const isAgendaEE = modo === "ee" || isPerfilEE;
  const podePedirAula = isAgendaEE;

  // --- Helpers ---
  function mostrarToast(texto, tipo = "sucesso") {
    setGlobalToast({ texto, tipo });
    setTimeout(() => setGlobalToast(null), 5000);
  }

  // --- Efeitos ---
  useEffect(() => {
    document.title = "Minha agenda | Viva D'arte";
  }, []);

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

        // --- PREENCHE OS FILTROS LOGO AQUI ---
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

  async function carregarAgendaSemana() {
    setIsLoadingAgenda(true);
    setErroAgenda("");
    const dataInicio = formatYMD(weekStart);
    const dataFim = formatYMD(addDays(weekStart, 6));

    try {
      if (isAgendaEE) {
        const meusPedidos = await apiAuthFetch(
          `/api/coaching/pedidos/meus?dataInicio=${dataInicio}&dataFim=${dataFim}`,
        );
        setPedidosPendentesProf(Array.isArray(meusPedidos) ? meusPedidos : []);
        setAgenda([]);
      } else {
        const [dataAgenda, dataPedidos] = await Promise.all([
          apiAuthFetch(
            `/api/coaching/agenda?dataInicio=${dataInicio}&dataFim=${dataFim}`,
          ),
          apiAuthFetch(
            `/api/coaching/pedidos/atribuidos-professor?dataInicio=${dataInicio}&dataFim=${dataFim}`,
          ).catch(() => []),
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
    let isMounted = true;
    carregarAgendaSemana();
    return () => {
      isMounted = false;
    };
  }, [weekStart, isAgendaEE, utilizador]);

  const resumoMensal = useMemo(() => {
    const aulasDadasNoPeriodo = agenda.filter((a) => {
      // 1. A aula tem de estar realizada
      if (a.estado !== "Realizado") return false;

      // 2. Tem de pertencer ao Ano Letivo selecionado
      // (Nota: Garantir que a API envia o campo id_ano_letivo ou ANO_LETIVOid_ano_letivo na agenda)
      const idAnoAula = a.id_ano_letivo || a.ANO_LETIVOid_ano_letivo;
      if (String(idAnoAula) !== String(selectedAnoLetivoId)) return false;

      // 3. Tem de pertencer ao mês selecionado
      const dataAula = parseDataCalendario(a.data_aula);
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

  const agendaPorDiaHora = useMemo(() => {
    const map = new Map();
    const addEvent = (key, event) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    };

    // Intervalo da semana visível
    const semanaInicio = weekStart;
    const semanaFim = addDays(weekStart, 6);

    function dentroSemana(dataStr) {
      const d = parseDataCalendario(dataStr);
      if (!d) return false;
      return d >= semanaInicio && d <= semanaFim;
    }

    // 1. Lógica inteligente para o nome da disciplina no slot livre
    const labelModalidade =
      minhasModalidades.length === 1
        ? minhasModalidades[0].modalidade
        : minhasModalidades.length > 1
          ? "Várias Disciplinas"
          : "Disponível";

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
        const k = `${diaName}|${horaSlot}`;
        addEvent(k, {
          origem: "disponibilidade",
          id_disponibilidade: d.id_disponibilidade,
          modalidade: labelModalidade, // <--- Aqui removemos o "Ballet" fixo!
          nome_professor: utilizador?.nome || "Professor",
          hora_inicio: horaSlot,
          duracao_minutos: 60,
          formato_aula: "Livre para marcação",
          estado: "Livre",
        });
      }
    }

    for (const row of agenda) {
      const diaKey = diaSemanaAbrevData(row.data_aula);
      const horaSlot = horaParaSlot(row.hora_inicio);
      if (!diaKey || !horaSlot) continue;
      addEvent(`${diaKey}|${horaSlot}`, { ...row, origem: "coaching" });
    }

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
          alunos: p.alunos || p.nome_aluno, // <-- ADICIONA ESTA LINHA AQUI
          estado: isAgendado ? p.estado_coaching : p.estado,
          sala: p.nome_sala,
          nome_professor: isAgendado ? p.nome_professor_agendado : p.professor,
        });
      } else {
        const est = String(p.estado || "").toLowerCase();
        if (est !== "pendente") continue;

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
            alunos: p.alunos || p.nome_aluno, // <-- ADICIONA ESTA LINHA AQUI TAMBÉM
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

  // AULAS POR CONFIRMAR A EXECUÇÃO (AGENDADAS OU CONFIRMADAS)
  const aulasParaValidar = useMemo(() => {
    return agenda.filter(
      (a) => a.estado === "Agendado" || a.estado === "Confirmado",
    );
  }, [agenda]);

  // PRÓXIMAS AULAS MARCADAS (EXCLUI AS QUE O PROFESSOR JÁ CONFIRMOU)
  const proximasAulas = useMemo(() => {
    const agora = new Date();
    return agenda.filter((a) => {
      // Exclui estados que já saíram do fluxo de marcação ativa para o professor
      if (
        a.estado === "Cancelado" ||
        a.estado === "Rejeitado" ||
        a.estado === "Realizado" ||
        a.estado === "Nao_Realizado" ||
        a.estado === "Concluido"
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

  // NOVA LISTA: AULAS QUE O PROFESSOR JÁ CONFIRMOU, À ESPERA DA COORDENAÇÃO
  const aulasAguardandoCoordenacao = useMemo(() => {
    return pedidosPendentesProf
      .filter((p) => p.estado === "Pendente")
      .map((p) => ({
        ...p,
        isPedido: true,
        tipoItem: "APROVACAO",
        data_aula: p.data_aula_pretendida,
        hora_inicio: p.hora_inicio_pretendida,
        nome_sala: "A definir pela coordenação",
      }));
  }, [pedidosPendentesProf]);

  const irParaHoje = () => setWeekStart(getMonday(new Date()));
  const irParaSemanaAnterior = () => setWeekStart((d) => addDays(d, -7));
  const irParaSemanaSeguinte = () => setWeekStart((d) => addDays(d, 7));

  const semanaLabel = useMemo(() => {
    const inicio = weekStart;
    const fim = addDays(weekStart, 6);
    return `${formatDM(inicio)} — ${formatDM(fim)}`;
  }, [weekStart]);

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

  const validarRealizacao = async (row) => {
    if (!row?.id_coaching) return;
    try {
      await apiAuthFetch(`/api/coaching/${row.id_coaching}/validar`, {
        method: "POST",
        body: { estadoValidacao: "Confirmado", observacoes: null },
      });

      // Mensagem atualizada para dar feedback de que saiu da lista de tarefas
      setAlertModal({
        isOpen: true,
        mensagem:
          "Realização da aula validada! A aula foi enviada para a coordenação.",
      });

      carregarAgendaSemana();
    } catch (e) {
      setAlertModal({
        isOpen: true,
        mensagem: e?.message || "Não foi possível validar esta aula.",
      });
    }
  };

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
      ) {
        setPedidoForm((prev) => ({ ...prev, idProfessor: "" }));
      }
    } catch {
      setProfessoresPedido([]);
      setPedidoForm((p) => ({ ...p, idProfessor: "" }));
    }
  };

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

  const handleLogout = () => {
    localStorage.removeItem("viva_user");
    localStorage.removeItem("viva_token");
    localStorage.removeItem("token");
    if (irParaLanding) irParaLanding();
    window.location.reload();
  };

  return (
    <div className="dashboard-container">
      {globalToast && (
        <div className={`global-toast global-toast--${globalToast.tipo}`}>
          <span className="toast-icon">
            {globalToast.tipo === "sucesso" ? "✅" : "❌"}
          </span>
          {globalToast.texto}
        </div>
      )}

      <nav className="navbar interna">
        <div className="nav-brand" onClick={irParaLanding}>
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>
        <ul className="nav-menu">
          <li>
            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault();
                irParaLanding?.();
              }}
            >
              Início
            </a>
          </li>
          <li className="nav-separator">|</li>
          <li>
            <a
              href="#agenda"
              className="special-link active"
              onClick={(e) => {
                e.preventDefault();
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
              Minha agenda
            </a>
          </li>
          <li>
            <a
              href="#emprestimos"
              onClick={(e) => {
                e.preventDefault();
                irParaEmprestimos?.();
              }}
            >
              Empréstimos de peças
            </a>
          </li>
          <li>
            <a
              href="#figurinos"
              onClick={(e) => {
                e.preventDefault();
                irParaVendaFigurinos?.();
              }}
            >
              Venda de figurinos
            </a>
          </li>
        </ul>
        <div className="nav-actions">
          <div className="user-profile">
            <span className="welcome-text">
              Olá, <strong>{utilizador?.nome || ""}</strong>
            </span>
            <button className="btn-logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-wrapper" id="agenda">
        <main className="calendar-container">
          {/* BARRA DE NAVEGAÇÃO DA SEMANA */}
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

          {/* CABEÇALHO COM OS DIAS DA SEMANA E DATAS */}
          <div className="calendar-days-sticky">
            <div className="time-corner"></div>
            {dias.map((dia, idx) => {
              // Calcula a data exata para cada coluna somando os dias à segunda-feira atual
              const dataDoDia = addDays(weekStart, idx);

              return (
                <div key={dia} className="day-sticky-cell">
                  <span className="day-label-name">{dia}</span>
                  <span className="day-label-date">{formatDM(dataDoDia)}</span>
                </div>
              );
            })}
          </div>

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
                                style={{ cursor: "help" }}
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

                          if (row.origem === "pedido_pendente") {
                            const isRejeitado =
                              String(row.estado).toLowerCase() === "rejeitado";
                            return (
                              <div
                                key={`pend-${rIdx}`}
                                className={`event-block ${classeModalidade} ${isRejeitado ? "rejeitado-block" : "pendente-coordenacao"}`}
                                onClick={(e) => e.stopPropagation()}
                                title={
                                  isRejeitado
                                    ? "Este pedido foi rejeitado"
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
                                      : "A aguardar..."}
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
                                      Aluno(s): {row.alunos || row.encarregado}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          }

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
        </main>

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
                  <label>Professor</label> {/* Removido o "(Opcional)" */}
                  <select
                    className="form-control"
                    value={pedidoForm.idProfessor}
                    required // Adicionado atributo de validação
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

              <div className="form-group">
                <label>Selecionar Alunos da Minha Conta</label>
                {isLoadingAlunosPedido ? (
                  <div className="form-control loading-alunos">
                    A carregar alunos...
                  </div>
                ) : alunosPedido.length === 0 ? (
                  <div className="empty-dispo warning-alunos">
                    <strong>Aviso:</strong> Não tens educandos associados à tua
                    conta.
                    <br />
                    Não é possível requisitar coaching.
                  </div>
                ) : (
                  <>
                    <select
                      className="form-control student-multi-select"
                      multiple
                      value={(pedidoForm.alunosIds || []).map(String)}
                      onChange={(e) => {
                        const selected = Array.from(
                          e.target.selectedOptions,
                        ).map((o) => Number(o.value));
                        setPedidoForm((p) => ({ ...p, alunosIds: selected }));
                      }}
                    >
                      {alunosPedido.map((a) => (
                        <option key={a.id_aluno} value={a.id_aluno}>
                          {a.nome_aluno}
                        </option>
                      ))}
                    </select>
                  </>
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

        {/* ALERTA MODAL (SUCESSO OU ERRO) */}
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

        <aside className="sidebar">
          {/* ORDENAÇÃO PARA O PROFESSOR */}
          {!isAgendaEE && (
            <>
              {/* 1. PAINEL DE ATIVIDADE */}
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

                <button
                  className="btn-gold btn-gold-full"
                  onClick={() => setIsProfMenuOpen(true)}
                >
                  Abrir Painel do Professor
                </button>
              </div>

              {/* 2. MINHA DISPONIBILIDADE */}
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

          {/* ORDENAÇÃO PARA O EE */}
          {isAgendaEE && (
            <>
              {/* 1. INFORMAÇÃO */}
              <div className="sidebar-card info-card">
                <h3>Informação</h3>
                <p>
                  Para requisitar o seu coaching, por favor clique no quadrado
                  do horário pretendido na agenda.
                </p>
              </div>

              {/* 3. OS MEUS PEDIDOS */}
              <div className="sidebar-card">
                <div className="sidebar-header-flex">
                  <h3 className="m-0">Os Meus Pedidos</h3>
                </div>
                <div
                  className="dispo-list-hud"
                  className="dispo-list-hud dispo-list-hud--tall"
                >
                  {pedidosPendentesProf.length === 0 ? (
                    <div className="empty-dispo">
                      Ainda não tem pedidos de coaching.
                    </div>
                  ) : (
                    pedidosPendentesProf.map((p) => {
                      let badgeClass = "pendente";
                      let badgeText = "Pendente";

                      if (p.estado === "Aprovado") {
                        badgeClass = "aprovado";
                        badgeText = p.estado_coaching || "Agendado";
                        if (badgeText === "Cancelado") badgeClass = "rejeitado";
                      } else if (
                        p.estado === "Rejeitado" ||
                        p.estado === "Cancelado"
                      ) {
                        badgeClass = "rejeitado";
                        badgeText = p.estado;
                      }

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
                          className="pedido-item-simples"
                        >
                          <div className="pedido-simples-info">
                            <strong>{p.modalidade}</strong> ({p.formato_aula})
                            <br />
                            <span className="pedido-date-text">
                              {formatDM(diaReal)} às {formatHoraCurta(horaReal)}
                            </span>
                          </div>
                          <span className={`badge-simples badge-${badgeClass}`}>
                            {badgeText}
                          </span>
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

      {/* MODAL: GERIR DISPONIBILIDADE */}
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

              {/* Aviso Automático de Modalidades */}
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

      {/* MODAL: PAINEL DE ATIVIDADE DO PROFESSOR */}
      {isProfMenuOpen && (
        <div className="modal-overlay" onClick={() => setIsProfMenuOpen(false)}>
          <div
            className="modal-modern modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Painel de Atividade</h2>
              <p>O teu centro de operações da Viva D'arte</p>
            </div>

            <div className="prof-dashboard-grid">
              {/* COLUNA ESQUERDA: RESUMO E VALIDAÇÕES */}
              <div className="prof-dashboard-col">
                {/* SECÇÃO 1: RESUMO FINANCEIRO COM FILTROS */}
                <div className="prof-panel-section">
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
                      {/* Seletor de Mês (Design Moderno) */}
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

                      {/* Seletor de Ano Letivo (Design Moderno) */}
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

                {/* SECÇÃO 2: CONFIRMAR EXECUÇÃO (O código que perguntaste entra aqui) */}
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
                          onClick={() => validarRealizacao(aula)}
                        >
                          Confirmar a Execução da aula
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* FINAL DA COLUNA ESQUERDA */}

              {/* COLUNA DIREITA: PRÓXIMAS AULAS E AGUARDANDO COORDENAÇÃO */}
              <div className="prof-dashboard-col">
                {/* PRÓXIMAS MARCAÇÕES */}
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

                {/* À ESPERA DA COORDENAÇÃO */}
                <div className="prof-panel-section prof-panel-section--mt">
                  <h3>
                    <svg
                      viewBox="0 0 24 24"
                      className="section-icon"
                      className="section-icon section-icon--warning"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    À Espera da Coordenação
                  </h3>

                  {aulasAguardandoCoordenacao.length === 0 ? (
                    <div className="empty-state-text">
                      Nada pendente com a coordenação.
                    </div>
                  ) : (
                    aulasAguardandoCoordenacao.map((item, idx) => (
                      <div
                        key={idx}
                        className="aula-item-modern aula-item-modern--pending-ee"
                      >
                        <div className="aula-item-header">
                          <span className="aula-item-title">
                            {item.modalidade} ({item.formato_aula})
                          </span>
                        </div>
                        <div className="aula-item-details">
                          <div>
                            {formatDM(item.data_aula)} às{" "}
                            {formatHoraCurta(item.hora_inicio)}
                          </div>
                        </div>
                        <div className="pending-warning-text">
                          ⚠️ Novo Pedido: A aguardar aprovação da coordenação...
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Modal de Detalhes de Faturação */}
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

      <footer className="main-footer">
        <div className="footer-container">
          <div className="footer-column">
            <h3>Contacto</h3>
            <ul className="footer-info">
              <li>
                <span>📍</span> Rua das Artes, nº 123, Braga
              </li>
              <li>
                <span>📞</span> +351 000 000 000
              </li>
              <li>
                <span>✉️</span> geral@vivadarte.pt
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
    </div>
  );
}
