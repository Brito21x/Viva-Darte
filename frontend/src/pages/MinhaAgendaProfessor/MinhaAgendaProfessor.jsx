import React, { useEffect, useMemo, useState } from "react";
import "./MinhaAgendaProfessor.css";
import logoImg from "../../assets/logo.png";
import { apiAuthFetch } from "../../services/api";

const FORMATOS_AULA = ["Solo", "Dueto", "Trio", "Ensemble"];
const DURACOES_AULA = [30, 60, 90, 120];
const PARTICIPANTES_FIXOS_POR_FORMATO = { Solo: 1, Dueto: 2, Trio: 3 };

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

function nomeDiaSemana(diaSemana) {
  const map = {
    1: "Segunda-feira",
    2: "Terça-feira",
    3: "Quarta-feira",
    4: "Quinta-feira",
    5: "Sexta-feira",
    6: "Sábado",
    7: "Domingo",
  };
  return map[Number(diaSemana)] || `Dia ${diaSemana}`;
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
  const s = String(modalidade || "").toLowerCase();
  if (s.includes("ballet")) return "ballet";
  if (s.includes("jazz")) return "jazz";
  if (s.includes("acrobat")) return "acrobatica";
  if (s.includes("acrodance")) return "acrodance";
  if (s.includes("hip hop") || s.includes("hiphop")) return "hiphop";
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

  const [disponibilidades, setDisponibilidades] = useState([]);
  const [isLoadingDispo, setIsLoadingDispo] = useState(false);
  const [erroDispo, setErroDispo] = useState("");
  const [isDispoModalOpen, setIsDispoModalOpen] = useState(false);
  const [novoDiaSemana, setNovoDiaSemana] = useState(1);
  const [novoHoraInicio, setNovoHoraInicio] = useState("14:00");
  const [novoHoraFim, setNovoHoraFim] = useState("19:00");
  const [isSavingDispo, setIsSavingDispo] = useState(false);

  // Estados Globais de Notificação
  const [globalToast, setGlobalToast] = useState(null);

  // Novo Estado para a janela central tipo "Imagem 1" de Sucesso
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
    numeroParticipantes: 1,
    idProfessor: "",
  });

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
  const modalidades = [
    { nome: "Ballet", classe: "ballet" },
    { nome: "Jazz", classe: "jazz" },
    { nome: "Acrodance", classe: "acrodance" },
    { nome: "Acrobática", classe: "acrobatica" },
    { nome: "Hip Hop", classe: "hiphop" },
    { nome: "Contemporâneo", classe: "contemporaneo" },
  ];

  function mostrarToast(texto, tipo = "sucesso") {
    setGlobalToast({ texto, tipo });
    setTimeout(() => setGlobalToast(null), 5000);
  }

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

  // Carregar Modais e Anos Letivos
  useEffect(() => {
    if (!utilizador) return; // Proteção extra
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

  // Carregar Alunos do EE
  useEffect(() => {
    if (!utilizador) return; // Evita disparar pedidos antes de ler o token
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

  // Carregar Disponibilidades (Só se for Professor)
  useEffect(() => {
    if (!utilizador) return; // Impede o erro 403 de ser disparado no primeiro render!
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

  // Carregar Agenda Global (Se EE, carrega os seus pedidos todos)
  async function carregarAgendaSemana() {
    setIsLoadingAgenda(true);
    setErroAgenda("");
    const dataInicio = formatYMD(weekStart);
    const dataFim = formatYMD(addDays(weekStart, 6));

    try {
      if (isAgendaEE) {
        const meusPedidos = await apiAuthFetch("/api/coaching/pedidos/meus");
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
    const total = agenda.reduce(
      (acc, row) => acc + Number(row.valor_final || 0),
      0,
    );
    return { aulasDadas: agenda.length, aReceber: total };
  }, [agenda]);

  const agendaPorDiaHora = useMemo(() => {
    const map = new Map();
    const addEvent = (key, event) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    };

    // 1. Disponibilidades do Professor (apenas na vista Prof)
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
          modalidade: d.modalidade || "Ballet",
          nome_professor: utilizador?.nome || "Professor",
          hora_inicio: horaSlot,
          duracao_minutos: 60,
          formato_aula: "Disponível",
          estado: "Livre",
        });
      }
    }

    // 2. Aulas Confirmadas (Professores)
    for (const row of agenda) {
      const diaKey = diaSemanaAbrevData(row.data_aula);
      const horaSlot = horaParaSlot(row.hora_inicio);
      if (!diaKey || !horaSlot) continue;
      addEvent(`${diaKey}|${horaSlot}`, { ...row, origem: "coaching" });
    }

    // 3. Integração de Pedidos e Aulas Confirmadas para o Encarregado (EE) e Profs
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
          estado: isAgendado ? p.estado_coaching : p.estado,
          sala: p.nome_sala,
          nome_professor: isAgendado ? p.nome_professor_agendado : p.professor,
        });
      } else {
        const est = String(p.estado || "").toLowerCase();
        if (est !== "pendente") continue;

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
            estado: p.estado,
            sala: null,
            id_coaching: null,
          });
        }
      }
    }
    return map;
  }, [agenda, pedidosPendentesProf, disponibilidades, utilizador]);

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
      setIsDispoModalOpen(false);
      mostrarToast("Horário adicionado com sucesso!", "sucesso");
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
      mostrarToast("Realização da aula validada!", "sucesso");
      carregarAgendaSemana();
    } catch (e) {
      alert(e?.message || "Não foi possível validar esta aula.");
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

    // Limpar estados de erro antes de abrir o modal
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
      numeroParticipantes: 1,
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
    const participantesFixos = PARTICIPANTES_FIXOS_POR_FORMATO[formatoAula];
    setPedidoForm((p) => ({
      ...p,
      numeroParticipantes:
        participantesFixos || Math.max(Number(p.numeroParticipantes || 4), 4),
    }));
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
    const participantesFixos = PARTICIPANTES_FIXOS_POR_FORMATO[formatoAtual];
    if (
      isPerfilEE &&
      participantesFixos &&
      alunosIds.length !== participantesFixos
    ) {
      setPedidoErro(
        `O formato ${formatoAtual} exige exatamente ${participantesFixos} aluno(s).`,
      );
      return;
    }
    if (isPerfilEE && formatoAtual === "Ensemble" && alunosIds.length < 4) {
      setPedidoErro("O formato Ensemble exige 4 ou mais alunos.");
      return;
    }

    setIsSubmittingPedido(true);
    try {
      await apiAuthFetch("/api/coaching/pedidos", {
        method: "POST",
        body: {
          idModalidade: Number(pedidoForm.idModalidade),
          idProfessor: pedidoForm.idProfessor
            ? Number(pedidoForm.idProfessor)
            : undefined,
          formatoAula: precoInfo.formatoAula || "Solo",
          duracaoMinutos: Number(precoInfo.duracaoMinutos || 60),
          dataAula: precoInfo.dataAula,
          horaInicio: normalizeTime(precoInfo.horaInicio),
          idAnoLetivo: Number(pedidoForm.idAnoLetivo),
          alunosIds,
          numeroParticipantes: Number(pedidoForm.numeroParticipantes || 1),
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
              Empréstimos
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
              Figurinos
            </a>
          </li>
        </ul>
        <div className="nav-actions">
          <div className="user-profile">
            <span className="welcome-text">
              Olá, <strong>{utilizador?.nome?.split(" ")[0] || ""}</strong>
            </span>
            <button className="btn-logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </nav>

      <div className="dashboard-wrapper" id="agenda">
        <main className="calendar-container">
          <div className="calendar-days-sticky">
            <div className="time-corner"></div>
            {dias.map((dia) => (
              <div key={dia} className="day-sticky-cell">
                {dia}
              </div>
            ))}
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
                            return (
                              <div
                                key={`disp-${rIdx}`}
                                className={`event-block ${classeModalidade} disponibilidade-block`}
                                onClick={(e) => e.stopPropagation()}
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
                                    className="event-label"
                                    style={
                                      isRejeitado
                                        ? { backgroundColor: "#d9534f" }
                                        : {}
                                    }
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
                                      EE: {row.encarregado}
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
                                    : `EE: ${row.encarregado}`}
                                </p>
                              </div>
                              {pendente && (
                                <button
                                  type="button"
                                  className="btn-validar-mini"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    validarRealizacao(row);
                                  }}
                                >
                                  Validar Realização
                                </button>
                              )}
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
                    <span style={{ fontSize: "1.2rem", color: "#b38b59" }}>
                      A calcular...
                    </span>
                  ) : precoInfo.erro ? (
                    <span
                      style={{
                        color: "#d9534f",
                        fontSize: "1rem",
                        fontWeight: 700,
                      }}
                    >
                      Indisponível
                    </span>
                  ) : (
                    <>
                      <span className="price-tag">
                        {precoInfo.custoEstimado != null
                          ? `${Number(precoInfo.custoEstimado).toFixed(2)}`
                          : "—"}
                      </span>
                      <span style={{ marginLeft: 4 }}>EUR</span>
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
                  <label>
                    Professor{" "}
                    <span style={{ textTransform: "none", fontWeight: 500 }}>
                      (Opcional)
                    </span>
                  </label>
                  <select
                    className="form-control"
                    value={pedidoForm.idProfessor}
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
                    <option value="">Qualquer Professor</option>
                    {professoresPedido.map((prof) => (
                      <option key={prof.id_professor} value={prof.id_professor}>
                        {prof.nome_professor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
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
                  <div
                    className="form-control"
                    style={{
                      textAlign: "center",
                      padding: "20px",
                      color: "#888",
                    }}
                  >
                    A carregar alunos...
                  </div>
                ) : alunosPedido.length === 0 ? (
                  <div
                    className="empty-dispo"
                    style={{
                      padding: "15px",
                      color: "#d9534f",
                      backgroundColor: "#fff0f0",
                      border: "1px dashed #d9534f",
                    }}
                  >
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
                    alunosPedido.length === 0
                  }
                  onClick={submeterPedidoCoachingDireto}
                >
                  {isSubmittingPedido ? "A processar..." : "Confirmar Pedido"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ALERTA MODAL (SUCESSO) */}
        {alertModal.isOpen && (
          <div
            className="modal-overlay"
            style={{ zIndex: 9999 }}
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
          <div className="sidebar-card">
            <h3 style={{ margin: 0 }}>Navegação</h3>
            <p
              style={{
                margin: "8px 0 16px",
                opacity: 0.75,
                fontSize: "0.85rem",
              }}
            >
              {semanaLabel}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-today"
                style={{ flex: 1 }}
                type="button"
                onClick={irParaSemanaAnterior}
              >
                ←
              </button>
              <button
                className="btn-today"
                style={{ flex: 2 }}
                type="button"
                onClick={irParaHoje}
              >
                Hoje
              </button>
              <button
                className="btn-today"
                style={{ flex: 1 }}
                type="button"
                onClick={irParaSemanaSeguinte}
              >
                →
              </button>
            </div>
          </div>

          {!isAgendaEE && (
            <>
              <div className="sidebar-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ margin: 0, color: "#2a2724" }}>Meus Horários</h3>
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
                  className="btn-outline"
                  style={{ width: "100%", marginTop: 14 }}
                  type="button"
                  onClick={() => setIsDispoModalOpen(true)}
                >
                  Gerir Disponibilidades
                </button>
              </div>

              <div className="sidebar-card resumo-card">
                <h3
                  style={{
                    margin: 0,
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    paddingBottom: 10,
                  }}
                >
                  Resumo de{" "}
                  {new Date(weekStart).toLocaleString("pt-PT", {
                    month: "long",
                  })}
                </h3>
                <div className="stat-row">
                  <span>Aulas Confirmadas:</span>
                  <strong>{resumoMensal.aulasDadas}</strong>
                </div>
                <div className="stat-row highlight">
                  <span>A Receber Estimado:</span>
                  <strong>{resumoMensal.aReceber.toFixed(2)}€</strong>
                </div>
              </div>
            </>
          )}

          <div className="sidebar-card">
            <div className="modalidade-legend">
              <h4>Legenda</h4>
              {modalidades.map((m) => (
                <div key={m.nome} className="legend-item">
                  <span className={`color-dot ${m.classe}`}></span>
                  {m.nome}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {globalToast && (
        <div className={`global-toast global-toast--${globalToast.tipo}`}>
          {globalToast.tipo === "sucesso" ? "✅" : "❌"} {globalToast.texto}
        </div>
      )}

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
            </div>

            {!!erroDispo && <div className="modal-error-msg">{erroDispo}</div>}

            <div className="dispo-form-grid">
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
