import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import '../VendaFigurinos/VendaFigurinos.css';
import './AgendarCoaching.css';
import logoImg from '../../assets/logo.png';
import { apiAuthFetch, getAuthToken } from '../../services/api';
import {
  diaSemanaDisponibilidadeParaData,
  diaSemanaPrecoParaData,
  formatarHoraApi,
  formatarHoraMostrar
} from '../../utils/coachingAgendar';
import {
  toYMD,
  segundaDaSemanaDe,
  adicionarDias,
  diasDaSemana,
  formatDiaCurtoPT,
  formatDiaCabecalhoAgenda,
  formatIntervaloSemanaLongoPT,
  formatDataLongaPT,
  nomeDiaSemanaCompletoPT,
  formatDataBarraPT
} from '../../utils/semanaCalendario';
import { isEncarregadoUtilizador as isEncarregado } from '../../utils/perfilUtilizador';
import { podeMostrarValidacaoRealizacao } from '../../utils/coachingInstantes';

const VISTAS = {
  calendario: { menu: 'Calendário e vagas', badge: 'Marcação' },
  alunos: { menu: 'Escolher alunos', badge: 'Alunos' },
  pedidos: { menu: 'Ver pedidos', badge: 'Pedidos' },
  submeter: { menu: 'Submeter pedido', badge: 'Submeter' }
};

/** Linha do tempo do dia: 08h00 → 21h00 (780 min). */
const TL_MIN = 8 * 60;
const TL_MAX = 21 * 60;
const TL_RANGE = TL_MAX - TL_MIN;

function minutosNaLinhaTempo(horaVal) {
  const s = formatarHoraApi(horaVal);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return TL_MIN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function estiloBlocoTimeline(inicioMin, fimMin) {
  let a = Math.max(TL_MIN, Math.min(TL_MAX, inicioMin));
  let b = Math.max(TL_MIN, Math.min(TL_MAX, fimMin));
  if (b <= a) b = Math.min(TL_MAX, a + 45);
  const top = ((a - TL_MIN) / TL_RANGE) * 100;
  const h = ((b - a) / TL_RANGE) * 100;
  return { top: `${top}%`, height: `${Math.max(h, 2.4)}%` };
}

function estiloVagaTimeline(v) {
  return estiloBlocoTimeline(minutosNaLinhaTempo(v.hora_inicio), minutosNaLinhaTempo(v.hora_fim));
}

function estiloPedidoTimeline(p) {
  const a = minutosNaLinhaTempo(p.hora_inicio_pretendida);
  const dur = Number(p.duracao_minutos) > 0 ? Number(p.duracao_minutos) : 60;
  return estiloBlocoTimeline(a, a + dur);
}

/** Texto tipo «09:00–10:00» para cartões na grelha. */
function intervaloPedidoLegivel(p) {
  const a = minutosNaLinhaTempo(p.hora_inicio_pretendida);
  const dur = Number(p.duracao_minutos) > 0 ? Number(p.duracao_minutos) : 60;
  const b = a + dur;
  const fmt = (t) => {
    const h = Math.floor(t / 60) % 24;
    const m = t % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return `${fmt(a)}–${fmt(b)}`;
}

/** Intervalo «HH:MM–HH:MM» a partir de horaSs e duração em minutos. */
function intervaloLegivelHoraDur(horaSs, durMin) {
  const a = minutosNaLinhaTempo(horaSs);
  const dur = Number(durMin) > 0 ? Number(durMin) : 60;
  const b = a + dur;
  const fmt = (t) => {
    const h = Math.floor(t / 60) % 24;
    const m = t % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return `${fmt(a)}–${fmt(b)}`;
}

function horaFimEstimadaDeInicioDur(horaSs, durMin) {
  const a = minutosNaLinhaTempo(horaSs);
  const dur = Number(durMin) > 0 ? Number(durMin) : 60;
  const b = a + dur;
  const h = Math.floor(b / 60) % 24;
  const m = b % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Hora (API HH:mm:ss) a partir do clique vertical na coluna 08h–21h, alinhada a 15 min. */
function horarioDeCliqueNoEixoY(clientY, rectTop, rectHeight) {
  const y = clientY - rectTop;
  const ratio = Math.max(0, Math.min(1, y / rectHeight));
  let minutes = TL_MIN + ratio * TL_RANGE;
  const step = 15;
  minutes = Math.round(minutes / step) * step;
  minutes = Math.max(TL_MIN, Math.min(TL_MAX - 1, minutes));
  const h = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

function horaSsParaInputTime(horaSs) {
  const s = String(horaSs || '').match(/^(\d{2}):(\d{2})/);
  if (!s) return '08:00';
  return `${s[1]}:${s[2]}`;
}

function inputTimeParaHoraSs(v) {
  const m = String(v || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '08:00:00';
  const hh = String(parseInt(m[1], 10)).padStart(2, '0');
  const mm = String(parseInt(m[2], 10)).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

function absDiffMin(horaA, horaB) {
  return Math.abs(minutosNaLinhaTempo(horaA) - minutosNaLinhaTempo(horaB));
}

/** Data vinda da API/SQL (YYYY-MM-DD, ISO ou datetime) → chave YYYY-MM-DD para a grelha. */
function ymdAulaPedido(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return toYMD(d);
  return '';
}

/** Resposta SQL/JSON pode variar no casing dos campos; IDs como número para os checkboxes. */
function normalizarListaAlunosApi(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const id = row.id_aluno ?? row.ID_ALUNO ?? row.idAluno;
      const idAluno = Number(id);
      if (!Number.isFinite(idAluno)) return null;
      const nome =
        row.nome_aluno ?? row.NOME_ALUNO ?? row.nomeAluno ?? row.nome ?? '—';
      return {
        id_aluno: idAluno,
        nome_aluno: nome,
        data_nascimento: row.data_nascimento ?? row.DATA_NASCIMENTO ?? null
      };
    })
    .filter(Boolean);
}

export default function AgendarCoaching({ irParaLanding, irParaVendaFigurinos, irParaEmprestimos }) {
  const [utilizador, setUtilizador] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [semPermissao, setSemPermissao] = useState(true);

  const [modalidades, setModalidades] = useState([]);
  const [anos, setAnos] = useState([]);
  const [professores, setProfessores] = useState([]);
  const [alunos, setAlunos] = useState([]);

  const [idModalidade, setIdModalidade] = useState('');
  const [idAnoLetivo, setIdAnoLetivo] = useState('');
  const [idProfessor, setIdProfessor] = useState('');
  const hojeYmd = useMemo(() => toYMD(new Date()), []);
  const [dataAula, setDataAula] = useState(hojeYmd);
  const [segundaSemana, setSegundaSemana] = useState(() => segundaDaSemanaDe(hojeYmd));
  const [formatoAula, setFormatoAula] = useState('Solo');
  const [duracaoMinutos, setDuracaoMinutos] = useState(60);

  const [vistaInterna, setVistaInterna] = useState('calendario');
  const [menuNavAberto, setMenuNavAberto] = useState(false);
  const navCoachingRef = useRef(null);
  const navMenuLeaveTimerRef = useRef(null);

  const [vagasPorDia, setVagasPorDia] = useState({});
  const [loadingVagas, setLoadingVagas] = useState(false);
  const [erroCarregarVagas, setErroCarregarVagas] = useState('');
  /** Pedidos na grelha: clique minimiza (risco); outro clique no risco repõe. */
  const [pedidosMinimizadosIds, setPedidosMinimizadosIds] = useState([]);
  const [painelMarcacao, setPainelMarcacao] = useState(null);
  const [pedidoDetalheModal, setPedidoDetalheModal] = useState(null);
  /** Clique na grelha vazia: { ymd, horaSs } */
  const [slotPedidoModal, setSlotPedidoModal] = useState(null);
  /**
   * Preferência na grelha após «Aplicar na grelha» no modal do slot.
   * Inclui instantâneo de modalidade / professor / formato / duração do formulário «Dados do pedido».
   */
  const [preferenciaHoraPedido, setPreferenciaHoraPedido] = useState(null);

  const [vagaSelecionada, setVagaSelecionada] = useState(null);
  const vagaSelecionadaRef = useRef(null);
  const [alunosIds, setAlunosIds] = useState([]);
  const [precoEstimado, setPrecoEstimado] = useState(null);

  const [pedidos, setPedidos] = useState([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alerta, setAlerta] = useState({ show: false, message: '' });
  /** Confirmação em ecrã antes de DELETE do pedido pendente */
  const [idPedidoEliminarConfirmacao, setIdPedidoEliminarConfirmacao] = useState(null);

  const mostrarAlerta = (message) => setAlerta({ show: true, message });
  const fecharAlerta = () => setAlerta({ show: false, message: '' });

  const pedidosPorDia = useMemo(() => {
    const map = {};
    for (const p of pedidos) {
      if (p.estado === 'Cancelado') continue;
      const d = ymdAulaPedido(p.data_aula_pretendida);
      if (!d) continue;
      if (!map[d]) map[d] = [];
      map[d].push(p);
    }
    return map;
  }, [pedidos]);

  const diasSem = useMemo(() => diasDaSemana(segundaSemana), [segundaSemana]);

  /** Vista da grelha: estilo agenda (Semana / Dia / saltar Mês). */
  const [vistaGrelhaCal, setVistaGrelhaCal] = useState('semana');
  const [mesAlvoPicker, setMesAlvoPicker] = useState(() => hojeYmd.slice(0, 7));

  useEffect(() => {
    setMesAlvoPicker(segundaSemana.slice(0, 7));
  }, [segundaSemana]);

  const diasSemVisivel = useMemo(() => {
    if (vistaGrelhaCal === 'dia') return [dataAula];
    return diasSem;
  }, [vistaGrelhaCal, dataAula, diasSem]);

  const preferenciaResumo = useMemo(() => {
    if (!preferenciaHoraPedido) return null;
    const durSnap = Number(preferenciaHoraPedido.duracaoMinutosSnap);
    const dur =
      Number.isFinite(durSnap) && durSnap > 0
        ? durSnap
        : Number(duracaoMinutos) > 0
          ? Number(duracaoMinutos)
          : 60;
    const mod =
      preferenciaHoraPedido.modalidadeLabel ||
      modalidades.find((m) => String(m.id_modalidade) === String(idModalidade))?.nome ||
      '—';
    const prof =
      preferenciaHoraPedido.professorLabel ||
      (idProfessor
        ? professores.find((p) => String(p.id_professor) === String(idProfessor))?.nome_professor
        : null) ||
      'Qualquer disponível';
    const formato = preferenciaHoraPedido.formatoLabel || formatoAula || '—';
    return {
      modalidade: mod,
      professor: prof,
      formato,
      dur,
      intervalo: intervaloLegivelHoraDur(preferenciaHoraPedido.horaSs, dur)
    };
  }, [
    preferenciaHoraPedido,
    modalidades,
    idModalidade,
    professores,
    idProfessor,
    formatoAula,
    duracaoMinutos
  ]);

  const abrirMenuNav = () => {
    if (navMenuLeaveTimerRef.current) {
      clearTimeout(navMenuLeaveTimerRef.current);
      navMenuLeaveTimerRef.current = null;
    }
    setMenuNavAberto(true);
  };

  const fecharMenuNavComDelay = () => {
    if (navMenuLeaveTimerRef.current) clearTimeout(navMenuLeaveTimerRef.current);
    navMenuLeaveTimerRef.current = setTimeout(() => {
      setMenuNavAberto(false);
      navMenuLeaveTimerRef.current = null;
    }, 260);
  };

  useEffect(() => {
    if (!menuNavAberto) return;
    const onDown = (e) => {
      if (navCoachingRef.current && !navCoachingRef.current.contains(e.target)) {
        setMenuNavAberto(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuNavAberto]);

  /* eslint-disable react-hooks/set-state-in-effect -- bootstrap de sessão ao montar */
  useEffect(() => {
    const raw = localStorage.getItem('viva_user');
    const token = getAuthToken();
    if (!raw || !token) {
      setSemPermissao(true);
      setAuthChecked(true);
      return;
    }
    const u = JSON.parse(raw);
    setUtilizador(u);
    setSemPermissao(!isEncarregado(u));
    setAuthChecked(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const carregarPedidos = useCallback(async () => {
    if (!authChecked || !getAuthToken() || semPermissao) return;
    setLoadingPedidos(true);
    try {
      const lista = await apiAuthFetch('/api/coaching/pedidos/meus');
      setPedidos(
        Array.isArray(lista)
          ? lista.map((p) => ({
              ...p,
              nome_professor: p.nome_professor ?? p.professor ?? null
            }))
          : []
      );
    } catch {
      setPedidos([]);
    } finally {
      setLoadingPedidos(false);
    }
  }, [semPermissao, authChecked]);

  const validarRealizacaoEE = useCallback(
    async (idCoaching, estadoValidacao) => {
      const observacoes = window.prompt('Observações (opcional):', '') ?? '';
      try {
        await apiAuthFetch(`/api/coaching/${idCoaching}/validar`, {
          method: 'POST',
          body: { estadoValidacao, observacoes: observacoes.trim() || null },
        });
        mostrarAlerta('Validação registada.');
        await carregarPedidos();
      } catch (e) {
        mostrarAlerta(e.message || 'Não foi possível validar.');
      }
    },
    [carregarPedidos]
  );

  useEffect(() => {
    vagaSelecionadaRef.current = vagaSelecionada;
  }, [vagaSelecionada]);

  const escolherVista = useCallback((key) => {
    setVistaInterna(key);
    setMenuNavAberto(false);
    if (key !== 'calendario') setPainelMarcacao(null);
    if (navMenuLeaveTimerRef.current) {
      clearTimeout(navMenuLeaveTimerRef.current);
      navMenuLeaveTimerRef.current = null;
    }
    if (key === 'calendario') void carregarPedidos();
  }, [carregarPedidos]);

  useEffect(() => {
    if (!authChecked || semPermissao || !getAuthToken()) return;

    (async () => {
      const avisos = [];
      let mods = [];
      let ans = [];
      let als = [];

      try {
        const r = await apiAuthFetch('/api/escola/modalidades');
        mods = Array.isArray(r) ? r : [];
      } catch (e) {
        avisos.push(`Modalidades: ${e.message || 'erro'}.`);
      }

      try {
        const r = await apiAuthFetch('/api/escola/anos-letivos');
        ans = Array.isArray(r) ? r : [];
      } catch (e) {
        avisos.push(`Anos letivos: ${e.message || 'erro'}.`);
      }

      try {
        const r = await apiAuthFetch('/api/utilizadores/me/alunos');
        als = normalizarListaAlunosApi(r);
      } catch (e) {
        avisos.push(`Alunos (BD): ${e.message || 'erro'}.`);
      }

      setModalidades(mods);
      setAnos(ans);
      setAlunos(als);
      setIdAnoLetivo((prev) => {
        if (prev) return prev;
        if (ans.length > 0) return String(ans[0].id_ano_letivo);
        return '';
      });

      if (avisos.length > 0) {
        mostrarAlerta(
          avisos.length === 3
            ? 'Não foi possível carregar dados da escola. Verifica sessão, URL da API (VITE_API_URL) e se o servidor está a correr.'
            : `Alguns dados não carregaram: ${avisos.join(' ')}`
        );
      }
    })();
  }, [semPermissao, authChecked]);

  /* eslint-disable react-hooks/set-state-in-effect -- carregar pedidos quando deps mudam */
  useEffect(() => {
    carregarPedidos();
  }, [carregarPedidos]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- lista de professores por modalidade */
  useEffect(() => {
    if (!idModalidade) {
      setProfessores([]);
      setIdProfessor('');
      return;
    }
    (async () => {
      try {
        const profs = await apiAuthFetch(`/api/escola/modalidades/${idModalidade}/professores`);
        setProfessores(Array.isArray(profs) ? profs : []);
      } catch {
        setProfessores([]);
      }
    })();
  }, [idModalidade]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const atualizarPrecoEstimado = useCallback(
    async (vaga, dataParaPreco = dataAula) => {
      if (!vaga || !idModalidade || !dataParaPreco) {
        setPrecoEstimado(null);
        return;
      }
      try {
        const diaPreco = diaSemanaPrecoParaData(dataParaPreco);
        const sp = new URLSearchParams({
          formato: formatoAula,
          duracao: String(duracaoMinutos),
          diaSemana: String(diaPreco),
          idModalidade: String(idModalidade)
        });
        if (vaga.id_professor) sp.set('idProfessor', String(vaga.id_professor));
        const r = await apiAuthFetch(`/api/faturacao/calcular?${sp.toString()}`);
        setPrecoEstimado(r?.preco != null ? Number(r.preco) : null);
      } catch {
        setPrecoEstimado(null);
      }
    },
    [idModalidade, duracaoMinutos, formatoAula, dataAula]
  );

  const carregarVagasSemana = useCallback(async () => {
    if (!idModalidade || !idAnoLetivo) {
      setVagasPorDia({});
      setErroCarregarVagas('');
      setVagaSelecionada(null);
      setPainelMarcacao(null);
      setPrecoEstimado(null);
      return;
    }
    const dias = diasDaSemana(segundaSemana);
    setLoadingVagas(true);
    setErroCarregarVagas('');
    try {
      const entradas = await Promise.all(
        dias.map(async (data) => {
          const diaSem = diaSemanaDisponibilidadeParaData(data);
          const sp = new URLSearchParams({
            idModalidade: String(idModalidade),
            diaSemana: String(diaSem),
            data: String(data),
            duracaoMinutos: String(duracaoMinutos),
            idAnoLetivo: String(idAnoLetivo)
          });
          if (idProfessor) sp.set('idProfessor', String(idProfessor));
          try {
            const lista = await apiAuthFetch(`/api/coaching/vagas?${sp.toString()}`);
            return [data, Array.isArray(lista) ? lista : []];
          } catch {
            return [data, []];
          }
        })
      );
      const map = Object.fromEntries(entradas);
      setVagasPorDia(map);

      /* Ref lido após o mapa: reflete a seleção atual quando a resposta chega (evita apagar vaga escolhida a meio do pedido). */
      const prev = vagaSelecionadaRef.current;
      let restored = null;
      let restoredYmd = null;
      if (prev && prev.disponivel) {
        for (const day of dias) {
          const list = map[day] || [];
          const hit = list.find(
            (v) =>
              v.disponivel &&
              String(v.id_professor) === String(prev.id_professor) &&
              formatarHoraApi(v.hora_inicio) === formatarHoraApi(prev.hora_inicio)
          );
          if (hit) {
            restored = hit;
            restoredYmd = day;
            break;
          }
        }
      }
      if (restored) {
        setVagaSelecionada(restored);
        setPainelMarcacao({ ymd: restoredYmd, vaga: restored });
        void atualizarPrecoEstimado(restored, restoredYmd);
      } else {
        setVagaSelecionada(null);
        setPainelMarcacao(null);
        setPrecoEstimado(null);
      }
    } catch (e) {
      setVagasPorDia({});
      setErroCarregarVagas(e.message || 'Erro ao consultar vagas.');
      setVagaSelecionada(null);
      setPainelMarcacao(null);
      setPrecoEstimado(null);
    } finally {
      setLoadingVagas(false);
    }
  }, [idModalidade, segundaSemana, idAnoLetivo, duracaoMinutos, idProfessor, atualizarPrecoEstimado]);

  useEffect(() => {
    if (!authChecked || semPermissao) return;
    const t = setTimeout(() => {
      carregarVagasSemana();
    }, 300);
    return () => clearTimeout(t);
  }, [carregarVagasSemana, semPermissao, authChecked]);

  useEffect(() => {
    if (!slotPedidoModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSlotPedidoModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slotPedidoModal]);

  const toggleAluno = (id) => {
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    setAlunosIds((prev) => {
      if (prev.some((x) => Number(x) === n)) return prev.filter((x) => Number(x) !== n);
      return [...prev, n];
    });
  };

  /** Checkboxes de alunos reutilizáveis no modal de preferência e no ecrã Submeter. */
  const renderSelecaoAlunosCheckboxes = (idPrefix) => (
    <>
      {alunos.length === 0 ? (
        <p className="sub" style={{ margin: '6px 0 0' }}>
          Nenhum aluno associado à tua conta. Contacta a escola para te ligarem a alunos na base de dados.
        </p>
      ) : (
        <div className="alunos-checks ac-alunos-checks--scrollable" role="group" aria-label="Alunos participantes">
          {alunos.map((a) => {
            const cid = `${idPrefix}-${a.id_aluno}`;
            return (
              <label key={a.id_aluno} htmlFor={cid}>
                <input
                  id={cid}
                  type="checkbox"
                  checked={alunosIds.some((x) => Number(x) === a.id_aluno)}
                  onChange={() => toggleAluno(a.id_aluno)}
                />
                {a.nome_aluno}
              </label>
            );
          })}
        </div>
      )}
    </>
  );

  const handleLogout = () => {
    localStorage.removeItem('viva_user');
    localStorage.removeItem('viva_token');
    setUtilizador(null);
    irParaLanding();
  };

  const escolherDiaCalendario = (ymd) => {
    setDataAula(ymd);
    setSegundaSemana(segundaDaSemanaDe(ymd));
    setPainelMarcacao((p) => (p && p.ymd === ymd ? p : null));
  };

  const semanaAnterior = () => {
    const ns = adicionarDias(segundaSemana, -7);
    const diasNovos = diasDaSemana(ns);
    setSegundaSemana(ns);
    setDataAula((d) => (diasNovos.includes(d) ? d : ns));
  };

  const semanaSeguinte = () => {
    const ns = adicionarDias(segundaSemana, 7);
    const diasNovos = diasDaSemana(ns);
    setSegundaSemana(ns);
    setDataAula((d) => (diasNovos.includes(d) ? d : ns));
  };

  const diaAnteriorCal = () => {
    escolherDiaCalendario(adicionarDias(dataAula, -1));
  };

  const diaSeguinteCal = () => {
    escolherDiaCalendario(adicionarDias(dataAula, 1));
  };

  const irParaHojeCalendario = () => {
    escolherDiaCalendario(toYMD(new Date()));
    setVistaGrelhaCal('semana');
  };

  const irParaMesEscolhido = () => {
    if (!mesAlvoPicker) return;
    const ymd = `${mesAlvoPicker}-01`;
    escolherDiaCalendario(ymd);
    setVistaGrelhaCal('semana');
  };

  const togglePedidoMinimizado = (id) => {
    setPedidosMinimizadosIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const aoEscolherVagaNaSemana = (ymd, v) => {
    if (!v.disponivel) return;
    escolherDiaCalendario(ymd);
    setPreferenciaHoraPedido(null);
    setVagaSelecionada(v);
    setPainelMarcacao({ ymd, vaga: v });
    void atualizarPrecoEstimado(v, ymd);
  };

  const escolherVagaAutomaticaPorPreferencia = useCallback(
    (ymd, horaSs) => {
      const listaDia = (vagasPorDia[ymd] || []).filter((v) => v.disponivel);
      if (listaDia.length === 0) return false;

      // Prioridade: vaga que começa exatamente na hora escolhida; caso não exista, usar a mais próxima.
      const exata = listaDia.find((v) => formatarHoraApi(v.hora_inicio) === formatarHoraApi(horaSs));
      const vagaAuto =
        exata ||
        [...listaDia].sort(
          (a, b) => absDiffMin(a.hora_inicio, horaSs) - absDiffMin(b.hora_inicio, horaSs)
        )[0];

      if (!vagaAuto) return false;
      setVagaSelecionada(vagaAuto);
      setPainelMarcacao({ ymd, vaga: vagaAuto });
      void atualizarPrecoEstimado(vagaAuto, ymd);
      return true;
    },
    [vagasPorDia, atualizarPrecoEstimado]
  );

  const submeterPedido = async (e) => {
    e.preventDefault();
    const semVagaMasComPreferencia =
      (!vagaSelecionada || !vagaSelecionada.disponivel) &&
      preferenciaHoraPedido &&
      preferenciaHoraPedido.ymd === dataAula;
    if ((!vagaSelecionada || !vagaSelecionada.disponivel) && !semVagaMasComPreferencia) {
      mostrarAlerta('Seleciona uma vaga disponível (volta ao calendário) ou aplica uma hora preferida na grelha.');
      setVistaInterna('calendario');
      return;
    }
    if (alunosIds.length === 0) {
      mostrarAlerta('Escolhe pelo menos um aluno.');
      setVistaInterna('alunos');
      return;
    }

    const horaInicio = vagaSelecionada?.hora_inicio
      ? formatarHoraApi(vagaSelecionada.hora_inicio)
      : formatarHoraApi(preferenciaHoraPedido?.horaSs);
    const idProf =
      idProfessor && idProfessor !== ''
        ? parseInt(idProfessor, 10)
        : vagaSelecionada?.id_professor
          ? parseInt(vagaSelecionada.id_professor, 10)
          : null;

    setSubmitting(true);
    try {
      await apiAuthFetch('/api/coaching/pedidos', {
        method: 'POST',
        body: {
          idModalidade: parseInt(idModalidade, 10),
          idProfessor: idProf,
          formatoAula,
          duracaoMinutos: parseInt(duracaoMinutos, 10),
          dataAula,
          horaInicio,
          idAnoLetivo: parseInt(idAnoLetivo, 10),
          alunosIds: alunosIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
        }
      });
      mostrarAlerta('Pedido submetido com sucesso! Aguarda confirmação da coordenação.');
      setVagaSelecionada(null);
      setAlunosIds([]);
      setPrecoEstimado(null);
      carregarPedidos();
      carregarVagasSemana();
      setVistaInterna('pedidos');
    } catch (err) {
      mostrarAlerta(err.message || 'Erro ao submeter pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  const pedirEliminarPedido = (id) => setIdPedidoEliminarConfirmacao(id);

  const fecharConfirmEliminarPedido = () => setIdPedidoEliminarConfirmacao(null);

  const executarEliminarPedidoPendente = async () => {
    const id = idPedidoEliminarConfirmacao;
    if (id == null) return;
    try {
      await apiAuthFetch(`/api/coaching/pedidos/${id}/pendente`, { method: 'DELETE' });
      setIdPedidoEliminarConfirmacao(null);
      carregarPedidos();
      setPedidoDetalheModal((m) => (m && m.pedido.id_pedido_coaching === id ? null : m));
    } catch (err) {
      mostrarAlerta(err.message || 'Não foi possível eliminar o pedido.');
    }
  };

  const renderVistaCalendario = () => {
    return (
    <div className="ac-vista-bloco">
      <section className="coaching-card coaching-cal-card">
        <div className="ac-cal-toolbar">
          <div className="ac-cal-toolbar-left">
            <div className="ac-cal-toolbar-nav">
              <button
                type="button"
                onClick={vistaGrelhaCal === 'dia' ? diaAnteriorCal : semanaAnterior}
                aria-label={vistaGrelhaCal === 'dia' ? 'Dia anterior' : 'Semana anterior'}
              >
                ‹
              </button>
              <button type="button" className="ac-cal-btn-hoje" onClick={irParaHojeCalendario}>
                Hoje
              </button>
              <button
                type="button"
                onClick={vistaGrelhaCal === 'dia' ? diaSeguinteCal : semanaSeguinte}
                aria-label={vistaGrelhaCal === 'dia' ? 'Dia seguinte' : 'Semana seguinte'}
              >
                ›
              </button>
            </div>
          </div>
          <div className="ac-cal-toolbar-centro">
            {vistaGrelhaCal === 'mes' ? (
              <span className="ac-cal-toolbar-titulo">Escolhe o mês</span>
            ) : vistaGrelhaCal === 'dia' ? (
              <span className="ac-cal-toolbar-titulo">{formatDataLongaPT(dataAula)}</span>
            ) : (
              <span className="ac-cal-toolbar-titulo">{formatIntervaloSemanaLongoPT(segundaSemana)}</span>
            )}
          </div>
          <div className="ac-cal-vista-toggle" role="tablist" aria-label="Vista do calendário">
            <button
              type="button"
              role="tab"
              aria-selected={vistaGrelhaCal === 'mes'}
              className={vistaGrelhaCal === 'mes' ? 'ativo' : ''}
              onClick={() => setVistaGrelhaCal('mes')}
            >
              Mês
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vistaGrelhaCal === 'semana'}
              className={vistaGrelhaCal === 'semana' ? 'ativo' : ''}
              onClick={() => setVistaGrelhaCal('semana')}
            >
              Semana
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vistaGrelhaCal === 'dia'}
              className={vistaGrelhaCal === 'dia' ? 'ativo' : ''}
              onClick={() => setVistaGrelhaCal('dia')}
            >
              Dia
            </button>
          </div>
        </div>

        {vistaGrelhaCal === 'mes' && (
          <div className="ac-cal-mes-panel">
            <label htmlFor="ac-cal-mes-input" className="ac-cal-mes-label">
              Ir para
            </label>
            <input
              id="ac-cal-mes-input"
              type="month"
              className="ac-cal-mes-input"
              value={mesAlvoPicker}
              onChange={(e) => setMesAlvoPicker(e.target.value)}
            />
            <button type="button" className="btn-coaching-primary" onClick={irParaMesEscolhido}>
              Ver semana desse mês
            </button>
          </div>
        )}

        {preferenciaHoraPedido && preferenciaResumo && (
          <div className="ac-pref-hora-banner" id="ac-pref-hora-banner" role="status">
            <div className="ac-pref-hora-banner-top">
              <span>
                Preferência na grelha: <strong>{formatDiaCurtoPT(preferenciaHoraPedido.ymd)}</strong> ·{' '}
                <strong>{preferenciaResumo.intervalo}</strong> — escolhe uma <strong>vaga livre</strong> na coluna certa.
              </span>
              <button type="button" className="btn-coaching-secondary" onClick={() => setPreferenciaHoraPedido(null)}>
                Limpar
              </button>
            </div>
            <p className="ac-pref-hora-banner-dados">
              <strong>{preferenciaResumo.modalidade}</strong> · {preferenciaResumo.professor} ·{' '}
              {preferenciaResumo.formato} · {preferenciaResumo.dur} min
            </p>
            <div className="ac-pref-hora-banner-links">
              <button type="button" className="btn-coaching-secondary" onClick={() => escolherVista('pedidos')}>
                Ver os meus pedidos
              </button>
              <button type="button" className="btn-coaching-primary" onClick={() => escolherVista('submeter')}>
                Ir a submeter pedido
              </button>
            </div>
          </div>
        )}

        {vistaGrelhaCal !== 'mes' && (
        <>
        {vistaGrelhaCal === 'dia' && (
          <p className="ac-cal-dia-nome-semana">{nomeDiaSemanaCompletoPT(dataAula)}</p>
        )}
        <div
          className={`cal-semana-board ${vistaGrelhaCal === 'dia' ? 'cal-semana-board--dia' : ''}`}
          id="ac-cal-semana-board"
        >
        <div className={`cal-semana-linha ${vistaGrelhaCal === 'dia' ? 'cal-semana-linha--dia' : ''}`}>
          <div className="cal-semana-eixo" aria-hidden>
            <div className="cal-semana-eixo-canto" />
            <div className="cal-semana-eixo-horas">
              {Array.from({ length: 13 }, (_, i) => 8 + i).map((h) => (
                <div
                  key={h}
                  className="cal-semana-eixo-hora"
                  style={{ top: `${((h * 60 - TL_MIN) / TL_RANGE) * 100}%` }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>
          <div className={`cal-semana-colunas ${vistaGrelhaCal === 'dia' ? 'cal-semana-colunas--dia' : ''}`}>
            {diasSemVisivel.map((ymd) => {
              const ativo = dataAula === ymd;
              const ehHoje = ymd === toYMD(new Date());
              const pedidosDia = pedidosPorDia[ymd] || [];
              const vagasDia = vagasPorDia[ymd] || [];
              const temPreferenciaDia = preferenciaHoraPedido && preferenciaHoraPedido.ymd === ymd;
              const nEventos = pedidosDia.length + vagasDia.length + (temPreferenciaDia ? 1 : 0);
              return (
                <div
                  key={ymd}
                  className={`cal-semana-col ${ativo ? 'cal-semana-col--ativo' : ''} ${ehHoje ? 'cal-semana-col--hoje' : ''}`}
                >
                  <div className="cal-semana-col-headband">
                    <button type="button" className="cal-semana-col-head-main" onClick={() => escolherDiaCalendario(ymd)}>
                      <span className="cal-semana-col-head-prim">{formatDiaCabecalhoAgenda(ymd)}</span>
                      <span className="cal-semana-col-count">
                        {nEventos} {nEventos === 1 ? 'evento' : 'eventos'}
                      </span>
                    </button>
                  </div>
                  <div className="cal-semana-col-canvas">
                    {Array.from({ length: 14 }, (_, i) => 8 + i).map((h) => (
                      <div
                        key={`g-${ymd}-${h}`}
                        className="cal-timeline-grelha"
                        style={{ top: `${((h * 60 - TL_MIN) / TL_RANGE) * 100}%` }}
                      />
                    ))}
                    <button
                      type="button"
                      className="cal-semana-col-hit"
                      aria-label={`Escolher hora em ${formatDiaCurtoPT(ymd)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const canvas = e.currentTarget.closest('.cal-semana-col-canvas');
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const horaSs = horarioDeCliqueNoEixoY(e.clientY, rect.top, rect.height);
                        setSlotPedidoModal({ ymd, horaSs });
                      }}
                    />
                    {pedidosDia.map((p) => {
                      const slug = String(p.estado || '')
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/_/g, '-');
                      const min = pedidosMinimizadosIds.includes(p.id_pedido_coaching);
                      return (
                        <button
                          key={`ped-${ymd}-${p.id_pedido_coaching}`}
                          type="button"
                          className={`cal-tl-bloco cal-week-card cal-week-ped cal-tl-bloco--pedido cal-tl--${slug} ${min ? 'cal-week-ped--min' : ''}`}
                          style={estiloPedidoTimeline(p)}
                          title={`${p.estado} · ${formatarHoraMostrar(p.hora_inicio_pretendida)} — clica para ver detalhes`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPedidoDetalheModal({ pedido: p, ymd });
                          }}
                        >
                          {!min && (
                            <>
                              <span className="cal-week-card-title">{p.modalidade || 'Pedido'}</span>
                              <span className="cal-week-card-time">{intervaloPedidoLegivel(p)}</span>
                            </>
                          )}
                          {min && <span className="cal-week-ped-min-hint" aria-hidden />}
                        </button>
                      );
                    })}
                    {temPreferenciaDia && preferenciaResumo && (
                      <button
                        type="button"
                        className="cal-tl-bloco cal-week-card cal-week-pref"
                        style={estiloBlocoTimeline(
                          minutosNaLinhaTempo(preferenciaHoraPedido.horaSs),
                          minutosNaLinhaTempo(preferenciaHoraPedido.horaSs) + preferenciaResumo.dur
                        )}
                        title={`${preferenciaResumo.modalidade} · ${preferenciaResumo.professor} · ${preferenciaResumo.formato} · ${preferenciaResumo.dur} min — clica para ajustar hora`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlotPedidoModal({
                            ymd: preferenciaHoraPedido.ymd,
                            horaSs: preferenciaHoraPedido.horaSs
                          });
                        }}
                      >
                        <span className="cal-week-card-title">{preferenciaResumo.modalidade}</span>
                        <span className="cal-week-card-time">
                          {preferenciaResumo.intervalo} · {preferenciaResumo.formato} · {preferenciaResumo.dur} min
                        </span>
                        <span className="cal-week-card-prof">{preferenciaResumo.professor}</span>
                      </button>
                    )}
                    {!loadingVagas &&
                      vagasDia.map((v) => {
                        const key = `${ymd}-${v.id_professor}-${formatarHoraApi(v.hora_inicio)}`;
                        const sel =
                          vagaSelecionada &&
                          vagaSelecionada.id_professor === v.id_professor &&
                          formatarHoraApi(vagaSelecionada.hora_inicio) === formatarHoraApi(v.hora_inicio) &&
                          dataAula === ymd;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`cal-tl-bloco cal-week-card cal-week-vaga cal-tl-bloco--vaga ${v.disponivel ? 'livre' : 'ocupada'} ${sel ? 'sel' : ''}`}
                            style={estiloVagaTimeline(v)}
                            disabled={!v.disponivel}
                            onClick={() => aoEscolherVagaNaSemana(ymd, v)}
                            title={`${v.nome_professor} · ${formatarHoraMostrar(v.hora_inicio)}–${formatarHoraMostrar(v.hora_fim)}`}
                          >
                            <span className="cal-week-card-title">{v.nome_professor?.split?.(' ')?.[0] || v.nome_professor}</span>
                            <span className="cal-week-card-time">
                              {formatarHoraMostrar(v.hora_inicio)}–{formatarHoraMostrar(v.hora_fim)}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
        </>
        )}

        {loadingVagas && <p className="sub cal-semana-loading">A carregar vagas da semana…</p>}
        {erroCarregarVagas && !loadingVagas && (
          <p className="sub cal-semana-erro" role="alert">
            {erroCarregarVagas}
          </p>
        )}

        {painelMarcacao && (
          <div className="ac-painel-marcacao" role="region" aria-label="Marcação de aula">
            <p className="ac-painel-marcacao-titulo">Vaga selecionada</p>
            <p className="ac-painel-marcacao-resumo">
              <strong>{formatDiaCurtoPT(painelMarcacao.ymd)}</strong> · {painelMarcacao.vaga.nome_professor} ·{' '}
              {formatarHoraMostrar(painelMarcacao.vaga.hora_inicio)} – {formatarHoraMostrar(painelMarcacao.vaga.hora_fim)}
            </p>
            <div className="ac-painel-marcacao-acoes">
              <button type="button" className="btn-coaching-primary" onClick={() => escolherVista('alunos')}>
                Continuar: escolher alunos
              </button>
              <button type="button" className="btn-coaching-secondary" onClick={() => setPainelMarcacao(null)}>
                Fechar
              </button>
            </div>
          </div>
        )}

      </section>
    </div>
    );
  };

  const renderVistaAlunos = () => (
    <div className="ac-vista-bloco">
      <button type="button" className="ac-voltar-cal" onClick={() => escolherVista('calendario')}>
        ← Voltar ao calendário
      </button>
      <section className="coaching-card">
        <h2>Escolher alunos</h2>
        <p className="sub">Alunos associados à tua conta (vindos da base de dados). Marca quem participa no coaching.</p>
        <p className="sub">
          A <strong>sala</strong> não é escolhida aqui: a coordenação atribui sala e professor ao{' '}
          <strong>aprovar</strong> o pedido.
        </p>
        {renderSelecaoAlunosCheckboxes('ac-vista-aluno')}
      </section>
    </div>
  );

  const renderVistaPedidos = () => (
    <div className="ac-vista-bloco">
      <button type="button" className="ac-voltar-cal" onClick={() => escolherVista('calendario')}>
        ← Voltar ao calendário
      </button>
      <section className="coaching-card">
        <h2>Os meus pedidos</h2>
        {loadingPedidos && <p className="sub">A carregar…</p>}
        {!loadingPedidos && pedidos.length === 0 && <p className="sub">Ainda não tens pedidos.</p>}
        {!loadingPedidos && pedidos.length > 0 && (
          <table className="pedidos-table-compact">
            <thead>
              <tr>
                <th>Ref.</th>
                <th>Data / hora</th>
                <th>Estado</th>
                <th>Modalidade</th>
                <th>Sala / professor (após aprovação)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id_pedido_coaching}>
                  <td>{p.id_pedido_coaching}</td>
                  <td>
                    {p.data_aula_pretendida ? String(p.data_aula_pretendida).split('T')[0] : '—'}
                    <br />
                    <small>{formatarHoraMostrar(p.hora_inicio_pretendida)}</small>
                  </td>
                  <td>{p.estado}</td>
                  <td>{p.modalidade}</td>
                  <td>
                    {p.nome_sala || p.nome_professor_agendado || p.hora_inicio_coaching ? (
                      <span className="ac-pedido-agenda-cell">
                        {p.nome_sala && (
                          <>
                            <strong>Sala:</strong> {p.nome_sala}
                            <br />
                          </>
                        )}
                        {p.hora_inicio_coaching && (
                          <>
                            <strong>Hora confirmada:</strong> {formatarHoraMostrar(p.hora_inicio_coaching)}
                            <br />
                          </>
                        )}
                        {p.nome_professor_agendado && (
                          <>
                            <strong>Professor:</strong> {p.nome_professor_agendado}
                            {p.estado_coaching && (
                              <>
                                <br />
                                <small className="sub">Aula: {p.estado_coaching}</small>
                              </>
                            )}
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="sub">—</span>
                    )}
                  </td>
                  <td>
                    {p.estado === 'Pendente' && (
                      <button
                        type="button"
                        className="btn-coaching-secondary"
                        onClick={() => pedirEliminarPedido(p.id_pedido_coaching)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loadingPedidos && pedidos.some((p) => p.id_coaching && podeMostrarValidacaoRealizacao({
          estado_coaching: p.estado_coaching,
          estado: p.estado_coaching,
          data_aula_coaching: p.data_aula_coaching,
          data_aula: p.data_aula_coaching,
          hora_inicio_coaching: p.hora_inicio_coaching,
          hora_inicio: p.hora_inicio_coaching,
          duracao_minutos: p.duracao_minutos
        })) && (
          <div style={{ marginTop: 28 }}>
            <h3>Confirmar realização da aula (US13)</h3>
            <p className="sub">
              Só após a hora de fim da aula podes indicar se a aula <strong>teve lugar</strong> ou <strong>não foi realizada</strong>.
              A coordenação fecha depois o processo (US14).
            </p>
            <table className="pedidos-table-compact" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Coaching</th>
                  <th>Data / hora</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pedidos
                  .filter((p) =>
                    p.id_coaching &&
                    podeMostrarValidacaoRealizacao({
                      estado_coaching: p.estado_coaching,
                      estado: p.estado_coaching,
                      data_aula_coaching: p.data_aula_coaching,
                      data_aula: p.data_aula_coaching,
                      hora_inicio_coaching: p.hora_inicio_coaching,
                      hora_inicio: p.hora_inicio_coaching,
                      duracao_minutos: p.duracao_minutos
                    })
                  )
                  .map((p) => (
                    <tr key={`val-${p.id_coaching}`}>
                      <td>#{p.id_coaching}</td>
                      <td>
                        {p.data_aula_coaching ? String(p.data_aula_coaching).split('T')[0] : '—'}
                        <br />
                        <small>{formatarHoraMostrar(p.hora_inicio_coaching)}</small>
                      </td>
                      <td>{p.estado_coaching}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-coaching-primary"
                          style={{ marginRight: 8 }}
                          onClick={() => void validarRealizacaoEE(p.id_coaching, 'Confirmado')}
                        >
                          Aula realizada
                        </button>
                        <button
                          type="button"
                          className="btn-coaching-secondary"
                          onClick={() => void validarRealizacaoEE(p.id_coaching, 'Nao_Realizado')}
                        >
                          Não realizada
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  const renderVistaSubmeter = () => (
    <div className="ac-vista-bloco">
      <button type="button" className="ac-voltar-cal" onClick={() => escolherVista('calendario')}>
        ← Voltar ao calendário
      </button>
      <section className="coaching-card">
        <h2>Submeter pedido</h2>
        <div className="resumo-submeter">
          <p>
            <strong>Data:</strong> {dataAula || '—'}
          </p>
          {preferenciaHoraPedido && preferenciaHoraPedido.ymd === dataAula && preferenciaResumo && (
            <p className="sub">
              <strong>Na grelha:</strong> {preferenciaResumo.intervalo} · {preferenciaResumo.modalidade} ·{' '}
              {preferenciaResumo.professor} ({preferenciaResumo.formato}, {preferenciaResumo.dur} min) — no pedido
              final usa a hora da <strong>vaga</strong> que escolheres.
            </p>
          )}
          <p>
            <strong>Vaga:</strong>{' '}
            {vagaSelecionada && vagaSelecionada.disponivel ? (
              <>
                {vagaSelecionada.nome_professor} · {formatarHoraMostrar(vagaSelecionada.hora_inicio)} (
                {formatoAula}, {duracaoMinutos} min)
              </>
            ) : preferenciaHoraPedido && preferenciaHoraPedido.ymd === dataAula ? (
              <span style={{ color: '#2a2724' }}>
                Sem vaga livre agora — vai ser submetido com a hora preferida{' '}
                <strong>{formatarHoraMostrar(preferenciaHoraPedido.horaSs)}</strong> e fica pendente para coordenação.
              </span>
            ) : (
              <span style={{ color: '#8b4513' }}>
                Nenhuma vaga disponível selecionada — volta ao calendário e clica num{' '}
                <strong>cartão de professor</strong> na grelha (vaga livre).
                {preferenciaHoraPedido && (
                  <>
                    {' '}
                    O bloco azul à tracejado é só a <strong>hora preferida</strong>; não substitui a escolha da vaga.
                  </>
                )}
              </span>
            )}
          </p>
          <div className="ac-alunos-selecao-bloco">
            <h3 className="ac-alunos-selecao-titulo">Alunos participantes</h3>
            <p className="sub">
              Obrigatório: marca pelo menos um aluno. A lista vem da base de dados (conta do encarregado).
            </p>
            {alunosIds.length > 0 && (
              <p className="sub" style={{ marginBottom: 8 }}>
                <strong>Selecionados:</strong> {alunosIds.length}
              </p>
            )}
            {renderSelecaoAlunosCheckboxes('ac-submeter-aluno')}
          </div>
          {precoEstimado != null && (
            <p>
              <strong>Custo estimado:</strong> {precoEstimado.toFixed(2)} €
            </p>
          )}
          <p className="sub">
            <strong>Sala:</strong> será definida pela coordenação na aprovação (não faz parte deste formulário).
          </p>
        </div>
        <form onSubmit={submeterPedido}>
          <button type="submit" className="btn-coaching-primary" disabled={submitting}>
            {submitting ? 'A enviar…' : 'Confirmar e submeter'}
          </button>
        </form>

        {loadingPedidos && <p className="sub ac-submeter-pedidos-extra">A carregar pedidos…</p>}
        {!loadingPedidos &&
          pedidos.filter((p) => p.estado === 'Pendente').length > 0 && (
            <div className="ac-submeter-pedidos-extra">
              <h3>Pedidos pendentes</h3>
              <p className="sub">Elimina antes da coordenação aprovar.</p>
              <table className="pedidos-table-compact">
                <thead>
                  <tr>
                    <th>Ref.</th>
                    <th>Data / hora</th>
                    <th>Modalidade</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pedidos
                    .filter((p) => p.estado === 'Pendente')
                    .map((p) => (
                      <tr key={p.id_pedido_coaching}>
                        <td>{p.id_pedido_coaching}</td>
                        <td>
                          {p.data_aula_pretendida ? String(p.data_aula_pretendida).split('T')[0] : '—'}
                          <br />
                          <small>{formatarHoraMostrar(p.hora_inicio_pretendida)}</small>
                        </td>
                        <td>{p.modalidade}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-coaching-secondary"
                            onClick={() => pedirEliminarPedido(p.id_pedido_coaching)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );

  if (!authChecked) {
    return (
      <div className="page-wrapper">
        <div className="coaching-main-area">
          <p>A verificar sessão…</p>
        </div>
      </div>
    );
  }

  if (semPermissao) {
    return (
      <div className="page-wrapper">
        <nav className="navbar">
          <div className="nav-brand">
            <img src={logoImg} alt="" className="nav-logo-img" />
            <span>VIVA D'ARTE</span>
          </div>
          <ul className="nav-menu">
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); irParaLanding(); }}>Início</a>
            </li>
          </ul>
        </nav>
        <div className="coaching-main-area">
          <div className="aviso">
            Esta área é para <strong>Encarregados de Educação</strong>. Inicia sessão com esse perfil para agendar
            coaching.
          </div>
        </div>
      </div>
    );
  }

  const menuOpcoesJsx = (ulClass) => (
    <ul className={ulClass} role="menu">
      {Object.entries(VISTAS).map(([key, { menu }]) => (
        <li key={key} role="none">
          <button
            type="button"
            role="menuitem"
            className={vistaInterna === key ? 'ativo' : ''}
            onClick={() => escolherVista(key)}
          >
            {menu}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page-wrapper page-agendar-coaching">
      {alerta.show && (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={fecharAlerta}
        >
          <div
            className="coaching-card"
            style={{ maxWidth: 400, cursor: 'default' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ marginTop: 0 }}>{alerta.message}</p>
            <button type="button" className="btn-coaching-primary" onClick={fecharAlerta}>
              OK
            </button>
          </div>
        </div>
      )}

      {idPedidoEliminarConfirmacao != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ac-eliminar-pedido-titulo"
          className="ac-modal-overlay ac-modal-overlay--confirm-eliminar"
          onClick={fecharConfirmEliminarPedido}
        >
          <div className="coaching-card ac-modal-pedido ac-modal-confirm-eliminar-card" onClick={(e) => e.stopPropagation()}>
            <h3 id="ac-eliminar-pedido-titulo" className="ac-modal-pedido-titulo">
              Eliminar pedido?
            </h3>
            <p className="sub" style={{ marginTop: 0 }}>
              Tens a certeza de que queres <strong>eliminar</strong> o pedido{' '}
              <strong>#{idPedidoEliminarConfirmacao}</strong>? Só é possível enquanto está <strong>pendente</strong>.
            </p>
            <div className="ac-modal-pedido-acoes">
              <button type="button" className="btn-coaching-secondary" onClick={fecharConfirmEliminarPedido}>
                Não, manter
              </button>
              <button type="button" className="btn-coaching-primary" onClick={() => void executarEliminarPedidoPendente()}>
                Sim, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {pedidoDetalheModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ac-pedido-modal-titulo"
          className="ac-modal-overlay"
          onClick={() => setPedidoDetalheModal(null)}
        >
          <div className="coaching-card ac-modal-pedido" onClick={(e) => e.stopPropagation()}>
            <h3 id="ac-pedido-modal-titulo" className="ac-modal-pedido-titulo">
              Pedido #{pedidoDetalheModal.pedido.id_pedido_coaching}
            </h3>
            <dl className="ac-modal-pedido-dl">
              <dt>Estado</dt>
              <dd>{pedidoDetalheModal.pedido.estado || '—'}</dd>
              <dt>Dia</dt>
              <dd>
                {formatDiaCurtoPT(pedidoDetalheModal.ymd)}{' '}
                <span className="ac-modal-pedido-ymd">({pedidoDetalheModal.ymd})</span>
              </dd>
              <dt>Hora pretendida</dt>
              <dd>{formatarHoraMostrar(pedidoDetalheModal.pedido.hora_inicio_pretendida)}</dd>
              {pedidoDetalheModal.pedido.duracao_minutos != null && (
                <>
                  <dt>Duração</dt>
                  <dd>{pedidoDetalheModal.pedido.duracao_minutos} min</dd>
                </>
              )}
              {pedidoDetalheModal.pedido.formato_aula && (
                <>
                  <dt>Formato</dt>
                  <dd>{pedidoDetalheModal.pedido.formato_aula}</dd>
                </>
              )}
              {pedidoDetalheModal.pedido.modalidade && (
                <>
                  <dt>Modalidade</dt>
                  <dd>{pedidoDetalheModal.pedido.modalidade}</dd>
                </>
              )}
              {pedidoDetalheModal.pedido.nome_professor && (
                <>
                  <dt>Professor</dt>
                  <dd>{pedidoDetalheModal.pedido.nome_professor}</dd>
                </>
              )}
              {pedidoDetalheModal.pedido.nome_professor_agendado &&
                String(pedidoDetalheModal.pedido.nome_professor_agendado).trim() !==
                  String(pedidoDetalheModal.pedido.nome_professor || '').trim() && (
                  <>
                    <dt>Professor (após aprovação)</dt>
                    <dd>{pedidoDetalheModal.pedido.nome_professor_agendado}</dd>
                  </>
                )}
              {pedidoDetalheModal.pedido.nome_sala && (
                <>
                  <dt>Sala</dt>
                  <dd>{pedidoDetalheModal.pedido.nome_sala}</dd>
                </>
              )}
              {pedidoDetalheModal.pedido.hora_inicio_coaching && (
                <>
                  <dt>Hora confirmada (agendamento)</dt>
                  <dd>{formatarHoraMostrar(pedidoDetalheModal.pedido.hora_inicio_coaching)}</dd>
                </>
              )}
              {pedidoDetalheModal.pedido.estado_coaching && (
                <>
                  <dt>Estado da aula</dt>
                  <dd>{pedidoDetalheModal.pedido.estado_coaching}</dd>
                </>
              )}
              {pedidoDetalheModal.pedido.custo_estimado != null &&
                pedidoDetalheModal.pedido.custo_estimado !== '' &&
                Number.isFinite(Number(pedidoDetalheModal.pedido.custo_estimado)) && (
                  <>
                    <dt>Custo estimado</dt>
                    <dd>{Number(pedidoDetalheModal.pedido.custo_estimado).toFixed(2)} €</dd>
                  </>
                )}
            </dl>
            <div className="ac-modal-pedido-acoes">
              {pedidoDetalheModal.pedido.estado === 'Pendente' && (
                <button
                  type="button"
                  className="btn-coaching-secondary"
                  onClick={() => pedirEliminarPedido(pedidoDetalheModal.pedido.id_pedido_coaching)}
                >
                  Eliminar pedido
                </button>
              )}
              <button
                type="button"
                className="btn-coaching-secondary"
                onClick={() => {
                  togglePedidoMinimizado(pedidoDetalheModal.pedido.id_pedido_coaching);
                  setPedidoDetalheModal(null);
                }}
              >
                Ocultar na grelha
              </button>
              <button type="button" className="btn-coaching-primary" onClick={() => setPedidoDetalheModal(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {slotPedidoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ac-slot-modal-titulo"
          className="ac-modal-overlay ac-modal-overlay--slot"
          onClick={() => setSlotPedidoModal(null)}
        >
          <div className="ac-modal-atividade" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ac-modal-atividade-close"
              aria-label="Fechar"
              onClick={() => setSlotPedidoModal(null)}
            >
              ×
            </button>
            <h3 id="ac-slot-modal-titulo" className="ac-modal-atividade-titulo">
              Preferência de horário
            </h3>
            <p className="ac-modal-atividade-sub">
              Define aqui os dados do pedido e a hora pretendida. Depois, aplica na grelha para procurar uma vaga.
            </p>
            <div className="ac-modal-atividade-form">
              <div className="ac-modal-atividade-row ac-modal-atividade-row--2">
                <div className="ac-modal-atividade-field">
                  <label htmlFor="ac-modalidade">
                    Modalidade <span className="ac-modal-atividade-req" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="ac-modalidade"
                    className="ac-modal-atividade-input"
                    value={idModalidade}
                    onChange={(e) => setIdModalidade(e.target.value)}
                  >
                    <option value="">Selecionar</option>
                    {modalidades.map((m) => (
                      <option key={m.id_modalidade} value={m.id_modalidade}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ac-modal-atividade-field">
                  <label htmlFor="ac-ano">
                    Ano letivo <span className="ac-modal-atividade-req" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="ac-ano"
                    className="ac-modal-atividade-input"
                    value={idAnoLetivo}
                    onChange={(e) => setIdAnoLetivo(e.target.value)}
                  >
                    <option value="">Selecionar</option>
                    {anos.map((a) => (
                      <option key={a.id_ano_letivo} value={a.id_ano_letivo}>
                        {a.ano}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ac-modal-atividade-field">
                  <label htmlFor="ac-prof">Professor</label>
                  <select
                    id="ac-prof"
                    className="ac-modal-atividade-input"
                    value={idProfessor}
                    onChange={(e) => setIdProfessor(e.target.value)}
                    disabled={!idModalidade}
                  >
                    <option value="">Qualquer disponível</option>
                    {professores.map((p) => (
                      <option key={p.id_professor} value={p.id_professor}>
                        {p.nome_professor}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ac-modal-atividade-field">
                  <label htmlFor="ac-formato">
                    Formato <span className="ac-modal-atividade-req" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="ac-formato"
                    className="ac-modal-atividade-input"
                    value={formatoAula}
                    onChange={(e) => setFormatoAula(e.target.value)}
                  >
                    {['Solo', 'Dueto', 'Trio', 'Ensemble'].map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ac-modal-atividade-field">
                  <label htmlFor="ac-dur">
                    Duração <span className="ac-modal-atividade-req" aria-hidden="true">*</span>
                  </label>
                  <select
                    id="ac-dur"
                    className="ac-modal-atividade-input"
                    value={duracaoMinutos}
                    onChange={(e) => setDuracaoMinutos(parseInt(e.target.value, 10))}
                  >
                    {[30, 60, 90, 120].map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ac-modal-atividade-row ac-modal-atividade-row--3">
                <div className="ac-modal-atividade-field">
                  <label htmlFor="ac-slot-data">
                    Data <span className="ac-modal-atividade-req" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ac-slot-data"
                    type="text"
                    readOnly
                    className="ac-modal-atividade-input ac-modal-atividade-input--readonly"
                    value={formatDataBarraPT(slotPedidoModal.ymd)}
                  />
                </div>
                <div className="ac-modal-atividade-field">
                  <label htmlFor="ac-slot-hora">
                    Hora de início <span className="ac-modal-atividade-req" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ac-slot-hora"
                    type="time"
                    step={300}
                    className="ac-modal-atividade-input"
                    value={horaSsParaInputTime(slotPedidoModal.horaSs)}
                    onChange={(e) =>
                      setSlotPedidoModal((m) => (m ? { ...m, horaSs: inputTimeParaHoraSs(e.target.value) } : null))
                    }
                  />
                </div>
                <div className="ac-modal-atividade-field">
                  <label htmlFor="ac-slot-hora-fim">Hora de fim (estimada)</label>
                  <input
                    id="ac-slot-hora-fim"
                    type="text"
                    readOnly
                    className="ac-modal-atividade-input ac-modal-atividade-input--readonly"
                    title="Com base na duração definida nos dados do pedido"
                    value={horaFimEstimadaDeInicioDur(
                      slotPedidoModal.horaSs,
                      Number(duracaoMinutos) > 0 ? Number(duracaoMinutos) : 60
                    )}
                  />
                </div>
              </div>
              {idModalidade && !idProfessor && (
                <p className="ac-modal-atividade-hint">
                  «Qualquer disponível» mostra vagas de <strong>todos</strong> os professores desta modalidade.
                </p>
              )}
              <p className="ac-modal-atividade-hint">
                Duração usada: <strong>{Number(duracaoMinutos) > 0 ? Number(duracaoMinutos) : 60} min</strong>.
              </p>
              <div className="ac-alunos-selecao-bloco ac-alunos-selecao-bloco--modal">
                <p className="ac-alunos-selecao-titulo">
                  Alunos participantes <span className="ac-modal-atividade-req" aria-hidden="true">*</span>
                </p>
                <p className="ac-modal-atividade-hint" style={{ marginTop: 0 }}>
                  Marca quem vai a esta aula de coaching (podes alterar mais tarde no ecrã «Submeter pedido»).
                </p>
                {renderSelecaoAlunosCheckboxes('ac-slot-aluno')}
              </div>
            </div>
            <div className="ac-modal-atividade-footer">
              <button type="button" className="ac-modal-atividade-btn-texto" onClick={() => setSlotPedidoModal(null)}>
                Fechar
              </button>
              <button
                type="button"
                className="ac-modal-atividade-btn-guardar"
                onClick={() => {
                  const { ymd, horaSs } = slotPedidoModal;
                  const mod = modalidades.find((m) => String(m.id_modalidade) === String(idModalidade));
                  const prof = idProfessor
                    ? professores.find((p) => String(p.id_professor) === String(idProfessor))
                    : null;
                  const durSnap = Number(duracaoMinutos) > 0 ? Number(duracaoMinutos) : 60;
                  escolherDiaCalendario(ymd);
                  setPreferenciaHoraPedido({
                    ymd,
                    horaSs,
                    modalidadeLabel: (mod?.nome && String(mod.nome).trim()) || '—',
                    professorLabel:
                      (prof?.nome_professor && String(prof.nome_professor).trim()) ||
                      (!idProfessor || idProfessor === '' ? 'Qualquer disponível' : '—'),
                    formatoLabel: formatoAula || '—',
                    duracaoMinutosSnap: durSnap
                  });
                  const okAuto = escolherVagaAutomaticaPorPreferencia(ymd, horaSs);
                  if (!okAuto) {
                    setVagaSelecionada(null);
                    setPainelMarcacao(null);
                    setPrecoEstimado(null);
                  }
                  setSlotPedidoModal(null);
                  escolherVista('calendario');
                  const irParaPreferencia = () => {
                    document
                      .getElementById('ac-pref-hora-banner')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  };
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      irParaPreferencia();
                      window.setTimeout(irParaPreferencia, 120);
                    });
                  });
                }}
              >
                Aplicar na grelha
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="navbar">
        <div className="nav-brand">
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>
        <ul className="nav-menu">
          <li>
            <a href="#" onClick={(e) => { e.preventDefault(); irParaLanding(); }}>Início</a>
          </li>
          <li>
            <span className="nav-separator">|</span>
          </li>
          <li
            ref={navCoachingRef}
            className="nav-dd-coaching"
            onMouseEnter={abrirMenuNav}
            onMouseLeave={fecharMenuNavComDelay}
          >
            <div className="nav-dd-coaching-inner">
              <span className="special-link active">Agendar Coaching</span>
              <button
                type="button"
                className={`nav-dd-caret ${menuNavAberto ? 'aberto' : ''}`}
                aria-expanded={menuNavAberto}
                aria-haspopup="true"
                aria-label="Menu Agendar coaching"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuNavAberto((m) => !m);
                }}
              >
                ▾
              </button>
            </div>
            {menuNavAberto && menuOpcoesJsx('nav-dd-menu')}
          </li>
          <li>
            <a href="#" className="special-link" onClick={(e) => { e.preventDefault(); irParaEmprestimos(); }}>
              Empréstimos de peças
            </a>
          </li>
          <li>
            <a href="#" className="special-link" onClick={(e) => { e.preventDefault(); irParaVendaFigurinos(); }}>
              Venda de figurinos
            </a>
          </li>
        </ul>
        <div className="nav-actions">
          {utilizador && (
            <div className="user-profile">
              <span className="welcome-text">
                Olá, <strong>{utilizador.nome}</strong>
              </span>
              <button type="button" className="btn-logout" onClick={handleLogout}>
                Sair
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="coaching-layout">
        <main className="coaching-main-area">
          <header className="ac-page-header">
            <div className="ac-title-row">
              <h1>Agendar coaching</h1>
              <span className="ac-vista-badge">{VISTAS[vistaInterna]?.badge}</span>
            </div>
          </header>

          {vistaInterna === 'calendario' && renderVistaCalendario()}
          {vistaInterna === 'alunos' && renderVistaAlunos()}
          {vistaInterna === 'pedidos' && renderVistaPedidos()}
          {vistaInterna === 'submeter' && renderVistaSubmeter()}
        </main>
      </div>
    </div>
  );
}
