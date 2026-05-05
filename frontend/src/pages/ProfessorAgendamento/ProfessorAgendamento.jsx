import { useState, useEffect, useCallback, useMemo } from 'react';
import './ProfessorAgendamento.css';
import logoImg from '../../assets/logo.png';
import { apiAuthFetch, getAuthToken } from '../../services/api';
import { formatarHoraMostrar } from '../../utils/coachingAgendar';
import { toYMD } from '../../utils/semanaCalendario';
import { isProfessorUtilizador } from '../../utils/perfilUtilizador';
import { podeMostrarValidacaoRealizacao } from '../../utils/coachingInstantes';

function diaSemanaDisponibilidadeLabel(cod) {
  if (Number(cod) === 2) return 'Sábado e domingo';
  return 'Segunda a quinta';
}

/** input HH:mm → HH:mm:ss para o body JSON */
function inputTimeParaHoraSs(v) {
  const m = String(v || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '08:00:00';
  const hh = String(parseInt(m[1], 10)).padStart(2, '0');
  const mm = String(parseInt(m[2], 10)).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

function inicioFimMesCorrente() {
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth(), 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { ini: toYMD(ini), fim: toYMD(fim) };
}

function formatarDataBarra(ymd) {
  if (!ymd) return '—';
  const [y, m, d] = String(ymd).split('T')[0].split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export default function ProfessorAgendamento({ irParaLanding, irParaVendaFigurinos, irParaEmprestimos }) {
  const [utilizador, setUtilizador] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [semPermissao, setSemPermissao] = useState(true);

  const [tab, setTab] = useState('disponibilidade');
  const [disponibilidades, setDisponibilidades] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [loadingDisp, setLoadingDisp] = useState(false);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { ini: defaultIni, fim: defaultFim } = useMemo(() => inicioFimMesCorrente(), []);
  const [dataAgendaIni, setDataAgendaIni] = useState(defaultIni);
  const [dataAgendaFim, setDataAgendaFim] = useState(defaultFim);

  const [diaSemanaForm, setDiaSemanaForm] = useState('1');
  const [horaInicioForm, setHoraInicioForm] = useState('09:00');
  const [horaFimForm, setHoraFimForm] = useState('13:00');

  const [alerta, setAlerta] = useState({ show: false, message: '' });
  const mostrarAlerta = (message) => setAlerta({ show: true, message });
  const fecharAlerta = () => setAlerta({ show: false, message: '' });

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
    setSemPermissao(!isProfessorUtilizador(u));
    setAuthChecked(true);
  }, []);

  const carregarDisponibilidades = useCallback(async () => {
    if (!getAuthToken() || semPermissao) return;
    setLoadingDisp(true);
    try {
      const lista = await apiAuthFetch('/api/coaching/disponibilidades');
      setDisponibilidades(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setDisponibilidades([]);
      mostrarAlerta(e.message || 'Erro ao carregar disponibilidades.');
    } finally {
      setLoadingDisp(false);
    }
  }, [semPermissao]);

  const carregarAgenda = useCallback(async () => {
    if (!getAuthToken() || semPermissao) return;
    if (!dataAgendaIni || !dataAgendaFim) return;
    setLoadingAgenda(true);
    try {
      const sp = new URLSearchParams({ dataInicio: dataAgendaIni, dataFim: dataAgendaFim });
      const lista = await apiAuthFetch(`/api/coaching/agenda?${sp.toString()}`);
      setAgenda(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setAgenda([]);
      mostrarAlerta(e.message || 'Erro ao carregar a agenda.');
    } finally {
      setLoadingAgenda(false);
    }
  }, [semPermissao, dataAgendaIni, dataAgendaFim]);

  const validarRealizacaoProfessor = useCallback(
    async (idCoaching, estadoValidacao) => {
      const observacoes = window.prompt('Observações (opcional):', '') ?? '';
      try {
        await apiAuthFetch(`/api/coaching/${idCoaching}/validar`, {
          method: 'POST',
          body: { estadoValidacao, observacoes: observacoes.trim() || null },
        });
        mostrarAlerta('Validação registada.');
        await carregarAgenda();
      } catch (e) {
        mostrarAlerta(e.message || 'Não foi possível validar.');
      }
    },
    [carregarAgenda]
  );

  useEffect(() => {
    if (!authChecked || semPermissao) return;
    void carregarDisponibilidades();
  }, [authChecked, semPermissao, carregarDisponibilidades]);

  useEffect(() => {
    if (!authChecked || semPermissao || tab !== 'agenda') return;
    void carregarAgenda();
  }, [authChecked, semPermissao, tab, carregarAgenda]);

  const handleLogout = () => {
    localStorage.removeItem('viva_user');
    localStorage.removeItem('viva_token');
    setUtilizador(null);
    irParaLanding();
  };

  const adicionarDisponibilidade = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiAuthFetch('/api/coaching/disponibilidades', {
        method: 'POST',
        body: {
          diaSemana: parseInt(diaSemanaForm, 10),
          horaInicio: inputTimeParaHoraSs(horaInicioForm),
          horaFim: inputTimeParaHoraSs(horaFimForm),
        },
      });
      mostrarAlerta('Disponibilidade guardada. Já aparece nas vagas de coaching (com modalidades associadas pela coordenação).');
      await carregarDisponibilidades();
    } catch (err) {
      mostrarAlerta(err.message || 'Não foi possível guardar.');
    } finally {
      setSubmitting(false);
    }
  };

  const removerDisponibilidade = async (id) => {
    if (!window.confirm('Remover este bloco de disponibilidade?')) return;
    try {
      await apiAuthFetch(`/api/coaching/disponibilidades/${id}`, { method: 'DELETE' });
      mostrarAlerta('Disponibilidade removida.');
      await carregarDisponibilidades();
    } catch (err) {
      mostrarAlerta(err.message || 'Não foi possível remover.');
    }
  };

  if (!authChecked) {
    return (
      <div className="page-prof-ag">
        <p className="pa-main">A verificar sessão…</p>
      </div>
    );
  }

  if (semPermissao) {
    return (
      <div className="page-prof-ag">
        <nav className="pa-nav">
          <div className="pa-nav-brand">
            <img src={logoImg} alt="" className="pa-nav-logo" />
            <span>VIVA D&apos;ARTE</span>
          </div>
          <ul className="pa-nav-links">
            <li>
              <button type="button" onClick={irParaLanding}>
                Início
              </button>
            </li>
          </ul>
        </nav>
        <div className="pa-aviso">
          <p>
            Esta área é para <strong>Professores</strong>. Inicia sessão com o perfil Professor para gerires disponibilidade
            e agenda de coachings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-prof-ag">
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
            padding: 20,
          }}
          onClick={fecharAlerta}
        >
          <div
            className="pa-card"
            style={{ maxWidth: 420, cursor: 'default' }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <p style={{ marginTop: 0 }}>{alerta.message}</p>
            <button type="button" className="pa-btn-primary" onClick={fecharAlerta}>
              OK
            </button>
          </div>
        </div>
      )}

      <nav className="pa-nav">
        <div className="pa-nav-brand">
          <img src={logoImg} alt="" className="pa-nav-logo" />
          <span>VIVA D&apos;ARTE · Professor</span>
        </div>
        <ul className="pa-nav-links">
          <li>
            <button type="button" onClick={irParaLanding}>
              Início
            </button>
          </li>
          <li>
            <button type="button" onClick={irParaEmprestimos}>
              Empréstimos
            </button>
          </li>
          <li>
            <button type="button" onClick={irParaVendaFigurinos}>
              Venda figurinos
            </button>
          </li>
          <li>
            <span style={{ opacity: 0.9 }}>Olá, {utilizador?.nome}</span>
          </li>
          <li>
            <button type="button" onClick={handleLogout}>
              Sair
            </button>
          </li>
        </ul>
      </nav>

      <main className="pa-main">
        <h1 className="pa-titulo">Agendamento de coachings</h1>
        <p className="pa-sub">
          US09 — Define a tua <strong>disponibilidade</strong> (aparece nas vagas para os encarregados). US10 — Consulta a
          tua <strong>agenda</strong> de aulas já agendadas.
        </p>

        <div className="pa-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'disponibilidade'}
            className={`pa-tab ${tab === 'disponibilidade' ? 'ativo' : ''}`}
            onClick={() => setTab('disponibilidade')}
          >
            Disponibilidade
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'agenda'}
            className={`pa-tab ${tab === 'agenda' ? 'ativo' : ''}`}
            onClick={() => setTab('agenda')}
          >
            A minha agenda
          </button>
        </div>

        {tab === 'disponibilidade' && (
          <div className="pa-card">
            <h2>Novos horários disponíveis</h2>
            <form onSubmit={adicionarDisponibilidade}>
              <div className="pa-form-grid">
                <div className="pa-field">
                  <label htmlFor="pa-dia-tipo">Tipo de dias</label>
                  <select
                    id="pa-dia-tipo"
                    value={diaSemanaForm}
                    onChange={(e) => setDiaSemanaForm(e.target.value)}
                  >
                    <option value="1">Segunda a quinta</option>
                    <option value="2">Sábado e domingo</option>
                  </select>
                </div>
                <div className="pa-field">
                  <label htmlFor="pa-hi">Hora início</label>
                  <input
                    id="pa-hi"
                    type="time"
                    step={300}
                    value={horaInicioForm}
                    onChange={(e) => setHoraInicioForm(e.target.value)}
                  />
                </div>
                <div className="pa-field">
                  <label htmlFor="pa-hf">Hora fim</label>
                  <input
                    id="pa-hf"
                    type="time"
                    step={300}
                    value={horaFimForm}
                    onChange={(e) => setHoraFimForm(e.target.value)}
                  />
                </div>
                <div className="pa-field">
                  <label>&nbsp;</label>
                  <button type="submit" className="pa-btn-primary" disabled={submitting}>
                    {submitting ? 'A guardar…' : 'Adicionar disponibilidade'}
                  </button>
                </div>
              </div>
            </form>
            <p className="pa-hint">
              A coordenação tem de associar-te às <strong>modalidades</strong> que lecionas (painel Admin). Só assim as
              tuas vagas aparecem ao encarregado para essas modalidades.
            </p>

            <h2 style={{ marginTop: 28 }}>Os meus blocos registados</h2>
            {loadingDisp ? (
              <p className="pa-hint">A carregar…</p>
            ) : disponibilidades.length === 0 ? (
              <p className="pa-hint">Ainda não tens disponibilidades. Adiciona pelo menos um intervalo.</p>
            ) : (
              <div className="pa-table-wrap">
                <table className="pa-table">
                  <thead>
                    <tr>
                      <th>Dias</th>
                      <th>Início</th>
                      <th>Fim</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {disponibilidades.map((d) => (
                      <tr key={d.id_disponibilidade}>
                        <td>{diaSemanaDisponibilidadeLabel(d.dia_semana)}</td>
                        <td>{formatarHoraMostrar(d.hora_inicio)}</td>
                        <td>{formatarHoraMostrar(d.hora_fim)}</td>
                        <td>
                          <button
                            type="button"
                            className="pa-btn-danger"
                            onClick={() => void removerDisponibilidade(d.id_disponibilidade)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'agenda' && (
          <div className="pa-card">
            <h2>Coachings agendados</h2>
            <div className="pa-form-grid">
              <div className="pa-field">
                <label htmlFor="pa-ag-ini">De</label>
                <input
                  id="pa-ag-ini"
                  type="date"
                  value={dataAgendaIni}
                  onChange={(e) => setDataAgendaIni(e.target.value)}
                />
              </div>
              <div className="pa-field">
                <label htmlFor="pa-ag-fim">Até</label>
                <input
                  id="pa-ag-fim"
                  type="date"
                  value={dataAgendaFim}
                  onChange={(e) => setDataAgendaFim(e.target.value)}
                />
              </div>
              <div className="pa-field">
                <label>&nbsp;</label>
                <button type="button" className="pa-btn-primary" onClick={() => void carregarAgenda()}>
                  Atualizar lista
                </button>
              </div>
            </div>
            {loadingAgenda ? (
              <p className="pa-hint">A carregar agenda…</p>
            ) : agenda.length === 0 ? (
              <p className="pa-hint">Sem coachings neste intervalo de datas (ou ainda não foram aprovados).</p>
            ) : (
              <div className="pa-table-wrap">
                <table className="pa-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Hora</th>
                      <th>Modalidade</th>
                      <th>Sala</th>
                      <th>Encarregado</th>
                      <th>Formato</th>
                      <th>Estado</th>
                      <th>Realização (US13)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agenda.map((row) => (
                      <tr key={row.id_coaching}>
                        <td>{formatarDataBarra(row.data_aula)}</td>
                        <td>{formatarHoraMostrar(row.hora_inicio)}</td>
                        <td>{row.modalidade || '—'}</td>
                        <td>{row.sala || '—'}</td>
                        <td>{row.encarregado || '—'}</td>
                        <td>
                          {row.formato_aula || '—'} ({row.duracao_minutos || '—'} min)
                        </td>
                        <td>{row.estado || '—'}</td>
                        <td>
                          {podeMostrarValidacaoRealizacao(row) ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <button
                                type="button"
                                className="pa-btn-primary"
                                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                                onClick={() => void validarRealizacaoProfessor(row.id_coaching, 'Confirmado')}
                              >
                                Realizada
                              </button>
                              <button
                                type="button"
                                className="pa-btn-danger"
                                style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                                onClick={() => void validarRealizacaoProfessor(row.id_coaching, 'Nao_Realizado')}
                              >
                                Não realizada
                              </button>
                            </div>
                          ) : (
                            <span className="pa-hint">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
