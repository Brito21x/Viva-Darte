import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import logoImg from '../../assets/logo.png'; 

const API_URL = 'http://localhost:3000';

function traduzErroCoaching(err, fallback) {
  const msg = String(err?.message || '').trim();
  if (!msg) return fallback;
  const low = msg.toLowerCase();
  if (
    low.includes('fora da disponibilidade') ||
    low.includes('não tem disponibilidade') ||
    low.includes('nao tem disponibilidade')
  ) {
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
  if (!res.ok) {
    throw new Error(data?.mensagem || data?.error || 'Erro na operação');
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
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [msg, setMsg] = useState('');

  const [modalUser, setModalUser] = useState({ isOpen: false, mode: 'create', data: {} });
  const [modalAprovacao, setModalAprovacao] = useState({
    isOpen: false,
    pedido: null,
    professores: [],
    salas: [],
    idProfessor: '',
    idSala: '',
    valorFinal: '',
    isSaving: false,
    erro: ''
  });

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
      if (Array.isArray(usersData)) setUtilizadores(usersData);
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

  const pendentes = utilizadores.filter(u => u.ativo === false || u.ativo === 0);
  const aceites = utilizadores.filter(u => u.ativo === true || u.ativo === 1);

  const profs = aceites.filter(u => u.perfis && u.perfis.toLowerCase().includes('prof'));
  const encarregados = aceites.filter(u => u.perfis && (u.perfis.toLowerCase().includes('encarregado') || u.perfis.toLowerCase().includes('educação') || u.perfis === 'EE'));
  const adminsEOutros = aceites.filter(u => u.perfis && !u.perfis.toLowerCase().includes('prof') && !u.perfis.toLowerCase().includes('encarregado') && !u.perfis.toLowerCase().includes('educação') && u.perfis !== 'EE');

  const renderTabelaUtilizadores = (listaUtilizadores) => (
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th><th>Nome</th><th>Email</th><th>Telefone</th><th>Estado</th>
          <th>Criação</th><th style={{ textAlign: 'center' }}>Ações</th> 
        </tr>
      </thead>
      <tbody>
        {listaUtilizadores.map(u => {
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
                            <button className="btn-sm btn-sm--green" style={{ backgroundColor: 'var(--green)', color: 'white', marginRight: '8px' }} onClick={() => handleAceitarUtilizador(u.id_utilizador)}>Aceitar</button>
                            <button className="btn-sm btn-sm--danger" style={{ backgroundColor: '#e74c3c', color: 'white', marginRight: '8px' }} onClick={() => handleEliminarUtilizador(u.id_utilizador)}>Eliminar</button>
                        </>
                    ) : (
                        <button className="btn-sm btn-sm--danger" style={{ marginRight: '8px' }} onClick={() => handleRevogarUtilizador(u.id_utilizador)}>Suspender</button>
                    )}
                    <button className="btn-sm btn-sm--primary" onClick={() => abrirModalEditar(u)}>Editar</button>
                </td>
              </tr>
          );
        })}
        {listaUtilizadores.length === 0 && ( <tr><td colSpan={7} className="empty-row" style={{ textAlign: 'center', padding: '20px' }}>Vazio.</td></tr> )}
      </tbody>
    </table>
  );

  async function handleRejeitarPedido(idPedido) {
    const justificacao = window.prompt('Indica a justificação da rejeição:');
    if (!justificacao) return;
    try {
      await apiFetchChecked(`/api/coaching/pedidos/${idPedido}/rejeitar`, token, {
        method: 'POST',
        body: { justificacao }
      });
      mostrarMsg('Pedido rejeitado com sucesso.', 'ok');
      carregarDados();
    } catch (e) {
      mostrarMsg(e.message || 'Erro ao rejeitar pedido.', 'erro');
    }
  }

  async function handleAprovarPedido(pedido) {
    try {
      const dataAula = formatDataApi(pedido.data_aula_pretendida);
      const horaInicio = formatHoraCurta(pedido.hora_inicio_pretendida);
      if (!dataAula || horaInicio === '—') {
        throw new Error('Data/hora do pedido inválida.');
      }
      const params = new URLSearchParams({
        idModalidade: String(pedido.id_modalidade),
        dataAula,
        horaInicio,
        duracaoMinutos: String(pedido.duracao_minutos)
      }).toString();
      const [profsDisponiveis, salas] = await Promise.all([
        apiFetchChecked(`/api/coaching/professores-disponiveis?${params}`, token),
        apiFetchChecked(`/api/escola/modalidades/${pedido.id_modalidade}/salas`, token)
      ]);
      const profs = Array.isArray(profsDisponiveis) ? profsDisponiveis : [];
      const profDesejadoDisponivel = pedido.id_professor_desejado
        ? profs.some((p) => String(p.id_professor) === String(pedido.id_professor_desejado))
        : false;
      const profSug = profDesejadoDisponivel ? pedido.id_professor_desejado : profs?.[0]?.id_professor || '';
      const salaSug = salas?.[0]?.id_sala || '';
      const valorSug = Number(pedido.custo_estimado || 0).toFixed(2);
      setModalAprovacao({
        isOpen: true,
        pedido,
        professores: profs,
        salas: Array.isArray(salas) ? salas : [],
        idProfessor: String(profSug || ''),
        idSala: String(salaSug || ''),
        valorFinal: String(valorSug),
        isSaving: false,
        erro: profs.length === 0 ? 'Não há professores com disponibilidade nesse horário.' : ''
      });
    } catch (e) {
      mostrarMsg(e.message || 'Erro ao aprovar pedido.', 'erro');
    }
  }

  function fecharModalAprovacao() {
    setModalAprovacao({
      isOpen: false,
      pedido: null,
      professores: [],
      salas: [],
      idProfessor: '',
      idSala: '',
      valorFinal: '',
      isSaving: false,
      erro: ''
    });
  }

  async function confirmarAprovacaoPedido() {
    if (!modalAprovacao.pedido) return;
    if (!modalAprovacao.idProfessor || !modalAprovacao.idSala || !modalAprovacao.valorFinal) {
      setModalAprovacao((m) => ({ ...m, erro: 'Seleciona professor, sala e valor final.' }));
      return;
    }
    const valorNormalizado = Number(String(modalAprovacao.valorFinal).replace(',', '.'));
    if (!Number.isFinite(valorNormalizado) || valorNormalizado <= 0) {
      setModalAprovacao((m) => ({ ...m, erro: 'Valor final inválido.' }));
      return;
    }
    setModalAprovacao((m) => ({ ...m, isSaving: true, erro: '' }));
    try {
      await apiFetchChecked(`/api/coaching/pedidos/${modalAprovacao.pedido.id_pedido_coaching}/aprovar`, token, {
        method: 'POST',
        body: {
          idProfessor: Number(modalAprovacao.idProfessor),
          idSala: Number(modalAprovacao.idSala),
          valorFinal: valorNormalizado
        }
      });
      fecharModalAprovacao();
      mostrarMsg('Pedido aprovado e coaching agendado.', 'ok');
      carregarDados();
    } catch (e) {
      setModalAprovacao((m) => ({
        ...m,
        isSaving: false,
        erro: traduzErroCoaching(e, 'Erro ao aprovar pedido.')
      }));
    }
  }

  const renderTabelaPedidos = (lista) => (
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th><th>Data</th><th>Hora</th><th>Modalidade</th><th>Formato</th><th>Professor</th><th>EE</th><th>Alunos</th><th>Custo</th><th style={{ textAlign: 'center' }}>Ações</th>
        </tr>
      </thead>
      <tbody>
        {lista.map((p) => (
          <tr key={p.id_pedido_coaching}>
            <td>{p.id_pedido_coaching}</td>
            <td>{new Date(p.data_aula_pretendida).toLocaleDateString('pt-PT')}</td>
            <td>{formatHoraCurta(p.hora_inicio_pretendida)}</td>
            <td>{p.modalidade || `#${p.id_modalidade}`}</td>
            <td>{p.formato_aula} ({p.duracao_minutos}m)</td>
            <td>{p.professor_desejado || 'Sem preferência'}</td>
            <td>{p.requisitante}<br /><span style={{ opacity: 0.7, fontSize: '0.78rem' }}>{p.email_requisitante}</span></td>
            <td>{p.total_alunos || 0}</td>
            <td><strong>{Number(p.custo_estimado || 0).toFixed(2)} EUR</strong></td>
            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
              <button className="btn-sm btn-sm--green" style={{ marginRight: 8 }} onClick={() => handleAprovarPedido(p)}>Aprovar</button>
              <button className="btn-sm btn-sm--danger" onClick={() => handleRejeitarPedido(p.id_pedido_coaching)}>Rejeitar</button>
            </td>
          </tr>
        ))}
        {lista.length === 0 && (<tr><td colSpan={10} className="empty-row">Sem pedidos pendentes.</td></tr>)}
      </tbody>
    </table>
  );

  const tabs = [
    { id: 'overview', label: '🏠 Visão Geral' },
    { id: 'utilizadores', label: '👥 Utilizadores' },
    { id: 'coaching', label: '🗓️ Pedidos Coaching' }
  ];
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
              {t.id === 'utilizadores' && pendentes.length > 0 && (<span style={{ marginLeft: '8px', background: 'var(--red)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{pendentes.length}</span>)}
              {t.id === 'coaching' && pedidosPendentes.length > 0 && (<span style={{ marginLeft: '8px', background: 'var(--teal)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{pedidosPendentes.length}</span>)}
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
              <StatCard icon="👥" label="Total Utilizadores" value={utilizadores.length} accent="blue" />
              <StatCard icon="⏳" label="Por Aprovar" value={pendentes.length} accent="orange" />
              <StatCard icon="🗓️" label="Pedidos Coaching" value={pedidosPendentes.length} accent="teal" />
            </div>
          </div>
        )}

        {activeTab === 'utilizadores' && (
          <div className="tab-content">
            <h1 className="page-title">👥 Gestão de Utilizadores</h1>

            <Section title={`⏳ Pendentes (${pendentes.length})`} icon="🚨" defaultOpen={true}>
              {renderTabelaUtilizadores(pendentes)}
            </Section>

            <Section 
              title={`👨‍👩‍👧‍👦 Encarregados de Educação (${encarregados.length})`} 
              icon="👪" defaultOpen={true}
              actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('EE'); }}>+ Novo</button>}
            >
              {renderTabelaUtilizadores(encarregados)}
            </Section>

            <Section 
              title={`👩‍🏫 Professores (${profs.length})`} 
              icon="🎭" defaultOpen={true}
              actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('PROF'); }}>+ Novo</button>}
            >
              {renderTabelaUtilizadores(profs)}
            </Section>

            <Section 
              title={`🛡️ Administração (${adminsEOutros.length})`} 
              icon="⚙️" defaultOpen={true}
              actionButton={<button className="btn-sm btn-sm--primary" onClick={(e) => { e.stopPropagation(); abrirModalCriar('ADMIN'); }}>+ Novo</button>}
            >
              {renderTabelaUtilizadores(adminsEOutros)}
            </Section>

          </div>
        )}

        {activeTab === 'coaching' && (
          <div className="tab-content">
            <h1 className="page-title">🗓️ Pedidos de Coaching Pendentes</h1>
            <p className="page-subtitle">Aprovar agendação ou rejeitar pedidos enviados.</p>
            <Section title={`⏳ Pendentes (${pedidosPendentes.length})`} icon="🎯" defaultOpen={true}>
              {renderTabelaPedidos(pedidosPendentes)}
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

      {modalAprovacao.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '16px', width: '92%', maxWidth: '620px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', fontFamily: "'Poppins', sans-serif" }}>
            <h2 style={{ marginBottom: '14px', fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', color: '#333' }}>
              Aprovar Pedido #{modalAprovacao.pedido?.id_pedido_coaching}
            </h2>
            <p style={{ marginTop: 0, color: '#7b756f' }}>
              {modalAprovacao.pedido?.modalidade} • {modalAprovacao.pedido?.formato_aula} ({modalAprovacao.pedido?.duracao_minutos} min)
            </p>

            <div className="form-grid">
              <div className="field">
                <label>Professor</label>
                <select value={modalAprovacao.idProfessor} onChange={(e) => setModalAprovacao((m) => ({ ...m, idProfessor: e.target.value }))}>
                  <option value="">Selecionar professor</option>
                  {modalAprovacao.professores.map((p) => (
                    <option key={p.id_professor} value={p.id_professor}>{p.nome_professor}</option>
                  ))}
                </select>
                <small style={{ display: 'block', marginTop: 6, opacity: 0.7 }}>
                  Só aparecem professores disponíveis para a data/hora do pedido.
                </small>
              </div>
              <div className="field">
                <label>Sala</label>
                <select value={modalAprovacao.idSala} onChange={(e) => setModalAprovacao((m) => ({ ...m, idSala: e.target.value }))}>
                  <option value="">Selecionar sala</option>
                  {modalAprovacao.salas.map((s) => (
                    <option key={s.id_sala} value={s.id_sala}>{s.nome_sala || s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Valor final (EUR)</label>
                <input type="number" step="0.01" min="0" value={modalAprovacao.valorFinal} onChange={(e) => setModalAprovacao((m) => ({ ...m, valorFinal: e.target.value }))} />
              </div>
            </div>

            {modalAprovacao.erro && (
              <div className="info-note" style={{ marginTop: '14px', borderLeftColor: 'var(--red)', backgroundColor: '#fce8e8', color: 'var(--red)' }}>
                {modalAprovacao.erro}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '22px' }}>
              <button type="button" className="btn-sm" style={{ backgroundColor: '#f1f1f1', color: '#555' }} onClick={fecharModalAprovacao}>
                Cancelar
              </button>
              <button type="button" className="btn-sm btn-sm--green" onClick={confirmarAprovacaoPedido} disabled={modalAprovacao.isSaving}>
                {modalAprovacao.isSaving ? 'A aprovar…' : 'Confirmar Aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (<div className={`toast toast--${msg.tipo}`} style={{ zIndex: 99999 }}>{msg.texto}</div>)}

    </div>
  );
}