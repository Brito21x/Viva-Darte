import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import logoImg from '../../assets/logo.png';
import { API_URL } from '../../services/api';

async function apiFetch(path, token, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.mensagem || data.error || `Erro HTTP ${res.status}`);
  }
  return data;
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className={`stat-card stat-card--${accent}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="admin-section">
      <button className="section-toggle" onClick={() => setOpen(o => !o)}>
        <span>{icon} {title}</span>
        <span className={`chevron ${open ? 'chevron--open' : ''}`}>›</span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

export default function AdminDashboard({ irParaLanding }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [utilizador, setUtilizador] = useState(null);
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [usuarios, setUsuarios] = useState([]); 
  const [msg, setMsg] = useState('');

  const [coachingsConclusao, setCoachingsConclusao] = useState([]);
  const [loadingCoachings, setLoadingCoachings] = useState(false);

  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoPassword, setNovoPassword] = useState('');
  const [novoTipo, setNovoTipo] = useState('EE');
  const [criandoUser, setCriandoUser] = useState(false);
  const [modalidadesLista, setModalidadesLista] = useState([]);
  const [modalidadesSelecionadas, setModalidadesSelecionadas] = useState([]);

  useEffect(() => {
    document.title = "Painel Admin | Viva D'arte";
    const userGuardado = localStorage.getItem('viva_user');
    const tkGuardado = localStorage.getItem('viva_token'); 
    
    if (userGuardado && tkGuardado) { 
        const user = JSON.parse(userGuardado);
        const perfisPermitidos = ['Admin', 'Administrador', 'Coordenação', 'Coordenacao'];
        const lista = Array.isArray(user.perfis) ? user.perfis : [];
        const ok =
            perfisPermitidos.includes(user.perfil) ||
            user.id_perfil === 1 ||
            user.id_perfil === '1' ||
            lista.some((p) => {
                const s = String(p).toLowerCase();
                return s.includes('admin') || s.includes('coord');
            });
        if (ok) {
            setUtilizador(user);
            setToken(tkGuardado);
            setIsAuthorized(true);
        }
    }
  }, []);

  useEffect(() => {
    if (!token || !isAuthorized) return;
    carregarDados();
  }, [token, isAuthorized]);

  useEffect(() => {
    if (!token || !isAuthorized) return;
    (async () => {
      try {
        const m = await apiFetch('/api/escola/modalidades', token);
        setModalidadesLista(Array.isArray(m) ? m : []);
      } catch {
        setModalidadesLista([]);
      }
    })();
  }, [token, isAuthorized]);

  useEffect(() => {
    if (!token || !isAuthorized || activeTab !== 'coachings') return;
    (async () => {
      setLoadingCoachings(true);
      try {
        const list = await apiFetch('/api/coaching/pendentes-conclusao', token);
        setCoachingsConclusao(Array.isArray(list) ? list : []);
      } catch {
        setCoachingsConclusao([]);
        mostrarMsg('Não foi possível carregar coachings pendentes de conclusão.', 'erro');
      } finally {
        setLoadingCoachings(false);
      }
    })();
  }, [token, isAuthorized, activeTab]);

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
        const bodyData = { 
            email: email, 
            password: password, 
            tipo: 'ADMIN',
            perfil: 'ADMIN' 
        };

        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData) 
        });
        const data = await response.json();

        if (response.ok) {
            const user = data.utilizador || data.user; 
            const tk = data.token;
            const perfisPermitidos = ['Admin', 'Administrador', 'Coordenação', 'Coordenacao'];
            const lista = Array.isArray(user.perfis) ? user.perfis : [];
            const okPerfil =
                perfisPermitidos.includes(user.perfil) ||
                user.id_perfil === 1 ||
                user.id_perfil === '1' ||
                lista.some((p) => {
                    const s = String(p).toLowerCase();
                    return s.includes('admin') || s.includes('coord');
                });
            if (okPerfil) {
                if (!user.perfil && user.id_perfil === 1) user.perfil = 'Admin';
                localStorage.setItem('viva_user', JSON.stringify(user));
                localStorage.setItem('viva_token', tk);
                setUtilizador(user);
                setToken(tk);
                setIsAuthorized(true); 
            } else {
                setLoginError("Acesso negado: A tua conta não tem permissões de Administração ou Coordenação.");
            }
        } else {
            setLoginError(data.mensagem || data.error || "Email ou palavra-passe incorretos.");
        }
    } catch (err) {
        setLoginError("Erro de ligação ao servidor.");
    } finally {
        setIsLoggingIn(false);
    }
  }

  async function carregarDados() {
    try {
      const usersData = await apiFetch('/api/utilizadores', token).catch(() => []);
      if (Array.isArray(usersData)) setUsuarios(usersData);
    } catch (e) {
      mostrarMsg('Erro ao carregar dados.', 'erro');
    }
  }

  function mostrarMsg(texto, tipo = 'ok') {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(''), 3500);
  }

  async function handleAlterarEstadoUtilizador(idUtilizador, ativo) {
    const msg = ativo ? 'Reativar esta conta?' : 'Desativar esta conta? O utilizador deixa de poder iniciar sessão.';
    if (!window.confirm(msg)) return;
    try {
      const response = await fetch(`${API_URL}/api/utilizadores/${idUtilizador}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ativo }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        mostrarMsg(data.mensagem || (ativo ? 'Conta reativada.' : 'Conta desativada.'), 'ok');
        carregarDados();
      } else {
        mostrarMsg(data.mensagem || 'Erro ao atualizar estado.', 'erro');
      }
    } catch {
      mostrarMsg('Erro de rede.', 'erro');
    }
  }

  async function handleEditarUtilizador(u) {
    const nome = window.prompt('Nome completo', u.nome || '');
    if (nome === null) return;
    if (!String(nome).trim()) {
      mostrarMsg('Nome é obrigatório.', 'erro');
      return;
    }
    const telefone = window.prompt('Telefone (opcional)', u.telefone || '') ?? '';
    const perf = window.prompt('Perfil: escreve Professor ou Encarregado (vazio = não alterar)', '');
    const body = { nome: String(nome).trim(), telefone: telefone.trim() || null };
    if (perf && String(perf).trim()) {
      const p = String(perf).trim().toLowerCase();
      if (p.startsWith('prof')) body.nomePerfil = 'Professor';
      else if (p.startsWith('enc') || p === 'ee') body.nomePerfil = 'Encarregado';
      else {
        mostrarMsg('Perfil inválido. Usa Professor ou Encarregado.', 'erro');
        return;
      }
    }
    try {
      await apiFetch(`/api/utilizadores/${u.id_utilizador}`, token, { method: 'PUT', body });
      mostrarMsg('Utilizador atualizado.', 'ok');
      carregarDados();
    } catch (e) {
      mostrarMsg(e.message || 'Erro ao editar.', 'erro');
    }
  }

  function toggleModalidadeProfessor(idModalidade) {
    setModalidadesSelecionadas((prev) => {
      if (prev.includes(idModalidade)) return prev.filter((id) => id !== idModalidade);
      return [...prev, idModalidade];
    });
  }

  async function handleCriarUtilizador(e) {
    e.preventDefault();
    if (!novoNome.trim() || !novoEmail.trim() || !novoPassword.trim()) {
      mostrarMsg('Nome, email e palavra-passe são obrigatórios.', 'erro');
      return;
    }
    if (novoTipo === 'PROF' && modalidadesSelecionadas.length === 0) {
      mostrarMsg('Para professor, escolhe pelo menos uma modalidade.', 'erro');
      return;
    }
    setCriandoUser(true);
    try {
      const body = {
        nome: novoNome.trim(),
        email: novoEmail.trim(),
        telefone: novoTelefone.trim() || undefined,
        password: novoPassword,
        tipo: novoTipo === 'PROF' ? 'PROF' : 'EE',
      };
      if (novoTipo === 'PROF') {
        body.idsModalidades = modalidadesSelecionadas;
      }
      await apiFetch('/api/utilizadores', token, {
        method: 'POST',
        body,
      });
      mostrarMsg('Utilizador registado.', 'ok');
      setNovoNome('');
      setNovoEmail('');
      setNovoTelefone('');
      setNovoPassword('');
      setNovoTipo('EE');
      setModalidadesSelecionadas([]);
      carregarDados();
    } catch (err) {
      mostrarMsg(err.message || 'Erro ao registar utilizador.', 'erro');
    } finally {
      setCriandoUser(false);
    }
  }

  async function handleConcluirCoaching(idCoaching, estadoFinal) {
    const obs = window.prompt('Observações para o registo (opcional):', '') ?? '';
    try {
      await apiFetch(`/api/coaching/${idCoaching}/concluir`, token, {
        method: 'POST',
        body: { estadoFinal, observacoes: obs.trim() || null },
      });
      mostrarMsg('Conclusão registada.', 'ok');
      const list = await apiFetch('/api/coaching/pendentes-conclusao', token);
      setCoachingsConclusao(Array.isArray(list) ? list : []);
    } catch (e) {
      mostrarMsg(e.message || 'Erro ao concluir coaching.', 'erro');
    }
  }

  if (!isAuthorized) {
      return (
          <div className="admin-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-section)' }}>
              <div className="admin-section" style={{ padding: '40px', maxWidth: '420px', width: '90%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                  <img src={logoImg} alt="Logo Viva D'arte" style={{ display: 'block', margin: '0 auto 20px auto', width: '120px', height: 'auto', objectFit: 'contain' }} />
                  <h2 className="page-title" style={{ fontSize: '1.6rem', marginBottom: '8px' }}>Painel Restrito</h2>
                  <p className="page-subtitle" style={{ marginBottom: '30px' }}>Área de acesso exclusivo à Administração</p>

                  <form className="admin-form" onSubmit={handleAdminLogin} style={{ textAlign: 'left' }}>
                      {loginError && (
                          <div className="info-note" style={{ borderLeftColor: 'var(--red)', backgroundColor: '#fce8e8', color: 'var(--red)', margin: '0 0 15px 0', borderRadius: '8px' }}>
                              {loginError}
                          </div>
                      )}
                      <div className="field">
                          <label>Email</label>
                          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                      </div>
                      <div className="field" style={{ marginBottom: '20px' }}>
                          <label>Palavra-passe</label>
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                      </div>
                      <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }} disabled={isLoggingIn}>
                          {isLoggingIn ? 'A verificar credenciais...' : 'Entrar no Painel'}
                      </button>
                  </form>
                  <button style={{ marginTop: '24px', background: 'none', border: 'none', color: '#8a8480', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem', fontFamily: 'Poppins' }} onClick={irParaLanding}>
                      Voltar ao site público
                  </button>
              </div>
          </div>
      );
  }

  const tabs = [
    { id: 'overview', label: '🏠 Visão Geral' },
    { id: 'usuarios', label: '👥 Usuários' },
    { id: 'coachings', label: '📅 Conclusão coachings' }
  ];

  const pendentesParaAprovar = usuarios.filter(u => u.ativo === false || u.ativo === 0).length;
  const pendentesConclusao = coachingsConclusao.length;

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img src={logoImg} alt="Logo" style={{ width: '65px', height: 'auto', objectFit: 'contain' }} />
          <div>
            <p className="brand-name">Viva D'arte</p>
            <p className="brand-role">Coordenação</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`nav-item ${activeTab === t.id ? 'nav-item--active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
              {/* Badge visual se houver pendentes no menu Lateral */}
              {t.id === 'usuarios' && pendentesParaAprovar > 0 && (
                  <span style={{ marginLeft: '8px', background: 'var(--red)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                      {pendentesParaAprovar}
                  </span>
              )}
              {t.id === 'coachings' && pendentesConclusao > 0 && (
                  <span style={{ marginLeft: '8px', background: 'var(--orange)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                      {pendentesConclusao}
                  </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="sidebar-user">{utilizador?.nome}</p>
          <button className="sidebar-logout" onClick={() => { localStorage.clear(); irParaLanding(); }}>
            Sair
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {msg && (
          <div className={`toast toast--${msg.tipo}`}>{msg.texto}</div>
        )}

        {activeTab === 'overview' && (
          <div className="tab-content">
            <h1 className="page-title">Olá, {utilizador?.nome?.split(' ')[0]} 👋</h1>
            <p className="page-subtitle">Resumo do sistema</p>

            <div className="stats-grid">
              <StatCard icon="👥" label="Total Utilizadores" value={usuarios.length} accent="blue" />
              <StatCard icon="⏳" label="Por Aprovar" value={pendentesParaAprovar} accent="orange" />
              <StatCard icon="📅" label="Coachings a concluir" value={pendentesConclusao} accent="teal" />
            </div>
            
            {/* Atalho Rápido para aprovar utilizadores */}
            {pendentesParaAprovar > 0 && (
                <div className="info-note" style={{ borderLeftColor: 'var(--orange)', marginTop: '20px', cursor: 'pointer' }} onClick={() => setActiveTab('usuarios')}>
                    <strong>Atenção:</strong> Tens {pendentesParaAprovar} utilizador(es) à espera de aprovação para entrar na comunidade. <u>Clica aqui para gerir.</u>
                </div>
            )}
          </div>
        )}

        {activeTab === 'usuarios' && (
          <div className="tab-content">
            <h1 className="page-title">👥 Gestão de Usuários</h1>

            <Section title="Nova conta (US03)" icon="➕" defaultOpen>
              <form className="admin-form" onSubmit={handleCriarUtilizador} style={{ maxWidth: 520 }}>
                <div className="field">
                  <label>Nome</label>
                  <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} required autoComplete="off" />
                </div>
                <div className="field">
                  <label>Telefone</label>
                  <input value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} />
                </div>
                <div className="field">
                  <label>Palavra-passe inicial</label>
                  <input type="password" value={novoPassword} onChange={(e) => setNovoPassword(e.target.value)} required autoComplete="new-password" />
                </div>
                <div className="field">
                  <label>Tipo</label>
                  <select
                    value={novoTipo}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNovoTipo(v);
                      if (v !== 'PROF') setModalidadesSelecionadas([]);
                    }}
                  >
                    <option value="EE">Encarregado de educação (EE)</option>
                    <option value="PROF">Professor</option>
                  </select>
                </div>
                {novoTipo === 'PROF' && (
                  <div className="field">
                    <label>Modalidades que leciona (uma ou mais)</label>
                    <p style={{ fontSize: '0.85rem', color: '#6b6560', margin: '0 0 8px 0' }}>
                      Obrigatório escolher pelo menos uma. Só aparecem modalidades ativas na escola.
                    </p>
                    <div
                      style={{
                        border: '1px solid #e8e4e0',
                        borderRadius: 8,
                        padding: 12,
                        maxHeight: 200,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {modalidadesLista.length === 0 ? (
                        <span style={{ color: '#8a8480' }}>Sem modalidades na lista (verifica a API / escola).</span>
                      ) : (
                        modalidadesLista.map((mod) => (
                          <label
                            key={mod.id_modalidade}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              checked={modalidadesSelecionadas.includes(mod.id_modalidade)}
                              onChange={() => toggleModalidadeProfessor(mod.id_modalidade)}
                            />
                            <span>{mod.nome}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={criandoUser}>
                  {criandoUser ? 'A registar…' : 'Registar utilizador'}
                </button>
              </form>
            </Section>

            <Section title="Todos os utilizadores" icon="📋" defaultOpen>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome / perfis</th>
                    <th>Email</th>
                    <th>Telefone</th>
                    <th>Estado</th>
                    <th>Criação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const isAtivo = u.ativo === true || u.ativo === 1;
                    return (
                      <tr key={u.id_utilizador} style={{ backgroundColor: !isAtivo ? '#fffbf0' : 'transparent' }}>
                        <td>{u.id_utilizador}</td>
                        <td>
                          <strong>{u.nome}</strong>
                          <br />
                          <span style={{ fontSize: '0.75rem', color: '#8a8480' }}>{u.perfis || '—'}</span>
                        </td>
                        <td>{u.email}</td>
                        <td>{u.telefone || '—'}</td>
                        <td>
                          <span className={`badge badge--${isAtivo ? 'green' : 'orange'}`}>
                            {isAtivo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>{u.data_criacao ? new Date(u.data_criacao).toLocaleDateString('pt-PT') : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {!isAtivo && (
                              <button
                                type="button"
                                className="btn-sm btn-sm--green"
                                style={{ backgroundColor: 'var(--green)', color: 'white' }}
                                onClick={() => handleAlterarEstadoUtilizador(u.id_utilizador, true)}
                              >
                                Ativar
                              </button>
                            )}
                            {isAtivo && (
                              <button type="button" className="btn-sm btn-sm--danger" onClick={() => handleAlterarEstadoUtilizador(u.id_utilizador, false)}>
                                Desativar
                              </button>
                            )}
                            <button type="button" className="btn-sm btn-sm--primary" onClick={() => void handleEditarUtilizador(u)}>
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {usuarios.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-row">
                        Nenhum utilizador encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
          </div>
        )}

        {activeTab === 'coachings' && (
          <div className="tab-content">
            <h1 className="page-title">📅 Conclusão de coachings (US14)</h1>
            <p className="page-subtitle">
              Aulas já terminadas, ainda em estado Agendado ou Confirmado — define o resultado final após as validações do professor e do encarregado.
            </p>
            {loadingCoachings ? (
              <p>A carregar…</p>
            ) : coachingsConclusao.length === 0 ? (
              <p className="info-note">Nenhum coaching neste estado com aula já concluída (hora de fim passada).</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Data / hora</th>
                    <th>Modalidade</th>
                    <th>Professor</th>
                    <th>Encarregado</th>
                    <th>Estado</th>
                    <th>Decisão</th>
                  </tr>
                </thead>
                <tbody>
                  {coachingsConclusao.map((c) => (
                    <tr key={c.id_coaching}>
                      <td>{c.id_coaching}</td>
                      <td>
                        {c.data_aula ? String(c.data_aula).split('T')[0] : '—'}
                        <br />
                        <small>{String(c.hora_inicio || '').slice(0, 5)}</small>
                      </td>
                      <td>{c.modalidade}</td>
                      <td>{c.nome_professor}</td>
                      <td>
                        {c.nome_encarregado}
                        <br />
                        <small>{c.email_encarregado}</small>
                      </td>
                      <td>{c.estado}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-sm btn-sm--green"
                          style={{ marginRight: 6 }}
                          onClick={() => void handleConcluirCoaching(c.id_coaching, 'Realizado')}
                        >
                          Realizado
                        </button>
                        <button type="button" className="btn-sm btn-sm--danger" onClick={() => void handleConcluirCoaching(c.id_coaching, 'Nao_Realizado')}>
                          Não realizado
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </main>
    </div>
  );
}