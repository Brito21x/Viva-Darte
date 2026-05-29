import React, { useState, useEffect, useRef } from "react";
import "./AdminDashboard.css";
import logoImg from "../../assets/logo.png";

const API_URL = "https://salvaging-clumsily-skinhead.ngrok-free.dev";

function traduzErroCoaching(err, fallback) {
  const msg = String(err?.message || "").trim();
  if (!msg) return fallback;
  const low = msg.toLowerCase();
  if (
    low.includes("fora da disponibilidade") ||
    low.includes("não tem disponibilidade") ||
    low.includes("nao tem disponibilidade")
  ) {
    return "Professor sem disponibilidade no horário escolhido.";
  }
  if (low.includes("ocorreu um erro interno") || low.includes("erro interno")) {
    return "Não foi possível aprovar. O horário pode estar fora da disponibilidade do professor.";
  }
  return msg;
}

function apiFetch(path, token, opts = {}) {
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then((r) => r.json());
}

async function apiFetchChecked(path, token, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data?.mensagem || data?.error || "Erro na operação");
  return data;
}

function SearchableSelect({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  const selectedOption = options.find((o) => String(o.id) === String(value));
  const displayValue = isOpen
    ? search
    : selectedOption
      ? selectedOption.label
      : "";

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="searchable-wrapper" ref={wrapperRef}>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => {
          setIsOpen(true);
          setSearch("");
        }}
      />
      <span className="searchable-arrow">▼</span>
      {isOpen && (
        <ul className="searchable-dropdown">
          {filteredOptions.length === 0 && (
            <li className="searchable-empty">Sem resultados</li>
          )}
          {filteredOptions.map((o) => (
            <li
              key={o.id}
              className="searchable-option"
              onMouseDown={() => {
                onChange(o.id);
                setSearch(o.label);
                setIsOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatarHoraSqlTime(valor) {
  if (valor == null) return "—";
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const hh = String(valor.getUTCHours()).padStart(2, "0");
    const mm = String(valor.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const s = String(valor).trim();
  if (!s) return "—";
  const isoMatch = s.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
  const hmMatch = s.match(/^(\d{1,2}):(\d{2})/);
  if (hmMatch) {
    return `${String(hmMatch[1]).padStart(2, "0")}:${hmMatch[2]}`;
  }
  return "—";
}

function calcularHoraFim(horaInicio, duracaoMinutos) {
  const hi = formatarHoraSqlTime(horaInicio);
  if (hi === "—") return "";
  const dur = parseInt(duracaoMinutos, 10);
  if (!Number.isFinite(dur)) return "";
  const [h, m] = hi.split(":").map(Number);
  const totalMin = h * 60 + m + dur;
  const hFim = Math.floor((totalMin / 60) % 24);
  const mFim = totalMin % 60;
  return `${String(hFim).padStart(2, "0")}:${String(mFim).padStart(2, "0")}`;
}

function StatCard({ icon, label, value, accent, onClick }) {
  return (
    <div
      className={`stat-card stat-card--${accent}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <span className="stat-icon">{icon}</span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value ?? "—"}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  defaultOpen = false,
  actionButton = null,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="admin-section">
      <div className="section-toggle">
        <div
          className="section-header-title"
          onClick={() => setOpen((o) => !o)}
        >
          <span>
            {icon} {title}
          </span>
          <span className={`chevron ${open ? "chevron--open" : ""}`}>›</span>
        </div>
        {actionButton && (
          <div className="section-header-actions">{actionButton}</div>
        )}
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function formatHoraCurta(valor) {
  const s = String(valor || "").trim();
  if (!s) return "—";
  const m = s.match(/(\d{2}):(\d{2})(?::\d{2})?/);
  if (m) return `${m[1]}:${m[2]}`;
  return "—";
}

function formatDataApi(valor) {
  if (!valor) return "";
  const iso = String(valor).split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const AUDITORIA_LABELS = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  REGISTO: "Registo",
  UTILIZADOR_EDIT: "Editar utilizador",
  UTILIZADOR_APAGAR: "Apagar utilizador",
  UTILIZADOR_ATIVAR: "Ativar utilizador",
  UTILIZADOR_DESATIVAR: "Desativar utilizador",
  PECA_CRIAR: "Criar peça",
  PECA_EDITAR: "Editar peça",
  PECA_APAGAR: "Apagar peça",
  PECA_ESTADO: "Alterar estado de peça",
  VENDA_COLOCAR: "Colocar à venda",
  VENDA_CONCLUIR: "Concluir venda",
  EMPRESTIMO_PEDIR: "Pedido de empréstimo",
  EMPRESTIMO_DEVOLVER: "Devolução",
  EMPRESTIMO_PENALIZAR: "Penalização",
  COACHING_PEDIR: "Pedido de coaching",
  COACHING_APROVAR: "Aprovar coaching",
  COACHING_REJEITAR: "Rejeitar coaching",
  COACHING_CANCELAR: "Cancelar coaching",
  COACHING_VALIDAR: "Validar coaching",
  FATURA_PAGAR: "Pagar fatura",
  FATURA_CANCELAR: "Cancelar fatura",
};

function legivelTipoEvento(tipo) {
  return AUDITORIA_LABELS[tipo] || tipo || "—";
}

function corDoEventoAuditoria(tipo) {
  if (!tipo) return "#888";
  if (tipo.startsWith("LOGIN") || tipo === "REGISTO") return "#5a8dee";
  if (tipo === "LOGOUT") return "#888";
  if (tipo.startsWith("UTILIZADOR")) return "#9b59b6";
  if (tipo.startsWith("PECA")) return "#c9a961";
  if (tipo.startsWith("VENDA")) return "#38a169";
  if (tipo.startsWith("EMPRESTIMO")) return "#3498db";
  if (tipo.startsWith("COACHING")) return "#e67e22";
  if (tipo.startsWith("FATURA")) return "#c0392b";
  return "#666";
}

export default function AdminDashboard({ irParaLanding }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [utilizador, setUtilizador] = useState(null);
  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const [utilizadores, setUtilizadores] = useState([]);
  const [allModalidades, setAllModalidades] = useState([]);
  const [pedidosPendentes, setPedidosPendentes] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [tabelaPrecos, setTabelaPrecos] = useState([]);
  const [modalPreco, setModalPreco] = useState({
    isOpen: false,
    data: {
      id_preco: null,
      formato_aula: "",
      duracao_minutos: "",
      dia_semana: 1,
      preco: "",
      ativo: true,
    },
  });

  function abrirModalEditarPreco(regra) {
    setModalPreco({
      isOpen: true,
      data: {
        id_preco: regra.id_preco,
        formato_aula: regra.formato_aula,
        duracao_minutos: regra.duracao_minutos,
        dia_semana: regra.dia_semana,
        preco: regra.preco,
        ativo: regra.ativo,
      },
    });
  }

  async function submeterModalPreco(e) {
    e.preventDefault();
    try {
      const res = await fetch(
        `${API_URL}/api/faturacao/precos/${modalPreco.data.id_preco}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(modalPreco.data),
        },
      );

      if (res.ok) {
        mostrarMsg("Regra de preço atualizada com sucesso!", "ok");
        setModalPreco({ isOpen: false, data: {} });
        carregarPrecos();
      } else {
        mostrarMsg("Erro ao atualizar o preço.", "erro");
      }
    } catch (err) {
      mostrarMsg("Erro de comunicação com o servidor.", "erro");
    }
  }
  const [precosLoading, setPrecosLoading] = useState(false);

  async function carregarPrecos() {
    setPrecosLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/faturacao/precos`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setTabelaPrecos(Array.isArray(data) ? data : []);
      } else {
        mostrarMsg("Erro ao carregar a tabela de preços.", "erro");
      }
    } catch (err) {
      console.error(err);
      mostrarMsg("Erro de ligação ao servidor.", "erro");
    } finally {
      setPrecosLoading(false);
    }
  }

  const [modalPeca, setModalPeca] = useState({
    isOpen: false,
    mode: "create",
    data: {
      nome: "",
      descricao: "",
      tamanho: "",
      estado: "Bom",
      preco: "",
      valor_dia: "",
      disponivelVenda: true,
      disponivelEmprestimo: false,
    },
  });

  const [historicoCoachings, setHistoricoCoachings] = useState([]);
  const [salas, setSalas] = useState([]);
  const [anosLetivos, setAnosLetivos] = useState([]);
  const [modalAprovar, setModalAprovar] = useState({
    isOpen: false,
    pedido: null,
    idSala: "",
    idProfessor: "",
    valorFinal: "",
  });

  const [modalAgendarDireto, setModalAgendarDireto] = useState({
    isOpen: false,
    idEncarregado: "",
    idModalidade: "",
    idProfessor: "",
    idSala: "",
    dataAula: "",
    horaInicio: "",
    duracaoMinutos: 60,
    formatoAula: "Solo",
    valorFinal: "",
  });

  const [msg, setMsg] = useState("");

  const [faturas, setFaturas] = useState([]);
  const [faturacaoFiltro, setFaturacaoFiltro] = useState({
    ano: "",
    mes: "",
    estado: "",
  });
  const [faturacaoLoading, setFaturacaoLoading] = useState(false);

  const [modalDetalheFatura, setModalDetalheFatura] = useState({
    isOpen: false,
    loading: false,
    erro: "",
    fatura: null,
    linhas: [],
    modoIndividual: false,
  });

  const [inventarioPecas, setInventarioPecas] = useState([]);
  const [inventarioEmprestimos, setInventarioEmprestimos] = useState([]);
  const [inventarioVendas, setInventarioVendas] = useState([]);
  const [inventarioTab, setInventarioTab] = useState("catalogo");
  const [inventarioLoading, setInventarioLoading] = useState(false);
  const [modalEstado, setModalEstado] = useState({
    isOpen: false,
    peca: null,
    estado: "",
    dispEmp: false,
    dispVenda: false,
  });

  const [historicoGeral, setHistoricoGeral] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoIndisponivel, setHistoricoIndisponivel] = useState(false);
  const [historicoFiltro, setHistoricoFiltro] = useState({
    tipo: "",
    utilizador: "",
    desde: "",
    ate: "",
  });

  const [modalUser, setModalUser] = useState({
    isOpen: false,
    mode: "create",
    data: {},
  });
  const [modalMods, setModalMods] = useState({
    isOpen: false,
    userId: null,
    selectedIds: [],
  });

  useEffect(() => {
    document.title = "Painel Admin | Viva D'arte";
    const userGuardado = localStorage.getItem("viva_user");
    const tkGuardado = localStorage.getItem("token");
    if (userGuardado && tkGuardado) {
      const user = JSON.parse(userGuardado);
      const perfisPermitidos = [
        "Admin",
        "Administrador",
        "Coordenação",
        "Coordenacao",
      ];
      if (
        perfisPermitidos.includes(user.perfil) ||
        user.id_perfil === 1 ||
        user.id_perfil === "1"
      ) {
        setUtilizador(user);
        setToken(tkGuardado);
        setIsAuthorized(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!token || !isAuthorized) return;
    carregarDados();
    carregarInventario();
  }, [token, isAuthorized]);

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          tipo: "ADMIN",
          perfil: "ADMIN",
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const user = data.utilizador || data.user;
        const tk = data.token;
        if (
          user.id_perfil === 1 ||
          user.id_perfil === "1" ||
          user.perfil === "Admin"
        ) {
          user.perfil = "Admin";
          localStorage.setItem("viva_user", JSON.stringify(user));
          localStorage.setItem("token", tk);
          setUtilizador(user);
          setToken(tk);
          setIsAuthorized(true);
        } else {
          setLoginError("Acesso negado.");
        }
      } else {
        setLoginError(data.mensagem || data.error || "Credenciais incorretas.");
      }
    } catch (err) {
      setLoginError("Erro de ligação.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function carregarDados() {
    try {
      const [usersData, modalidadesData, salasData, anosData] =
        await Promise.all([
          apiFetch("/api/auth/utilizadores", token).catch(() => []),
          apiFetch("/api/escola/modalidades", token).catch(() => []),
          apiFetch("/api/escola/salas", token).catch(() => []),
          apiFetch("/api/escola/anos-letivos", token).catch(() => []),
        ]);

      if (Array.isArray(usersData)) setUtilizadores(usersData);
      if (Array.isArray(modalidadesData)) setAllModalidades(modalidadesData);
      if (Array.isArray(salasData)) setSalas(salasData);
      if (Array.isArray(anosData)) setAnosLetivos(anosData);

      const pedidos = await apiFetch(
        "/api/coaching/pedidos/pendentes",
        token,
      ).catch(() => []);
      if (Array.isArray(pedidos)) setPedidosPendentes(pedidos);
    } catch (e) {
      mostrarMsg("Erro ao carregar dados principais.", "erro");
    }

    const histData = await apiFetch("/api/coaching/historico", token).catch(
      () => [],
    );
    if (Array.isArray(histData)) setHistoricoCoachings(histData);

    try {
      const pecasData = await fetch(`${API_URL}/api/inventario`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }).then(async (r) => {
        if (!r.ok) return [];
        const d = await r.json();
        return Array.isArray(d) ? d : [];
      });
      setInventarioPecas(pecasData);
    } catch (_) {}

    try {
      const vendasData = await apiFetch("/api/inventario/vendas", token).catch(
        () => [],
      );
      if (Array.isArray(vendasData)) setInventarioVendas(vendasData);
    } catch (_) {}
  }

  function mostrarMsg(texto, tipo = "ok") {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(""), 3500);
  }

  async function handleAceitarUtilizador(id) {
    if (!window.confirm("Aprovar entrada deste utilizador?")) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/utilizadores/${id}/ativar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        mostrarMsg("Utilizador aceite!", "ok");
        carregarDados();
      } else {
        mostrarMsg("Erro ao aprovar.", "erro");
      }
    } catch (err) {
      mostrarMsg("Erro de rede.", "erro");
    }
  }

  async function handleRevogarUtilizador(id) {
    if (
      !window.confirm(
        "Tens a certeza que queres REVOGAR o acesso deste utilizador?",
      )
    )
      return;
    try {
      const res = await fetch(
        `${API_URL}/api/auth/utilizadores/${id}/desativar`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (res.ok) {
        mostrarMsg("Acesso revogado!", "ok");
        carregarDados();
      } else {
        mostrarMsg("Erro ao revogar acesso.", "erro");
      }
    } catch (err) {
      mostrarMsg("Erro de rede.", "erro");
    }
  }

  async function handleEliminarUtilizador(id) {
    if (
      !window.confirm(
        "Tens a certeza ABSOLUTA que queres ELIMINAR PERMANENTEMENTE este registo?",
      )
    )
      return;
    try {
      const res = await fetch(`${API_URL}/api/auth/utilizadores/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        mostrarMsg("Registo apagado para sempre!", "ok");
        carregarDados();
      } else {
        const data = await res.json();
        mostrarMsg(data.mensagem || "Erro ao eliminar.", "erro");
      }
    } catch (err) {
      mostrarMsg("Erro de rede.", "erro");
    }
  }

  function abrirModalCriar(tipoRecomendado) {
    setModalUser({
      isOpen: true,
      mode: "create",
      data: {
        nome: "",
        email: "",
        telefone: "",
        password: "",
        tipo: tipoRecomendado,
        nomeAluno: "",
        dataNascimentoAluno: "",
      },
    });
  }

  function abrirModalEditar(u) {
    let tipoBase = "EE";
    if (u.perfis?.toLowerCase().includes("prof")) tipoBase = "PROF";
    if (
      u.perfis?.toLowerCase().includes("admin") ||
      u.perfis?.toLowerCase().includes("coord")
    )
      tipoBase = "ADMIN";

    setModalUser({
      isOpen: true,
      mode: "edit",
      data: {
        id: u.id_utilizador,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone || "",
        password: "",
        tipo: tipoBase,
        nomeAluno: u.nomeAluno || "",
        dataNascimentoAluno: u.dataNascimentoAluno
          ? formatDataApi(u.dataNascimentoAluno)
          : "",
      },
    });
  }

  function fecharModal() {
    setModalUser({ isOpen: false, mode: "create", data: {} });
  }

  async function submeterModal(e) {
    e.preventDefault();
    const { email, telefone, password } = modalUser.data;

    if (!email.includes("@"))
      return mostrarMsg("O email tem de conter um '@'.", "erro");

    let telLimpo = "";
    if (telefone) {
      telLimpo = telefone.replace(/\D/g, "");
      if (telLimpo.length !== 9)
        return mostrarMsg(
          "O número de telefone tem de ter exatamente 9 dígitos.",
          "erro",
        );
    }

    if (password && password.trim() !== "") {
      const regexEspecial = /[!@#$%^&*(),.?":{}|<>]/;
      if (password.length < 8)
        return mostrarMsg(
          "A password tem de ter no mínimo 8 caracteres.",
          "erro",
        );
      if (!regexEspecial.test(password))
        return mostrarMsg(
          "A password tem de conter pelo menos 1 carácter especial.",
          "erro",
        );
    } else if (modalUser.mode === "create") {
      return mostrarMsg(
        "A password é obrigatória na criação de conta.",
        "erro",
      );
    }

    const payloadEnvio = { ...modalUser.data, telefone: telLimpo };
    const isEdit = modalUser.mode === "edit";
    const endpoint = isEdit
      ? `/api/auth/utilizadores/${modalUser.data.id}`
      : `/api/auth/utilizadores`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadEnvio),
      });
      const result = await res.json();
      if (res.ok) {
        mostrarMsg(result.mensagem || "Sucesso!", "ok");
        fecharModal();
        carregarDados();
      } else {
        mostrarMsg(
          result.mensagem || result.error || "Ocorreu um erro.",
          "erro",
        );
      }
    } catch (err) {
      mostrarMsg("Erro de ligação.", "erro");
    }
  }

  function abrirModalModalidades(u) {
    const uMods =
      typeof u.modalidades === "string" ? u.modalidades.split(", ") : [];
    const preSelected = allModalidades
      .filter((m) => uMods.includes(m.nome))
      .map((m) => m.id_modalidade);
    setModalMods({
      isOpen: true,
      userId: u.id_utilizador,
      selectedIds: preSelected,
    });
  }

  async function guardarModalidades() {
    try {
      const res = await fetch(
        `${API_URL}/api/auth/utilizadores/${modalMods.userId}/modalidades`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ idsModalidades: modalMods.selectedIds }),
        },
      );
      if (res.ok) {
        mostrarMsg("Modalidades atualizadas!", "ok");
        setModalMods({ isOpen: false, userId: null, selectedIds: [] });
        carregarDados();
      } else {
        mostrarMsg("Erro ao salvar modalidades.", "erro");
      }
    } catch (e) {
      mostrarMsg("Erro de rede.", "erro");
    }
  }

  function abrirModalAprovarPedido(p) {
    setModalAprovar({
      isOpen: true,
      pedido: p,
      idSala: "",
      idProfessor: p.id_professor_desejado || "",
      valorFinal: p.custo_estimado || "",
    });
  }

  async function submeterAprovacao(e) {
    e.preventDefault();
    if (
      !modalAprovar.idSala ||
      !modalAprovar.idProfessor ||
      !modalAprovar.valorFinal
    ) {
      return mostrarMsg(
        "Preencha sala, professor e preço para aprovar.",
        "erro",
      );
    }

    try {
      const res = await fetch(
        `${API_URL}/api/coaching/pedidos/${modalAprovar.pedido.id_pedido_coaching}/aprovar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            idSala: modalAprovar.idSala,
            idProfessor: modalAprovar.idProfessor,
            valorFinal: modalAprovar.valorFinal,
          }),
        },
      );
      const data = await res.json();

      if (res.ok) {
        mostrarMsg("Coaching Agendado! A sala foi atribuída.", "ok");
        setModalAprovar({
          isOpen: false,
          pedido: null,
          idSala: "",
          idProfessor: "",
          valorFinal: "",
        });
        carregarDados();
      } else {
        mostrarMsg(data.mensagem || "Erro ao aprovar o pedido.", "erro");
      }
    } catch (err) {
      mostrarMsg("Erro de comunicação.", "erro");
    }
  }

  async function handleAgendarDireto(e) {
    e.preventDefault();
    if (!modalAgendarDireto.idEncarregado)
      return mostrarMsg("Selecione um Encarregado/Aluno", "erro");
    if (!modalAgendarDireto.idModalidade)
      return mostrarMsg("Selecione uma Modalidade", "erro");
    if (!modalAgendarDireto.idProfessor)
      return mostrarMsg("Selecione um Professor", "erro");
    if (!modalAgendarDireto.idSala)
      return mostrarMsg("Selecione uma Sala", "erro");

    try {
      const res = await fetch(`${API_URL}/api/coaching/agendar-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(modalAgendarDireto),
      });
      const data = await res.json();
      if (res.ok) {
        mostrarMsg("Agendamento criado e aprovado com sucesso!", "ok");
        setModalAgendarDireto({
          isOpen: false,
          idEncarregado: "",
          idModalidade: "",
          idProfessor: "",
          idSala: "",
          dataAula: "",
          horaInicio: "",
          duracaoMinutos: 60,
          formatoAula: "Solo",
          valorFinal: "",
        });
        carregarDados();
      } else {
        mostrarMsg(data.mensagem || "Erro ao agendar a aula.", "erro");
      }
    } catch (err) {
      mostrarMsg("Erro de ligação.", "erro");
    }
  }

  async function handleRejeitarPedido(idPedido) {
    const justificacao = window.prompt(
      "Por favor, introduza a justificação para rejeitar este pedido:",
    );
    if (!justificacao)
      return mostrarMsg("A justificação é obrigatória para rejeitar.", "erro");

    try {
      const res = await fetch(
        `${API_URL}/api/coaching/pedidos/${idPedido}/rejeitar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ justificacao }),
        },
      );
      const data = await res.json();

      if (res.ok) {
        mostrarMsg("Pedido rejeitado com sucesso.", "ok");
        carregarDados();
      } else {
        mostrarMsg(data.mensagem || "Erro ao rejeitar o pedido.", "erro");
      }
    } catch (err) {
      mostrarMsg("Erro de comunicação com o servidor.", "erro");
    }
  }

  async function handleCancelarCoaching(idCoaching) {
    if (
      !window.confirm(
        "Tens a certeza que queres cancelar esta aula? A sala e o professor ficarão novamente livres.",
      )
    )
      return;

    try {
      const res = await fetch(`${API_URL}/api/coaching/${idCoaching}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok) {
        mostrarMsg("Coaching cancelado com sucesso.", "ok");
        carregarDados();
      } else {
        mostrarMsg(data.mensagem || "Erro ao cancelar o coaching.", "erro");
      }
    } catch (err) {
      mostrarMsg("Erro de comunicação com o servidor.", "erro");
    }
  }

  const pendentes = utilizadores.filter(
    (u) => u.ativo === false || u.ativo === 0,
  );
  const aceites = utilizadores.filter((u) => u.ativo === true || u.ativo === 1);
  const profs = aceites.filter(
    (u) => u.perfis && u.perfis.toLowerCase().includes("prof"),
  );
  const encarregados = aceites.filter(
    (u) =>
      u.perfis &&
      (u.perfis.toLowerCase().includes("encarregado") ||
        u.perfis.toLowerCase().includes("educação") ||
        u.perfis === "EE"),
  );
  const adminsEOutros = aceites.filter(
    (u) =>
      u.perfis &&
      !u.perfis.toLowerCase().includes("prof") &&
      !u.perfis.toLowerCase().includes("encarregado") &&
      !u.perfis.toLowerCase().includes("educação") &&
      u.perfis !== "EE",
  );

  const coachingsEspera = historicoCoachings.filter(
    (c) => c.estado === "Agendado" || c.estado === "Confirmado",
  );
  const coachingsConcluidos = historicoCoachings.filter(
    (c) => c.estado === "Realizado" || c.estado === "Nao_Realizado",
  );
  const coachingsCancelados = historicoCoachings.filter(
    (c) => c.estado === "Cancelado",
  );

  const eeOptions = encarregados.map((ee) => ({
    id: ee.id_utilizador,
    label: `${ee.nome} (Aluno: ${ee.nomeAluno || "Sem aluno registado"})`,
  }));

  const profSelecionado = profs.find(
    (p) => String(p.id_utilizador) === String(modalAgendarDireto.idProfessor),
  );
  const modSelecionada = allModalidades.find(
    (m) => String(m.id_modalidade) === String(modalAgendarDireto.idModalidade),
  );

  const modalidadesDisponiveis =
    modalAgendarDireto.idProfessor && profSelecionado
      ? allModalidades.filter((m) =>
          (profSelecionado.modalidades || "").includes(m.nome),
        )
      : allModalidades;

  const profsDisponiveis =
    modalAgendarDireto.idModalidade && modSelecionada
      ? profs.filter((p) => (p.modalidades || "").includes(modSelecionada.nome))
      : profs;

  const handleModChange = (idMod) => {
    let nextProf = modalAgendarDireto.idProfessor;
    if (idMod && nextProf) {
      const mod = allModalidades.find(
        (m) => String(m.id_modalidade) === String(idMod),
      );
      const prof = profs.find(
        (p) => String(p.id_utilizador) === String(nextProf),
      );
      if (mod && prof && !(prof.modalidades || "").includes(mod.nome)) {
        nextProf = "";
      }
    }
    setModalAgendarDireto({
      ...modalAgendarDireto,
      idModalidade: idMod,
      idProfessor: nextProf,
    });
  };

  const handleProfChange = (idProf) => {
    let nextMod = modalAgendarDireto.idModalidade;
    if (idProf && nextMod) {
      const prof = profs.find(
        (p) => String(p.id_utilizador) === String(idProf),
      );
      const mod = allModalidades.find(
        (m) => String(m.id_modalidade) === String(nextMod),
      );
      if (prof && mod && !(prof.modalidades || "").includes(mod.nome)) {
        nextMod = "";
      }
    }
    setModalAgendarDireto({
      ...modalAgendarDireto,
      idProfessor: idProf,
      idModalidade: nextMod,
    });
  };

  const renderTabelaUtilizadores = (listaUtilizadores, tipoTabela) => (
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Nome</th>
          <th>Email</th>
          <th>Telefone</th>
          {tipoTabela === "PENDENTES" && <th>Educando / Modalidades</th>}
          {tipoTabela === "PROF" && <th>Modalidades</th>}
          {tipoTabela === "EE" && <th>Educando</th>}
          <th>Estado</th>
          <th>Criação</th>
          <th className="text-center">Ações</th>
        </tr>
      </thead>
      <tbody>
        {listaUtilizadores.map((u) => {
          const isAtivo = u.ativo === true || u.ativo === 1;
          const isProf = u.perfis && u.perfis.toLowerCase().includes("prof");

          return (
            <tr
              key={u.id_utilizador}
              className={!isAtivo ? "table-row--pending" : ""}
            >
              <td>{u.id_utilizador}</td>
              <td>
                <strong>{u.nome}</strong>
              </td>
              <td>{u.email}</td>
              <td>{u.telefone || "—"}</td>

              {tipoTabela === "PENDENTES" && (
                <td>
                  {isProf
                    ? u.modalidades || (
                        <span style={{ opacity: 0.5 }}>Nenhuma</span>
                      )
                    : u.nomeAluno || "—"}
                </td>
              )}
              {tipoTabela === "PROF" && (
                <td>
                  {u.modalidades || (
                    <span style={{ opacity: 0.5 }}>Nenhuma</span>
                  )}
                </td>
              )}
              {tipoTabela === "EE" && <td>{u.nomeAluno || "—"}</td>}

              <td>
                <span
                  className={`badge badge--${isAtivo ? "green" : "orange"}`}
                >
                  {isAtivo ? "Ativo" : "Pendente"}
                </span>
              </td>
              <td>{new Date(u.data_criacao).toLocaleDateString("pt-PT")}</td>
              <td className="text-center whitespace-nowrap">
                {!isAtivo ? (
                  <>
                    <button
                      className="btn-sm btn-sm--green mr-8"
                      onClick={() => handleAceitarUtilizador(u.id_utilizador)}
                    >
                      Aceitar
                    </button>
                    <button
                      className="btn-sm btn-sm--danger mr-8"
                      onClick={() => handleEliminarUtilizador(u.id_utilizador)}
                    >
                      Eliminar
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-sm btn-sm--danger mr-8"
                    onClick={() => handleRevogarUtilizador(u.id_utilizador)}
                  >
                    Suspender
                  </button>
                )}
                {isProf && isAtivo && (
                  <button
                    className="btn-sm btn-sm--gold mr-8"
                    onClick={() => abrirModalModalidades(u)}
                  >
                    Modalidades
                  </button>
                )}
                <button
                  className="btn-sm btn-sm--primary"
                  onClick={() => abrirModalEditar(u)}
                >
                  Editar
                </button>
              </td>
            </tr>
          );
        })}
        {listaUtilizadores.length === 0 && (
          <tr>
            <td colSpan={tipoTabela === "ADMIN" ? 7 : 8} className="empty-row">
              Vazio.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderLinhaCoaching = (c, permiteCancelar = false) => (
    <tr key={c.id_coaching}>
      <td>
        <strong>{formatDataApi(c.data_aula)}</strong>
        <div style={{ fontSize: "0.8rem", color: "#666" }}>
          {formatHoraCurta(c.hora_inicio)} ({c.duracao_minutos} min)
        </div>
      </td>
      <td>
        <div style={{ fontWeight: "600" }}>{c.alunos || "—"}</div>
        <small style={{ display: "block", color: "#555" }}>
          EE: {c.encarregado}
        </small>
      </td>
      <td>
        <strong>{c.nome_professor}</strong>
        <div style={{ fontSize: "0.8rem", color: "var(--primary-color)" }}>
          {c.sala || "Sem sala"}
        </div>
      </td>
      <td>
        {c.modalidade}
        <div style={{ fontSize: "0.75rem", color: "#777" }}>
          {c.formato_aula}
        </div>
      </td>
      <td style={{ fontWeight: "bold" }}>
        {c.valor_final != null ? `${Number(c.valor_final).toFixed(2)}€` : "—"}
      </td>
      <td>
        <span
          className={`badge badge--${c.estado === "Realizado" ? "green" : c.estado === "Cancelado" ? "danger" : "blue"}`}
        >
          {c.estado}
        </span>
      </td>
      {permiteCancelar ? (
        <td className="text-center">
          <button
            className="btn-sm btn-sm--danger"
            onClick={() => handleCancelarCoaching(c.id_coaching)}
          >
            Cancelar
          </button>
        </td>
      ) : (
        <td className="text-center">
          <span style={{ color: "#888", fontSize: "0.85rem" }}>🔒 Fechado</span>
        </td>
      )}
    </tr>
  );

  useEffect(() => {
    if (!token || !isAuthorized) return;
    if (activeTab === "inventario") carregarInventario();
    if (activeTab === "historico_geral") carregarHistoricoGeral();

    if (activeTab === "faturacao") {
      if (faturacaoFiltro.subTab === "precos") {
        carregarPrecos();
      } else {
        carregarFaturas();
      }
    }
  }, [activeTab, faturacaoFiltro.subTab, token, isAuthorized]);

  if (!isAuthorized) {
    return (
      <div className="admin-login-wrapper">
        <div className="admin-login-box">
          <img src={logoImg} alt="Logo" className="admin-login-logo" />
          <h2 className="admin-login-title">Painel Restrito</h2>
          <p className="admin-login-subtitle">
            Acesso exclusivo à Administração
          </p>

          <form className="admin-form" onSubmit={handleAdminLogin}>
            {loginError && (
              <div className="info-note info-note--error">{loginError}</div>
            )}
            <div className="field">
              <label>Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full p-14">
              Entrar
            </button>
          </form>
          <button className="btn-text-link" onClick={irParaLanding}>
            Voltar ao site
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "🏠 Visão Geral" },
    { id: "utilizadores", label: "👥 Utilizadores" },
    { id: "inventario", label: "📦 Inventário" },
    { id: "coaching", label: "🗓️ Pedidos Coaching" },
    { id: "historico_coaching", label: "📚 Histórico de Coachings" },
    { id: "faturacao", label: "💶 Faturação" },
    { id: "historico_geral", label: "🕓 Histórico" },
  ];

  async function carregarFaturas() {
    setFaturacaoLoading(true);
    try {
      const params = new URLSearchParams();
      if (faturacaoFiltro.ano) params.append("ano", faturacaoFiltro.ano);
      if (faturacaoFiltro.mes) params.append("mes", faturacaoFiltro.mes);
      if (faturacaoFiltro.estado)
        params.append("estado", faturacaoFiltro.estado);
      const res = await fetch(`${API_URL}/api/faturacao?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        mostrarMsg(
          err.mensagem || `Erro ${res.status} ao carregar faturas.`,
          "erro",
        );
        setFaturas([]);
        return;
      }
      const data = await res.json();
      setFaturas(Array.isArray(data) ? data : []);
    } catch (e) {
      mostrarMsg("Erro de ligação ao servidor.", "erro");
    } finally {
      setFaturacaoLoading(false);
    }
  }

  async function handleRegistarPagamentoFatura(idFatura, metodoPagamento) {
    try {
      const res = await fetch(
        `${API_URL}/api/faturacao/${idFatura}/pagamento`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ metodoPagamento }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        mostrarMsg(data.mensagem || "Erro ao registar pagamento.", "erro");
        return;
      }
      mostrarMsg("Pagamento registado com sucesso!", "ok");
      carregarFaturas();
    } catch (err) {
      mostrarMsg("Erro de ligação ao servidor.", "erro");
    }
  }

  async function handleCancelarFatura(idFatura) {
    if (!window.confirm("Tens a certeza que queres CANCELAR esta fatura?"))
      return;
    try {
      const res = await fetch(`${API_URL}/api/faturacao/${idFatura}/cancelar`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        mostrarMsg(data.mensagem || "Erro ao cancelar fatura.", "erro");
        return;
      }
      mostrarMsg("Fatura cancelada.", "ok");
      carregarFaturas();
    } catch (err) {
      mostrarMsg("Erro de ligação ao servidor.", "erro");
    }
  }

  async function abrirDetalheFatura(idFatura) {
    setModalDetalheFatura({
      isOpen: true,
      loading: true,
      erro: "",
      fatura: null,
      linhas: [],
      modoIndividual: false,
    });
    try {
      const res = await fetch(`${API_URL}/api/faturacao/${idFatura}/linhas`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setModalDetalheFatura({
          isOpen: true,
          loading: false,
          erro: data.mensagem || "Não foi possível carregar o detalhe.",
          fatura: null,
          linhas: [],
          modoIndividual: false,
        });
        return;
      }
      const data = await res.json();
      const linhas = Array.isArray(data.linhas) ? data.linhas : [];
      setModalDetalheFatura({
        isOpen: true,
        loading: false,
        erro: "",
        fatura: data.fatura || null,
        linhas,
        modoIndividual:
          typeof data.modoIndividual === "boolean"
            ? data.modoIndividual
            : linhas.length === 1,
      });
    } catch (err) {
      setModalDetalheFatura({
        isOpen: true,
        loading: false,
        erro: "Erro de ligação ao servidor.",
        fatura: null,
        linhas: [],
        modoIndividual: false,
      });
    }
  }

  function fecharDetalheFatura() {
    setModalDetalheFatura({
      isOpen: false,
      loading: false,
      erro: "",
      fatura: null,
      linhas: [],
      modoIndividual: false,
    });
  }

  async function carregarHistoricoGeral() {
    setHistoricoLoading(true);
    setHistoricoIndisponivel(false);
    try {
      const params = new URLSearchParams();
      if (historicoFiltro.tipo) params.append("tipo", historicoFiltro.tipo);
      if (historicoFiltro.utilizador)
        params.append("utilizador", historicoFiltro.utilizador);
      if (historicoFiltro.desde) params.append("desde", historicoFiltro.desde);
      if (historicoFiltro.ate) params.append("ate", historicoFiltro.ate);

      const res = await fetch(`${API_URL}/api/auditoria?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 404) {
        setHistoricoIndisponivel(true);
        setHistoricoGeral([]);
        return;
      }
      if (!res.ok) {
        setHistoricoGeral([]);
        return;
      }
      const data = await res.json();
      setHistoricoGeral(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Erro ao carregar histórico", e);
      setHistoricoIndisponivel(true);
      setHistoricoGeral([]);
    } finally {
      setHistoricoLoading(false);
    }
  }

  async function carregarInventario() {
    try {
      const [catalogo, vendas] = await Promise.all([
        apiFetch("/api/inventario", token).catch(() => []),
        apiFetch("/api/inventario/vendas", token).catch(() => []),
      ]);

      const listaCatalogo = Array.isArray(catalogo) ? catalogo : [];
      const listaVendas = Array.isArray(vendas) ? vendas : [];

      const vendaPorPeca = new Map();
      for (const v of listaVendas) {
        if (v.id_peca == null) continue;
        const existente = vendaPorPeca.get(v.id_peca);
        const isDisponivel =
          v.estado_venda === "Disponível" || v.estado_venda === "Disponivel";
        if (!existente) {
          vendaPorPeca.set(v.id_peca, v);
          continue;
        }
        const existenteIsDisp =
          existente.estado_venda === "Disponível" ||
          existente.estado_venda === "Disponivel";
        if (isDisponivel && !existenteIsDisp) {
          vendaPorPeca.set(v.id_peca, v);
        } else if (
          !existenteIsDisp &&
          !isDisponivel &&
          (v.id_venda || 0) > (existente.id_venda || 0)
        ) {
          vendaPorPeca.set(v.id_peca, v);
        }
      }

      const enriquecida = listaCatalogo.map((p) => {
        const venda = vendaPorPeca.get(p.id_peca);
        const preco =
          venda?.preco != null
            ? venda.preco
            : p.preco_venda != null
              ? p.preco_venda
              : p.preco != null
                ? p.preco
                : null;
        return {
          ...p,
          preco_venda: preco,
          id_venda: venda?.id_venda ?? p.id_venda ?? null,
          metodos_aceites_venda:
            venda?.metodos_aceites ?? p.metodos_aceites_venda ?? null,
          vendedor: venda?.vendedor ?? null,
          comprador: venda?.comprador ?? null,
          estado_venda: venda?.estado_venda ?? null,
        };
      });

      setInventario(enriquecida);
    } catch (e) {
      console.error("Erro ao carregar inventário", e);
      setInventario([]);
    }
  }

  function abrirModalCriarPeca() {
    setModalPeca({
      isOpen: true,
      mode: "create",
      data: {
        nome: "",
        descricao: "",
        tamanho: "",
        estado: "Bom",
        preco: "",
        disponivelVenda: false,
        disponivelEmprestimo: false,
        valor_dia: "",
        fotos: [],
        metodosPagamento: ["MBWay"],
        metodosPagamentoEmprestimo: ["MBWay"],
      },
    });
  }

  async function abrirModalEditarPeca(p) {
    setModalPeca({
      isOpen: true,
      mode: "edit",
      data: {
        id: p.id_peca,
        nome: p.nome_peca || p.nome || "",
        descricao: p.descricao || "",
        tamanho: p.tamanho || "",
        estado: p.condicao_peca || p.estado || "Bom",
        preco: p.preco_venda ?? p.preco ?? "",
        disponivelVenda: !!(p.disponivel_para_venda || p.disponivel_venda),
        disponivelEmprestimo: !!(
          p.disponivel_para_emprestimo || p.disponivel_emprestimo
        ),
        valor_dia: p.valor_dia ?? "",
        fotos: [],
        metodosPagamento: p.metodos_aceites_venda
          ? p.metodos_aceites_venda.split(",").map((m) => m.trim())
          : ["MBWay"],

        metodosPagamentoEmprestimo: p.metodos_pagamento
          ? p.metodos_pagamento.split(",").map((m) => m.trim())
          : ["MBWay"],
      },
    });

    try {
      const detalhes = await apiFetch(`/api/inventario/${p.id_peca}`, token);
      const fotosAtuais = Array.isArray(detalhes?.fotos)
        ? detalhes.fotos.map((f) => f.foto || f).filter(Boolean)
        : [];
      setModalPeca((prev) =>
        prev.isOpen && prev.data.id === p.id_peca
          ? { ...prev, data: { ...prev.data, fotos: fotosAtuais } }
          : prev,
      );
    } catch (e) {
      console.warn("Não foi possível carregar fotos da peça", e);
    }
  }

  function ficheiroParaBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async function handleAdicionarFotos(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const base64s = await Promise.all(files.map(ficheiroParaBase64));
      setModalPeca((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          fotos: [...(prev.data.fotos || []), ...base64s],
        },
      }));
    } catch (err) {
      mostrarMsg("Erro ao processar imagem.", "erro");
    }
    e.target.value = "";
  }

  function handleRemoverFoto(index) {
    setModalPeca((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        fotos: (prev.data.fotos || []).filter((_, i) => i !== index),
      },
    }));
  }

  async function submeterModalPeca(e) {
    e.preventDefault();
    const d = modalPeca.data;

    if (d.disponivelVenda) {
      if (!d.preco || d.preco === "" || parseFloat(d.preco) <= 0) {
        return mostrarMsg(
          "O preço de venda é obrigatório e deve ser maior que 0€.",
          "erro",
        );
      }
    }

    if (d.disponivelEmprestimo) {
      if (!d.valor_dia || d.valor_dia === "" || parseFloat(d.valor_dia) <= 0) {
        return mostrarMsg(
          "O valor diário de empréstimo é obrigatório e deve ser maior que 0€.",
          "erro",
        );
      }
    }
    try {
      if (modalPeca.mode === "create") {
        await apiFetchChecked("/api/inventario", token, {
          method: "POST",
          body: {
            nome: d.nome,
            descricao: d.descricao,
            tamanho: d.tamanho,
            estado: d.estado,
            disponivelVenda: d.disponivelVenda,
            disponivelEmprestimo: d.disponivelEmprestimo,
            valor_dia: d.valor_dia,
            preco: d.preco,
            metodosPagamento: d.metodosPagamento,
            fotos: d.fotos && d.fotos.length > 0 ? d.fotos : undefined,
          },
        });
        mostrarMsg("Peça criada com sucesso!", "ok");
      } else {
        await apiFetchChecked(`/api/inventario/${d.id}/editar`, token, {
          method: "PUT",
          body: {
            nome: d.nome,
            descricao: d.descricao,
            tamanho: d.tamanho,
            estado: d.estado,
            preco: d.preco,
            valor_dia: d.valor_dia,
            disponivelVenda: d.disponivelVenda,
            disponivelEmprestimo: d.disponivelEmprestimo,
            metodosPagamentoEmprestimo: d.metodosPagamentoEmprestimo,
            metodosPagamento: d.metodosPagamento,
            fotos: d.fotos && d.fotos.length > 0 ? d.fotos : undefined,
          },
        });
        mostrarMsg("Peça atualizada com sucesso!", "ok");
      }
      setModalPeca({ isOpen: false, mode: "create", data: {} });
      carregarInventario();
    } catch (err) {
      mostrarMsg(err.message || "Erro ao guardar peça.", "erro");
    }
  }

  async function handleDefinirPrecoVenda(peca) {
    const precoStr = window.prompt(
      `Definir preço de venda para "${peca.nome_peca || peca.nome}" (€):`,
      "",
    );
    if (precoStr == null) return;
    const preco = parseFloat(String(precoStr).replace(",", "."));
    if (Number.isNaN(preco) || preco <= 0) {
      mostrarMsg("Preço inválido.", "erro");
      return;
    }
    try {
      await apiFetchChecked("/api/inventario/vendas", token, {
        method: "POST",
        body: {
          idPeca: peca.id_peca,
          preco,
          nomePeca: peca.nome_peca || peca.nome,
          condicaoPeca: peca.condicao_peca || peca.estado,
        },
      });
      mostrarMsg("Preço de venda definido!", "ok");
      carregarInventario();
    } catch (err) {
      mostrarMsg(err.message || "Erro ao definir preço.", "erro");
    }
  }

  async function handleEliminarPeca(idPeca, nome) {
    if (
      !window.confirm(
        `Tens a certeza que queres ELIMINAR permanentemente esta peça${nome ? ` ("${nome}")` : ""}?`,
      )
    )
      return;
    try {
      await apiFetchChecked(`/api/inventario/${idPeca}`, token, {
        method: "DELETE",
      });
      mostrarMsg("Peça removida do inventário.", "ok");
      carregarInventario();
    } catch (err) {
      mostrarMsg(err.message || "Erro ao apagar peça.", "erro");
    }
  }

  async function submeterEstadoPeca(e) {
    e.preventDefault();
    const { peca, estado, dispEmp, dispVenda } = modalEstado;
    try {
      await apiFetchChecked(`/api/inventario/${peca.id_peca}`, token, {
        method: "PUT",
        body: {
          estado,
          disponivelEmprestimo: dispEmp,
          disponivelVenda: dispVenda,
        },
      });
      mostrarMsg("Estado da peça atualizado!", "ok");
      setModalEstado({
        isOpen: false,
        peca: null,
        estado: "",
        dispEmp: false,
        dispVenda: false,
      });
      carregarInventario();
    } catch (err) {
      mostrarMsg(err.message || "Erro ao atualizar estado.", "erro");
    }
  }

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img
            src={logoImg}
            alt="Logo"
            style={{ width: "65px", height: "auto", objectFit: "contain" }}
          />
          <div>
            <p className="brand-name">Viva D'arte</p>
            <p className="brand-role">Coordenação</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${activeTab === t.id ? "nav-item--active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
              {t.id === "utilizadores" && pendentes.length > 0 && (
                <span className="sidebar-badge sidebar-badge--red">
                  {pendentes.length}
                </span>
              )}
              {t.id === "coaching" && pedidosPendentes.length > 0 && (
                <span className="sidebar-badge sidebar-badge--teal">
                  {pedidosPendentes.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-user">{utilizador?.nome}</p>
          <button
            className="sidebar-logout"
            onClick={() => {
              localStorage.clear();
              irParaLanding();
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {activeTab === "overview" && (
          <div className="tab-content">
            <h1 className="page-title">
              Olá, {utilizador?.nome?.split(" ")[0]}{" "}
            </h1>
            <p className="page-subtitle">Resumo do sistema</p>

            <div className="stats-grid">
              <StatCard
                icon="👥"
                label="Total Utilizadores"
                value={utilizadores.length}
                accent="blue"
                onClick={() => setActiveTab("utilizadores")}
              />
              <StatCard
                icon="⏳"
                label="Por Aprovar"
                value={pendentes.length}
                accent="orange"
                onClick={() => setActiveTab("utilizadores")}
              />
            </div>
            <div className="stats-grid" style={{ marginTop: "20px" }}>
              <StatCard
                icon="🗓️"
                label="Pedidos Coaching"
                value={pedidosPendentes.length}
                accent="teal"
                onClick={() => setActiveTab("coaching")}
              />
            </div>
            <div className="stats-grid" style={{ marginTop: "20px" }}>
              <StatCard
                icon="📦"
                label="Peças em Stock"
                value={inventario.length}
                accent="teal"
                onClick={() => setActiveTab("inventario")}
              />
            </div>
          </div>
        )}

        {activeTab === "utilizadores" && (
          <div className="tab-content">
            <h1 className="page-title">👥 Gestão de Utilizadores</h1>
            <Section
              title={`Pendentes (${pendentes.length})`}
              defaultOpen={true}
            >
              {renderTabelaUtilizadores(pendentes, "PENDENTES")}
            </Section>
            <Section
              title={`Encarregados de Educação (${encarregados.length})`}
              defaultOpen={true}
              actionButton={
                <button
                  className="btn-sm btn-sm--primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirModalCriar("EE");
                  }}
                >
                  + Novo
                </button>
              }
            >
              {renderTabelaUtilizadores(encarregados, "EE")}
            </Section>
            <Section
              title={`Professores (${profs.length})`}
              defaultOpen={true}
              actionButton={
                <button
                  className="btn-sm btn-sm--primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirModalCriar("PROF");
                  }}
                >
                  + Novo
                </button>
              }
            >
              {renderTabelaUtilizadores(profs, "PROF")}
            </Section>
            <Section
              title={`Administração (${adminsEOutros.length})`}
              defaultOpen={true}
              actionButton={
                <button
                  className="btn-sm btn-sm--primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirModalCriar("ADMIN");
                  }}
                >
                  + Novo
                </button>
              }
            >
              {renderTabelaUtilizadores(adminsEOutros, "ADMIN")}
            </Section>
          </div>
        )}

        {activeTab === "coaching" && (
          <div className="tab-content">
            <h1 className="page-title">🗓️ Pedidos de Coaching</h1>
            <p className="page-subtitle">
              Gestão de pedidos a aguardar aprovação da coordenação
            </p>

            <Section
              title={`Pedidos Pendentes (${pedidosPendentes.length})`}
              defaultOpen={true}
              actionButton={
                <button
                  className="btn-sm btn-sm--primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalAgendarDireto({
                      ...modalAgendarDireto,
                      isOpen: true,
                    });
                  }}
                >
                  + Criar Agendamento Direto
                </button>
              }
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Encarregado</th>
                    <th>Aluno(s)</th>
                    <th>Prof. Req.</th>
                    <th>Modalidade</th>
                    <th>Formato / Duração</th>
                    <th>Data Pretendida</th>
                    <th>Estado</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPendentes.map((p) => (
                    <tr key={p.id_pedido_coaching}>
                      <td>#{p.id_pedido_coaching}</td>
                      <td>
                        <strong>{p.encarregado || "—"}</strong>
                      </td>
                      <td>{p.nome_aluno || p.alunos || "—"}</td>
                      <td>{p.professor || "Qualquer"}</td>
                      <td>{p.modalidade}</td>
                      <td>
                        {p.formato_aula} ({p.duracao_minutos} min)
                      </td>
                      <td>
                        {formatDataApi(p.data_aula_pretendida)} às{" "}
                        {formatHoraCurta(p.hora_inicio_pretendida)}
                      </td>
                      <td>
                        <span className="badge badge--orange">Pendente</span>
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <button
                          className="btn-sm btn-sm--green mr-8"
                          onClick={() => abrirModalAprovarPedido(p)}
                        >
                          Aprovar
                        </button>
                        <button
                          className="btn-sm btn-sm--danger"
                          onClick={() =>
                            handleRejeitarPedido(p.id_pedido_coaching)
                          }
                        >
                          Rejeitar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pedidosPendentes.length === 0 && (
                    <tr>
                      <td colSpan="9" className="empty-row">
                        Nenhum pedido encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
          </div>
        )}

        {activeTab === "historico_coaching" && (
          <div className="tab-content">
            <h1 className="page-title">📚 Histórico de Coachings</h1>
            <p className="page-subtitle">
              Acompanhamento detalhado de aulas agendadas, realizadas ou
              canceladas.
            </p>
            <Section
              title={` À Espera de Conclusão (${coachingsEspera.length})`}
              defaultOpen={true}
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Aluno(s) / EE</th>
                    <th>Professor / Sala</th>
                    <th>Modalidade</th>
                    <th>Valor</th>
                    <th>Estado</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {coachingsEspera.map((c) => renderLinhaCoaching(c, true))}
                  {coachingsEspera.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center empty-row">
                        Nenhuma aula pendente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
            <Section
              title={` Concluídas (${coachingsConcluidos.length})`}
              defaultOpen={true}
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Aluno(s) / EE</th>
                    <th>Professor / Sala</th>
                    <th>Modalidade</th>
                    <th>Valor</th>
                    <th>Estado</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {coachingsConcluidos.map((c) =>
                    renderLinhaCoaching(c, false),
                  )}
                  {coachingsConcluidos.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center empty-row">
                        Nenhuma aula concluída.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
            <Section
              title={` Canceladas (${coachingsCancelados.length})`}
              defaultOpen={false}
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Aluno(s) / EE</th>
                    <th>Professor / Sala</th>
                    <th>Modalidade</th>
                    <th>Valor</th>
                    <th>Estado</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {coachingsCancelados.map((c) =>
                    renderLinhaCoaching(c, false),
                  )}
                  {coachingsCancelados.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center empty-row">
                        Nenhuma aula cancelada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Section>
          </div>
        )}

        {/* TAB: FATURAÇÃO*/}
        {activeTab === "faturacao" && (
          <div className="tab-content">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h1 className="page-title" style={{ margin: 0 }}>
                  Faturação
                </h1>
                <p className="page-subtitle">
                  Gestão de faturas e tabela de preços
                </p>
              </div>
            </div>

            {/* SUB-ABAS DA FATURAÇÃO */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                borderBottom: "2px solid #e5e5e5",
                marginBottom: "20px",
              }}
            >
              <button
                onClick={() =>
                  setFaturacaoFiltro((prev) => ({ ...prev, subTab: "faturas" }))
                }
                style={{
                  padding: "10px 18px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.92rem",
                  fontWeight: faturacaoFiltro.subTab !== "precos" ? 700 : 500,
                  color:
                    faturacaoFiltro.subTab !== "precos" ? "#c9a961" : "#666",
                  borderBottom:
                    faturacaoFiltro.subTab !== "precos"
                      ? "3px solid #c9a961"
                      : "3px solid transparent",
                }}
              >
                Lista de Faturas
              </button>
              <button
                onClick={() =>
                  setFaturacaoFiltro((prev) => ({ ...prev, subTab: "precos" }))
                }
                style={{
                  padding: "10px 18px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.92rem",
                  fontWeight: faturacaoFiltro.subTab === "precos" ? 700 : 500,
                  color:
                    faturacaoFiltro.subTab === "precos" ? "#c9a961" : "#666",
                  borderBottom:
                    faturacaoFiltro.subTab === "precos"
                      ? "3px solid #c9a961"
                      : "3px solid transparent",
                }}
              >
                Tabela de Preços
              </button>
            </div>

            {faturacaoFiltro.subTab !== "precos" ? (
              /* --- ÁREA DE FATURAS  --- */
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                {/* 2. FILTROS E BOTÃO DE EXPORTAR  */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    padding: "16px 20px",
                    marginBottom: "24px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    display: "flex",
                    gap: "16px",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    className="field"
                    style={{ margin: 0, flex: "1 1 120px" }}
                  >
                    <label>Ano</label>
                    <input
                      type="number"
                      placeholder="Ex: 2024"
                      min="2020"
                      max="2099"
                      value={faturacaoFiltro.ano}
                      onChange={(e) =>
                        setFaturacaoFiltro({
                          ...faturacaoFiltro,
                          ano: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div
                    className="field"
                    style={{ margin: 0, flex: "1 1 150px" }}
                  >
                    <label>Mês</label>
                    <select
                      value={faturacaoFiltro.mes}
                      onChange={(e) =>
                        setFaturacaoFiltro({
                          ...faturacaoFiltro,
                          mes: e.target.value,
                        })
                      }
                    >
                      <option value="">Todos os Meses</option>
                      {[
                        "Janeiro",
                        "Fevereiro",
                        "Março",
                        "Abril",
                        "Maio",
                        "Junho",
                        "Julho",
                        "Agosto",
                        "Setembro",
                        "Outubro",
                        "Novembro",
                        "Dezembro",
                      ].map((m, i) => (
                        <option key={i + 1} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className="field"
                    style={{ margin: 0, flex: "1 1 150px" }}
                  >
                    <label>Estado Pagamento</label>
                    <select
                      value={faturacaoFiltro.estado}
                      onChange={(e) =>
                        setFaturacaoFiltro({
                          ...faturacaoFiltro,
                          estado: e.target.value,
                        })
                      }
                    >
                      <option value="">Todos</option>
                      <option value="Pendente"> Pendente</option>
                      <option value="Pago">Pago</option>
                      <option value="Cancelado"> Cancelado</option>
                    </select>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flex: "2 1 auto",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      className="btn-submit"
                      style={{ padding: "10px 20px" }}
                      onClick={carregarFaturas}
                    >
                      Pesquisar
                    </button>
                    <button
                      className="btn-submit"
                      style={{
                        padding: "10px 20px",
                        backgroundColor: "var(--accent-gold)",
                      }}
                      onClick={() => {
                        if (faturas.length === 0)
                          return mostrarMsg(
                            "Não há dados para exportar. Pesquise primeiro.",
                            "erro",
                          );

                        const cabecalho =
                          "ID,Utilizador,Ano,Mes,Data Geracao,Total (€),Estado,Metodo Pagamento,Data Pagamento\n";
                        const linhas = faturas
                          .map(
                            (f) =>
                              `${f.id_faturacao},${f.nome_utilizador || "Sem Nome"},${f.ano},${f.mes},${f.data_geracao ? f.data_geracao.split("T")[0] : ""},${f.total},${f.estado_pagamento},${f.metodo_pagamento || ""},${f.data_pagamento ? f.data_pagamento.split("T")[0] : ""}`,
                          )
                          .join("\n");

                        const csvContent =
                          "data:text/csv;charset=utf-8," + cabecalho + linhas;
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute(
                          "download",
                          `Faturacao_VivaDArte_${new Date().toISOString().split("T")[0]}.csv`,
                        );
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        mostrarMsg("Extrato CSV exportado com sucesso!", "ok");
                      }}
                    >
                      Exportar CSV
                    </button>
                  </div>
                </div>

                {/* ESTATÍSTICAS RÁPIDAS */}
                {faturas.length > 0 && (
                  <div className="stats-grid" style={{ marginBottom: "24px" }}>
                    <StatCard
                      label="Total Faturado (Grelha)"
                      value={`${faturas.reduce((s, f) => s + Number(f.total || 0), 0).toFixed(2)}€`}
                      accent="blue"
                    />
                    <StatCard
                      label="Total Liquidado"
                      value={`${faturas
                        .filter((f) => f.estado_pagamento === "Pago")
                        .reduce((s, f) => s + Number(f.total || 0), 0)
                        .toFixed(2)}€`}
                      accent="teal"
                    />
                    <StatCard
                      label="Montante Pendente"
                      value={`${faturas
                        .filter((f) => f.estado_pagamento === "Pendente")
                        .reduce((s, f) => s + Number(f.total || 0), 0)
                        .toFixed(2)}€`}
                      accent="orange"
                    />
                  </div>
                )}

                {/* 3. TABELA DE FATURAS  */}
                <Section
                  title={`Registo de Faturas e Pagamentos (${faturas.length})`}
                  defaultOpen={true}
                >
                  {faturacaoLoading ? (
                    <div
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#888",
                      }}
                    >
                      A sincronizar dados financeiros...
                    </div>
                  ) : faturas.length === 0 ? (
                    <div
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        opacity: 0.5,
                      }}
                    >
                      <p>
                        Utilize os filtros acima para carregar a lista de
                        faturação.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "1px solid #eee",
                      }}
                    >
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ width: "60px" }}>Nº</th>
                            <th>Utilizador</th>
                            <th>Período</th>
                            <th>Total</th>
                            <th>Método de Pagamento</th>
                            <th>Data Pag.</th>
                            <th>Estado</th>
                            <th className="text-center">Ações de Tesouraria</th>
                          </tr>
                        </thead>
                        <tbody>
                          {faturas.map((f) => {
                            const meses = [
                              "",
                              "Janeiro",
                              "Fevereiro",
                              "Março",
                              "Abril",
                              "Maio",
                              "Junho",
                              "Julho",
                              "Agosto",
                              "Setembro",
                              "Outubro",
                              "Novembro",
                              "Dezembro",
                            ];
                            const estadoColor =
                              f.estado_pagamento === "Pago"
                                ? "green"
                                : f.estado_pagamento === "Cancelado"
                                  ? "danger"
                                  : "orange";

                            return (
                              <tr key={f.id_faturacao}>
                                <td
                                  style={{ opacity: 0.6, fontSize: "0.8rem" }}
                                >
                                  #{f.id_faturacao}
                                </td>
                                <td>
                                  <strong>
                                    {f.nome_utilizador || "Desconhecido"}
                                  </strong>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#888",
                                    }}
                                  >
                                    {f.email_utilizador || ""}
                                  </div>
                                </td>
                                <td>
                                  {meses[f.mes] || f.mes} / {f.ano}
                                </td>
                                <td>
                                  <strong
                                    style={{
                                      fontSize: "1.1rem",
                                      color: "var(--primary-dark)",
                                    }}
                                  >
                                    {Number(f.total || 0).toFixed(2)}€
                                  </strong>
                                </td>

                                {/* Consulta do Método e Data */}
                                <td>
                                  {f.metodo_pagamento ? (
                                    <span
                                      className="badge"
                                      style={{
                                        background: "#f0f0f0",
                                        color: "#555",
                                      }}
                                    >
                                      {f.metodo_pagamento}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td>
                                  {f.data_pagamento
                                    ? new Date(
                                        f.data_pagamento,
                                      ).toLocaleDateString("pt-PT")
                                    : "—"}
                                </td>

                                <td>
                                  <span
                                    className={`badge badge--${estadoColor}`}
                                  >
                                    {f.estado_pagamento || "—"}
                                  </span>
                                </td>

                                {/* Registo do Pagamento */}
                                <td className="text-center whitespace-nowrap">
                                  <button
                                    className="btn-sm"
                                    style={{
                                      background: "#fff",
                                      border: "1px solid #c9a961",
                                      color: "#7a6a3a",
                                      marginRight: "8px",
                                    }}
                                    onClick={() =>
                                      abrirDetalheFatura(f.id_faturacao)
                                    }
                                    title="Ver aulas que compõem esta fatura"
                                  >
                                    Detalhes
                                  </button>
                                  {f.estado_pagamento === "Pendente" ? (
                                    <>
                                      <button
                                        className="btn-sm btn-sm--green mr-8"
                                        onClick={() => {
                                          const metodo = window.prompt(
                                            "Indique o método de pagamento efetuado (ex: MBWay, Transferência, Multibanco, Numerário):",
                                            "MBWay",
                                          );
                                          if (metodo && metodo.trim())
                                            handleRegistarPagamentoFatura(
                                              f.id_faturacao,
                                              metodo.trim(),
                                            );
                                        }}
                                      >
                                        Marcar Pago
                                      </button>
                                      <button
                                        className="btn-sm btn-sm--danger"
                                        onClick={() =>
                                          handleCancelarFatura(f.id_faturacao)
                                        }
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  ) : (
                                    <span
                                      style={{
                                        color: "#aaa",
                                        fontSize: "0.85rem",
                                      }}
                                    >
                                      Fechado
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>
              </div>
            ) : (
              <Section title="Tabela de Preços (Coaching)" defaultOpen={true}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px",
                  }}
                >
                  {/* TABELA 1: DIAS ÚTEIS */}
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: "12px",
                      border: "1px solid #e0e0e0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--primary-dark)",
                        color: "#fff",
                        padding: "12px 16px",
                        fontWeight: "600",
                        borderBottom: "2px solid var(--accent-gold)",
                      }}
                    >
                      Dias Úteis
                    </div>
                    <table className="admin-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Formato</th>
                          <th>Duração</th>
                          <th>Preço</th>
                          <th>Estado</th>
                          <th className="text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabelaPrecos
                          .filter((p) => p.dia_semana === 1)
                          .map((regra) => (
                            <tr key={regra.id_preco}>
                              <td>
                                <span
                                  style={{
                                    fontWeight: "600",
                                    color: "var(--primary-dark)",
                                  }}
                                >
                                  {regra.formato_aula}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background: "#f0f0f0",
                                    color: "#555",
                                  }}
                                >
                                  {regra.duracao_minutos} min
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    fontSize: "1.1rem",
                                    fontWeight: "700",
                                    color: "var(--primary-dark)",
                                  }}
                                >
                                  {Number(regra.preco).toFixed(2)}€
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`badge badge--${regra.ativo ? "green" : "red"}`}
                                  style={{ fontSize: "0.7rem" }}
                                >
                                  {regra.ativo ? "ATIVO" : "INATIVO"}
                                </span>
                              </td>
                              <td className="text-center">
                                <button
                                  className="btn-sm btn-sm--gold"
                                  style={{ borderRadius: "20px" }}
                                  onClick={() => abrirModalEditarPreco(regra)}
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                        {tabelaPrecos.filter((p) => p.dia_semana === 1)
                          .length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center empty-row">
                              Sem regras para dias úteis.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* TABELA 2: FINS-DE-SEMANA */}
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: "12px",
                      border: "1px solid #e0e0e0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--primary-dark)",
                        color: "#fff",
                        padding: "12px 16px",
                        fontWeight: "600",
                        borderBottom: "2px solid var(--accent-gold)",
                      }}
                    >
                      Fins-de-Semana
                    </div>
                    <table className="admin-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Formato</th>
                          <th>Duração</th>
                          <th>Preço</th>
                          <th>Estado</th>
                          <th className="text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabelaPrecos
                          .filter((p) => p.dia_semana === 2)
                          .map((regra) => (
                            <tr key={regra.id_preco}>
                              <td>
                                <span
                                  style={{
                                    fontWeight: "600",
                                    color: "var(--primary-dark)",
                                  }}
                                >
                                  {regra.formato_aula}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background: "#f0f0f0",
                                    color: "#555",
                                  }}
                                >
                                  {regra.duracao_minutos} min
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    fontSize: "1.1rem",
                                    fontWeight: "700",
                                    color: "var(--primary-dark)",
                                  }}
                                >
                                  {Number(regra.preco).toFixed(2)}€
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`badge badge--${regra.ativo ? "green" : "red"}`}
                                  style={{ fontSize: "0.7rem" }}
                                >
                                  {regra.ativo ? "ATIVO" : "INATIVO"}
                                </span>
                              </td>
                              <td className="text-center">
                                <button
                                  className="btn-sm btn-sm--gold"
                                  style={{ borderRadius: "20px" }}
                                  onClick={() => abrirModalEditarPreco(regra)}
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                        {tabelaPrecos.filter((p) => p.dia_semana === 2)
                          .length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center empty-row">
                              Sem regras para fins-de-semana.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            )}
          </div>
        )}

        {/* TAB: HISTÓRICO / AUDITORIA*/}
        {activeTab === "historico_geral" && (
          <div className="tab-content">
            <div style={{ marginBottom: "20px" }}>
              <h1 className="page-title" style={{ margin: 0 }}>
                Histórico de Atividade
              </h1>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "#888",
                  fontSize: "0.9rem",
                }}
              >
                Auditoria de eventos do sistema — logins, alterações, compras,
                empréstimos
              </p>
            </div>

            {/* FILTROS */}
            <div
              style={{
                background: "#fff",
                borderRadius: "10px",
                padding: "16px 18px",
                marginBottom: "16px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <div className="field" style={{ margin: 0 }}>
                <label>Tipo de evento</label>
                <select
                  value={historicoFiltro.tipo}
                  onChange={(e) =>
                    setHistoricoFiltro({
                      ...historicoFiltro,
                      tipo: e.target.value,
                    })
                  }
                >
                  <option value="">Todos</option>
                  <option value="LOGIN">Login</option>
                  <option value="LOGOUT">Logout</option>
                  <option value="REGISTO">Registo de utilizador</option>
                  <option value="UTILIZADOR_EDIT">Edição de utilizador</option>
                  <option value="UTILIZADOR_APAGAR">Apagar utilizador</option>
                  <option value="PECA_CRIAR">Criação de peça</option>
                  <option value="PECA_EDITAR">Edição de peça</option>
                  <option value="PECA_APAGAR">Apagar peça</option>
                  <option value="VENDA_COLOCAR">Colocar peça à venda</option>
                  <option value="VENDA_CONCLUIR">Conclusão de venda</option>
                  <option value="EMPRESTIMO_PEDIR">Pedido de empréstimo</option>
                  <option value="EMPRESTIMO_DEVOLVER">
                    Devolução de empréstimo
                  </option>
                  <option value="COACHING_PEDIR">Pedido de coaching</option>
                  <option value="COACHING_APROVAR">
                    Aprovação de coaching
                  </option>
                  <option value="COACHING_REJEITAR">
                    Rejeição de coaching
                  </option>
                  <option value="COACHING_CANCELAR">
                    Cancelamento de coaching
                  </option>
                  <option value="FATURA_PAGAR">Pagamento de fatura</option>
                  <option value="FATURA_CANCELAR">
                    Cancelamento de fatura
                  </option>
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Utilizador (nome ou email)</label>
                <input
                  type="text"
                  placeholder="Filtrar..."
                  value={historicoFiltro.utilizador}
                  onChange={(e) =>
                    setHistoricoFiltro({
                      ...historicoFiltro,
                      utilizador: e.target.value,
                    })
                  }
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Desde</label>
                <input
                  type="date"
                  value={historicoFiltro.desde}
                  onChange={(e) =>
                    setHistoricoFiltro({
                      ...historicoFiltro,
                      desde: e.target.value,
                    })
                  }
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Até</label>
                <input
                  type="date"
                  value={historicoFiltro.ate}
                  onChange={(e) =>
                    setHistoricoFiltro({
                      ...historicoFiltro,
                      ate: e.target.value,
                    })
                  }
                />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-submit"
                  onClick={carregarHistoricoGeral}
                  style={{ flex: 1 }}
                >
                  Aplicar
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setHistoricoFiltro({
                      tipo: "",
                      utilizador: "",
                      desde: "",
                      ate: "",
                    });
                    setTimeout(() => carregarHistoricoGeral(), 0);
                  }}
                  style={{ flex: 1 }}
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* CONTEÚDO */}
            {historicoIndisponivel ? (
              <div
                style={{
                  background: "#fff8e6",
                  borderLeft: "4px solid #c9a961",
                  borderRadius: "10px",
                  padding: "18px 22px",
                  color: "#5a4a1a",
                }}
              >
                <strong>Histórico ainda não disponível no servidor.</strong>
                <p style={{ margin: "8px 0 0", fontSize: "0.92rem" }}>
                  O endpoint <code>GET /api/auditoria</code> ainda não está
                  implementado no backend. Para ativar esta funcionalidade é
                  preciso criar:
                </p>
                <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
                  <li>
                    Tabela <code>AUDIT_LOG</code> (id, tipo, descricao,
                    id_utilizador, ip, data_hora, dados_extra JSON)
                  </li>
                  <li>
                    Rota <code>GET /api/auditoria</code> com filtros por tipo,
                    utilizador, intervalo de datas
                  </li>
                  <li>
                    Helper <code>registarAuditoria(tipo, dados)</code> chamado
                    nos controllers de login, peças, vendas, coaching, etc.
                  </li>
                </ul>
              </div>
            ) : historicoLoading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "30px",
                  color: "#888",
                }}
              >
                A carregar histórico…
              </div>
            ) : (
              <div
                style={{
                  background: "#fff",
                  borderRadius: "10px",
                  overflow: "hidden",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                }}
              >
                <table className="admin-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Tipo</th>
                      <th>Utilizador</th>
                      <th>Descrição</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoGeral.map((h) => (
                      <tr key={h.id_audit || h.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {h.data_hora
                            ? new Date(h.data_hora).toLocaleString("pt-PT")
                            : "—"}
                        </td>
                        <td>
                          <span
                            className="badge badge--teal"
                            style={{
                              background: corDoEventoAuditoria(h.tipo),
                            }}
                          >
                            {legivelTipoEvento(h.tipo)}
                          </span>
                        </td>
                        <td>
                          <strong>{h.nome_utilizador || "—"}</strong>
                          {h.email_utilizador && (
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "#888",
                              }}
                            >
                              {h.email_utilizador}
                            </div>
                          )}
                        </td>
                        <td>{h.descricao || "—"}</td>
                        <td style={{ fontFamily: "monospace", color: "#888" }}>
                          {h.ip || "—"}
                        </td>
                      </tr>
                    ))}
                    {historicoGeral.length === 0 && (
                      <tr>
                        <td
                          colSpan="5"
                          style={{
                            textAlign: "center",
                            padding: "30px",
                            color: "#888",
                          }}
                        >
                          Nenhum evento encontrado com estes filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: INVENTÁRIO*/}
        {activeTab === "inventario" && (
          <div className="tab-content">
            {(() => {
              const totalPecas = inventario.length;
              const pecasEmprestimo = inventario.filter(
                (p) => p.disponivel_para_emprestimo || p.disponivel_emprestimo,
              );
              const pecasVenda = inventario.filter(
                (p) => p.disponivel_para_venda || p.disponivel_venda,
              );
              const emprestadasAgora = inventario.filter(
                (p) => p.active_id_emprestimo,
              ).length;
              const semPrecoVenda = pecasVenda.filter(
                (p) => p.preco_venda == null,
              ).length;

              let listaAtual = inventario;
              if (inventarioTab === "emprestimo") listaAtual = pecasEmprestimo;
              else if (inventarioTab === "venda") listaAtual = pecasVenda;

              return (
                <>
                  {/* CABEÇALHO */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "20px",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <h1 className="page-title" style={{ margin: 0 }}>
                        📦 Gestão de Inventário
                      </h1>
                      <p
                        style={{
                          margin: "4px 0 0",
                          color: "#888",
                          fontSize: "0.9rem",
                        }}
                      >
                        Coordenação e Administração — figurinos, equipamento e
                        peças à venda
                      </p>
                    </div>
                    <button
                      className="btn-submit"
                      onClick={abrirModalCriarPeca}
                    >
                      + Nova Peça
                    </button>
                  </div>

                  {/* CARDS DE RESUMO */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "14px",
                      marginBottom: "24px",
                    }}
                  >
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: "10px",
                        padding: "16px 18px",
                        borderLeft: "4px solid #5a8dee",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "#888",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Total Peças
                      </div>
                      <div
                        style={{
                          fontSize: "1.8rem",
                          fontWeight: 700,
                          marginTop: "4px",
                        }}
                      >
                        {totalPecas}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        borderRadius: "10px",
                        padding: "16px 18px",
                        borderLeft: "4px solid #38a169",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "#888",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Para Empréstimo
                      </div>
                      <div
                        style={{
                          fontSize: "1.8rem",
                          fontWeight: 700,
                          marginTop: "4px",
                        }}
                      >
                        {pecasEmprestimo.length}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#888",
                          marginTop: "2px",
                        }}
                      >
                        {emprestadasAgora} emprestada
                        {emprestadasAgora === 1 ? "" : "s"} agora
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        borderRadius: "10px",
                        padding: "16px 18px",
                        borderLeft: "4px solid #c9a961",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "#888",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        À Venda
                      </div>
                      <div
                        style={{
                          fontSize: "1.8rem",
                          fontWeight: 700,
                          marginTop: "4px",
                        }}
                      >
                        {pecasVenda.length}
                      </div>
                      {semPrecoVenda > 0 && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#c0392b",
                            marginTop: "2px",
                          }}
                        >
                          {semPrecoVenda} sem preço definido
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        borderRadius: "10px",
                        padding: "16px 18px",
                        borderLeft: "4px solid #888",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "#888",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Inativas
                      </div>
                      <div
                        style={{
                          fontSize: "1.8rem",
                          fontWeight: 700,
                          marginTop: "4px",
                        }}
                      >
                        {
                          inventario.filter(
                            (p) =>
                              !(
                                p.disponivel_para_emprestimo ||
                                p.disponivel_emprestimo
                              ) &&
                              !(p.disponivel_para_venda || p.disponivel_venda),
                          ).length
                        }
                      </div>
                    </div>
                  </div>

                  {/* SUB-ABAS */}
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      borderBottom: "2px solid #e5e5e5",
                      marginBottom: "16px",
                    }}
                  >
                    {[
                      { id: "catalogo", label: `Todas (${totalPecas})` },
                      {
                        id: "emprestimo",
                        label: `Empréstimo (${pecasEmprestimo.length})`,
                      },
                      {
                        id: "venda",
                        label: `Venda (${pecasVenda.length})`,
                      },
                    ].map((t) => {
                      const isActive = inventarioTab === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setInventarioTab(t.id)}
                          style={{
                            padding: "10px 18px",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "0.92rem",
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? "#c9a961" : "#666",
                            borderBottom: isActive
                              ? "3px solid #c9a961"
                              : "3px solid transparent",
                            marginBottom: "-2px",
                            transition: "all 0.15s",
                          }}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* TABELA */}
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: "10px",
                      overflow: "hidden",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    }}
                  >
                    <table className="admin-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Foto</th>
                          <th>Nome</th>
                          <th>Categoria</th>
                          <th>Tamanho</th>
                          <th>Estado</th>
                          {inventarioTab === "catalogo" && <th>Tipo</th>}
                          {inventarioTab === "venda" && <th>Preço Venda</th>}
                          {inventarioTab === "emprestimo" && (
                            <>
                              <th>Valor/Dia</th>
                              <th>Situação</th>
                            </>
                          )}
                          {inventarioTab === "catalogo" && (
                            <>
                              <th>Preço Venda</th>
                              <th>Valor/Dia</th>
                            </>
                          )}
                          <th>Pessoas</th>
                          <th className="text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listaAtual.map((p) => {
                          const foto =
                            p.foto_principal ||
                            p.imagem_url ||
                            "https://via.placeholder.com/45";
                          const nome = p.nome_peca || p.nome || "—";
                          const condicao = p.condicao_peca || p.estado || "—";
                          const dispVenda = !!(
                            p.disponivel_para_venda || p.disponivel_venda
                          );
                          const dispEmp = !!(
                            p.disponivel_para_emprestimo ||
                            p.disponivel_emprestimo
                          );
                          const emprestadaAgora = !!p.active_id_emprestimo;

                          return (
                            <tr key={p.id_peca}>
                              <td>
                                <img
                                  src={foto}
                                  alt="peca"
                                  style={{
                                    width: "45px",
                                    height: "45px",
                                    objectFit: "cover",
                                    borderRadius: "6px",
                                    border: "1px solid #ddd",
                                  }}
                                />
                              </td>
                              <td>
                                <strong>{nome}</strong>
                                {p.descricao && (
                                  <div
                                    style={{
                                      fontSize: "0.78rem",
                                      color: "#888",
                                      marginTop: "2px",
                                    }}
                                  >
                                    {p.descricao}
                                  </div>
                                )}
                              </td>
                              <td>{p.categoria || "—"}</td>
                              <td>
                                <span className="badge badge--teal">
                                  {p.tamanho || "—"}
                                </span>
                              </td>
                              <td>{condicao}</td>

                              {/* Coluna Tipo (só na aba Todas) */}
                              {inventarioTab === "catalogo" && (
                                <td>
                                  {dispVenda && (
                                    <span
                                      className="badge badge--teal"
                                      style={{
                                        marginRight: 4,
                                        background: "#c9a961",
                                      }}
                                    >
                                      Venda
                                    </span>
                                  )}
                                  {dispEmp && (
                                    <span
                                      className="badge badge--teal"
                                      style={{ background: "#38a169" }}
                                    >
                                      Empréstimo
                                    </span>
                                  )}
                                  {!dispVenda && !dispEmp && (
                                    <span style={{ color: "#888" }}>—</span>
                                  )}
                                </td>
                              )}

                              {/* Aba VENDA: preço de venda + aviso se não definido */}
                              {inventarioTab === "venda" && (
                                <td>
                                  {p.preco_venda != null ? (
                                    <strong>{p.preco_venda}€</strong>
                                  ) : (
                                    <span
                                      style={{
                                        color: "#c0392b",
                                        fontSize: "0.82rem",
                                      }}
                                    >
                                      Sem preço
                                    </span>
                                  )}
                                </td>
                              )}

                              {/* Aba EMPRÉSTIMO: valor/dia + situação atual */}
                              {inventarioTab === "emprestimo" && (
                                <>
                                  <td>
                                    {p.valor_dia != null ? (
                                      <strong>{p.valor_dia}€</strong>
                                    ) : (
                                      <span style={{ color: "#888" }}>—</span>
                                    )}
                                  </td>
                                  <td>
                                    {emprestadaAgora ? (
                                      <span
                                        className="badge badge--teal"
                                        style={{ background: "#c0392b" }}
                                      >
                                        Emprestada
                                      </span>
                                    ) : (
                                      <span
                                        className="badge badge--teal"
                                        style={{ background: "#38a169" }}
                                      >
                                        Disponível
                                      </span>
                                    )}
                                  </td>
                                </>
                              )}

                              {/* Aba TODAS: ambas as colunas de preço */}
                              {inventarioTab === "catalogo" && (
                                <>
                                  <td>
                                    {p.preco_venda != null
                                      ? `${p.preco_venda}€`
                                      : "—"}
                                  </td>
                                  <td>
                                    {p.valor_dia != null
                                      ? `${p.valor_dia}€`
                                      : "—"}
                                  </td>
                                </>
                              )}

                              {/* Pessoas envolvidas */}
                              <td
                                style={{ fontSize: "0.82rem", lineHeight: 1.5 }}
                              >
                                <div>
                                  <span style={{ color: "#888" }}>
                                    Registou:
                                  </span>{" "}
                                  <strong>{p.registado_por || "—"}</strong>
                                </div>
                                {p.data_registo && (
                                  <div
                                    style={{
                                      color: "#999",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    em{" "}
                                    {new Date(
                                      p.data_registo,
                                    ).toLocaleDateString("pt-PT")}
                                  </div>
                                )}
                                {/* Aba Empréstimo OU peça emprestada agora na aba Todas */}
                                {(inventarioTab === "emprestimo" ||
                                  (inventarioTab === "catalogo" &&
                                    p.active_id_emprestimo)) && (
                                  <div style={{ marginTop: "4px" }}>
                                    <span style={{ color: "#888" }}>
                                      Requisitou:
                                    </span>{" "}
                                    {p.active_id_emprestimo ? (
                                      <strong>
                                        {p.requisitou_por ||
                                          p.requerente ||
                                          "(não disponível)"}
                                      </strong>
                                    ) : (
                                      <span style={{ color: "#aaa" }}>
                                        ninguém
                                      </span>
                                    )}
                                    {p.active_id_emprestimo &&
                                      p.emprestimo_inicio && (
                                        <div
                                          style={{
                                            color: "#999",
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          desde{" "}
                                          {new Date(
                                            p.emprestimo_inicio,
                                          ).toLocaleDateString("pt-PT")}
                                          {p.emprestimo_fim && (
                                            <>
                                              {" "}
                                              até{" "}
                                              {new Date(
                                                p.emprestimo_fim,
                                              ).toLocaleDateString("pt-PT")}
                                            </>
                                          )}
                                        </div>
                                      )}
                                  </div>
                                )}
                                {/* Aba Venda OU peça com info de venda na aba Todas */}
                                {(inventarioTab === "venda" ||
                                  (inventarioTab === "catalogo" &&
                                    p.id_venda)) && (
                                  <>
                                    {p.vendedor &&
                                      p.vendedor !== p.registado_por && (
                                        <div style={{ marginTop: "4px" }}>
                                          <span style={{ color: "#888" }}>
                                            Vendedor:
                                          </span>{" "}
                                          <strong>{p.vendedor}</strong>
                                        </div>
                                      )}
                                    {p.comprador ? (
                                      <div style={{ marginTop: "4px" }}>
                                        <span style={{ color: "#888" }}>
                                          Comprador:
                                        </span>{" "}
                                        <strong>{p.comprador}</strong>
                                        {p.estado_venda && (
                                          <span
                                            style={{
                                              marginLeft: 6,
                                              color: "#38a169",
                                              fontSize: "0.75rem",
                                            }}
                                          >
                                            ({p.estado_venda})
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      inventarioTab === "venda" && (
                                        <div
                                          style={{
                                            marginTop: "4px",
                                            color: "#aaa",
                                          }}
                                        >
                                          Sem comprador ainda
                                        </div>
                                      )
                                    )}
                                  </>
                                )}
                              </td>

                              {/* Ações */}
                              <td className="text-center whitespace-nowrap">
                                <button
                                  className="btn-sm btn-sm--primary mr-8"
                                  onClick={() => abrirModalEditarPeca(p)}
                                >
                                  Editar
                                </button>
                                {inventarioTab === "venda" &&
                                  p.preco_venda == null && (
                                    <button
                                      className="btn-sm mr-8"
                                      style={{
                                        background: "#c9a961",
                                        color: "#fff",
                                      }}
                                      onClick={() => handleDefinirPrecoVenda(p)}
                                    >
                                      Definir Preço
                                    </button>
                                  )}
                                <button
                                  className="btn-sm btn-sm--danger"
                                  onClick={() =>
                                    handleEliminarPeca(p.id_peca, nome)
                                  }
                                >
                                  Apagar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {listaAtual.length === 0 && (
                          <tr>
                            <td
                              colSpan={
                                inventarioTab === "emprestimo"
                                  ? 9
                                  : inventarioTab === "venda"
                                    ? 8
                                    : 10
                              }
                              style={{
                                textAlign: "center",
                                padding: "30px",
                                color: "#888",
                              }}
                            >
                              {inventarioTab === "emprestimo"
                                ? "Nenhuma peça configurada para empréstimo."
                                : inventarioTab === "venda"
                                  ? "Nenhuma peça à venda."
                                  : "Nenhuma peça no inventário."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </main>

      {/* --- MODAIS: INVENTÁRIO --- */}
      {modalPeca.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2 className="admin-modal-title">
              {modalPeca.mode === "create" ? "Nova Peça" : "Editar Peça"}
            </h2>
            <form className="admin-form" onSubmit={submeterModalPeca}>
              <div className="form-group-row">
                <div className="field form-col-2">
                  <label>Nome da Peça *</label>
                  <input
                    type="text"
                    required
                    value={modalPeca.data.nome}
                    onChange={(e) =>
                      setModalPeca({
                        ...modalPeca,
                        data: { ...modalPeca.data, nome: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="field form-col-1">
                  <label>Tamanho</label>
                  <input
                    type="text"
                    placeholder="Ex: M, L, 42..."
                    value={modalPeca.data.tamanho}
                    onChange={(e) =>
                      setModalPeca({
                        ...modalPeca,
                        data: { ...modalPeca.data, tamanho: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label>Descrição</label>
                <input
                  type="text"
                  value={modalPeca.data.descricao}
                  onChange={(e) =>
                    setModalPeca({
                      ...modalPeca,
                      data: { ...modalPeca.data, descricao: e.target.value },
                    })
                  }
                />
              </div>
              <div className="form-group-row">
                <div className="field form-col-1">
                  <label>Estado *</label>
                  <select
                    required
                    value={modalPeca.data.estado}
                    onChange={(e) =>
                      setModalPeca({
                        ...modalPeca,
                        data: { ...modalPeca.data, estado: e.target.value },
                      })
                    }
                  >
                    <option value="Excelente">Excelente</option>
                    <option value="Bom">Bom</option>
                    <option value="Razoável">Razoável</option>
                    <option value="Danificado">Danificado</option>
                  </select>
                </div>
                <div className="field form-col-1">
                  <label>Preço de Venda (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalPeca.data.preco}
                    onChange={(e) =>
                      setModalPeca({
                        ...modalPeca,
                        data: { ...modalPeca.data, preco: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="field form-col-1">
                  <label>Valor/Dia Empréstimo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalPeca.data.valor_dia}
                    onChange={(e) =>
                      setModalPeca({
                        ...modalPeca,
                        data: { ...modalPeca.data, valor_dia: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-group-row" style={{ gap: "24px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!modalPeca.data.disponivelVenda}
                    onChange={(e) =>
                      setModalPeca({
                        ...modalPeca,
                        data: {
                          ...modalPeca.data,
                          disponivelVenda: e.target.checked,
                        },
                      })
                    }
                  />
                  Disponível para Venda
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!modalPeca.data.disponivelEmprestimo}
                    onChange={(e) =>
                      setModalPeca({
                        ...modalPeca,
                        data: {
                          ...modalPeca.data,
                          disponivelEmprestimo: e.target.checked,
                        },
                      })
                    }
                  />
                  Disponível para Empréstimo
                </label>
              </div>
              {modalPeca.data.disponivelVenda && (
                <div className="field" style={{ marginTop: "12px" }}>
                  <label>Métodos de Pagamento Aceites (Venda)</label>
                  <div
                    style={{ display: "flex", gap: "10px", marginTop: "6px" }}
                  >
                    {["MBWay", "Transferência", "Numerário"].map((metodo) => {
                      const selecionados =
                        modalPeca.data.metodosPagamento || [];
                      const estaChecked = selecionados.includes(metodo);
                      return (
                        <label
                          key={metodo}
                          className="check-label-styled"
                          style={{ padding: "8px 14px", margin: 0 }}
                        >
                          <input
                            type="checkbox"
                            checked={estaChecked}
                            onChange={(e) => {
                              const novosMetodos = e.target.checked
                                ? [...selecionados, metodo]
                                : selecionados.filter((m) => m !== metodo);
                              setModalPeca({
                                ...modalPeca,
                                data: {
                                  ...modalPeca.data,
                                  metodosPagamento: novosMetodos,
                                },
                              });
                            }}
                          />
                          <span>{metodo}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Escolha dos Métodos de Pagamento no Empréstimo */}
              {modalPeca.data.disponivelEmprestimo && (
                <div className="field" style={{ marginTop: "12px" }}>
                  <label>Métodos de Pagamento Aceites (Empréstimo)</label>
                  <div
                    style={{ display: "flex", gap: "10px", marginTop: "6px" }}
                  >
                    {["MBWay", "Transferência", "Numerário"].map((metodo) => {
                      const selecionados =
                        modalPeca.data.metodosPagamentoEmprestimo || [];
                      const estaChecked = selecionados.includes(metodo);
                      return (
                        <label
                          key={`emp-${metodo}`}
                          className="check-label-styled"
                          style={{ padding: "8px 14px", margin: 0 }}
                        >
                          <input
                            type="checkbox"
                            checked={estaChecked}
                            onChange={(e) => {
                              const novosMetodos = e.target.checked
                                ? [...selecionados, metodo]
                                : selecionados.filter((m) => m !== metodo);
                              setModalPeca({
                                ...modalPeca,
                                data: {
                                  ...modalPeca.data,
                                  metodosPagamentoEmprestimo: novosMetodos,
                                },
                              });
                            }}
                          />
                          <span>{metodo}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="field" style={{ marginTop: "12px" }}>
                <label>Fotografias</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAdicionarFotos}
                />
                {(modalPeca.data.fotos || []).length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginTop: "10px",
                    }}
                  >
                    {(modalPeca.data.fotos || []).map((f, i) => (
                      <div
                        key={i}
                        style={{
                          position: "relative",
                          width: "90px",
                          height: "90px",
                        }}
                      >
                        <img
                          src={f}
                          alt={`foto-${i}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: "8px",
                            border: "2px solid var(--accent-gold, #c9a961)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoverFoto(i)}
                          title="Remover"
                          style={{
                            position: "absolute",
                            top: "-6px",
                            right: "-6px",
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            border: "none",
                            background: "#c0392b",
                            color: "#fff",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#888",
                    marginTop: "6px",
                  }}
                >
                  Podes adicionar múltiplas fotos. Ao editar uma peça, as fotos
                  aqui exibidas substituirão todas as anteriores.
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() =>
                    setModalPeca({ isOpen: false, mode: "create", data: {} })
                  }
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  {modalPeca.mode === "create"
                    ? "Criar Peça"
                    : "Guardar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalEstado.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: "440px" }}>
            <h2 className="admin-modal-title">Alterar Estado</h2>
            <p className="admin-modal-subtitle">{modalEstado.peca?.nome}</p>
            <form className="admin-form" onSubmit={submeterEstadoPeca}>
              <div className="field">
                <label>Estado Físico *</label>
                <select
                  required
                  value={modalEstado.estado}
                  onChange={(e) =>
                    setModalEstado({ ...modalEstado, estado: e.target.value })
                  }
                >
                  <option value="Excelente">Excelente</option>
                  <option value="Bom">Bom</option>
                  <option value="Razoável">Razoável</option>
                  <option value="Danificado">Danificado</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!modalEstado.dispEmp}
                    onChange={(e) =>
                      setModalEstado({
                        ...modalEstado,
                        dispEmp: e.target.checked,
                      })
                    }
                  />
                  Disponível Empréstimo
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!modalEstado.dispVenda}
                    onChange={(e) =>
                      setModalEstado({
                        ...modalEstado,
                        dispVenda: e.target.checked,
                      })
                    }
                  />
                  Disponível Venda
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() =>
                    setModalEstado({
                      isOpen: false,
                      peca: null,
                      estado: "",
                      dispEmp: false,
                      dispVenda: false,
                    })
                  }
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Guardar Estado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAIS DE ADMINISTRAÇÃO BÁSICA --- */}
      {modalUser.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2 className="admin-modal-title">
              {modalUser.mode === "create"
                ? "Criar Novo Utilizador"
                : "Editar Utilizador"}
            </h2>
            <form className="admin-form" onSubmit={submeterModal}>
              {modalUser.data.tipo === "EE" && (
                <div className="form-group-row">
                  <div className="field form-col-2">
                    <label>Nome do Educando (Aluno)</label>
                    <input
                      type="text"
                      placeholder="Nome do aluno"
                      value={modalUser.data.nomeAluno || ""}
                      onChange={(e) =>
                        setModalUser({
                          ...modalUser,
                          data: {
                            ...modalUser.data,
                            nomeAluno: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="field form-col-1">
                    <label>Data Nasc.</label>
                    <input
                      type="date"
                      value={modalUser.data.dataNascimentoAluno || ""}
                      onChange={(e) =>
                        setModalUser({
                          ...modalUser,
                          data: {
                            ...modalUser.data,
                            dataNascimentoAluno: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
              <div className="field">
                <label>Nome Completo (Encarregado/Prof)</label>
                <input
                  type="text"
                  value={modalUser.data.nome}
                  onChange={(e) =>
                    setModalUser({
                      ...modalUser,
                      data: { ...modalUser.data, nome: e.target.value },
                    })
                  }
                  required
                />
              </div>
              <div className="field">
                <label>Email *</label>
                <input
                  type="text"
                  placeholder="exemplo@viva.pt"
                  value={modalUser.data.email}
                  onChange={(e) =>
                    setModalUser({
                      ...modalUser,
                      data: { ...modalUser.data, email: e.target.value },
                    })
                  }
                  required
                />
              </div>
              <div className="form-group-row">
                <div className="field form-col-1">
                  <label>Telefone</label>
                  <input
                    type="text"
                    placeholder="912345678"
                    value={modalUser.data.telefone}
                    onChange={(e) =>
                      setModalUser({
                        ...modalUser,
                        data: { ...modalUser.data, telefone: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="field form-col-1">
                  <label>Perfil de Acesso *</label>
                  <select
                    value={modalUser.data.tipo}
                    onChange={(e) =>
                      setModalUser({
                        ...modalUser,
                        data: { ...modalUser.data, tipo: e.target.value },
                      })
                    }
                  >
                    <option value="EE">Encarregado de Educação</option>
                    <option value="PROF">Professor</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>
                  Palavra-passe{" "}
                  {modalUser.mode === "edit" && (
                    <span className="password-hint">
                      (Deixe em branco para manter)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={
                    modalUser.mode === "create"
                      ? "Mín. 8 caracteres e 1 especial"
                      : "••••••••"
                  }
                  value={modalUser.data.password}
                  onChange={(e) =>
                    setModalUser({
                      ...modalUser,
                      data: { ...modalUser.data, password: e.target.value },
                    })
                  }
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={fecharModal}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Guardar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMods.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content admin-modal-content--sm">
            <h3 className="admin-modal-title admin-modal-title--sm">
              Associar Modalidades
            </h3>
            <p className="admin-modal-subtitle">
              Selecione as modalidades que este professor leciona:
            </p>
            <div className="modalities-grid">
              {allModalidades.map((m) => (
                <label key={m.id_modalidade} className="check-label-styled">
                  <input
                    type="checkbox"
                    checked={modalMods.selectedIds.includes(m.id_modalidade)}
                    onChange={(e) => {
                      const ids = e.target.checked
                        ? [...modalMods.selectedIds, m.id_modalidade]
                        : modalMods.selectedIds.filter(
                            (id) => id !== m.id_modalidade,
                          );
                      setModalMods({ ...modalMods, selectedIds: ids });
                    }}
                  />
                  <span>{m.nome}</span>
                </label>
              ))}
              {allModalidades.length === 0 && (
                <span className="empty-modalities">
                  Nenhuma modalidade registada no sistema.
                </span>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setModalMods({ isOpen: false })}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-submit"
                onClick={guardarModalidades}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: EDITAR PREÇO --- */}
      {modalPreco.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: "450px" }}>
            <h2 className="admin-modal-title">Editar Regra de Preço</h2>
            <p className="admin-modal-subtitle">
              ID #{modalPreco.data.id_preco} - {modalPreco.data.formato_aula} (
              {modalPreco.data.dia_semana === 1
                ? "Dias Úteis"
                : "Fins-de-Semana"}
              )
            </p>

            <form className="admin-form" onSubmit={submeterModalPreco}>
              <div className="form-group-row">
                <div className="field form-col-1">
                  <label>Duração (Minutos)</label>
                  <input
                    type="number"
                    readOnly
                    value={modalPreco.data.duracao_minutos}
                    style={{
                      backgroundColor: "#f0f0f0",
                      cursor: "not-allowed",
                    }}
                  />
                </div>
                <div className="field form-col-1">
                  <label>Preço (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={modalPreco.data.preco}
                    onChange={(e) =>
                      setModalPreco({
                        ...modalPreco,
                        data: { ...modalPreco.data, preco: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div className="field" style={{ marginTop: "15px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={modalPreco.data.ativo}
                    onChange={(e) =>
                      setModalPreco({
                        ...modalPreco,
                        data: { ...modalPreco.data, ativo: e.target.checked },
                      })
                    }
                    style={{
                      width: "18px",
                      height: "18px",
                      accentColor: "var(--green)",
                    }}
                  />
                  <span style={{ fontWeight: "600" }}>Regra Ativa</span>
                </label>
              </div>

              <div className="modal-actions" style={{ marginTop: "25px" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setModalPreco({ isOpen: false, data: {} })}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Guardar Preço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detalhe da Fatura  */}
      {modalDetalheFatura.isOpen && (
        <div className="admin-modal-overlay" onClick={fecharDetalheFatura}>
          <div
            className="admin-modal-content"
            style={{ maxWidth: "780px", width: "92%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="admin-modal-title">Detalhe da Fatura</h2>

            {modalDetalheFatura.loading ? (
              <p
                style={{
                  textAlign: "center",
                  padding: "30px",
                  color: "#888",
                }}
              >
                A carregar detalhes…
              </p>
            ) : modalDetalheFatura.erro ? (
              <div
                style={{
                  background: "#fdecea",
                  borderLeft: "4px solid #d9534f",
                  padding: "14px 18px",
                  borderRadius: "8px",
                  color: "#a02a25",
                }}
              >
                {modalDetalheFatura.erro}
              </div>
            ) : (
              <>
                {/* Cabeçalho da fatura */}
                {modalDetalheFatura.fatura && (
                  <div
                    style={{
                      background: "#fdfaf5",
                      border: "1px solid #ecdfc4",
                      borderRadius: "10px",
                      padding: "14px 18px",
                      marginBottom: "18px",
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "10px 24px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <div>
                      <div style={{ color: "#888", fontSize: "0.75rem" }}>
                        Fatura
                      </div>
                      <strong>#{modalDetalheFatura.fatura.id_faturacao}</strong>
                    </div>
                    <div>
                      <div style={{ color: "#888", fontSize: "0.75rem" }}>
                        Utilizador
                      </div>
                      <strong>
                        {modalDetalheFatura.fatura.nome_utilizador || "—"}
                      </strong>
                      <div style={{ fontSize: "0.78rem", color: "#888" }}>
                        {modalDetalheFatura.fatura.email_utilizador || ""}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#888", fontSize: "0.75rem" }}>
                        Período
                      </div>
                      <strong>
                        {String(modalDetalheFatura.fatura.mes).padStart(2, "0")}
                        /{modalDetalheFatura.fatura.ano}
                      </strong>
                    </div>
                    <div>
                      <div style={{ color: "#888", fontSize: "0.75rem" }}>
                        Estado
                      </div>
                      <span
                        className={`badge badge--${
                          modalDetalheFatura.fatura.estado_pagamento === "Pago"
                            ? "green"
                            : modalDetalheFatura.fatura.estado_pagamento ===
                                "Cancelado"
                              ? "danger"
                              : "orange"
                        }`}
                      >
                        {modalDetalheFatura.fatura.estado_pagamento || "—"}
                      </span>
                    </div>
                    <div>
                      <div style={{ color: "#888", fontSize: "0.75rem" }}>
                        Método de pagamento
                      </div>
                      <strong>
                        {modalDetalheFatura.fatura.metodo_pagamento || "—"}
                      </strong>
                    </div>
                    <div>
                      <div style={{ color: "#888", fontSize: "0.75rem" }}>
                        Data de pagamento
                      </div>
                      <strong>
                        {modalDetalheFatura.fatura.data_pagamento
                          ? new Date(
                              modalDetalheFatura.fatura.data_pagamento,
                            ).toLocaleDateString("pt-PT")
                          : "—"}
                      </strong>
                    </div>
                    <div style={{ gridColumn: "1 / -1", marginTop: "4px" }}>
                      <div style={{ color: "#888", fontSize: "0.75rem" }}>
                        Total
                      </div>
                      <strong
                        style={{
                          fontSize: "1.3rem",
                          color: "var(--primary-dark)",
                        }}
                      >
                        {Number(modalDetalheFatura.fatura.total || 0).toFixed(
                          2,
                        )}
                        €
                      </strong>
                    </div>
                  </div>
                )}

                {modalDetalheFatura.linhas.length === 0 ? (
                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#888",
                      background: "#fafafa",
                      borderRadius: "8px",
                    }}
                  >
                    Nenhuma aula encontrada para esta fatura.
                  </div>
                ) : modalDetalheFatura.modoIndividual ||
                  modalDetalheFatura.linhas.length === 1 ? (
                  (() => {
                    const aula = modalDetalheFatura.linhas[0];
                    const hh = formatarHoraSqlTime(aula.hora_inicio);
                    const horaFim = calcularHoraFim(
                      aula.hora_inicio,
                      aula.duracao_minutos,
                    );
                    const corEstado =
                      aula.estado_coaching === "Realizado" ||
                      aula.validacao_professor === "Confirmado"
                        ? "green"
                        : aula.estado_coaching === "Nao_Realizado"
                          ? "danger"
                          : aula.estado_coaching === "Confirmado"
                            ? "teal"
                            : "orange";
                    return (
                      <>
                        <h3
                          style={{
                            margin: "0 0 12px",
                            fontSize: "1rem",
                            color: "var(--primary-dark)",
                          }}
                        >
                          Detalhes da aula
                        </h3>
                        <div
                          style={{
                            background: "#fff",
                            border: "1px solid #e8e3d6",
                            borderRadius: "10px",
                            padding: "18px 22px",
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)",
                            gap: "14px 28px",
                            fontSize: "0.92rem",
                          }}
                        >
                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              ID Coaching
                            </div>
                            <strong>#{aula.id_coaching}</strong>
                          </div>
                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Estado
                            </div>
                            <span className={`badge badge--${corEstado}`}>
                              {aula.estado_coaching || "—"}
                            </span>
                          </div>

                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Modalidade
                            </div>
                            <strong>{aula.modalidade || "—"}</strong>
                          </div>
                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Formato / Participantes
                            </div>
                            <strong>
                              {aula.formato_aula || "—"}
                              {aula.numero_participantes
                                ? ` · ${aula.numero_participantes} aluno(s)`
                                : ""}
                            </strong>
                          </div>

                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Data
                            </div>
                            <strong>
                              {aula.data_aula
                                ? new Date(aula.data_aula).toLocaleDateString(
                                    "pt-PT",
                                  )
                                : "—"}
                            </strong>
                          </div>
                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Hora · Duração
                            </div>
                            <strong>
                              {hh}
                              {horaFim ? ` – ${horaFim}` : ""}{" "}
                              <span style={{ color: "#999", fontWeight: 400 }}>
                                ({aula.duracao_minutos || "—"} min)
                              </span>
                            </strong>
                          </div>

                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Professor
                            </div>
                            <strong>{aula.nome_professor || "—"}</strong>
                          </div>
                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Sala
                            </div>
                            <strong>{aula.sala || "—"}</strong>
                          </div>

                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Validação do professor
                            </div>
                            <strong>
                              {aula.validacao_professor || "Pendente"}
                            </strong>
                            {aula.data_validacao_professor && (
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "#888",
                                }}
                              >
                                {new Date(
                                  aula.data_validacao_professor,
                                ).toLocaleString("pt-PT")}
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ color: "#888", fontSize: "0.75rem" }}>
                              Valor da aula
                            </div>
                            <strong
                              style={{
                                fontSize: "1.05rem",
                                color: "var(--primary-dark)",
                              }}
                            >
                              {Number(aula.valor_final || 0).toFixed(2)}€
                            </strong>
                            {aula.custo_estimado != null &&
                              Math.round(Number(aula.custo_estimado) * 100) !==
                                Math.round(Number(aula.valor_final) * 100) && (
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "#888",
                                  }}
                                >
                                  estimado:{" "}
                                  {Number(aula.custo_estimado).toFixed(2)}€
                                </div>
                              )}
                          </div>

                          {aula.observacoes_professor && (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <div
                                style={{
                                  color: "#888",
                                  fontSize: "0.75rem",
                                }}
                              >
                                Observações do professor
                              </div>
                              <div
                                style={{
                                  background: "#fdfaf5",
                                  border: "1px solid #ecdfc4",
                                  borderRadius: "8px",
                                  padding: "10px 12px",
                                  marginTop: "4px",
                                  fontSize: "0.88rem",
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {aula.observacoes_professor}
                              </div>
                            </div>
                          )}

                          {aula.data_pedido && (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <div
                                style={{
                                  color: "#aaa",
                                  fontSize: "0.72rem",
                                  marginTop: "4px",
                                }}
                              >
                                Pedido submetido em{" "}
                                {new Date(aula.data_pedido).toLocaleString(
                                  "pt-PT",
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <>
                    <h3
                      style={{
                        margin: "0 0 10px",
                        fontSize: "1rem",
                        color: "var(--primary-dark)",
                      }}
                    >
                      Aulas faturadas neste período (
                      {modalDetalheFatura.linhas.length})
                    </h3>
                    <div
                      style={{
                        maxHeight: "360px",
                        overflowY: "auto",
                        border: "1px solid #eee",
                        borderRadius: "8px",
                      }}
                    >
                      <table
                        className="admin-table"
                        style={{ margin: 0, fontSize: "0.88rem" }}
                      >
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Hora</th>
                            <th>Modalidade</th>
                            <th>Professor</th>
                            <th>Sala</th>
                            <th style={{ textAlign: "right" }}>Valor</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalDetalheFatura.linhas.map((l) => {
                            const horaCurta = formatarHoraSqlTime(
                              l.hora_inicio,
                            );
                            const cor =
                              l.estado_coaching === "Realizado" ||
                              l.validacao_professor === "Confirmado"
                                ? "green"
                                : l.estado_coaching === "Nao_Realizado"
                                  ? "danger"
                                  : l.estado_coaching === "Confirmado"
                                    ? "teal"
                                    : "orange";
                            return (
                              <tr key={l.id_coaching}>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  {l.data_aula
                                    ? new Date(l.data_aula).toLocaleDateString(
                                        "pt-PT",
                                      )
                                    : "—"}
                                </td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                  {horaCurta}{" "}
                                  <span
                                    style={{
                                      color: "#999",
                                      fontSize: "0.78rem",
                                    }}
                                  >
                                    ({l.duracao_minutos}min)
                                  </span>
                                </td>
                                <td>
                                  <strong>{l.modalidade || "—"}</strong>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#888",
                                    }}
                                  >
                                    {l.formato_aula || ""}
                                  </div>
                                </td>
                                <td>{l.nome_professor || "—"}</td>
                                <td>{l.sala || "—"}</td>
                                <td
                                  style={{
                                    textAlign: "right",
                                    whiteSpace: "nowrap",
                                    fontWeight: 700,
                                  }}
                                >
                                  {Number(l.valor_final || 0).toFixed(2)}€
                                </td>
                                <td>
                                  <span className={`badge badge--${cor}`}>
                                    {l.estado_coaching || "—"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "20px",
              }}
            >
              <button className="btn-cancel" onClick={fecharDetalheFatura}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAprovar.isOpen && modalAprovar.pedido && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2 className="admin-modal-title">
              Aprovar Pedido #{modalAprovar.pedido.id_pedido_coaching}
            </h2>
            <div
              style={{
                backgroundColor: "#f4f4f4",
                padding: "10px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "0.9rem",
              }}
            >
              <p>
                <strong>EE:</strong> {modalAprovar.pedido.encarregado}
              </p>
              <p>
                <strong>Aluno(s):</strong> {modalAprovar.pedido.alunos}
              </p>
              <p>
                <strong>Modalidade:</strong> {modalAprovar.pedido.modalidade} (
                {modalAprovar.pedido.duracao_minutos} min)
              </p>
              <p>
                <strong>Data/Hora:</strong>{" "}
                {formatDataApi(modalAprovar.pedido.data_aula_pretendida)} às{" "}
                {formatHoraCurta(modalAprovar.pedido.hora_inicio_pretendida)}
              </p>
              <p>
                <strong>Preço do Sistema:</strong>{" "}
                {modalAprovar.pedido.custo_estimado} €
              </p>
            </div>
            <form className="admin-form" onSubmit={submeterAprovacao}>
              <div className="field">
                <label>Professor a Atribuir *</label>
                <select
                  required
                  value={modalAprovar.idProfessor}
                  onChange={(e) =>
                    setModalAprovar({
                      ...modalAprovar,
                      idProfessor: e.target.value,
                    })
                  }
                >
                  <option value="">-- Selecione o Professor --</option>
                  {profs.map((prof) => (
                    <option key={prof.id_utilizador} value={prof.id_utilizador}>
                      {prof.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-row">
                <div className="field form-col-1">
                  <label>Atribuir Sala *</label>
                  <select
                    required
                    value={modalAprovar.idSala}
                    onChange={(e) =>
                      setModalAprovar({
                        ...modalAprovar,
                        idSala: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Escolha uma Sala --</option>
                    {salas.map((s) => (
                      <option key={s.id_sala} value={s.id_sala}>
                        {s.nome} (Max: {s.capacidade_maxima} pes.)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field form-col-1">
                  <label>Valor a Cobrar (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalAprovar.valorFinal}
                    onChange={(e) =>
                      setModalAprovar({
                        ...modalAprovar,
                        valorFinal: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() =>
                    setModalAprovar({ isOpen: false, pedido: null })
                  }
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Confirmar e Agendar Sala
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalAgendarDireto.isOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content admin-modal-content--lg">
            <h2 className="admin-modal-title">Agendamento Direto</h2>
            <p className="admin-modal-subtitle">
              Criar pedido escrevendo os nomes para pesquisa instantânea.
            </p>
            <form className="admin-form" onSubmit={handleAgendarDireto}>
              <div className="form-group-row">
                <div className="field form-col-1">
                  <label>Pesquisar Encarregado / Aluno *</label>
                  <SearchableSelect
                    placeholder="Escreve o nome do EE ou Aluno..."
                    options={eeOptions}
                    value={modalAgendarDireto.idEncarregado}
                    onChange={(id) =>
                      setModalAgendarDireto({
                        ...modalAgendarDireto,
                        idEncarregado: id,
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="field form-col-1">
                  <label>Modalidade *</label>
                  <SearchableSelect
                    placeholder="Selecionar Modalidade..."
                    options={modalidadesDisponiveis.map((m) => ({
                      id: m.id_modalidade,
                      label: m.nome,
                    }))}
                    value={modalAgendarDireto.idModalidade}
                    onChange={handleModChange}
                  />
                </div>
                <div className="field form-col-1">
                  <label>Professor *</label>
                  <SearchableSelect
                    placeholder="Selecionar Professor..."
                    options={profsDisponiveis.map((p) => ({
                      id: p.id_utilizador,
                      label: p.nome,
                    }))}
                    value={modalAgendarDireto.idProfessor}
                    onChange={handleProfChange}
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="field form-col-1">
                  <label>Sala *</label>
                  <SearchableSelect
                    placeholder="Selecionar Sala..."
                    options={salas.map((s) => ({
                      id: s.id_sala,
                      label: `${s.nome} (Max: ${s.capacidade_maxima})`,
                    }))}
                    value={modalAgendarDireto.idSala}
                    onChange={(id) =>
                      setModalAgendarDireto({
                        ...modalAgendarDireto,
                        idSala: id,
                      })
                    }
                  />
                </div>

                <div className="field form-col-1">
                  <label>Data da Aula *</label>
                  <input
                    type="date"
                    required
                    value={modalAgendarDireto.dataAula}
                    onChange={(e) =>
                      setModalAgendarDireto({
                        ...modalAgendarDireto,
                        dataAula: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field form-col-1">
                  <label>Hora Início *</label>
                  <input
                    type="time"
                    required
                    value={modalAgendarDireto.horaInicio}
                    onChange={(e) =>
                      setModalAgendarDireto({
                        ...modalAgendarDireto,
                        horaInicio: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="field form-col-1">
                  <label>Formato *</label>
                  <select
                    required
                    value={modalAgendarDireto.formatoAula}
                    onChange={(e) =>
                      setModalAgendarDireto({
                        ...modalAgendarDireto,
                        formatoAula: e.target.value,
                      })
                    }
                  >
                    <option value="Solo">Solo</option>
                    <option value="Dueto">Dueto</option>
                    <option value="Trio">Trio</option>
                    <option value="Ensemble">Ensemble</option>
                  </select>
                </div>
                <div className="field form-col-1">
                  <label>Duração (min) *</label>
                  <select
                    required
                    value={modalAgendarDireto.duracaoMinutos}
                    onChange={(e) =>
                      setModalAgendarDireto({
                        ...modalAgendarDireto,
                        duracaoMinutos: Number(e.target.value),
                      })
                    }
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
                <div className="field form-col-1">
                  <label>Valor a Cobrar (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalAgendarDireto.valorFinal}
                    onChange={(e) =>
                      setModalAgendarDireto({
                        ...modalAgendarDireto,
                        valorFinal: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field form-col-1">
                  <label>Ano Letivo *</label>
                  <select
                    required
                    value={modalAgendarDireto.idAnoLetivo}
                    onChange={(e) =>
                      setModalAgendarDireto({
                        ...modalAgendarDireto,
                        idAnoLetivo: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Selecionar Ano --</option>
                    {anosLetivos.map((a) => (
                      <option key={a.id_ano_letivo} value={a.id_ano_letivo}>
                        {a.ano}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() =>
                    setModalAgendarDireto({
                      ...modalAgendarDireto,
                      isOpen: false,
                    })
                  }
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Forçar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {msg && <div className={`toast toast--${msg.tipo}`}>{msg.texto}</div>}
    </div>
  );
}
