import React, { useEffect, useMemo, useState } from 'react';
import './MinhaAgendaProfessor.css';
import logoImg from '../../assets/logo.png';
import { apiAuthFetch } from '../../services/api';

function traduzErroCoaching(err, fallback) {
  const msg = String(err?.message || '').trim();
  if (!msg) return fallback;
  const low = msg.toLowerCase();
  if (
    low.includes('fora da disponibilidade') ||
    low.includes('não tem disponibilidade') ||
    low.includes('nao tem disponibilidade')
  ) {
    return 'O professor não tem horário disponível nesse período.';
  }
  if (low.includes('ocorreu um erro interno') || low.includes('erro interno')) {
    return 'Não foi possível concluir. Verifica se o professor tem disponibilidade nesse horário.';
  }
  return msg;
}

function formatHoraCurta(valor) {
  const s = String(valor || '').trim();
  if (!s) return '';
  const m = s.match(/(\d{2}):(\d{2})(?::\d{2})?/);
  if (m) return `${m[1]}:${m[2]}`;
  return '';
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
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function diaSemanaAbrev(dataAula) {
  const d = new Date(dataAula);
  if (Number.isNaN(d.getTime())) return null;
  const js = d.getDay();
  const map = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 0: 'Dom' };
  return map[js] || null;
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
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function formatIntervalo(horaInicio, duracaoMinutos) {
  const start = parseTimeToMinutes(horaInicio);
  const dur = Number(duracaoMinutos || 0);
  if (start == null || !Number.isFinite(dur)) return String(horaInicio || '');
  return `${minutesToHHMM(start)} - ${minutesToHHMM(start + dur)}`;
}

function coachingJaTerminou(dataAula, horaInicio, duracaoMinutos) {
  const d = new Date(dataAula);
  if (Number.isNaN(d.getTime())) return false;
  const mins = parseTimeToMinutes(horaInicio);
  if (mins == null) return false;
  d.setHours(0, 0, 0, 0);
  const fim = new Date(d.getTime() + (mins + Number(duracaoMinutos || 0)) * 60000);
  return fim.getTime() <= Date.now();
}

function modalidadeParaClasse(modalidade) {
  const s = String(modalidade || '').toLowerCase();
  if (s.includes('ballet')) return 'ballet';
  if (s.includes('jazz')) return 'jazz';
  if (s.includes('acrobat')) return 'acrobatica';
  if (s.includes('acrodance')) return 'acrodance';
  return 'ballet';
}

function formatDM(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function nomeDiaSemana(diaSemana) {
  if (Number(diaSemana) === 1) return 'Seg-Sex';
  if (Number(diaSemana) === 2) return 'Sáb-Dom';
  return `Dia ${diaSemana}`;
}

function normalizeTime(hhmm) {
  const hora = formatHoraCurta(hhmm);
  if (!hora) return String(hhmm || '').trim();
  return `${hora}:00`;
}

export default function MinhaAgendaProfessor({ irParaLanding }) {
  const [agenda, setAgenda] = useState([]);
  const [utilizador, setUtilizador] = useState(null);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [erroAgenda, setErroAgenda] = useState('');
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [disponibilidades, setDisponibilidades] = useState([]);
  const [isLoadingDispo, setIsLoadingDispo] = useState(false);
  const [erroDispo, setErroDispo] = useState('');
  const [isDispoModalOpen, setIsDispoModalOpen] = useState(false);
  const [novoDiaSemana, setNovoDiaSemana] = useState(1);
  const [novoHoraInicio, setNovoHoraInicio] = useState('14:00');
  const [novoHoraFim, setNovoHoraFim] = useState('19:00');
  const [isSavingDispo, setIsSavingDispo] = useState(false);
  const [isPrecoModalOpen, setIsPrecoModalOpen] = useState(false);
  const [precoInfo, setPrecoInfo] = useState({
    isLoading: false,
    erro: '',
    dataAula: '',
    horaInicio: '',
    formatoAula: 'Solo',
    duracaoMinutos: 60,
    custoEstimado: null
  });
  const [pedidoHint, setPedidoHint] = useState('');
  const [pedidoErro, setPedidoErro] = useState('');
  const [pedidoSucesso, setPedidoSucesso] = useState('');
  const [pedidoIdCriado, setPedidoIdCriado] = useState(null);
  const [isSubmittingPedido, setIsSubmittingPedido] = useState(false);
  const [modalidadesPedido, setModalidadesPedido] = useState([]);
  const [anosLetivosPedido, setAnosLetivosPedido] = useState([]);
  const [professoresPedido, setProfessoresPedido] = useState([]);
  const [alunosPedido, setAlunosPedido] = useState([]);
  const [isLoadingAlunosPedido, setIsLoadingAlunosPedido] = useState(false);
  const [pedidoForm, setPedidoForm] = useState({
    idModalidade: '',
    idAnoLetivo: '',
    alunosIds: [],
    numeroParticipantes: 1,
    idProfessor: ''
  });
  const isPerfilEE = useMemo(() => {
    const perfis = utilizador?.perfis;
    if (!Array.isArray(perfis)) return false;
    return perfis.some((p) => {
      if (typeof p === 'string') return p.toLowerCase().includes('ee') || p.toLowerCase().includes('encarregado');
      const nome = String(p?.nome || p?.perfil || '').toLowerCase();
      return nome.includes('ee') || nome.includes('encarregado');
    });
  }, [utilizador]);
  const horas = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
    "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];
  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const modalidades = [
    { nome: 'Ballet', classe: 'ballet' },
    { nome: 'Jazz', classe: 'jazz' },
    { nome: 'Acrodance', classe: 'acrodance' },
    { nome: 'Acrobática', classe: 'acrobatica' }
  ];

  useEffect(() => {
    const userRaw = localStorage.getItem('viva_user');
    if (!userRaw) {
      setUtilizador(null);
      return;
    }
    try {
      setUtilizador(JSON.parse(userRaw));
    } catch {
      localStorage.removeItem('viva_user');
      setUtilizador(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function carregarDadosPedido() {
      try {
        const [mods, anos] = await Promise.all([
          apiAuthFetch('/api/escola/modalidades'),
          apiAuthFetch('/api/escola/anos-letivos')
        ]);
        if (!active) return;
        setModalidadesPedido(Array.isArray(mods) ? mods : []);
        setAnosLetivosPedido(Array.isArray(anos) ? anos : []);
      } catch {
        if (!active) return;
        setModalidadesPedido([]);
        setAnosLetivosPedido([]);
      }
    }
    carregarDadosPedido();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function carregarAlunosPedido() {
      setIsLoadingAlunosPedido(true);
      try {
        const lista = await apiAuthFetch('/api/utilizadores/me/alunos');
        if (!active) return;
        setAlunosPedido(Array.isArray(lista) ? lista : []);
      } catch {
        if (!active) return;
        setAlunosPedido([]);
      } finally {
        if (active) setIsLoadingAlunosPedido(false);
      }
    }
    carregarAlunosPedido();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function carregarDisponibilidades() {
      setErroDispo('');
      setIsLoadingDispo(true);
      try {
        const data = await apiAuthFetch('/api/coaching/disponibilidades');
        if (!isMounted) return;
        setDisponibilidades(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!isMounted) return;
        setDisponibilidades([]);
        setErroDispo(e?.message || 'Erro ao carregar disponibilidades');
      } finally {
        if (isMounted) setIsLoadingDispo(false);
      }
    }
    carregarDisponibilidades();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function carregarAgendaSemana() {
      setErroAgenda('');
      setIsLoadingAgenda(true);
      try {
        const dataInicio = formatYMD(weekStart);
        const dataFim = formatYMD(addDays(weekStart, 6)); // Seg..Dom

        const data = await apiAuthFetch(`/api/coaching/agenda?dataInicio=${dataInicio}&dataFim=${dataFim}`);
        if (!isMounted) return;
        setAgenda(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!isMounted) return;
        setAgenda([]);
        setErroAgenda(e?.message || 'Erro ao carregar agenda');
      } finally {
        if (isMounted) setIsLoadingAgenda(false);
      }
    }

    carregarAgendaSemana();
    return () => { isMounted = false; };
  }, [weekStart]);

  const resumoMensal = useMemo(() => {
    const total = agenda.reduce((acc, row) => acc + Number(row.valor_final || 0), 0);
    return {
      aulasDadas: agenda.length,
      aReceber: total,
    };
  }, [agenda]);

  const agendaPorDiaHora = useMemo(() => {
    /** key: `${DIA}|${HORA}` */
    const map = new Map();
    for (const row of agenda) {
      const diaKey = diaSemanaAbrev(row.data_aula);
      const horaSlot = horaParaSlot(row.hora_inicio);
      if (!diaKey || !horaSlot) continue;
      map.set(`${diaKey}|${horaSlot}`, row);
    }
    return map;
  }, [agenda]);

  const irParaHoje = () => setWeekStart(getMonday(new Date()));
  const irParaSemanaAnterior = () => setWeekStart((d) => addDays(d, -7));
  const irParaSemanaSeguinte = () => setWeekStart((d) => addDays(d, 7));

  const semanaLabel = useMemo(() => {
    const inicio = weekStart;
    const fim = addDays(weekStart, 6);
    return `${formatDM(inicio)} — ${formatDM(fim)}`;
  }, [weekStart]);

  const guardarDisponibilidade = async () => {
    setErroDispo('');
    setIsSavingDispo(true);
    try {
      await apiAuthFetch('/api/coaching/disponibilidades', {
        method: 'POST',
        body: {
          diaSemana: Number(novoDiaSemana),
          horaInicio: normalizeTime(novoHoraInicio),
          horaFim: normalizeTime(novoHoraFim)
        }
      });
      const data = await apiAuthFetch('/api/coaching/disponibilidades');
      setDisponibilidades(Array.isArray(data) ? data : []);
    } catch (e) {
      setErroDispo(e?.message || 'Erro ao guardar disponibilidade');
    } finally {
      setIsSavingDispo(false);
    }
  };

  const removerDisponibilidade = async (id) => {
    if (!id) return;
    setErroDispo('');
    try {
      await apiAuthFetch(`/api/coaching/disponibilidades/${id}`, { method: 'DELETE' });
      setDisponibilidades((prev) => prev.filter((r) => r.id_disponibilidade !== id));
    } catch (e) {
      setErroDispo(e?.message || 'Erro ao remover disponibilidade');
    }
  };

  const validarRealizacao = async (row) => {
    if (!row?.id_coaching) return;
    try {
      await apiAuthFetch(`/api/coaching/${row.id_coaching}/validar`, {
        method: 'POST',
        body: { estadoValidacao: 'Confirmado', observacoes: null }
      });

      // refresh
      const dataInicio = formatYMD(weekStart);
      const dataFim = formatYMD(addDays(weekStart, 6));
      const data = await apiAuthFetch(`/api/coaching/agenda?dataInicio=${dataInicio}&dataFim=${dataFim}`);
      setAgenda(Array.isArray(data) ? data : []);
    } catch (e) {
      alert(e?.message || 'Não foi possível validar esta aula.');
    }
  };

  const verPrecoEstimado = async ({ dataAulaYmd, horaInicio }) => {
    setPrecoInfo((p) => ({
      ...p,
      isLoading: true,
      erro: '',
      dataAula: dataAulaYmd,
      horaInicio,
      custoEstimado: null
    }));
    setPedidoHint('');
    setPedidoErro('');
    setPedidoSucesso('');
    setPedidoIdCriado(null);
    setPedidoForm({
      idModalidade: '',
      idAnoLetivo: '',
      alunosIds: [],
      numeroParticipantes: 1,
      idProfessor: ''
    });
    setProfessoresPedido([]);
    setIsPrecoModalOpen(true);
    try {
      // Validar conflitos antes de pedir preço (US08)
      const qLivre = new URLSearchParams({
        dataAula: dataAulaYmd,
        horaInicio,
        duracaoMinutos: '60'
      }).toString();
      await apiAuthFetch(`/api/coaching/slot-livre?${qLivre}`);

      const q = new URLSearchParams({
        dataAula: dataAulaYmd,
        horaInicio,
        formatoAula: 'Solo',
        duracaoMinutos: '60'
      }).toString();
      const data = await apiAuthFetch(`/api/coaching/preco-estimado?${q}`);
      setPrecoInfo((p) => ({
        ...p,
        isLoading: false,
        custoEstimado: data?.custoEstimado ?? null,
        formatoAula: data?.formatoAula || 'Solo',
        duracaoMinutos: Number(data?.duracaoMinutos || 60)
      }));
    } catch (e) {
      setPrecoInfo((p) => ({
        ...p,
        isLoading: false,
        erro: traduzErroCoaching(e, 'Não foi possível obter o preço estimado.')
      }));
    }
  };

  const carregarProfessoresPorModalidade = async (idModalidade) => {
    if (!idModalidade) {
      setProfessoresPedido([]);
      setPedidoForm((p) => ({ ...p, idProfessor: '' }));
      return;
    }
    try {
      const lista = await apiAuthFetch(`/api/escola/modalidades/${idModalidade}/professores`);
      const arr = Array.isArray(lista) ? lista : [];
      setProfessoresPedido(arr);
      if (!arr.some((p) => String(p.id_professor) === String(pedidoForm.idProfessor))) {
        setPedidoForm((prev) => ({ ...prev, idProfessor: '' }));
      }
    } catch {
      setProfessoresPedido([]);
      setPedidoForm((p) => ({ ...p, idProfessor: '' }));
    }
  };

  const submeterPedidoCoachingDireto = async () => {
    setPedidoErro('');
    setPedidoSucesso('');
    setPedidoIdCriado(null);
    const alunosIds = (pedidoForm.alunosIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);

    if (!pedidoForm.idModalidade || !pedidoForm.idAnoLetivo) {
      setPedidoErro('Preenche modalidade e ano letivo.');
      return;
    }

    if (isPerfilEE && alunosIds.length === 0) {
      setPedidoErro('Seleciona pelo menos 1 aluno.');
      return;
    }

    setIsSubmittingPedido(true);
    try {
      const res = await apiAuthFetch('/api/coaching/pedidos', {
        method: 'POST',
        body: {
          idModalidade: Number(pedidoForm.idModalidade),
          idProfessor: pedidoForm.idProfessor ? Number(pedidoForm.idProfessor) : undefined,
          formatoAula: precoInfo.formatoAula || 'Solo',
          duracaoMinutos: Number(precoInfo.duracaoMinutos || 60),
          dataAula: precoInfo.dataAula,
          horaInicio: normalizeTime(precoInfo.horaInicio),
          idAnoLetivo: Number(pedidoForm.idAnoLetivo),
          alunosIds,
          numeroParticipantes: Number(pedidoForm.numeroParticipantes || 1)
        }
      });
      const novoId = res?.idPedido ?? null;
      setPedidoIdCriado(novoId);
      setPedidoSucesso(novoId ? `Pedido #${novoId} enviado para coordenação com sucesso.` : 'Pedido enviado para coordenação com sucesso.');
    } catch (e) {
      setPedidoErro(traduzErroCoaching(e, 'Não foi possível submeter o pedido.'));
    } finally {
      setIsSubmittingPedido(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('viva_user');
    localStorage.removeItem('viva_token');
    localStorage.removeItem('token');
    if (irParaLanding) irParaLanding();
    window.location.reload();
  };

  return (
    <div className="dashboard-container">
      <nav className="navbar interna">
        <div className="nav-brand" onClick={irParaLanding} style={{ cursor: 'pointer' }}>
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>
        <ul className="nav-menu">
          <li><a href="#" onClick={(e) => { e.preventDefault(); irParaLanding?.(); }}>Início</a></li>
          <li><span className="nav-separator">|</span></li>
          <li><a href="#agenda" className="special-link active">Minha Agenda</a></li>
          <li><a href="#disponibilidade" className="special-link">Disponibilidades</a></li>
        </ul>
        <div className="nav-actions">
          <div className="user-profile">
            <span className="welcome-text">Olá, <strong>{utilizador?.nome?.split(' ')[0] || ''}</strong></span>
            <button className="btn-logout" onClick={handleLogout}>Sair</button>
          </div>
        </div>
      </nav>

      <div className="dashboard-wrapper" id="agenda">
        <main className="calendar-container">
          {/* CABEÇALHO FIXO */}
          <div className="calendar-days-sticky">
            <div className="time-corner"></div>
            {dias.map(dia => (
              <div key={dia} className="day-sticky-cell">{dia}</div>
            ))}
          </div>

          {/* ÁREA DE SCROLL INDEPENDENTE */}
          <div className="calendar-scrollable-area">
            <div className="calendar-grid-body">
              {horas.map(hora => (
                <React.Fragment key={hora}>
                  <div className="time-label">{hora}</div>

                  {dias.map((dia, idx) => (
                    <div
                      key={`${dia}-${idx}`}
                      className={`slot-cell ${hora > "14:00" ? "is-available" : ""}`}
                      onClick={() => {
                        const row = agendaPorDiaHora.get(`${dia}|${hora}`);
                        if (row) return;
                        const dataAulaYmd = formatYMD(addDays(weekStart, idx));
                        verPrecoEstimado({ dataAulaYmd, horaInicio: hora });
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        const row = agendaPorDiaHora.get(`${dia}|${hora}`);
                        if (row) return;
                        const dataAulaYmd = formatYMD(addDays(weekStart, idx));
                        verPrecoEstimado({ dataAulaYmd, horaInicio: hora });
                      }}
                      style={{ cursor: 'pointer' }}
                      aria-label={`Ver preço estimado em ${dia} às ${hora}`}
                    >
                      {(() => {
                        const row = agendaPorDiaHora.get(`${dia}|${hora}`);
                        if (!row) return null;

                        const classeModalidade = modalidadeParaClasse(row.modalidade);
                        const ended = coachingJaTerminou(row.data_aula, row.hora_inicio, row.duracao_minutos);
                        const pendente = ended && (row.estado === 'Agendado' || row.estado === 'Confirmado');

                        return (
                          <div className={`event-block ${classeModalidade} ${pendente ? 'status-pending' : ''}`}>
                            <div className="event-info">
                              <span className="event-time">
                                {formatIntervalo(row.hora_inicio, row.duracao_minutos)}
                              </span>
                              <h4 className="event-title">{row.modalidade} ({row.formato_aula})</h4>
                              <p className="event-student">Sala: {row.sala} • EE: {row.encarregado}</p>
                            </div>
                            {pendente && (
                              <button className="btn-validar-mini" onClick={() => validarRealizacao(row)}>
                                Validar Realização
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </main>

        {isPrecoModalOpen && (
          <div className="modal-overlay" onClick={() => setIsPrecoModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Preço Estimado</h2>
              <p style={{ margin: '6px 0 14px', opacity: 0.8 }}>
                {precoInfo.dataAula} • {precoInfo.horaInicio}
              </p>
              {precoInfo.isLoading ? (
                <p style={{ opacity: 0.75 }}>A calcular…</p>
              ) : precoInfo.erro ? (
                <p className="modal-error">{precoInfo.erro}</p>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <span style={{ fontWeight: 700, opacity: 0.9 }}>
                    {precoInfo.formatoAula} • {precoInfo.duracaoMinutos} min
                  </span>
                  <strong style={{ fontSize: '1.25rem', color: '#2a2724' }}>
                    {precoInfo.custoEstimado != null ? `${Number(precoInfo.custoEstimado).toFixed(2)} EUR` : '—'}
                  </strong>
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="btn-gold"
                  type="button"
                  disabled={precoInfo.isLoading || !!precoInfo.erro}
                  onClick={submeterPedidoCoachingDireto}
                >
                  {isSubmittingPedido ? 'A submeter…' : 'Enviar à Coordenação'}
                </button>
                <button className="btn-text" type="button" onClick={() => setIsPrecoModalOpen(false)}>Fechar</button>
              </div>

              <div className="modal-grid" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label>Modalidade</label>
                  <select
                    value={pedidoForm.idModalidade}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPedidoForm((p) => ({ ...p, idModalidade: id }));
                      carregarProfessoresPorModalidade(id);
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
                  <label>Ano Letivo</label>
                  <select
                    value={pedidoForm.idAnoLetivo}
                    onChange={(e) => setPedidoForm((p) => ({ ...p, idAnoLetivo: e.target.value }))}
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
                  <label>Professor (opcional)</label>
                  <select
                    value={pedidoForm.idProfessor}
                    onChange={(e) => setPedidoForm((p) => ({ ...p, idProfessor: e.target.value }))}
                  >
                    <option value="">Sem preferência</option>
                    {professoresPedido.map((prof) => (
                      <option key={prof.id_professor} value={prof.id_professor}>
                        {prof.nome_professor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Alunos</label>
                <select
                  multiple
                  value={(pedidoForm.alunosIds || []).map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                    setPedidoForm((p) => ({ ...p, alunosIds: selected }));
                  }}
                  size={Math.min(6, Math.max(3, alunosPedido.length || 3))}
                >
                  {alunosPedido.map((a) => (
                    <option key={a.id_aluno} value={a.id_aluno}>
                      {a.nome_aluno}
                    </option>
                  ))}
                </select>
                <small style={{ opacity: 0.75 }}>
                  {isLoadingAlunosPedido
                    ? 'A carregar alunos...'
                    : alunosPedido.length > 0
                      ? 'Dica: usa Ctrl/Cmd para selecionar vários alunos.'
                      : 'Sem alunos associados a este utilizador.'}
                </small>
              </div>

              {!isPerfilEE && (
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label>Número de participantes</label>
                  <input
                    type="number"
                    min="1"
                    value={pedidoForm.numeroParticipantes}
                    onChange={(e) => setPedidoForm((p) => ({ ...p, numeroParticipantes: e.target.value }))}
                  />
                </div>
              )}

              {!!pedidoErro && <p className="modal-error" style={{ marginTop: 10 }}>{pedidoErro}</p>}
              {!!pedidoSucesso && <p style={{ marginTop: 10, color: '#1f7a3f', fontWeight: 700 }}>{pedidoSucesso}</p>}
              {pedidoIdCriado && (
                <p style={{ marginTop: 6, display: 'inline-block', background: '#e8f6ee', color: '#1f7a3f', padding: '4px 10px', borderRadius: 999, fontWeight: 700 }}>
                  ID do pedido: #{pedidoIdCriado}
                </p>
              )}
              {!isPerfilEE && <p style={{ marginTop: 8, opacity: 0.75 }}>Pedido será criado em nome do professor e enviado para aprovação da coordenação.</p>}
              {pedidoHint && <p style={{ marginTop: 10, opacity: 0.8 }}>{pedidoHint}</p>}
            </div>
          </div>
        )}

        <aside className="sidebar">
          <div className="modalidade-legend">
            <h4>Modalidades</h4>
            {modalidades.map(m => (
              <div key={m.nome} className="legend-item">
                <span className={`color-dot ${m.classe}`}></span>
                {m.nome}
              </div>
            ))}
          </div>

          <div className="sidebar-card" id="disponibilidade">
            <h3>Disponibilidade</h3>
            <ul className="dispo-mini-list">
              {isLoadingDispo ? (
                <li><span>A carregar…</span></li>
              ) : disponibilidades.length === 0 ? (
                <li><span>Sem horários</span></li>
              ) : (
                disponibilidades.slice(0, 4).map((d) => (
                  <li key={d.id_disponibilidade}>
                    <span>{nomeDiaSemana(d.dia_semana)}</span>
                    {formatHoraCurta(d.hora_inicio)} - {formatHoraCurta(d.hora_fim)}
                  </li>
                ))
              )}
            </ul>
            <button className="btn-text" type="button" onClick={() => setIsDispoModalOpen(true)}>
              Editar Horários
            </button>
          </div>

          <div className="sidebar-card resumo-card">
            <h3>Resumo Mensal</h3>
            <div className="stat-row">
              <span>Aulas dadas:</span>
              <strong>{resumoMensal.aulasDadas}</strong>
            </div>
            <div className="stat-row highlight">
              <span>A receber:</span>
              <strong>{resumoMensal.aReceber.toFixed(2)}EUR</strong>
            </div>
          </div>

          <div className="sidebar-card">
            <h3>Semana</h3>
            <p style={{ margin: '8px 0 0', opacity: 0.75 }}>{semanaLabel}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <button className="btn-today" type="button" onClick={irParaSemanaAnterior}>←</button>
              <button className="btn-today" type="button" onClick={irParaHoje}>Hoje</button>
              <button className="btn-today" type="button" onClick={irParaSemanaSeguinte}>→</button>
            </div>
            {isLoadingAgenda && <p style={{ marginTop: 10, opacity: 0.7 }}>A carregar agenda…</p>}
            {erroAgenda && <p style={{ marginTop: 10, color: '#b02a2a' }}>{erroAgenda}</p>}
          </div>
        </aside>
      </div>

      {isDispoModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDispoModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Editar Horários</h2>
            {erroDispo && <p className="modal-error">{erroDispo}</p>}

            <div className="modal-grid">
              <div className="form-group">
                <label>Dia</label>
                <select value={novoDiaSemana} onChange={(e) => setNovoDiaSemana(Number(e.target.value))}>
                  <option value={1}>Segunda a Sexta</option>
                  <option value={2}>Sábado e Domingo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Hora início</label>
                <input type="time" value={novoHoraInicio} onChange={(e) => setNovoHoraInicio(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Hora fim</label>
                <input type="time" value={novoHoraFim} onChange={(e) => setNovoHoraFim(e.target.value)} />
              </div>
              <div className="form-group">
                <label>&nbsp;</label>
                <button className="btn-dark" type="button" disabled={isSavingDispo} onClick={guardarDisponibilidade}>
                  {isSavingDispo ? 'A guardar…' : 'Adicionar'}
                </button>
              </div>
            </div>

            <div className="modal-list">
              {(disponibilidades || []).map((d) => (
                <div key={d.id_disponibilidade} className="modal-row">
                  <span className="modal-row-text">
                    {nomeDiaSemana(d.dia_semana)} • {formatHoraCurta(d.hora_inicio)} - {formatHoraCurta(d.hora_fim)}
                  </span>
                  <button className="btn-outline" type="button" onClick={() => removerDisponibilidade(d.id_disponibilidade)}>
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn-text" type="button" onClick={() => setIsDispoModalOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <footer className="main-footer">
        <div className="footer-container">
          <div className="footer-column">
            <h3>Contacto</h3>
            <ul className="footer-info">
              <li><span>📍</span> Rua das Artes, nº 123, Braga</li>
              <li><span>📞</span> +351 000 000 000</li>
              <li><span>✉️</span> geral@vivadarte.pt</li>
            </ul>
          </div>
          <div className="footer-column">
            <h3>Links Rápidos</h3>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => { e.preventDefault(); irParaLanding(); }}>Página Inicial</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h3>Redes Sociais</h3>
            <div className="social-icons-only">
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" className="social-svg" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" className="social-svg" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
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
