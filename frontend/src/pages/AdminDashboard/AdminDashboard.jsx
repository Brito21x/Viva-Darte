import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import logoImg from '../../assets/logo.png'; 

const API_URL = 'http://localhost:3000';

function traduzErroCoaching(err, fallback) {
  const msg = String(err?.message || '').trim();
  if (!msg) return fallback;
  const low = msg.toLowerCase();
  if (low.includes('fora da disponibilidade') || low.includes('não tem disponibilidade') || low.includes('nao tem disponibilidade')) {
    return 'Professor sem disponibilidade no horário escolhido.';
  }
  if (low.includes('ocorreu um erro interno') || low.includes('erro interno')) {
    return 'Não foi possível aprovar. O horário pode estar fora da disponibilidade do professor.';
  }
  return msg;
}

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

async function apiFetchChecked(path, token, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.mensagem || data?.error || 'Erro na operação');
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

function Section({ title, icon, children, defaultOpen = false, actionButton = null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="admin-section">
      <div className="section-toggle">
          <div className="section-header-title" onClick={() => setOpen(o => !o)}>
              <span>{icon} {title}</span>
              <span className={`chevron ${open ? 'chevron--open' : ''}`}>›</span>
          </div>
          {actionButton && <div className="section-header-actions">{actionButton}</div>}
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function formatHoraCurta(valor) {
  const s = String(valor || '').trim();
  if (!s) return '—';
  const m = s.match(/(\d{2}):(\d{2})(?::\d{2})?/);
  if (m) return `${m[1]}:${m[2]}`;
  return '—';
}

function formatDataApi(valor) {
  if (!valor) return '';
  const iso = String(valor).split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

  const [utilizadores, setUtilizadores] = useState([]); 
  const [allModalidades, setAllModalidades] = useState([]); 
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [msg, setMsg] = useState('');

  const [modalUser, setModalUser] = useState({ isOpen: false, mode: 'create', data: {} });
  const [modalMods, setModalMods] = useState({ isOpen: false, userId: null, selectedIds: [] });

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
      const [usersData, modalidadesData] = await Promise.all([
          apiFetch('/api/auth/utilizadores', token).catch(() => []),
          apiFetch('/api/escola/modalidades', token).catch(() => [])
      ]);
      if (Array.isArray(usersData)) setUtilizadores(usersData);
      if (Array.isArray(modalidadesData)) setAllModalidades(modalidadesData);

      const pedidos = await apiFetch('/api/coaching/pedidos/pendentes', token).catch(() => []);
      if (Array.isArray(pedidos)) setPedidosPendentes(pedidos);
    } catch (e) { mostrarMsg('Erro ao carregar dados.', 'erro'); }
  }

  function mostrarMsg(texto, tipo = 'ok') {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(''), 3500);
  }

  async function handleAceitarUtilizador(id) {
      if(!window.confirm("Aprovar entrada deste utilizador?")) return;
      try {
          const res = await fetch(`${API_URL}/api/auth/utilizadores/${id}/ativar`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) { mostrarMsg("Utilizador aceite!", 'ok'); carregarDados(); } 
          else { mostrarMsg("Erro ao aprovar.", 'erro'); }
      } catch (err) { mostrarMsg("Erro de rede.", 'erro'); }
  }

  async function handleRevogarUtilizador(id) {
      if(!window.confirm("Tens a certeza que queres REVOGAR o acesso deste utilizador?")) return;
      try {
          const res = await fetch(`${API_URL}/api/auth/utilizadores/${id}/desativar`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) { mostrarMsg("Acesso revogado!", 'ok'); carregarDados(); } 
          else { mostrarMsg("Erro ao revogar acesso.", 'erro'); }
      } catch (err) { mostrarMsg("Erro de rede.", 'erro'); }
  }

  async function handleEliminarUtilizador(id) {
      if(!window.confirm("Tens a certeza ABSOLUTA que queres ELIMINAR PERMANENTEMENTE este pedido?")) return;
      try {
          const res = await fetch(`${API_URL}/api/auth/utilizadores/${id}`, {
              method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) { mostrarMsg("Registo apagado para sempre!", 'ok'); carregarDados(); } 
          else { const data = await res.json(); mostrarMsg(data.mensagem || "Erro ao eliminar.", 'erro'); }
      } catch (err) { mostrarMsg("Erro de rede.", 'erro'); }
  }

  function abrirModalCriar(tipoRecomendado) {
      setModalUser({ 
          isOpen: true, 
          mode: 'create', 
          data: { nome: '', email: '', telefone: '', password: '', tipo: tipoRecomendado, nomeAluno: '', dataNascimentoAluno: '' } 
      });
  }

  function abrirModalEditar(u) {
      let tipoBase = 'EE';
      if (u.perfis?.toLowerCase().includes('prof')) tipoBase = 'PROF';
      if (u.perfis?.toLowerCase().includes('admin') || u.perfis?.toLowerCase().includes('coord')) tipoBase = 'ADMIN';

      setModalUser({
          isOpen: true,
          mode: 'edit',
          data: { 
              id: u.id_utilizador, 
              nome: u.nome, 
              email: u.email, 
              telefone: u.telefone || '', 
              password: '', 
              tipo: tipoBase,
              nomeAluno: u.nomeAluno || '',
              dataNascimentoAluno: u.dataNascimentoAluno ? formatDataApi(u.dataNascimentoAluno) : ''
          }
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

  function abrirModalModalidades(u) {
      const uMods = typeof u.modalidades === 'string' ? u.modalidades.split(', ') : [];
      const preSelected = allModalidades
          .filter(m => uMods.includes(m.nome))
          .map(m => m.id_modalidade);

      setModalMods({ isOpen: true, userId: u.id_utilizador, selectedIds: preSelected });
  }

  async function guardarModalidades() {
      try {
          const res = await fetch(`${API_URL}/api/auth/utilizadores/${modalMods.userId}/modalidades`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ idsModalidades: modalMods.selectedIds })
          });
          if (res.ok) {
              mostrarMsg("Modalidades atualizadas!", 'ok');
              setModalMods({ isOpen: false, userId: null, selectedIds: [] });
              carregarDados();
          } else {
              mostrarMsg("Erro ao salvar modalidades.", 'erro');
          }
      } catch (e) { mostrarMsg("Erro de rede.", 'erro'); }
  }

  if (!isAuthorized) {
      return (
          <div className="admin-login-wrapper">
              <div className="admin-login-box">
                  <img src={logoImg} alt="Logo" className="admin-login-logo" />
                  <h2 className="admin-login-title">Painel Restrito</h2>
                  <p className="admin-login-subtitle">Acesso exclusivo à Administração</p>
                  
                  <form className="admin-form" onSubmit={handleAdminLogin}>
                      {loginError && (<div className="info-note info-note--error">{loginError}</div>)}
                      <div className="field">
                          <label>Email / Username</label>
                          <input type="text" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
                      </div>
                      <div className="field">
                          <label>Palavra-passe</label>
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                      </div>
                      <button type="submit" className="btn-primary w-full p-14">Entrar</button>
                  </form>
                  
                  <button className="btn-text-link" onClick={irParaLanding}>Voltar ao site</button>
              </div>
          </div>
      );
  }

  const pendentes = utilizadores.filter(u => u.ativo === false || u.ativo === 0);
  const aceites = utilizadores.filter(u => u.ativo === true || u.ativo === 1);

  const profs = aceites.filter(u => u.perfis && u.perfis.toLowerCase().includes('prof'));
  const encarregados = aceites.filter(u => u.perfis && (u.perfis.toLowerCase().includes('encarregado') || u.perfis.toLowerCase().includes('educação') || u.perfis === 'EE'));
  const adminsEOutros = aceites.filter(u => u.perfis && !u.perfis.toLowerCase().includes('prof') && !u.perfis.toLowerCase().includes('encarregado') && !u.perfis.toLowerCase().includes('educação') && u.perfis !== 'EE');

  const renderTabelaUtilizadores = (listaUtilizadores, tipoTabela) => (
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th><th>Nome</th><th>Email</th><th>Telefone</th>
          
          {tipoTabela === 'PENDENTES' && <th>Educando / Modalidades</th>}
          {tipoTabela === 'PROF' && <th>Modalidades</th>}
          {tipoTabela === 'EE' && <th>Educando</th>}

          <th>Estado</th><th>Criação</th><th className="text-center">Ações</th> 
        </tr>
      </thead>
      <tbody>
        {listaUtilizadores.map(u => {
          const isAtivo = u.ativo === true || u.ativo === 1;
          const isProf = u.perfis && u.perfis.toLowerCase().includes('prof');

          return (
              <tr key={u.id_utilizador} className={!isAtivo ? 'table-row--pending' : ''}>
                <td>{u.id_utilizador}</td>
                <td><strong>{u.nome}</strong></td>
                <td>{u.email}</td>
                <td>{u.telefone || '—'}</td>
                
                {tipoTabela === 'PENDENTES' && (
                    <td>
                      {isProf 
                        ? (u.modalidades || <span style={{opacity:0.5}}>Nenhuma</span>) 
                        : (u.nomeAluno || '—')}
                    </td>
                )}
                {tipoTabela === 'PROF' && (
                    <td>{u.modalidades || <span style={{opacity:0.5}}>Nenhuma</span>}</td>
                )}
                {tipoTabela === 'EE' && (
                    <td>{u.nomeAluno || '—'}</td>
                )}

                <td><span className={`badge badge--${isAtivo ? 'green' : 'orange'}`}>{isAtivo ? 'Ativo' : 'Pendente'}</span></td>
                <td>{new Date(u.data_criacao).toLocaleDateString('pt-PT')}</td>
                <td className="text-center whitespace-nowrap">
                    {!isAtivo ? (
                        <>
                            <button className="btn-sm btn-sm--green mr-8" onClick={() => handleAceitarUtilizador(u.id_utilizador)}>Aceitar</button>
                            <button className="btn-sm btn-sm--danger mr-8" onClick={() => handleEliminarUtilizador(u.id_utilizador)}>Eliminar</button>
                        </>
                    ) : (
                        <button className="btn-sm btn-sm--danger mr-8" onClick={() => handleRevogarUtilizador(u.id_utilizador)}>Suspender</button>
                    )}
                    
                    {isProf && isAtivo && (
                        <button className="btn-sm btn-sm--gold mr-8" onClick={() => abrirModalModalidades(u)}>Modalidades</button>
                    )}

                    <button className="btn-sm btn-sm--primary" onClick={() => abrirModalEditar(u)}>Editar</button>
                </td>
              </tr>
          );
        })}
        {listaUtilizadores.length === 0 && ( 
            <tr>
              <td colSpan={tipoTabela === 'ADMIN' ? 7 : 8} className="empty-row">Vazio.</td>
            </tr> 
        )}
      </tbody>
    </table>
  );

  const tabs = [
    { id: 'overview', label: '🏠 Visão Geral' },
    { id: 'utilizadores', label: '👥 Utilizadores' },
    { id: 'coaching', label: '🗓️ Pedidos Coaching' }
  ];

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
              {t.id === 'utilizadores' && pendentes.length > 0 && (<span className="sidebar-badge sidebar-badge--red">{pendentes.length}</span>)}
              {t.id === 'coaching' && pedidosPendentes.length > 0 && (<span className="sidebar-badge sidebar-badge--teal">{pedidosPendentes.length}</span>)}
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
            <h1 className="page-title">Olá, {utilizador?.nome?.split(' ')[0]} </h1>
            <p className="page-subtitle">Resumo do sistema</p>
            <div className="stats-grid">
              <StatCard icon="👥" label="Total Utilizadores" value={utilizadores.length} accent="blue" />
              <StatCard icon="⏳" label="Por Aprovar" value={pendentes.length} accent="orange" />
              <StatCard icon="🗓️" label="Pedidos Coaching" value={pedidosPendentes.length} accent="teal" />
            </div>
          </div>
        )}

        {activeTab === 'utilizadores' && (
          <div className="tab-content">
            <h1 className="page-title">👥 Gestão de Utilizadores</h1>

            <Section title={`Pendentes (${pendentes.length})`} defaultOpen={true}>
              {renderTabelaUtilizadores(pendentes, 'PENDENTES')}
            </Section>

            <Section title={`Encarregados de Educação (${encarregados.length})`} defaultOpen={true} actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('EE'); }}>+ Novo</button>}>
              {renderTabelaUtilizadores(encarregados, 'EE')}
            </Section>

            <Section title={`Professores (${profs.length})`} defaultOpen={true} actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('PROF'); }}>+ Novo</button>}>
              {renderTabelaUtilizadores(profs, 'PROF')}
            </Section>

            <Section title={`Administração (${adminsEOutros.length})`} defaultOpen={true} actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('ADMIN'); }}>+ Novo</button>}>
              {renderTabelaUtilizadores(adminsEOutros, 'ADMIN')}
            </Section>
          </div>
        )}
      </main>

      {/* Modal de Criar/Editar Utilizador */}
      {modalUser.isOpen && (
        <div className="admin-modal-overlay">
            <div className="admin-modal-content">
                <h2 className="admin-modal-title">
                    {modalUser.mode === 'create' ? 'Criar Novo Utilizador' : 'Editar Utilizador'}
                </h2>
                
                <form className="admin-form" onSubmit={submeterModal}>
                    {modalUser.data.tipo === 'EE' && (
                        <div className="form-group-row">
                            <div className="field form-col-2">
                                <label>Nome do Educando (Aluno)</label>
                                <input type="text" placeholder="Nome do aluno" value={modalUser.data.nomeAluno || ''} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, nomeAluno: e.target.value } })} />
                            </div>
                            <div className="field form-col-1">
                                <label>Data Nasc.</label>
                                <input type="date" value={modalUser.data.dataNascimentoAluno || ''} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, dataNascimentoAluno: e.target.value } })} />
                            </div>
                        </div>
                    )}

                    <div className="field">
                        <label>Nome Completo (Encarregado/Prof)</label>
                        <input type="text" value={modalUser.data.nome} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, nome: e.target.value } })} required />
                    </div>
                    
                    <div className="field">
                        <label>Email *</label>
                        <input type="text" placeholder="exemplo@viva.pt" value={modalUser.data.email} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, email: e.target.value } })} required />
                    </div>

                    <div className="form-group-row">
                        <div className="field form-col-1">
                            <label>Telefone</label>
                            <input type="text" placeholder="912345678" value={modalUser.data.telefone} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, telefone: e.target.value } })} />
                        </div>
                        <div className="field form-col-1">
                            <label>Perfil de Acesso *</label>
                            <select value={modalUser.data.tipo} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, tipo: e.target.value } })}>
                                <option value="EE">Encarregado de Educação</option>
                                <option value="PROF">Professor</option>
                                <option value="ADMIN">Administrador</option>
                            </select>
                        </div>
                    </div>

                    <div className="field">
                        <label>
                            Palavra-passe 
                            {modalUser.mode === 'edit' && <span className="password-hint">(Deixe em branco para manter)</span>}
                        </label>
                        <input type="password" placeholder={modalUser.mode === 'create' ? "Mín. 8 caracteres e 1 especial" : "••••••••"} value={modalUser.data.password} onChange={e => setModalUser({ ...modalUser, data: { ...modalUser.data, password: e.target.value } })} />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={fecharModal}>Cancelar</button>
                        <button type="submit" className="btn-submit">Guardar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Modal de Associação de Modalidades */}
      {modalMods.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content admin-modal-content--sm">
            <h3 className="admin-modal-title admin-modal-title--sm">Associar Modalidades</h3>
            <p className="admin-modal-subtitle">Selecione as modalidades que este professor leciona:</p>
            
            <div className="modalities-grid">
                {allModalidades.map(m => (
                    <label key={m.id_modalidade} className="check-label-styled">
                        <input 
                            type="checkbox" 
                            checked={modalMods.selectedIds.includes(m.id_modalidade)}
                            onChange={(e) => {
                                const ids = e.target.checked 
                                    ? [...modalMods.selectedIds, m.id_modalidade]
                                    : modalMods.selectedIds.filter(id => id !== m.id_modalidade);
                                setModalMods({...modalMods, selectedIds: ids});
                            }}
                        /> 
                        <span>{m.nome}</span>
                    </label>
                ))}
                {allModalidades.length === 0 && <span className="empty-modalities">Nenhuma modalidade registada no sistema.</span>}
            </div>

            <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModalMods({isOpen:false})}>Cancelar</button>
                <button type="button" className="btn-submit" onClick={guardarModalidades}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {msg && (<div className={`toast toast--${msg.tipo}`}>{msg.texto}</div>)}
    </div>
  );
}