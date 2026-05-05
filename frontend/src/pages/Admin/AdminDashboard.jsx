import React, { useState, useEffect } from 'react';
import './Admin.css';
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
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    const msg = data?.mensagem || data?.error || `Erro HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ─── Subcomponente: Cartão de estatística ────────────────────────────────────
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

// ─── Subcomponente: Secção colapsável ────────────────────────────────────────
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

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function AdminDashboard({ irParaLanding }) {
  const [utilizador, setUtilizador] = useState(null);
  const [token, setToken] = useState('');
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Faturação
  const [faturas, setFaturas] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [relatorioMes, setRelatorioMes] = useState('');
  const [relatorioAno, setRelatorioAno] = useState('');
  const [relatorio, setRelatorio] = useState(null);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Inventário
  const [catalogo, setCatalogo] = useState([]);
  const [emprestimos, setEmprestimos] = useState([]);
  const [novaPeca, setNovaPeca] = useState({
    nome: '', descricao: '', tamanho: '', estado: 'Bom',
    origem: '', localizacao: '', disponivelEmprestimo: true,
    disponivelVenda: false, idCategoria: 1,
  });

  // Pedidos de coaching
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [modalAprovar, setModalAprovar] = useState(null);
  const [salasAprovar, setSalasAprovar] = useState([]);
  const [profsAprovar, setProfsAprovar] = useState([]);
  const [formAprovar, setFormAprovar] = useState({ idSala: '', idProfessor: '', valorFinal: '' });
  const [loadingAprovarOpcoes, setLoadingAprovarOpcoes] = useState(false);
  const [submittingAprovar, setSubmittingAprovar] = useState(false);

  /** US11 / RF13 — associações na BD (PROFESSOR_MODALIDADE) */
  const [professoresUs11, setProfessoresUs11] = useState([]);
  const [modalidadesUs11, setModalidadesUs11] = useState([]);
  const [idProfessorUs11, setIdProfessorUs11] = useState('');
  const [modalidadesDoProfessorUs11, setModalidadesDoProfessorUs11] = useState([]);
  const [idModalidadeAssociarUs11, setIdModalidadeAssociarUs11] = useState('');

  // Feedback
  const [msg, setMsg] = useState('');

  useEffect(() => {
    document.title = "Painel Admin | Viva D'arte";
    const user = JSON.parse(localStorage.getItem('viva_user') || 'null');
    const tk = localStorage.getItem('viva_token') || '';
    const perfisLista = Array.isArray(user?.perfis) ? user.perfis : [];
    const perfilStr = (p) => String(p).toLowerCase();
    const isAdmin =
      perfisLista.some((p) => {
        const s = perfilStr(p);
        return (
          s.includes('admin') ||
          s.includes('coordenação') ||
          s.includes('coordenacao') ||
          s.includes('administração') ||
          s.includes('administracao')
        );
      }) ||
      perfilStr(user?.perfil || '').includes('admin') ||
      perfilStr(user?.perfil || '').includes('coordenação') ||
      perfilStr(user?.perfil || '').includes('coordenacao');
    if (!user || !tk || !isAdmin) {
      setAcessoNegado(true);
      return;
    }
    setUtilizador(user);
    setToken(tk);
  }, []);

  useEffect(() => {
    if (!token) return;
    carregarDados();
  }, [token]);

  useEffect(() => {
    if (!token || activeTab !== 'coaching') return;
    (async () => {
      try {
        const [profs, mods] = await Promise.all([
          apiFetch('/api/escola/professores', token),
          apiFetch('/api/escola/modalidades', token),
        ]);
        setProfessoresUs11(Array.isArray(profs) ? profs : []);
        setModalidadesUs11(Array.isArray(mods) ? mods : []);
      } catch (e) {
        setProfessoresUs11([]);
        setModalidadesUs11([]);
        mostrarMsg(e.message || 'Erro ao carregar dados US11 (professores/modalidades).', 'erro');
      }
    })();
  }, [token, activeTab]);

  useEffect(() => {
    if (!token || !idProfessorUs11) {
      setModalidadesDoProfessorUs11([]);
      return;
    }
    (async () => {
      try {
        const m = await apiFetch(`/api/escola/professores/${idProfessorUs11}/modalidades`, token);
        setModalidadesDoProfessorUs11(Array.isArray(m) ? m : []);
      } catch {
        setModalidadesDoProfessorUs11([]);
      }
    })();
  }, [token, idProfessorUs11]);

  async function carregarDados() {
    try {
      const [fat, cat, pend, prec] = await Promise.all([
        apiFetch('/api/faturacao', token),
        apiFetch('/api/inventario', token),
        apiFetch('/api/coaching/pedidos/pendentes', token),
        apiFetch('/api/faturacao/precos', token),
      ]);
      if (Array.isArray(fat)) setFaturas(fat);
      if (Array.isArray(cat)) setCatalogo(cat);
      if (Array.isArray(pend)) setPedidosPendentes(pend);
      if (Array.isArray(prec)) setPrecos(prec);
    } catch (e) {
      mostrarMsg('Erro ao carregar dados.', 'erro');
    }
  }

  function mostrarMsg(texto, tipo = 'ok') {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(''), 3500);
  }

  // ── Faturação ──
  async function registarPagamento(id) {
    const metodo = window.prompt('Método de pagamento:\nTransferência | MBWay | Numerário | Cheque | Débito Direto');
    if (!metodo) return;
    const r = await apiFetch(`/api/faturacao/${id}/pagar`, token, { method: 'PUT', body: { metodoPagamento: metodo } });
    mostrarMsg(r.mensagem || 'Pagamento registado.');
    carregarDados();
  }

  async function gerarRelatorio() {
    if (!relatorioMes || !relatorioAno) return mostrarMsg('Preenche mês e ano.', 'erro');
    setLoadingRelatorio(true);
    const r = await apiFetch(`/api/faturacao/relatorio?mes=${relatorioMes}&ano=${relatorioAno}`, token);
    setRelatorio(r);
    setLoadingRelatorio(false);
  }

  // ── Inventário ──
  async function registarPeca(e) {
    e.preventDefault();
    const r = await apiFetch('/api/inventario', token, { method: 'POST', body: novaPeca });
    if (r.idPeca) {
      mostrarMsg('Peça registada com sucesso.');
      carregarDados();
      setNovaPeca({ nome: '', descricao: '', tamanho: '', estado: 'Bom', origem: '', localizacao: '', disponivelEmprestimo: true, disponivelVenda: false, idCategoria: 1 });
    } else {
      mostrarMsg(r.mensagem || 'Erro ao registar peça.', 'erro');
    }
  }

  async function registarEmprestimo() {
    const idPecaStr = window.prompt('ID da peça a emprestar:');
    const dataInicio = window.prompt('Data início (AAAA-MM-DD):');
    const dataFim = window.prompt('Data fim (AAAA-MM-DD):');
    if (!idPecaStr || !dataInicio || !dataFim) return;
    const r = await apiFetch('/api/inventario/emprestimos', token, {
      method: 'POST',
      body: { dataInicio, dataFim, itens: [{ idPeca: parseInt(idPecaStr), estadoEntrega: 'Bom' }] },
    });
    mostrarMsg(r.mensagem || (r.idEmprestimo ? 'Empréstimo criado.' : 'Erro.'), r.idEmprestimo ? 'ok' : 'erro');
    carregarDados();
  }

  // ── Coaching ──
  async function rejeitarPedido(id) {
    const just = window.prompt('Justificação da rejeição:');
    if (!just) return;
    try {
      const r = await apiFetch(`/api/coaching/pedidos/${id}/rejeitar`, token, {
        method: 'POST',
        body: { justificacao: just },
      });
      mostrarMsg(r.mensagem || 'Pedido rejeitado.');
      carregarDados();
    } catch (e) {
      mostrarMsg(e.message || 'Erro ao rejeitar.', 'erro');
    }
  }

  async function associarModalidadeAoProfessorUs11() {
    if (!idProfessorUs11 || !idModalidadeAssociarUs11) {
      mostrarMsg('Escolhe um professor e uma modalidade para associar.', 'erro');
      return;
    }
    try {
      await apiFetch(`/api/escola/professores/${idProfessorUs11}/modalidades`, token, {
        method: 'POST',
        body: { idModalidade: parseInt(idModalidadeAssociarUs11, 10) },
      });
      mostrarMsg('Modalidade associada ao professor na base de dados.');
      setIdModalidadeAssociarUs11('');
      const m = await apiFetch(`/api/escola/professores/${idProfessorUs11}/modalidades`, token);
      setModalidadesDoProfessorUs11(Array.isArray(m) ? m : []);
    } catch (e) {
      mostrarMsg(e.message || 'Erro ao associar.', 'erro');
    }
  }

  async function removerModalidadeDoProfessorUs11(idModalidade) {
    if (!idProfessorUs11) return;
    try {
      await apiFetch(`/api/escola/professores/${idProfessorUs11}/modalidades/${idModalidade}`, token, {
        method: 'DELETE',
      });
      mostrarMsg('Associação removida da base de dados.');
      const m = await apiFetch(`/api/escola/professores/${idProfessorUs11}/modalidades`, token);
      setModalidadesDoProfessorUs11(Array.isArray(m) ? m : []);
    } catch (e) {
      mostrarMsg(e.message || 'Erro ao remover associação.', 'erro');
    }
  }

  async function abrirModalAprovar(p) {
    setModalAprovar(p);
    const vDef =
      p.custo_estimado != null && p.custo_estimado !== '' && Number.isFinite(Number(p.custo_estimado))
        ? String(Number(p.custo_estimado))
        : '';
    setFormAprovar({
      idSala: '',
      idProfessor: p.id_professor_desejado != null ? String(p.id_professor_desejado) : '',
      valorFinal: vDef
    });
    setSalasAprovar([]);
    setProfsAprovar([]);
    setLoadingAprovarOpcoes(true);
    try {
      const mid = p.id_modalidade;
      const [salas, profs] = await Promise.all([
        apiFetch(`/api/escola/modalidades/${mid}/salas`, token),
        apiFetch(`/api/escola/modalidades/${mid}/professores`, token)
      ]);
      setSalasAprovar(Array.isArray(salas) ? salas : []);
      setProfsAprovar(Array.isArray(profs) ? profs : []);
    } catch {
      mostrarMsg('Erro ao carregar salas ou professores para esta modalidade.', 'erro');
    } finally {
      setLoadingAprovarOpcoes(false);
    }
  }

  async function confirmarAprovarPedido() {
    if (!modalAprovar) return;
    const idSala = parseInt(formAprovar.idSala, 10);
    const idProfessor = parseInt(formAprovar.idProfessor, 10);
    const valorFinal = parseFloat(String(formAprovar.valorFinal).replace(',', '.'));
    if (Number.isNaN(idSala) || idSala < 1) {
      mostrarMsg('Escolhe uma sala.', 'erro');
      return;
    }
    if (Number.isNaN(idProfessor) || idProfessor < 1) {
      mostrarMsg('Escolhe um professor.', 'erro');
      return;
    }
    if (Number.isNaN(valorFinal) || valorFinal < 0) {
      mostrarMsg('Indica um valor final válido (ex.: 25.00).', 'erro');
      return;
    }
    setSubmittingAprovar(true);
    try {
      const res = await fetch(`${API_URL}/api/coaching/pedidos/${modalAprovar.id_pedido_coaching}/aprovar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ idSala, idProfessor, valorFinal })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensagem || 'Não foi possível aprovar o pedido.');
      mostrarMsg(data.mensagem || 'Pedido aprovado e coaching agendado.');
      setModalAprovar(null);
      await carregarDados();
    } catch (e) {
      mostrarMsg(e.message || 'Erro ao aprovar.', 'erro');
    } finally {
      setSubmittingAprovar(false);
    }
  }

  const faturasTotal = faturas.reduce((a, f) => a + Number(f.total || 0), 0);
  const faturasPendentes = faturas.filter(f => f.estado_pagamento === 'Pendente').length;
  const pecasDisponiveis = catalogo.filter(p => p.disponivel_para_emprestimo).length;

  const tabs = [
    { id: 'overview', label: '🏠 Visão Geral' },
    { id: 'faturacao', label: '💶 Faturação' },
    { id: 'inventario', label: '👗 Inventário' },
    { id: 'coaching', label: '📅 Coachings' },
  ];

  return (
    <div className="admin-root">
      {/* ── SIDEBAR ── */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">VA</span>
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

      {/* ── MAIN ── */}
      <main className="admin-main">
        {acessoNegado && (
          <div className="tab-content">
            <h1 className="page-title">🔒 Área de Administração</h1>
            <p className="page-subtitle">Precisas de iniciar sessão com perfil Admin para aceder a este painel.</p>
            <div style={{ marginTop: 16 }}>
              <button className="btn-primary" onClick={irParaLanding}>Ir para login</button>
            </div>
          </div>
        )}

        {msg && (
          <div className={`toast toast--${msg.tipo}`}>{msg.texto}</div>
        )}

        {/* OVERVIEW */}
        {!acessoNegado && activeTab === 'overview' && (
          <div className="tab-content">
            <h1 className="page-title">Olá, {utilizador?.nome?.split(' ')[0]} 👋</h1>
            <p className="page-subtitle">Resumo do sistema</p>

            <div className="stats-grid">
              <StatCard icon="💶" label="Receita Total" value={`${faturasTotal.toFixed(2)} €`} accent="gold" />
              <StatCard icon="⏳" label="Faturas Pendentes" value={faturasPendentes} accent="orange" />
              <StatCard icon="👗" label="Peças Disponíveis" value={pecasDisponiveis} accent="teal" />
              <StatCard icon="📋" label="Pedidos Pendentes" value={pedidosPendentes.length} accent="red" />
            </div>

            {pedidosPendentes.length > 0 && (
              <div className="quick-section">
                <h2 className="quick-title">⚡ Pedidos por Tratar</h2>
                <div className="card-list">
                  {pedidosPendentes.slice(0, 3).map(p => (
                    <div key={p.id_pedido_coaching} className="list-card">
                      <div className="list-card-info">
                        <strong>{p.requisitante}</strong>
                        <span>{p.modalidade} · {p.formato_aula} · {p.duracao_minutos} min</span>
                        <span>{new Date(p.data_aula_pretendida).toLocaleDateString('pt-PT')}</span>
                      </div>
                      <div className="list-card-actions">
                        <button className="btn-sm btn-sm--danger" onClick={() => rejeitarPedido(p.id_pedido_coaching)}>
                          Rejeitar
                        </button>
                        <button className="btn-sm btn-sm--primary" onClick={() => setActiveTab('coaching')}>
                          Ver
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FATURAÇÃO */}
        {!acessoNegado && activeTab === 'faturacao' && (
          <div className="tab-content">
            <h1 className="page-title">💶 Faturação</h1>

            <Section title="Relatório Mensal por Professor" icon="📊" defaultOpen>
              <div className="form-row">
                <div className="field">
                  <label>Mês</label>
                  <input type="number" min="1" max="12" placeholder="10"
                    value={relatorioMes} onChange={e => setRelatorioMes(e.target.value)} />
                </div>
                <div className="field">
                  <label>Ano</label>
                  <input type="number" placeholder="2025"
                    value={relatorioAno} onChange={e => setRelatorioAno(e.target.value)} />
                </div>
                <button className="btn-primary" onClick={gerarRelatorio} disabled={loadingRelatorio}>
                  {loadingRelatorio ? 'A carregar...' : 'Gerar'}
                </button>
              </div>
              {relatorio && (
                <div className="relatorio-box">
                  <div className="relatorio-summary">
                    <span>Total Aulas: <strong>{relatorio.total_aulas}</strong></span>
                    <span>Receita: <strong>{Number(relatorio.total_receita || 0).toFixed(2)} €</strong></span>
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr><th>Professor</th><th>Modalidade</th><th>Aulas</th><th>Minutos</th><th>Receita</th></tr>
                    </thead>
                    <tbody>
                      {relatorio.dados?.map((d, i) => (
                        <tr key={i}>
                          <td>{d.professor}</td>
                          <td>{d.modalidade}</td>
                          <td>{d.total_aulas}</td>
                          <td>{d.total_minutos}</td>
                          <td>{Number(d.total_receita_gerada).toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Todas as Faturas" icon="📄">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cliente</th><th>Mês/Ano</th><th>Total</th>
                    <th>Estado</th><th>Método</th><th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map(f => (
                    <tr key={f.id_faturacao}>
                      <td>{f.cliente}</td>
                      <td>{f.mes}/{f.ano}</td>
                      <td>{Number(f.total).toFixed(2)} €</td>
                      <td>
                        <span className={`badge badge--${f.estado_pagamento === 'Pago' ? 'green' : 'orange'}`}>
                          {f.estado_pagamento || 'Pendente'}
                        </span>
                      </td>
                      <td>{f.metodo_pagamento || '—'}</td>
                      <td>
                        {f.estado_pagamento !== 'Pago' && (
                          <button className="btn-sm btn-sm--primary" onClick={() => registarPagamento(f.id_faturacao)}>
                            Registar Pagamento
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {faturas.length === 0 && (
                    <tr><td colSpan={6} className="empty-row">Sem faturas disponíveis.</td></tr>
                  )}
                </tbody>
              </table>
            </Section>

            <Section title="Tabela de Preços" icon="🏷️">
              <table className="admin-table">
                <thead>
                  <tr><th>Formato</th><th>Duração</th><th>Dia</th><th>Preço</th></tr>
                </thead>
                <tbody>
                  {precos.map(p => (
                    <tr key={p.id_preco}>
                      <td>{p.formato_aula}</td>
                      <td>{p.duracao_minutos} min</td>
                      <td>{p.dia_semana === 1 ? 'Seg–Qui' : 'Sáb–Dom'}</td>
                      <td>{Number(p.preco).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        )}

        {/* INVENTÁRIO */}
        {!acessoNegado && activeTab === 'inventario' && (
          <div className="tab-content">
            <h1 className="page-title">👗 Inventário</h1>

            <Section title="Registar Nova Peça" icon="➕" defaultOpen>
              {/* NOTA: Admin pode registar peças e gerir empréstimos. NÃO pode colocar à venda. */}
              <form className="admin-form" onSubmit={registarPeca}>
                <div className="form-grid">
                  <div className="field">
                    <label>Nome *</label>
                    <input required value={novaPeca.nome}
                      onChange={e => setNovaPeca(p => ({ ...p, nome: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Tamanho</label>
                    <input value={novaPeca.tamanho}
                      onChange={e => setNovaPeca(p => ({ ...p, tamanho: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Estado *</label>
                    <select value={novaPeca.estado}
                      onChange={e => setNovaPeca(p => ({ ...p, estado: e.target.value }))}>
                      <option>Novo</option>
                      <option>Bom</option>
                      <option>Usado</option>
                      <option>Danificado</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Categoria</label>
                    <select value={novaPeca.idCategoria}
                      onChange={e => setNovaPeca(p => ({ ...p, idCategoria: parseInt(e.target.value) }))}>
                      <option value={1}>Figurinos</option>
                      <option value={2}>Acessórios</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Origem</label>
                    <input value={novaPeca.origem}
                      onChange={e => setNovaPeca(p => ({ ...p, origem: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label>Localização</label>
                    <input value={novaPeca.localizacao}
                      onChange={e => setNovaPeca(p => ({ ...p, localizacao: e.target.value }))} />
                  </div>
                </div>
                <div className="field field--full">
                  <label>Descrição</label>
                  <textarea rows={2} value={novaPeca.descricao}
                    onChange={e => setNovaPeca(p => ({ ...p, descricao: e.target.value }))} />
                </div>
                <div className="form-checkboxes">
                  <label className="check-label">
                    <input type="checkbox" checked={novaPeca.disponivelEmprestimo}
                      onChange={e => setNovaPeca(p => ({ ...p, disponivelEmprestimo: e.target.checked }))} />
                    Disponível para Empréstimo
                  </label>
                  {/* Venda é opção do utilizador dono, não da Administração */}
                </div>
                <button type="submit" className="btn-primary">Registar Peça</button>
              </form>
            </Section>

            <Section title="Gestão de Empréstimos" icon="🔄">
              <div className="section-action">
                <button className="btn-primary" onClick={registarEmprestimo}>
                  + Novo Empréstimo
                </button>
              </div>
              <p className="info-note">
                💡 A Coordenação pode criar e gerir empréstimos. A colocação de peças à venda é feita pelos próprios utilizadores (EE/Professor).
              </p>
            </Section>

            <Section title="Catálogo Completo" icon="📋">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nome</th><th>Categoria</th><th>Estado</th>
                    <th>Localização</th><th>Empréstimo</th><th>Venda</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogo.map(p => (
                    <tr key={p.id_peca}>
                      <td><strong>{p.nome_peca}</strong></td>
                      <td>{p.categoria}</td>
                      <td>
                        <span className={`badge badge--${p.condicao_peca === 'Novo' || p.condicao_peca === 'Bom' ? 'green' : 'orange'}`}>
                          {p.condicao_peca}
                        </span>
                      </td>
                      <td>{p.localizacao || '—'}</td>
                      <td>{p.disponivel_para_emprestimo ? '✅' : '❌'}</td>
                      <td>{p.disponivel_para_venda ? '✅' : '—'}</td>
                    </tr>
                  ))}
                  {catalogo.length === 0 && (
                    <tr><td colSpan={6} className="empty-row">Sem peças registadas.</td></tr>
                  )}
                </tbody>
              </table>
            </Section>
          </div>
        )}

        {/* COACHING */}
        {!acessoNegado && activeTab === 'coaching' && (
          <div className="tab-content">
            <h1 className="page-title">📅 Pedidos de Coaching</h1>

            <Section title="Professor ↔ modalidade (US11 / RF13)" icon="🔗" defaultOpen>
              <p className="info-note">
                A coordenação define em <strong>PROFESSOR_MODALIDADE</strong> que modalidades cada professor leciona.
                Só depois disso o professor aparece no pedido de coaching (US05) e nas vagas para essa modalidade.
              </p>
              <div className="form-grid" style={{ marginTop: 12 }}>
                <div className="field field--full">
                  <label htmlFor="us11-prof">Professor</label>
                  <select
                    id="us11-prof"
                    value={idProfessorUs11}
                    onChange={(e) => setIdProfessorUs11(e.target.value)}
                  >
                    <option value="">— Escolher professor —</option>
                    {professoresUs11.map((pr) => (
                      <option key={pr.id_professor} value={pr.id_professor}>
                        {pr.nome_professor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {idProfessorUs11 && (
                <>
                  <h4 style={{ marginTop: 16, marginBottom: 8 }}>Modalidades já associadas</h4>
                  {modalidadesDoProfessorUs11.length === 0 ? (
                    <p className="empty-msg">Nenhuma modalidade associada a este professor na BD.</p>
                  ) : (
                    <ul className="admin-us11-lista">
                      {modalidadesDoProfessorUs11.map((row) => (
                        <li key={row.id_modalidade}>
                          <span>{row.modalidade || row.nome}</span>
                          <button
                            type="button"
                            className="btn-sm btn-sm--danger"
                            onClick={() => removerModalidadeDoProfessorUs11(row.id_modalidade)}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="form-grid" style={{ marginTop: 12, alignItems: 'flex-end' }}>
                    <div className="field">
                      <label htmlFor="us11-mod-add">Adicionar modalidade</label>
                      <select
                        id="us11-mod-add"
                        value={idModalidadeAssociarUs11}
                        onChange={(e) => setIdModalidadeAssociarUs11(e.target.value)}
                      >
                        <option value="">— Escolher —</option>
                        {modalidadesUs11
                          .filter(
                            (mod) =>
                              !modalidadesDoProfessorUs11.some(
                                (x) => String(x.id_modalidade) === String(mod.id_modalidade)
                              )
                          )
                          .map((mod) => (
                            <option key={mod.id_modalidade} value={mod.id_modalidade}>
                              {mod.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="field">
                      <button type="button" className="btn-primary" onClick={associarModalidadeAoProfessorUs11}>
                        Associar na BD
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Section>

            <Section title="Pedidos Pendentes" icon="⏳" defaultOpen>
              {pedidosPendentes.length === 0 ? (
                <p className="empty-msg">Sem pedidos pendentes. ✓</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Requisitante</th><th>Modalidade</th><th>Formato</th>
                      <th>Duração</th><th>Data</th><th>Custo Est.</th><th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosPendentes.map(p => (
                      <tr key={p.id_pedido_coaching}>
                        <td>
                          <strong>{p.requisitante}</strong>
                          <br /><small>{p.email_requisitante}</small>
                        </td>
                        <td>{p.modalidade}</td>
                        <td>{p.formato_aula}</td>
                        <td>{p.duracao_minutos} min</td>
                        <td>{new Date(p.data_aula_pretendida).toLocaleDateString('pt-PT')}<br/>
                          <small>{p.hora_inicio_pretendida}</small></td>
                        <td>{p.custo_estimado ? `${Number(p.custo_estimado).toFixed(2)} €` : '—'}</td>
                        <td>
                          <div className="action-col">
                            <button
                              type="button"
                              className="btn-sm btn-sm--primary"
                              onClick={() => abrirModalAprovar(p)}
                            >
                              Aprovar (sala + prof.)
                            </button>
                            <button className="btn-sm btn-sm--danger"
                              onClick={() => rejeitarPedido(p.id_pedido_coaching)}>
                              Rejeitar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {modalAprovar && (
              <div
                className="admin-modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-aprovar-titulo"
                onClick={() => !submittingAprovar && setModalAprovar(null)}
              >
                <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
                  <h2 id="admin-aprovar-titulo" className="admin-modal-title">
                    Aprovar pedido #{modalAprovar.id_pedido_coaching}
                  </h2>
                  <p className="admin-modal-sub">
                    {modalAprovar.modalidade} · {modalAprovar.formato_aula} · {modalAprovar.duracao_minutos} min ·{' '}
                    {new Date(modalAprovar.data_aula_pretendida).toLocaleDateString('pt-PT')} às{' '}
                    {String(modalAprovar.hora_inicio_pretendida || '').slice(0, 5)}
                  </p>

                  {loadingAprovarOpcoes ? (
                    <p className="empty-msg">A carregar salas e professores…</p>
                  ) : (
                    <div className="admin-modal-form">
                      <div className="field">
                        <label htmlFor="admin-aprov-prof">Professor *</label>
                        <select
                          id="admin-aprov-prof"
                          value={formAprovar.idProfessor}
                          onChange={(e) => setFormAprovar((f) => ({ ...f, idProfessor: e.target.value }))}
                        >
                          <option value="">— Escolher —</option>
                          {profsAprovar.map((pr) => (
                            <option key={pr.id_professor} value={pr.id_professor}>
                              {pr.nome_professor}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="admin-aprov-sala">Sala *</label>
                        <select
                          id="admin-aprov-sala"
                          value={formAprovar.idSala}
                          onChange={(e) => setFormAprovar((f) => ({ ...f, idSala: e.target.value }))}
                        >
                          <option value="">— Escolher —</option>
                          {salasAprovar.map((s) => (
                            <option key={s.id_sala} value={s.id_sala}>
                              {s.nome_sala} (cap. {s.capacidade_maxima ?? '—'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="admin-aprov-valor">Valor final (€) *</label>
                        <input
                          id="admin-aprov-valor"
                          type="text"
                          inputMode="decimal"
                          placeholder="ex.: 35.00"
                          value={formAprovar.valorFinal}
                          onChange={(e) => setFormAprovar((f) => ({ ...f, valorFinal: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="admin-modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={submittingAprovar}
                      onClick={() => setModalAprovar(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={submittingAprovar || loadingAprovarOpcoes}
                      onClick={confirmarAprovarPedido}
                    >
                      {submittingAprovar ? 'A agendar…' : 'Confirmar agendamento'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}