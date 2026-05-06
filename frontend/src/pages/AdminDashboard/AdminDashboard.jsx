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

function Section({ title, icon, children, defaultOpen = false, actionButton = null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="admin-section">
      <div className="section-toggle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
              <span>{icon} {title}</span>
              <span className={`chevron ${open ? 'chevron--open' : ''}`} style={{ marginLeft: '12px' }}>›</span>
          </div>
          {actionButton && <div style={{ marginLeft: '15px' }}>{actionButton}</div>}
      </div>
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

  const [modalUser, setModalUser] = useState({ isOpen: false, mode: 'create', data: {} });

  useEffect(() => {
    document.title = "Painel Admin | Viva D'arte";
    const userGuardado = localStorage.getItem('viva_user');
    const tkGuardado = localStorage.getItem('token'); 
    if (userGuardado && tkGuardado) { 
        const user = JSON.parse(userGuardado);
        const perfisPermitidos = ['Admin', 'Administrador', 'Coordenação', 'Coordenacao'];
        if (perfisPermitidos.includes(user.perfil) || user.id_perfil === 1 || user.id_perfil === "1") { 
            setUtilizador(user); setToken(tkGuardado); setIsAuthorized(true);
        }
    }
  }, []);

  useEffect(() => {
    if (!token || !isAuthorized) return;
    carregarDados();
  }, [token, isAuthorized]);

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoginError(''); setIsLoggingIn(true);
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, tipo: 'ADMIN', perfil: 'ADMIN' }) 
        });
        const data = await response.json();
        if (response.ok) {
            const user = data.utilizador || data.user; 
            const tk = data.token;
            if (user.id_perfil === 1 || user.id_perfil === "1" || user.perfil === 'Admin') {
                user.perfil = 'Admin';
                localStorage.setItem('viva_user', JSON.stringify(user));
                localStorage.setItem('token', tk);
                setUtilizador(user); setToken(tk); setIsAuthorized(true); 
            } else { setLoginError("Acesso negado."); }
        } else { setLoginError(data.mensagem || data.error || "Credenciais incorretas."); }
    } catch (err) { setLoginError("Erro de ligação."); } finally { setIsLoggingIn(false); }
  }

  async function carregarDados() {
    try {
      const usersData = await apiFetch('/api/auth/utilizadores', token).catch(() => []);
      if (Array.isArray(usersData)) setUsuarios(usersData);
    } catch (e) { mostrarMsg('Erro ao carregar dados.', 'erro'); }
  }

  function mostrarMsg(texto, tipo = 'ok') {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(''), 3500);
  }

  async function handleAceitarUsuario(id) {
      if(!window.confirm("Aprovar entrada deste utilizador?")) return;
      try {
          const res = await fetch(`${API_URL}/api/auth/utilizadores/${id}/ativar`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) { mostrarMsg("Utilizador aceite!", 'ok'); carregarDados(); } 
          else { mostrarMsg("Erro ao aprovar.", 'erro'); }
      } catch (err) { mostrarMsg("Erro de rede.", 'erro'); }
  }

  async function handleRevogarUsuario(id) {
      if(!window.confirm("Tens a certeza que queres REVOGAR o acesso deste utilizador?")) return;
      try {
          const res = await fetch(`${API_URL}/api/auth/utilizadores/${id}/desativar`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) { mostrarMsg("Acesso revogado!", 'ok'); carregarDados(); } 
          else { mostrarMsg("Erro ao revogar acesso.", 'erro'); }
      } catch (err) { mostrarMsg("Erro de rede.", 'erro'); }
  }

  // NOVA FUNÇÃO: ELIMINAR
  async function handleEliminarUsuario(id) {
      if(!window.confirm("Tens a certeza ABSOLUTA que queres ELIMINAR PERMANENTEMENTE este pedido?")) return;
      try {
          const res = await fetch(`${API_URL}/api/auth/utilizadores/${id}`, {
              method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) { mostrarMsg("Registo apagado para sempre!", 'ok'); carregarDados(); } 
          else {
              const data = await res.json();
              mostrarMsg(data.mensagem || "Erro ao eliminar.", 'erro'); 
          }
      } catch (err) { mostrarMsg("Erro de rede.", 'erro'); }
  }

  function abrirModalCriar(tipoRecomendado) {
      setModalUser({ 
          isOpen: true, 
          mode: 'create', 
          data: { nome: '', email: '', telefone: '', password: '', tipo: tipoRecomendado } 
      });
  }

  function abrirModalEditar(u) {
      let tipoBase = 'EE';
      if (u.perfis?.toLowerCase().includes('prof')) tipoBase = 'PROF';
      if (u.perfis?.toLowerCase().includes('admin') || u.perfis?.toLowerCase().includes('coord')) tipoBase = 'ADMIN';

      setModalUser({
          isOpen: true,
          mode: 'edit',
          data: { id: u.id_utilizador, nome: u.nome, email: u.email, telefone: u.telefone || '', password: '', tipo: tipoBase }
      });
  }

  function fecharModal() { setModalUser({ isOpen: false, mode: 'create', data: {} }); }

  async function submeterModal(e) {
      e.preventDefault();
      const { email, telefone, password } = modalUser.data;

      if (!email.includes('@')) { return mostrarMsg("O email tem de conter um '@'.", 'erro'); }

      let telLimpo = '';
      if (telefone) {
          telLimpo = telefone.replace(/\D/g, ''); 
          if (telLimpo.length !== 9) { return mostrarMsg("O número de telefone tem de ter exatamente 9 dígitos.", 'erro'); }
      }

      if (password && password.trim() !== '') {
          const regexEspecial = /[!@#$%^&*(),.?":{}|<>]/;
          if (password.length < 8) { return mostrarMsg("A password tem de ter no mínimo 8 caracteres.", 'erro'); }
          if (!regexEspecial.test(password)) { return mostrarMsg("A password tem de conter pelo menos 1 carácter especial (ex: ! @ # $).", 'erro'); }
      } else if (modalUser.mode === 'create') {
          return mostrarMsg("A password é obrigatória na criação de conta.", 'erro');
      }

      const payloadEnvio = { ...modalUser.data, telefone: telLimpo };
      const isEdit = modalUser.mode === 'edit';
      const endpoint = isEdit ? `/api/auth/utilizadores/${modalUser.data.id}` : `/api/auth/utilizadores`;
      const method = isEdit ? 'PUT' : 'POST';

      try {
          const res = await fetch(`${API_URL}${endpoint}`, {
              method,
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify(payloadEnvio)
          });
          const result = await res.json();
          if (res.ok) {
              mostrarMsg(result.mensagem || "Sucesso!", 'ok');
              fecharModal();
              carregarDados();
          } else { mostrarMsg(result.mensagem || result.error || "Ocorreu um erro.", 'erro'); }
      } catch (err) { mostrarMsg("Erro de ligação.", 'erro'); }
  }

  if (!isAuthorized) {
      return (
          <div className="admin-root" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-section)' }}>
              <div className="admin-section" style={{ padding: '40px', maxWidth: '420px', width: '90%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
                  <img src={logoImg} alt="Logo" style={{ display: 'block', margin: '0 auto 20px auto', width: '120px' }} />
                  <h2 className="page-title" style={{ fontSize: '1.6rem', marginBottom: '8px' }}>Painel Restrito</h2>
                  <p className="page-subtitle" style={{ marginBottom: '30px' }}>Acesso exclusivo à Administração</p>
                  <form className="admin-form" onSubmit={handleAdminLogin} style={{ textAlign: 'left' }}>
                      {loginError && (<div className="info-note" style={{ borderLeftColor: 'var(--red)', backgroundColor: '#fce8e8', color: 'var(--red)' }}>{loginError}</div>)}
                      <div className="field">
                          <label>Email / Username</label>
                          <input type="text" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
                      </div>
                      <div className="field" style={{ marginBottom: '20px' }}>
                          <label>Palavra-passe</label>
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                      </div>
                      <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }}>Entrar</button>
                  </form>
                  <button style={{ marginTop: '24px', background: 'none', border: 'none', color: '#8a8480', cursor: 'pointer', textDecoration: 'underline' }} onClick={irParaLanding}>Voltar ao site</button>
              </div>
          </div>
      );
  }

  const pendentes = usuarios.filter(u => u.ativo === false || u.ativo === 0);
  const aceites = usuarios.filter(u => u.ativo === true || u.ativo === 1);

  const profs = aceites.filter(u => u.perfis && u.perfis.toLowerCase().includes('prof'));
  const encarregados = aceites.filter(u => u.perfis && (u.perfis.toLowerCase().includes('encarregado') || u.perfis.toLowerCase().includes('educação') || u.perfis === 'EE'));
  const adminsEOutros = aceites.filter(u => u.perfis && !u.perfis.toLowerCase().includes('prof') && !u.perfis.toLowerCase().includes('encarregado') && !u.perfis.toLowerCase().includes('educação') && u.perfis !== 'EE');

  const renderTabelaUsuarios = (listaUsuarios) => (
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th><th>Nome</th><th>Email</th><th>Telefone</th><th>Estado</th>
          <th>Criação</th><th style={{ textAlign: 'center' }}>Ações</th> 
        </tr>
      </thead>
      <tbody>
        {listaUsuarios.map(u => {
          const isAtivo = u.ativo === true || u.ativo === 1;
          return (
              <tr key={u.id_utilizador} style={{ backgroundColor: !isAtivo ? '#fffbf0' : 'transparent' }}>
                <td>{u.id_utilizador}</td>
                <td><strong>{u.nome}</strong></td>
                <td>{u.email}</td><td>{u.telefone || '—'}</td>
                <td><span className={`badge badge--${isAtivo ? 'green' : 'orange'}`}>{isAtivo ? 'Ativo' : 'Pendente'}</span></td>
                <td>{new Date(u.data_criacao).toLocaleDateString('pt-PT')}</td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {!isAtivo ? (
                        <>
                            <button className="btn-sm btn-sm--green" style={{ backgroundColor: 'var(--green)', color: 'white', marginRight: '8px' }} onClick={() => handleAceitarUsuario(u.id_utilizador)}>Aceitar</button>
                            <button className="btn-sm btn-sm--danger" style={{ backgroundColor: '#e74c3c', color: 'white', marginRight: '8px' }} onClick={() => handleEliminarUsuario(u.id_utilizador)}>Eliminar</button>
                        </>
                    ) : (
                        <button className="btn-sm btn-sm--danger" style={{ marginRight: '8px' }} onClick={() => handleRevogarUsuario(u.id_utilizador)}>Suspender</button>
                    )}
                    <button className="btn-sm btn-sm--primary" onClick={() => abrirModalEditar(u)}>Editar</button>
                </td>
              </tr>
          );
        })}
        {listaUsuarios.length === 0 && ( <tr><td colSpan={7} className="empty-row" style={{ textAlign: 'center', padding: '20px' }}>Vazio.</td></tr> )}
      </tbody>
    </table>
  );

  const tabs = [ { id: 'overview', label: '🏠 Visão Geral' }, { id: 'usuarios', label: '👥 Usuários' } ];
  const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Poppins', sans-serif" };
  const inputStyle = { width: '100%', padding: '12px 14px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '0.95rem', fontFamily: "'Poppins', sans-serif", backgroundColor: '#faf9f7', outline: 'none', transition: 'border 0.3s' };

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img src={logoImg} alt="Logo" style={{ width: '65px', height: 'auto', objectFit: 'contain' }} />
          <div><p className="brand-name">Viva D'arte</p><p className="brand-role">Coordenação</p></div>
        </div>
        <nav className="sidebar-nav">
          {tabs.map(t => (
            <button key={t.id} className={`nav-item ${activeTab === t.id ? 'nav-item--active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.label}
              {t.id === 'usuarios' && pendentes.length > 0 && (<span style={{ marginLeft: '8px', background: 'var(--red)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{pendentes.length}</span>)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-user">{utilizador?.nome}</p>
          <button className="sidebar-logout" onClick={() => { localStorage.clear(); irParaLanding(); }}>Sair</button>
        </div>
      </aside>

      <main className="admin-main">
        {activeTab === 'overview' && (
          <div className="tab-content">
            <h1 className="page-title">Olá, {utilizador?.nome?.split(' ')[0]} 👋</h1>
            <p className="page-subtitle">Resumo do sistema</p>
            <div className="stats-grid">
              <StatCard icon="👥" label="Total Utilizadores" value={usuarios.length} accent="blue" />
              <StatCard icon="⏳" label="Por Aprovar" value={pendentes.length} accent="orange" />
            </div>
          </div>
        )}

        {activeTab === 'usuarios' && (
          <div className="tab-content">
            <h1 className="page-title">👥 Gestão de Usuários</h1>

            <Section title={`⏳ Pendentes (${pendentes.length})`} icon="🚨" defaultOpen={true}>
              {renderTabelaUsuarios(pendentes)}
            </Section>

            <Section 
              title={`👨‍👩‍👧‍👦 Encarregados de Educação (${encarregados.length})`} 
              icon="👪" defaultOpen={true}
              actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('EE'); }}>+ Novo</button>}
            >
              {renderTabelaUsuarios(encarregados)}
            </Section>

            <Section 
              title={`👩‍🏫 Professores (${profs.length})`} 
              icon="🎭" defaultOpen={true}
              actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('PROF'); }}>+ Novo</button>}
            >
              {renderTabelaUsuarios(profs)}
            </Section>

            <Section 
              title={`🛡️ Administração (${adminsEOutros.length})`} 
              icon="⚙️" defaultOpen={true}
              actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('ADMIN'); }}>+ Novo</button>}
            >
              {renderTabelaUsuarios(adminsEOutros)}
            </Section>

          </div>
        )}
      </main>

      {modalUser.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', width: '90%', maxWidth: '540px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', fontFamily: "'Poppins', sans-serif" }}>
                
                <h2 style={{ marginBottom: '25px', fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', color: '#333', borderBottom: '2px solid #f0f0f0', paddingBottom: '15px' }}>
                    {modalUser.mode === 'create' ? '✨ Criar Novo Utilizador' : '✏️ Editar Utilizador'}
                </h2>
                
                <form onSubmit={submeterModal}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Nome Completo *</label>
                        <input style={inputStyle} type="text" value={modalUser.data.nome} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, nome: e.target.value } })} required />
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyle}>Email *</label>
                        <input style={inputStyle} type="text" placeholder="exemplo@viva.pt" value={modalUser.data.email} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, email: e.target.value } })} required />
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Telefone</label>
                            <input style={inputStyle} type="text" placeholder="912345678" value={modalUser.data.telefone} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, telefone: e.target.value } })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Perfil de Acesso *</label>
                            <select style={{...inputStyle, cursor: 'pointer'}} value={modalUser.data.tipo} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, tipo: e.target.value } })}>
                                <option value="EE">Encarregado de Educação</option>
                                <option value="PROF">Professor</option>
                                <option value="ADMIN">Administrador</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '35px' }}>
                        <label style={labelStyle}>
                            Palavra-passe 
                            {modalUser.mode === 'edit' && <span style={{fontSize: '0.7rem', color: '#999', marginLeft: '6px', textTransform: 'none'}}>(Deixe em branco para manter)</span>}
                        </label>
                        <input style={inputStyle} type="password" placeholder={modalUser.mode === 'create' ? "Mín. 8 caracteres e 1 especial" : "••••••••"} value={modalUser.data.password} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, password: e.target.value } })} />
                    </div>

                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                        <button type="button" style={{ padding: '12px 24px', backgroundColor: '#f1f1f1', color: '#555', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontFamily: "'Poppins', sans-serif" }} onClick={fecharModal}>
                            Cancelar
                        </button>
                        <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#3d342b', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontFamily: "'Poppins', sans-serif" }}>
                            Guardar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {msg && (<div className={`toast toast--${msg.tipo}`} style={{ zIndex: 99999 }}>{msg.texto}</div>)}

    </div>
  );
}