import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import logoImg from '../../assets/logo.png'; 

const API_URL = 'http://localhost:3000';

function apiFetch(path, token, opts = {}) {
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(r => r.json());
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

  useEffect(() => {
    document.title = "Painel Admin | Viva D'arte";
    const userGuardado = localStorage.getItem('viva_user');
    const tkGuardado = localStorage.getItem('token'); 
    
    if (userGuardado && tkGuardado) { 
        const user = JSON.parse(userGuardado);
        const perfisPermitidos = ['Admin', 'Administrador', 'Coordenação', 'Coordenacao'];
        
        if (perfisPermitidos.includes(user.perfil) || user.id_perfil === 1 || user.id_perfil === "1") { 
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
            
            if (user.id_perfil === 1 || user.id_perfil === "1" || user.perfil === 'Admin') {
                user.perfil = 'Admin';
                localStorage.setItem('viva_user', JSON.stringify(user));
                localStorage.setItem('token', tk);
                setUtilizador(user);
                setToken(tk);
                setIsAuthorized(true); 
            } else {
                setLoginError("Acesso negado: A tua conta não tem permissões de Administração.");
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
      const usersData = await apiFetch('/api/auth/utilizadores', token).catch(() => []);
      if (Array.isArray(usersData)) setUsuarios(usersData);
    } catch (e) {
      mostrarMsg('Erro ao carregar dados.', 'erro');
    }
  }

  function mostrarMsg(texto, tipo = 'ok') {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(''), 3500);
  }

  // --- NOVA FUNÇÃO PARA ACEITAR O UTILIZADOR PENDENTE ---
  async function handleAceitarUsuario(idUtilizador) {
      if(!window.confirm("Tens a certeza que queres aprovar a entrada deste utilizador na comunidade?")) return;

      try {
          const response = await fetch(`${API_URL}/api/auth/utilizadores/${idUtilizador}/ativar`, {
              method: 'PUT',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
              }
          });
          
          const data = await response.json();
          
          if (response.ok) {
              mostrarMsg("Utilizador aceite com sucesso!", 'ok');
              carregarDados(); // Recarrega a tabela para atualizar a view
          } else {
              mostrarMsg(data.mensagem || "Erro ao aprovar o utilizador.", 'erro');
          }
      } catch (err) {
          mostrarMsg("Erro de rede.", 'erro');
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
    { id: 'usuarios', label: '👥 Usuários' }
  ];

  const pendentesParaAprovar = usuarios.filter(u => u.ativo === false || u.ativo === 0).length;

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

            <Section title="Todos os Usuários Registados" icon="📋" defaultOpen>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Palavra-passe</th>
                    <th>Telefone</th>
                    <th>Estado</th>
                    <th>Data Criação</th>
                    {/* NOVA COLUNA AÇÃO */}
                    <th>Ação</th> 
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const isAtivo = u.ativo === true || u.ativo === 1;
                    return (
                        <tr key={u.id_utilizador} style={{ backgroundColor: !isAtivo ? '#fffbf0' : 'transparent' }}>
                          <td>{u.id_utilizador}</td>
                          <td><strong>{u.nome}</strong><br /><span style={{fontSize: '0.75rem', color: '#8a8480'}}>{u.perfis}</span></td>
                          <td>{u.email}</td>
                          <td>********</td>
                          <td>{u.telefone || '—'}</td>
                          <td>
                            <span className={`badge badge--${isAtivo ? 'green' : 'orange'}`}>
                              {isAtivo ? 'Aceite' : 'Pendente'}
                            </span>
                          </td>
                          <td>{new Date(u.data_criacao).toLocaleDateString('pt-PT')}</td>
                          <td>
                              {/* BOTÃO PARA ACEITAR SE NÃO ESTIVER ATIVO */}
                              {!isAtivo ? (
                                  <button className="btn-sm btn-sm--green" style={{ backgroundColor: 'var(--green)', color: 'white' }} onClick={() => handleAceitarUsuario(u.id_utilizador)}>
                                      Aceitar
                                  </button>
                              ) : (
                                  <span style={{ fontSize: '0.8rem', color: '#8a8480' }}>✓ Aprovado</span>
                              )}
                          </td>
                        </tr>
                    );
                  })}
                  {usuarios.length === 0 && (
                    <tr><td colSpan={8} className="empty-row">Nenhum utilizador encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </Section>
          </div>
        )}

      </main>
    </div>
  );
}